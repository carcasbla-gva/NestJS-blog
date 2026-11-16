import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { CsrfService } from '../common/csrf.service';
import { baseUrl } from '../common/request';
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
    res.render('auth/login', { 
      lastUsername,
    });
  }

  @Post('login')
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    this.csrfService.assertValid(req);

    const email = formString(req.body._username ?? req.body.email);
    const password =
      typeof req.body._password === 'string'
        ? req.body._password
        : formString(req.body.password);

    if (!email || !password) {
      req.session.flash = {
        type: 'error',
        message: 'Por favor, introduce tu email y contraseña.',
      };
      res.redirect('/login');
      return;
    }

    const user = await this.authService.validateCredentials(email, password);

    if (!user) {
      req.session.lastUsername = email;
      req.session.flash = {
        type: 'error',
        message: 'Credenciales incorrectas. Verifica tu email y contraseña.',
      };
      res.redirect('/login');
      return;
    }

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) =>
        error ? reject(error) : resolve(),
      );
    });

    req.session.userId = user.id;
    req.session.flash = {
      type: 'success',
      message: `¡Bienvenido/a ${user.name}! Has iniciado sesión como ${user.email}.`,
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
      errors.email = 'Introduce tu email';
    } else if (!isEmail(values.email)) {
      errors.email = `${values.email} no es un email válido`;
    } else if (await this.usersService.findByEmail(values.email)) {
      errors.email = 'Ya existe una cuenta con este email';
    }

    if (!values.name) {
      errors.name = 'Introduce tu nombre';
    }

    if (!password) {
      errors.plainPassword = 'Introduce una contraseña';
    } else if (password.length < 6) {
      errors.plainPassword =
        'La contraseña debe tener al menos 6 caracteres';
    }

    if (!agreeTerms) {
      errors.agreeTerms = 'Debes aceptar nuestros términos.';
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
      emailVerified: true,
    });

    req.session.userId = user.id;
    req.session.flash = {
      type: 'success',
      message: '¡Tu cuenta se ha creado correctamente! Ya puedes iniciar sesión.',
    };
    res.redirect('/login');
  }

  @Get('forgot-password')
  forgotPasswordForm(@Res() res: Response): void {
    res.render('auth/forgot_password', { values: {}, errors: {} });
  }

  @Post('forgot-password')
  async forgotPassword(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const values = { email: formString(req.body.email) };
    const errors: Record<string, string> = {};

    if (!values.email) {
      errors.email = 'Introduce tu email';
    } else if (!isEmail(values.email)) {
      errors.email = 'Introduce un email válido';
    }

    if (Object.keys(errors).length > 0) {
      res.status(200).render('auth/forgot_password', { values, errors });
      return;
    }

    await this.authService.requestPasswordReset(values.email, baseUrl(req));
    req.session.flash = {
      type: 'success',
      message:
        'Si el email existe, te hemos enviado un enlace para restablecer la contraseña.',
    };
    res.redirect('/login');
  }

  @Get('reset-password/:token')
  resetPasswordForm(
    @Param('token') token: string,
    @Res() res: Response,
  ): void {
    res.render('auth/reset_password', {
      token,
      values: {},
      errors: {},
    });
  }

  @Post('reset-password/:token')
  async resetPassword(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const password =
      typeof req.body.password === 'string' ? req.body.password : '';
    const confirmation =
      typeof req.body.confirmation === 'string'
        ? req.body.confirmation
        : '';

    const errors: Record<string, string> = {};
    if (!password) {
      errors.password = 'Introduce una contraseña';
    } else if (password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    if (password !== confirmation) {
      errors.confirmation = 'Las contraseñas no coinciden';
    }

    if (Object.keys(errors).length > 0) {
      res.status(200).render('auth/reset_password', {
        token,
        values: {},
        errors,
      });
      return;
    }

    const user = await this.authService.resetPassword(token, password);
    if (!user) {
      req.session.flash = {
        type: 'error',
        message:
          'El enlace no es válido o ha caducado. Solicita uno nuevo.',
      };
      res.redirect('/forgot-password');
      return;
    }

    req.session.flash = {
      type: 'success',
      message: 'Contraseña actualizada. Ya puedes iniciar sesión.',
    };
    res.redirect('/login');
  }

  @Get('verify-email/:token')
  async verifyEmail(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = await this.authService.verifyEmail(token);
    req.session.flash = user
      ? {
          type: 'success',
          message: 'Tu correo se ha verificado correctamente.',
        }
      : {
          type: 'error',
          message: 'El enlace de verificación no es válido o ya se usó.',
        };
    res.redirect('/profile');
  }
}
