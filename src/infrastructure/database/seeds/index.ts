import dotenv from 'dotenv';
import { Pool } from 'pg';
import { AuthService } from '../../../application/services/AuthService';
import { loadConfig } from '../../../config';
import { seedGommistaTemplates } from './gommista-templates';

dotenv.config();

const DEMO_EMAIL = 'demo@gommista.it';
const DEMO_PASSWORD = 'Password123!';

/** Idempotent: re-running reuses the demo organization and only adds missing templates. */
const seed = async (): Promise<void> => {
  const config = loadConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  const auth = new AuthService(config.jwtSecret, config.jwtAccessExpiry, config.jwtRefreshExpiry);

  try {
    const existing = await pool.query<{ org_id: string }>(
      'SELECT org_id FROM users WHERE email = $1',
      [DEMO_EMAIL]
    );

    let orgId: string;
    if (existing.rows[0]) {
      orgId = existing.rows[0].org_id;
    } else {
      const org = await pool.query<{ id: string }>(
        `INSERT INTO organizations (name, trade_type) VALUES ($1, $2) RETURNING id`,
        ['Gommista Demo', 'gommista']
      );
      orgId = org.rows[0].id;
      await pool.query(
        `INSERT INTO users (org_id, email, phone, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6, 'owner')`,
        [
          orgId,
          DEMO_EMAIL,
          '+393331234567',
          await auth.hashPassword(DEMO_PASSWORD),
          'Mario',
          'Rossi',
        ]
      );
    }

    const inserted = await seedGommistaTemplates(pool, orgId);
    process.stdout.write(
      `Seeded org ${orgId} (${DEMO_EMAIL} / ${DEMO_PASSWORD}), ${inserted} new service templates\n`
    );
  } finally {
    await pool.end();
  }
};

seed().catch((err) => {
  process.stderr.write(`Seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
