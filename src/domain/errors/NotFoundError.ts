import { DomainError } from './DomainError';

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`);
  }
}
