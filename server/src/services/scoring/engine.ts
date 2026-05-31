import {
  CalcInput,
  ClasificacionResult,
  MatchPlayerEventRecord,
  PlayerRecord,
  PorraFull,
  PorraScoreResult,
  TeamRecord,
} from '../../types';
import { calcTeamScore } from './selecciones';
import { calcPlayerScore } from './jugadores';

/**
 * Motor de cálculo principal.
 * Función pura: dados los eventos confirmados + porras + catálogos → clasificación.
 */
export function calcularClasificacion(input: CalcInput): ClasificacionResult[] {
  const { matches, events, teamPhaseResults, porras, teams, players } = input;

  // Índices para búsqueda eficiente
  const teamById = new Map<string, TeamRecord>(teams.map(t => [t.id, t]));
  const playerById = new Map<string, PlayerRecord>(players.map(p => [p.id, p]));

  // Solo eventos confirmados, agrupados por jugador y partido
  const confirmedEvents = events.filter(e => e.is_confirmed === 1);
  // eventsByPlayer: playerId → Map<matchId, event>
  const eventsByPlayer = new Map<string, Map<string, MatchPlayerEventRecord>>();
  for (const ev of confirmedEvents) {
    if (!eventsByPlayer.has(ev.player_id)) {
      eventsByPlayer.set(ev.player_id, new Map());
    }
    eventsByPlayer.get(ev.player_id)!.set(ev.match_id, ev);
  }

  const results: PorraScoreResult[] = porras.map(porra =>
    calcPorraScore(porra, { teamById, playerById, eventsByPlayer, matches, teamPhaseResults }),
  );

  // Ordenar por puntos descendente y asignar posición
  results.sort((a, b) => b.totalPoints - a.totalPoints);

  return results.map((r, idx) => ({
    position: idx + 1,
    porraId: r.porraId,
    participantId: r.participantId,
    participantName: r.participantName,
    totalPoints: r.totalPoints,
    breakdown: {
      selecciones: r.selecciones,
      jugadores: r.jugadores,
    },
  }));
}

// ─── Cálculo de una porra individual ─────────────────────────────────────────

interface CalcContext {
  teamById: Map<string, TeamRecord>;
  playerById: Map<string, PlayerRecord>;
  eventsByPlayer: Map<string, Map<string, MatchPlayerEventRecord>>;
  matches: CalcInput['matches'];
  teamPhaseResults: CalcInput['teamPhaseResults'];
}

function calcPorraScore(porra: PorraFull, ctx: CalcContext): PorraScoreResult {
  const { teamById, playerById, eventsByPlayer, matches, teamPhaseResults } = ctx;

  // ── Selecciones ────────────────────────────────────────────────────────────
  const selecciones = porra.selections.map(sel => {
    const team = teamById.get(sel.team_id);
    if (!team) return null;
    return calcTeamScore(team, sel.is_winner === 1, matches, teamPhaseResults);
  }).filter(Boolean) as ReturnType<typeof calcTeamScore>[];

  // ── Jugadores ──────────────────────────────────────────────────────────────
  // Titulares agrupados por línea (para activar suplentes)
  const lineupBySlot = new Map<string, string[]>(); // positionSlot → [teamId de titulares]
  for (const lu of porra.lineup) {
    if (lu.role === 'titular') {
      const p = playerById.get(lu.player_id);
      if (p) {
        const slot = lu.position_slot;
        if (!lineupBySlot.has(slot)) lineupBySlot.set(slot, []);
        lineupBySlot.get(slot)!.push(p.team_id);
      }
    }
  }

  const jugadores = porra.lineup.map(lu => {
    const player = playerById.get(lu.player_id);
    if (!player) return null;

    const playerEvents = eventsByPlayer.get(lu.player_id) ?? new Map();
    const lineStarterTeamIds = lu.role === 'suplente'
      ? (lineupBySlot.get(lu.position_slot) ?? [])
      : [];
    const isMvp = porra.mvpPlayerId === lu.player_id;

    return calcPlayerScore(
      player,
      lu.role,
      lu.position_slot,
      lu.is_captain === 1,
      lineStarterTeamIds,
      matches,
      playerEvents,
      teamPhaseResults,
      isMvp,
    );
  }).filter(Boolean) as ReturnType<typeof calcPlayerScore>[];

  const totalPoints =
    selecciones.reduce((s, t) => s + t.totalPoints, 0) +
    jugadores.reduce((s, j) => s + j.totalPoints, 0);

  return {
    porraId: porra.porra.id,
    participantId: porra.participant.id,
    participantName: porra.participant.name,
    totalPoints,
    selecciones,
    jugadores,
  };
}
