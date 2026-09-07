import { Router } from 'express';
import { AuthService } from '../../../application/services/AuthService';
import {
  listRequestsQuerySchema,
  submitRequestSchema,
  updateQuoteStatusSchema,
  uuidParamSchema,
} from '../../../application/dtos/RequestDtos';
import { RequestController } from '../controllers/RequestController';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { validateQuery, validateUuidParam } from '../middleware/validateParams';

export const createRequestsRouter = (
  controller: RequestController,
  authService: AuthService
): Router => {
  const router = Router();

  // Public: client-facing form submission for a given organization.
  router.post(
    '/public/:orgId/submit',
    validateUuidParam('orgId', uuidParamSchema),
    validateBody(submitRequestSchema),
    controller.submit
  );

  router.get(
    '/',
    authenticate(authService),
    validateQuery(listRequestsQuerySchema),
    controller.list
  );
  router.get(
    '/:id',
    authenticate(authService),
    validateUuidParam('id', uuidParamSchema),
    controller.get
  );

  return router;
};

export const createQuotesRouter = (
  controller: RequestController,
  authService: AuthService
): Router => {
  const router = Router();

  router.patch(
    '/:id/status',
    authenticate(authService),
    requireRole('owner', 'admin'),
    validateUuidParam('id', uuidParamSchema),
    validateBody(updateQuoteStatusSchema),
    controller.updateQuoteStatus
  );

  return router;
};
