import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Ha ocurrido un error interno. Inténtalo más tarde.';
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const raw = (payload as Record<string, unknown>).message;
        message = Array.isArray(raw) ? raw.join(', ') : String(raw ?? message);
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (response.headersSent) {
      return;
    }

    const wantsHtml =
      request.accepts('html') && !request.path.startsWith('/api');

    if (!wantsHtml) {
      response.status(status).json({ statusCode: status, message });
      return;
    }

    const view = status === 404 ? 'errors/404' : 'errors/error';
    response.status(status).render(view, {
      status,
      message:
        status === 404
          ? 'La página que buscas no existe o ha sido movida.'
          : message,
    });
  }
}
