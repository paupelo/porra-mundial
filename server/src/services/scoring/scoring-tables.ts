import { Category, Position } from '../../types';

// ─── Tabla de puntuación de selecciones ───────────────────────────────────────

export interface TeamScoringRow {
  victoria: number;
  empate: number;
  derrota: number;
  /** Penalización plana si no llega a dieciseisavos (eliminado en grupos) */
  noDeciseisvos: number;
  /** Penalización plana si no llega a octavos (eliminado en dieciseisavos) */
  noOctavos: number;
  ganarPenaltis: number;
  pasaRonda: number;
  /** Bonus plano (no se multiplica por fase) */
  ganarMundial: number;
}

export const TEAM_SCORING: Record<Category, TeamScoringRow> = {
  favoritos:  { victoria: 10, empate:  1, derrota: -20, noDeciseisvos: -100, noOctavos:  -50, ganarPenaltis:  5, pasaRonda:  10, ganarMundial:  50 },
  sorpresas:  { victoria: 20, empate:  5, derrota: -10, noDeciseisvos:  -50, noOctavos:  -25, ganarPenaltis: 10, pasaRonda:  20, ganarMundial: 100 },
  petardazos: { victoria: 30, empate: 10, derrota:  -5, noDeciseisvos:  -25, noOctavos:  -10, ganarPenaltis: 20, pasaRonda:  40, ganarMundial: 200 },
  caca:       { victoria: 40, empate: 20, derrota:   0, noDeciseisvos:  -10, noOctavos:    0, ganarPenaltis: 40, pasaRonda:  80, ganarMundial: 400 },
};

// ─── Tabla de puntuación de jugadores ─────────────────────────────────────────

export interface PlayerScoringRow {
  porJugar: number;
  porteriaCero: number | null;
  golEncajado: number | null;
  penaltiParado: number | null;
  /** Puntos por asistencia (1 asistencia). Reglas especiales para Medio. */
  asistencia: number;
  /** Puntos por gol (1 gol). Reglas especiales para Medio y Delantero. */
  gol: number;
}

export const PLAYER_SCORING: Record<Position, PlayerScoringRow> = {
  portero:   { porJugar: 5, porteriaCero:  15, golEncajado: -5, penaltiParado: 30, asistencia: 50, gol: 50 },
  defensa:   { porJugar: 5, porteriaCero:  10, golEncajado: -5, penaltiParado: null, asistencia: 20, gol: 30 },
  medio:     { porJugar: 5, porteriaCero: null, golEncajado: null, penaltiParado: null, asistencia: 15, gol: 25 },
  delantero: { porJugar: 5, porteriaCero: null, golEncajado: null, penaltiParado: null, asistencia: 10, gol: 20 },
};

// ─── Penalizaciones y extras (independientes de posición base) ────────────────

export const PENALTIES = {
  penaltiCometido:         -15,
  penaltiAlladoPlay:       -20,  // penalti fallado en juego
  // NOTA: la TANDA de penaltis ya NO puntúa a jugadores (solo a selecciones).
  // Esta constante se conserva por documentación/histórico, pero el motor de
  // jugadores (jugadores.ts) ignora todos los eventos de tanda por diseño.
  penaltiAlladoShootout:   -10,  // penalti fallado en tanda (NO se aplica a jugadores)
  tarjetaRoja:             -20,
  golEnPropiaMeta:         -15,
  pasaRondaJugador:         15,
  mvpMundial:               50,
  porteroImprovicado:       30,  // bonus de mérito adicional
} as const;

// ─── Lógica especial de goles ─────────────────────────────────────────────────

/**
 * Calcula los puntos de goles (en juego) para Delantero.
 * - 1 gol:   20
 * - 2 goles (doblete):  50
 * - 3 goles (hat-trick): 90
 * - Cada gol adicional: +30
 */
export function calcDelanteroGoals(goals: number): number {
  if (goals <= 0) return 0;
  if (goals === 1) return 20;
  if (goals === 2) return 50;
  return 90 + (goals - 3) * 30;
}

/**
 * Calcula los puntos de goles (en juego) para Medio.
 * - 1 gol: 25, 2 goles: 50 (lineal), 3 goles (hat-trick): 90
 * - Cada gol adicional: +30
 */
export function calcMedioGoals(goals: number): number {
  if (goals <= 0) return 0;
  if (goals < 3) return goals * 25;
  return 90 + (goals - 3) * 30;
}

/**
 * Calcula los puntos de asistencias para Medio.
 * - 1 asist: 15
 * - 2 asist (doble asistencia): 40 total
 * - Cada asistencia adicional: +25
 */
export function calcMedioAssists(assists: number): number {
  if (assists <= 0) return 0;
  if (assists === 1) return 15;
  return 40 + (assists - 2) * 25;
}
