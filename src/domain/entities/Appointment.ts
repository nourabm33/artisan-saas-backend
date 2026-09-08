import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/ValidationError';

export const APPOINTMENT_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface CreateAppointmentProps {
  id?: string;
  requestId: string;
  orgId: string;
  assignedTo: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status?: AppointmentStatus;
  reminderSentAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  pending: ['confirmed', 'in_progress', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class Appointment {
  readonly id: string;
  readonly requestId: string;
  readonly orgId: string;
  readonly assignedTo: string;
  readonly scheduledStart: Date;
  readonly scheduledEnd: Date;
  readonly status: AppointmentStatus;
  readonly reminderSentAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CreateAppointmentProps) {
    if (props.scheduledEnd.getTime() <= props.scheduledStart.getTime()) {
      throw new ValidationError({ scheduledEnd: ['scheduledEnd must be after scheduledStart'] });
    }
    this.id = props.id ?? randomUUID();
    this.requestId = props.requestId;
    this.orgId = props.orgId;
    this.assignedTo = props.assignedTo;
    this.scheduledStart = props.scheduledStart;
    this.scheduledEnd = props.scheduledEnd;
    this.status = props.status ?? 'pending';
    this.reminderSentAt = props.reminderSentAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(
    props: Omit<CreateAppointmentProps, 'id' | 'createdAt' | 'updatedAt'>
  ): Appointment {
    const now = new Date();
    return new Appointment({ ...props, id: randomUUID(), createdAt: now, updatedAt: now });
  }

  get isOpen(): boolean {
    return this.status !== 'completed' && this.status !== 'cancelled';
  }

  canTransitionTo(status: AppointmentStatus): boolean {
    return TRANSITIONS[this.status].includes(status);
  }

  withStatus(status: AppointmentStatus): Appointment {
    if (!this.canTransitionTo(status)) {
      throw new ValidationError({
        status: [`Cannot transition appointment from ${this.status} to ${status}`],
      });
    }
    return new Appointment({ ...this, status, updatedAt: new Date() });
  }

  reschedule(scheduledStart: Date, scheduledEnd: Date, assignedTo = this.assignedTo): Appointment {
    if (!this.isOpen) {
      throw new ValidationError({ status: [`Cannot reschedule a ${this.status} appointment`] });
    }
    return new Appointment({
      ...this,
      scheduledStart,
      scheduledEnd,
      assignedTo,
      status: this.status === 'in_progress' ? 'in_progress' : 'pending',
      updatedAt: new Date(),
    });
  }
}
