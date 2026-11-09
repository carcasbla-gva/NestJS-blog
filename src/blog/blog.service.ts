import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Comment } from '../entities/comment.entity';
import { Post } from '../entities/post.entity';
import { User } from '../entities/user.entity';
import { slugify } from '../common/slug';

export const POSTS_PER_PAGE = 5;

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Post)
    private readonly posts: Repository<Post>,
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  async listPosts(
    page: number,
    perPage = POSTS_PER_PAGE,
  ): Promise<{ posts: Post[]; total: number; totalPages: number }> {
    const [posts, total] = await this.posts.findAndCount({
      relations: { postUser: true },
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    return {
      posts,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  }

  findRecents(limit = 5): Promise<Post[]> {
    return this.posts.find({
      relations: { postUser: true },
      order: { publishedAt: 'DESC' },
      take: limit,
    });
  }

  findByText(searchTerm: string): Promise<Post[]> {
    return this.posts.find({
      where: { content: Like(`%${searchTerm}%`) },
      relations: { postUser: true },
      order: { publishedAt: 'DESC' },
    });
  }

  findBySlug(slug: string): Promise<Post | null> {
    return this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.postUser', 'postUser')
      .leftJoinAndSelect('post.comments', 'comment')
      .where('post.slug = :slug', { slug })
      .orderBy('comment.publishedAt', 'ASC')
      .getOne();
  }

  findById(id: number): Promise<Post | null> {
    return this.posts.findOne({
      where: { id },
      relations: { comments: true },
    });
  }

  async createPost(
    data: { title: string; content: string; image: string },
    user: User,
  ): Promise<Post> {
    const slug = slugify(data.title) || `post-${Date.now()}`;
    const post = this.posts.create({
      title: data.title,
      content: data.content,
      image: data.image,
      slug,
      publishedAt: new Date(),
      numLikes: 0,
      numComments: 0,
      postUser: user,
    });
    return this.posts.save(post);
  }

  async addComment(
    post: Post,
    data: { name: string; email: string; text: string },
  ): Promise<Comment> {
    const comment = this.comments.create({
      name: data.name,
      email: data.email,
      text: data.text,
      publishedAt: new Date(),
      post,
    });
    const saved = await this.comments.save(comment);
    await this.posts.increment({ id: post.id }, 'numComments', 1);
    return saved;
  }

  async like(slug: string): Promise<Post | null> {
    const post = await this.posts.findOne({ where: { slug } });
    if (!post) {
      return null;
    }
    post.like();
    return this.posts.save(post);
  }

  async categoriesWithImages(): Promise<Category[]> {
    const categories = await this.categories.find({
      relations: { images: true },
      order: { id: 'ASC' },
    });
    for (const category of categories) {
      category.images.sort((a, b) => a.id - b.id);
    }
    return categories;
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
}
