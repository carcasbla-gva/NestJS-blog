import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from './category.entity';

@Entity('image')
export class Image {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  file: string;

  @Column({ name: 'num_likes', type: 'int', default: 0 })
  numLikes: number;

  @Column({ name: 'num_views', type: 'int', default: 0 })
  numViews: number;

  @Column({ name: 'num_downloads', type: 'int', default: 0 })
  numDownloads: number;

  @ManyToOne(() => Category, (category) => category.images, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
