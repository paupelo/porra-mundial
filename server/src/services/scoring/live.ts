/**
 * Overlay de puntuación EN VIVO sobre el motor puro (que no se toca).
 *
 * Idea: a cada partido con status='live' se le sintetiza una copia 'finished'
 * con el marcador provisional (live_home/away_score) y sus eventos is_live=1
 * se tratan como confirmados. El motor calcula igual que siempre y después:
 *   - los ítems de partidos en vivo se marcan isLive=true (la UI los etiqueta
 *     como "Provisional"), y
 *   - se eliminan los conceptos que SOLO puntúan con el partido finalizado
 *     (portería a cero, que exige minutos y resultado definitivos).
 *
 * Victoria/empate/derrota provisionales salen solos del marcador parcial y se
 * recalculan en cada poll. Pasar ronda, tanda, ganar el Mundial y MVP vienen
 * de team_phase_results / mvp, que solo existen con partidos finalizados.
 */

import { ClasificacionResult, MatchPlayerEventRecord, MatchRecord, ScoreLineItem } from '../../types';

/** Conceptos que nunca puntúan en vivo (requieren el partido finalizado). */
export const FINAL_ONLY_CONCEPTS = ['porteriaCero', 'porteriaCero(portero)'];

export interface LiveInput {
  matches: MatchRecord[];
  events: MatchPlayerEventRecord[];
  liveIds: Set<string>;
}

/**
 * Entrada efectiva para el motor: partidos en vivo "congelados" al marcador
 * provisional. Función pura.
 */
export function buildLiveInput(matches: MatchRecord[], events: MatchPlayerEventRecord[]): LiveInput {
  const liveIds = new Set(matches.filter(m => m.status === 'live').map(m => m.id));

  const effectiveMatches = matches.map(m =>
    m.status !== 'live' ? m : {
      ...m,
      status: 'finished' as const,
      home_score: m.live_home_score ?? 0,
      away_score: m.live_away_score ?? 0,
      decided_by_penalties: 0 as const,
      penalty_winner_id: null,
    },
  );

  // Los eventos en vivo cuentan provisionalmente SOLO mientras su partido está
  // en vivo; en cualquier otro estado siguen siendo borradores sin confirmar.
  const effectiveEvents = events.map(e =>
    e.is_live === 1 && e.is_confirmed === 0 && liveIds.has(e.match_id)
      ? { ...e, is_confirmed: 1 as const }
      : e,
  );

  return { matches: effectiveMatches, events: effectiveEvents, liveIds };
}

function transformItems(items: ScoreLineItem[], liveIds: Set<string>): ScoreLineItem[] {
  return items
    .filter(it => !(it.matchId && liveIds.has(it.matchId) && FINAL_ONLY_CONCEPTS.includes(it.concept)))
    .map(it => (it.matchId && liveIds.has(it.matchId) ? { ...it, isLive: true } : it));
}

/**
 * Post-procesa la salida del motor: marca ítems provisionales, quita los
 * conceptos solo-finales de partidos en vivo y recalcula totales y posiciones.
 * Función pura. Si no hay partidos en vivo devuelve los resultados intactos.
 */
export function applyLiveOverlay(results: ClasificacionResult[], liveIds: Set<string>): ClasificacionResult[] {
  if (liveIds.size === 0) return results;

  const transformed = results.map(r => {
    const selecciones = r.breakdown.selecciones.map(sel => {
      const items = transformItems(sel.items, liveIds);
      return { ...sel, items, totalPoints: items.reduce((s, i) => s + i.finalPoints, 0) };
    });
    const jugadores = r.breakdown.jugadores.map(jug => {
      const items = transformItems(jug.items, liveIds);
      return { ...jug, items, totalPoints: items.reduce((s, i) => s + i.finalPoints, 0) };
    });
    const totalPoints =
      selecciones.reduce((s, t) => s + t.totalPoints, 0) +
      jugadores.reduce((s, j) => s + j.totalPoints, 0);
    return { ...r, totalPoints, breakdown: { selecciones, jugadores } };
  });

  transformed.sort((a, b) => b.totalPoints - a.totalPoints);
  return transformed.map((r, idx) => ({ ...r, position: idx + 1 }));
}
