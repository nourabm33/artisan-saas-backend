import { Router } from 'express';
import { AuthService } from '../../../application/services/AuthService';
import {
  createServiceTemplateSchema,
  uuidParamSchema,
} from '../../../application/dtos/RequestDtos';
import { ServiceTemplateController } from '../controllers/ServiceTemplateController';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { validateUuidParam } from '../middleware/validateParams';

export const createServiceTemplatesRouter = (
  controller: ServiceTemplateController,
  authService: AuthService
): Router => {
  const router = Router();

  router.get('/public/:orgId', validateUuidParam('orgId', uuidParamSchema), controller.listPublic);

  router.get('/', authenticate(authService), controller.list);
  router.post(
    '/',
    authenticate(authService),
    requireRole('owner', 'admin'),
    validateBody(createServiceTemplateSchema),
    controller.create
  );

  return router;
};
