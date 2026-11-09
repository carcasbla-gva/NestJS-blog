import { join } from 'path';

/** Directorio raíz desde el que se arranca la aplicación. */
export const PROJECT_ROOT = process.cwd();

export const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
export const VIEWS_DIR = join(PROJECT_ROOT, 'views');

export const POSTS_IMAGE_DIR = join(PUBLIC_DIR, 'images', 'blog');
export const GALLERY_IMAGE_DIR = join(PUBLIC_DIR, 'images', 'index', 'gallery');
export const PORTFOLIO_IMAGE_DIR = join(
  PUBLIC_DIR,
  'images',
  'index',
  'portfolio',
);
