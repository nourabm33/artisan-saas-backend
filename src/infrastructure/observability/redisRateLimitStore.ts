import { RedisStore } from 'rate-limit-redis';
import { RateLimitStoreFactory } from '../web/middleware/rateLimit';

interface RedisCommandClient {
  sendCommand(args: string[]): Promise<unknown>;
}

/**
 * Shares rate-limit counters across replicas through Redis. Each limiter gets its own
 * RedisStore instance (required by rate-limit-redis) but the same underlying client.
 */
export const createRedisRateLimitStore = (redis: RedisCommandClient): RateLimitStoreFactory => {
  return () =>
    new RedisStore({
      prefix: 'rl:',
      sendCommand: (...args: string[]) =>
        redis.sendCommand(args) as ReturnType<RedisStore['sendCommand']>,
    });
};
