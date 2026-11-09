import {
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CsrfService } from '../common/csrf.service';
import { formString, isEmail } from '../common/view-helpers';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly csrfService: CsrfService,
  ) {}

  @Get('login')
  loginForm(@Req() req: Request, @Res() res: Response): void {
    const lastUsername = req.session.lastUsername ?? '';
    delete req.session.lastUsername;
    res.render('auth/login', { lastUsername });
  }

  @Post('login')
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.csrfService.assertValid(req);

    const email = formString(req.body._username ?? req.body.email);
    const password =
      typeof req.body._password === 'string'
        ? req.body._password
        : formString(req.body.password);

    const user = await this.authService.validateCredentials(email, password);

    if (!user) {
      req.session.lastUsername = email;
      req.session.flash = {
        type: 'error',
        message: 'Invalid credentials.',
      };
      res.redirect('/login');
      return;
    }

    req.session.userId = user.id;
    req.session.flash = {
      type: 'success',
      message: `Bienvenido de nuevo, ${user.name}.`,
    };
    res.redirect('/');
  }

  @Get('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/');
    });
  }

  @Get('register')
  registerForm(@Res() res: Response): void {
    res.render('auth/register', {
      values: {},
      errors: {},
    });
  }

  @Post('register')
  async register(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.csrfService.assertValid(req);

    const values = {
      email: formString(req.body.email),
      name: formString(req.body.name),
    };
    const password =
      typeof req.body.plainPassword === 'string'
        ? req.body.plainPassword
        : '';
    const agreeTerms = Boolean(req.body.agreeTerms);

    const errors: Record<string, string> = {};

    if (!values.email) {
      errors.email = 'Please enter your email';
    } else if (!isEmail(values.email)) {
      errors.email = `${values.email} is not a valid email`;
    } else if (await this.usersService.findByEmail(values.email)) {
      errors.email = 'There is already an account with this email';
    }

    if (!values.name) {
      errors.name = 'Please enter your name';
    }

    if (!password) {
      errors.plainPassword = 'Please enter a password';
    } else if (password.length < 6) {
      errors.plainPassword =
        'Your password should be at least 6 characters';
    }

    if (!agreeTerms) {
      errors.agreeTerms = 'You should agree to our terms.';
    }

    if (Object.keys(errors).length > 0) {
      res.status(200).render('auth/register', { values, errors });
      return;
    }

    const hashedPassword = await this.authService.hashPassword(password);
    const user = await this.usersService.create({
      email: values.email,
      name: values.name,
      password: hashedPassword,
      roles: [],
    });

    req.session.userId = user.id;
    req.session.flash = {
      type: 'success',
      message: 'Tu cuenta se ha creado correctamente.',
    };
    res.redirect('/');
  }
}
