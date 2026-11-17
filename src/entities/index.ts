import { Comment } from '../entities/comment.entity';
import { Contact } from '../entities/contact.entity';
import { Category } from '../entities/category.entity';
import { Image } from '../entities/image.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { PostFavorite } from '../entities/post-favorite.entity';
import { PostLike } from '../entities/post-like.entity';
import { Post } from '../entities/post.entity';
import { Session } from '../entities/session.entity';
import { User } from '../entities/user.entity';

export const ENTITIES = [
  User,
  Post,
  Comment,
  Category,
  Image,
  Contact,
  PostLike,
  PostFavorite,
  PasswordResetToken,
  Session,
];
