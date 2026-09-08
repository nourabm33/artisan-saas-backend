import { Client } from '../../../domain/entities/Client';
import { Quote } from '../../../domain/entities/Quote';
import { ServiceRequest } from '../../../domain/entities/ServiceRequest';
import { WhatsAppMessage } from '../../../domain/entities/WhatsAppMessage';
import { Phone } from '../../../domain/value-objects/Phone';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { IOrganizationRepository } from '../../../domain/repositories/IOrganizationRepository';
import { IQuoteRepository } from '../../../domain/repositories/IQuoteRepository';
import { IRequestRepository } from '../../../domain/repositories/IRequestRepository';
import { IWhatsAppMessageRepository } from '../../../domain/repositories/IWhatsAppMessageRepository';
import { InboundWhatsAppMessage } from '../../dtos/RequestDtos';
import { QuoteAcceptanceService } from '../../services/QuoteAcceptanceService';
import { WhatsAppMessageComposer } from '../../services/WhatsAppMessageComposer';

export interface InboundWhatsAppRepositories {
  clientRepository: IClientRepository;
  organizationRepository: IOrganizationRepository;
  requestRepository: IRequestRepository;
  quoteRepository: IQuoteRepository;
  whatsAppMessageRepository: IWhatsAppMessageRepository;
}

export interface InboundWhatsAppResult {
  /** Text to send back to the client (returned to Twilio as TwiML). Null when nothing should be sent. */
  reply: string | null;
  action:
    'accepted' | 'rejected' | 'unrecognized' | 'no_pending_quote' | 'duplicate' | 'unknown_sender';
  requestId?: string;
}

interface PendingQuote {
  client: Client;
  request: ServiceRequest;
  quote: Quote;
}

/**
 * Handles a client's WhatsApp reply. The sender is matched to the most recent
 * quote that was *sent* to that phone number (across organizations); "SI"
 * accepts it (booking the appointment), "NO" rejects it.
 */
export class HandleInboundWhatsAppUseCase {
  constructor(
    private readonly repos: InboundWhatsAppRepositories,
    private readonly acceptance: QuoteAcceptanceService,
    private readonly composer: WhatsAppMessageComposer
  ) {}

  async execute(message: InboundWhatsAppMessage): Promise<InboundWhatsAppResult> {
    if (
      await this.repos.whatsAppMessageRepository.findByProviderMessageId(message.providerMessageId)
    ) {
      return { reply: null, action: 'duplicate' };
    }

    let phone: Phone;
    try {
      phone = new Phone(message.from.replace(/^whatsapp:/i, ''));
    } catch {
      return { reply: null, action: 'unknown_sender' };
    }

    const clients = await this.repos.clientRepository.findAllByPhone(phone);
    if (clients.length === 0) {
      return { reply: null, action: 'unknown_sender' };
    }

    const pending = await this.findPendingQuote(clients);
    const logClient = pending?.client ?? clients[0];
    await this.repos.whatsAppMessageRepository.save(
      WhatsAppMessage.create({
        orgId: logClient.orgId,
        clientId: logClient.id,
        requestId: pending?.request.id,
        direction: 'inbound',
        body: message.body,
        providerMessageId: message.providerMessageId,
      })
    );

    if (!pending) {
      return { reply: this.composer.noPendingQuoteMessage(), action: 'no_pending_quote' };
    }

    const organization = await this.repos.organizationRepository.findById(pending.request.orgId);
    const orgName = { name: organization?.name ?? 'Il tuo artigiano' };

    switch (this.composer.parseReply(message.body)) {
      case 'accept': {
        const { appointment } = await this.acceptance.accept(pending.quote, pending.request);
        const reply = appointment
          ? this.composer.acceptedMessage(orgName, appointment)
          : 'Grazie! Preventivo accettato.';
        await this.logOutbound(pending, reply);
        return { reply, action: 'accepted', requestId: pending.request.id };
      }
      case 'reject': {
        await this.acceptance.reject(pending.quote, pending.request);
        const reply = this.composer.rejectedMessage(orgName);
        await this.logOutbound(pending, reply);
        return { reply, action: 'rejected', requestId: pending.request.id };
      }
      default:
        return {
          reply: this.composer.unrecognizedReplyMessage(),
          action: 'unrecognized',
          requestId: pending.request.id,
        };
    }
  }

  private async findPendingQuote(clients: Client[]): Promise<PendingQuote | null> {
    const candidates: PendingQuote[] = [];
    for (const client of clients) {
      const requests = await this.repos.requestRepository.findByClientId(client.id);
      for (const request of requests) {
        if (request.status !== 'quoted') continue;
        const quote = await this.repos.quoteRepository.findByRequestId(request.id);
        if (quote?.status === 'sent') {
          candidates.push({ client, request, quote });
        }
      }
    }
    candidates.sort((a, b) => b.quote.updatedAt.getTime() - a.quote.updatedAt.getTime());
    return candidates[0] ?? null;
  }

  private async logOutbound(pending: PendingQuote, body: string): Promise<void> {
    await this.repos.whatsAppMessageRepository.save(
      WhatsAppMessage.create({
        orgId: pending.request.orgId,
        clientId: pending.client.id,
        requestId: pending.request.id,
        direction: 'outbound',
        body,
      })
    );
  }
}
