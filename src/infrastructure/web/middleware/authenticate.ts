import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuthService, TokenPayload } from '../../../application/services/AuthService';
import { UnauthorizedError } from '../../../domain/errors/UnauthorizedError';
import { ForbiddenError } from '../../../domain/errors/ForbiddenError';

export interface AuthenticatedRequest extends Request {
  auth: TokenPayload;
}

export const authenticate =
  (authService: AuthService): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      next(new UnauthorizedError('Missing bearer token'));
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    const payload = authService.verifyToken(token, 'access');
    (req as AuthenticatedRequest).auth = payload;
    next();
  };

export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { auth } = req as AuthenticatedRequest;
    if (!auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(auth.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }
    next();
  };
