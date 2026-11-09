import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Post } from './post.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 180, unique: true })
  email: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'json' })
  roles: string[];

  @Column({ length: 255 })
  password: string;

  @OneToMany(() => Post, (post) => post.postUser)
  posts: Post[];

  /** Symfony añade siempre ROLE_USER a todos los usuarios. */
  getRoles(): string[] {
    return Array.from(new Set([...(this.roles ?? []), 'ROLE_USER']));
  }

  get isAdmin(): boolean {
    return this.getRoles().includes('ROLE_ADMIN');
  }
}
