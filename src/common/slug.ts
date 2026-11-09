/**
 * Genera un slug equivalente al AsciiSlugger de Symfony:
 * quita acentos, pasa a minúsculas y sustituye cualquier grupo de
 * caracteres no alfanuméricos por un guion.
 */
export function slugify(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
