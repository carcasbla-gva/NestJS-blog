import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import session from 'express-session';
import * as nunjucks from 'nunjucks';
import { AppModule } from './app.module';
import { AppViewMiddleware } from './common/app-view.middleware';
import { CsrfService } from './common/csrf.service';
import { formatDate } from './common/date-format';
import { PUBLIC_DIR, VIEWS_DIR } from './common/paths';
import { asset } from './common/view-helpers';
import { UsersService } from './users/users.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const nunjucksEnvironment = nunjucks.configure(VIEWS_DIR, {
    express: app.getHttpAdapter().getInstance(),
    autoescape: true,
    noCache: config.get<string>('NODE_ENV') !== 'production',
    watch: config.get<string>('NODE_ENV') !== 'production',
  });
  nunjucksEnvironment.addFilter('date', formatDate);
  nunjucksEnvironment.addGlobal('asset', asset);
  app.setViewEngine('njk');

  // Archivos estáticos (CSS, JS, imágenes...)
  app.useStaticAssets(PUBLIC_DIR);

  app.use(
    session({
      secret: config.get<string>(
        'SESSION_SECRET',
        'nestjs-blog-secret-change-me',
      ),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
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

  const port = Number(config.get<string>('PORT', '3000'));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Blog NestJS escuchando en http://localhost:${port}`);
}

void bootstrap();
