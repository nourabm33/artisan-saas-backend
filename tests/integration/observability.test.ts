import request from 'supertest';
import { createApp, AppDependencies } from '@/infrastructure/web/app';
import { createLogger } from '@/infrastructure/logger';
import { createInMemoryRepositories, testConfig } from '../helpers/inMemoryRepositories';
import { IErrorReporter, ErrorContext } from '@/application/ports/IErrorReporter';

class SpyReporter implements IErrorReporter {
  captured: Array<{ error: unknown; context?: ErrorContext }> = [];
  captureException(error: unknown, context?: ErrorContext): void {
    this.captured.push({ error, context });
  }
  async flush(): Promise<void> {}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const buildApp = (overrides: Partial<AppDependencies> = {}) => {
  const repos = createInMemoryRepositories();
  return createApp({
    config: testConfig,
    logger: createLogger('error', 'test'),
    ...repos,
    health: { database: async () => true, redis: async () => true, release: '1.2.3' },
    ...overrides,
  });
};

const registerBody = {
  organizationName: 'Gommista Rossi',
  tradeType: 'gommista',
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario@rossi.it',
  phone: '+39 333 123 4567',
  password: 'SecurePassword123!',
  passwordConfirm: 'SecurePassword123!',
};

describe('request correlation', () => {
  it('mints a UUID X-Request-Id when none is supplied', async () => {
    const res = await request(buildApp()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('echoes a well-formed inbound X-Request-Id', async () => {
    const res = await request(buildApp())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'lb-abc.123_XYZ');
    expect(res.headers['x-request-id']).toBe('lb-abc.123_XYZ');
  });

  it('replaces a malformed inbound X-Request-Id', async () => {
    const res = await request(buildApp())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'bad id <script>');
    expect(res.headers['x-request-id']).toMatch(UUID);
  });
});

describe('health probes', () => {
  it('GET /health/live never depends on backing services', async () => {
    const app = buildApp({
      health: {
        database: async () => {
          throw new Error('down');
        },
        redis: async () => false,
      },
    });
    const live = await request(app).get('/api/v1/health/live');
    expect(live.status).toBe(200);
    expect(live.body.status).toBe('ok');

    const ready = await request(app).get('/api/v1/health/ready');
    expect(ready.status).toBe(503);
    expect(ready.body).toMatchObject({
      status: 'degraded',
      database: 'disconnected',
      redis: 'disconnected',
    });
  });

  it('GET /health/ready reports the release version', async () => {
    const res = await request(buildApp()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.2.3');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('rate limiting', () => {
  const tight = { windowMs: 60_000, max: 100, authMax: 2, publicMax: 3 };

  it('caps credential endpoints with a 429 and standard headers', async () => {
    const app = buildApp({ config: { ...testConfig, rateLimit: tight } });
    const login = { email: 'nobody@example.it', password: 'wrong-password-1!' };

    const first = await request(app).post('/api/v1/auth/login').send(login);
    expect(first.status).toBe(401);
    expect(first.headers['ratelimit']).toContain('limit=2');

    await request(app).post('/api/v1/auth/login').send(login);
    const third = await request(app).post('/api/v1/auth/login').send(login);
    expect(third.status).toBe(429);
    expect(third.body).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please retry later' },
    });
    expect(third.headers['retry-after']).toBeDefined();
  });

  it('applies the public cap to anonymous request submission', async () => {
    const app = buildApp({ config: { ...testConfig, rateLimit: tight } });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await request(app)
        .post('/api/v1/requests/public/00000000-0000-4000-8000-000000000000/submit')
        .send({});
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3).every((s) => s !== 429)).toBe(true);
    expect(statuses[3]).toBe(429);
  });

  it('never rate-limits health probes', async () => {
    const app = buildApp({ config: { ...testConfig, rateLimit: { ...tight, max: 1 } } });
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
    }
  });
});

describe('metrics', () => {
  it('exposes Prometheus metrics with normalised route labels', async () => {
    const app = buildApp({ config: { ...testConfig, metrics: { enabled: true } } });
    await request(app).get('/api/v1/health/live');
    await request(app).get('/api/v1/quotes/11111111-1111-4111-8111-111111111111');

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('artisan_http_requests_total');
    expect(res.text).toContain('route="/api/v1/health/live"');
    expect(res.text).toContain('route="/api/v1/quotes/:id"');
    expect(res.text).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(res.text).toContain('artisan_process_cpu_seconds_total');
  });

  it('requires a bearer token when METRICS_TOKEN is configured', async () => {
    const app = buildApp({
      config: { ...testConfig, metrics: { enabled: true, token: 'scrape-secret' } },
    });
    expect((await request(app).get('/metrics')).status).toBe(401);
    expect((await request(app).get('/metrics').set('Authorization', 'Bearer wrong')).status).toBe(
      401
    );
    expect(
      (await request(app).get('/metrics').set('Authorization', 'Bearer scrape-secret')).status
    ).toBe(200);
  });

  it('is absent when disabled', async () => {
    const res = await request(buildApp()).get('/metrics');
    expect(res.status).toBe(404);
  });
});

describe('error reporting', () => {
  it('sends unhandled errors to the reporter with request context and returns the requestId', async () => {
    const reporter = new SpyReporter();
    const repos = createInMemoryRepositories();
    repos.userRepository.findByEmail = async () => {
      throw new Error('boom');
    };
    const app = buildApp({ ...repos, errorReporter: reporter });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Request-Id', 'req-42')
      .send(registerBody);

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
      requestId: 'req-42',
    });
    expect(reporter.captured).toHaveLength(1);
    expect((reporter.captured[0].error as Error).message).toBe('boom');
    expect(reporter.captured[0].context).toMatchObject({
      requestId: 'req-42',
      method: 'POST',
      path: '/api/v1/auth/register',
    });
  });

  it('does not report handled domain/validation errors', async () => {
    const reporter = new SpyReporter();
    const app = buildApp({ errorReporter: reporter });
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(reporter.captured).toHaveLength(0);
  });
});
