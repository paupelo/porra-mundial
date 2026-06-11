/**
 * Cliente HTTP del API JSON no oficial de FIFA (api.fifa.com/api/v3).
 *
 * La página pública de resultados (fifa.com/.../scores-fixtures) es una SPA que
 * se alimenta de estos endpoints; scrapear su HTML no es viable en servidor,
 * así que consumimos directamente el JSON. Es un API sin contrato público:
 * todo el parseo aguas abajo es defensivo y los datos entran como BORRADOR
 * (is_confirmed=0) que el admin revisa antes de que cuente un solo punto.
 */

const BASE_URL = process.env.FIFA_API_BASE ?? 'https://api.fifa.com/api/v3';
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fifaGet<T = unknown>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
      console.log(`[fifa] reintento ${attempt}/${MAX_RETRIES} en ${backoffMs}ms → ${path}`);
      await sleep(backoffMs);
    }
    try {
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          // FIFA rechaza peticiones sin User-Agent de navegador
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} de ${url}`);
        continue; // reintentable
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} de ${url}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`[fifa] agotados los reintentos para ${path}: ${(lastError as Error)?.message ?? lastError}`);
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const FIFA_COMPETITION_ID = process.env.FIFA_COMPETITION_ID ?? '17'; // 17 = FIFA World Cup

export interface FifaListResponse {
  Results?: unknown[];
}

/** Temporadas de la competición (para descubrir el IdSeason del Mundial 2026). */
export function fetchSeasons(): Promise<FifaListResponse> {
  return fifaGet<FifaListResponse>(`/seasons?idCompetition=${FIFA_COMPETITION_ID}&count=100`);
}

/** Calendario completo: todos los partidos con marcador y estado. Una sola petición. */
export function fetchCalendar(seasonId: string): Promise<FifaListResponse> {
  return fifaGet<FifaListResponse>(
    `/calendar/matches?idCompetition=${FIFA_COMPETITION_ID}&idSeason=${seasonId}&language=es&count=500`,
  );
}

/** Timeline de eventos de un partido (goles, tarjetas, penaltis, cambios…). */
export function fetchTimeline(seasonId: string, stageId: string, matchId: string): Promise<{ Event?: unknown[] }> {
  return fifaGet<{ Event?: unknown[] }>(
    `/timelines/${FIFA_COMPETITION_ID}/${seasonId}/${stageId}/${matchId}?language=es`,
  );
}

/** Datos "live" del partido: alineaciones con nombres de jugadores. Disponible también tras el final. */
export function fetchLiveMatch(seasonId: string, stageId: string, matchId: string): Promise<unknown> {
  return fifaGet<unknown>(
    `/live/football/${FIFA_COMPETITION_ID}/${seasonId}/${stageId}/${matchId}?language=es`,
  );
}
