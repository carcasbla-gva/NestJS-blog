import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Exige que haya una sesión iniciada; si no, redirige a /login. */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (req.user) {
      return true;
    }

    res.redirect('/login');
    return false;
  }
}

/** Equivale a `access_control: { path: ^/admin, roles: ROLE_ADMIN }`. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (!req.user) {
      res.redirect('/login');
      return false;
    }

    if (!req.user.isAdmin) {
      throw new ForbiddenException('No tienes permisos de administrador.');
    }

    return true;
  }
}
