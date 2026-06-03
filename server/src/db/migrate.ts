import fs from 'fs';
import path from 'path';
import { getDb } from './database';

export function runMigrations(): void {
  const db = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  // Columnas añadidas después de la creación inicial de la tabla porras
  const addIfMissing = [
    "ALTER TABLE porras ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
    "ALTER TABLE porras ADD COLUMN submitted_email TEXT",
    "ALTER TABLE porras ADD COLUMN submitted_data_json TEXT",
  ];
  for (const stmt of addIfMissing) {
    try { db.exec(stmt); } catch { /* columna ya existe */ }
  }

  console.log('✓ Migrations applied');
}

// Ejecutable directo: ts-node src/db/migrate.ts
if (require.main === module) {
  runMigrations();
  process.exit(0);
}
