import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1 para evitar confusiones

async function generateUniqueToken(): Promise<string> {
  const db = getDb();
  for (let i = 0; i < 10; i++) {
    let token = '';
    for (let j = 0; j < 6; j++) token += CHARS[Math.floor(Math.random() * CHARS.length)];
    const { rows } = await db.query('SELECT token FROM porra_drafts WHERE token=$1', [token]);
    if (rows.length === 0) return token;
  }
  throw new Error('No se pudo generar un token único');
}

/** POST /api/drafts — crea un borrador nuevo, devuelve { token } */
router.post('/', async (req, res, next) => {
  try {
    const { paso, porra } = req.body;
    if (paso === undefined || !porra) {
      res.status(400).json({ error: 'Faltan campos obligatorios' });
      return;
    }
    const token = await generateUniqueToken();
    await getDb().query(
      `INSERT INTO porra_drafts(token, draft_json) VALUES($1, $2)`,
      [token, JSON.stringify({ paso, porra })]
    );
    res.status(201).json({ token });
  } catch (e) { next(e); }
});

/** GET /api/drafts/:token — recupera un borrador */
router.get('/:token', async (req, res, next) => {
  try {
    const { rows } = await getDb().query(
      `SELECT draft_json FROM porra_drafts WHERE token=$1 AND expires_at > NOW()`,
      [req.params.token.toUpperCase()]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Borrador no encontrado o expirado' });
      return;
    }
    res.json(JSON.parse(rows[0].draft_json));
  } catch (e) { next(e); }
});

/** PUT /api/drafts/:token — actualiza un borrador existente, renueva expiración */
router.put('/:token', async (req, res, next) => {
  try {
    const { paso, porra } = req.body;
    if (paso === undefined || !porra) {
      res.status(400).json({ error: 'Faltan campos obligatorios' });
      return;
    }
    const { rowCount } = await getDb().query(
      `UPDATE porra_drafts
         SET draft_json=$1, updated_at=NOW(), expires_at=NOW() + INTERVAL '30 days'
       WHERE token=$2`,
      [JSON.stringify({ paso, porra }), req.params.token.toUpperCase()]
    );
    if ((rowCount ?? 0) === 0) {
      res.status(404).json({ error: 'Borrador no encontrado' });
      return;
    }
    res.json({ token: req.params.token.toUpperCase() });
  } catch (e) { next(e); }
});

export default router;
