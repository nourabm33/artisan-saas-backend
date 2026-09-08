import { Router } from 'express';
import { AuthService } from '../../../application/services/AuthService';
import {
  updateQuoteSchema,
  updateQuoteStatusSchema,
  uuidParamSchema,
} from '../../../application/dtos/RequestDtos';
import { QuoteController } from '../controllers/QuoteController';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { validateUuidParam } from '../middleware/validateParams';

export const createQuotesRouter = (
  controller: QuoteController,
  authService: AuthService
): Router => {
  const router = Router();
  const manage = [authenticate(authService), requireRole('owner', 'admin')];

  router.get(
    '/:id',
    authenticate(authService),
    validateUuidParam('id', uuidParamSchema),
    controller.get
  );
  router.patch(
    '/:id',
    ...manage,
    validateUuidParam('id', uuidParamSchema),
    validateBody(updateQuoteSchema),
    controller.update
  );
  router.patch(
    '/:id/status',
    ...manage,
    validateUuidParam('id', uuidParamSchema),
    validateBody(updateQuoteStatusSchema),
    controller.updateStatus
  );
  router.post('/:id/send', ...manage, validateUuidParam('id', uuidParamSchema), controller.send);

  return router;
};
