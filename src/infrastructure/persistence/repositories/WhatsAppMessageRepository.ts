import { Pool } from 'pg';
import { MessageDirection, WhatsAppMessage } from '../../../domain/entities/WhatsAppMessage';
import { IWhatsAppMessageRepository } from '../../../domain/repositories/IWhatsAppMessageRepository';

interface WhatsAppMessageRow {
  id: string;
  org_id: string;
  client_id: string;
  request_id: string | null;
  direction: MessageDirection;
  body: string;
  provider_message_id: string | null;
  created_at: Date;
}

export class WhatsAppMessageRepository implements IWhatsAppMessageRepository {
  constructor(private readonly pool: Pool) {}

  async findByProviderMessageId(providerMessageId: string): Promise<WhatsAppMessage | null> {
    const result = await this.pool.query<WhatsAppMessageRow>(
      'SELECT * FROM whatsapp_messages WHERE provider_message_id = $1',
      [providerMessageId]
    );
    return result.rows[0] ? WhatsAppMessageRepository.toEntity(result.rows[0]) : null;
  }

  async findByRequestId(requestId: string): Promise<WhatsAppMessage[]> {
    const result = await this.pool.query<WhatsAppMessageRow>(
      'SELECT * FROM whatsapp_messages WHERE request_id = $1 ORDER BY created_at ASC',
      [requestId]
    );
    return result.rows.map(WhatsAppMessageRepository.toEntity);
  }

  async save(message: WhatsAppMessage): Promise<WhatsAppMessage> {
    const result = await this.pool.query<WhatsAppMessageRow>(
      `INSERT INTO whatsapp_messages (id, org_id, client_id, request_id, direction, body, provider_message_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        message.id,
        message.orgId,
        message.clientId,
        message.requestId ?? null,
        message.direction,
        message.body,
        message.providerMessageId ?? null,
        message.createdAt,
      ]
    );
    return WhatsAppMessageRepository.toEntity(result.rows[0]);
  }

  private static toEntity(row: WhatsAppMessageRow): WhatsAppMessage {
    return new WhatsAppMessage({
      id: row.id,
      orgId: row.org_id,
      clientId: row.client_id,
      requestId: row.request_id ?? undefined,
      direction: row.direction,
      body: row.body,
      providerMessageId: row.provider_message_id ?? undefined,
      createdAt: row.created_at,
    });
  }
}
