import { Pool } from 'pg';

export const GOMMISTA_TEMPLATES = [
  {
    name: 'Cambio Gomme',
    description: 'Cambio completo gomme',
    basePrice: 45.0,
    defaultLaborHours: 1.0,
    fields: { carBrand: 'text', carModel: 'text', tireSize: 'text' },
  },
  {
    name: 'Foratura',
    description: 'Riparazione foratura',
    basePrice: 15.0,
    defaultLaborHours: 0.5,
    fields: { carBrand: 'text', carModel: 'text', tireSize: 'text' },
  },
  {
    name: 'Convergenza',
    description: 'Convergenza e equilibratura',
    basePrice: 60.0,
    defaultLaborHours: 1.5,
    fields: { carBrand: 'text', carModel: 'text' },
  },
  {
    name: 'Bilanciamento',
    description: 'Bilanciamento gomme',
    basePrice: 30.0,
    defaultLaborHours: 0.5,
    fields: { carBrand: 'text', carModel: 'text' },
  },
] as const;

/** Idempotent: skips templates the organization already has (matched by name). */
export const seedGommistaTemplates = async (pool: Pool, orgId: string): Promise<number> => {
  let inserted = 0;
  for (const t of GOMMISTA_TEMPLATES) {
    const result = await pool.query(
      `INSERT INTO service_templates (org_id, trade_type, name, description, base_price, default_labor_hours, fields, is_active)
       SELECT $1::uuid, 'gommista', $2::varchar, $3::text, $4::numeric, $5::numeric, $6::jsonb, TRUE
       WHERE NOT EXISTS (SELECT 1 FROM service_templates WHERE org_id = $1::uuid AND name = $2::varchar)`,
      [orgId, t.name, t.description, t.basePrice, t.defaultLaborHours, JSON.stringify(t.fields)]
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
};
