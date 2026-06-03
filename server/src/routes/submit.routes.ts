import { Router } from 'express';
import { PorrasRepo } from '../repositories/porras.repo';
import { LineupRole, Position } from '../types';

const router = Router();

const DEADLINE = new Date('2026-06-11T19:00:00+02:00');

router.get('/check', async (req, res, next) => {
  try {
    const { email, name } = req.query as { email?: string; name?: string };
    const emailCount = email ? await PorrasRepo.countByEmail(email) : 0;
    const nameConflict = name ? await PorrasRepo.nameExistsApproved(name) : false;
    res.json({ emailCount, nameConflict });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    if (new Date() > DEADLINE) {
      res.status(403).json({ error: 'El plazo de inscripción ha cerrado.' });
      return;
    }

    const { nombre, email, selections, lineup } = req.body as { nombre: string; email: string; selections: unknown[]; lineup: unknown[] };

    if (!nombre?.trim() || !email?.trim()) {
      res.status(400).json({ error: 'Nombre y email son obligatorios.' });
      return;
    }

    if (await PorrasRepo.nameExistsApproved(nombre.trim())) {
      res.status(409).json({ error: 'name_conflict', message: 'Este nombre ya está en la clasificación. Elige otro.' });
      return;
    }

    const count = await PorrasRepo.countByEmail(email.trim());
    if (count >= 2) {
      res.status(409).json({ error: 'email_limit', message: 'Este email ya tiene 2 porras registradas. No se puede enviar más.' });
      return;
    }

    const porra = await PorrasRepo.submit(nombre.trim(), email.trim().toLowerCase(), { selections, lineup });

    // Populate structured tables so the admin can see teams and players immediately
    try {
      if (Array.isArray(selections) && selections.length > 0) {
        await PorrasRepo.setSelections(porra.id, selections as Array<{ team_id: string; is_winner: boolean }>);
      }
      if (Array.isArray(lineup) && lineup.length > 0) {
        await PorrasRepo.setLineup(porra.id, (lineup as Array<{ player_id: string; role: LineupRole; position_slot: Position; is_captain: 0 | 1 }>));
      }
    } catch (err) {
      // Non-fatal: raw JSON is still saved in submitted_data_json
      console.warn('[submit] Could not expand selections/lineup into tables:', err);
    }

    res.status(201).json({ porraId: porra.id, emailCount: count + 1 });
  } catch (e) { next(e); }
});

export default router;
