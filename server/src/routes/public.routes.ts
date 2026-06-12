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
      minute: m.minute ?? null,
      live_home_score: m.live_home_score ?? null,
      live_away_score: m.live_away_score ?? null,
    })));
  } catch (e) { next(e); }
});

/**
 * GET /api/calendario/:matchId — detalle de un partido para la pestaña Calendario:
 * qué porras aprobadas tienen a los dos equipos o a jugadores suyos, y los
 * puntos (provisionales o definitivos) obtenidos en ESTE partido, extraídos del
 * desglose ya calculado en porra_scores.
 */
router.get('/calendario/:matchId', async (req, res, next) => {
  try {
    const match = await MatchesRepo.findById(req.params.matchId);
    if (!match) { res.status(404).json({ error: 'Partido no encontrado' }); return; }

    const [teams, players, porras, scores] = await Promise.all([
      TeamsRepo.findAll(), PlayersRepo.findAll(), PorrasRepo.findAllFull(), ScoresRepo.findAll(),
    ]);
    const teamById = new Map(teams.map(t => [t.id, t]));
    const playerById = new Map(players.map(p => [p.id, p]));
    const matchTeamIds = new Set([match.home_team_id, match.away_team_id]);

    const breakdownByPorra = new Map<string, any>();
    for (const s of scores) {
      if (s.breakdown_json) {
        try { breakdownByPorra.set(s.porra_id, JSON.parse(s.breakdown_json)); } catch { /* caché corrupta: se ignora */ }
      }
    }

    const selecciones: unknown[] = [];
    const jugadores: unknown[] = [];

    for (const pf of porras) {
      const breakdown = breakdownByPorra.get(pf.porra.id);

      for (const sel of pf.selections.filter(s => matchTeamIds.has(s.team_id))) {
        const team = teamById.get(sel.team_id);
        const teamScore = breakdown?.selecciones?.find((t: any) => t.teamId === sel.team_id);
        const items = (teamScore?.items ?? []).filter((it: any) => it.matchId === match.id);
        selecciones.push({
          participantName: pf.participant.name,
          porraId: pf.porra.id,
          team_id: sel.team_id,
          team_name: team?.name ?? sel.team_id,
          category: team?.category ?? '',
          is_winner: sel.is_winner,
          points: items.reduce((s: number, it: any) => s + it.finalPoints, 0),
          items,
        });
      }

      for (const lu of pf.lineup) {
        const player = playerById.get(lu.player_id);
        if (!player || !matchTeamIds.has(player.team_id)) continue;
        const playerScore = breakdown?.jugadores?.find((j: any) => j.playerId === lu.player_id);
        const items = (playerScore?.items ?? []).filter((it: any) => it.matchId === match.id);
        jugadores.push({
          participantName: pf.participant.name,
          porraId: pf.porra.id,
          player_id: lu.player_id,
          player_name: player.name,
          team_id: player.team_id,
          team_name: teamById.get(player.team_id)?.name ?? player.team_id,
          position: player.position,
          role: lu.role,
          is_captain: lu.is_captain,
          points: items.reduce((s: number, it: any) => s + it.finalPoints, 0),
          items,
        });
      }
    }

    res.json({
      match: {
        id: match.id,
        phase: match.phase,
        match_date: match.match_date,
        status: match.status,
        home_team_id: match.home_team_id,
        away_team_id: match.away_team_id,
        home_team_name: teamById.get(match.home_team_id)?.name ?? match.home_team_id,
        away_team_name: teamById.get(match.away_team_id)?.name ?? match.away_team_id,
        home_score: match.home_score,
        away_score: match.away_score,
        decided_by_penalties: match.decided_by_penalties,
        group_name: match.group_name ?? null,
        venue: match.venue ?? null,
        minute: match.minute ?? null,
        live_home_score: match.live_home_score ?? null,
        live_away_score: match.live_away_score ?? null,
      },
      selecciones,
      jugadores,
    });
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
