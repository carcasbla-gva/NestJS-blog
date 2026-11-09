import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/** Token de un solo uso para restablecer la contraseña. */
@Entity('password_reset_token')
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  token: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  used: boolean;
}
