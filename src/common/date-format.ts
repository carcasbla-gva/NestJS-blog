const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Implementa los formatos de fecha de Twig que usan las plantillas
 * del proyecto original (`d F`, `g:i A`, `h:i A`, etc.).
 */
export function formatDate(value: Date | string, format = 'd F Y'): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const hours = date.getHours();
  const hours12 = hours % 12 || 12;

  const replacements: Record<string, string> = {
    d: String(date.getDate()).padStart(2, '0'),
    j: String(date.getDate()),
    F: MONTHS[date.getMonth()],
    M: MONTHS[date.getMonth()].slice(0, 3),
    m: String(date.getMonth() + 1).padStart(2, '0'),
    n: String(date.getMonth() + 1),
    Y: String(date.getFullYear()),
    y: String(date.getFullYear()).slice(-2),
    g: String(hours12),
    h: String(hours12).padStart(2, '0'),
    G: String(hours),
    H: String(hours).padStart(2, '0'),
    i: String(date.getMinutes()).padStart(2, '0'),
    s: String(date.getSeconds()).padStart(2, '0'),
    A: hours < 12 ? 'AM' : 'PM',
    a: hours < 12 ? 'am' : 'pm',
  };

  return format.replace(/\\.|[a-zA-Z]/g, (token) => {
    if (token.startsWith('\\')) {
      return token.slice(1);
    }
    return replacements[token] ?? token;
  });
}
