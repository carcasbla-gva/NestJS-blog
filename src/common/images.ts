import { existsSync } from 'fs';
import { mkdir, rename } from 'fs/promises';
import { extname, join } from 'path';
import sharp from 'sharp';
import { GALLERY_IMAGE_DIR } from './paths';

/**
 * Reduce el tamaño de una imagen subida conservando su formato.
 * Si sharp falla, deja el archivo original intacto.
 */
export async function optimizeImage(filePath: string): Promise<void> {
  const extension = extname(filePath).toLowerCase();
  const temporary = `${filePath}.optimized`;

  try {
    const pipeline = sharp(filePath).rotate().resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (extension === '.png') {
      await pipeline.png({ compressionLevel: 8 }).toFile(temporary);
    } else {
      await pipeline.jpeg({ quality: 85, mozjpeg: true }).toFile(temporary);
    }

    await rename(temporary, filePath);
  } catch {
    // La imagen se conserva tal cual si no se puede procesar.
  }
}

/** Nombre del thumbnail asociado a un archivo de la galería. */
export function thumbnailName(file: string): string {
  const extension = extname(file);
  return `${file.slice(0, file.length - extension.length)}-thumb.jpg`;
}

/**
 * Genera un thumbnail junto a la imagen original de la galería.
 * Devuelve el nombre del thumbnail o null si no se pudo crear.
 */
export async function createThumbnail(file: string): Promise<string | null> {
  const source = join(GALLERY_IMAGE_DIR, file);
  if (!existsSync(source)) {
    return null;
  }

  const name = thumbnailName(file);
  try {
    await mkdir(GALLERY_IMAGE_DIR, { recursive: true });
    await sharp(source)
      .rotate()
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(join(GALLERY_IMAGE_DIR, name));
    return name;
  } catch {
    return null;
  }
}
