import {
  Category,
  MatchRecord,
  Phase,
  ScoreLineItem,
  TeamPhaseResultRecord,
  TeamRecord,
  TeamScoreResult,
} from '../../types';
import { getNextPhase, getPasaRondaMultiplier, getPhaseMultiplier, isBefore } from './multipliers';
import { TEAM_SCORING } from './scoring-tables';

function item(
  concept: string,
  phase: Phase,
  basePoints: number,
  phaseMultiplier: number,
  winnerMultiplier: number,
  matchId?: string,
): ScoreLineItem {
  const finalPoints = basePoints * phaseMultiplier * winnerMultiplier;
  return { concept, matchId, phase, basePoints, phaseMultiplier, winnerMultiplier, roleMultiplier: 1, finalPoints };
}

/**
 * Calcula todos los puntos de UNA selección para UNA porra.
 * Función pura: no toca la BD.
 */
export function calcTeamScore(
  team: TeamRecord,
  isWinner: boolean,
  allMatches: MatchRecord[],
  allPhaseResults: TeamPhaseResultRecord[],
): TeamScoreResult {
  const scoring = TEAM_SCORING[team.category as Category];
  const wMult = isWinner ? 2 : 1;
  const items: ScoreLineItem[] = [];

  // Partidos del equipo (solo finalizados)
  const teamMatches = allMatches.filter(
    m => m.status === 'finished' && (m.home_team_id === team.id || m.away_team_id === team.id),
  );

  for (const match of teamMatches) {
    const isHome = match.home_team_id === team.id;
    const teamScore = isHome ? match.home_score! : match.away_score!;
    const oppScore  = isHome ? match.away_score! : match.home_score!;
    const mult = getPhaseMultiplier(match.phase);

    // La rama de penaltis exige marcador empatado: una tanda solo existe tras
    // empate, así que un flag corrupto jamás convierte una victoria en empate.
    if (match.decided_by_penalties && teamScore === oppScore) {
      // Penaltis → ambos equipos suman empate; el ganador suma además ganarPenaltis
      items.push(item('empate', match.phase, scoring.empate, mult, wMult, match.id));
      if (match.penalty_winner_id === team.id) {
        items.push(item('ganarPenaltis', match.phase, scoring.ganarPenaltis, mult, wMult, match.id));
      }
    } else if (teamScore > oppScore) {
      items.push(item('victoria', match.phase, scoring.victoria, mult, wMult, match.id));
    } else if (teamScore === oppScore) {
      items.push(item('empate', match.phase, scoring.empate, mult, wMult, match.id));
    } else {
      items.push(item('derrota', match.phase, scoring.derrota, mult, wMult, match.id));
    }
  }

  // Resultados de fase (pasar ronda, eliminaciones, ganador)
  const phaseResults = allPhaseResults.filter(r => r.team_id === team.id);

  for (const pr of phaseResults) {
    if (pr.result === 'advanced') {
      const nextPhase = getNextPhase(pr.phase);
      if (nextPhase) {
        const mult = getPasaRondaMultiplier(pr.phase);
        items.push(item(`pasaRonda→${nextPhase}`, pr.phase, scoring.pasaRonda, mult, wMult));
      }
    } else if (pr.result === 'winner') {
      // Ganar Mundial es un bonus plano (multiplicador de fase = 1 siempre)
      items.push(item('ganarMundial', pr.phase, scoring.ganarMundial, 1, wMult));
    } else if (pr.result === 'eliminated') {
      // Penalizaciones planas (sin multiplicador de fase)
      if (pr.phase === 'grupos') {
        items.push(item('noDeciseisvos', pr.phase, scoring.noDeciseisvos, 1, 1));
      } else if (pr.phase === 'dieciseisavos') {
        items.push(item('noOctavos', pr.phase, scoring.noOctavos, 1, 1));
      }
    }
  }

  const totalPoints = items.reduce((sum, i) => sum + i.finalPoints, 0);

  return {
    teamId: team.id,
    teamName: team.name,
    category: team.category as Category,
    isWinner,
    totalPoints,
    items,
  };
}
