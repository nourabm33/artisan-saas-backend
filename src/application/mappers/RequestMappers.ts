import { Client } from '../../domain/entities/Client';
import { Quote } from '../../domain/entities/Quote';
import { ServiceRequest } from '../../domain/entities/ServiceRequest';
import { ServiceTemplate } from '../../domain/entities/ServiceTemplate';
import { ClientDto, QuoteDto, RequestDto, ServiceTemplateDto } from '../dtos/RequestDtos';

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
