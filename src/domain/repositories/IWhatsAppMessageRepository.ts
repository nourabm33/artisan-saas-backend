import { WhatsAppMessage } from '../entities/WhatsAppMessage';

export interface IWhatsAppMessageRepository {
  findByProviderMessageId(providerMessageId: string): Promise<WhatsAppMessage | null>;
  findByRequestId(requestId: string): Promise<WhatsAppMessage[]>;
  save(message: WhatsAppMessage): Promise<WhatsAppMessage>;
}
