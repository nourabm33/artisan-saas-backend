import { Pool } from 'pg';
import { Appointment, AppointmentStatus } from '../../../domain/entities/Appointment';
import {
  AppointmentFilters,
  IAppointmentRepository,
} from '../../../domain/repositories/IAppointmentRepository';

interface AppointmentRow {
  id: string;
  request_id: string;
  org_id: string;
  assigned_to: string;
  scheduled_start: Date;
  scheduled_end: Date;
  status: AppointmentStatus;
  reminder_sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class AppointmentRepository implements IAppointmentRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Appointment | null> {
    const result = await this.pool.query<AppointmentRow>(
      'SELECT * FROM appointments WHERE id = $1',
      [id]
    );
    return result.rows[0] ? AppointmentRepository.toEntity(result.rows[0]) : null;
  }

  async findByRequestId(requestId: string): Promise<Appointment | null> {
    const result = await this.pool.query<AppointmentRow>(
      'SELECT * FROM appointments WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1',
      [requestId]
    );
    return result.rows[0] ? AppointmentRepository.toEntity(result.rows[0]) : null;
  }

  async findByOrgId(orgId: string, filters: AppointmentFilters = {}): Promise<Appointment[]> {
    const conditions = ['org_id = $1'];
    const params: unknown[] = [orgId];
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.assignedTo) {
      params.push(filters.assignedTo);
      conditions.push(`assigned_to = $${params.length}`);
    }
    if (filters.from) {
      params.push(filters.from);
      conditions.push(`scheduled_start >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      conditions.push(`scheduled_start < $${params.length}`);
    }
    params.push(filters.limit ?? 50, filters.offset ?? 0);
    const result = await this.pool.query<AppointmentRow>(
      `SELECT * FROM appointments WHERE ${conditions.join(' AND ')}
       ORDER BY scheduled_start ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows.map(AppointmentRepository.toEntity);
  }

  async save(appointment: Appointment): Promise<Appointment> {
    const result = await this.pool.query<AppointmentRow>(
      `INSERT INTO appointments (id, request_id, org_id, assigned_to, scheduled_start, scheduled_end, status, reminder_sent_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        appointment.id,
        appointment.requestId,
        appointment.orgId,
        appointment.assignedTo,
        appointment.scheduledStart,
        appointment.scheduledEnd,
        appointment.status,
        appointment.reminderSentAt ?? null,
        appointment.createdAt,
        appointment.updatedAt,
      ]
    );
    return AppointmentRepository.toEntity(result.rows[0]);
  }

  async update(appointment: Appointment): Promise<Appointment> {
    const result = await this.pool.query<AppointmentRow>(
      `UPDATE appointments SET assigned_to = $2, scheduled_start = $3, scheduled_end = $4, status = $5,
         reminder_sent_at = $6, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        appointment.id,
        appointment.assignedTo,
        appointment.scheduledStart,
        appointment.scheduledEnd,
        appointment.status,
        appointment.reminderSentAt ?? null,
      ]
    );
    return AppointmentRepository.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM appointments WHERE id = $1', [id]);
  }

  private static toEntity(row: AppointmentRow): Appointment {
    return new Appointment({
      id: row.id,
      requestId: row.request_id,
      orgId: row.org_id,
      assignedTo: row.assigned_to,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      status: row.status,
      reminderSentAt: row.reminder_sent_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
