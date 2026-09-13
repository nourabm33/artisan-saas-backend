import { NextFunction, Request, RequestHandler, Response } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

export interface RequestWithId extends Request {
  id: string;
}

/** Reuses a well-formed inbound X-Request-Id (from a proxy/load balancer) or mints one. */
export const requestId: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const inbound = req.header(REQUEST_ID_HEADER);
  const id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  (req as RequestWithId).id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};

export const getRequestId = (req: Request): string | undefined => (req as RequestWithId).id;
