import { Router } from 'express';
import { ScoresRepo } from '../repositories/scores.repo';
import { PorrasRepo } from '../repositories/porras.repo';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';

const router = Router();

/** GET /api/clasificacion — ranking de porras aprobadas */
router.get('/clasificacion', (_req, res) => {
  const scores = ScoresRepo.findAll();
  const approvedPorras = PorrasRepo.findAllFull(); // solo approved

  // Porras aprobadas sin puntuación todavía (0 pts, orden alfabético)
  const scoredIds = new Set(scores.map(s => s.porra_id));
  const unscored = approvedPorras
    .filter(pf => !scoredIds.has(pf.porra.id))
    .map(pf => ({ porra_id: pf.porra.id, total_points: 0, calculated_at: null }));

  const allEntries = [...scores.filter(s => scoredIds.has(s.porra_id) && approvedPorras.some(pf => pf.porra.id === s.porra_id)), ...unscored]
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      // empate: orden alfabético
      const nameA = approvedPorras.find(pf => pf.porra.id === a.porra_id)?.participant.name ?? '';
      const nameB = approvedPorras.find(pf => pf.porra.id === b.porra_id)?.participant.name ?? '';
      return nameA.localeCompare(nameB, 'es');
    });

  const result = allEntries.map((s, idx) => {
    const pf = approvedPorras.find(p => p.porra.id === s.porra_id);
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
