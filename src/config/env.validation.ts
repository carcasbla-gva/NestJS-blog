/**
 * Validación mínima de variables de entorno al arrancar.
 * En desarrollo se permiten valores por defecto; en producción se exige
 * configuración explícita para no desplegar con secretos inseguros.
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const environment = String(config.NODE_ENV ?? 'development');

  if (environment !== 'production') {
    return config;
  }

  const required = [
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
    'SESSION_SECRET',
  ];

  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias en producción: ${missing.join(', ')}`,
    );
  }

  const secret = String(config.SESSION_SECRET);
  if (secret.length < 32 || secret.includes('cambia')) {
    throw new Error(
      'SESSION_SECRET debe tener al menos 32 caracteres y no ser el valor de ejemplo.',
    );
  }

  return config;
}
