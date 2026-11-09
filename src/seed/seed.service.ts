import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsNull, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Comment } from '../entities/comment.entity';
import { Image } from '../entities/image.entity';
import { Post } from '../entities/post.entity';
import { User } from '../entities/user.entity';
import { createThumbnail } from '../common/images';
import { slugify } from '../common/slug';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Image) private readonly images: Repository<Image>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.backfill();
    } catch (error) {
      this.logger.error('No se pudieron actualizar los datos existentes', error);
    }

    if (this.config.get<string>('SEED_DB', 'true') === 'false') {
      return;
    }

    try {
      await this.seedUsers();
      await this.seedCategoriesAndImages();
      await this.seedPostsAndComments();
    } catch (error) {
      this.logger.error('No se pudieron cargar los datos de ejemplo', error);
    }
  }

  /**
   * Completa columnas nuevas en bases de datos creadas con la versión
   * anterior (slugs de categorías, thumbnails, categorías de posts...).
   */
  private async backfill(): Promise<void> {
    const categories = await this.categories.find({ order: { id: 'ASC' } });

    for (const category of categories) {
      if (category.slug) {
        continue;
      }
      const base = slugify(category.name) || `categoria-${category.id}`;
      let slug = base;
      let suffix = 2;
      while (
        (await this.categories.count({ where: { slug } })) > 0
      ) {
        slug = `${base}-${suffix}`;
        suffix += 1;
      }
      category.slug = slug;
      await this.categories.save(category);
    }

    const posts = await this.posts
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.category', 'category')
      .getMany();

    if (categories.length > 0) {
      let index = 0;
      for (const post of posts) {
        if (!post.category) {
          post.category = categories[index % categories.length];
          await this.posts.save(post);
          index += 1;
        }
      }
    }

    const images = await this.images.find({
      where: { thumbnail: IsNull() },
    });
    for (const image of images) {
      const thumbnail = await createThumbnail(image.file);
      if (thumbnail) {
        image.thumbnail = thumbnail;
        await this.images.save(image);
      }
    }

    await this.comments.update({ approved: IsNull() }, { approved: true });
    await this.users.update(
      { emailVerified: IsNull() },
      { emailVerified: true },
    );
  }

  private async seedUsers(): Promise<void> {
    if ((await this.users.count()) > 0) {
      return;
    }

    const [adminPassword, demoPassword] = await Promise.all([
      bcrypt.hash('admin123', 10),
      bcrypt.hash('demo123', 10),
    ]);

    await this.users.save([
      this.users.create({
        email: 'admin@blog.com',
        name: 'Admin',
        password: adminPassword,
        roles: ['ROLE_ADMIN'],
        bio: 'Administrador del blog de fotografía.',
        emailVerified: true,
      }),
      this.users.create({
        email: 'demo@blog.com',
        name: 'Demo User',
        password: demoPassword,
        roles: [],
        bio: 'Usuario de demostración.',
        emailVerified: true,
      }),
    ]);

    this.logger.log(
      'Usuarios de ejemplo creados: admin@blog.com / admin123 y demo@blog.com / demo123',
    );
  }

  private async seedCategoriesAndImages(): Promise<void> {
    if ((await this.categories.count()) > 0) {
      return;
    }

    const groups = [
      {
        name: 'Landscapes',
        description: 'Paisajes, montañas y luz natural.',
        files: ['1.jpg', '2.jpg', '3.jpg'],
      },
      {
        name: 'Portraits',
        description: 'Retratos naturales y luz de ventana.',
        files: ['4.jpg', '5.jpg', '6.jpg'],
      },
      {
        name: 'Weddings',
        description: 'Historias documentales de boda.',
        files: ['7.jpg', '8.jpg', '9.jpg'],
      },
      {
        name: 'Street',
        description: 'Fotografía urbana y momentos espontáneos.',
        files: ['10.jpg', '11.jpg', '12.jpg'],
      },
    ];

    let index = 0;
    for (const group of groups) {
      const category = await this.categories.save(
        this.categories.create({
          name: group.name,
          slug: slugify(group.name),
          description: group.description,
        }),
      );

      const images = group.files.map((file) => {
        index += 1;
        return this.images.create({
          file,
          thumbnail: null,
          category,
          numLikes: 8 + index,
          numViews: 120 + index * 17,
          numDownloads: 3 + index,
        });
      });
      await this.images.save(images);

      for (const image of images) {
        const thumbnail = await createThumbnail(image.file);
        if (thumbnail) {
          image.thumbnail = thumbnail;
          await this.images.save(image);
        }
      }
    }

    this.logger.log('Categorías e imágenes de ejemplo creadas');
  }

  private async seedPostsAndComments(): Promise<void> {
    if ((await this.posts.count()) > 0) {
      return;
    }

    const admin =
      (await this.users.findOne({ where: { email: 'admin@blog.com' } })) ??
      (await this.users.find({ take: 1 }))[0];

    if (!admin) {
      return;
    }

    const categories = await this.categories.find({ order: { id: 'ASC' } });

    const daysAgo = (days: number): Date =>
      new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const examples = [
      {
        title: 'Majestic Elephants in the Wild',
        image: 'elephant.jpg',
        category: 'Landscapes',
        tags: ['wildlife', 'elephants', 'nature'],
        content:
          'Elephants are among the most intelligent and emotionally complex animals on the planet. Photographing them in their natural habitat requires patience, respect and a great deal of luck. In this article we share how we approached the herd, the equipment we used and why golden hour light makes such a difference in wildlife photography.',
        likes: 24,
        views: 180,
        days: 14,
      },
      {
        title: 'Family Moments That Last Forever',
        image: 'family.jpg',
        category: 'Portraits',
        tags: ['family', 'portrait', 'emotion'],
        content:
          'A family session is not about perfect poses; it is about capturing the small gestures that make a family unique. Laughter, a shared look, a hand on a shoulder. We explain how we prepare each session so everyone feels comfortable in front of the camera.',
        likes: 18,
        views: 142,
        days: 11,
      },
      {
        title: 'A Window to the Landscape',
        image: 'landscape.jpg',
        category: 'Landscapes',
        tags: ['landscape', 'light', 'composition'],
        content:
          'Landscape photography is a conversation between light and terrain. We travel to remote locations before sunrise, wait for the fog to lift and let the scene reveal itself. These are our favourite tips for planning a landscape shoot and composing images with depth.',
        likes: 31,
        views: 260,
        days: 9,
      },
      {
        title: 'A Wedding to Remember',
        image: 'wedding.jpg',
        category: 'Weddings',
        tags: ['wedding', 'documentary', 'couple'],
        content:
          'Weddings are fast-moving stories with dozens of characters. Our documentary approach focuses on genuine emotion: the nervous preparation, the first look and the celebration that follows. Here is a complete timeline of a recent wedding we photographed.',
        likes: 42,
        views: 390,
        days: 6,
      },
      {
        title: 'Portrait of a Woman',
        image: 'woman.jpg',
        category: 'Portraits',
        tags: ['portrait', 'natural light', 'window'],
        content:
          'Natural light portraits can be created almost anywhere. A window, a white wall and a patient subject are often enough. In this post we break down the lighting setup, the lens choice and the small directions that help people relax in front of the lens.',
        likes: 27,
        views: 210,
        days: 4,
      },
      {
        title: 'Golden Hour in the Mountains',
        image: 'landscape.jpg',
        category: 'Street',
        tags: ['mountains', 'golden hour', 'travel'],
        content:
          'The hour after sunrise and before sunset transforms ordinary landscapes. Warm light, long shadows and soft contrast create images that need very little editing. We share a few locations close to the city where you can practise golden hour photography.',
        likes: 15,
        views: 98,
        days: 2,
      },
      {
        title: 'The Art of Black and White Portraits',
        image: 'woman.jpg',
        category: 'Portraits',
        tags: ['black and white', 'portrait', 'texture'],
        content:
          'Removing colour forces the viewer to focus on shape, texture and expression. Black and white portraiture is a timeless discipline. We explain how to expose for the highlights, when to convert an image and how to keep skin tones natural.',
        likes: 11,
        views: 75,
        days: 1,
      },
    ];

    const posts: Post[] = [];
    for (const example of examples) {
      const category =
        categories.find((item) => item.name === example.category) ?? null;

      const post = await this.posts.save(
        this.posts.create({
          title: example.title,
          content: example.content,
          image: example.image,
          slug: slugify(example.title),
          publishedAt: daysAgo(example.days),
          numLikes: example.likes,
          numComments: 0,
          numViews: example.views,
          published: true,
          tags: example.tags,
          updatedAt: null,
          postUser: admin,
          category,
        }),
      );
      posts.push(post);
    }

    if ((await this.comments.count()) === 0 && posts.length > 0) {
      const first = posts[0];
      const second = posts[1];

      await this.comments.save([
        this.comments.create({
          name: 'Alice Moore',
          email: 'alice@example.com',
          text: 'What a wonderful article. The part about respecting the animals is so important!',
          approved: true,
          publishedAt: daysAgo(13),
          post: first,
        }),
        this.comments.create({
          name: 'David Clark',
          email: 'david@example.com',
          text: 'Beautiful photograph. I would love to know which lens you used for this shot.',
          approved: true,
          publishedAt: daysAgo(12),
          post: first,
        }),
        this.comments.create({
          name: 'Carlos Ruiz',
          email: 'carlos@example.com',
          text: 'Family sessions always feel more authentic when everybody is allowed to be themselves. Great work.',
          approved: true,
          publishedAt: daysAgo(10),
          post: second,
        }),
      ]);

      await this.posts.update(first.id, { numComments: 2 });
      await this.posts.update(second.id, { numComments: 1 });
    }

    this.logger.log('Posts y comentarios de ejemplo creados');
  }
}
