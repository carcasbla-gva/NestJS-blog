import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Comment } from '../entities/comment.entity';
import { Contact } from '../entities/contact.entity';
import { Image } from '../entities/image.entity';
import { Post } from '../entities/post.entity';
import { User } from '../entities/user.entity';
import {
  GALLERY_IMAGE_DIR,
  PORTFOLIO_IMAGE_DIR,
} from '../common/paths';
import { BlogService } from '../blog/blog.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Post)
    private readonly posts: Repository<Post>,
    @InjectRepository(Image)
    private readonly images: Repository<Image>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(Contact)
    private readonly contacts: Repository<Contact>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly blogService: BlogService,
  ) {}

  async stats(): Promise<{
    posts: number;
    drafts: number;
    comments: number;
    pendingComments: number;
    images: number;
    categories: number;
    messages: number;
    users: number;
  }> {
    const [
      posts,
      drafts,
      comments,
      pendingComments,
      images,
      categories,
      messages,
      users,
    ] = await Promise.all([
      this.posts.count(),
      this.posts.count({ where: { published: false } }),
      this.comments.count(),
      this.comments.count({ where: { approved: false } }),
      this.images.count(),
      this.categories.count(),
      this.contacts.count(),
      this.users.count(),
    ]);

    return {
      posts,
      drafts,
      comments,
      pendingComments,
      images,
      categories,
      messages,
      users,
    };
  }

  listPosts(): Promise<Post[]> {
    return this.posts.find({
      relations: { postUser: true, category: true },
      order: { publishedAt: 'DESC' },
    });
  }

  findPost(id: number): Promise<Post | null> {
    return this.posts.findOne({
      where: { id },
      relations: { postUser: true, category: true },
    });
  }

  listCategories(): Promise<Category[]> {
    return this.blogService.categoriesWithPostCounts();
  }

  async createCategory(
    name: string,
    description: string | null,
  ): Promise<Category> {
    const slug = await this.blogService.uniqueCategorySlug(name);
    return this.categories.save(
      this.categories.create({ name, slug, description }),
    );
  }

  async updateCategory(
    category: Category,
    name: string,
    description: string | null,
  ): Promise<Category> {
    if (category.name !== name) {
      category.slug = await this.blogService.uniqueCategorySlug(
        name,
        category.id,
      );
    }
    category.name = name;
    category.description = description;
    return this.categories.save(category);
  }

  deleteCategory(category: Category): Promise<void> {
    return this.categories.remove(category).then(() => undefined);
  }

  findCategoryById(id: number): Promise<Category | null> {
    return this.categories.findOne({ where: { id } });
  }

  listImages(): Promise<Image[]> {
    return this.images.find({
      relations: { category: true },
      order: { id: 'ASC' },
    });
  }

  findImage(id: number): Promise<Image | null> {
    return this.images.findOne({
      where: { id },
      relations: { category: true },
    });
  }

  createImage(data: {
    file: string;
    thumbnail: string | null;
    numLikes: number;
    numViews: number;
    numDownloads: number;
    category: Category;
  }): Promise<Image> {
    return this.images.save(this.images.create(data));
  }

  async updateImage(
    image: Image,
    data: {
      numLikes: number;
      numViews: number;
      numDownloads: number;
      category: Category;
    },
  ): Promise<Image> {
    image.numLikes = data.numLikes;
    image.numViews = data.numViews;
    image.numDownloads = data.numDownloads;
    image.category = data.category;
    return this.images.save(image);
  }

  async deleteImage(image: Image): Promise<void> {
    const files = [image.file, image.thumbnail].filter(Boolean);
    for (const file of files) {
      await unlink(join(GALLERY_IMAGE_DIR, file)).catch(() => undefined);
    }
    await unlink(join(PORTFOLIO_IMAGE_DIR, image.file)).catch(
      () => undefined,
    );
    await this.images.remove(image);
  }

  async incrementImageViews(id: number): Promise<void> {
    await this.images.increment({ id }, 'numViews', 1);
  }

  async incrementImageLikes(id: number): Promise<void> {
    await this.images.increment({ id }, 'numLikes', 1);
  }

  async incrementImageDownloads(id: number): Promise<void> {
    await this.images.increment({ id }, 'numDownloads', 1);
  }

  async decrementImageLikes(id: number): Promise<void> {
    await this.images
      .createQueryBuilder()
      .update()
      .set({ numLikes: () => 'GREATEST(num_likes - 1, 0)' })
      .where('id = :id', { id })
      .execute();
  }

  listComments(): Promise<Comment[]> {
    return this.comments.find({
      relations: { post: true },
      order: { publishedAt: 'DESC' },
    });
  }

  findComment(id: number): Promise<Comment | null> {
    return this.comments.findOne({
      where: { id },
      relations: { post: true },
    });
  }

  async setCommentApproved(
    comment: Comment,
    approved: boolean,
  ): Promise<void> {
    comment.approved = approved;
    await this.comments.save(comment);
    if (comment.post) {
      await this.blogService.recountComments(comment.post.id);
    }
  }

  async deleteComment(comment: Comment): Promise<void> {
    const postId = comment.post?.id;
    await this.comments.remove(comment);
    if (postId) {
      await this.blogService.recountComments(postId);
    }
  }

  listMessages(): Promise<Contact[]> {
    return this.contacts.find({ order: { id: 'DESC' } });
  }

  deleteMessage(message: Contact): Promise<void> {
    return this.contacts.remove(message).then(() => undefined);
  }
}
