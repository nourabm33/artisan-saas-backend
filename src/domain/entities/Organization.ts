import { randomUUID } from 'crypto';

export type SubscriptionTier = 'starter' | 'pro' | 'enterprise';

export interface CreateOrganizationProps {
  id?: string;
  name: string;
  tradeType: string;
  countryCode?: string;
  subscriptionTier?: SubscriptionTier;
  stripeCustomerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Organization {
  readonly id: string;
  readonly name: string;
  readonly tradeType: string;
  readonly countryCode: string;
  readonly subscriptionTier: SubscriptionTier;
  readonly stripeCustomerId?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CreateOrganizationProps) {
    this.id = props.id ?? randomUUID();
    this.name = props.name;
    this.tradeType = props.tradeType;
    this.countryCode = props.countryCode ?? 'IT';
    this.subscriptionTier = props.subscriptionTier ?? 'starter';
    this.stripeCustomerId = props.stripeCustomerId;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(
    props: Omit<CreateOrganizationProps, 'id' | 'createdAt' | 'updatedAt'>
  ): Organization {
    const now = new Date();
    return new Organization({ ...props, id: randomUUID(), createdAt: now, updatedAt: now });
  }
}
