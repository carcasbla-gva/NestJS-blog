import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { Comment } from '../entities/comment.entity';
import { Image } from '../entities/image.entity';
import { Post } from '../entities/post.entity';
import { User } from '../entities/user.entity';
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
      }),
      this.users.create({
        email: 'demo@blog.com',
        name: 'Demo User',
        password: demoPassword,
        roles: [],
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
      { name: 'Landscapes', files: ['1.jpg', '2.jpg', '3.jpg'] },
      { name: 'Portraits', files: ['4.jpg', '5.jpg', '6.jpg'] },
      { name: 'Weddings', files: ['7.jpg', '8.jpg', '9.jpg'] },
      { name: 'Street', files: ['10.jpg', '11.jpg', '12.jpg'] },
    ];

    let index = 0;
    for (const group of groups) {
      const category = await this.categories.save(
        this.categories.create({ name: group.name }),
      );

      const images = group.files.map((file) => {
        index += 1;
        return this.images.create({
          file,
          category,
          numLikes: 8 + index,
          numViews: 120 + index * 17,
          numDownloads: 3 + index,
        });
      });
      await this.images.save(images);
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

    const daysAgo = (days: number): Date =>
      new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const examples = [
      {
        title: 'Majestic Elephants in the Wild',
        image: 'elephant.jpg',
        content:
          'Elephants are among the most intelligent and emotionally complex animals on the planet. Photographing them in their natural habitat requires patience, respect and a great deal of luck. In this article we share how we approached the herd, the equipment we used and why golden hour light makes such a difference in wildlife photography.',
        likes: 24,
        days: 14,
      },
      {
        title: 'Family Moments That Last Forever',
        image: 'family.jpg',
        content:
          'A family session is not about perfect poses; it is about capturing the small gestures that make a family unique. Laughter, a shared look, a hand on a shoulder. We explain how we prepare each session so everyone feels comfortable in front of the camera.',
        likes: 18,
        days: 11,
      },
      {
        title: 'A Window to the Landscape',
        image: 'landscape.jpg',
        content:
          'Landscape photography is a conversation between light and terrain. We travel to remote locations before sunrise, wait for the fog to lift and let the scene reveal itself. These are our favourite tips for planning a landscape shoot and composing images with depth.',
        likes: 31,
        days: 9,
      },
      {
        title: 'A Wedding to Remember',
        image: 'wedding.jpg',
        content:
          'Weddings are fast-moving stories with dozens of characters. Our documentary approach focuses on genuine emotion: the nervous preparation, the first look and the celebration that follows. Here is a complete timeline of a recent wedding we photographed.',
        likes: 42,
        days: 6,
      },
      {
        title: 'Portrait of a Woman',
        image: 'woman.jpg',
        content:
          'Natural light portraits can be created almost anywhere. A window, a white wall and a patient subject are often enough. In this post we break down the lighting setup, the lens choice and the small directions that help people relax in front of the lens.',
        likes: 27,
        days: 4,
      },
      {
        title: 'Golden Hour in the Mountains',
        image: 'landscape.jpg',
        content:
          'The hour after sunrise and before sunset transforms ordinary landscapes. Warm light, long shadows and soft contrast create images that need very little editing. We share a few locations close to the city where you can practise golden hour photography.',
        likes: 15,
        days: 2,
      },
      {
        title: 'The Art of Black and White Portraits',
        image: 'woman.jpg',
        content:
          'Removing colour forces the viewer to focus on shape, texture and expression. Black and white portraiture is a timeless discipline. We explain how to expose for the highlights, when to convert an image and how to keep skin tones natural.',
        likes: 11,
        days: 1,
      },
    ];

    const posts: Post[] = [];
    for (const example of examples) {
      const post = await this.posts.save(
        this.posts.create({
          title: example.title,
          content: example.content,
          image: example.image,
          slug: slugify(example.title),
          publishedAt: daysAgo(example.days),
          numLikes: example.likes,
          numComments: 0,
          postUser: admin,
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
          publishedAt: daysAgo(13),
          post: first,
        }),
        this.comments.create({
          name: 'David Clark',
          email: 'david@example.com',
          text: 'Beautiful photograph. I would love to know which lens you used for this shot.',
          publishedAt: daysAgo(12),
          post: first,
        }),
        this.comments.create({
          name: 'Carlos Ruiz',
          email: 'carlos@example.com',
          text: 'Family sessions always feel more authentic when everybody is allowed to be themselves. Great work.',
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
