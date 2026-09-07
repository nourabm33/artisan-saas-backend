import request from 'supertest';
import { createApp } from '@/infrastructure/web/app';
import { createLogger } from '@/infrastructure/logger';
import {
  InMemoryOrganizationRepository,
  InMemoryUserRepository,
} from '../helpers/inMemoryRepositories';

const buildApp = (health = { database: true, redis: true }) =>
  createApp({
    config: {
      corsOrigin: '*',
      jwtSecret: 'integration-test-secret',
      jwtAccessExpiry: '15m',
      jwtRefreshExpiry: '7d',
    },
    logger: createLogger('error', 'test'),
    userRepository: new InMemoryUserRepository(),
    organizationRepository: new InMemoryOrganizationRepository(),
    health: {
      database: async () => health.database,
      redis: async () => health.redis,
    },
  });

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

describe('GET /api/v1/health', () => {
  it('reports ok when dependencies are up', async () => {
    const res = await request(buildApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected', redis: 'connected' });
  });

  it('reports degraded with 503 when a dependency is down', async () => {
    const res = await request(buildApp({ database: true, redis: false })).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', redis: 'disconnected' });
  });
});

describe('Auth routes', () => {
  it('registers, logs in, refreshes and fetches the current user', async () => {
    const app = buildApp();

    const reg = await request(app).post('/api/v1/auth/register').send(registerBody);
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ email: 'mario@rossi.it', role: 'owner' });
    expect(reg.body.user).not.toHaveProperty('passwordHash');

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'mario@rossi.it', password: 'SecurePassword123!' });
    expect(login.status).toBe(200);
    expect(login.body.tokens.accessToken).toEqual(expect.any(String));

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.tokens.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toEqual(expect.any(String));

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refresh.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('mario@rossi.it');
  });

  it('returns 400 with field details for invalid payloads', async () => {
    const res = await request(buildApp())
      .post('/api/v1/auth/register')
      .send({ ...registerBody, email: 'nope', passwordConfirm: 'other' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details.passwordConfirm).toEqual(['Passwords do not match']);
  });

  it('returns 409 on duplicate email', async () => {
    const app = buildApp();
    await request(app).post('/api/v1/auth/register').send(registerBody);
    const dup = await request(app).post('/api/v1/auth/register').send(registerBody);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
  });

  it('returns 401 for bad credentials and missing/invalid bearer tokens', async () => {
    const app = buildApp();
    await request(app).post('/api/v1/auth/register').send(registerBody);

    const bad = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'mario@rossi.it', password: 'wrong-password' });
    expect(bad.status).toBe(401);

    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer garbage')).status
    ).toBe(401);
  });

  it('returns 400 for malformed JSON and 404 for unknown routes', async () => {
    const app = buildApp();
    const badJson = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(badJson.status).toBe(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');

    const missing = await request(app).get('/api/v1/nope');
    expect(missing.status).toBe(404);
  });
});
