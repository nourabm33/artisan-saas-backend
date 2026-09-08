import { Phone } from '../../domain/value-objects/Phone';

export interface WhatsAppSendResult {
  providerMessageId: string;
}

/** Outbound WhatsApp channel + webhook authenticity check. */
export interface IWhatsAppGateway {
  send(to: Phone, body: string): Promise<WhatsAppSendResult>;
  /**
   * Validate an inbound webhook. `url` is the full public URL Twilio called,
   * `params` the parsed form body, `signature` the X-Twilio-Signature header.
   */
  verifyWebhook(
    url: string,
    params: Record<string, string>,
    signature: string | undefined
  ): boolean;
}
