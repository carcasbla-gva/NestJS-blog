import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { copyFile } from 'fs/promises';
import { join } from 'path';
import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { BlogService } from '../blog/blog.service';
import { AdminGuard } from '../common/guards';
import { CsrfService } from '../common/csrf.service';
import {
  GALLERY_IMAGE_DIR,
  PORTFOLIO_IMAGE_DIR,
  POSTS_IMAGE_DIR,
} from '../common/paths';
import { createThumbnail, optimizeImage } from '../common/images';
import {
  imageStorage,
  isAllowedImageMime,
  removeUploadedFile,
} from '../common/upload';
import {
  formBoolean,
  formString,
  parseInteger,
  parseTags,
} from '../common/view-helpers';
import { Post as PostEntity } from '../entities/post.entity';
import { Category } from '../entities/category.entity';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly blogService: BlogService,
    private readonly csrfService: CsrfService,
  ) {}

  @Get()
  async dashboard(@Res() res: Response): Promise<void> {
    const stats = await this.adminService.stats();
    res.render('admin/dashboard', { stats });
  }

  // ---------------------------------------------------------------- Posts

  @Get('posts')
  async posts(@Res() res: Response): Promise<void> {
    const posts = await this.adminService.listPosts();
    res.render('admin/posts', { posts });
  }

  @Get('posts/:id/edit')
  async editPostForm(
    @Param('id') rawId: string,
    @Res() res: Response,
  ): Promise<void> {
    const post = await this.adminService.findPost(this.parseId(rawId));
    if (!post) {
      throw new NotFoundException('Post no encontrado');
    }
    await this.renderPostForm(res, post, this.postValues(post), {});
  }

  @Post('posts/:id/edit')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: imageStorage(POSTS_IMAGE_DIR),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async updatePost(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<void> {
    try {
      this.csrfService.assertValid(req);
    } catch (error) {
      await removeUploadedFile(file);
      throw error;
    }

    const post = await this.adminService.findPost(this.parseId(rawId));
    if (!post) {
      await removeUploadedFile(file);
      throw new NotFoundException('Post no encontrado');
    }

    const values = {
      title: formString(req.body.title),
      content: formString(req.body.content),
      category: formString(req.body.category),
      tags: formString(req.body.tags),
      published: formBoolean(req.body.published) ? '1' : '',
    };

    const errors: Record<string, string> = {};
    if (!values.title) {
      errors.title = 'El título es obligatorio';
    }
    if (!values.content) {
      errors.content = 'El contenido es obligatorio';
    }
    if (file && !isAllowedImageMime(file.mimetype)) {
      errors.image = 'Por favor sube una imagen válida (JPEG o PNG)';
    }

    const categoryId = parseInteger(values.category, 0);
    let category: Category | null = null;
    if (Number.isNaN(categoryId)) {
      errors.category = 'Selecciona una categoría válida';
    } else if (categoryId > 0) {
      category = await this.adminService.findCategoryById(categoryId);
      if (!category) {
        errors.category = 'La categoría seleccionada no existe';
      }
    }

    if (Object.keys(errors).length > 0) {
      await removeUploadedFile(file);
      await this.renderPostForm(res, post, values, errors);
      return;
    }

    if (file) {
      await optimizeImage(file.path);
    }

    await this.blogService.updatePost(post, {
      title: values.title,
      content: values.content,
      image: file?.filename ?? '',
      category,
      tags: parseTags(values.tags),
      published: formBoolean(req.body.published),
    });

    req.session.flash = {
      type: 'success',
      message: 'Post actualizado correctamente.',
    };
    res.redirect('/admin/posts');
  }

  @Post('posts/:id/delete')
  async deletePost(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const post = await this.adminService.findPost(this.parseId(rawId));
    if (!post) {
      throw new NotFoundException('Post no encontrado');
    }

    await this.blogService.deletePost(post);
    req.session.flash = {
      type: 'success',
      message: 'Post eliminado.',
    };
    res.redirect('/admin/posts');
  }

  private postValues(post: PostEntity): Record<string, string> {
    return {
      title: post.title,
      content: post.content,
      category: post.category ? String(post.category.id) : '',
      tags: (post.tags ?? []).join(', '),
      published: post.published ? '1' : '',
    };
  }

  private async renderPostForm(
    res: Response,
    post: PostEntity,
    values: Record<string, string>,
    errors: Record<string, string>,
  ): Promise<void> {
    const categories = await this.adminService.listCategories();
    res.status(200).render('admin/edit_post', {
      post,
      values,
      errors,
      categories,
    });
  }

  // ----------------------------------------------------------- Categories

  @Get('categories')
  async categoriesForm(@Res() res: Response): Promise<void> {
    await this.renderCategories(res);
  }

  @Post('categories')
  async createCategory(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const values = {
      name: formString(req.body.name),
      description: formString(req.body.description),
    };
    const errors: Record<string, string> = {};

    if (!values.name) {
      errors.name = 'El nombre es obligatorio';
    }

    if (Object.keys(errors).length > 0) {
      await this.renderCategories(res, values, errors);
      return;
    }

    await this.adminService.createCategory(
      values.name,
      values.description || null,
    );
    req.session.flash = {
      type: 'success',
      message: 'Categoría creada correctamente.',
    };
    res.redirect('/admin/categories');
  }

  @Post('categories/:id')
  async updateCategory(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const category = await this.adminService.findCategoryById(
      this.parseId(rawId),
    );
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const name = formString(req.body.name);
    const description = formString(req.body.description);

    if (!name) {
      req.session.flash = {
        type: 'error',
        message: 'El nombre de la categoría es obligatorio.',
      };
      res.redirect('/admin/categories');
      return;
    }

    await this.adminService.updateCategory(
      category,
      name,
      description || null,
    );
    req.session.flash = {
      type: 'success',
      message: 'Categoría actualizada.',
    };
    res.redirect('/admin/categories');
  }

  @Post('categories/:id/delete')
  async deleteCategory(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const category = await this.adminService.findCategoryById(
      this.parseId(rawId),
    );
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    await this.adminService.deleteCategory(category);
    req.session.flash = {
      type: 'success',
      message: 'Categoría eliminada.',
    };
    res.redirect('/admin/categories');
  }

  private async renderCategories(
    res: Response,
    values: Record<string, string> = {},
    errors: Record<string, string> = {},
  ): Promise<void> {
    const categories = await this.adminService.listCategories();
    res.status(200).render('admin/categories', {
      categories,
      values,
      errors,
    });
  }

  // --------------------------------------------------------------- Images

  @Get('images')
  async imagesForm(@Res() res: Response): Promise<void> {
    await this.renderImages(res);
  }

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageStorage(GALLERY_IMAGE_DIR),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createImage(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<void> {
    try {
      this.csrfService.assertValid(req);
    } catch (error) {
      await removeUploadedFile(file);
      throw error;
    }

    const values = this.imageValues(req.body);
    const { errors, category, numbers } = await this.validateImage(
      values,
      Boolean(file),
    );

    if (file && !isAllowedImageMime(file.mimetype)) {
      errors.file = 'Por favor sube una imagen válida (JPEG o PNG)';
    }

    if (Object.keys(errors).length > 0) {
      await removeUploadedFile(file);
      await this.renderImages(res, values, errors);
      return;
    }

    await this.storeImage(file, category, numbers);
    req.session.flash = {
      type: 'success',
      message: 'Imagen subida correctamente.',
    };
    res.redirect('/admin/images');
  }

  @Post('images/bulk')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: imageStorage(GALLERY_IMAGE_DIR),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createImagesBulk(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<void> {
    try {
      this.csrfService.assertValid(req);
    } catch (error) {
      await this.cleanupFiles(files);
      throw error;
    }

    const values = this.imageValues(req.body);
    const { errors, category, numbers } = await this.validateImage(
      values,
      Boolean(files?.length),
    );

    if (Object.keys(errors).length > 0) {
      await this.cleanupFiles(files);
      await this.renderImages(res, values, errors);
      return;
    }

    let uploaded = 0;
    for (const file of files) {
      if (!isAllowedImageMime(file.mimetype)) {
        await removeUploadedFile(file);
        continue;
      }
      await this.storeImage(file, category, numbers);
      uploaded += 1;
    }

    if (uploaded === 0) {
      req.session.flash = {
        type: 'error',
        message: 'No se subió ninguna imagen válida (JPEG o PNG).',
      };
    } else {
      req.session.flash = {
        type: 'success',
        message: `${uploaded} imagen(es) subida(s) correctamente.`,
      };
    }
    res.redirect('/admin/images');
  }

  @Post('images/:id')
  async updateImage(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const image = await this.adminService.findImage(this.parseId(rawId));
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const values = this.imageValues(req.body);
    const { errors, category, numbers } = await this.validateImage(
      values,
      true,
    );

    if (Object.keys(errors).length > 0) {
      req.session.flash = {
        type: 'error',
        message: Object.values(errors).join(' '),
      };
      res.redirect('/admin/images');
      return;
    }

    await this.adminService.updateImage(image, {
      ...numbers,
      category,
    });
    req.session.flash = {
      type: 'success',
      message: 'Imagen actualizada.',
    };
    res.redirect('/admin/images');
  }

  @Post('images/:id/delete')
  async deleteImage(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const image = await this.adminService.findImage(this.parseId(rawId));
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    await this.adminService.deleteImage(image);
    req.session.flash = {
      type: 'success',
      message: 'Imagen eliminada.',
    };
    res.redirect('/admin/images');
  }

  private imageValues(body: Record<string, unknown>): {
    numLikes: string;
    numViews: string;
    numDownloads: string;
    category: string;
  } {
    return {
      numLikes: formString(body.numLikes),
      numViews: formString(body.numViews),
      numDownloads: formString(body.numDownloads),
      category: formString(body.category),
    };
  }

  private async validateImage(
    values: {
      numLikes: string;
      numViews: string;
      numDownloads: string;
      category: string;
    },
    hasFile: boolean,
  ): Promise<{
    errors: Record<string, string>;
    category: Category;
    numbers: {
      numLikes: number;
      numViews: number;
      numDownloads: number;
    };
  }> {
    const errors: Record<string, string> = {};

    if (!hasFile) {
      errors.file = 'La imagen es obligatoria';
    }

    const numLikes = parseInteger(values.numLikes, 0);
    const numViews = parseInteger(values.numViews, 0);
    const numDownloads = parseInteger(values.numDownloads, 0);

    if (Number.isNaN(numLikes)) {
      errors.numLikes = 'Introduce un número válido';
    }
    if (Number.isNaN(numViews)) {
      errors.numViews = 'Introduce un número válido';
    }
    if (Number.isNaN(numDownloads)) {
      errors.numDownloads = 'Introduce un número válido';
    }

    const categoryId = parseInteger(values.category, 0);
    const category =
      categoryId > 0
        ? await this.adminService.findCategoryById(categoryId)
        : null;
    if (!category) {
      errors.category = 'Selecciona una categoría';
    }

    return {
      errors,
      category,
      numbers: {
        numLikes: Number.isNaN(numLikes) ? 0 : numLikes,
        numViews: Number.isNaN(numViews) ? 0 : numViews,
        numDownloads: Number.isNaN(numDownloads) ? 0 : numDownloads,
      },
    };
  }

  private async storeImage(
    file: Express.Multer.File,
    category: Category,
    numbers: {
      numLikes: number;
      numViews: number;
      numDownloads: number;
    },
  ): Promise<void> {
    await optimizeImage(file.path);
    await copyFile(file.path, join(PORTFOLIO_IMAGE_DIR, file.filename));
    const thumbnail = await createThumbnail(file.filename);

    await this.adminService.createImage({
      file: file.filename,
      thumbnail,
      category,
      ...numbers,
    });
  }

  private async cleanupFiles(files?: Express.Multer.File[]): Promise<void> {
    for (const file of files ?? []) {
      await removeUploadedFile(file);
    }
  }

  private async renderImages(
    res: Response,
    values: Record<string, string> = {},
    errors: Record<string, string> = {},
  ): Promise<void> {
    const [images, categories] = await Promise.all([
      this.adminService.listImages(),
      this.adminService.listCategories(),
    ]);
    res
      .status(200)
      .render('admin/images', { images, categories, values, errors });
  }

  // ------------------------------------------------------------- Comments

  @Get('comments')
  async comments(@Res() res: Response): Promise<void> {
    const comments = await this.adminService.listComments();
    res.render('admin/comments', { comments });
  }

  @Post('comments/:id')
  async toggleComment(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const comment = await this.adminService.findComment(
      this.parseId(rawId),
    );
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    const approved = formBoolean(req.body.approved);
    await this.adminService.setCommentApproved(comment, approved);
    req.session.flash = {
      type: 'success',
      message: approved
        ? 'Comentario aprobado.'
        : 'Comentario ocultado.',
    };
    res.redirect('/admin/comments');
  }

  @Post('comments/:id/delete')
  async deleteComment(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const comment = await this.adminService.findComment(
      this.parseId(rawId),
    );
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    await this.adminService.deleteComment(comment);
    req.session.flash = {
      type: 'success',
      message: 'Comentario eliminado.',
    };
    res.redirect('/admin/comments');
  }

  // ------------------------------------------------------------- Messages

  @Get('messages')
  async messages(@Res() res: Response): Promise<void> {
    const messages = await this.adminService.listMessages();
    res.render('admin/messages', { messages });
  }

  @Post('messages/:id/delete')
  async deleteMessage(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const messages = await this.adminService.listMessages();
    const message = messages.find(
      (item) => item.id === this.parseId(rawId),
    );
    if (!message) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    await this.adminService.deleteMessage(message);
    req.session.flash = {
      type: 'success',
      message: 'Mensaje eliminado.',
    };
    res.redirect('/admin/messages');
  }

  private parseId(value: string): number {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException('Recurso no encontrado');
    }
    return id;
  }
}
