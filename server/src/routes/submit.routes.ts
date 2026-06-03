import { Router } from 'express';
import { PorrasRepo } from '../repositories/porras.repo';

const router = Router();

const DEADLINE = new Date('2026-06-11T19:00:00+02:00');

router.get('/check', (req, res) => {
  const { email, name } = req.query as { email?: string; name?: string };
  const emailCount = email ? PorrasRepo.countByEmail(email) : 0;
  const nameConflict = name ? PorrasRepo.nameExistsApproved(name) : false;
  res.json({ emailCount, nameConflict });
});

router.post('/', (req, res) => {
  if (new Date() > DEADLINE) {
    res.status(403).json({ error: 'El plazo de inscripción ha cerrado.' });
    return;
  }

  const { nombre, email, selections, lineup } = req.body as { nombre: string; email: string; selections: unknown[]; lineup: unknown[] };

  if (!nombre?.trim() || !email?.trim()) {
    res.status(400).json({ error: 'Nombre y email son obligatorios.' });
    return;
  }

  if (PorrasRepo.nameExistsApproved(nombre.trim())) {
    res.status(409).json({ error: 'name_conflict', message: 'Este nombre ya está en la clasificación. Elige otro.' });
    return;
  }

  const count = PorrasRepo.countByEmail(email.trim());
  if (count >= 2) {
    res.status(409).json({ error: 'email_limit', message: 'Este email ya tiene 2 porras registradas. No se puede enviar más.' });
    return;
  }

  const porra = PorrasRepo.submit(nombre.trim(), email.trim().toLowerCase(), { selections, lineup });

  res.status(201).json({ porraId: porra.id, emailCount: count + 1 });
});

export default router;
