import { Pool } from 'pg';
import { Client, ClientMetadata } from '../../../domain/entities/Client';
import { IClientRepository } from '../../../domain/repositories/IClientRepository';
import { Email } from '../../../domain/value-objects/Email';
import { Phone } from '../../../domain/value-objects/Phone';
import { ConflictError } from '../../../domain/errors/ConflictError';
import { isUniqueViolation } from '../pgErrors';

interface ClientRow {
  id: string;
  org_id: string;
  phone: string;
  email: string | null;
  name: string;
  metadata: ClientMetadata | null;
  last_request_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class ClientRepository implements IClientRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Client | null> {
    const result = await this.pool.query<ClientRow>('SELECT * FROM clients WHERE id = $1', [id]);
    return result.rows[0] ? ClientRepository.toEntity(result.rows[0]) : null;
  }

  async findByPhone(orgId: string, phone: Phone): Promise<Client | null> {
    const result = await this.pool.query<ClientRow>(
      'SELECT * FROM clients WHERE org_id = $1 AND phone = $2',
      [orgId, phone.toE164()]
    );
    return result.rows[0] ? ClientRepository.toEntity(result.rows[0]) : null;
  }

  async findByOrgId(orgId: string): Promise<Client[]> {
    const result = await this.pool.query<ClientRow>(
      'SELECT * FROM clients WHERE org_id = $1 ORDER BY created_at DESC',
      [orgId]
    );
    return result.rows.map(ClientRepository.toEntity);
  }

  async save(client: Client): Promise<Client> {
    const query = `
      INSERT INTO clients (id, org_id, phone, email, name, metadata, last_request_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    try {
      const result = await this.pool.query<ClientRow>(query, [
        client.id,
        client.orgId,
        client.phone.toE164(),
        client.email?.get() ?? null,
        client.name,
        client.metadata ? JSON.stringify(client.metadata) : null,
        client.lastRequestAt ?? null,
        client.createdAt,
        client.updatedAt,
      ]);
      return ClientRepository.toEntity(result.rows[0]);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('Client with this phone already exists');
      }
      throw err;
    }
  }

  async update(client: Client): Promise<Client> {
    const query = `
      UPDATE clients SET phone = $2, email = $3, name = $4, metadata = $5, last_request_at = $6, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query<ClientRow>(query, [
      client.id,
      client.phone.toE164(),
      client.email?.get() ?? null,
      client.name,
      client.metadata ? JSON.stringify(client.metadata) : null,
      client.lastRequestAt ?? null,
    ]);
    return ClientRepository.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM clients WHERE id = $1', [id]);
  }

  private static toEntity(row: ClientRow): Client {
    return new Client({
      id: row.id,
      orgId: row.org_id,
      phone: new Phone(row.phone),
      email: row.email ? new Email(row.email) : undefined,
      name: row.name,
      metadata: row.metadata ?? undefined,
      lastRequestAt: row.last_request_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
