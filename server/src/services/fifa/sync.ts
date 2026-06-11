/**
 * Orquestador de sincronización con FIFA.
 *
 * - syncCalendar(): una petición trae todos los partidos (fecha, marcador,
 *   estado, fase). Crea/actualiza filas en `matches`. Nunca pisa un partido
 *   cuyo resultado ya tenga eventos confirmados por el admin.
 * - syncMatchEvents(): para un partido finalizado descarga timeline +
 *   alineaciones, concilia nombres con el catálogo y guarda BORRADORES
 *   (source='fifa_draft', is_confirmed=0) en match_player_events.
 */

import { fetchCalendar, fetchLiveMatch, fetchSeasons, fetchTimeline } from './client';
import {
  aggregateTimeline,
  extractLineup,
  localized,
  mapCalendarMatch,
  FifaMatchDraft,
} from './mapper';
import { suggestPlayer, suggestTeam } from '../besoccer/reconciler';
import { MatchesRepo } from '../../repositories/matches.repo';
import { EventsRepo } from '../../repositories/events.repo';
import { TeamsRepo } from '../../repositories/teams.repo';
import { PlayersRepo } from '../../repositories/players.repo';
import { MatchRecord, TeamRecord } from '../../types';

const PLAYER_MATCH_THRESHOLD = 0.45;
const TEAM_MATCH_THRESHOLD = 0.7;

// ─── Temporada ────────────────────────────────────────────────────────────────

let cachedSeasonId: string | null = null;

export async function resolveSeasonId(): Promise<string | null> {
  if (process.env.FIFA_SEASON_ID) return process.env.FIFA_SEASON_ID;
  if (cachedSeasonId) return cachedSeasonId;
  try {
    const res = await fetchSeasons();
    const seasons = (res.Results ?? []) as Array<Record<string, any>>;
    const target = seasons.find(s => {
      const name = localized(s?.Name);
      const start = typeof s?.StartDate === 'string' ? s.StartDate : '';
      return name.includes('2026') || start.startsWith('2026');
    });
    if (target?.IdSeason) {
      cachedSeasonId = String(target.IdSeason);
      console.log(`[fifa] temporada 2026 descubierta: IdSeason=${cachedSeasonId}`);
      return cachedSeasonId;
    }
    console.warn('[fifa] no se encontró la temporada 2026; define FIFA_SEASON_ID en .env');
    return null;
  } catch (err) {
    console.error('[fifa] error descubriendo temporada:', (err as Error).message);
    return null;
  }
}

// ─── Conciliación de equipos ──────────────────────────────────────────────────

function buildTeamResolver(teams: TeamRecord[]) {
  const byCode = new Map<string, TeamRecord>();
  for (const t of teams) {
    if (t.country_code) byCode.set(t.country_code.toUpperCase(), t);
  }
  return (code: string | null, nameRaw: string): TeamRecord | null => {
    if (code && byCode.has(code)) return byCode.get(code)!;
    if (nameRaw) {
      const [best] = suggestTeam(nameRaw, teams);
      if (best && best.score >= TEAM_MATCH_THRESHOLD) return best.item;
    }
    return null;
  };
}

// ─── Sincronización del calendario ───────────────────────────────────────────

export interface CalendarSyncSummary {
  total: number;
  created: number;
  updated: number;
  linked: number;
  skipped: Array<{ fifaMatchId: string; reason: string }>;
}

export async function syncCalendar(): Promise<CalendarSyncSummary> {
  const seasonId = await resolveSeasonId();
  const summary: CalendarSyncSummary = { total: 0, created: 0, updated: 0, linked: 0, skipped: [] };
  if (!seasonId) {
    summary.skipped.push({ fifaMatchId: '-', reason: 'sin IdSeason (¿FIFA_SEASON_ID?)' });
    return summary;
  }

  const res = await fetchCalendar(seasonId);
  const rawMatches = res.Results ?? [];
  summary.total = rawMatches.length;

  const teams = await TeamsRepo.findAll();
  const resolveTeam = buildTeamResolver(teams);
  const now = new Date().toISOString();

  for (const raw of rawMatches) {
    const draft = mapCalendarMatch(raw);
    if (!draft) continue;
    if (!draft.phase) {
      summary.skipped.push({ fifaMatchId: draft.fifaMatchId, reason: `fase no puntuable: "${draft.stageNameRaw}"` });
      continue;
    }
    const home = resolveTeam(draft.homeCode, draft.homeNameRaw);
    const away = resolveTeam(draft.awayCode, draft.awayNameRaw);
    if (!home || !away) {
      // Normal en eliminatorias aún sin cruces definidos ("1A vs 2B")
      summary.skipped.push({ fifaMatchId: draft.fifaMatchId, reason: `equipo sin conciliar: ${draft.homeNameRaw || draft.homeCode} / ${draft.awayNameRaw || draft.awayCode}` });
      continue;
    }

    const penaltyWinnerId = draft.penaltyWinnerCode
      ? (resolveTeam(draft.penaltyWinnerCode, '')?.id ?? null)
      : null;

    const fields = {
      phase: draft.phase,
      home_team_id: home.id,
      away_team_id: away.id,
      match_date: draft.date,
      status: draft.status,
      home_score: draft.homeScore,
      away_score: draft.awayScore,
      decided_by_penalties: (draft.decidedByPenalties ? 1 : 0) as 0 | 1,
      penalty_winner_id: penaltyWinnerId,
      fifa_match_id: draft.fifaMatchId,
      fifa_stage_id: draft.fifaStageId,
      group_name: draft.groupName,
      venue: draft.venue,
      last_scraped_at: now,
    };

    const existing = await MatchesRepo.findByFifaId(draft.fifaMatchId);
    if (existing) {
      const counts = await EventsRepo.countByMatch(existing.id);
      if (counts.confirmed > 0) {
        // El admin ya validó este partido: FIFA no pisa nada, solo anotamos el scrape
        await MatchesRepo.update(existing.id, { last_scraped_at: now });
      } else {
        await MatchesRepo.update(existing.id, fields);
        summary.updated++;
      }
      continue;
    }

    const manual = await MatchesRepo.findManualCandidate(home.id, away.id, draft.phase);
    if (manual) {
      const counts = await EventsRepo.countByMatch(manual.id);
      if (counts.confirmed > 0) {
        // Enlazamos el id de FIFA pero respetamos los datos validados por el admin
        await MatchesRepo.update(manual.id, { fifa_match_id: draft.fifaMatchId, fifa_stage_id: draft.fifaStageId, last_scraped_at: now });
      } else {
        await MatchesRepo.update(manual.id, fields);
      }
      summary.linked++;
      continue;
    }

    await MatchesRepo.create(fields);
    summary.created++;
  }

  return summary;
}

// ─── Sincronización de eventos de un partido ─────────────────────────────────

export interface MatchEventsSyncSummary {
  matchId: string;
  saved: number;
  skippedConfirmed: number;
  unreconciled: Array<{ fifaPlayerId: string; name: string }>;
  unmappedEventTypes: Array<{ type: unknown; description: string }>;
}

export async function syncMatchEvents(match: MatchRecord): Promise<MatchEventsSyncSummary> {
  const summary: MatchEventsSyncSummary = {
    matchId: match.id, saved: 0, skippedConfirmed: 0, unreconciled: [], unmappedEventTypes: [],
  };
  const seasonId = await resolveSeasonId();
  if (!seasonId || !match.fifa_match_id || !match.fifa_stage_id) return summary;

  const [timelineRes, liveRes] = await Promise.allSettled([
    fetchTimeline(seasonId, match.fifa_stage_id, match.fifa_match_id),
    fetchLiveMatch(seasonId, match.fifa_stage_id, match.fifa_match_id),
  ]);
  if (timelineRes.status === 'rejected') {
    console.warn(`[fifa] timeline no disponible para ${match.fifa_match_id}: ${timelineRes.reason}`);
    return summary;
  }
  const events = timelineRes.value.Event ?? [];
  const liveData = liveRes.status === 'fulfilled' ? liveRes.value : null;
  const lineup = liveData ? extractLineup(liveData) : [];

  const durationMin = match.decided_by_penalties ? 120 : 90;
  const { tallies, unmappedTypes } = aggregateTimeline(events, lineup, durationMin);
  summary.unmappedEventTypes = unmappedTypes;
  if (unmappedTypes.length > 0) {
    console.warn(`[fifa] ${unmappedTypes.length} tipos de evento sin mapear en ${match.fifa_match_id}:`,
      unmappedTypes.map(u => `${u.type}:"${u.description}"`).slice(0, 10).join(' | '));
  }

  // FIFA IdTeam → nuestro team_id, vía las alineaciones del endpoint live
  const fifaTeamToOurs = new Map<string, string>();
  if (liveData) {
    const data = liveData as Record<string, any>;
    const homeFifaId = data?.HomeTeam?.IdTeam ? String(data.HomeTeam.IdTeam) : null;
    const awayFifaId = data?.AwayTeam?.IdTeam ? String(data.AwayTeam.IdTeam) : null;
    if (homeFifaId) fifaTeamToOurs.set(homeFifaId, match.home_team_id);
    if (awayFifaId) fifaTeamToOurs.set(awayFifaId, match.away_team_id);
  }

  const nameByFifaId = new Map(lineup.map(l => [l.fifaPlayerId, l.name]));
  const allPlayers = await PlayersRepo.findAll();
  const homePlayers = allPlayers.filter(p => p.team_id === match.home_team_id);
  const awayPlayers = allPlayers.filter(p => p.team_id === match.away_team_id);

  const existingEvents = await EventsRepo.findByMatch(match.id);
  const confirmedPlayerIds = new Set(existingEvents.filter(e => e.is_confirmed === 1).map(e => e.player_id));

  for (const tally of tallies.values()) {
    const hasData = tally.minutes_played > 0 || tally.goals_open_play || tally.goals_penalty_play ||
      tally.goals_penalty_shootout || tally.assists || tally.penalty_saved_play ||
      tally.penalty_saved_shootout || tally.red_card || tally.penalty_missed_play ||
      tally.penalty_missed_shootout || tally.own_goals;
    if (!hasData) continue;

    const name = nameByFifaId.get(tally.fifaPlayerId) ?? '';
    const ourTeamId = tally.fifaTeamId ? fifaTeamToOurs.get(tally.fifaTeamId) ?? null : null;
    const candidates = ourTeamId === match.home_team_id ? homePlayers
      : ourTeamId === match.away_team_id ? awayPlayers
      : [...homePlayers, ...awayPlayers];

    if (!name) {
      summary.unreconciled.push({ fifaPlayerId: tally.fifaPlayerId, name: '(sin nombre)' });
      continue;
    }
    const [best] = suggestPlayer(name, candidates);
    if (!best || best.score < PLAYER_MATCH_THRESHOLD) {
      summary.unreconciled.push({ fifaPlayerId: tally.fifaPlayerId, name });
      continue;
    }
    if (confirmedPlayerIds.has(best.item.id)) {
      summary.skippedConfirmed++;
      continue; // el admin ya validó a este jugador en este partido
    }

    await EventsRepo.upsert({
      match_id: match.id,
      player_id: best.item.id,
      team_id: best.item.team_id,
      minutes_played: tally.minutes_played,
      goals_open_play: tally.goals_open_play,
      goals_penalty_play: tally.goals_penalty_play,
      goals_penalty_shootout: tally.goals_penalty_shootout,
      assists: tally.assists,
      penalty_saved_play: tally.penalty_saved_play,
      penalty_saved_shootout: tally.penalty_saved_shootout,
      red_card: tally.red_card,
      penalty_conceded: tally.penalty_conceded,
      penalty_missed_play: tally.penalty_missed_play,
      penalty_missed_shootout: tally.penalty_missed_shootout,
      own_goals: tally.own_goals,
      is_improvised_goalkeeper: 0,
      source: 'fifa_draft',
      is_confirmed: 0,
    });
    summary.saved++;
  }

  if (summary.unreconciled.length > 0) {
    console.warn(`[fifa] ${summary.unreconciled.length} jugadores sin conciliar en ${match.fifa_match_id}:`,
      summary.unreconciled.map(u => u.name).join(', '));
  }
  await MatchesRepo.update(match.id, { last_scraped_at: new Date().toISOString() });
  return summary;
}
