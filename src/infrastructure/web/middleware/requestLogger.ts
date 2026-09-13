import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Logger } from '../../logger';
import { getRequestId } from './requestId';

export const requestLogger =
  (logger: Logger): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      logger.info('http', {
        requestId: getRequestId(req),
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    });
    next();
  };
