import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Post } from './post.entity';

/** Registra un "me gusta" por sesión para no poder votar infinitas veces. */
@Entity('post_like')
@Unique(['post', 'sessionId'])
export class PostLike {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Post, (post) => post.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @Column({ name: 'session_id', length: 128 })
  sessionId: string;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
