import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Image } from '../entities/image.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Image)
    private readonly images: Repository<Image>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  listImages(): Promise<Image[]> {
    return this.images.find({
      relations: { category: true },
      order: { id: 'ASC' },
    });
  }

  listCategories(): Promise<Category[]> {
    return this.categories.find({ order: { id: 'ASC' } });
  }

  findCategoryById(id: number): Promise<Category | null> {
    return this.categories.findOne({ where: { id } });
  }

  createCategory(name: string): Promise<Category> {
    return this.categories.save(this.categories.create({ name }));
  }

  createImage(data: {
    file: string;
    numLikes: number;
    numViews: number;
    numDownloads: number;
    category: Category;
  }): Promise<Image> {
    const image = this.images.create(data);
    return this.images.save(image);
  }
}
