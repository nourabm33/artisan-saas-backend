import { Appointment, AppointmentStatus } from '../../../domain/entities/Appointment';
import { NotFoundError } from '../../../domain/errors/NotFoundError';
import { ValidationError } from '../../../domain/errors/ValidationError';
import {
  AppointmentFilters,
  IAppointmentRepository,
} from '../../../domain/repositories/IAppointmentRepository';
import { IRequestRepository } from '../../../domain/repositories/IRequestRepository';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { AppointmentDto, RescheduleAppointmentBody } from '../../dtos/RequestDtos';
import { toAppointmentDto } from '../../mappers/RequestMappers';

export interface AppointmentRepositories {
  appointmentRepository: IAppointmentRepository;
  requestRepository: IRequestRepository;
  userRepository: IUserRepository;
}

const loadScoped = async (
  repos: AppointmentRepositories,
  orgId: string,
  appointmentId: string
): Promise<Appointment> => {
  const appointment = await repos.appointmentRepository.findById(appointmentId);
  if (!appointment || appointment.orgId !== orgId) {
    throw new NotFoundError('Appointment', appointmentId);
  }
  return appointment;
};

export class ListAppointmentsUseCase {
  constructor(private readonly repos: AppointmentRepositories) {}

  async execute(orgId: string, filters: AppointmentFilters = {}): Promise<AppointmentDto[]> {
    const appointments = await this.repos.appointmentRepository.findByOrgId(orgId, filters);
    return appointments.map(toAppointmentDto);
  }
}

export class GetAppointmentUseCase {
  constructor(private readonly repos: AppointmentRepositories) {}

  async execute(orgId: string, appointmentId: string): Promise<AppointmentDto> {
    return toAppointmentDto(await loadScoped(this.repos, orgId, appointmentId));
  }
}

/** Appointment progress drives the request: in_progress -> request in_progress, completed -> request completed. */
export class UpdateAppointmentStatusUseCase {
  constructor(private readonly repos: AppointmentRepositories) {}

  async execute(
    orgId: string,
    appointmentId: string,
    status: AppointmentStatus
  ): Promise<AppointmentDto> {
    const appointment = await loadScoped(this.repos, orgId, appointmentId);
    const updated = await this.repos.appointmentRepository.update(appointment.withStatus(status));

    if (status === 'in_progress' || status === 'completed') {
      const request = await this.repos.requestRepository.findById(appointment.requestId);
      if (request && request.canTransitionTo(status)) {
        await this.repos.requestRepository.update(request.withStatus(status));
      }
    }
    return toAppointmentDto(updated);
  }
}

export class RescheduleAppointmentUseCase {
  constructor(private readonly repos: AppointmentRepositories) {}

  async execute(
    orgId: string,
    appointmentId: string,
    body: RescheduleAppointmentBody
  ): Promise<AppointmentDto> {
    const appointment = await loadScoped(this.repos, orgId, appointmentId);

    if (body.assignedTo) {
      const technician = await this.repos.userRepository.findById(body.assignedTo);
      if (!technician || technician.orgId !== orgId || !technician.isActive) {
        throw new ValidationError({ assignedTo: ['User not found in this organization'] });
      }
    }

    const updated = await this.repos.appointmentRepository.update(
      appointment.reschedule(body.scheduledStart, body.scheduledEnd, body.assignedTo)
    );
    return toAppointmentDto(updated);
  }
}
