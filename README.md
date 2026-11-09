# NestJS Blog

Migración del proyecto **symfony-blog** a **NestJS**. Mantiene las mismas
páginas, el mismo diseño (Bootstrap, imágenes y CSS originales), la misma base
de datos MySQL y las mismas funcionalidades: blog con paginación y búsqueda,
comentarios, "me gusta", contacto, registro/login y administración de
categorías e imágenes.

## Stack

| Pieza | Symfony original | Versión NestJS |
| --- | --- | --- |
| Framework | Symfony 6.4 | NestJS 12 (Express 5) |
| Plantillas | Twig | Nunjucks (`views/`) |
| ORM | Doctrine | TypeORM 0.3 |
| Base de datos | MySQL | MySQL (`mysql2`) |
| Autenticación | `form_login` + sesión | `express-session` + bcrypt |
| Formularios | Symfony Forms | HTML + validación manual + CSRF |
| Subidas | `move()` de Symfony | Multer (`FileInterceptor`) |

## Requisitos

- Node.js 20 o superior.
- MySQL/MariaDB con un usuario con permisos sobre la base de datos.

En este equipo Node se instaló localmente en `~/.local/node` y se añadió
`~/.local/bin` al `PATH` en `~/.bashrc` / `~/.profile`.

## Puesta en marcha

1. Crear la base de datos:

   ```bash
   mysql -uroot -p -e "CREATE DATABASE nestjs_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. Copiar la configuración y ajustar las credenciales de MySQL:

   ```bash
   cp .env.example .env
   ```

3. Instalar dependencias y arrancar:

   ```bash
   npm install
   npm run start:dev
   ```

4. Abrir <http://localhost:3000>.

Las tablas se crean automáticamente con TypeORM (`synchronize: true`) y, si la
base de datos está vacía, se cargan datos de ejemplo (`SEED_DB=true`).

### Usuarios de ejemplo

| Email | Contraseña | Rol |
| --- | --- | --- |
| `admin@blog.com` | `admin123` | `ROLE_ADMIN` |
| `demo@blog.com` | `demo123` | `ROLE_USER` |

Los usuarios nuevos se crean desde `/register` y solo el administrador puede
entrar en `/admin/*`.

## Rutas

| Ruta | Método | Descripción |
| --- | --- | --- |
| `/` | GET | Portada con categorías y galería |
| `/about` | GET | Página "About" |
| `/blog` | GET | Listado paginado (5 posts por página) |
| `/blog/:page` | GET | Página concreta del blog |
| `/blog/buscar?searchTerm=` | GET | Busca posts por contenido |
| `/blog/new` | GET/POST | Crear post (requiere sesión) |
| `/single_post/:slug` | GET | Detalle de un post |
| `/single_post/:slug/comment` | POST | Añadir comentario |
| `/single_post/:slug/like` | GET/POST | Dar "me gusta" (respuesta JSON en POST) |
| `/contact` | GET/POST | Formulario de contacto |
| `/thankyou` | GET | Confirmación de contacto |
| `/login` | GET/POST | Inicio de sesión |
| `/logout` | GET | Cerrar sesión |
| `/register` | GET/POST | Registro con auto-login |
| `/admin/categories` | GET/POST | Listar/crear categorías (`ROLE_ADMIN`) |
| `/admin/images` | GET/POST | Listar/subir imágenes (`ROLE_ADMIN`) |

## Estructura

```text
src/
  admin/          Controlador y servicio de administración
  auth/           Login, registro y validación de contraseñas
  blog/           Posts, comentarios, búsqueda, paginación y likes
  common/         CSRF, guards, subida de archivos, fechas, slugs, helpers
  contact/        Persistencia del formulario de contacto
  entities/       Entidades TypeORM (user, post, comment, category, image, contact)
  pages/          Portada, about, contacto y thank you
  seed/           Datos de ejemplo
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
- `synchronize: true` y `MemoryStore` para sesiones son adecuados para
  desarrollo. En producción habría que usar migraciones y un almacén de
  sesiones persistente.
