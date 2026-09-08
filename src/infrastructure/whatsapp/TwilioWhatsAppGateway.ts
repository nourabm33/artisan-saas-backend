import twilio, { Twilio } from 'twilio';
import { IWhatsAppGateway, WhatsAppSendResult } from '../../application/ports/IWhatsAppGateway';
import { ExternalServiceError } from '../../domain/errors/ExternalServiceError';
import { Phone } from '../../domain/value-objects/Phone';
import { TwilioConfig } from '../../config';

export class TwilioWhatsAppGateway implements IWhatsAppGateway {
  private readonly client: Twilio;

  constructor(private readonly config: TwilioConfig) {
    this.client = twilio(config.accountSid, config.authToken);
  }

  async send(to: Phone, body: string): Promise<WhatsAppSendResult> {
    try {
      const message = await this.client.messages.create({
        from: this.config.whatsappFrom,
        to: `whatsapp:${to.toE164()}`,
        body,
      });
      return { providerMessageId: message.sid };
    } catch (err) {
      throw new ExternalServiceError('WhatsApp', err instanceof Error ? err.message : undefined);
    }
  }

  verifyWebhook(
    url: string,
    params: Record<string, string>,
    signature: string | undefined
  ): boolean {
    if (!signature) return false;
    return twilio.validateRequest(this.config.authToken, signature, url, params);
  }
}
