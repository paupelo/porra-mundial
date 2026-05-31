import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { fetchMatchPage } from '../services/besoccer/scraper';
import { parseMatchPage } from '../services/besoccer/parser';
import { suggestPlayer, suggestTeam } from '../services/besoccer/reconciler';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';
import { EventsRepo } from '../repositories/events.repo';

const router = Router();
router.use(requireAdmin);

/**
 * POST /api/admin/scraper/fetch
 * Body: { matchId: string (id en BD), besoccerMatchId: string }
 * Descarga el HTML, lo parsea y devuelve un borrador con sugerencias de conciliación.
 * El borrador NO se guarda automáticamente; el admin lo revisa y confirma.
 */
router.post('/fetch', async (req, res, next) => {
  try {
    const { besoccerMatchId } = req.body as { besoccerMatchId: string };
    const html = await fetchMatchPage(besoccerMatchId);
    const draft = parseMatchPage(html);

    if (!draft) {
      res.status(422).json({ error: 'No se pudo parsear la página. Carga los datos manualmente.' });
      return;
    }

    const teams = TeamsRepo.findAll();
    const players = PlayersRepo.findAll();

    // Añadir sugerencias de conciliación a cada jugador del borrador
    const playersWithSuggestions = draft.players.map(p => ({
      ...p,
      playerSuggestions: suggestPlayer(p.playerNameRaw, players),
      teamSuggestions: suggestTeam(p.teamNameRaw, teams),
    }));

    res.json({ draft: { ...draft, players: playersWithSuggestions } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/scraper/save-draft
 * Guarda los eventos del borrador (ya conciliados por el admin) con is_confirmed=0.
 */
router.post('/save-draft', (req, res) => {
  const events = req.body.events as Parameters<typeof EventsRepo.upsert>[0][];
  for (const ev of events) {
    EventsRepo.upsert({ ...ev, source: 'besoccer_draft', is_confirmed: 0 });
  }
  res.json({ saved: events.length });
});

export default router;
