import { Router } from 'express';
import { AuthService } from '../../../application/services/AuthService';
import {
  listRequestsQuerySchema,
  submitRequestSchema,
  uuidParamSchema,
} from '../../../application/dtos/RequestDtos';
import { MediaController } from '../controllers/MediaController';
import { RequestController } from '../controllers/RequestController';
import { authenticate } from '../middleware/authenticate';
import { uploadFiles } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { validateQuery, validateUuidParam } from '../middleware/validateParams';

export const createRequestsRouter = (
  controller: RequestController,
  mediaController: MediaController,
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
  // Public: client attaches photos right after submitting.
  router.post(
    '/public/:orgId/:requestId/media',
    validateUuidParam('orgId', uuidParamSchema),
    validateUuidParam('requestId', uuidParamSchema),
    uploadFiles,
    mediaController.uploadPublic
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
  router.post(
    '/:id/media',
    authenticate(authService),
    validateUuidParam('id', uuidParamSchema),
    uploadFiles,
    mediaController.upload
  );
  router.delete(
    '/:id/media/:mediaId',
    authenticate(authService),
    validateUuidParam('id', uuidParamSchema),
    validateUuidParam('mediaId', uuidParamSchema),
    mediaController.remove
  );

  return router;
};
