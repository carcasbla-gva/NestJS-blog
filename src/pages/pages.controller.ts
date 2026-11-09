import {
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BlogService } from '../blog/blog.service';
import { ContactService } from '../contact/contact.service';
import { CsrfService } from '../common/csrf.service';
import { formString, isEmail } from '../common/view-helpers';

@Controller()
export class PagesController {
  constructor(
    private readonly blogService: BlogService,
    private readonly contactService: ContactService,
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
}
