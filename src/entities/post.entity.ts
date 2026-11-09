import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Comment } from './comment.entity';
import { User } from './user.entity';

@Entity('post')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ length: 255 })
  image: string;

  @Column({ length: 255 })
  slug: string;

  @Column({ name: 'published_at', type: 'datetime' })
  publishedAt: Date;

  @Column({ name: 'num_likes', type: 'int', default: 0 })
  numLikes: number;

  @Column({ name: 'num_comments', type: 'int', default: 0 })
  numComments: number;

  @ManyToOne(() => User, (user) => user.posts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'post_user_id' })
  postUser: User;

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  like(): this {
    this.numLikes = (this.numLikes ?? 0) + 1;
    return this;
  }
}
