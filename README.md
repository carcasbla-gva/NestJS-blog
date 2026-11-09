# NestJS Blog

Migración del proyecto **symfony-blog** a **NestJS**. Mantiene las mismas
páginas, el mismo diseño (Bootstrap, imágenes y CSS originales), la misma base
de datos MySQL y las mismas funcionalidades: blog con paginación y búsqueda,
comentarios, "me gusta", contacto, registro/login y administración de
categorías e imágenes. Sobre esa base se añadieron moderación de comentarios,
CRUD completo de posts, perfil de usuario, recuperación de contraseña y SEO.

## Novedades de esta versión

Sobre la migración inicial se añadieron estos bloques:

1. **Pack de producción**: sesiones en MySQL (`TypeOrmSessionStore`), `helmet`,
   rate limiting en login/registro/formularios, validación de variables de
   entorno al arrancar y páginas de error 404/429/500 con filtro global.
2. **CRUD de posts + categorías**: editar, borrar, estados borrador/publicado,
   categoría y etiquetas por post, y CRUD completo de categorías.
3. **Gestión de imágenes**: edición de metadatos, borrado, subida múltiple y
   thumbnails automáticos con `sharp`.
4. **Cuentas de usuario**: perfil editable, cambio de contraseña, recuperación
   por email y verificación de cuenta (`nodemailer`, con fallback al log).
5. **Comentarios y likes reales**: moderación desde el admin, un voto por
   usuario/sesión y contador de visitas incrementado de verdad.
6. **SEO y slugs únicos**: `rss.xml`, `sitemap.xml`, `robots.txt`, Open Graph,
   Twitter Cards y generación de slugs sin colisiones.

Además, el arranque crea la base de datos si no existe (`DB_AUTO_CREATE`), para
que un clon nuevo no falle con `Unknown database`.

## Stack

| Pieza | Symfony original | Versión NestJS |
| --- | --- | --- |
| Framework | Symfony 6.4 | NestJS 12 (Express 5) |
| Plantillas | Twig | Nunjucks (`views/`) |
| ORM | Doctrine | TypeORM 0.3 |
| Base de datos | MySQL | MySQL (`mysql2`) |
| Autenticación | `form_login` + sesión | `express-session` + bcrypt |
| Sesiones | Fichero/DB de Symfony | `express-session` con store TypeORM |
| Formularios | Symfony Forms | HTML + validación manual + CSRF |
| Subidas | `move()` de Symfony | Multer + `sharp` (thumbnails) |
| Correo | SwiftMailer | `nodemailer` |

## Requisitos

- Node.js 20 o superior.
- MySQL/MariaDB con un usuario con permisos sobre la base de datos.

## Puesta en marcha

1. Copiar la configuración y ajustar las credenciales de MySQL:

   ```bash
   cp .env.example .env
   ```

   No hace falta crear la base de datos a mano en desarrollo: al arrancar se
   crea `nestjs_blog` si no existe (`DB_AUTO_CREATE=true`). Si preferís crearla
   vosotros:

   ```bash
   mysql -uroot -p -e "CREATE DATABASE nestjs_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. Instalar dependencias y arrancar:

   ```bash
   npm install
   npm run start:dev
   ```

3. Abrir <http://localhost:3000>.

Las tablas se crean automáticamente con TypeORM (`synchronize: true`) y, si la
base de datos está vacía, se cargan datos de ejemplo (`SEED_DB=true`).

### Usuarios de ejemplo

| Email | Contraseña | Rol |
| --- | --- | --- |
| `admin@blog.com` | `admin123` | `ROLE_ADMIN` |
| `demo@blog.com` | `demo123` | `ROLE_USER` |

Los usuarios nuevos se crean desde `/register` y solo el administrador puede
entrar en `/admin/*`.

## Funcionalidades

### Blog público

- Portada con categorías y galería de imágenes.
- Listado paginado, búsqueda y filtrado por categoría.
- Detalle de post con etiquetas, contador de visitas y posts recientes.
- Comentarios con aprobación previa (moderación).
- "Me gusta" con un voto por usuario/sesión.
- Formulario de contacto.

### Cuentas de usuario

- Registro con auto-login y verificación de correo.
- Login/logout, recuperación y cambio de contraseña.
- Perfil editable (nombre, email, biografía) y reenvío de verificación.

### Administración (`ROLE_ADMIN`)

- Dashboard con resumen.
- CRUD de posts: crear, editar, borrar, borrador/publicado, categoría y tags.
- CRUD de categorías.
- Gestión de imágenes: subida simple y múltiple, edición de metadatos,
  borrado y generación automática de thumbnails.
- Moderación de comentarios: aprobar, desaprobar y eliminar.
- Bandeja de mensajes de contacto.

### SEO y seguridad

- `rss.xml`, `sitemap.xml` y `robots.txt`.
- Open Graph y Twitter Cards en los posts.
- Slugs únicos autogenerados.
- `helmet`, rate limiting en login/registro/formularios y validación de `.env`.
- CSRF en todos los formularios, contraseñas con bcrypt y sesiones en MySQL.
- Páginas de error 404, 429 y 500.

## Rutas

| Ruta | Método | Descripción |
| --- | --- | --- |
| `/` | GET | Portada con categorías y galería |
| `/about` | GET | Página "About" |
| `/blog` | GET | Listado paginado (5 posts por página) |
| `/blog/:page` | GET | Página concreta del blog |
| `/blog/buscar?searchTerm=` | GET | Busca posts por contenido |
| `/blog/categoria/:slug` | GET | Posts de una categoría |
| `/blog/new` | GET/POST | Crear post (requiere sesión) |
| `/single_post/:slug` | GET | Detalle de un post |
| `/single_post/:slug/comment` | POST | Añadir comentario |
| `/single_post/:slug/like` | GET/POST | Dar "me gusta" (JSON en POST) |
| `/contact` | GET/POST | Formulario de contacto |
| `/thankyou` | GET | Confirmación de contacto |
| `/login` | GET/POST | Inicio de sesión |
| `/logout` | GET | Cerrar sesión |
| `/register` | GET/POST | Registro con auto-login |
| `/forgot-password` | GET/POST | Solicitar recuperación de contraseña |
| `/reset-password/:token` | GET/POST | Cambiar contraseña con token |
| `/verify-email/:token` | GET | Verificar correo |
| `/profile` | GET/POST | Ver/editar perfil |
| `/profile/password` | POST | Cambiar contraseña |
| `/profile/resend-verification` | POST | Reenviar verificación |
| `/admin` | GET | Dashboard (`ROLE_ADMIN`) |
| `/admin/posts` | GET | Listado de posts |
| `/admin/posts/:id/edit` | GET/POST | Editar post |
| `/admin/posts/:id/delete` | POST | Borrar post |
| `/admin/categories` | GET/POST | Listar/crear categorías |
| `/admin/categories/:id` | POST | Editar categoría |
| `/admin/categories/:id/delete` | POST | Borrar categoría |
| `/admin/images` | GET/POST | Listar/subir imágenes |
| `/admin/images/bulk` | POST | Subida múltiple |
| `/admin/images/:id` | POST | Editar metadatos |
| `/admin/images/:id/delete` | POST | Borrar imagen |
| `/admin/comments` | GET | Moderación de comentarios |
| `/admin/comments/:id` | POST | Aprobar/desaprobar comentario |
| `/admin/comments/:id/delete` | POST | Borrar comentario |
| `/admin/messages` | GET | Mensajes de contacto |
| `/admin/messages/:id/delete` | POST | Borrar mensaje |
| `/rss.xml` | GET | Feed RSS |
| `/sitemap.xml` | GET | Sitemap |
| `/robots.txt` | GET | Robots |

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto HTTP (por defecto `3000`) |
| `NODE_ENV` | `development` o `production` |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Conexión MySQL |
| `DB_AUTO_CREATE` | Crea la base de datos al arrancar si no existe (por defecto activo en desarrollo, desactivado en producción) |
| `SESSION_SECRET` | Secreto de sesión (obligatorio y de 32+ caracteres en producción) |
| `SEED_DB` | Carga datos de ejemplo si la base está vacía |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | SMTP para verificación y recuperación (sin SMTP los correos se escriben en el log) |

## Estructura

```text
src/
  admin/          Controlador y servicio de administración
  auth/           Login, registro, recuperación y verificación
  blog/           Posts, comentarios, búsqueda, paginación y likes
  common/         CSRF, guards, sesiones, subidas, imágenes, slugs, rate limit, errores
  config/         Validación de variables de entorno
  contact/        Persistencia del formulario de contacto
  entities/       Entidades TypeORM
  pages/          Portada, about, contacto y thank you
  profile/        Perfil de usuario y cambio de contraseña
  seed/           Datos de ejemplo
  seo/            RSS, sitemap y robots
  users/          Servicio de usuarios
  types/          Ampliación de tipos de Express (sesión y usuario)
views/            Plantillas Nunjucks
public/           CSS, JS, fuentes e imágenes originales
```

## Notas de la migración

- Los formularios de Symfony se sustituyeron por HTML equivalente con
  validación en el controlador y mensajes de error junto a cada campo.
- Se mantiene protección CSRF: el token se guarda en la sesión y se incluye en
  todos los formularios (`_csrf`; en login también se acepta `_csrf_token`).
- Los archivos subidos se guardan en `public/images/blog` (posts) y en
  `public/images/index/gallery` + `portfolio` (administración de imágenes),
  igual que en el proyecto original.
- Las sesiones se guardan en la tabla `session` mediante un store TypeORM.
- `synchronize: true` sigue activo para desarrollo. En producción conviene
  sustituirlo por migraciones versionadas.
