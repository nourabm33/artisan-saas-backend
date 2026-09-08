import { randomUUID } from 'crypto';
import { IWhatsAppGateway, WhatsAppSendResult } from '../../application/ports/IWhatsAppGateway';
import { Phone } from '../../domain/value-objects/Phone';
import { Logger } from '../logger';

/**
 * Development stand-in used when Twilio is not configured: messages are
 * written to the log and webhooks are accepted without signature checks.
 */
export class LoggingWhatsAppGateway implements IWhatsAppGateway {
  constructor(private readonly logger: Logger) {}

  async send(to: Phone, body: string): Promise<WhatsAppSendResult> {
    const providerMessageId = `local-${randomUUID()}`;
    this.logger.info('WhatsApp message (not sent: Twilio not configured)', {
      to: to.toE164(),
      body,
      providerMessageId,
    });
    return { providerMessageId };
  }

  verifyWebhook(): boolean {
    return true;
  }
}
