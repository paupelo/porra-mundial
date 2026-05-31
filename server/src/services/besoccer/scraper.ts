/**
 * SCRAPER DE BESOCCER — CAPA OPCIONAL
 *
 * IMPORTANTE: Este módulo está DESACTIVADO por defecto (BESOCCER_ENABLED=false).
 * Úsalo solo si tienes permiso explícito según los términos de uso de BeSoccer.
 * Ajusta BESOCCER_DELAY_MS para respetar límites de peticiones.
 *
 * El scraper genera BORRADORES (is_confirmed=0) que el admin debe revisar y confirmar.
 * Nunca impacta directamente en la clasificación.
 */

import https from 'https';

export interface ScraperConfig {
  enabled: boolean;
  baseUrl: string;
  delayMs: number;
}

export function getScraperConfig(): ScraperConfig {
  return {
    enabled: process.env.BESOCCER_ENABLED === 'true',
    baseUrl: process.env.BESOCCER_BASE_URL ?? 'https://es.besoccer.com',
    delayMs: parseInt(process.env.BESOCCER_DELAY_MS ?? '2000', 10),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Descarga el HTML de un partido de BeSoccer dado su identificador.
 * Devuelve el HTML crudo para que el parser lo procese.
 * Lanza error si el scraper está desactivado o la petición falla.
 */
export async function fetchMatchPage(besoccerMatchId: string): Promise<string> {
  const config = getScraperConfig();
  if (!config.enabled) {
    throw new Error('El scraper de BeSoccer está desactivado. Actívalo con BESOCCER_ENABLED=true en .env');
  }
  await sleep(config.delayMs);
  const url = `${config.baseUrl}/partido/resultado/${besoccerMatchId}`;
  return fetchHtml(url);
}
