import { randomUUID } from 'crypto';
import { ValidationError } from '../errors/ValidationError';

export type ServiceTemplateFields = Record<string, unknown>;

export interface CreateServiceTemplateProps {
  id?: string;
  orgId: string;
  tradeType: string;
  name: string;
  description?: string;
  basePrice: number;
  defaultLaborHours?: number;
  fields?: ServiceTemplateFields;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ServiceTemplate {
  readonly id: string;
  readonly orgId: string;
  readonly tradeType: string;
  readonly name: string;
  readonly description?: string;
  readonly basePrice: number;
  readonly defaultLaborHours: number;
  readonly fields?: ServiceTemplateFields;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CreateServiceTemplateProps) {
    if (!Number.isFinite(props.basePrice) || props.basePrice < 0) {
      throw new ValidationError({ basePrice: ['Base price must be a non-negative number'] });
    }
    const laborHours = props.defaultLaborHours ?? 1;
    if (!Number.isFinite(laborHours) || laborHours < 0) {
      throw new ValidationError({
        defaultLaborHours: ['Labor hours must be a non-negative number'],
      });
    }
    this.id = props.id ?? randomUUID();
    this.orgId = props.orgId;
    this.tradeType = props.tradeType;
    this.name = props.name;
    this.description = props.description;
    this.basePrice = props.basePrice;
    this.defaultLaborHours = laborHours;
    this.fields = props.fields;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(
    props: Omit<CreateServiceTemplateProps, 'id' | 'createdAt' | 'updatedAt'>
  ): ServiceTemplate {
    const now = new Date();
    return new ServiceTemplate({ ...props, id: randomUUID(), createdAt: now, updatedAt: now });
  }
}
