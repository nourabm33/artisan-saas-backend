import { Request, Response } from 'express';
import { IWhatsAppGateway } from '../../../application/ports/IWhatsAppGateway';
import { HandleInboundWhatsAppUseCase } from '../../../application/use-cases/whatsapp/HandleInboundWhatsAppUseCase';
import { UnauthorizedError } from '../../../domain/errors/UnauthorizedError';
import { Logger } from '../../logger';

interface TwilioInboundBody {
  From: string;
  Body: string;
  MessageSid: string;
}

const escapeXml = (text: string): string =>
  text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Twilio "A message comes in" webhook. Responds with TwiML so the reply is
 * delivered on the same conversation without a second API call.
 */
export class WhatsAppWebhookController {
  constructor(
    private readonly handleInbound: HandleInboundWhatsAppUseCase,
    private readonly gateway: IWhatsAppGateway,
    private readonly publicUrl: string,
    private readonly logger: Logger
  ) {}

  inbound = async (req: Request, res: Response): Promise<void> => {
    const params = Object.fromEntries(
      Object.entries(req.body as Record<string, unknown>).map(([k, v]) => [k, String(v)])
    );
    const url = `${this.publicUrl}${req.originalUrl}`;
    const signature = req.header('X-Twilio-Signature');
    if (!this.gateway.verifyWebhook(url, params, signature)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    const body = req.body as TwilioInboundBody;
    const result = await this.handleInbound.execute({
      from: body.From,
      body: body.Body,
      providerMessageId: body.MessageSid,
    });
    this.logger.info('WhatsApp inbound processed', {
      action: result.action,
      requestId: result.requestId,
    });

    const twiml = result.reply
      ? `<Response><Message>${escapeXml(result.reply)}</Message></Response>`
      : '<Response></Response>';
    res.status(200).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>${twiml}`);
  };
}
