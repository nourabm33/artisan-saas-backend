import { DomainError } from './DomainError';

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;

  constructor(message: string = 'Unauthorized') {
    super(message);
  }
}
