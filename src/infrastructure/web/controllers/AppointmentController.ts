import { Request, Response } from 'express';
import {
  ListAppointmentsQuery,
  RescheduleAppointmentBody,
  UpdateAppointmentStatusBody,
} from '../../../application/dtos/RequestDtos';
import {
  GetAppointmentUseCase,
  ListAppointmentsUseCase,
  RescheduleAppointmentUseCase,
  UpdateAppointmentStatusUseCase,
} from '../../../application/use-cases/appointments/AppointmentUseCases';
import { AuthenticatedRequest } from '../middleware/authenticate';

export class AppointmentController {
  constructor(
    private readonly listAppointmentsUseCase: ListAppointmentsUseCase,
    private readonly getAppointmentUseCase: GetAppointmentUseCase,
    private readonly updateAppointmentStatusUseCase: UpdateAppointmentStatusUseCase,
    private readonly rescheduleAppointmentUseCase: RescheduleAppointmentUseCase
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const query = req.query as unknown as ListAppointmentsQuery;
    const appointments = await this.listAppointmentsUseCase.execute(auth.orgId, query);
    res.status(200).json({ appointments, limit: query.limit, offset: query.offset });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const appointment = await this.getAppointmentUseCase.execute(auth.orgId, req.params.id);
    res.status(200).json({ appointment });
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const { status } = req.body as UpdateAppointmentStatusBody;
    const appointment = await this.updateAppointmentStatusUseCase.execute(
      auth.orgId,
      req.params.id,
      status
    );
    res.status(200).json({ appointment });
  };

  reschedule = async (req: Request, res: Response): Promise<void> => {
    const { auth } = req as AuthenticatedRequest;
    const appointment = await this.rescheduleAppointmentUseCase.execute(
      auth.orgId,
      req.params.id,
      req.body as RescheduleAppointmentBody
    );
    res.status(200).json({ appointment });
  };
}
