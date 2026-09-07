import { DomainError } from './DomainError';

export type ValidationErrors = Record<string, string[]>;

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly errors: ValidationErrors;

  constructor(errors: ValidationErrors | string) {
    const normalized: ValidationErrors =
      typeof errors === 'string' ? { general: [errors] } : errors;
    super(typeof errors === 'string' ? errors : 'Validation failed');
    this.errors = normalized;
  }
}
