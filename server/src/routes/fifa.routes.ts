import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { MatchesRepo } from '../repositories/matches.repo';
import { EventsRepo } from '../repositories/events.repo';
import { syncCalendar, syncMatchEvents } from '../services/fifa/sync';
import { getSchedulerStatus, runTickNow } from '../services/scheduler';
import { recalcularYGuardar } from '../services/recalc';

const router = Router();
router.use(requireAdmin);

/** GET /api/admin/fifa/status — estado del scheduler y último sync */
router.get('/status', (_req, res) => {
  res.json(getSchedulerStatus());
});

/** POST /api/admin/fifa/sync — sincroniza el calendario completo ahora */
router.post('/sync', async (_req, res, next) => {
  try { res.json(await syncCalendar()); } catch (e) { next(e); }
});

/** POST /api/admin/fifa/tick — ejecuta un ciclo completo del scheduler ahora */
router.post('/tick', async (_req, res, next) => {
  try { res.json(await runTickNow()); } catch (e) { next(e); }
});

/** POST /api/admin/fifa/sync-match/:matchId — re-scrapea los eventos de un partido */
router.post('/sync-match/:matchId', async (req, res, next) => {
  try {
    const match = await MatchesRepo.findById(req.params.matchId);
    if (!match) { res.status(404).json({ error: 'Partido no encontrado' }); return; }
    if (!match.fifa_match_id) { res.status(400).json({ error: 'Este partido no está enlazado a FIFA' }); return; }
    const summary = await syncMatchEvents(match);
    // El re-scrape puede rellenar minutos de gol / intervalo de un partido ya
    // finalizado: recalculamos para que el cambio se refleje al momento.
    await recalcularYGuardar();
    res.json(summary);
  } catch (e) { next(e); }
});

/** GET /api/admin/fifa/matches-overview — partidos con su estado de confirmación */
router.get('/matches-overview', async (_req, res, next) => {
  try {
    const matches = await MatchesRepo.findAll();
    const overview = [];
    for (const m of matches) {
      const counts = await EventsRepo.countByMatch(m.id);
      overview.push({
        ...m,
        events_total: counts.total,
        events_confirmed: counts.confirmed,
        needs_confirmation: m.status === 'finished' && counts.total > counts.confirmed,
      });
    }
    res.json(overview);
  } catch (e) { next(e); }
});

export default router;
