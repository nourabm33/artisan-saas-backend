import { DomainError } from './DomainError';

/** An upstream provider (WhatsApp, storage) failed or is not configured. */
export class ExternalServiceError extends DomainError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;

  constructor(service: string, detail?: string) {
    super(detail ? `${service}: ${detail}` : `${service} unavailable`);
  }
}
