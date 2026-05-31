import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';
import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';
import { EventsRepo } from '../repositories/events.repo';
import { PorrasRepo, ParticipantsRepo } from '../repositories/porras.repo';
import { ScoresRepo } from '../repositories/scores.repo';
import { calcularClasificacion } from '../services/scoring/engine';
import { CalcInput } from '../types';

const router = Router();
router.use(requireAdmin);

// ── Selecciones (equipos) ───────────────────────────────────────────────────
router.get('/teams',         (_req, res) => res.json(TeamsRepo.findAll()));
router.post('/teams',        (req, res)  => res.json(TeamsRepo.create(req.body)));
router.put('/teams/:id',     (req, res)  => { TeamsRepo.update(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/teams/:id',  (req, res)  => { TeamsRepo.delete(req.params.id); res.json({ ok: true }); });

// ── Jugadores ───────────────────────────────────────────────────────────────
router.get('/players',         (_req, res) => res.json(PlayersRepo.findAll()));
router.post('/players',        (req, res)  => res.json(PlayersRepo.create(req.body)));
router.put('/players/:id',     (req, res)  => { PlayersRepo.update(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/players/:id',  (req, res)  => { PlayersRepo.delete(req.params.id); res.json({ ok: true }); });

// ── Partidos ────────────────────────────────────────────────────────────────
router.get('/matches',        (_req, res) => res.json(MatchesRepo.findAll()));
router.post('/matches',       (req, res)  => res.json(MatchesRepo.create(req.body)));
router.put('/matches/:id',    (req, res)  => { MatchesRepo.update(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/matches/:id', (req, res)  => { MatchesRepo.delete(req.params.id); res.json({ ok: true }); });

// Resultados de fase
router.post('/phase-results', (req, res) => {
  const { team_id, phase, result } = req.body;
  PhaseResultsRepo.upsert(team_id, phase, result);
  res.json({ ok: true });
});
router.delete('/phase-results', (req, res) => {
  PhaseResultsRepo.delete(req.body.team_id, req.body.phase);
  res.json({ ok: true });
});

// ── Eventos de partido ──────────────────────────────────────────────────────
router.get('/events/:matchId',    (req, res) => res.json(EventsRepo.findByMatch(req.params.matchId)));
router.post('/events',            (req, res) => { EventsRepo.upsert(req.body); res.json({ ok: true }); });
router.post('/events/:matchId/confirm', (req, res) => {
  EventsRepo.confirmAll(req.params.matchId);
  res.json({ ok: true });
});
router.delete('/events/:matchId/:playerId', (req, res) => {
  EventsRepo.delete(req.params.matchId, req.params.playerId);
  res.json({ ok: true });
});

// ── Participantes y porras ──────────────────────────────────────────────────
router.get('/participants',       (_req, res) => res.json(ParticipantsRepo.findAll()));
router.post('/participants',      (req, res)  => res.json(ParticipantsRepo.create(req.body)));
router.put('/participants/:id',   (req, res)  => { ParticipantsRepo.update(req.params.id, req.body); res.json({ ok: true }); });
router.delete('/participants/:id',(req, res)  => { ParticipantsRepo.delete(req.params.id); res.json({ ok: true }); });

router.get('/porras',             (_req, res) => res.json(PorrasRepo.findAllFull()));
router.post('/porras-create',     (req, res)  => res.json(PorrasRepo.create(req.body.participant_id)));
router.post('/porras/:id/selections', (req, res) => {
  PorrasRepo.setSelections(req.params.id, req.body);
  res.json({ ok: true });
});
router.post('/porras/:id/lineup', (req, res) => {
  PorrasRepo.setLineup(req.params.id, req.body);
  res.json({ ok: true });
});
router.post('/porras/:id/mvp',    (req, res) => {
  PorrasRepo.setMvp(req.params.id, req.body.player_id ?? null);
  res.json({ ok: true });
});
router.post('/porras/:id/lock',   (req, res) => {
  PorrasRepo.lock(req.params.id);
  res.json({ ok: true });
});

// ── Recalcular clasificación ────────────────────────────────────────────────
router.post('/recalcular', (_req, res) => {
  const input: CalcInput = {
    matches:          MatchesRepo.findAll(),
    events:           EventsRepo.findAllConfirmed(),
    teamPhaseResults: PhaseResultsRepo.findAll(),
    porras:           PorrasRepo.findAllFull(),
    teams:            TeamsRepo.findAll(),
    players:          PlayersRepo.findAll(),
  };

  const results = calcularClasificacion(input);

  for (const r of results) {
    ScoresRepo.upsert(r.porraId, r.totalPoints, r.breakdown);
  }

  res.json({ recalculated: results.length, results: results.map(r => ({ porraId: r.porraId, participantName: r.participantName, totalPoints: r.totalPoints })) });
});

export default router;
