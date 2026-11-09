import { NextFunction, Request, RequestHandler, Response } from 'express';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
};

/**
 * Limitador de peticiones en memoria, suficiente para una instancia.
 * Para varias instancias habría que usar Redis.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${options.keyPrefix ?? req.path}:${req.ip}`;

    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, options.max - bucket.count)),
    );

    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      const message =
        options.message ??
        'Demasiadas peticiones. Espera unos minutos e inténtalo de nuevo.';

      if (req.accepts('html')) {
        res.status(429).render('errors/429', { message, retryAfter });
      } else {
        res.status(429).json({ statusCode: 429, message, retryAfter });
      }
      return;
    }

    next();
  };
}

/** Aplica un limitador solo a peticiones POST. */
export function onPost(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'POST') {
      next();
      return;
    }
    handler(req, res, next);
  };
}
