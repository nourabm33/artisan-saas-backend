import { WhatsAppMessage } from '../../../domain/entities/WhatsAppMessage';
import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { IOrganizationRepository } from '../../../domain/repositories/IOrganizationRepository';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';
import { IServiceTemplateRepository } from '../../../domain/repositories/IServiceTemplateRepository';
import { IWhatsAppMessageRepository } from '../../../domain/repositories/IWhatsAppMessageRepository';
import { SendQuoteResult } from '../../dtos/RequestDtos';
import { toQuoteDto } from '../../mappers/RequestMappers';
import { IWhatsAppGateway } from '../../ports/IWhatsAppGateway';
import { QuoteAcceptanceService } from '../../services/QuoteAcceptanceService';
import { WhatsAppMessageComposer } from '../../services/WhatsAppMessageComposer';

export interface SendQuoteRepositories {
  organizationRepository: IOrganizationRepository;
  clientRepository: IClientRepository;
  quoteRepository: IQuoteRepository;
  serviceTemplateRepository: IServiceTemplateRepository;
  whatsAppMessageRepository: IWhatsAppMessageRepository;
}

/** Sends the quote to the client on WhatsApp and marks it `sent`. Re-sending a sent quote is allowed. */
export class SendQuoteUseCase {
  constructor(
    private readonly repos: SendQuoteRepositories,
    private readonly acceptance: QuoteAcceptanceService,
    private readonly composer: WhatsAppMessageComposer,
    private readonly whatsapp: IWhatsAppGateway
  ) {}

  async execute(orgId: string, quoteId: string): Promise<SendQuoteResult> {
    const { quote, request } = await this.acceptance.load(orgId, quoteId);
    const [organization, client, template] = await Promise.all([
      this.repos.organizationRepository.findById(orgId),
      this.repos.clientRepository.findById(request.clientId),
      this.repos.serviceTemplateRepository.findById(request.serviceTemplateId),
    ]);
    if (!organization) throw new NotFoundError('Organization', orgId);
    if (!client) throw new NotFoundError('Client', request.clientId);
    if (!template) throw new NotFoundError('ServiceTemplate', request.serviceTemplateId);

    const body = this.composer.quoteMessage(organization, client, template, quote);
    const { providerMessageId } = await this.whatsapp.send(client.phone, body);

    await this.repos.whatsAppMessageRepository.save(
      WhatsAppMessage.create({
        orgId,
        clientId: client.id,
        requestId: request.id,
        direction: 'outbound',
        body,
        providerMessageId,
      })
    );

    const sent =
      quote.status === 'sent'
        ? quote
        : await this.repos.quoteRepository.update(quote.withStatus('sent'));

    return { quote: toQuoteDto(sent), message: body, providerMessageId };
  }
}
