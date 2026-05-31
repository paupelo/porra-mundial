import {
  LineupRole,
  MatchPlayerEventRecord,
  MatchRecord,
  Phase,
  PlayerRecord,
  PlayerScoreResult,
  Position,
  ScoreLineItem,
  TeamPhaseResultRecord,
} from '../../types';
import { getPasaRondaMultiplier, getPhaseMultiplier, isBefore } from './multipliers';
import {
  calcDelanteroGoals,
  calcMedioAssists,
  calcMedioGoals,
  PENALTIES,
  PLAYER_SCORING,
} from './scoring-tables';

// ─── Helper para crear un ScoreLineItem de jugador ───────────────────────────

function pItem(
  concept: string,
  phase: Phase,
  basePoints: number,
  phaseMultiplier: number,
  captainMult: number,
  suplenteMult: number,
  matchId?: string,
): ScoreLineItem {
  const roleMultiplier = captainMult * suplenteMult;
  const finalPoints = basePoints * phaseMultiplier * roleMultiplier;
  return { concept, matchId, phase, basePoints, phaseMultiplier, winnerMultiplier: 1, roleMultiplier, finalPoints };
}

// ─── Lógica suplente ─────────────────────────────────────────────────────────

/**
 * Devuelve true si el suplente ha sido "activado" (línea incompleta) ANTES
 * de la fase indicada. La activación ocurre cuando algún titular de su línea
 * tiene su equipo eliminado antes de esa fase.
 */
function isSuplenteFull(
  lineStarterTeamIds: string[],
  beforePhase: Phase,
  allPhaseResults: TeamPhaseResultRecord[],
): boolean {
  return lineStarterTeamIds.some(teamId =>
    allPhaseResults.some(
      pr => pr.team_id === teamId && pr.result === 'eliminated' && isBefore(pr.phase, beforePhase),
    ),
  );
}

// ─── Puntuación de jugadores por partido ─────────────────────────────────────

function calcMatchPoints(
  player: PlayerRecord,
  event: MatchPlayerEventRecord,
  match: MatchRecord,
  captainMult: number,
  suplenteMult: number,
  isImprovisedGoalkeeper: boolean,
): ScoreLineItem[] {
  const items: ScoreLineItem[] = [];
  const pos = isImprovisedGoalkeeper ? player.position : player.position;
  const effectivePos: Position = isImprovisedGoalkeeper ? 'portero' : player.position;
  const mult = getPhaseMultiplier(match.phase);
  const mid = match.id;

  // Jugador de campo como portero: mérito adicional plano
  if (isImprovisedGoalkeeper) {
    items.push(pItem('porteroImprovicado', match.phase, PENALTIES.porteroImprovicado, 1, captainMult, suplenteMult, mid));
  }

  // Por jugar
  if (event.minutes_played > 0) {
    const scoring = PLAYER_SCORING[player.position];
    items.push(pItem('porJugar', match.phase, scoring.porJugar, mult, captainMult, suplenteMult, mid));

    // Si es portero improvicado, también suma "por jugar" de portero (ya está arriba como posición natural)
    if (isImprovisedGoalkeeper) {
      items.push(pItem('porJugar(portero)', match.phase, PLAYER_SCORING.portero.porJugar, mult, captainMult, suplenteMult, mid));
    }
  }

  // ── Portería a cero ───────────────────────────────────────────────────────
  const isHome = match.home_team_id === event.team_id;
  const goalsConceded = isHome ? (match.away_score ?? 0) : (match.home_score ?? 0);

  // Portería a cero: ≥60 min, 0 goles en tiempo reglamentario, no cuenta tanda
  const qualifiesPorteriaCero = event.minutes_played >= 60 && goalsConceded === 0;

  if (qualifiesPorteriaCero) {
    // Posición natural para portería a cero
    const pcPts = PLAYER_SCORING[player.position].porteriaCero;
    if (pcPts !== null) {
      items.push(pItem('porteriaCero', match.phase, pcPts, mult, captainMult, suplenteMult, mid));
    }
    // Si es portero improvicado, además cuenta como portero
    if (isImprovisedGoalkeeper) {
      const pcPortero = PLAYER_SCORING.portero.porteriaCero!;
      items.push(pItem('porteriaCero(portero)', match.phase, pcPortero, mult, captainMult, suplenteMult, mid));
    }
  }

  // ── Gol encajado (portero y defensa) ─────────────────────────────────────
  const golEncPts = PLAYER_SCORING[player.position].golEncajado;
  if (golEncPts !== null && event.minutes_played > 0 && goalsConceded > 0) {
    items.push(pItem('golEncajado', match.phase, golEncPts * goalsConceded, mult, captainMult, suplenteMult, mid));
  }
  if (isImprovisedGoalkeeper && event.minutes_played > 0 && goalsConceded > 0) {
    const golEncPortero = PLAYER_SCORING.portero.golEncajado!;
    items.push(pItem('golEncajado(portero)', match.phase, golEncPortero * goalsConceded, mult, captainMult, suplenteMult, mid));
  }

  // ── Penalti parado ────────────────────────────────────────────────────────
  const ppPts = isImprovisedGoalkeeper
    ? PLAYER_SCORING.portero.penaltiParado!
    : PLAYER_SCORING[player.position].penaltiParado;
  if (ppPts !== null && event.penalty_saved_play > 0) {
    items.push(pItem('penaltiParado', match.phase, ppPts * event.penalty_saved_play, mult, captainMult, suplenteMult, mid));
  }
  if ((ppPts !== null || isImprovisedGoalkeeper) && event.penalty_saved_shootout > 0) {
    const ppShoot = (isImprovisedGoalkeeper ? PLAYER_SCORING.portero.penaltiParado! : ppPts!) / 2;
    items.push(pItem('penaltiParadoTanda', match.phase, ppShoot * event.penalty_saved_shootout, mult, captainMult, suplenteMult, mid));
  }

  // ── Goles ─────────────────────────────────────────────────────────────────
  const regularGoals = event.goals_open_play + event.goals_penalty_play;
  if (regularGoals > 0 || event.goals_penalty_shootout > 0) {
    // Puntos por goles según posición natural
    let goalPts = 0;
    const naturalPos = player.position;
    if (naturalPos === 'portero' || naturalPos === 'defensa') {
      goalPts = PLAYER_SCORING[naturalPos].gol * regularGoals;
    } else if (naturalPos === 'medio') {
      goalPts = calcMedioGoals(regularGoals);
    } else {
      goalPts = calcDelanteroGoals(regularGoals);
    }
    if (goalPts !== 0) {
      items.push(pItem('goles', match.phase, goalPts, mult, captainMult, suplenteMult, mid));
    }
    // Goles en tanda: mitad del valor unitario, NO cuentan para doblete/hat-trick
    if (event.goals_penalty_shootout > 0) {
      const goalUnitValue = PLAYER_SCORING[naturalPos].gol;
      const shootoutGoalPts = (goalUnitValue / 2) * event.goals_penalty_shootout;
      items.push(pItem('golesTanda', match.phase, shootoutGoalPts, mult, captainMult, suplenteMult, mid));
    }
  }

  // ── Asistencias ───────────────────────────────────────────────────────────
  if (event.assists > 0) {
    let assistPts = 0;
    const naturalPos = player.position;
    if (naturalPos === 'medio') {
      assistPts = calcMedioAssists(event.assists);
    } else {
      assistPts = PLAYER_SCORING[naturalPos].asistencia * event.assists;
    }
    items.push(pItem('asistencias', match.phase, assistPts, mult, captainMult, suplenteMult, mid));
  }

  // ── Penalizaciones (sin multiplicador de fase; son sanciones deportivas) ──
  // Nota de diseño: las penalizaciones no se multiplican por fase (son sanciones, no méritos)
  if (event.penalty_conceded > 0) {
    items.push(pItem('penaltiCometido', match.phase, PENALTIES.penaltiCometido * event.penalty_conceded, 1, captainMult, suplenteMult, mid));
  }
  if (event.penalty_missed_play > 0) {
    items.push(pItem('penaltiFalladoJuego', match.phase, PENALTIES.penaltiAlladoPlay * event.penalty_missed_play, 1, captainMult, suplenteMult, mid));
  }
  if (event.penalty_missed_shootout > 0) {
    items.push(pItem('penaltiFalladoTanda', match.phase, PENALTIES.penaltiAlladoShootout * event.penalty_missed_shootout, 1, captainMult, suplenteMult, mid));
  }
  if (event.red_card) {
    items.push(pItem('tarjetaRoja', match.phase, PENALTIES.tarjetaRoja, 1, captainMult, suplenteMult, mid));
  }
  if (event.own_goals > 0) {
    items.push(pItem('golEnPropiaMeta', match.phase, PENALTIES.golEnPropiaMeta * event.own_goals, 1, captainMult, suplenteMult, mid));
  }

  return items;
}

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * Calcula todos los puntos de UN jugador para UNA porra.
 * Función pura.
 */
export function calcPlayerScore(
  player: PlayerRecord,
  role: LineupRole,
  positionSlot: Position,
  isCaptain: boolean,
  /** IDs de equipos de los titulares de su misma línea (solo si es suplente) */
  lineStarterTeamIds: string[],
  allMatches: MatchRecord[],
  /** Mapa matchId → evento de este jugador */
  eventsByMatchId: Map<string, MatchPlayerEventRecord>,
  allPhaseResults: TeamPhaseResultRecord[],
  isMvp: boolean,
): PlayerScoreResult {
  const captainMult = isCaptain ? 2 : 1;
  const items: ScoreLineItem[] = [];

  // Partidos en los que tiene evento este jugador
  const playerMatches = allMatches.filter(
    m => m.status === 'finished' && eventsByMatchId.has(m.id),
  );

  for (const match of playerMatches) {
    const event = eventsByMatchId.get(match.id)!;
    const isImprovGoalkeeper = event.is_improvised_goalkeeper === 1;

    // Factor de suplente para ESTE partido
    let suplenteMult = 1;
    if (role === 'suplente') {
      const activated = isSuplenteFull(lineStarterTeamIds, match.phase, allPhaseResults);
      suplenteMult = activated ? 1 : 0.5;
    }

    const matchItems = calcMatchPoints(player, event, match, captainMult, suplenteMult, isImprovGoalkeeper);
    items.push(...matchItems);

    // Pasar ronda: el jugador también cobra +15 × multiplicador cuando su equipo avanza
    const teamAdvance = allPhaseResults.find(
      pr => pr.team_id === event.team_id && pr.phase === match.phase && pr.result === 'advanced',
    );
    if (teamAdvance) {
      const prMult = getPasaRondaMultiplier(match.phase);
      items.push(pItem(`pasaRonda`, match.phase, PENALTIES.pasaRondaJugador, prMult, captainMult, suplenteMult, match.id));
    }
  }

  // MVP: bonus plano al final del torneo (sin multiplicador de fase)
  if (isMvp) {
    items.push(pItem('mvpMundial', 'final', PENALTIES.mvpMundial, 1, captainMult, 1));
  }

  const totalPoints = items.reduce((sum, i) => sum + i.finalPoints, 0);

  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    teamId: player.team_id,
    role,
    positionSlot,
    isCaptain,
    totalPoints,
    items,
  };
}
