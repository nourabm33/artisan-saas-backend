import request from 'supertest';
import { createApp } from '@/infrastructure/web/app';
import { createLogger } from '@/infrastructure/logger';
import { createInMemoryRepositories, InMemoryRepositories } from '../helpers/inMemoryRepositories';

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

describe('Requests, quotes and service templates routes', () => {
  let repos: InMemoryRepositories;
  let app: ReturnType<typeof createApp>;
  let token: string;
  let orgId: string;
  let serviceId: string;

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    app = createApp({
      config: {
        corsOrigin: '*',
        jwtSecret: 'integration-test-secret',
        jwtAccessExpiry: '15m',
        jwtRefreshExpiry: '7d',
      },
      logger: createLogger('error', 'test'),
      ...repos,
      health: { database: async () => true, redis: async () => true },
    });

    const reg = await request(app).post('/api/v1/auth/register').send(registerBody);
    token = reg.body.tokens.accessToken;
    orgId = reg.body.user.orgId;

    const created = await request(app)
      .post('/api/v1/service-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cambio Gomme',
        description: 'Cambio completo',
        basePrice: 45,
        defaultLaborHours: 1,
      });
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({ tradeType: 'gommista', isActive: true });
    serviceId = created.body.service.id;
  });

  const submitBody = () => ({
    serviceTemplateId: serviceId,
    clientPhone: '+39 333 987 6543',
    clientName: 'Luca Bianchi',
    clientEmail: 'luca@example.com',
    formData: { carBrand: 'Fiat', carModel: '500', tireSize: '185/55/R15' },
    preferredTimeSlot: 'morning',
  });

  it('lists the public service catalogue of an organization', async () => {
    const res = await request(app).get(`/api/v1/service-templates/public/${orgId}`);
    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(1);
    expect(res.body.services[0]).toMatchObject({ name: 'Cambio Gomme', basePrice: 45 });

    const missing = await request(app).get(
      '/api/v1/service-templates/public/00000000-0000-4000-8000-000000000000'
    );
    expect(missing.status).toBe(404);
  });

  it('POST /api/v1/requests/public/:orgId/submit creates a request with an auto quote', async () => {
    const res = await request(app)
      .post(`/api/v1/requests/public/${orgId}/submit`)
      .send(submitBody());

    expect(res.status).toBe(201);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.quoteId).toBeDefined();
    expect(res.body.status).toBe('quoted');
    expect(res.body.totalPrice).toBe(91.5);
  });

  it('validates the public submission payload', async () => {
    const res = await request(app)
      .post(`/api/v1/requests/public/${orgId}/submit`)
      .send({ serviceTemplateId: 'not-a-uuid', clientName: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toHaveProperty('serviceTemplateId');
    expect(res.body.error.details).toHaveProperty('clientPhone');

    const badOrg = await request(app).post('/api/v1/requests/public/abc/submit').send(submitBody());
    expect(badOrg.status).toBe(400);
  });

  it('lets the artisan list and inspect requests, scoped to their org', async () => {
    const submitted = await request(app)
      .post(`/api/v1/requests/public/${orgId}/submit`)
      .send(submitBody());

    const list = await request(app)
      .get('/api/v1/requests?status=quoted')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.requests).toHaveLength(1);
    expect(list.body.requests[0].id).toBe(submitted.body.requestId);

    const detail = await request(app)
      .get(`/api/v1/requests/${submitted.body.requestId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.request.client).toMatchObject({
      name: 'Luca Bianchi',
      phone: '+393339876543',
    });
    expect(detail.body.request.quote).toMatchObject({ total: 91.5, status: 'draft' });

    const unauth = await request(app).get('/api/v1/requests');
    expect(unauth.status).toBe(401);

    const other = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...registerBody, email: 'other@org.it', organizationName: 'Other' });
    const foreign = await request(app)
      .get(`/api/v1/requests/${submitted.body.requestId}`)
      .set('Authorization', `Bearer ${other.body.tokens.accessToken}`);
    expect(foreign.status).toBe(404);
  });

  it('moves a quote through sent -> accepted and syncs the request', async () => {
    const submitted = await request(app)
      .post(`/api/v1/requests/public/${orgId}/submit`)
      .send(submitBody());
    const quoteId = submitted.body.quoteId;

    const sent = await request(app)
      .patch(`/api/v1/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'sent' });
    expect(sent.status).toBe(200);
    expect(sent.body.quote.status).toBe('sent');

    const accepted = await request(app)
      .patch(`/api/v1/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'accepted' });
    expect(accepted.status).toBe(200);

    const detail = await request(app)
      .get(`/api/v1/requests/${submitted.body.requestId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.request.status).toBe('accepted');

    const invalid = await request(app)
      .patch(`/api/v1/quotes/${quoteId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'bogus' });
    expect(invalid.status).toBe(400);
  });
});
