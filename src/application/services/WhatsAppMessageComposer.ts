import { Appointment } from '../../domain/entities/Appointment';
import { Client } from '../../domain/entities/Client';
import { Organization } from '../../domain/entities/Organization';
import { Quote } from '../../domain/entities/Quote';
import { ServiceTemplate } from '../../domain/entities/ServiceTemplate';
import { QuoteCalculationService } from './QuoteCalculationService';

export type ClientReply = 'accept' | 'reject' | 'unknown';

const ACCEPT_WORDS = new Set([
  'si',
  'sì',
  'yes',
  'ok',
  'okay',
  'accetto',
  'confermo',
  'va bene',
  '1',
]);
const REJECT_WORDS = new Set(['no', 'rifiuto', 'annulla', 'non accetto', '2']);

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Rome',
});

/** Italian-language WhatsApp copy and reply parsing. */
export class WhatsAppMessageComposer {
  constructor(private readonly quoteCalculation: QuoteCalculationService) {}

  quoteMessage(
    organization: Pick<Organization, 'name'>,
    client: Pick<Client, 'name'>,
    template: Pick<ServiceTemplate, 'name'>,
    quote: Quote
  ): string {
    const lines = [
      `Ciao ${client.name}, ecco il preventivo di ${organization.name} per "${template.name}":`,
      '',
      this.quoteCalculation.formatQuoteForDisplay(quote),
    ];
    if (quote.notes) {
      lines.push('', `Note: ${quote.notes}`);
    }
    lines.push('', 'Rispondi SI per accettare o NO per rifiutare.');
    return lines.join('\n');
  }

  acceptedMessage(organization: Pick<Organization, 'name'>, appointment: Appointment): string {
    return (
      `Grazie! Preventivo accettato. Appuntamento fissato per ${dateFormatter.format(appointment.scheduledStart)}. ` +
      `${organization.name} ti aspetta.`
    );
  }

  rejectedMessage(organization: Pick<Organization, 'name'>): string {
    return `Preventivo rifiutato. Grazie per averci contattato, ${organization.name} resta a disposizione.`;
  }

  noPendingQuoteMessage(): string {
    return 'Non abbiamo trovato preventivi in attesa di risposta per questo numero.';
  }

  unrecognizedReplyMessage(): string {
    return 'Non ho capito la risposta. Rispondi SI per accettare il preventivo o NO per rifiutarlo.';
  }

  parseReply(body: string): ClientReply {
    const normalized = body
      .trim()
      .toLowerCase()
      .replace(/[!.,;:]+$/g, '')
      .trim();
    if (ACCEPT_WORDS.has(normalized)) return 'accept';
    if (REJECT_WORDS.has(normalized)) return 'reject';
    const firstWord = (normalized.split(/\s+/)[0] ?? '').replace(/[!.,;:]+$/g, '');
    if (ACCEPT_WORDS.has(firstWord)) return 'accept';
    if (REJECT_WORDS.has(firstWord)) return 'reject';
    return 'unknown';
  }
}
