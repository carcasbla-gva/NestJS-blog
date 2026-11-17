import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BlogService } from '../blog/blog.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '../common/guards';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostFavorite } from '../entities/post-favorite.entity';
import { Post as PostEntity } from '../entities/post.entity';

@Controller('api')
export class ApiController {
  constructor(
    @InjectRepository(PostFavorite)
    private readonly favorites: Repository<PostFavorite>,
    @InjectRepository(PostEntity)
    private readonly posts: Repository<PostEntity>,
    private readonly blogService: BlogService,
    private readonly usersService: UsersService,
  ) {}

  @Get('search')
  async search(@Query('q') query: string, @Res() res: Response): Promise<void> {
    if (!query || query.trim().length < 2) {
      res.json([]);
      return;
    }

    const posts = await this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.category', 'category')
      .where('post.published = :published', { published: true })
      .andWhere(
        '(post.title LIKE :search OR post.content LIKE :search)',
        { search: `%${query}%` },
      )
      .orderBy('post.publishedAt', 'DESC')
      .take(5)
      .getMany();

    const results = posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      category: post.category?.name ?? null,
    }));

    res.json(results);
  }

  @Post('favorites/:postId')
  @UseGuards(AuthGuard)
  async addFavorite(
    @Param('postId') postId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const post = await this.posts.findOne({ where: { id: Number(postId) } });
    if (!post) {
      res.status(404).json({ success: false, error: 'Post no encontrado' });
      return;
    }

    const existing = await this.favorites.findOne({
      where: { post: { id: post.id }, user: { id: req.user.id } },
    });

    if (existing) {
      res.json({ success: true, favorited: true, count: await this.getFavoriteCount(post.id) });
      return;
    }

    await this.favorites.save(
      this.favorites.create({
        post,
        user: req.user,
        createdAt: new Date(),
      }),
    );

    res.json({ success: true, favorited: true, count: await this.getFavoriteCount(post.id) });
  }

  @Delete('favorites/:postId')
  @UseGuards(AuthGuard)
  async removeFavorite(
    @Param('postId') postId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const post = await this.posts.findOne({ where: { id: Number(postId) } });
    if (!post) {
      res.status(404).json({ success: false, error: 'Post no encontrado' });
      return;
    }

    await this.favorites.delete({
      post: { id: post.id },
      user: { id: req.user.id },
    });

    res.json({ success: true, favorited: false, count: await this.getFavoriteCount(post.id) });
  }

  @Get('favorites/:postId')
  @UseGuards(AuthGuard)
  async isFavorited(
    @Param('postId') postId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const post = await this.posts.findOne({ where: { id: Number(postId) } });
    if (!post) {
      res.status(404).json({ success: false, error: 'Post no encontrado' });
      return;
    }

    const favorite = await this.favorites.findOne({
      where: { post: { id: post.id }, user: { id: req.user.id } },
    });

    res.json({
      success: true,
      favorited: Boolean(favorite),
      count: await this.getFavoriteCount(post.id),
    });
  }

  private async getFavoriteCount(postId: number): Promise<number> {
    return this.favorites.count({ where: { post: { id: postId } } });
  }
}
