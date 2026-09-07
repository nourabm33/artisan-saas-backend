import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const run = async (): Promise<void> => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(sql);
    process.stdout.write('Schema applied\n');
  } finally {
    await pool.end();
  }
};

run().catch((err) => {
  process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
