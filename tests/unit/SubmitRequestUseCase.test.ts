import { SubmitRequestUseCase } from '@/application/use-cases/requests/SubmitRequestUseCase';
import { UpdateQuoteStatusUseCase } from '@/application/use-cases/requests/UpdateQuoteStatusUseCase';
import { QuoteCalculationService } from '@/application/services/QuoteCalculationService';
import { QuoteAcceptanceService } from '@/application/services/QuoteAcceptanceService';
import { AppointmentSchedulingService } from '@/application/services/AppointmentSchedulingService';
import { Organization } from '@/domain/entities/Organization';
import { User } from '@/domain/entities/User';
import { ServiceTemplate } from '@/domain/entities/ServiceTemplate';
import { Email } from '@/domain/value-objects/Email';
import { NotFoundError } from '@/domain/errors/NotFoundError';
import { ValidationError } from '@/domain/errors/ValidationError';
import { createInMemoryRepositories, InMemoryRepositories } from '../helpers/inMemoryRepositories';

describe('SubmitRequestUseCase', () => {
  let repos: InMemoryRepositories;
  let useCase: SubmitRequestUseCase;
  let org: Organization;
  let owner: User;
  let template: ServiceTemplate;

  const command = () => ({
    orgId: org.id,
    serviceTemplateId: template.id,
    clientPhone: '+39 333 123 4567',
    clientName: 'Luca Bianchi',
    clientEmail: 'luca@example.com',
    formData: { carBrand: 'Fiat', carModel: '500', tireSize: '185/55/R15' },
  });

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    useCase = new SubmitRequestUseCase(repos, new QuoteCalculationService());

    org = await repos.organizationRepository.save(
      Organization.create({ name: 'Gommista Demo', tradeType: 'gommista' })
    );
    owner = await repos.userRepository.save(
      User.create({
        orgId: org.id,
        email: new Email('owner@demo.it'),
        passwordHash: 'x',
        firstName: 'Mario',
        lastName: 'Rossi',
        role: 'owner',
      })
    );
    template = await repos.serviceTemplateRepository.save(
      ServiceTemplate.create({
        orgId: org.id,
        tradeType: 'gommista',
        name: 'Cambio Gomme',
        basePrice: 45,
        defaultLaborHours: 1,
      })
    );
  });

  it('creates client, request and an auto-generated quote', async () => {
    const result = await useCase.execute(command());

    expect(result.status).toBe('quoted');
    expect(result.totalPrice).toBe(91.5);
    expect(result.quote).toMatchObject({ subtotal: 75, taxAmount: 16.5, status: 'draft' });

    const request = await repos.requestRepository.findById(result.requestId);
    expect(request?.status).toBe('quoted');
    expect(request?.quoteId).toBe(result.quoteId);
    expect(request?.clientData).toEqual({
      carBrand: 'Fiat',
      carModel: '500',
      tireSize: '185/55/R15',
    });

    const quote = await repos.quoteRepository.findById(result.quoteId);
    expect(quote?.createdBy).toBe(owner.id);

    const client = await repos.clientRepository.findById(request!.clientId);
    expect(client?.phone.toE164()).toBe('+393331234567');
    expect(client?.lastRequestAt).toBeDefined();
  });

  it('reuses an existing client matched by normalized phone', async () => {
    const first = await useCase.execute(command());
    const second = await useCase.execute({ ...command(), clientPhone: '333 123 4567' });

    const r1 = await repos.requestRepository.findById(first.requestId);
    const r2 = await repos.requestRepository.findById(second.requestId);
    expect(r1?.clientId).toBe(r2?.clientId);
    expect(repos.clientRepository.clients.size).toBe(1);
  });

  it('rejects unknown organization or template', async () => {
    await expect(useCase.execute({ ...command(), orgId: 'nope' })).rejects.toThrow(NotFoundError);
    await expect(useCase.execute({ ...command(), serviceTemplateId: 'missing' })).rejects.toThrow(
      NotFoundError
    );
  });

  it('rejects templates from another organization', async () => {
    const other = await repos.organizationRepository.save(
      Organization.create({ name: 'Other', tradeType: 'gommista' })
    );
    const foreign = await repos.serviceTemplateRepository.save(
      ServiceTemplate.create({ orgId: other.id, tradeType: 'gommista', name: 'X', basePrice: 1 })
    );
    await expect(useCase.execute({ ...command(), serviceTemplateId: foreign.id })).rejects.toThrow(
      NotFoundError
    );
  });

  it('rejects inactive templates and invalid phones', async () => {
    await repos.serviceTemplateRepository.update(
      new ServiceTemplate({ ...template, isActive: false })
    );
    await expect(useCase.execute(command())).rejects.toThrow(ValidationError);

    await repos.serviceTemplateRepository.update(template);
    await expect(useCase.execute({ ...command(), clientPhone: '123' })).rejects.toThrow(
      ValidationError
    );
  });

  it('rolls back the request when the quote cannot be saved', async () => {
    repos.quoteRepository.save = async () => {
      throw new Error('db down');
    };
    await expect(useCase.execute(command())).rejects.toThrow('db down');
    expect(repos.requestRepository.requests.size).toBe(0);
  });

  it('fails when the organization has no user to own the quote', async () => {
    await repos.userRepository.delete(owner.id);
    await expect(useCase.execute(command())).rejects.toThrow(NotFoundError);
  });

  describe('UpdateQuoteStatusUseCase', () => {
    it('propagates accepted/rejected to the request and enforces transitions', async () => {
      const { quoteId, requestId } = await useCase.execute(command());
      const update = new UpdateQuoteStatusUseCase(
        repos.quoteRepository,
        new QuoteAcceptanceService(repos, new AppointmentSchedulingService())
      );

      const sent = await update.execute(org.id, quoteId, 'sent');
      expect(sent.status).toBe('sent');
      expect((await repos.requestRepository.findById(requestId))?.status).toBe('quoted');

      const accepted = await update.execute(org.id, quoteId, 'accepted');
      expect(accepted.status).toBe('accepted');
      expect((await repos.requestRepository.findById(requestId))?.status).toBe('accepted');

      await expect(update.execute(org.id, quoteId, 'rejected')).rejects.toThrow(ValidationError);
      await expect(update.execute('other-org', quoteId, 'sent')).rejects.toThrow(NotFoundError);
    });
  });
});
