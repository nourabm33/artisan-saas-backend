import { Client } from '../../../domain/entities/Client';
import { Quote } from '../../../domain/entities/Quote';
import { ServiceRequest } from '../../../domain/entities/ServiceRequest';
import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { ValidationError } from '../../../domain/errors/ValidationError';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { IOrganizationRepository } from '../../../domain/repositories/IOrganizationRepository';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';
import { IRequestRepository } from '../../../domain/repositories/IRequestRepository';
import { IServiceTemplateRepository } from '../../../domain/repositories/IServiceTemplateRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { Email } from '../../../domain/value-objects/Email';
import { Phone } from '../../../domain/value-objects/Phone';
import { SubmitRequestCommand, SubmitRequestResult } from '../../dtos/RequestDtos';
import { toQuoteDto } from '../../mappers/RequestMappers';
import { QuoteCalculationService } from '../../services/QuoteCalculationService';

export interface SubmitRequestRepositories {
  organizationRepository: IOrganizationRepository;
  userRepository: IUserRepository;
  serviceTemplateRepository: IServiceTemplateRepository;
  clientRepository: IClientRepository;
  requestRepository: IRequestRepository;
  quoteRepository: IQuoteRepository;
}

/**
 * Public entry point of the core workflow: a client submits a request for a
 * service template of an organization; a client record is upserted by phone,
 * the request is stored and a draft quote is generated immediately from the
 * template's base price and default labor hours.
 */
export class SubmitRequestUseCase {
  constructor(
    private readonly repos: SubmitRequestRepositories,
    private readonly quoteCalculation: QuoteCalculationService
  ) {}

  async execute(command: SubmitRequestCommand): Promise<SubmitRequestResult> {
    const organization = await this.repos.organizationRepository.findById(command.orgId);
    if (!organization) {
      throw new NotFoundError('Organization', command.orgId);
    }

    const template = await this.repos.serviceTemplateRepository.findById(command.serviceTemplateId);
    if (!template || template.orgId !== command.orgId) {
      throw new NotFoundError('ServiceTemplate', command.serviceTemplateId);
    }
    if (!template.isActive) {
      throw new ValidationError({ serviceTemplateId: ['Service is no longer available'] });
    }

    const owner = await this.findQuoteAuthor(command.orgId);

    const phone = new Phone(command.clientPhone);
    const email = command.clientEmail ? new Email(command.clientEmail) : undefined;
    const client = await this.findOrCreateClient(command, phone, email);

    const request = await this.repos.requestRepository.save(
      ServiceRequest.create({
        orgId: command.orgId,
        clientId: client.id,
        serviceTemplateId: template.id,
        clientData: command.formData ?? {},
        preferredDate: command.preferredDate,
        preferredTimeSlot: command.preferredTimeSlot,
      })
    );

    let quote: Quote;
    try {
      const breakdown = this.quoteCalculation.calculateQuote(template, template.defaultLaborHours);
      quote = await this.repos.quoteRepository.save(
        Quote.create({ requestId: request.id, ...breakdown, createdBy: owner })
      );
    } catch (err) {
      await this.repos.requestRepository.delete(request.id).catch(() => undefined);
      throw err;
    }

    const quoted = await this.repos.requestRepository.update(request.withQuote(quote.id));
    await this.repos.clientRepository.update(client.withLastRequestAt(quoted.createdAt));

    return {
      requestId: quoted.id,
      quoteId: quote.id,
      status: quoted.status,
      totalPrice: quote.total,
      quote: toQuoteDto(quote),
    };
  }

  private async findQuoteAuthor(orgId: string): Promise<string> {
    const users = await this.repos.userRepository.findByOrgId(orgId);
    const author = users.find((u) => u.role === 'owner' && u.isActive) ?? users[0];
    if (!author) {
      throw new NotFoundError('Organization owner', orgId);
    }
    return author.id;
  }

  private async findOrCreateClient(
    command: SubmitRequestCommand,
    phone: Phone,
    email: Email | undefined
  ): Promise<Client> {
    const existing = await this.repos.clientRepository.findByPhone(command.orgId, phone);
    if (existing) return existing;
    return this.repos.clientRepository.save(
      Client.create({ orgId: command.orgId, phone, email, name: command.clientName.trim() })
    );
  }
}
