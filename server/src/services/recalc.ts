import { calcularClasificacion } from './scoring/engine';
import { applyLiveOverlay, buildLiveInput } from './scoring/live';
import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';
import { EventsRepo } from '../repositories/events.repo';
import { PorrasRepo } from '../repositories/porras.repo';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';
import { ScoresRepo } from '../repositories/scores.repo';
import { PointsLogRepo, PlayerPointsLogRow, TeamPointsLogRow } from '../repositories/points-log.repo';
import { CalcInput, ClasificacionResult, PlayerScoreResult, ScoreLineItem, TeamScoreResult } from '../types';

function groupByMatch(items: ScoreLineItem[]): Map<string | null, ScoreLineItem[]> {
  const groups = new Map<string | null, ScoreLineItem[]>();
  for (const it of items) {
    const key = it.matchId ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  return groups;
}

// Multiplicador representativo del grupo: el de fase más alto entre los ítems
// (las sanciones y bonus planos llevan ×1 aunque el partido tenga otro multiplicador)
function groupMultiplier(items: ScoreLineItem[]): number {
  return items.reduce((m, it) => Math.max(m, it.phaseMultiplier), 1);
}

function buildTeamLogRows(porraId: string, selecciones: TeamScoreResult[]): TeamPointsLogRow[] {
  const rows: TeamPointsLogRow[] = [];
  for (const sel of selecciones) {
    for (const [matchId, items] of groupByMatch(sel.items)) {
      rows.push({
        porra_id: porraId,
        team_id: sel.teamId,
        team_name: sel.teamName,
        match_id: matchId,
        category: sel.category,
        is_ganador: sel.isWinner ? 1 : 0,
        points_breakdown: items,
        points_raw: items.reduce((s, i) => s + i.basePoints, 0),
        multiplier: groupMultiplier(items),
        points_total: items.reduce((s, i) => s + i.finalPoints, 0),
        is_live: items.some(i => i.isLive) ? 1 : 0,
      });
    }
  }
  return rows;
}

function buildPlayerLogRows(porraId: string, jugadores: PlayerScoreResult[]): PlayerPointsLogRow[] {
  const rows: PlayerPointsLogRow[] = [];
  for (const jug of jugadores) {
    const isSub = jug.role === 'suplente';
    const fullMult = jug.isCaptain ? 2 : 1;
    for (const [matchId, items] of groupByMatch(jug.items)) {
      rows.push({
        porra_id: porraId,
        player_id: jug.playerId,
        player_name: jug.playerName,
        match_id: matchId,
        position: jug.position,
        is_captain: jug.isCaptain ? 1 : 0,
        is_substitute: isSub ? 1 : 0,
        // El suplente está "promocionado" si en este partido ya puntúa completo
        substitute_promoted: isSub && items.some(i => i.roleMultiplier === fullMult) ? 1 : 0,
        points_breakdown: items,
        points_raw: items.reduce((s, i) => s + i.basePoints, 0),
        multiplier: groupMultiplier(items),
        points_total: items.reduce((s, i) => s + i.finalPoints, 0),
        is_live: items.some(i => i.isLive) ? 1 : 0,
      });
    }
  }
  return rows;
}

/**
 * Recalcula la clasificación completa y persiste:
 * - porra_scores (caché que lee /api/clasificacion)
 * - team_points_log / player_points_log (desglose por partido, con is_live)
 *
 * Modo en vivo: los partidos con status='live' puntúan PROVISIONALMENTE con su
 * marcador parcial y sus eventos is_live=1 (ver scoring/live.ts); esos ítems
 * salen marcados isLive y se "cierran" solos en el primer recálculo tras el
 * final del partido. Los borradores normales sin confirmar nunca puntúan.
 */
export async function recalcularYGuardar(): Promise<ClasificacionResult[]> {
  const allMatches = await MatchesRepo.findAll();
  const allEvents  = await EventsRepo.findAll();
  const { matches: effMatches, events: effEvents, liveIds } = buildLiveInput(allMatches, allEvents);

  const input: CalcInput = {
    matches:          effMatches,
    events:           effEvents,
    teamPhaseResults: await PhaseResultsRepo.findAll(),
    porras:           await PorrasRepo.findAllFull(),
    teams:            await TeamsRepo.findAll(),
    players:          await PlayersRepo.findAll(),
  };

  const results = applyLiveOverlay(calcularClasificacion(input), liveIds);

  for (const r of results) {
    await ScoresRepo.upsert(r.porraId, r.totalPoints, r.breakdown);
    await PointsLogRepo.replaceForPorra(
      r.porraId,
      buildTeamLogRows(r.porraId, r.breakdown.selecciones),
      buildPlayerLogRows(r.porraId, r.breakdown.jugadores),
    );
  }

  return results;
}
