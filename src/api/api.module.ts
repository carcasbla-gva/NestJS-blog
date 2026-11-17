import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiController } from './api.controller';
import { PostFavorite } from '../entities/post-favorite.entity';
import { Post } from '../entities/post.entity';
import { BlogService } from '../blog/blog.service';
import { UsersService } from '../users/users.service';
import { Comment } from '../entities/comment.entity';
import { Category } from '../entities/category.entity';
import { PostLike } from '../entities/post-like.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostFavorite, Post, Comment, Category, PostLike, User]),
  ],
  controllers: [ApiController],
  providers: [BlogService, UsersService],
})
export class ApiModule {}
