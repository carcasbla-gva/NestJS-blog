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
import {
  imageStorage,
  isAllowedImageMime,
  removeUploadedFile,
} from '../common/upload';
import {
  buildPager,
  formString,
  isEmail,
} from '../common/view-helpers';

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
  newPostForm(@Res() res: Response): void {
    res.render('blog/new_post', {
      values: {},
      errors: {},
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
    };

    const errors: Record<string, string> = {};
    if (!values.title) {
      errors.title = 'El título es obligatorio';
    }
    if (!values.content) {
      errors.content = 'El contenido es obligatorio';
    }
    if (!file) {
      errors.image = 'La imagen es obligatoria';
    } else if (!isAllowedImageMime(file.mimetype)) {
      errors.image = 'Por favor sube una imagen válida (JPEG o PNG)';
    }

    if (Object.keys(errors).length > 0) {
      await removeUploadedFile(file);
      res.status(200).render('blog/new_post', { values, errors });
      return;
    }

    const post = await this.blogService.createPost(
      { ...values, image: file.filename },
      req.user,
    );

    req.session.flash = {
      type: 'success',
      message: 'El post se ha publicado correctamente.',
    };
    res.redirect(`/single_post/${encodeURIComponent(post.slug)}`);
  }

  @Get('blog/buscar')
  async search(
    @Query('searchTerm') rawSearchTerm: string,
    @Res() res: Response,
  ): Promise<void> {
    const searchTerm = formString(rawSearchTerm);
    const [posts, recents] = await Promise.all([
      this.blogService.findByText(searchTerm),
      this.blogService.findRecents(),
    ]);

    res.render('blog/index', {
      posts,
      recents,
      searchTerm,
      pager: null,
    });
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
    @Res() res: Response,
  ): Promise<void> {
    await this.renderSinglePost(res, slug);
  }

  @Post('single_post/:slug/comment')
  async addComment(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

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

    const post = await this.blogService.findBySlug(slug);

    if (Object.keys(errors).length > 0) {
      await this.renderSinglePost(res, slug, post, values, errors);
      return;
    }

    if (!post) {
      await this.renderSinglePost(res, slug);
      return;
    }

    await this.blogService.addComment(post, values);
    req.session.flash = {
      type: 'success',
      message: 'Tu comentario se ha publicado.',
    };
    res.redirect(`/single_post/${encodeURIComponent(slug)}`);
  }

  @Get('single_post/:slug/like')
  likeFromBrowser(
    @Param('slug') slug: string,
    @Res() res: Response,
  ): Promise<void> {
    return this.like(slug, res);
  }

  @Post('single_post/:slug/like')
  likeFromAjax(
    @Param('slug') slug: string,
    @Res() res: Response,
  ): Promise<void> {
    return this.like(slug, res);
  }

  private async like(slug: string, res: Response): Promise<void> {
    const post = await this.blogService.like(slug);
    if (!post) {
      throw new NotFoundException('Post no encontrado');
    }
    res.json({ success: true, likes: post.numLikes });
  }

  private async renderBlogPage(res: Response, page: number): Promise<void> {
    const [{ posts, total, totalPages }, recents] = await Promise.all([
      this.blogService.listPosts(page, POSTS_PER_PAGE),
      this.blogService.findRecents(),
    ]);

    if (page > totalPages) {
      res.redirect(`/blog/${totalPages}`);
      return;
    }

    res.render('blog/index', {
      posts,
      recents,
      page,
      total,
      totalPages,
      searchTerm: null,
      pager: buildPager('/blog', page, totalPages),
    });
  }

  private async renderSinglePost(
    res: Response,
    slug: string,
    post?: Awaited<ReturnType<BlogService['findBySlug']>>,
    commentValues: Record<string, string> = {},
    commentErrors: Record<string, string> = {},
  ): Promise<void> {
    const [loadedPost, recents] = await Promise.all([
      post === undefined ? this.blogService.findBySlug(slug) : post,
      this.blogService.findRecents(),
    ]);

    res.status(200).render('blog/single_post', {
      post: loadedPost,
      recents,
      commentValues,
      commentErrors,
    });
  }
}
