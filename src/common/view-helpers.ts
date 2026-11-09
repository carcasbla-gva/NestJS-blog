/** Equivalente al helper `asset()` de Twig. */
export function asset(path: string): string {
  return `/${String(path ?? '').replace(/^\/+/, '')}`;
}

/** Normaliza un valor de formulario a string. */
export function formString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Convierte checkboxes/valores del formulario a booleano. */
export function formBoolean(value: unknown): boolean {
  return value === true || value === '1' || value === 'true' || value === 'on';
}

/** Convierte "fotografía, viajes, luz" en un array limpio y sin duplicados. */
export function parseTags(value: unknown): string[] {
  const raw = formString(value);
  if (!raw) {
    return [];
  }
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 10);
}

/** Recorta texto plano para meta descriptions, RSS y resúmenes. */
export function excerpt(value: string, length = 160): string {
  const plain = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= length) {
    return plain;
  }
  return `${plain.slice(0, length - 1).trimEnd()}…`;
}

export function parseInteger(value: unknown, fallback: number): number {
  const raw = formString(value);
  if (raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export type PagerPage = {
  label: string;
  url?: string;
  active?: boolean;
  gap?: boolean;
};

export type Pager = {
  previousUrl?: string;
  nextUrl?: string;
  pages: PagerPage[];
  status: string;
};

/**
 * Construye los datos que consume `partials/pagination.njk`.
 * `mode` es "path" para /blog/2 o "query" para ?page=2.
 */
export function buildPager(
  basePath: string,
  page: number,
  totalPages: number,
  query: Record<string, string> = {},
  mode: 'path' | 'query' = 'path',
  windowSize = 2,
): Pager | null {
  if (totalPages <= 1) {
    return null;
  }

  const urlFor = (target: number): string => {
    if (mode === 'path') {
      return `${basePath}/${target}`;
    }
    const params = new URLSearchParams({ ...query, page: String(target) });
    return `${basePath}?${params.toString()}`;
  };

  const from = Math.max(1, page - windowSize);
  const to = Math.min(totalPages, page + windowSize);
  const pages: PagerPage[] = [];

  if (from > 1) {
    pages.push({ label: '1', url: urlFor(1) });
    if (from > 2) {
      pages.push({ label: '…', gap: true });
    }
  }

  for (let i = from; i <= to; i += 1) {
    pages.push({ label: String(i), url: urlFor(i), active: i === page });
  }

  if (to < totalPages) {
    if (to < totalPages - 1) {
      pages.push({ label: '…', gap: true });
    }
    pages.push({ label: String(totalPages), url: urlFor(totalPages) });
  }

  return {
    previousUrl: page > 1 ? urlFor(page - 1) : undefined,
    nextUrl: page < totalPages ? urlFor(page + 1) : undefined,
    pages,
    status: `Página ${page} de ${totalPages}`,
  };
}
