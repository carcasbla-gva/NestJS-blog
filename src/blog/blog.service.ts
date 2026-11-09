import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Not, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Comment } from '../entities/comment.entity';
import { PostLike } from '../entities/post-like.entity';
import { Post } from '../entities/post.entity';
import { User } from '../entities/user.entity';
import { POSTS_IMAGE_DIR } from '../common/paths';
import { slugify } from '../common/slug';

export const POSTS_PER_PAGE = 5;

export type PostFilter = {
  categorySlug?: string;
  search?: string;
  includeDrafts?: boolean;
};

export type PostInput = {
  title: string;
  content: string;
  image: string;
  category: Category | null;
  tags: string[];
  published: boolean;
};

export type CommentInput = {
  name: string;
  email: string;
  text: string;
  authorIp?: string | null;
};

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Post)
    private readonly posts: Repository<Post>,
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(PostLike)
    private readonly likes: Repository<PostLike>,
  ) {}

  async listPosts(
    page: number,
    perPage = POSTS_PER_PAGE,
    filter: PostFilter = {},
  ): Promise<{
    posts: Post[];
    total: number;
    totalPages: number;
    category: Category | null;
  }> {
    const query = this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.postUser', 'postUser')
      .leftJoinAndSelect('post.category', 'category');

    if (!filter.includeDrafts) {
      query.where('post.published = :published', { published: true });
    }

    if (filter.categorySlug) {
      query.andWhere('category.slug = :categorySlug', {
        categorySlug: filter.categorySlug,
      });
    }

    if (filter.search) {
      query.andWhere(
        '(post.title LIKE :search OR post.content LIKE :search OR post.tags LIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    const [posts, total] = await query
      .orderBy('post.publishedAt', 'DESC')
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();

    const category = filter.categorySlug
      ? await this.findCategoryBySlug(filter.categorySlug)
      : null;

    return {
      posts,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      category,
    };
  }

  findRecents(limit = 5, filter: PostFilter = {}): Promise<Post[]> {
    const query = this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.postUser', 'postUser')
      .leftJoinAndSelect('post.category', 'category')
      .orderBy('post.publishedAt', 'DESC')
      .take(limit);

    if (!filter.includeDrafts) {
      query.where('post.published = :published', { published: true });
    }

    if (filter.categorySlug) {
      query.andWhere('category.slug = :categorySlug', {
        categorySlug: filter.categorySlug,
      });
    }

    return query.getMany();
  }

  findBySlug(
    slug: string,
    includeDrafts = false,
  ): Promise<Post | null> {
    const query = this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.postUser', 'postUser')
      .leftJoinAndSelect('post.category', 'category')
      .leftJoinAndSelect('post.comments', 'comment')
      .where('post.slug = :slug', { slug });

    if (!includeDrafts) {
      query.andWhere('post.published = :published', { published: true });
    }

    return query.orderBy('comment.publishedAt', 'ASC').getOne();
  }

  findById(id: number): Promise<Post | null> {
    return this.posts.findOne({
      where: { id },
      relations: { comments: true, category: true, postUser: true },
    });
  }

  async hasLiked(postId: number, sessionId: string): Promise<boolean> {
    if (!sessionId) {
      return false;
    }
    return (
      (await this.likes.count({
        where: { post: { id: postId }, sessionId },
      })) > 0
    );
  }

  async createPost(input: PostInput, user: User): Promise<Post> {
    const slug = await this.uniquePostSlug(input.title);
    const post = this.posts.create({
      title: input.title,
      content: input.content,
      image: input.image,
      slug,
      publishedAt: new Date(),
      numLikes: 0,
      numComments: 0,
      numViews: 0,
      published: input.published,
      tags: input.tags.length > 0 ? input.tags : null,
      updatedAt: null,
      postUser: user,
      category: input.category,
    });
    return this.posts.save(post);
  }

  async updatePost(post: Post, input: PostInput): Promise<Post> {
    if (post.title !== input.title) {
      post.slug = await this.uniquePostSlug(input.title, post.id);
    }

    post.title = input.title;
    post.content = input.content;
    post.category = input.category;
    post.tags = input.tags.length > 0 ? input.tags : null;
    post.published = input.published;
    post.updatedAt = new Date();

    let previousImage: string | null = null;
    if (input.image && input.image !== post.image) {
      previousImage = post.image;
      post.image = input.image;
    }

    const saved = await this.posts.save(post);
    if (previousImage) {
      await unlink(join(POSTS_IMAGE_DIR, previousImage)).catch(
        () => undefined,
      );
    }
    return saved;
  }

  async deletePost(post: Post): Promise<void> {
    if (post.image) {
      await unlink(join(POSTS_IMAGE_DIR, post.image)).catch(() => undefined);
    }
    await this.posts.remove(post);
  }

  async addComment(
    post: Post,
    data: CommentInput,
  ): Promise<Comment> {
    const comment = this.comments.create({
      name: data.name,
      email: data.email,
      text: data.text,
      approved: true,
      authorIp: data.authorIp ?? null,
      publishedAt: new Date(),
      post,
    });
    const saved = await this.comments.save(comment);
    await this.recountComments(post.id);
    return saved;
  }

  async recountComments(postId: number): Promise<void> {
    const count = await this.comments.count({
      where: { post: { id: postId }, approved: true },
    });
    await this.posts.update({ id: postId }, { numComments: count });
  }

  async toggleLike(
    slug: string,
    sessionId: string,
  ): Promise<{ post: Post; liked: boolean } | null> {
    const post = await this.posts.findOne({ where: { slug } });
    if (!post) {
      return null;
    }

    const existing = await this.likes.findOne({
      where: { post: { id: post.id }, sessionId },
    });

    if (existing) {
      await this.likes.delete(existing.id);
      post.numLikes = Math.max(0, (post.numLikes ?? 0) - 1);
      await this.posts.save(post);
      return { post, liked: false };
    }

    await this.likes.save(
      this.likes.create({
        post,
        sessionId,
        createdAt: new Date(),
      }),
    );
    post.numLikes = (post.numLikes ?? 0) + 1;
    await this.posts.save(post);
    return { post, liked: true };
  }

  async incrementViews(postId: number): Promise<void> {
    await this.posts.increment({ id: postId }, 'numViews', 1);
  }

  listCategories(): Promise<Category[]> {
    return this.categories.find({ order: { id: 'ASC' } });
  }

  async categoriesWithPostCounts(): Promise<Category[]> {
    const categories = await this.categories
      .createQueryBuilder('category')
      .leftJoin(
        'category.posts',
        'post',
        'post.published = :published',
        { published: true },
      )
      .loadRelationCountAndMap(
        'category.postCount',
        'category.posts',
        'publishedPost',
        (query) =>
          query.where('publishedPost.published = :published', {
            published: true,
          }),
      )
      .orderBy('category.id', 'ASC')
      .getMany();

    return categories;
  }

  findCategoryById(id: number): Promise<Category | null> {
    return this.categories.findOne({ where: { id } });
  }

  findCategoryBySlug(slug: string): Promise<Category | null> {
    return this.categories.findOne({ where: { slug } });
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

  async uniquePostSlug(title: string, ignoreId?: number): Promise<string> {
    const base = slugify(title) || `post-${Date.now()}`;
    return this.uniqueSlug(base, (slug) =>
      this.posts.count({
        where: ignoreId ? { slug, id: Not(ignoreId) } : { slug },
      }),
    );
  }

  async uniqueCategorySlug(
    name: string,
    ignoreId?: number,
  ): Promise<string> {
    const base = slugify(name) || `categoria-${Date.now()}`;
    return this.uniqueSlug(base, (slug) =>
      this.categories.count({
        where: ignoreId ? { slug, id: Not(ignoreId) } : { slug },
      }),
    );
  }

  private async uniqueSlug(
    base: string,
    exists: (slug: string) => Promise<number>,
  ): Promise<string> {
    let slug = base;
    let suffix = 2;
    while ((await exists(slug)) > 0) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }
}
