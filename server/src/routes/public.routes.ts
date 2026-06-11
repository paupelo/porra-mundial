import { Router } from 'express';
import { ScoresRepo } from '../repositories/scores.repo';
import { PorrasRepo } from '../repositories/porras.repo';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';
import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';

const router = Router();

/** GET /api/clasificacion — ranking de porras aprobadas */
router.get('/clasificacion', async (_req, res, next) => {
  try {
    const scores = await ScoresRepo.findAll();
    const approvedPorras = await PorrasRepo.findAllFull(); // solo approved

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
  } catch (e) { next(e); }
});

/** GET /api/clasificacion/:porraId — desglose completo de una porra */
router.get('/clasificacion/:porraId', async (req, res, next) => {
  try {
    const score = await ScoresRepo.findByPorra(req.params.porraId);
    if (!score) { res.status(404).json({ error: 'Porra no encontrada' }); return; }

    const allFull = await PorrasRepo.findAllFull();
    const pf = allFull.find(p => p.porra.id === req.params.porraId);
    const breakdown = score.breakdown_json ? JSON.parse(score.breakdown_json) : null;

    res.json({
      porraId: score.porra_id,
      participantName: pf?.participant.name ?? '—',
      totalPoints: score.total_points,
      calculatedAt: score.calculated_at,
      breakdown,
    });
  } catch (e) { next(e); }
});

/** GET /api/porras/:porraId — selecciones + alineación pública de una porra aprobada */
router.get('/porras/:porraId', async (req, res, next) => {
  try {
    const allFull = await PorrasRepo.findAllFull();
    const full = allFull.find(p => p.porra.id === req.params.porraId);
    if (!full) { res.status(404).json({ error: 'Porra no encontrada o no aprobada' }); return; }

    const teams   = await TeamsRepo.findAll();
    const players = await PlayersRepo.findAll();
    const teamById   = new Map(teams.map(t => [t.id, t]));
    const playerById = new Map(players.map(p => [p.id, p]));

    res.json({
      participantName: full.participant.name,
      selections: full.selections.map(s => {
        const t = teamById.get(s.team_id);
        return { team_id: s.team_id, team_name: t?.name ?? s.team_id, category: t?.category ?? '', is_winner: s.is_winner };
      }),
      lineup: full.lineup.map(l => {
        const p = playerById.get(l.player_id);
        const t = p ? teamById.get(p.team_id) : null;
        return {
          player_id: l.player_id, player_name: p?.name ?? l.player_id,
          team_id: p?.team_id ?? '', team_name: t?.name ?? '',
          category: t?.category ?? '',
          role: l.role, position: l.position_slot, is_captain: l.is_captain,
        };
      }),
    });
  } catch (e) { next(e); }
});

/** GET /api/matches — partidos con nombres de equipos (para el desglose por partido) */
router.get('/matches', async (_req, res, next) => {
  try {
    const [matches, teams] = await Promise.all([MatchesRepo.findAll(), TeamsRepo.findAll()]);
    const teamById = new Map(teams.map(t => [t.id, t]));
    res.json(matches.map(m => ({
      id: m.id,
      phase: m.phase,
      match_date: m.match_date,
      status: m.status,
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      home_team_name: teamById.get(m.home_team_id)?.name ?? m.home_team_id,
      away_team_name: teamById.get(m.away_team_id)?.name ?? m.away_team_id,
      home_score: m.home_score,
      away_score: m.away_score,
      decided_by_penalties: m.decided_by_penalties,
      penalty_winner_id: m.penalty_winner_id,
      group_name: m.group_name ?? null,
      venue: m.venue ?? null,
    })));
  } catch (e) { next(e); }
});

/** GET /api/teams */
router.get('/teams', async (_req, res, next) => {
  try { res.json(await TeamsRepo.findAll()); } catch (e) { next(e); }
});

/** GET /api/players */
router.get('/players', async (_req, res, next) => {
  try { res.json(await PlayersRepo.findAll()); } catch (e) { next(e); }
});

/** GET /api/phase-results */
router.get('/phase-results', async (_req, res, next) => {
  try { res.json(await PhaseResultsRepo.findAll()); } catch (e) { next(e); }
});

export default router;
