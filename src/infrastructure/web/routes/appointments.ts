import { Router } from 'express';
import { AuthService } from '../../../application/services/AuthService';
import {
  listAppointmentsQuerySchema,
  rescheduleAppointmentSchema,
  updateAppointmentStatusSchema,
  uuidParamSchema,
} from '../../../application/dtos/RequestDtos';
import { AppointmentController } from '../controllers/AppointmentController';
import { authenticate } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { validateQuery, validateUuidParam } from '../middleware/validateParams';

export const createAppointmentsRouter = (
  controller: AppointmentController,
  authService: AuthService
): Router => {
  const router = Router();
  router.use(authenticate(authService));

  router.get('/', validateQuery(listAppointmentsQuerySchema), controller.list);
  router.get('/:id', validateUuidParam('id', uuidParamSchema), controller.get);
  router.patch(
    '/:id/status',
    validateUuidParam('id', uuidParamSchema),
    validateBody(updateAppointmentStatusSchema),
    controller.updateStatus
  );
  router.patch(
    '/:id/schedule',
    validateUuidParam('id', uuidParamSchema),
    validateBody(rescheduleAppointmentSchema),
    controller.reschedule
  );

  return router;
};
