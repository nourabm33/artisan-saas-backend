export interface ErrorContext {
  requestId?: string;
  method?: string;
  path?: string;
  userId?: string;
  orgId?: string;
  [key: string]: string | number | boolean | undefined;
}

/** Pluggable error tracking (Sentry in production, no-op in dev/test). */
export interface IErrorReporter {
  captureException(error: unknown, context?: ErrorContext): void;
  /** Flush pending events before process exit. Resolves once done or after `timeoutMs`. */
  flush(timeoutMs: number): Promise<void>;
}

export class NoopErrorReporter implements IErrorReporter {
  captureException(): void {}
  async flush(): Promise<void> {}
}
