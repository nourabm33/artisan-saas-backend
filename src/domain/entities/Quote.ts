import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/ValidationError';

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface CreateQuoteProps {
  id?: string;
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
  status?: QuoteStatus;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['sent', 'accepted', 'rejected'],
  sent: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};

/** Monetary breakdown is computed by QuoteCalculationService; Quote only stores it. */
export class Quote {
  readonly id: string;
  readonly requestId: string;
  readonly basePrice: number;
  readonly laborHours: number;
  readonly laborRate: number;
  readonly subtotal: number;
  readonly taxPercentage: number;
  readonly taxAmount: number;
  readonly discount: number;
  readonly total: number;
  readonly notes?: string;
  readonly status: QuoteStatus;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CreateQuoteProps) {
    this.id = props.id ?? randomUUID();
    this.requestId = props.requestId;
    this.basePrice = props.basePrice;
    this.laborHours = props.laborHours;
    this.laborRate = props.laborRate;
    this.subtotal = props.subtotal;
    this.taxPercentage = props.taxPercentage;
    this.taxAmount = props.taxAmount;
    this.discount = props.discount;
    this.total = props.total;
    this.notes = props.notes;
    this.status = props.status ?? 'draft';
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(props: Omit<CreateQuoteProps, 'id' | 'createdAt' | 'updatedAt'>): Quote {
    const now = new Date();
    return new Quote({ ...props, id: randomUUID(), createdAt: now, updatedAt: now });
  }

  withStatus(status: QuoteStatus): Quote {
    if (!TRANSITIONS[this.status].includes(status)) {
      throw new ValidationError({
        status: [`Cannot transition quote from ${this.status} to ${status}`],
      });
    }
    return new Quote({ ...this, status, updatedAt: new Date() });
  }
}
