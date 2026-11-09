import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '../common/guards';
import { CsrfService } from '../common/csrf.service';
import { baseUrl } from '../common/request';
import { formString, isEmail } from '../common/view-helpers';

@Controller('profile')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly csrfService: CsrfService,
  ) {}

  @Get()
  profile(@Req() req: Request, @Res() res: Response): void {
    res.render('profile/index', {
      values: {
        name: req.user.name,
        email: req.user.email,
        bio: req.user.bio ?? '',
      },
      errors: {},
      passwordErrors: {},
    });
  }

  @Post()
  async updateProfile(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const values = {
      name: formString(req.body.name),
      email: formString(req.body.email),
      bio: formString(req.body.bio),
    };

    const errors: Record<string, string> = {};

    if (!values.name) {
      errors.name = 'El nombre es obligatorio';
    }
    if (!values.email) {
      errors.email = 'El email es obligatorio';
    } else if (!isEmail(values.email)) {
      errors.email = 'Introduce un email válido';
    } else {
      const existing = await this.usersService.findByEmail(values.email);
      if (existing && existing.id !== req.user.id) {
        errors.email = 'Ya existe una cuenta con ese email';
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(200).render('profile/index', {
        values,
        errors,
        passwordErrors: {},
      });
      return;
    }

    const emailChanged = values.email !== req.user.email;
    const updated = await this.usersService.updateProfile(req.user.id, {
      name: values.name,
      email: values.email,
      bio: values.bio || null,
    });

    if (updated && emailChanged) {
      updated.emailVerified = false;
      updated.verificationToken = null;
      await this.usersService.save(updated);
      await this.authService.sendVerificationEmail(updated, baseUrl(req));
    }

    req.session.flash = {
      type: 'success',
      message: emailChanged
        ? 'Perfil actualizado. Revisa tu nuevo correo para verificarlo.'
        : 'Perfil actualizado correctamente.',
    };
    res.redirect('/profile');
  }

  @Post('password')
  async changePassword(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    const currentPassword =
      typeof req.body.currentPassword === 'string'
        ? req.body.currentPassword
        : '';
    const newPassword =
      typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    const confirmation =
      typeof req.body.confirmation === 'string'
        ? req.body.confirmation
        : '';

    const passwordErrors: Record<string, string> = {};

    if (!currentPassword) {
      passwordErrors.currentPassword = 'Introduce tu contraseña actual';
    } else if (
      !(await this.authService.verifyPassword(
        currentPassword,
        req.user.password,
      ))
    ) {
      passwordErrors.currentPassword = 'La contraseña actual no es correcta';
    }

    if (!newPassword) {
      passwordErrors.newPassword = 'Introduce una nueva contraseña';
    } else if (newPassword.length < 6) {
      passwordErrors.newPassword =
        'La contraseña debe tener al menos 6 caracteres';
    }

    if (newPassword !== confirmation) {
      passwordErrors.confirmation = 'Las contraseñas no coinciden';
    }

    if (Object.keys(passwordErrors).length > 0) {
      res.status(200).render('profile/index', {
        values: {
          name: req.user.name,
          email: req.user.email,
          bio: req.user.bio ?? '',
        },
        errors: {},
        passwordErrors,
      });
      return;
    }

    const hashed = await this.authService.hashPassword(newPassword);
    await this.usersService.updatePassword(req.user.id, hashed);
    req.session.flash = {
      type: 'success',
      message: 'Contraseña actualizada correctamente.',
    };
    res.redirect('/profile');
  }

  @Post('resend-verification')
  async resendVerification(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.csrfService.assertValid(req);

    if (req.user.emailVerified) {
      req.session.flash = {
        type: 'info',
        message: 'Tu correo ya está verificado.',
      };
    } else {
      await this.authService.sendVerificationEmail(req.user, baseUrl(req));
      req.session.flash = {
        type: 'success',
        message:
          'Te hemos reenviado el correo de verificación (en desarrollo aparece en la consola).',
      };
    }

    res.redirect('/profile');
  }
}
