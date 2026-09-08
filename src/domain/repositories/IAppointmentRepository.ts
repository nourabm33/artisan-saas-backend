import { Appointment, AppointmentStatus } from '../entities/Appointment';

export interface AppointmentFilters {
  status?: AppointmentStatus;
  assignedTo?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface IAppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  findByRequestId(requestId: string): Promise<Appointment | null>;
  findByOrgId(orgId: string, filters?: AppointmentFilters): Promise<Appointment[]>;
  save(appointment: Appointment): Promise<Appointment>;
  update(appointment: Appointment): Promise<Appointment>;
  delete(id: string): Promise<void>;
}
