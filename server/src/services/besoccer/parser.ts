/**
 * Parser de HTML de BeSoccer → borrador de eventos.
 * El borrador resultante tiene is_confirmed=0; el admin lo revisa antes de confirmar.
 *
 * NOTA: BeSoccer puede cambiar su HTML sin aviso. Si el parser falla,
 * el admin debe cargar los datos manualmente. El sistema funciona sin este parser.
 */

export interface PlayerEventDraft {
  playerNameRaw: string;   // Nombre tal como aparece en BeSoccer (para conciliación)
  teamNameRaw: string;
  minutesPlayed: number;
  goalsOpenPlay: number;
  goalsPenaltyPlay: number;
  goalsPenaltyShootout: number;
  assists: number;
  penaltySavedPlay: number;
  penaltySavedShootout: number;
  redCard: boolean;
  penaltyConceded: number;
  penaltyMissedPlay: number;
  penaltyMissedShootout: number;
  ownGoals: number;
  isImprovisedGoalkeeper: boolean;
}

export interface MatchDraft {
  homeTeamNameRaw: string;
  awayTeamNameRaw: string;
  homeScore: number;
  awayScore: number;
  decidedByPenalties: boolean;
  penaltyWinnerRaw: string | null;
  players: PlayerEventDraft[];
}

/**
 * Intenta parsear el HTML de BeSoccer y devolver un borrador estructurado.
 * Si el HTML ha cambiado o no se puede parsear, devuelve null y loguea el error.
 * El caller debe tratar null como "cargar a mano".
 */
export function parseMatchPage(html: string): MatchDraft | null {
  try {
    // La extracción usa RegExp simples intencionalmente: BeSoccer no tiene API pública
    // y su estructura HTML cambia frecuentemente. Si falla, el admin carga a mano.

    const homeScore = parseInt(html.match(/class="[^"]*local[^"]*"[^>]*>(\d+)/)?.[1] ?? 'NaN');
    const awayScore = parseInt(html.match(/class="[^"]*visitante[^"]*"[^>]*>(\d+)/)?.[1] ?? 'NaN');

    if (isNaN(homeScore) || isNaN(awayScore)) {
      console.warn('[Parser] No se pudo extraer el marcador del HTML de BeSoccer');
      return null;
    }

    return {
      homeTeamNameRaw: extractText(html, /class="[^"]*team-local[^"]*"[^>]*>(.*?)<\//) ?? '',
      awayTeamNameRaw: extractText(html, /class="[^"]*team-visitante[^"]*"[^>]*>(.*?)<\//) ?? '',
      homeScore,
      awayScore,
      decidedByPenalties: html.includes('penaltis') || html.includes('penalties'),
      penaltyWinnerRaw: null, // requiere análisis adicional
      players: [], // parseo de jugadores requiere análisis profundo del DOM; dejar vacío para revisión manual
    };
  } catch (e) {
    console.error('[Parser] Error parseando HTML de BeSoccer:', e);
    return null;
  }
}

function extractText(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}
