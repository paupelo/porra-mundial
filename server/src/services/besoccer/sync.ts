/**
 * Orquestador de sincronización de un partido KO desde BeSoccer.
 *
 * Descarga la página del partido, parsea (marcador/eventos/alineación), agrega a
 * tallies por jugador y los guarda por el MISMO pipeline que FIFA
 * (`reconcileAndSaveTallies`): borradores `is_confirmed=0`, conciliación de nombres
 * contra la plantilla, intervalo en campo, minutos de gol… También escribe el
 * marcador (en vivo: minuto + live_*_score; final: home/away_score). El resultado
 * sigue siendo un BORRADOR que el admin puede corregir/aprobar; en partidos KO
 * finalizados el scheduler lo auto-confirma igual que con FIFA.
 *
 * ⚠️ Limitaciones conocidas (pendientes de validar con datos KO reales): penaltis
 * en juego/tanda, goles en propia, paradas de penalti y el ganador de la tanda
 * (`penalty_winner_id`) — el parser los intenta por el texto del evento, pero hasta
 * verlos en un partido real conviene revisar a mano.
 */

import { fetchBesoccerMatch } from './client';
import {
  aggregateBesoccer, parseEvents, parseLineup, parseLiveMinute, parsePlayerNames, parseScore,
} from './mapper';
import { reconcileAndSaveTallies } from '../fifa/sync';
import { LineupEntry } from '../fifa/mapper';
import { MatchesRepo } from '../../repositories/matches.repo';
import { EventsRepo } from '../../repositories/events.repo';
import { MatchRecord } from '../../types';

export interface BesoccerSyncSummary {
  matchId: string;
  url: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  eventsParsed: number;
  starters: number;
  saved: number;
  skippedManual: number;
  unreconciled: Array<{ fifaPlayerId: string; name: string }>;
  isLive: boolean;
}

export async function syncBesoccerMatch(
  match: MatchRecord,
  besoccerUrl: string,
  isLive: boolean,
): Promise<BesoccerSyncSummary> {
  const pages = await fetchBesoccerMatch(besoccerUrl);
  const evHtml = pages.eventos || pages.main;
  const score = parseScore(evHtml);
  const events = parseEvents(evHtml);
  const lineup = parseLineup(pages.alineaciones || pages.main);
  const minute = isLive ? (parseLiveMinute(pages.main) ?? parseLiveMinute(evHtml)) : null;

  // Mapa de nombres: el once (campo) + todos los jugadores citados en las páginas
  // (para conciliar también a los suplentes que entran, que no están en el once).
  const names = new Map<string, string>();
  for (const l of lineup) names.set(l.fifaPlayerId, l.name);
  for (const src of [pages.alineaciones, evHtml, pages.main]) {
    for (const [id, n] of parsePlayerNames(src)) if (!names.get(id)) names.set(id, n);
  }

  const durationMin = match.phase === 'grupos' ? 90 : 120;
  const { tallies, goalEvents, liveData } = aggregateBesoccer(events, lineup, durationMin);

  // Lineup para la conciliación: una entrada por CADA jugador con tally (titulares
  // + suplentes que entraron), con su nombre real y su lado (local/visitante).
  const starterIds = new Set(lineup.filter(l => l.isStarter).map(l => l.fifaPlayerId));
  const reconcileLineup: LineupEntry[] = [...tallies.values()].map(t => ({
    fifaPlayerId: t.fifaPlayerId,
    fifaTeamId: t.fifaTeamId,
    name: names.get(t.fifaPlayerId) ?? '',
    isStarter: starterIds.has(t.fifaPlayerId),
  }));

  const save = await reconcileAndSaveTallies(match, tallies, goalEvents, reconcileLineup, liveData, isLive);

  const now = new Date().toISOString();
  if (isLive) {
    await MatchesRepo.update(match.id, {
      minute, live_home_score: score.homeScore, live_away_score: score.awayScore, last_scraped_at: now,
    });
  } else {
    // Marcador final desde BeSoccer (borrador). penalty_winner_id no es fiable desde
    // BeSoccer todavía: se deja como esté (FIFA/admin) para no romper la derivación de fase.
    await MatchesRepo.update(match.id, {
      home_score: score.homeScore, away_score: score.awayScore,
      decided_by_penalties: (score.decidedByPenalties ? 1 : 0) as 0 | 1, last_scraped_at: now,
    });
    await EventsRepo.clearLiveFlags(match.id);
  }

  return {
    matchId: match.id, url: besoccerUrl,
    homeScore: score.homeScore, awayScore: score.awayScore, minute,
    eventsParsed: events.length, starters: starterIds.size,
    saved: save.saved, skippedManual: save.skippedManual, unreconciled: save.unreconciled,
    isLive,
  };
}
