import { Request, RequestHandler, Response } from 'express';
import rateLimit, { Options, Store } from 'express-rate-limit';
import { RateLimitConfig } from '../../../config';

export type RateLimitStoreFactory = () => Store;

export interface RateLimiters {
  /** Applied to every /api route. */
  general: RequestHandler;
  /** Credential endpoints: login, register, refresh. */
  auth: RequestHandler;
  /** Unauthenticated public endpoints: public request submission, inbound webhooks. */
  public: RequestHandler;
}

const tooMany = (_req: Request, res: Response): void => {
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please retry later' },
  });
};

/**
 * Builds the three limiters. `storeFactory` is called once per limiter so each has
 * its own key space (needed for Redis-backed stores; the default memory store is per-instance).
 */
export const createRateLimiters = (
  config: RateLimitConfig,
  storeFactory?: RateLimitStoreFactory
): RateLimiters => {
  const build = (max: number, prefix: string): RequestHandler => {
    const options: Partial<Options> = {
      windowMs: config.windowMs,
      limit: max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: tooMany,
      skip: (req) => req.path === '/health' || req.path.startsWith('/health/'),
      keyGenerator: (req) => `${prefix}:${req.ip ?? 'unknown'}`,
    };
    if (storeFactory) options.store = storeFactory();
    return rateLimit(options);
  };

  return {
    general: build(config.max, 'gen'),
    auth: build(config.authMax, 'auth'),
    public: build(config.publicMax, 'pub'),
  };
};
