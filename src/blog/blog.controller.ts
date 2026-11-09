import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { BlogService, POSTS_PER_PAGE } from './blog.service';
import { AuthGuard } from '../common/guards';
import { CsrfService } from '../common/csrf.service';
import { POSTS_IMAGE_DIR } from '../common/paths';
import { optimizeImage } from '../common/images';
import {
  imageStorage,
  isAllowedImageMime,
  removeUploadedFile,
} from '../common/upload';
import {
  buildPager,
  formBoolean,
  formString,
  isEmail,
  parseInteger,
  parseTags,
} from '../common/view-helpers';
import { Post as PostEntity } from '../entities/post.entity';

@Controller()
export class BlogController {
  constructor(
    private readonly blogService: BlogService,
    private readonly csrfService: CsrfService,
  ) {}

  @Get('blog')
  blogRoot(@Res() res: Response): Promise<void> {
    return this.renderBlogPage(res, 1);
  }

  @Get('blog/new')
  @UseGuards(AuthGuard)
  async newPostForm(@Res() res: Response): Promise<void> {
    const categories = await this.blogService.listCategories();
    res.render('blog/new_post', {
      values: {},
      errors: {},
      categories,
    });
  }

  @Post('blog/new')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: imageStorage(POSTS_IMAGE_DIR),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async createPost(
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

    const values = {
      title: formString(req.body.title),
      content: formString(req.body.content),
      category: formString(req.body.category),
      tags: formString(req.body.tags),
      published: formBoolean(req.body.published) ? '1' : '',
    };

    const { errors, category } = await this.validatePostInput(
      values,
      Boolean(file),
    );
    if (file && !isAllowedImageMime(file.mimetype)) {
      errors.image = 'Por favor sube una imagen válida (JPEG o PNG)';
    }

    if (Object.keys(errors).length > 0) {
      await removeUploadedFile(file);
      const categories = await this.blogService.listCategories();
      res.status(200).render('blog/new_post', { values, errors, categories });
      return;
    }

    await optimizeImage(file.path);
    const published = req.user.isAdmin ? formBoolean(req.body.published) : true;

    const post = await this.blogService.createPost(
      {
        title: values.title,
        content: values.content,
        image: file.filename,
        category,
        tags: parseTags(values.tags),
        published,
      },
      req.user,
    );

    req.session.flash = {
      type: 'success',
      message: post.published
        ? 'El post se ha publicado correctamente.'
        : 'El post se ha guardado como borrador.',
    };
    res.redirect(
      post.published
        ? `/single_post/${encodeURIComponent(post.slug)}`
        : '/blog',
    );
  }

  @Get('blog/buscar')
  async search(
    @Query('searchTerm') rawSearchTerm: string,
    @Query('page') rawPage: string,
    @Res() res: Response,
  ): Promise<void> {
    const searchTerm = formString(rawSearchTerm);
    const page = Math.max(1, Number(rawPage) || 1);
    const [{ posts, total, totalPages }, recents, categories] =
      await Promise.all([
        this.blogService.listPosts(page, POSTS_PER_PAGE, { search: searchTerm }),
        this.blogService.findRecents(),
        this.blogService.categoriesWithPostCounts(),
      ]);

    res.render('blog/index', {
      posts,
      recents,
      categories,
      searchTerm,
      total,
      totalPages,
      page,
      pager: buildPager(
        '/blog/buscar',
        page,
        totalPages,
        { searchTerm },
        'query',
      ),
    });
  }

  @Get('blog/categoria/:slug')
  async categoryRoot(
    @Param('slug') slug: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.renderBlogPage(res, 1, slug);
  }

  @Get('blog/categoria/:slug/:page')
  async categoryPage(
    @Param('slug') slug: string,
    @Param('page') rawPage: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!/^\d+$/.test(rawPage)) {
      throw new NotFoundException();
    }
    await this.renderBlogPage(res, Math.max(1, Number(rawPage)), slug);
  }

  @Get('blog/:page')
  async blogPage(
    @Param('page') rawPage: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!/^\d+$/.test(rawPage)) {
      throw new NotFoundException();
    }
    await this.renderBlogPage(res, Math.max(1, Number(rawPage)));
  }

  @Get('single_post/:slug')
  async singlePost(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const post = await this.blogService.findBySlug(
      slug,
      Boolean(req.user?.isAdmin),
    );
    if (!post) {
      throw new NotFoundException('Post no encontrado');
    }

    const viewed = req.session.viewedPosts ?? [];
    if (!viewed.includes(post.id)) {
      req.session.viewedPosts = [...viewed, post.id];
      await this.blogService.incrementViews(post.id);
      post.numViews = (post.numViews ?? 0) + 1;
    }

    await this.renderSinglePost(req, res, post);
  }

  @Post('single_post/:slug/comment')
  async addComment(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const post = await this.blogService.findBySlug(slug);
    if (!post) {
      throw new NotFoundException('Post no encontrado');
    }

    const values = {
      name: formString(req.body.name),
      email: formString(req.body.email),
      text: formString(req.body.text),
    };

    const errors: Record<string, string> = {};
    if (!values.name) {
      errors.name = 'El nombre es obligatorio';
    }
    if (!values.email) {
      errors.email = 'El email es obligatorio';
    } else if (!isEmail(values.email)) {
      errors.email = 'Introduce un email válido';
    }
    if (!values.text) {
      errors.text = 'El comentario es obligatorio';
    }
    // Honeypot antispam.
    if (formString(req.body.website)) {
      errors.text = 'No se pudo validar el comentario.';
    }

    if (Object.keys(errors).length > 0) {
      await this.renderSinglePost(req, res, post, values, errors);
      return;
    }

    await this.blogService.addComment(post, {
      ...values,
      authorIp: req.ip ?? null,
    });
    req.session.flash = {
      type: 'success',
      message: 'Tu comentario se ha publicado.',
    };
    res.redirect(`/single_post/${encodeURIComponent(slug)}`);
  }

  @Get('single_post/:slug/like')
  async likeFromBrowser(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.blogService.toggleLike(slug, req.sessionID);
    if (!result) {
      throw new NotFoundException('Post no encontrado');
    }
    req.session.flash = {
      type: 'success',
      message: result.liked
        ? 'Te ha gustado este post.'
        : 'Has retirado tu me gusta.',
    };
    res.redirect(`/single_post/${encodeURIComponent(slug)}`);
  }

  @Post('single_post/:slug/like')
  async likeFromAjax(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.blogService.toggleLike(slug, req.sessionID);
    if (!result) {
      throw new NotFoundException('Post no encontrado');
    }
    res.json({
      success: true,
      liked: result.liked,
      likes: result.post.numLikes,
    });
  }

  private async validatePostInput(
    values: {
      title: string;
      content: string;
      category: string;
      tags: string;
    },
    hasFile: boolean,
  ): Promise<{
    errors: Record<string, string>;
    category: Awaited<ReturnType<BlogService['findCategoryById']>>;
  }> {
    const errors: Record<string, string> = {};

    if (!values.title) {
      errors.title = 'El título es obligatorio';
    }
    if (!values.content) {
      errors.content = 'El contenido es obligatorio';
    }

    const categoryId = parseInteger(values.category, 0);
    let category = null;
    if (Number.isNaN(categoryId)) {
      errors.category = 'Selecciona una categoría válida';
    } else if (categoryId > 0) {
      category = await this.blogService.findCategoryById(categoryId);
      if (!category) {
        errors.category = 'La categoría seleccionada no existe';
      }
    }

    if (!hasFile) {
      errors.image = 'La imagen es obligatoria';
    }

    return { errors, category };
  }

  private async renderBlogPage(
    res: Response,
    page: number,
    categorySlug?: string,
  ): Promise<void> {
    const [{ posts, total, totalPages, category }, recents, categories] =
      await Promise.all([
        this.blogService.listPosts(page, POSTS_PER_PAGE, { categorySlug }),
        this.blogService.findRecents(),
        this.blogService.categoriesWithPostCounts(),
      ]);

    if (categorySlug && !category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    if (page > totalPages) {
      const base = categorySlug
        ? `/blog/categoria/${encodeURIComponent(categorySlug)}`
        : '/blog';
      res.redirect(totalPages > 1 ? `${base}/${totalPages}` : base);
      return;
    }

    const basePath = categorySlug
      ? `/blog/categoria/${encodeURIComponent(categorySlug)}`
      : '/blog';

    res.render('blog/index', {
      posts,
      recents,
      categories,
      category,
      page,
      total,
      totalPages,
      searchTerm: null,
      pager: buildPager(basePath, page, totalPages),
    });
  }

  private async renderSinglePost(
    req: Request,
    res: Response,
    post: PostEntity,
    commentValues: Record<string, string> = {},
    commentErrors: Record<string, string> = {},
  ): Promise<void> {
    const [recents, liked] = await Promise.all([
      this.blogService.findRecents(),
      this.blogService.hasLiked(post.id, req.sessionID),
    ]);

    const comments = (post.comments ?? []).filter(
      (comment) => comment.approved || req.user?.isAdmin,
    );

    res.status(200).render('blog/single_post', {
      post,
      comments,
      recents,
      liked,
      commentValues,
      commentErrors,
    });
  }
}
