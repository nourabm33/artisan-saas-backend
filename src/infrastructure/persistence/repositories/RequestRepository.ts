import { Pool } from 'pg';
import {
  RequestClientData,
  RequestStatus,
  ServiceRequest,
} from '../../../domain/entities/ServiceRequest';
import {
  IRequestRepository,
  RequestFilters,
} from '../../../domain/repositories/IRequestRepository';

interface RequestRow {
  id: string;
  org_id: string;
  client_id: string;
  service_template_id: string;
  status: RequestStatus;
  client_data: RequestClientData;
  preferred_date: Date | null;
  preferred_time_slot: string | null;
  quote_id: string | null;
  appointment_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export class RequestRepository implements IRequestRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<ServiceRequest | null> {
    const result = await this.pool.query<RequestRow>('SELECT * FROM requests WHERE id = $1', [id]);
    return result.rows[0] ? RequestRepository.toEntity(result.rows[0]) : null;
  }

  async findByOrgId(orgId: string, filters: RequestFilters = {}): Promise<ServiceRequest[]> {
    const params: unknown[] = [orgId];
    let sql = 'SELECT * FROM requests WHERE org_id = $1';
    if (filters.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filters.clientId) {
      params.push(filters.clientId);
      sql += ` AND client_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at DESC';
    params.push(filters.limit ?? 50);
    sql += ` LIMIT $${params.length}`;
    params.push(filters.offset ?? 0);
    sql += ` OFFSET $${params.length}`;

    const result = await this.pool.query<RequestRow>(sql, params);
    return result.rows.map(RequestRepository.toEntity);
  }

  async findByClientId(clientId: string): Promise<ServiceRequest[]> {
    const result = await this.pool.query<RequestRow>(
      'SELECT * FROM requests WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );
    return result.rows.map(RequestRepository.toEntity);
  }

  async save(request: ServiceRequest): Promise<ServiceRequest> {
    const query = `
      INSERT INTO requests (id, org_id, client_id, service_template_id, status, client_data, preferred_date, preferred_time_slot, quote_id, appointment_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const result = await this.pool.query<RequestRow>(query, [
      request.id,
      request.orgId,
      request.clientId,
      request.serviceTemplateId,
      request.status,
      JSON.stringify(request.clientData),
      request.preferredDate ?? null,
      request.preferredTimeSlot ?? null,
      request.quoteId ?? null,
      request.appointmentId ?? null,
      request.createdAt,
      request.updatedAt,
    ]);
    return RequestRepository.toEntity(result.rows[0]);
  }

  async update(request: ServiceRequest): Promise<ServiceRequest> {
    const query = `
      UPDATE requests SET status = $2, client_data = $3, preferred_date = $4, preferred_time_slot = $5,
        quote_id = $6, appointment_id = $7, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query<RequestRow>(query, [
      request.id,
      request.status,
      JSON.stringify(request.clientData),
      request.preferredDate ?? null,
      request.preferredTimeSlot ?? null,
      request.quoteId ?? null,
      request.appointmentId ?? null,
    ]);
    return RequestRepository.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM requests WHERE id = $1', [id]);
  }

  private static toEntity(row: RequestRow): ServiceRequest {
    return new ServiceRequest({
      id: row.id,
      orgId: row.org_id,
      clientId: row.client_id,
      serviceTemplateId: row.service_template_id,
      status: row.status,
      clientData: row.client_data,
      preferredDate: row.preferred_date ?? undefined,
      preferredTimeSlot: row.preferred_time_slot ?? undefined,
      quoteId: row.quote_id ?? undefined,
      appointmentId: row.appointment_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
