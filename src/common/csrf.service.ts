import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Request } from 'express';

@Injectable()
export class CsrfService {
  token(req: Request): string {
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
  }

  /**
   * Symfony usa `_token` en los formularios y `_csrf_token` en el login.
   * Aceptamos ambos nombres, además de `_csrf`.
   */
  assertValid(req: Request): void {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sent = body._csrf ?? body._token ?? body._csrf_token;
    if (
      typeof sent !== 'string' ||
      !req.session?.csrfToken ||
      sent !== req.session.csrfToken
    ) {
      throw new ForbiddenException('Token CSRF inválido o expirado.');
    }
  }
}
