import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { DomainError } from '../../../domain/errors/DomainError';
import { ValidationError } from '../../../domain/errors/ValidationError';
import { Logger } from '../../logger';

interface HttpErrorLike {
  status?: number;
  statusCode?: number;
  type?: string;
}

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export const createErrorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof DomainError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err instanceof ValidationError ? { details: err.errors } : {}),
        },
      });
      return;
    }

    const httpErr = err as HttpErrorLike;
    if (httpErr?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
      return;
    }
    if (httpErr?.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' } });
      return;
    }

    logger.error('Unhandled error', {
      method: req.method,
      path: req.path,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });

    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' },
    });
  };
