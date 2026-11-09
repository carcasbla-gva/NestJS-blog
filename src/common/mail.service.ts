import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * Envía correos si hay SMTP configurado. En desarrollo, si no hay SMTP,
 * escribe el mensaje en el log para poder probar el flujo completo.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null | undefined;

  constructor(private readonly config: ConfigService) {}

  private getTransporter(): Transporter | null {
    if (this.transporter !== undefined) {
      return this.transporter;
    }

    const host = this.config.get<string>('MAIL_HOST');
    if (!host) {
      this.transporter = null;
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('MAIL_PORT', '587')),
      secure: this.config.get<string>('MAIL_SECURE', 'false') === 'true',
      auth: this.config.get<string>('MAIL_USER')
        ? {
            user: this.config.get<string>('MAIL_USER'),
            pass: this.config.get<string>('MAIL_PASSWORD', ''),
          }
        : undefined,
    });

    return this.transporter;
  }

  async send(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<void> {
    const transporter = this.getTransporter();
    const from = this.config.get<string>(
      'MAIL_FROM',
      'NestJS Blog <no-reply@blog.local>',
    );

    if (!transporter) {
      this.logger.log(
        `[MAIL:desarrollo] Para: ${to} | Asunto: ${subject}\n${text}`,
      );
      return;
    }

    await transporter.sendMail({ from, to, subject, text, html }).catch((error) => {
      this.logger.error(`No se pudo enviar el correo a ${to}`, error);
    });
  }
}
