import { Pool } from 'pg';
import { ServiceTemplate, ServiceTemplateFields } from '../../../domain/entities/ServiceTemplate';
import {
  IServiceTemplateRepository,
  ServiceTemplateFilters,
} from '../../../domain/repositories/IServiceTemplateRepository';

interface ServiceTemplateRow {
  id: string;
  org_id: string;
  trade_type: string;
  name: string;
  description: string | null;
  base_price: string;
  default_labor_hours: string | null;
  fields: ServiceTemplateFields | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class ServiceTemplateRepository implements IServiceTemplateRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<ServiceTemplate | null> {
    const result = await this.pool.query<ServiceTemplateRow>(
      'SELECT * FROM service_templates WHERE id = $1',
      [id]
    );
    return result.rows[0] ? ServiceTemplateRepository.toEntity(result.rows[0]) : null;
  }

  async findByOrgId(
    orgId: string,
    filters: ServiceTemplateFilters = {}
  ): Promise<ServiceTemplate[]> {
    const result = await this.pool.query<ServiceTemplateRow>(
      `SELECT * FROM service_templates WHERE org_id = $1 ${filters.activeOnly ? 'AND is_active = TRUE' : ''} ORDER BY name`,
      [orgId]
    );
    return result.rows.map(ServiceTemplateRepository.toEntity);
  }

  async findByTradeType(tradeType: string): Promise<ServiceTemplate[]> {
    const result = await this.pool.query<ServiceTemplateRow>(
      'SELECT * FROM service_templates WHERE trade_type = $1 AND is_active = TRUE ORDER BY name',
      [tradeType]
    );
    return result.rows.map(ServiceTemplateRepository.toEntity);
  }

  async save(template: ServiceTemplate): Promise<ServiceTemplate> {
    const query = `
      INSERT INTO service_templates (id, org_id, trade_type, name, description, base_price, default_labor_hours, fields, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await this.pool.query<ServiceTemplateRow>(query, [
      template.id,
      template.orgId,
      template.tradeType,
      template.name,
      template.description ?? null,
      template.basePrice,
      template.defaultLaborHours,
      template.fields ? JSON.stringify(template.fields) : null,
      template.isActive,
      template.createdAt,
      template.updatedAt,
    ]);
    return ServiceTemplateRepository.toEntity(result.rows[0]);
  }

  async update(template: ServiceTemplate): Promise<ServiceTemplate> {
    const query = `
      UPDATE service_templates SET trade_type = $2, name = $3, description = $4, base_price = $5,
        default_labor_hours = $6, fields = $7, is_active = $8, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query<ServiceTemplateRow>(query, [
      template.id,
      template.tradeType,
      template.name,
      template.description ?? null,
      template.basePrice,
      template.defaultLaborHours,
      template.fields ? JSON.stringify(template.fields) : null,
      template.isActive,
    ]);
    return ServiceTemplateRepository.toEntity(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM service_templates WHERE id = $1', [id]);
  }

  private static toEntity(row: ServiceTemplateRow): ServiceTemplate {
    return new ServiceTemplate({
      id: row.id,
      orgId: row.org_id,
      tradeType: row.trade_type,
      name: row.name,
      description: row.description ?? undefined,
      basePrice: Number(row.base_price),
      defaultLaborHours:
        row.default_labor_hours === null ? undefined : Number(row.default_labor_hours),
      fields: row.fields ?? undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
