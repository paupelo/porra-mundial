/**
 * Crea un usuario administrador.
 * Uso: npx ts-node src/scripts/create-admin.ts admin@example.com mipassword
 */
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { runMigrations } from '../db/migrate';
import dotenv from 'dotenv';
dotenv.config();

runMigrations();

const [,, email, password] = process.argv;
if (!email || !password) {
  console.error('Uso: ts-node create-admin.ts <email> <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
getDb().prepare('INSERT INTO admin_users(id,email,password_hash) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash').run(uuid(), email, hash);
console.log(`✓ Admin creado/actualizado: ${email}`);
process.exit(0);
