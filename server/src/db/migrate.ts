import fs from 'fs';
import path from 'path';
import { getDb } from './database';

export function runMigrations(): void {
  const db = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  console.log('✓ Migrations applied');
}

// Ejecutable directo: ts-node src/db/migrate.ts
if (require.main === module) {
  runMigrations();
  process.exit(0);
}
