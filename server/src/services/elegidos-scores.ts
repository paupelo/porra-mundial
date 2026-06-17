import { calcTeamScore } from './scoring/selecciones';
import { calcPlayerScore } from './scoring/jugadores';
import { buildLiveInput, transformItems } from './scoring/live';
import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';
import { EventsRepo } from '../repositories/events.repo';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';
import { MatchPlayerEventRecord, Position, ScoreLineItem } from '../types';

/**
 * Puntuación BRUTA AISLADA de cada selección y cada jugador en el torneo: los
 * puntos que han generado por sus PROPIOS resultados, independientemente de
 * cuántos participantes los eligieron, junto con su desglose concepto a concepto.
 *
 * Reutiliza las funciones puras del motor (no las modifica) con parámetros
 * neutros, porra-independientes:
 *   - Selección: NO marcada como Ganador del Mundial (sin ×2 winner; la
 *     categoría sí es global a la selección y la usa el motor tal cual).
 *   - Jugador: titular (sin ×0.5 de suplente), sin capitanía (sin ×2) y sin MVP.
 *
 * Los partidos en vivo cuentan provisionalmente igual que en el ranking (vía
 * buildLiveInput + descarte de conceptos solo-finales como portería a cero).
 */
export interface ElegidoScore {
  points: number;
  /** Desglose del motor (mismo ScoreLineItem[] que usa la pestaña de detalle). */
  items: ScoreLineItem[];
}

export interface ElegidosScores {
  teamScores: Map<string, ElegidoScore>;
  playerScores: Map<string, ElegidoScore>;
}

function total(items: ScoreLineItem[]): number {
  return items.reduce((s, i) => s + i.finalPoints, 0);
}

export async function computeElegidosScores(): Promise<ElegidosScores> {
  const [allMatches, allEvents, phaseResults, teams, players] = await Promise.all([
    MatchesRepo.findAll(), EventsRepo.findAll(), PhaseResultsRepo.findAll(),
    TeamsRepo.findAll(), PlayersRepo.findAll(),
  ]);
  const { matches: effMatches, events: effEvents, liveIds } = buildLiveInput(allMatches, allEvents);

  // Eventos confirmados por jugador → partido (idéntico a engine.ts).
  const eventsByPlayer = new Map<string, Map<string, MatchPlayerEventRecord>>();
  for (const ev of effEvents.filter(e => e.is_confirmed === 1)) {
    if (!eventsByPlayer.has(ev.player_id)) eventsByPlayer.set(ev.player_id, new Map());
    eventsByPlayer.get(ev.player_id)!.set(ev.match_id, ev);
  }

  const teamScores = new Map<string, ElegidoScore>();
  for (const team of teams) {
    const res = calcTeamScore(team, false, effMatches, phaseResults);
    const items = transformItems(res.items, liveIds); // overlay en vivo (solo-finales fuera)
    teamScores.set(team.id, { points: total(items), items });
  }

  const playerScores = new Map<string, ElegidoScore>();
  for (const player of players) {
    const evs = eventsByPlayer.get(player.id) ?? new Map<string, MatchPlayerEventRecord>();
    const res = calcPlayerScore(
      player, 'titular', player.position as Position, false, [], effMatches, evs, phaseResults, false);
    const items = transformItems(res.items, liveIds);
    playerScores.set(player.id, { points: total(items), items });
  }

  return { teamScores, playerScores };
}
