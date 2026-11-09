import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import session from 'express-session';
import helmet from 'helmet';
import mysql from 'mysql2/promise';
import { NextFunction, Request, Response } from 'express';
import { Repository } from 'typeorm';
import * as nunjucks from 'nunjucks';
import { AppModule } from './app.module';
import { AppViewMiddleware } from './common/app-view.middleware';
import { CsrfService } from './common/csrf.service';
import { formatDate } from './common/date-format';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { PUBLIC_DIR, VIEWS_DIR } from './common/paths';
import { onPost, rateLimit } from './common/rate-limit';
import { TypeOrmSessionStore } from './common/session.store';
import { asset } from './common/view-helpers';
import { Session } from './entities/session.entity';
import { UsersService } from './users/users.service';

/**
 * Crea la base de datos si no existe, para que un arranque limpio no falle con
 * "Unknown database". Se puede desactivar con DB_AUTO_CREATE=false.
 */
async function ensureDatabase(logger: Logger): Promise<void> {
  try {
    process.loadEnvFile?.('.env');
  } catch {
    // .env es opcional: en producción se usan variables del entorno.
  }

  const autoCreate =
    process.env.DB_AUTO_CREATE === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.DB_AUTO_CREATE !== 'false');
  if (!autoCreate) {
    return;
  }

  const database = (process.env.DB_DATABASE ?? 'nestjs_blog').replace(
    /`/g,
    '',
  );

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USERNAME ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
    });
    try {
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      logger.log(`Base de datos "${database}" lista`);
    } finally {
      await connection.end();
    }
  } catch (error) {
    logger.warn(
      `No se pudo crear la base de datos "${database}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  await ensureDatabase(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.set('trust proxy', 1);

  // Cabeceras de seguridad. Se desactiva la CSP para no romper los scripts
  // y estilos inline que trae la plantilla original.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const nunjucksEnvironment = nunjucks.configure(VIEWS_DIR, {
    express: app.getHttpAdapter().getInstance(),
    autoescape: true,
    noCache: !isProduction,
    // Nest reinicia el proceso en modo watch, así que no hace falta
    // que Nunjucks vigile los archivos (evita depender de chokidar).
    watch: false,
  });
  nunjucksEnvironment.addFilter('date', formatDate);
  nunjucksEnvironment.addGlobal('asset', asset);
  app.setViewEngine('njk');

  // Archivos estáticos (CSS, JS, imágenes...)
  app.useStaticAssets(PUBLIC_DIR);

  const sessionRepository = app.get<Repository<Session>>(
    getRepositoryToken(Session),
  );
  const sessionStore = new TypeOrmSessionStore(sessionRepository);

  app.use(
    session({
      secret: config.get<string>(
        'SESSION_SECRET',
        'nestjs-blog-secret-change-me',
      ),
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 1000 * 60 * 60 * 8,
      },
    }),
  );

  // Carga el usuario de la sesión y variables comunes a todas las vistas.
  const viewer = new AppViewMiddleware(
    app.get(UsersService),
    app.get(CsrfService),
  );
  app.use((req, res, next) => viewer.use(req, res, next));

  // Limitadores de peticiones: fuerza bruta y spam de formularios.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyPrefix: 'auth',
    message:
      'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.',
  });
  app.use(
    ['/login', '/register', '/forgot-password'],
    onPost(authLimiter),
  );
  app.use(/^\/reset-password\/[^/]+$/, onPost(authLimiter));

  const formLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    keyPrefix: 'forms',
    message: 'Has enviado demasiados formularios. Espera unos minutos.',
  });
  app.use('/contact', onPost(formLimiter));
  app.use(
    /^\/single_post\/[^/]+\/comment$/,
    onPost(formLimiter),
  );

  app.use(
    onPost(
      rateLimit({
        windowMs: 10 * 60 * 1000,
        max: 120,
        keyPrefix: 'post-global',
      }),
    ),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();

  // Fallback 404 y manejador de errores final de Express.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use((req: Request, res: Response) => {
    if (req.accepts('html')) {
      res.status(404).render('errors/404', {
        status: 404,
        message: 'La página que buscas no existe o ha sido movida.',
      });
      return;
    }
    res.status(404).json({
      statusCode: 404,
      message: 'Not Found',
    });
  });

  expressApp.use(
    (
      error: Error,
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (res.headersSent) {
        next(error);
        return;
      }
      logger.error(
        `Error no controlado en ${req.method} ${req.originalUrl}`,
        error?.stack,
      );
      if (req.accepts('html')) {
        res.status(500).render('errors/error', {
          status: 500,
          message:
            'Ha ocurrido un error interno. Inténtalo de nuevo más tarde.',
        });
        return;
      }
      res.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
      });
    },
  );

  // Limpieza periódica de sesiones caducadas.
  const cleanup = setInterval(() => {
    void sessionStore.clearExpired().catch(() => undefined);
  }, 60 * 60 * 1000);
  cleanup.unref();

  const port = Number(config.get<string>('PORT', '3000'));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Blog NestJS escuchando en http://localhost:${port}`);
}

void bootstrap();
