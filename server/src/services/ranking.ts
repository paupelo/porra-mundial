import { ScoresRepo } from '../repositories/scores.repo';
import { PorrasRepo } from '../repositories/porras.repo';

export interface RankingEntry {
  position: number;
  porraId: string;
  participantName: string;
  totalPoints: number;
  calculatedAt: string | null;
}

/**
 * Calcula el ranking ordenado de porras APROBADAS (mismo criterio que siempre:
 * por puntos desc, empate por nombre alfabético; las porras sin puntuación van
 * con 0 pts). Fuente única de orden para /clasificacion y para los snapshots.
 */
export async function computeRankingEntries(): Promise<RankingEntry[]> {
  const scores = await ScoresRepo.findAll();
  const approvedPorras = await PorrasRepo.findAllFull(); // solo approved

  const scoredIds = new Set(scores.map(s => s.porra_id));
  const unscored = approvedPorras
    .filter(pf => !scoredIds.has(pf.porra.id))
    .map(pf => ({ porra_id: pf.porra.id, total_points: 0, calculated_at: null as string | null }));

  const allEntries = [
    ...scores.filter(s => scoredIds.has(s.porra_id) && approvedPorras.some(pf => pf.porra.id === s.porra_id)),
    ...unscored,
  ].sort((a, b) => {
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    // empate: orden alfabético
    const nameA = approvedPorras.find(pf => pf.porra.id === a.porra_id)?.participant.name ?? '';
    const nameB = approvedPorras.find(pf => pf.porra.id === b.porra_id)?.participant.name ?? '';
    return nameA.localeCompare(nameB, 'es');
  });

  return allEntries.map((s, idx) => {
    const pf = approvedPorras.find(p => p.porra.id === s.porra_id);
    return {
      position: idx + 1,
      porraId: s.porra_id,
      participantName: pf?.participant.name ?? '—',
      totalPoints: s.total_points,
      calculatedAt: s.calculated_at,
    };
  });
}
