/**
 * Cliente HTTP de BeSoccer (es.besoccer.com) para la fase KO.
 *
 * BeSoccer no tiene API pública; descargamos el HTML de la página del partido y
 * sus sub-páginas (`/eventos`, `/alineaciones`), que SÍ traen el marcador (JSON-LD),
 * los eventos (popups) y las alineaciones server-rendered. El parseo vive en
 * `besoccer/mapper.ts`. En el servidor de Render el `fetch` a besoccer funciona sin
 * el flag TLS que sí hace falta en el Mac de desarrollo.
 */

const BASE_URL = process.env.BESOCCER_BASE_URL ?? 'https://es.besoccer.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'es' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`BeSoccer HTTP ${res.status} en ${url}`);
  return res.text();
}

/** Normaliza una URL o ruta de partido de BeSoccer a su URL base absoluta sin sufijo. */
export function normalizeMatchUrl(input: string): string {
  let u = input.trim();
  // Quitar sufijos de pestaña (/eventos, /alineaciones, /analisis…) y query.
  u = u.split('?')[0].replace(/\/(eventos|alineaciones|analisis|comentarios)\/?$/, '');
  if (u.startsWith('http')) {
    // Forzar el dominio es. para descripción/idioma en español.
    return u.replace(/https?:\/\/[a-z]{2}\.besoccer\.com/, BASE_URL);
  }
  if (!u.startsWith('/')) u = '/' + u;
  return BASE_URL + u;
}

export interface BesoccerPages {
  main: string;
  eventos: string;
  alineaciones: string;
}

/** Descarga las tres páginas relevantes de un partido de BeSoccer. */
export async function fetchBesoccerMatch(matchUrl: string): Promise<BesoccerPages> {
  const base = normalizeMatchUrl(matchUrl);
  const [main, eventos, alineaciones] = await Promise.all([
    fetchHtml(base),
    fetchHtml(`${base}/eventos`).catch(() => ''),
    fetchHtml(`${base}/alineaciones`).catch(() => ''),
  ]);
  return { main, eventos, alineaciones };
}
