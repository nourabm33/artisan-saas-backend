import { randomUUID } from 'crypto';
import { Phone } from '../value-objects/Phone';
import { Email } from '../value-objects/Email';

export type ClientMetadata = Record<string, unknown>;

export interface CreateClientProps {
  id?: string;
  orgId: string;
  phone: Phone;
  email?: Email;
  name: string;
  metadata?: ClientMetadata;
  lastRequestAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Client {
  readonly id: string;
  readonly orgId: string;
  readonly phone: Phone;
  readonly email?: Email;
  readonly name: string;
  readonly metadata?: ClientMetadata;
  readonly lastRequestAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: CreateClientProps) {
    this.id = props.id ?? randomUUID();
    this.orgId = props.orgId;
    this.phone = props.phone;
    this.email = props.email;
    this.name = props.name;
    this.metadata = props.metadata;
    this.lastRequestAt = props.lastRequestAt;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  static create(props: Omit<CreateClientProps, 'id' | 'createdAt' | 'updatedAt'>): Client {
    const now = new Date();
    return new Client({ ...props, id: randomUUID(), createdAt: now, updatedAt: now });
  }

  withLastRequestAt(date: Date): Client {
    return new Client({ ...this, lastRequestAt: date, updatedAt: new Date() });
  }
}
