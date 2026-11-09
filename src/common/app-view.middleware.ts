import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import { CsrfService } from './csrf.service';

@Injectable()
export class AppViewMiddleware implements NestMiddleware {
  constructor(
    private readonly usersService: UsersService,
    private readonly csrfService: CsrfService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.locals.currentPath = req.path;
      res.locals.currentUser = null;

      if (req.session) {
        res.locals.flash = req.session.flash ?? null;
        delete req.session.flash;

        res.locals.csrfToken = this.csrfService.token(req);

        if (req.session.userId) {
          const user = await this.usersService.findById(req.session.userId);
          if (user) {
            req.user = user;
            res.locals.currentUser = user;
          } else {
            delete req.session.userId;
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
