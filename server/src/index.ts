import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runMigrations } from './db/migrate';
import { errorHandler } from './middleware/errors';
import authRoutes from './routes/auth.routes';
import publicRoutes from './routes/public.routes';
import adminRoutes from './routes/admin.routes';
import scraperRoutes from './routes/scraper.routes';

dotenv.config();

runMigrations();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/auth',          authRoutes);
app.use('/api',               publicRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/admin/scraper', scraperRoutes);

app.use(errorHandler);

app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
