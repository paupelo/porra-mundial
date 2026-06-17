import { calcularClasificacion } from './scoring/engine';
import { buildLiveInput, applyLiveOverlay } from './scoring/live';
import { ScoresRepo } from '../repositories/scores.repo';
import { PorrasRepo } from '../repositories/porras.repo';
import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';
import { EventsRepo } from '../repositories/events.repo';
import { TeamsRepo } from '../repositories/teams.repo';
import { PlayersRepo } from '../repositories/players.repo';
import { CalcInput } from '../types';

export interface RankingEntry {
  position: number;
  porraId: string;
  participantName: string;
  totalPoints: number;
  calculatedAt: string | null;
}

/**
 * Ordena porras por puntos desc; empate por nombre alfabético (es). Devuelve la
 * posición 1-based. Comparador ÚNICO usado por la clasificación actual y por la
 * del día anterior, para que un empate no produzca cambios de posición falsos.
 */
function rankByPoints(
  rows: Array<{ porraId: string; totalPoints: number; calculatedAt: string | null }>,
  nameByPorra: Map<string, string>,
): RankingEntry[] {
  return [...rows]
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const nameA = nameByPorra.get(a.porraId) ?? '';
      const nameB = nameByPorra.get(b.porraId) ?? '';
      return nameA.localeCompare(nameB, 'es');
    })
    .map((r, idx) => ({
      position: idx + 1,
      porraId: r.porraId,
      participantName: nameByPorra.get(r.porraId) ?? '—',
      totalPoints: r.totalPoints,
      calculatedAt: r.calculatedAt,
    }));
}

/**
 * Calcula el ranking ordenado de porras APROBADAS a partir de la caché
 * porra_scores (incluye los provisionales en vivo). Las porras aprobadas sin
 * puntuación todavía van con 0 pts. Fuente del ranking que ve /api/clasificacion.
 */
export async function computeRankingEntries(): Promise<RankingEntry[]> {
  const scores = await ScoresRepo.findAll();
  const approvedPorras = await PorrasRepo.findAllFull(); // solo approved

  const nameByPorra = new Map(approvedPorras.map(pf => [pf.porra.id, pf.participant.name]));
  const pointsByPorra = new Map(scores.map(s => [s.porra_id, s]));

  const rows = approvedPorras.map(pf => {
    const s = pointsByPorra.get(pf.porra.id);
    return {
      porraId: pf.porra.id,
      totalPoints: s?.total_points ?? 0,
      calculatedAt: s?.calculated_at ?? null,
    };
  });

  return rankByPoints(rows, nameByPorra);
}

/** Día (YYYY-MM-DD) de una fecha en la zona horaria de referencia. */
function dayKeyInTz(d: Date, tz: string): string {
  // 'en-CA' formatea como YYYY-MM-DD, comparable lexicográficamente.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/**
 * Posiciones del ranking tal como estaba AL CIERRE DEL DÍA ANTERIOR (sin contar
 * los partidos de hoy): se recalcula con el motor puro usando solo los partidos
 * finalizados cuyo día (zona RANKING_DAY_TZ, por defecto Europe/Madrid) es
 * anterior al de hoy. Es de solo lectura: no toca porra_scores ni datos.
 *
 * Devuelve porra_id → posición. Vacío si no hay ningún partido de un día previo
 * (p. ej. el primer día del torneo): en ese caso no se muestra indicador.
 */
export async function computePreviousDayPositions(): Promise<Map<string, number>> {
  const tz = process.env.RANKING_DAY_TZ || 'Europe/Madrid';
  const today = dayKeyInTz(new Date(), tz);

  const [allMatches, allEvents, porras, teamPhaseResults, teams, players] = await Promise.all([
    MatchesRepo.findAll(),
    EventsRepo.findAll(),
    PorrasRepo.findAllFull(), // solo approved
    PhaseResultsRepo.findAll(),
    TeamsRepo.findAll(),
    PlayersRepo.findAll(),
  ]);

  // Solo partidos finalizados de días ANTERIORES a hoy (los de hoy aún no cuentan).
  const refMatches = allMatches.filter(
    m => m.status === 'finished' && m.match_date && dayKeyInTz(new Date(m.match_date), tz) < today,
  );
  if (refMatches.length === 0) return new Map();

  const refIds = new Set(refMatches.map(m => m.id));
  const refEvents = allEvents.filter(e => refIds.has(e.match_id));

  // Ningún partido de referencia está 'live' → buildLiveInput/overlay son no-op;
  // el motor ignora los eventos sin confirmar igual que en el recálculo normal.
  const { matches, events, liveIds } = buildLiveInput(refMatches, refEvents);
  const input: CalcInput = { matches, events, teamPhaseResults, porras, teams, players };
  const results = applyLiveOverlay(calcularClasificacion(input), liveIds);

  const nameByPorra = new Map(porras.map(pf => [pf.porra.id, pf.participant.name]));
  const rows = results.map(r => ({ porraId: r.porraId, totalPoints: r.totalPoints, calculatedAt: null }));
  const ordered = rankByPoints(rows, nameByPorra);

  return new Map(ordered.map(e => [e.porraId, e.position]));
}
