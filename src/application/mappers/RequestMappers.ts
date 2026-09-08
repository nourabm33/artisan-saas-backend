import { Appointment } from '../../domain/entities/Appointment';
import { Client } from '../../domain/entities/Client';
import { Media } from '../../domain/entities/Media';
import { Quote } from '../../domain/entities/Quote';
import { ServiceRequest } from '../../domain/entities/ServiceRequest';
import { ServiceTemplate } from '../../domain/entities/ServiceTemplate';
import { WhatsAppMessage } from '../../domain/entities/WhatsAppMessage';
import {
  AppointmentDto,
  ClientDto,
  MediaDto,
  QuoteDto,
  RequestDto,
  ServiceTemplateDto,
  WhatsAppMessageDto,
} from '../dtos/RequestDtos';

export const toClientDto = (client: Client): ClientDto => ({
  id: client.id,
  name: client.name,
  phone: client.phone.toE164(),
  email: client.email?.get(),
});

export const toQuoteDto = (quote: Quote): QuoteDto => ({
  id: quote.id,
  requestId: quote.requestId,
  basePrice: quote.basePrice,
  laborHours: quote.laborHours,
  laborRate: quote.laborRate,
  subtotal: quote.subtotal,
  taxPercentage: quote.taxPercentage,
  taxAmount: quote.taxAmount,
  discount: quote.discount,
  total: quote.total,
  notes: quote.notes,
  status: quote.status,
  createdAt: quote.createdAt,
});

export const toRequestDto = (request: ServiceRequest): RequestDto => ({
  id: request.id,
  orgId: request.orgId,
  clientId: request.clientId,
  serviceTemplateId: request.serviceTemplateId,
  status: request.status,
  clientData: request.clientData,
  preferredDate: request.preferredDate,
  preferredTimeSlot: request.preferredTimeSlot,
  quoteId: request.quoteId,
  appointmentId: request.appointmentId,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
});

export const toServiceTemplateDto = (template: ServiceTemplate): ServiceTemplateDto => ({
  id: template.id,
  orgId: template.orgId,
  tradeType: template.tradeType,
  name: template.name,
  description: template.description,
  basePrice: template.basePrice,
  defaultLaborHours: template.defaultLaborHours,
  fields: template.fields,
  isActive: template.isActive,
});

export const toAppointmentDto = (appointment: Appointment): AppointmentDto => ({
  id: appointment.id,
  requestId: appointment.requestId,
  orgId: appointment.orgId,
  assignedTo: appointment.assignedTo,
  scheduledStart: appointment.scheduledStart,
  scheduledEnd: appointment.scheduledEnd,
  status: appointment.status,
  createdAt: appointment.createdAt,
  updatedAt: appointment.updatedAt,
});

export const toMediaDto = (media: Media): MediaDto => ({
  id: media.id,
  requestId: media.requestId,
  url: media.url,
  type: media.type,
  uploadedBy: media.uploadedBy,
  createdAt: media.createdAt,
});

export const toWhatsAppMessageDto = (message: WhatsAppMessage): WhatsAppMessageDto => ({
  id: message.id,
  direction: message.direction,
  body: message.body,
  createdAt: message.createdAt,
});
