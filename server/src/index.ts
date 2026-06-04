import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrate';
import { runSeedIfEmpty } from './scripts/seed';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { getDb } from './db/database';
import { errorHandler } from './middleware/errors';
import authRoutes from './routes/auth.routes';
import publicRoutes from './routes/public.routes';
import adminRoutes from './routes/admin.routes';
import scraperRoutes from './routes/scraper.routes';
import submitRoutes from './routes/submit.routes';
import draftsRoutes from './routes/drafts.routes';

dotenv.config();

async function main() {
  await runMigrations();
  await runSeedIfEmpty();

  // Crea el admin desde env vars si no existe ninguno (útil en Render sin disco)
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const db = getDb();
    const existing = await db.query('SELECT id FROM admin_users WHERE email=$1', [adminEmail]);
    if (existing.rows.length === 0) {
      await db.query('INSERT INTO admin_users(id,email,password_hash) VALUES($1,$2,$3)', [
        uuid(), adminEmail, bcrypt.hashSync(adminPassword, 12)
      ]);
      console.log(`✓ Admin creado: ${adminEmail}`);
    }
  }

  const app = express();
  const PORT = process.env.PORT ?? 3001;
  const IS_PROD = process.env.NODE_ENV === 'production';

  // En producción el frontend se sirve desde este mismo servidor (mismo origen),
  // así que no hace falta CORS. En dev lo permitimos desde localhost:3000.
  if (!IS_PROD) {
    app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000' }));
  }

  app.use(express.json());

  // ── API ──────────────────────────────────────────────────────────────────────
  app.use('/api/auth',          authRoutes);
  app.use('/api/submit',        submitRoutes);
  app.use('/api/drafts',        draftsRoutes);
  app.use('/api',               publicRoutes);
  app.use('/api/admin',         adminRoutes);
  app.use('/api/admin/scraper', scraperRoutes);

  app.use(errorHandler);

  // ── Frontend estático (solo en producción) ───────────────────────────────────
  // El build de React queda en <raíz>/build/; desde server/dist/ son dos niveles arriba.
  if (IS_PROD) {
    const STATIC_DIR = path.join(__dirname, '../../build');
    if (fs.existsSync(STATIC_DIR)) {
      app.use(express.static(STATIC_DIR));
      // SPA catch-all: cualquier ruta no-API → index.html
      app.get('*', (_req, res) => {
        res.sendFile(path.join(STATIC_DIR, 'index.html'));
      });
    } else {
      console.warn('⚠️  Directorio build/ no encontrado. Ejecuta npm run build en la raíz.');
    }
  }

  app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
}

main().catch(console.error);
