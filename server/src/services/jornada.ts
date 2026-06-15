/**
 * Jornada/ronda EN CURSO del torneo y progreso por participante.
 *
 * Funciones PURAS (sin I/O): reciben los partidos, las porras y el catálogo de
 * jugadores y derivan, sin tocar ningún dato, qué ronda está activa y cuántas
 * selecciones/jugadores de cada participante ya han disputado partido en ella.
 *
 * NO altera puntuaciones ni scoring: es una proyección informativa. La
 * pertenencia jugador→selección es la misma que usa el motor (`player.team_id`)
 * y "partido disputado" = el mismo criterio del resto de la app (status live o
 * finished). El modelo de datos NO se modifica: la jornada de la fase de grupos
 * se deriva (no hay columna `matchday`).
 */

import { MatchRecord, Phase, PlayerRecord, PorraFull } from '../types';

const PHASE_ORDER: Phase[] = ['grupos', 'dieciseisavos', 'octavos', 'cuartos', 'semifinales', 'final'];

const PHASE_LABELS: Record<Phase, string> = {
  grupos: 'Fase de grupos',
  dieciseisavos: 'Dieciseisavos',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semifinales: 'Semifinales',
  final: 'Final',
};

export interface RoundId {
  phase: Phase;
  /** Jornada 1/2/3 solo en fase de grupos; null en eliminatorias. */
  matchday: number | null;
}

/** Clave estable de una ronda, p. ej. "grupos-2" u "octavos". */
export function roundKey(r: RoundId): string {
  return r.phase === 'grupos' ? `grupos-${r.matchday ?? 1}` : r.phase;
}

/** Etiqueta legible: "Jornada 2 · Fase de grupos" o "Octavos". */
export function roundLabel(r: RoundId): string {
  if (r.phase === 'grupos') return `Jornada ${r.matchday ?? 1} · Fase de grupos`;
  return PHASE_LABELS[r.phase];
}

/** Orden cronológico de rondas (grupos J1 < J2 < J3 < dieciseisavos < … < final). */
export function roundIndex(r: RoundId): number {
  const base = PHASE_ORDER.indexOf(r.phase);
  return r.phase === 'grupos' ? base * 10 + (r.matchday ?? 1) : base * 10;
}

/**
 * Deriva la jornada (1/2/3) de cada partido de la fase de grupos: dentro de un
 * grupo, los partidos se ordenan por fecha y se reparten en 3 jornadas (cada
 * equipo juega su jornada 1 antes que la 2, etc.). Devuelve matchId → jornada.
 */
export function deriveGroupMatchdays(matches: MatchRecord[]): Map<string, number> {
  const byGroup = new Map<string, MatchRecord[]>();
  for (const m of matches) {
    if (m.phase !== 'grupos') continue;
    const g = m.group_name ?? '∅';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  }
  const out = new Map<string, number>();
  for (const ms of byGroup.values()) {
    const sorted = [...ms].sort(
      (a, b) => (a.match_date ?? '').localeCompare(b.match_date ?? '') || a.id.localeCompare(b.id),
    );
    const perMatchday = Math.max(1, Math.round(sorted.length / 3));
    sorted.forEach((m, i) => out.set(m.id, Math.min(3, Math.floor(i / perMatchday) + 1)));
  }
  return out;
}

/** Ronda a la que pertenece un partido (usa el mapa de jornadas de grupos). */
export function roundIdOf(match: MatchRecord, matchdays: Map<string, number>): RoundId {
  return match.phase === 'grupos'
    ? { phase: 'grupos', matchday: matchdays.get(match.id) ?? 1 }
    : { phase: match.phase, matchday: null };
}

/**
 * Ronda EN CURSO: la "frontera" del torneo = la ronda de menor índice que aún
 * tiene partidos sin finalizar (en vivo o programados). Así, en cuanto toda una
 * jornada termina, la actual pasa automáticamente a la siguiente (el contador
 * se reinicia). Si ya está todo finalizado, devuelve la ronda más avanzada.
 */
export function currentRound(matches: MatchRecord[], matchdays: Map<string, number>): RoundId {
  if (matches.length === 0) return { phase: 'grupos', matchday: 1 };
  const nonFinished = matches.filter(m => m.status !== 'finished');
  if (nonFinished.length > 0) {
    return nonFinished
      .map(m => roundIdOf(m, matchdays))
      .reduce((a, b) => (roundIndex(b) < roundIndex(a) ? b : a));
  }
  return matches
    .map(m => roundIdOf(m, matchdays))
    .reduce((a, b) => (roundIndex(b) > roundIndex(a) ? b : a));
}

/** Un partido cuenta como "disputado" si ya empezó (en vivo) o terminó. */
function hasStarted(m: MatchRecord): boolean {
  return m.status === 'live' || m.status === 'finished';
}

export interface ProgresoParticipante {
  porraId: string;
  participantId: string;
  participantName: string;
  selecciones: { disputadas: number; total: number };
  jugadores: { disputados: number; total: number };
}

export interface ProgresoJornada {
  jornada: { key: string; label: string };
  participantes: ProgresoParticipante[];
}

/**
 * Progreso de la jornada en curso por participante: cuántas de sus selecciones
 * y de sus jugadores alineados tienen partido en esa ronda y cuántos de esos
 * partidos ya se han disputado.
 */
export function computeProgresoJornada(
  matches: MatchRecord[],
  porras: PorraFull[],
  players: PlayerRecord[],
): ProgresoJornada {
  const matchdays = deriveGroupMatchdays(matches);
  const round = currentRound(matches, matchdays);
  const roundK = roundKey(round);

  // Equipo → ¿juega en la ronda actual y ya empezó su partido?
  const teamInRound = new Map<string, { started: boolean }>();
  for (const m of matches) {
    if (roundKey(roundIdOf(m, matchdays)) !== roundK) continue;
    for (const teamId of [m.home_team_id, m.away_team_id]) {
      const prev = teamInRound.get(teamId);
      teamInRound.set(teamId, { started: (prev?.started ?? false) || hasStarted(m) });
    }
  }

  const teamByPlayer = new Map(players.map(p => [p.id, p.team_id]));

  const participantes: ProgresoParticipante[] = porras.map(pf => {
    let selTotal = 0, selPlayed = 0;
    for (const sel of pf.selections) {
      const t = teamInRound.get(sel.team_id);
      if (t) { selTotal++; if (t.started) selPlayed++; }
    }
    let jugTotal = 0, jugPlayed = 0;
    for (const lu of pf.lineup) {
      const teamId = teamByPlayer.get(lu.player_id);
      if (!teamId) continue;
      const t = teamInRound.get(teamId);
      if (t) { jugTotal++; if (t.started) jugPlayed++; }
    }
    return {
      porraId: pf.porra.id,
      participantId: pf.participant.id,
      participantName: pf.participant.name,
      selecciones: { disputadas: selPlayed, total: selTotal },
      jugadores: { disputados: jugPlayed, total: jugTotal },
    };
  });

  return { jornada: { key: roundK, label: roundLabel(round) }, participantes };
}
