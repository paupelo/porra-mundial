import { Phase } from '../../types';

/**
 * Multiplicador de fase para puntos de partido y jugadores.
 *
 * Tabla oficial: grupos/dieciseisavos/octavos ×1 · cuartos ×1.5 · semis ×2 · final ×3.
 *
 * Criterio de redondeo: NO se redondea nunca. Los puntos se calculan y persisten
 * con su valor exacto (columnas DOUBLE PRECISION). Con ×1.5 y el ×0.5 de suplente
 * la granularidad mínima es 0.25 puntos, sin errores de coma flotante acumulables
 * en la práctica; el frontend muestra el valor tal cual (7.5, 22.5, 2925.75…).
 */
export function getPhaseMultiplier(phase: Phase): number {
  switch (phase) {
    case 'grupos':
    case 'dieciseisavos':
    case 'octavos':
      return 1;
    case 'cuartos':
      return 1.5;
    case 'semifinales':
      return 2;
    case 'final':
      return 3;
  }
}

const PHASE_ORDER: Phase[] = [
  'grupos',
  'dieciseisavos',
  'octavos',
  'cuartos',
  'semifinales',
  'final',
];

export function getPhaseIndex(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

/**
 * Devuelve la siguiente fase (a la que se accede al pasar de ronda).
 * Devuelve null si ya es la final (no hay siguiente).
 */
export function getNextPhase(phase: Phase): Phase | null {
  const idx = getPhaseIndex(phase);
  return idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

/**
 * Multiplicador a usar para el bonus "Pasar Ronda":
 * se aplica el multiplicador de la fase a la que se ACCEDE.
 */
export function getPasaRondaMultiplier(currentPhase: Phase): number {
  const next = getNextPhase(currentPhase);
  return next ? getPhaseMultiplier(next) : 0;
}

/** True si la fase A es anterior a la fase B en el orden del torneo. */
export function isBefore(a: Phase, b: Phase): boolean {
  return getPhaseIndex(a) < getPhaseIndex(b);
}
