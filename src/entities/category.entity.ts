import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Image } from './image.entity';
import { Post } from './post.entity';

@Entity('category')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, nullable: true, unique: true })
  slug: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => Image, (image) => image.category)
  images: Image[];

  @OneToMany(() => Post, (post) => post.category)
  posts: Post[];

  /** Campo calculado, no persistido, usado en las vistas. */
  postCount?: number;
}
