import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { User } from '../entities/user.entity';
import { MailService } from '../common/mail.service';
import { UsersService } from '../users/users.service';

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hora

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
  ) {}

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const matches = await bcrypt.compare(password, user.password);
    return matches ? user : null;
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Crea un token de recuperación y envía el enlace por correo.
   * No revela si el email existe o no (evita enumeración de usuarios).
   */
  async requestPasswordReset(email: string, baseUrl: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    await this.resetTokens
      .createQueryBuilder()
      .delete()
      .where('user_id = :id', { id: user.id })
      .execute();

    const token = randomBytes(32).toString('hex');
    await this.resetTokens.save(
      this.resetTokens.create({
        token,
        user,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        used: false,
      }),
    );

    const link = `${baseUrl}/reset-password/${token}`;
    await this.mailService.send(
      user.email,
      'Restablece tu contraseña',
      `Hola ${user.name},\n\nPuedes restablecer tu contraseña en el siguiente enlace (válido 1 hora):\n${link}\n\nSi no lo has solicitado, ignora este correo.`,
      `<p>Hola <strong>${user.name}</strong>,</p><p>Puedes restablecer tu contraseña en el siguiente enlace (válido 1 hora):</p><p><a href="${link}">${link}</a></p><p>Si no lo has solicitado, ignora este correo.</p>`,
    );
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<User | null> {
    const record = await this.resetTokens.findOne({
      where: { token },
      relations: { user: true },
    });

    if (
      !record ||
      record.used ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      return null;
    }

    record.user.password = await this.hashPassword(password);
    record.user.emailVerified = true;
    await this.usersService.save(record.user);

    record.used = true;
    await this.resetTokens.save(record);
    return record.user;
  }

  /** Genera (o reutiliza) el token de verificación y envía el correo. */
  async sendVerificationEmail(user: User, baseUrl: string): Promise<void> {
    const token =
      user.verificationToken ?? randomBytes(32).toString('hex');

    if (!user.verificationToken) {
      user.verificationToken = token;
      await this.usersService.save(user);
    }

    const link = `${baseUrl}/verify-email/${token}`;
    await this.mailService.send(
      user.email,
      'Confirma tu correo',
      `Hola ${user.name},\n\nConfirma tu correo con este enlace:\n${link}`,
      `<p>Hola <strong>${user.name}</strong>,</p><p>Confirma tu correo con este enlace:</p><p><a href="${link}">${link}</a></p>`,
    );
  }

  async verifyEmail(token: string): Promise<User | null> {
    const user = await this.usersService.findByVerificationToken(token);
    if (!user) {
      return null;
    }

    await this.usersService.markEmailVerified(user.id);
    this.logger.log(`Email verificado para ${user.email}`);
    return user;
  }
}
