import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrate';
import { errorHandler } from './middleware/errors';
import authRoutes from './routes/auth.routes';
import publicRoutes from './routes/public.routes';
import adminRoutes from './routes/admin.routes';
import scraperRoutes from './routes/scraper.routes';
import submitRoutes from './routes/submit.routes';

dotenv.config();

runMigrations();

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
