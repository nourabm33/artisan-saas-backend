import * as Sentry from '@sentry/node';
import { ErrorContext, IErrorReporter } from '../../application/ports/IErrorReporter';

export interface SentryOptions {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate?: number;
}

export class SentryErrorReporter implements IErrorReporter {
  constructor(options: SentryOptions) {
    Sentry.init({
      dsn: options.dsn,
      environment: options.environment,
      release: options.release,
      tracesSampleRate: options.tracesSampleRate ?? 0.1,
      sendDefaultPii: false,
    });
  }

  captureException(error: unknown, context: ErrorContext = {}): void {
    const { requestId, userId, orgId, ...extra } = context;
    Sentry.withScope((scope) => {
      if (requestId) scope.setTag('request_id', requestId);
      if (orgId) scope.setTag('org_id', orgId);
      if (userId) scope.setUser({ id: userId });
      scope.setExtras(extra);
      Sentry.captureException(error);
    });
  }

  async flush(timeoutMs: number): Promise<void> {
    await Sentry.flush(timeoutMs);
  }
}
