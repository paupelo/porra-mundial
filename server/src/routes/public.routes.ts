import { Router } from 'express';
import { ScoresRepo } from '../repositories/scores.repo';
import { PorrasRepo } from '../repositories/porras.repo';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';

const router = Router();

/** GET /api/clasificacion — ranking cacheado */
router.get('/clasificacion', (_req, res) => {
  const scores = ScoresRepo.findAll();
  const porras = PorrasRepo.findAll();
  const participants = PorrasRepo.findAll(); // joined below
  const porraFull = PorrasRepo.findAllFull();

  const result = scores.map((s, idx) => {
    const pf = porraFull.find(p => p.porra.id === s.porra_id);
    return {
      position: idx + 1,
      porraId: s.porra_id,
      participantName: pf?.participant.name ?? '—',
      totalPoints: s.total_points,
      calculatedAt: s.calculated_at,
    };
  });
  res.json(result);
});

/** GET /api/clasificacion/:porraId — desglose completo de una porra */
router.get('/clasificacion/:porraId', (req, res) => {
  const score = ScoresRepo.findByPorra(req.params.porraId);
  if (!score) { res.status(404).json({ error: 'Porra no encontrada' }); return; }

  const pf = PorrasRepo.findAllFull().find(p => p.porra.id === req.params.porraId);
  const breakdown = score.breakdown_json ? JSON.parse(score.breakdown_json) : null;

  res.json({
    porraId: score.porra_id,
    participantName: pf?.participant.name ?? '—',
    totalPoints: score.total_points,
    calculatedAt: score.calculated_at,
    breakdown,
  });
});

/** GET /api/teams */
router.get('/teams', (_req, res) => res.json(TeamsRepo.findAll()));

/** GET /api/players */
router.get('/players', (_req, res) => res.json(PlayersRepo.findAll()));

/** GET /api/phase-results */
import { PhaseResultsRepo } from '../repositories/matches.repo';
router.get('/phase-results', (_req, res) => res.json(PhaseResultsRepo.findAll()));

export default router;
