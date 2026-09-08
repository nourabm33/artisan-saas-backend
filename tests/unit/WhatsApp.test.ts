import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks';
import { SubmitRequestUseCase } from '@/application/use-cases/requests/SubmitRequestUseCase';
import { SendQuoteUseCase } from '@/application/use-cases/quotes/SendQuoteUseCase';
import { HandleInboundWhatsAppUseCase } from '@/application/use-cases/whatsapp/HandleInboundWhatsAppUseCase';
import { QuoteCalculationService } from '@/application/services/QuoteCalculationService';
import { QuoteAcceptanceService } from '@/application/services/QuoteAcceptanceService';
import { AppointmentSchedulingService } from '@/application/services/AppointmentSchedulingService';
import { WhatsAppMessageComposer } from '@/application/services/WhatsAppMessageComposer';
import { TwilioWhatsAppGateway } from '@/infrastructure/whatsapp/TwilioWhatsAppGateway';
import { Organization } from '@/domain/entities/Organization';
import { Quote } from '@/domain/entities/Quote';
import { ServiceRequest } from '@/domain/entities/ServiceRequest';
import { User } from '@/domain/entities/User';
import { ServiceTemplate } from '@/domain/entities/ServiceTemplate';
import { Email } from '@/domain/value-objects/Email';
import { createInMemoryRepositories, InMemoryRepositories } from '../helpers/inMemoryRepositories';

describe('WhatsAppMessageComposer.parseReply', () => {
  const composer = new WhatsAppMessageComposer(new QuoteCalculationService());

  it.each(['SI', 'sì', ' Si! ', 'ok', 'Accetto', 'va bene', '1', 'Si, grazie'])(
    'treats %p as accept',
    (body) => expect(composer.parseReply(body)).toBe('accept')
  );

  it.each(['NO', 'no.', 'Rifiuto', 'annulla', '2', 'No grazie'])('treats %p as reject', (body) =>
    expect(composer.parseReply(body)).toBe('reject')
  );

  it.each(['forse', '', 'quanto costa?'])('treats %p as unknown', (body) =>
    expect(composer.parseReply(body)).toBe('unknown')
  );
});

describe('Quote sending and inbound WhatsApp flow', () => {
  let repos: InMemoryRepositories;
  let acceptance: QuoteAcceptanceService;
  let sendQuote: SendQuoteUseCase;
  let inbound: HandleInboundWhatsAppUseCase;
  let orgId: string;
  let requestId: string;
  let quoteId: string;

  const submit = async (
    r: InMemoryRepositories,
    org: Organization,
    template: ServiceTemplate,
    phone: string
  ) =>
    new SubmitRequestUseCase(r, new QuoteCalculationService()).execute({
      orgId: org.id,
      serviceTemplateId: template.id,
      clientPhone: phone,
      clientName: 'Luca Bianchi',
      formData: { carBrand: 'Fiat' },
      preferredTimeSlot: 'afternoon',
    });

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    const calc = new QuoteCalculationService();
    const composer = new WhatsAppMessageComposer(calc);
    acceptance = new QuoteAcceptanceService(repos, new AppointmentSchedulingService());
    sendQuote = new SendQuoteUseCase(repos, acceptance, composer, repos.whatsAppGateway);
    inbound = new HandleInboundWhatsAppUseCase(repos, acceptance, composer);

    const org = await repos.organizationRepository.save(
      Organization.create({ name: 'Gommista Demo', tradeType: 'gommista' })
    );
    orgId = org.id;
    await repos.userRepository.save(
      User.create({
        orgId: org.id,
        email: new Email('owner@demo.it'),
        passwordHash: 'x',
        firstName: 'Mario',
        lastName: 'Rossi',
        role: 'owner',
      })
    );
    const template = await repos.serviceTemplateRepository.save(
      ServiceTemplate.create({
        orgId: org.id,
        tradeType: 'gommista',
        name: 'Cambio Gomme',
        basePrice: 45,
        defaultLaborHours: 1,
      })
    );
    const result = await submit(repos, org, template, '+39 333 123 4567');
    requestId = result.requestId;
    quoteId = result.quoteId;
  });

  it('sends the quote on WhatsApp, records the message and marks it sent', async () => {
    const result = await sendQuote.execute(orgId, quoteId);

    expect(result.quote.status).toBe('sent');
    expect(result.providerMessageId).toBe('SM1');
    expect(repos.whatsAppGateway.sent).toHaveLength(1);
    expect(repos.whatsAppGateway.sent[0].to).toBe('+393331234567');
    expect(repos.whatsAppGateway.sent[0].body).toContain('Cambio Gomme');
    expect(repos.whatsAppGateway.sent[0].body).toContain('91.50€');
    expect(repos.whatsAppGateway.sent[0].body).toContain('Rispondi SI');

    const messages = await repos.whatsAppMessageRepository.findByRequestId(requestId);
    expect(messages).toHaveLength(1);
    expect(messages[0].direction).toBe('outbound');
  });

  it('does not change quote status when the gateway fails', async () => {
    repos.whatsAppGateway.failNext = true;
    await expect(sendQuote.execute(orgId, quoteId)).rejects.toThrow('twilio down');
    expect((await repos.quoteRepository.findById(quoteId))?.status).toBe('draft');
  });

  it('rejects sending a quote from another organization', async () => {
    await expect(sendQuote.execute('other-org', quoteId)).rejects.toThrow('not found');
  });

  it('accepts the quote on "SI", books an appointment and replies', async () => {
    await sendQuote.execute(orgId, quoteId);
    const result = await inbound.execute({
      from: 'whatsapp:+393331234567',
      body: 'Sì',
      providerMessageId: 'IN1',
    });

    expect(result.action).toBe('accepted');
    expect(result.reply).toContain('Appuntamento fissato');

    const quote = await repos.quoteRepository.findById(quoteId);
    const request = await repos.requestRepository.findById(requestId);
    const appointment = await repos.appointmentRepository.findByRequestId(requestId);
    expect(quote?.status).toBe('accepted');
    expect(request?.status).toBe('accepted');
    expect(appointment).not.toBeNull();
    expect(appointment?.status).toBe('pending');
    expect(new AppointmentSchedulingService().hourOf(appointment!.scheduledStart)).toBe(15);
    expect(request?.appointmentId).toBe(appointment?.id);

    const messages = await repos.whatsAppMessageRepository.findByRequestId(requestId);
    expect(messages.map((m) => m.direction)).toEqual(['outbound', 'inbound', 'outbound']);
  });

  it('rejects the quote on "NO" and cancels an existing appointment', async () => {
    await sendQuote.execute(orgId, quoteId);
    const quote = await repos.quoteRepository.findById(quoteId);
    const request = await repos.requestRepository.findById(requestId);
    await acceptance.accept(quote!, request!);
    const booked = await repos.appointmentRepository.findByRequestId(requestId);
    expect(booked?.isOpen).toBe(true);

    // Re-open decision so the client can still reply (simulates a re-sent quote).
    const sent = (await repos.quoteRepository.findById(quoteId))!;
    await repos.quoteRepository.update(new Quote({ ...sent, status: 'sent' }));
    const quoted = (await repos.requestRepository.findById(requestId))!;
    await repos.requestRepository.update(new ServiceRequest({ ...quoted, status: 'quoted' }));

    const result = await inbound.execute({
      from: '+393331234567',
      body: 'no',
      providerMessageId: 'IN2',
    });
    expect(result.action).toBe('rejected');
    expect((await repos.appointmentRepository.findById(booked!.id))?.status).toBe('cancelled');
    expect((await repos.requestRepository.findById(requestId))?.status).toBe('rejected');
  });

  it('ignores duplicate provider message ids', async () => {
    await sendQuote.execute(orgId, quoteId);
    await inbound.execute({ from: '+393331234567', body: 'SI', providerMessageId: 'DUP' });
    const again = await inbound.execute({
      from: '+393331234567',
      body: 'SI',
      providerMessageId: 'DUP',
    });
    expect(again.action).toBe('duplicate');
    expect(again.reply).toBeNull();
  });

  it('handles unknown senders and clients without a pending quote', async () => {
    const unknown = await inbound.execute({
      from: '+393339999999',
      body: 'SI',
      providerMessageId: 'U1',
    });
    expect(unknown.action).toBe('unknown_sender');

    // quote is still draft (not sent) -> nothing to answer
    const noPending = await inbound.execute({
      from: '+393331234567',
      body: 'SI',
      providerMessageId: 'U2',
    });
    expect(noPending.action).toBe('no_pending_quote');
    expect(noPending.reply).toContain('Non abbiamo trovato preventivi');
  });

  it('asks again when the reply is not understood', async () => {
    await sendQuote.execute(orgId, quoteId);
    const result = await inbound.execute({
      from: '+393331234567',
      body: 'quanto ci vuole?',
      providerMessageId: 'U3',
    });
    expect(result.action).toBe('unrecognized');
    expect((await repos.quoteRepository.findById(quoteId))?.status).toBe('sent');
  });
});

describe('TwilioWhatsAppGateway.verifyWebhook', () => {
  const authToken = 'test-auth-token';
  const gateway = new TwilioWhatsAppGateway({
    accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    authToken,
    whatsappFrom: 'whatsapp:+14155238886',
  });
  const url = 'https://example.com/api/v1/whatsapp/webhook';
  const params = { From: 'whatsapp:+393331234567', Body: 'SI', MessageSid: 'SM1' };

  it('accepts a correctly signed request and rejects tampering', () => {
    const signature = getExpectedTwilioSignature(authToken, url, params);
    expect(gateway.verifyWebhook(url, params, signature)).toBe(true);
    expect(gateway.verifyWebhook(url, { ...params, Body: 'NO' }, signature)).toBe(false);
    expect(gateway.verifyWebhook(url, params, undefined)).toBe(false);
  });
});
