import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { BlogController } from './blog/blog.controller';
import { BlogService } from './blog/blog.service';
import { ContactService } from './contact/contact.service';
import { AppViewMiddleware } from './common/app-view.middleware';
import { CsrfService } from './common/csrf.service';
import { AdminGuard, AuthGuard } from './common/guards';
import { ENTITIES } from './entities';
import { PagesController } from './pages/pages.controller';
import { SeedService } from './seed/seed.service';
import { UsersService } from './users/users.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(config.get<string>('DB_PORT', '3306')),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'nestjs_blog'),
        entities: ENTITIES,
        synchronize: true,
        charset: 'utf8mb4',
      }),
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [
    PagesController,
    BlogController,
    AuthController,
    AdminController,
  ],
  providers: [
    UsersService,
    CsrfService,
    AuthService,
    BlogService,
    AdminService,
    ContactService,
    SeedService,
    AuthGuard,
    AdminGuard,
    AppViewMiddleware,
  ],
})
export class AppModule {}
