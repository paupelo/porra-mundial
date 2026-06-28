import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';
import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';
import { EventsRepo } from '../repositories/events.repo';
import { PorrasRepo, ParticipantsRepo } from '../repositories/porras.repo';
import { sendRejectionEmail } from '../services/email';
import { recalcularYGuardar } from '../services/recalc';
import { computeGroupBonuses } from '../services/group-bonuses';
import { fetchBesoccerMatch } from '../services/besoccer/client';
import { parseScore, parseEvents, parseLineup } from '../services/besoccer/mapper';
import { syncBesoccerMatch } from '../services/besoccer/sync';

const router = Router();
router.use(requireAdmin);

// ── Selecciones (equipos) ───────────────────────────────────────────────────
router.get('/teams', async (_req, res, next) => {
  try { res.json(await TeamsRepo.findAll()); } catch (e) { next(e); }
});
router.post('/teams', async (req, res, next) => {
  try { res.json(await TeamsRepo.create(req.body)); } catch (e) { next(e); }
});
router.put('/teams/:id', async (req, res, next) => {
  try { await TeamsRepo.update(req.params.id, req.body); res.json({ ok: true }); } catch (e) { next(e); }
});
router.delete('/teams/:id', async (req, res, next) => {
  try { await TeamsRepo.delete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

// ── Jugadores ───────────────────────────────────────────────────────────────
router.get('/players', async (_req, res, next) => {
  try { res.json(await PlayersRepo.findAll()); } catch (e) { next(e); }
});
router.post('/players', async (req, res, next) => {
  try { res.json(await PlayersRepo.create(req.body)); } catch (e) { next(e); }
});
router.put('/players/:id', async (req, res, next) => {
  try { await PlayersRepo.update(req.params.id, req.body); res.json({ ok: true }); } catch (e) { next(e); }
});
router.delete('/players/:id', async (req, res, next) => {
  try { await PlayersRepo.delete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

// ── Partidos ────────────────────────────────────────────────────────────────
router.get('/matches', async (_req, res, next) => {
  try { res.json(await MatchesRepo.findAll()); } catch (e) { next(e); }
});
router.post('/matches', async (req, res, next) => {
  try { res.json(await MatchesRepo.create(req.body)); } catch (e) { next(e); }
});
router.put('/matches/:id', async (req, res, next) => {
  try {
    await MatchesRepo.update(req.params.id, req.body);
    // Marcar un partido como finalizado aplica sus puntuaciones automáticamente
    // (sin paso de aprobación): se confirman sus eventos y se recalcula.
    if (req.body.status === 'finished') {
      await EventsRepo.confirmAll(req.params.id);
      await recalcularYGuardar();
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.delete('/matches/:id', async (req, res, next) => {
  try { await MatchesRepo.delete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

// Resultados de fase
router.post('/phase-results', async (req, res, next) => {
  try {
    const { team_id, phase, result } = req.body;
    await PhaseResultsRepo.upsert(team_id, phase, result);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.delete('/phase-results', async (req, res, next) => {
  try {
    await PhaseResultsRepo.delete(req.body.team_id, req.body.phase);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/**
 * POST /api/admin/group-bonuses — bonus de fin de fase de grupos.
 * Deriva del cuadro de dieciseisavos qué 32 equipos avanzan y cuáles quedan
 * eliminados, y muestra qué puntos recibirían equipos y jugadores. dry_run=true
 * por defecto: solo previsualiza. Con { confirm: true } escribe team_phase_results
 * (aditivo, no toca eventos aprobados) y recalcula la clasificación.
 */
router.post('/group-bonuses', async (req, res, next) => {
  try {
    const apply = req.body?.confirm === true;
    const preview = await computeGroupBonuses(apply);
    if (preview.applied) await recalcularYGuardar();
    res.json(preview);
  } catch (e) { next(e); }
});

/**
 * POST /api/admin/besoccer/preview — DRY-RUN de SOLO LECTURA del scraper de BeSoccer
 * para fase KO: descarga la página de un partido (por URL) y devuelve lo que parsea
 * (marcador, eventos, alineación). NO escribe nada ni afecta a la clasificación;
 * sirve para validar el parser contra partidos reales antes de que dirija la
 * puntuación. Body: { url: "https://es.besoccer.com/partido/.../<id>" }.
 */
router.post('/besoccer/preview', async (req, res, next) => {
  try {
    const url = String(req.body?.url ?? '');
    if (!url) { res.status(400).json({ error: 'Falta la URL del partido de BeSoccer' }); return; }
    const pages = await fetchBesoccerMatch(url);
    const evHtml = pages.eventos || pages.main;
    const score = parseScore(evHtml);
    const events = parseEvents(evHtml);
    const lineup = parseLineup(pages.alineaciones || pages.main);
    res.json({
      score,
      counts: {
        events: events.length,
        starters: lineup.filter(l => l.isStarter).length,
        bench: lineup.filter(l => !l.isStarter).length,
      },
      events,
      lineup,
    });
  } catch (e) { next(e); }
});

/**
 * POST /api/admin/besoccer/sync — ESCRIBE: descarga un partido de BeSoccer, guarda
 * sus eventos como borradores (mismo pipeline que FIFA) y su marcador, y recalcula.
 * Fallback manual del scraper automático. Body: { matchId, url?, live?, confirm? }.
 * - url: si se pasa, se guarda en matches.besoccer_url; si no, se usa la guardada.
 * - live: true = marcador/eventos provisionales (is_live); por defecto según estado.
 * - confirm: true = auto-confirma los eventos del partido (cuenta para la clasificación).
 */
router.post('/besoccer/sync', async (req, res, next) => {
  try {
    const match = await MatchesRepo.findById(String(req.body?.matchId ?? ''));
    if (!match) { res.status(404).json({ error: 'Partido no encontrado' }); return; }
    const url = String(req.body?.url ?? match.besoccer_url ?? '');
    if (!url) { res.status(400).json({ error: 'Falta la URL de BeSoccer (pásala en "url" o guárdala en el partido)' }); return; }
    if (req.body?.url && req.body.url !== match.besoccer_url) {
      await MatchesRepo.update(match.id, { besoccer_url: url });
    }
    const isLive = req.body?.live ?? (match.status === 'live');
    const summary = await syncBesoccerMatch(match, url, isLive);
    if (req.body?.confirm === true && !isLive) await EventsRepo.confirmAll(match.id);
    const results = await recalcularYGuardar();
    res.json({ ...summary, recalculated: results.length });
  } catch (e) { next(e); }
});

// ── Eventos de partido ──────────────────────────────────────────────────────
router.get('/events/:matchId', async (req, res, next) => {
  try { res.json(await EventsRepo.findByMatch(req.params.matchId)); } catch (e) { next(e); }
});
router.post('/events', async (req, res, next) => {
  try {
    await EventsRepo.upsert(req.body);
    // Sin aprobación manual: cualquier corrección de eventos se aplica al momento
    await recalcularYGuardar();
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/events/:matchId/confirm', async (req, res, next) => {
  try {
    await EventsRepo.confirmAll(req.params.matchId);
    // Confirmar dispara el recálculo: los borradores pasan a contar de inmediato
    const results = await recalcularYGuardar();
    res.json({ ok: true, recalculated: results.length });
  } catch (e) { next(e); }
});
router.delete('/events/:matchId/:playerId', async (req, res, next) => {
  try { await EventsRepo.delete(req.params.matchId, req.params.playerId); res.json({ ok: true }); } catch (e) { next(e); }
});

// ── Participantes y porras ──────────────────────────────────────────────────
router.get('/participants', async (_req, res, next) => {
  try { res.json(await ParticipantsRepo.findAll()); } catch (e) { next(e); }
});
router.post('/participants', async (req, res, next) => {
  try { res.json(await ParticipantsRepo.create(req.body)); } catch (e) { next(e); }
});
router.put('/participants/:id', async (req, res, next) => {
  try { await ParticipantsRepo.update(req.params.id, req.body); res.json({ ok: true }); } catch (e) { next(e); }
});
router.delete('/participants/:id', async (req, res, next) => {
  try { await ParticipantsRepo.delete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

router.get('/porras', async (_req, res, next) => {
  try { res.json(await PorrasRepo.findAllFullAdmin()); } catch (e) { next(e); }
});
router.get('/porras/pending', async (_req, res, next) => {
  try { res.json(await PorrasRepo.findPending()); } catch (e) { next(e); }
});
router.post('/porras-create', async (req, res, next) => {
  try { res.json(await PorrasRepo.create(req.body.participant_id)); } catch (e) { next(e); }
});
router.post('/porras/:id/selections', async (req, res, next) => {
  try { await PorrasRepo.setSelections(req.params.id, req.body); res.json({ ok: true }); } catch (e) { next(e); }
});
router.post('/porras/:id/lineup', async (req, res, next) => {
  try { await PorrasRepo.setLineup(req.params.id, req.body); res.json({ ok: true }); } catch (e) { next(e); }
});
router.post('/porras/:id/mvp', async (req, res, next) => {
  try { await PorrasRepo.setMvp(req.params.id, req.body.player_id ?? null); res.json({ ok: true }); } catch (e) { next(e); }
});
router.post('/porras/:id/lock', async (req, res, next) => {
  try { await PorrasRepo.lock(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});
router.post('/porras/:id/approve', async (req, res, next) => {
  try { await PorrasRepo.setStatus(req.params.id, 'approved'); res.json({ ok: true }); } catch (e) { next(e); }
});
router.post('/porras/:id/reject', async (req, res, next) => {
  try {
    const pending = await PorrasRepo.findPending();
    const allForId = await PorrasRepo._findAllFullWhere(`p.id = '${req.params.id}'`);
    const full = pending.find(f => f.porra.id === req.params.id) ?? allForId[0];
    await PorrasRepo.setStatus(req.params.id, 'rejected');
    if (full?.porra.submitted_email) {
      await sendRejectionEmail(full.porra.submitted_email, full.participant?.name ?? '');
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.put('/porras/:id/name', async (req, res, next) => {
  try {
    const { name } = req.body as { name: string };
    const allForId = await PorrasRepo._findAllFullWhere(`p.id = '${req.params.id}'`);
    const full = allForId[0];
    if (!full) { res.status(404).json({ error: 'Porra no encontrada' }); return; }
    await ParticipantsRepo.update(full.participant.id, { name });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
router.post('/porras/bulk-approve', async (req, res, next) => {
  try {
    const { ids } = req.body as { ids: string[] };
    for (const id of ids) await PorrasRepo.setStatus(id, 'approved');
    res.json({ approved: ids.length });
  } catch (e) { next(e); }
});

// ── Recalcular clasificación ────────────────────────────────────────────────
router.post('/recalcular', async (_req, res, next) => {
  try {
    const results = await recalcularYGuardar();
    res.json({ recalculated: results.length, results: results.map(r => ({ porraId: r.porraId, participantName: r.participantName, totalPoints: r.totalPoints })) });
  } catch (e) { next(e); }
});

export default router;
