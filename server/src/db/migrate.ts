import { getDb } from './database';
import fs from 'fs';
import path from 'path';

export async function runMigrations(): Promise<void> {
  const db = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await db.query(schema);
  // Add columns if missing (idempotent ALTER TABLE)
  const alters = [
    "ALTER TABLE porras ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'",
    "ALTER TABLE porras ADD COLUMN IF NOT EXISTS submitted_email TEXT",
    "ALTER TABLE porras ADD COLUMN IF NOT EXISTS submitted_data_json TEXT",
  ];
  for (const sql of alters) {
    await db.query(sql).catch(() => {});
  }
  console.log('✓ Migrations applied');
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch(console.error);
}
