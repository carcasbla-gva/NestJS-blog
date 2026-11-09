import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { join } from 'path';
import { BlogService } from '../blog/blog.service';
import { ContactService } from '../contact/contact.service';
import { AdminService } from '../admin/admin.service';
import { CsrfService } from '../common/csrf.service';
import { GALLERY_IMAGE_DIR } from '../common/paths';
import { formString, isEmail } from '../common/view-helpers';

@Controller()
export class PagesController {
  constructor(
    private readonly blogService: BlogService,
    private readonly contactService: ContactService,
    private readonly adminService: AdminService,
    private readonly csrfService: CsrfService,
  ) {}

  @Get()
  async index(@Res() res: Response): Promise<void> {
    const categories = await this.blogService.categoriesWithImages();
    res.render('pages/index', { categories });
  }

  @Get('about')
  about(@Res() res: Response): void {
    res.render('pages/about');
  }

  @Get('contact')
  contactForm(@Res() res: Response): void {
    res.render('pages/contact', {
      values: {},
      errors: {},
    });
  }

  @Post('contact')
  async contact(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.csrfService.assertValid(req);

    const values = {
      firstName: formString(req.body.firstName),
      lastName: formString(req.body.lastName),
      email: formString(req.body.email),
      subject: formString(req.body.subject),
      message: formString(req.body.message),
    };

    const errors: Record<string, string> = {};
    if (!values.firstName) {
      errors.firstName = 'Field `First Name` is mandatory';
    }
    if (!values.email) {
      errors.email = 'Field `email` is mandatory';
    } else if (!isEmail(values.email)) {
      errors.email = `${values.email} is not a valid email`;
    }
    // Honeypot: los bots rellenan este campo oculto.
    if (formString(req.body.website)) {
      errors.email = 'No se pudo validar el formulario.';
    }

    if (Object.keys(errors).length > 0) {
      res.status(200).render('pages/contact', { values, errors });
      return;
    }

    await this.contactService.create(values);
    req.session.flash = {
      type: 'success',
      message: '¡Gracias por ponerte en contacto con nosotros!',
    };
    res.redirect('/thankyou');
  }

  @Get('thankyou')
  thankyou(@Res() res: Response): void {
    res.render('pages/thankyou');
  }

  @Post('images/:id/view')
  async imageView(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const image = await this.adminService.findImage(id);
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const viewed = req.session.viewedImages ?? [];
    if (!viewed.includes(id)) {
      req.session.viewedImages = [...viewed, id];
      await this.adminService.incrementImageViews(id);
    }

    res.json({ success: true, views: image.numViews + (viewed.includes(id) ? 0 : 1) });
  }

  @Post('images/:id/like')
  async imageLike(
    @Param('id') rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const image = await this.adminService.findImage(id);
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const liked = req.session.likedImages ?? [];
    if (liked.includes(id)) {
      req.session.likedImages = liked.filter((value) => value !== id);
      await this.adminService.decrementImageLikes(id);
      res.json({ success: true, liked: false, likes: Math.max(0, image.numLikes - 1) });
      return;
    }

    req.session.likedImages = [...liked, id];
    await this.adminService.incrementImageLikes(id);
    res.json({ success: true, liked: true, likes: image.numLikes + 1 });
  }

  @Get('images/:id/download')
  async imageDownload(
    @Param('id') rawId: string,
    @Res() res: Response,
  ): Promise<void> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException('Imagen no encontrada');
    }

    const image = await this.adminService.findImage(id);
    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    await this.adminService.incrementImageDownloads(id);
    res.download(join(GALLERY_IMAGE_DIR, image.file), image.file);
  }
}
