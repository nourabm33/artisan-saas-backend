import Joi from 'joi';
import { QUOTE_STATUSES, QuoteStatus } from '../../domain/entities/Quote';
import { REQUEST_STATUSES, RequestStatus } from '../../domain/entities/ServiceRequest';
import { TRADE_TYPES } from './AuthDtos';

export interface SubmitRequestBody {
  serviceTemplateId: string;
  clientPhone: string;
  clientName: string;
  clientEmail?: string;
  formData: Record<string, unknown>;
  preferredDate?: Date;
  preferredTimeSlot?: string;
}

export interface SubmitRequestCommand extends SubmitRequestBody {
  orgId: string;
}

export interface ClientDto {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export interface QuoteDto {
  id: string;
  requestId: string;
  basePrice: number;
  laborHours: number;
  laborRate: number;
  subtotal: number;
  taxPercentage: number;
  taxAmount: number;
  discount: number;
  total: number;
  notes?: string;
  status: QuoteStatus;
  createdAt: Date;
}

export interface RequestDto {
  id: string;
  orgId: string;
  clientId: string;
  serviceTemplateId: string;
  status: RequestStatus;
  clientData: Record<string, unknown>;
  preferredDate?: Date;
  preferredTimeSlot?: string;
  quoteId?: string;
  appointmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestDetailDto extends RequestDto {
  client: ClientDto | null;
  quote: QuoteDto | null;
}

export interface SubmitRequestResult {
  requestId: string;
  quoteId: string;
  status: RequestStatus;
  totalPrice: number;
  quote: QuoteDto;
}

export interface ServiceTemplateDto {
  id: string;
  orgId: string;
  tradeType: string;
  name: string;
  description?: string;
  basePrice: number;
  defaultLaborHours: number;
  fields?: Record<string, unknown>;
  isActive: boolean;
}

export interface CreateServiceTemplateBody {
  name: string;
  description?: string;
  basePrice: number;
  defaultLaborHours?: number;
  fields?: Record<string, unknown>;
  tradeType?: string;
  isActive?: boolean;
}

export interface ListRequestsQuery {
  status?: RequestStatus;
  limit: number;
  offset: number;
}

export interface UpdateQuoteStatusBody {
  status: QuoteStatus;
}

export const submitRequestSchema = Joi.object<SubmitRequestBody>({
  serviceTemplateId: Joi.string().uuid().required(),
  clientPhone: Joi.string().trim().min(9).max(20).required(),
  clientName: Joi.string().trim().min(2).max(255).required(),
  clientEmail: Joi.string().trim().email().optional(),
  formData: Joi.object().unknown(true).default({}),
  preferredDate: Joi.date().iso().min('now').optional(),
  preferredTimeSlot: Joi.string().trim().max(50).optional(),
});

export const createServiceTemplateSchema = Joi.object<CreateServiceTemplateBody>({
  name: Joi.string().trim().min(2).max(255).required(),
  description: Joi.string().trim().max(2000).allow('').optional(),
  basePrice: Joi.number().min(0).precision(2).required(),
  defaultLaborHours: Joi.number().min(0).max(100).precision(2).optional(),
  fields: Joi.object().unknown(true).optional(),
  tradeType: Joi.string()
    .trim()
    .lowercase()
    .valid(...TRADE_TYPES)
    .optional(),
  isActive: Joi.boolean().optional(),
});

export const listRequestsQuerySchema = Joi.object<ListRequestsQuery>({
  status: Joi.string()
    .valid(...REQUEST_STATUSES)
    .optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

export const updateQuoteStatusSchema = Joi.object<UpdateQuoteStatusBody>({
  status: Joi.string()
    .valid(...QUOTE_STATUSES)
    .required(),
});

export const uuidParamSchema = Joi.string().uuid().required();
