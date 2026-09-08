import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/ValidationError';

export const REQUEST_STATUSES = [
  'submitted',
  'quoted',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestClientData = Record<string, unknown>;

export interface CreateServiceRequestProps {
  id?: string;
  orgId: string;
  clientId: string;
  serviceTemplateId: string;
  status?: RequestStatus;
  clientData: RequestClientData;
  preferredDate?: Date;
  preferredTimeSlot?: string;
  quoteId?: string;
  appointmentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  submitted: ['quoted', 'rejected'],
  quoted: ['accepted', 'rejected'],
  accepted: ['in_progress', 'rejected'],
  in_progress: ['completed'],
  completed: [],
  rejected: [],
};

/**
 * A client's request for a service. Named ServiceRequest to avoid clashing
 * with Express' Request type; persisted in the `requests` table.
 */
export class ServiceRequest {
  readonly id: string;
  readonly orgId: string;
  readonly clientId: string;
  readonly serviceTemplateId: string;
  readonly status: RequestStatus;
  readonly clientData: RequestClientData;
  readonly preferredDate?: Date;
  readonly preferredTimeSlot?: string;
  readonly quoteId?: string;
  readonly appointmentId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CreateServiceRequestProps) {
    this.id = props.id ?? randomUUID();
    this.orgId = props.orgId;
    this.clientId = props.clientId;
    this.serviceTemplateId = props.serviceTemplateId;
    this.status = props.status ?? 'submitted';
    this.clientData = props.clientData;
    this.preferredDate = props.preferredDate;
    this.preferredTimeSlot = props.preferredTimeSlot;
    this.quoteId = props.quoteId;
    this.appointmentId = props.appointmentId;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(
    props: Omit<CreateServiceRequestProps, 'id' | 'createdAt' | 'updatedAt'>
  ): ServiceRequest {
    const now = new Date();
    return new ServiceRequest({ ...props, id: randomUUID(), createdAt: now, updatedAt: now });
  }

  canTransitionTo(status: RequestStatus): boolean {
    return TRANSITIONS[this.status].includes(status);
  }

  withStatus(status: RequestStatus): ServiceRequest {
    if (!this.canTransitionTo(status)) {
      throw new ValidationError({
        status: [`Cannot transition request from ${this.status} to ${status}`],
      });
    }
    return new ServiceRequest({ ...this, status, updatedAt: new Date() });
  }

  withQuote(quoteId: string): ServiceRequest {
    return new ServiceRequest({ ...this.withStatus('quoted'), quoteId });
  }

  withAppointment(appointmentId: string): ServiceRequest {
    return new ServiceRequest({ ...this, appointmentId, updatedAt: new Date() });
  }
}
