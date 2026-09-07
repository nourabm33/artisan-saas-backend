import { DomainError } from './DomainError';

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;

  constructor(message: string = 'Forbidden') {
    super(message);
  }
}
