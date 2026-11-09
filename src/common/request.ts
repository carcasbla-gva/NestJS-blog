import { Request } from 'express';

/** URL absoluta del sitio, respetando proxies (trust proxy). */
export function baseUrl(req: Request): string {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return `${forwardedProto ?? req.protocol}://${req.get('host')}`;
}
