import { loadConfig } from '@/config';

const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@db:5432/artisan',
  JWT_SECRET: 'a-very-long-production-secret-with-32-plus-chars',
  CORS_ORIGIN: 'https://app.example.it',
};

describe('loadConfig (production hardening)', () => {
  it('accepts a minimal production environment and applies observability defaults', () => {
    const config = loadConfig(base);
    expect(config.nodeEnv).toBe('production');
    expect(config.corsOrigin).toEqual(['https://app.example.it']);
    expect(config.rateLimit).toEqual({ windowMs: 60_000, max: 300, authMax: 20, publicMax: 30 });
    expect(config.metrics).toEqual({ enabled: true, token: undefined });
    expect(config.sentryDsn).toBeUndefined();
    expect(config.release).toBeUndefined();
  });

  it('rejects wildcard CORS in production', () => {
    expect(() => loadConfig({ ...base, CORS_ORIGIN: '*' })).toThrow(/CORS_ORIGIN/);
  });

  it('rejects the placeholder JWT secret in production', () => {
    expect(() =>
      loadConfig({ ...base, JWT_SECRET: 'your_super_secret_jwt_key_change_in_production' })
    ).toThrow(/JWT_SECRET/);
  });

  it('parses observability overrides', () => {
    const config = loadConfig({
      ...base,
      RATE_LIMIT_WINDOW_MS: '30000',
      RATE_LIMIT_MAX: '50',
      RATE_LIMIT_AUTH_MAX: '5',
      RATE_LIMIT_PUBLIC_MAX: '7',
      METRICS_ENABLED: 'false',
      METRICS_TOKEN: 'scrape',
      SENTRY_DSN: 'https://public@o1.ingest.sentry.io/1',
      APP_RELEASE: 'abc123',
    });
    expect(config.rateLimit).toEqual({ windowMs: 30_000, max: 50, authMax: 5, publicMax: 7 });
    expect(config.metrics).toEqual({ enabled: false, token: 'scrape' });
    expect(config.sentryDsn).toBe('https://public@o1.ingest.sentry.io/1');
    expect(config.release).toBe('abc123');
  });

  it('rejects a malformed Sentry DSN', () => {
    expect(() => loadConfig({ ...base, SENTRY_DSN: 'not a url' })).toThrow(/SENTRY_DSN/);
  });
});
