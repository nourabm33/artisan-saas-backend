import request from 'supertest';
import { createApp } from '@/infrastructure/web/app';
import { createLogger } from '@/infrastructure/logger';
import {
  createInMemoryRepositories,
  InMemoryRepositories,
  testConfig,
} from '../helpers/inMemoryRepositories';

const registerBody = (email: string, organizationName: string) => ({
  organizationName,
  tradeType: 'gommista',
  firstName: 'Mario',
  lastName: 'Rossi',
  email,
  phone: '+39 333 123 4567',
  password: 'SecurePassword123!',
  passwordConfirm: 'SecurePassword123!',
});

describe('Phase 4 routes: quotes, WhatsApp, appointments, media', () => {
  let repos: InMemoryRepositories;
  let app: ReturnType<typeof createApp>;
  let token: string;
  let otherToken: string;
  let orgId: string;
  let requestId: string;
  let quoteId: string;

  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    app = createApp({
      config: testConfig,
      logger: createLogger('error', 'test'),
      ...repos,
      health: { database: async () => true, redis: async () => true },
    });

    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send(registerBody('mario@rossi.it', 'Gommista Rossi'));
    token = reg.body.tokens.accessToken;
    orgId = reg.body.user.orgId;

    const other = await request(app)
      .post('/api/v1/auth/register')
      .send(registerBody('anna@verdi.it', 'Gommista Verdi'));
    otherToken = other.body.tokens.accessToken;

    const tpl = await request(app)
      .post('/api/v1/service-templates')
      .set(auth())
      .send({ name: 'Cambio Gomme', basePrice: 45, defaultLaborHours: 1 });

    const submitted = await request(app)
      .post(`/api/v1/requests/public/${orgId}/submit`)
      .send({
        serviceTemplateId: tpl.body.service.id,
        clientPhone: '+39 333 987 6543',
        clientName: 'Luca Bianchi',
        formData: { carBrand: 'Fiat' },
        preferredTimeSlot: 'morning',
      });
    requestId = submitted.body.requestId;
    quoteId = submitted.body.quoteId;
  });

  describe('quotes', () => {
    it('GET /quotes/:id returns the quote and enforces org scope', async () => {
      const res = await request(app).get(`/api/v1/quotes/${quoteId}`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.quote).toMatchObject({ id: quoteId, status: 'draft', total: 91.5 });

      const foreign = await request(app).get(`/api/v1/quotes/${quoteId}`).set(auth(otherToken));
      expect(foreign.status).toBe(404);
    });

    it('PATCH /quotes/:id recalculates amounts', async () => {
      const res = await request(app)
        .patch(`/api/v1/quotes/${quoteId}`)
        .set(auth())
        .send({ laborHours: 2, discountPercentage: 10, notes: 'Pneumatici inclusi' });
      expect(res.status).toBe(200);
      expect(res.body.quote).toMatchObject({
        laborHours: 2,
        subtotal: 105,
        discount: 10.5,
        notes: 'Pneumatici inclusi',
      });

      const empty = await request(app).patch(`/api/v1/quotes/${quoteId}`).set(auth()).send({});
      expect(empty.status).toBe(400);
    });

    it('POST /quotes/:id/send delivers via the WhatsApp gateway and marks it sent', async () => {
      const res = await request(app).post(`/api/v1/quotes/${quoteId}/send`).set(auth());
      expect(res.status).toBe(200);
      expect(res.body.quote.status).toBe('sent');
      expect(res.body.message).toContain('Rispondi SI');
      expect(repos.whatsAppGateway.sent).toEqual([
        expect.objectContaining({ to: '+393339876543' }),
      ]);

      const detail = await request(app).get(`/api/v1/requests/${requestId}`).set(auth());
      expect(detail.body.request.messages).toHaveLength(1);
      expect(detail.body.request.quote.status).toBe('sent');
    });
  });

  describe('WhatsApp webhook', () => {
    const webhook = (Body: string, MessageSid: string) =>
      request(app)
        .post('/api/v1/whatsapp/webhook')
        .type('form')
        .send({ From: 'whatsapp:+393339876543', Body, MessageSid });

    it('accepts a quote on SI, books an appointment and answers with TwiML', async () => {
      await request(app).post(`/api/v1/quotes/${quoteId}/send`).set(auth());
      const res = await webhook('SI', 'SM100');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/xml/);
      expect(res.text).toContain('<Message>');
      expect(res.text).toContain('Appuntamento fissato');

      const detail = await request(app).get(`/api/v1/requests/${requestId}`).set(auth());
      expect(detail.body.request.status).toBe('accepted');
      expect(detail.body.request.quote.status).toBe('accepted');
      expect(detail.body.request.appointment).toMatchObject({ status: 'pending', orgId });
      expect(detail.body.request.appointmentId).toBe(detail.body.request.appointment.id);
      expect(detail.body.request.messages).toHaveLength(3);
    });

    it('rejects a quote on NO', async () => {
      await request(app).post(`/api/v1/quotes/${quoteId}/send`).set(auth());
      const res = await webhook('NO', 'SM101');
      expect(res.text).toContain('Preventivo rifiutato');

      const detail = await request(app).get(`/api/v1/requests/${requestId}`).set(auth());
      expect(detail.body.request.status).toBe('rejected');
      expect(detail.body.request.appointment).toBeNull();
    });

    it('returns an empty TwiML response for duplicates and 401 for bad signatures', async () => {
      await request(app).post(`/api/v1/quotes/${quoteId}/send`).set(auth());
      await webhook('SI', 'SM102');
      const dup = await webhook('SI', 'SM102');
      expect(dup.status).toBe(200);
      expect(dup.text).not.toContain('<Message>');

      repos.whatsAppGateway.acceptWebhooks = false;
      const rejected = await webhook('SI', 'SM103');
      expect(rejected.status).toBe(401);
    });

    it('validates the Twilio payload', async () => {
      const res = await request(app)
        .post('/api/v1/whatsapp/webhook')
        .type('form')
        .send({ Body: 'SI' });
      expect(res.status).toBe(400);
    });
  });

  describe('appointments', () => {
    let appointmentId: string;

    beforeEach(async () => {
      const res = await request(app)
        .patch(`/api/v1/quotes/${quoteId}/status`)
        .set(auth())
        .send({ status: 'accepted' });
      expect(res.status).toBe(200);
      const detail = await request(app).get(`/api/v1/requests/${requestId}`).set(auth());
      appointmentId = detail.body.request.appointment.id;
    });

    it('lists and filters appointments per organization', async () => {
      const res = await request(app).get('/api/v1/appointments').set(auth());
      expect(res.status).toBe(200);
      expect(res.body.appointments).toHaveLength(1);
      expect(res.body.appointments[0]).toMatchObject({ id: appointmentId, requestId });

      const filtered = await request(app).get('/api/v1/appointments?status=completed').set(auth());
      expect(filtered.body.appointments).toHaveLength(0);

      const foreign = await request(app).get('/api/v1/appointments').set(auth(otherToken));
      expect(foreign.body.appointments).toHaveLength(0);
      const foreignGet = await request(app)
        .get(`/api/v1/appointments/${appointmentId}`)
        .set(auth(otherToken));
      expect(foreignGet.status).toBe(404);
    });

    it('moves the appointment and the request through their lifecycles', async () => {
      const confirm = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/status`)
        .set(auth())
        .send({ status: 'confirmed' });
      expect(confirm.status).toBe(200);
      expect(confirm.body.appointment.status).toBe('confirmed');

      await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/status`)
        .set(auth())
        .send({ status: 'in_progress' });
      const done = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/status`)
        .set(auth())
        .send({ status: 'completed' });
      expect(done.body.appointment.status).toBe('completed');

      const detail = await request(app).get(`/api/v1/requests/${requestId}`).set(auth());
      expect(detail.body.request.status).toBe('completed');

      const invalid = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/status`)
        .set(auth())
        .send({ status: 'pending' });
      expect(invalid.status).toBe(400);
    });

    it('reschedules with validation', async () => {
      const res = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/schedule`)
        .set(auth())
        .send({
          scheduledStart: '2030-03-01T09:00:00.000Z',
          scheduledEnd: '2030-03-01T10:30:00.000Z',
        });
      expect(res.status).toBe(200);
      expect(res.body.appointment.scheduledStart).toBe('2030-03-01T09:00:00.000Z');

      const bad = await request(app)
        .patch(`/api/v1/appointments/${appointmentId}/schedule`)
        .set(auth())
        .send({
          scheduledStart: '2030-03-01T09:00:00.000Z',
          scheduledEnd: '2030-03-01T08:00:00.000Z',
        });
      expect(bad.status).toBe(400);
    });
  });

  describe('media', () => {
    it('uploads files publicly and as artisan, then deletes them', async () => {
      const pub = await request(app)
        .post(`/api/v1/requests/public/${orgId}/${requestId}/media`)
        .attach('files', Buffer.from('jpegdata'), { filename: 'a.jpg', contentType: 'image/jpeg' })
        .attach('files', Buffer.from('pdfdata'), {
          filename: 'b.pdf',
          contentType: 'application/pdf',
        });
      expect(pub.status).toBe(201);
      expect(pub.body.media).toHaveLength(2);
      expect(pub.body.media[0]).toMatchObject({ uploadedBy: 'client', type: 'image' });

      const own = await request(app)
        .post(`/api/v1/requests/${requestId}/media`)
        .set(auth())
        .attach('files', Buffer.from('png'), { filename: 'c.png', contentType: 'image/png' });
      expect(own.status).toBe(201);
      expect(own.body.media[0].uploadedBy).toBe('artisan');

      const detail = await request(app).get(`/api/v1/requests/${requestId}`).set(auth());
      expect(detail.body.request.media).toHaveLength(3);

      const del = await request(app)
        .delete(`/api/v1/requests/${requestId}/media/${own.body.media[0].id}`)
        .set(auth());
      expect(del.status).toBe(204);
      expect(repos.mediaStorage.files.size).toBe(2);
    });

    it('rejects unsupported types, missing files and foreign requests', async () => {
      const bad = await request(app)
        .post(`/api/v1/requests/${requestId}/media`)
        .set(auth())
        .attach('files', Buffer.from('exe'), {
          filename: 'x.exe',
          contentType: 'application/x-msdownload',
        });
      expect(bad.status).toBe(400);

      const none = await request(app).post(`/api/v1/requests/${requestId}/media`).set(auth());
      expect(none.status).toBe(400);

      const foreign = await request(app)
        .post(`/api/v1/requests/${requestId}/media`)
        .set(auth(otherToken))
        .attach('files', Buffer.from('jpg'), { filename: 'a.jpg', contentType: 'image/jpeg' });
      expect(foreign.status).toBe(404);
    });
  });
});
