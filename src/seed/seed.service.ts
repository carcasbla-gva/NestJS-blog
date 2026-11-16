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

    // Backfill de slugs y avatares de usuario
    const users = await this.users.find();
    for (const user of users) {
      if (!user.slug) {
        const base = slugify(user.name) || `user-${user.id}`;
        let slug = base;
        let suffix = 2;
        while (
          (await this.users.count({ where: { slug } })) > 0
        ) {
          slug = `${base}-${suffix}`;
          suffix += 1;
        }
        user.slug = slug;
        await this.users.save(user);
      }
    }
  }

  private async seedUsers(): Promise<void> {
    // No se crean usuarios de ejemplo: el administrador crea su propia cuenta.
    if ((await this.users.count()) > 0) {
      return;
    }
    this.logger.log('No hay usuarios en la base de datos. Regístrate para crear la primera cuenta.');
  }

  private async seedCategoriesAndImages(): Promise<void> {
    if ((await this.categories.count()) > 0) {
      return;
    }

    const groups = [
      {
        name: 'Paisajes',
        description: 'Paisajes, montañas y luz natural.',
        files: ['1.jpg', '2.jpg', '3.jpg'],
      },
      {
        name: 'Retratos',
        description: 'Retratos naturales y luz de ventana.',
        files: ['4.jpg', '5.jpg', '6.jpg'],
      },
      {
        name: 'Bodas',
        description: 'Historias documentales de boda.',
        files: ['7.jpg', '8.jpg', '9.jpg'],
      },
      {
        name: 'Calle',
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
        title: 'Elefantes majestuosos en la naturaleza',
        image: 'elephant.jpg',
        category: 'Paisajes',
        tags: ['vida silvestre', 'elefantes', 'naturaleza'],
        content:
          'Los elefantes son uno de los animales más inteligentes y emocionalmente complejos del planeta. Fotografizarlos en su hábitat natural requiere paciencia, respeto y mucha suerte. En este artículo compartimos cómo nos acercamos a la manada, el equipo que utilizamos y por qué la luz de la hora dorada marca una gran diferencia en la fotografía de vida silvestre.',
        likes: 24,
        views: 180,
        days: 14,
      },
      {
        title: 'Momentos familiares que duran para siempre',
        image: 'family.jpg',
        category: 'Retratos',
        tags: ['familia', 'retrato', 'emoción'],
        content:
          'Una sesión familiar no se trata de poses perfectas, sino de capturar los pequeños gestos que hacen única a una familia. Risas, una mirada compartida, una mano en el hombro. Explicamos cómo preparamos cada sesión para que todos se sientan cómodos frente a la cámara.',
        likes: 18,
        views: 142,
        days: 11,
      },
      {
        title: 'Una ventana al paisaje',
        image: 'landscape.jpg',
        category: 'Paisajes',
        tags: ['paisaje', 'luz', 'composición'],
        content:
          'La fotografía de paisajes es una conversación entre la luz y el terreno. Viajamos a lugares remotos antes del amanecer, esperamos a que se levante la niebla y dejamos que la escena se revele. Estos son nuestros consejos favoritos para planificar una sesión de paisajes y componer imágenes con profundidad.',
        likes: 31,
        views: 260,
        days: 9,
      },
      {
        title: 'Una boda para recordar',
        image: 'wedding.jpg',
        category: 'Bodas',
        tags: ['boda', 'documental', 'pareja'],
        content:
          'Las bodas son historias de ritmo rápido con decenas de personajes. Nuestro enfoque documental se centra en la emoción genuina: los nerviosos preparativos, la primera mirada y la celebración que sigue. Aquí tienes la cronología completa de una boda reciente que fotografiamos.',
        likes: 42,
        views: 390,
        days: 6,
      },
      {
        title: 'Retrato de una mujer',
        image: 'woman.jpg',
        category: 'Retratos',
        tags: ['retrato', 'luz natural', 'ventana'],
        content:
          'Los retratos con luz natural se pueden crear casi en cualquier lugar. Una ventana, una pared blanca y un sujeto paciente suelen ser suficientes. En este post analizamos la configuración de iluminación, la elección del objetivo y las pequeñas indicaciones que ayudan a las personas a relajarse frente al objetivo.',
        likes: 27,
        views: 210,
        days: 4,
      },
      {
        title: 'Hora dorada en las montañas',
        image: 'landscape.jpg',
        category: 'Calle',
        tags: ['montañas', 'hora dorada', 'viajes'],
        content:
          'La hora después del amanecer y antes del atardecer transforma los paisajes ordinarios. Luz cálida, sombras largas y contraste suave crean imágenes que necesitan muy poco retoque. Compartimos algunos lugares cerca de la ciudad donde puedes practicar la fotografía de hora dorada.',
        likes: 15,
        views: 98,
        days: 2,
      },
      {
        title: 'El arte del retrato en blanco y negro',
        image: 'woman.jpg',
        category: 'Retratos',
        tags: ['blanco y negro', 'retrato', 'textura'],
        content:
          'Eliminar el color obliga al espectador a centrarse en la forma, la textura y la expresión. El retrato en blanco y negro es una disciplina atemporal. Explicamos cómo exponer para las luces, cuándo convertir una imagen y cómo mantener los tonos de piel naturales.',
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
          name: 'Ana García',
          email: 'ana@example.com',
          text: '¡Qué artículo tan maravilloso! La parte sobre respetar a los animales es muy importante.',
          approved: true,
          publishedAt: daysAgo(13),
          post: first,
        }),
        this.comments.create({
          name: 'David López',
          email: 'david@example.com',
          text: 'Fotografía preciosa. Me encantaría saber qué objetivo usaste para este disparo.',
          approved: true,
          publishedAt: daysAgo(12),
          post: first,
        }),
        this.comments.create({
          name: 'Carlos Ruiz',
          email: 'carlos@example.com',
          text: 'Las sesiones familiares siempre se sienten más auténticas cuando todos pueden ser ellos mismos. Gran trabajo.',
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
