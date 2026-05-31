import { Phase } from '../../types';

/** Multiplicador de fase para puntos de partido y jugadores. */
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
