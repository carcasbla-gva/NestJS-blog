import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Post } from './post.entity';

@Entity('comment')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  email: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'boolean', default: true })
  approved: boolean;

  @Column({ name: 'author_ip', length: 45, nullable: true })
  authorIp: string | null;

  @Column({ name: 'published_at', type: 'datetime' })
  publishedAt: Date;

  @ManyToOne(() => Post, (post) => post.comments, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_id' })
  post: Post;
}
