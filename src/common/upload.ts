import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { unlink } from 'fs/promises';
import { slugify } from './slug';

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

export function isAllowedImageMime(mimetype: string): boolean {
  return Boolean(ALLOWED_IMAGE_TYPES[mimetype]);
}

/**
 * Guarda la imagen con un nombre parecido al que generaba Symfony:
 * `<slug-del-nombre>-<identificador-unico>.<extension>`
 */
export function imageStorage(destination: string) {
  return diskStorage({
    destination,
    filename: (_req, file, callback) => {
      const originalWithoutExtension = file.originalname.replace(/\.[^.]+$/, '');
      const base = slugify(originalWithoutExtension) || 'imagen';
      const extension =
        ALLOWED_IMAGE_TYPES[file.mimetype] ||
        extname(file.originalname).replace('.', '') ||
        'jpg';
      const unique = `${Date.now().toString(16)}${randomBytes(4).toString('hex')}`;
      callback(null, `${base}-${unique}.${extension}`);
    },
  });
}

export async function removeUploadedFile(
  file?: Express.Multer.File,
): Promise<void> {
  if (!file?.path) {
    return;
  }
  await unlink(file.path).catch(() => undefined);
}
