import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Comment } from './comment.entity';
import { PostLike } from './post-like.entity';
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

  @Column({ name: 'num_views', type: 'int', default: 0 })
  numViews: number;

  @Column({ type: 'boolean', default: true })
  published: boolean;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[] | null;

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => User, (user) => user.posts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'post_user_id' })
  postUser: User;

  @ManyToOne(() => Category, (category) => category.posts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  @OneToMany(() => PostLike, (like) => like.post)
  likes: PostLike[];

  like(): this {
    this.numLikes = (this.numLikes ?? 0) + 1;
    return this;
  }
}
