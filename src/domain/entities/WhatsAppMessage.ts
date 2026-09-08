import { randomUUID } from 'crypto';

export const MESSAGE_DIRECTIONS = ['outbound', 'inbound'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export interface CreateWhatsAppMessageProps {
  id?: string;
  orgId: string;
  clientId: string;
  requestId?: string;
  direction: MessageDirection;
  body: string;
  providerMessageId?: string;
  createdAt?: Date;
}

/** Audit log of WhatsApp traffic; providerMessageId de-duplicates webhook retries. */
export class WhatsAppMessage {
  readonly id: string;
  readonly orgId: string;
  readonly clientId: string;
  readonly requestId?: string;
  readonly direction: MessageDirection;
  readonly body: string;
  readonly providerMessageId?: string;
  readonly createdAt: Date;

  constructor(props: CreateWhatsAppMessageProps) {
    this.id = props.id ?? randomUUID();
    this.orgId = props.orgId;
    this.clientId = props.clientId;
    this.requestId = props.requestId;
    this.direction = props.direction;
    this.body = props.body;
    this.providerMessageId = props.providerMessageId;
    this.createdAt = props.createdAt ?? new Date();
  }

  static create(props: Omit<CreateWhatsAppMessageProps, 'id' | 'createdAt'>): WhatsAppMessage {
    return new WhatsAppMessage({ ...props, id: randomUUID(), createdAt: new Date() });
  }
}
