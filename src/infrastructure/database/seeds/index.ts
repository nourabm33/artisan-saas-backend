import dotenv from 'dotenv';
import { Pool } from 'pg';
import { AuthService } from '../../../application/services/AuthService';
import { loadConfig } from '../../../config';

dotenv.config();

const seed = async (): Promise<void> => {
  const config = loadConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  const auth = new AuthService(config.jwtSecret, config.jwtAccessExpiry, config.jwtRefreshExpiry);

  try {
    const org = await pool.query(
      `INSERT INTO organizations (name, trade_type) VALUES ($1, $2) RETURNING id`,
      ['Gommista Demo', 'gommista']
    );
    const orgId: string = org.rows[0].id;

    await pool.query(
      `INSERT INTO users (org_id, email, phone, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, $6, 'owner')
       ON CONFLICT (email) DO NOTHING`,
      [
        orgId,
        'demo@gommista.it',
        '+393331234567',
        await auth.hashPassword('Password123!'),
        'Mario',
        'Rossi',
      ]
    );

    await pool.query(
      `INSERT INTO service_templates (org_id, trade_type, name, description, base_price, default_labor_hours)
       VALUES
         ($1, 'gommista', 'Cambio pneumatici', 'Sostituzione 4 pneumatici', 40.00, 1.0),
         ($1, 'gommista', 'Equilibratura', 'Equilibratura ruote', 25.00, 0.5),
         ($1, 'gommista', 'Riparazione foratura', 'Riparazione pneumatico forato', 15.00, 0.5)`,
      [orgId]
    );

    process.stdout.write(`Seeded org ${orgId} (demo@gommista.it / Password123!)\n`);
  } finally {
    await pool.end();
  }
};

seed().catch((err) => {
  process.stderr.write(`Seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
