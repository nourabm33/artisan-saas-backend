const UNIQUE_VIOLATION = '23505';

export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code?: unknown }).code === UNIQUE_VIOLATION;
