/**
 * Parser de BeSoccer (es.besoccer.com) → dominio de la porra, para la fase KO.
 *
 * BeSoccer NO publica API JSON pública, pero SÍ renderiza en el HTML:
 *  - JSON-LD `SportsEvent`: equipos y, en `description`, el marcador ("X - Y").
 *  - Eventos en bloques `popup_event_orderMin_{orden}_{minuto}_{idJugador}` con el
 *    tipo (`<span class="t-up">Gol|Sustitución|Tarjeta…</span>`), el lado
 *    (`alt="local"|"visitor"`) y el/los jugador(es) (`/jugador/{slug}-{id}` + alt).
 *  - Alineaciones en `panel-lineup` (titulares) / `panel-bench` (suplentes).
 *
 * Verificado contra datos reales del Mundial 2026 (Argelia 3-3 Austria: goles de
 * Mahrez 60'/93', Arnautović 28', Sabitzer 55', Kalajdžić 96' + cambios; y la
 * alineación de Sudáfrica-Canadá EN VIVO). El resultado entra como BORRADOR
 * (is_confirmed=0) por el mismo pipeline que FIFA; el admin puede corregir.
 *
 * Reutiliza los tipos del mapper de FIFA (PlayerTally/GoalEvent/LineupEntry) para
 * poder pasar por `reconcileAndSaveTallies` sin duplicar la capa de guardado.
 */

import { GoalEvent, LineupEntry, PlayerTally } from '../fifa/mapper';

export type Side = 'local' | 'visitor';

function emptyTally(playerId: string, side: Side): PlayerTally {
  return {
    fifaPlayerId: playerId, fifaTeamId: side,
    goals_open_play: 0, goals_penalty_play: 0, goals_penalty_shootout: 0,
    assists: 0, penalty_saved_play: 0, penalty_saved_shootout: 0,
    red_card: 0, penalty_conceded: 0,
    penalty_missed_play: 0, penalty_missed_shootout: 0,
    own_goals: 0, minutes_played: 0,
    minute_in: 0, minute_out: null,
  };
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// ─── Marcador y estado desde el JSON-LD ──────────────────────────────────────

export interface BesoccerScore {
  homeScore: number | null;
  awayScore: number | null;
  homeTeamRaw: string;
  awayTeamRaw: string;
  decidedByPenalties: boolean;
}

/** Devuelve el primer JSON-LD `SportsEvent` parseado del HTML. */
function firstSportsEvent(html: string): Record<string, any> | null {
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b.replace(/<script[^>]*>/, '').replace(/<\/script>/, ''));
      if (/Event/i.test(j['@type'] ?? '')) return j;
    } catch { /* siguiente */ }
  }
  return null;
}

export function parseScore(html: string): BesoccerScore {
  const ld = firstSportsEvent(html);
  const desc: string = ld?.description ?? '';
  // "… Jornada 1: Sudáfrica 0 - 0 Canadá" → último "N - N" de la descripción.
  const m = desc.match(/(\d+)\s*-\s*(\d+)(?!.*\d+\s*-\s*\d+)/);
  const decidedByPenalties = /penal/i.test(desc) || /penaltis|penales|por penaltis/i.test(html.slice(0, 4000));
  return {
    homeScore: m ? parseInt(m[1], 10) : null,
    awayScore: m ? parseInt(m[2], 10) : null,
    homeTeamRaw: ld?.homeTeam?.name ?? '',
    awayTeamRaw: ld?.awayTeam?.name ?? '',
    decidedByPenalties,
  };
}

/** Minuto en vivo (cabecera del marcador). null si no está en juego o no se encuentra. */
export function parseLiveMinute(html: string): number | null {
  // BeSoccer muestra el minuto en un marcador con clase "marker"/"tag live".
  const m = html.match(/class="[^"]*marker[^"]*"[^>]*>\s*(\d{1,3})(?:\+(\d{1,2}))?\s*['´’]/);
  if (m) return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) : 0);
  return null;
}

// ─── Eventos desde los popups ────────────────────────────────────────────────

export interface BesoccerEvent {
  minute: number;
  type: string;       // texto crudo del t-up ("Gol", "Sustitución", "Tarjeta amarilla"…)
  side: Side;
  playerId: string;   // jugador principal del evento (id BeSoccer)
  playerName: string;
  /** Todos los ids de jugador citados en el popup (para cambios: salen 2). */
  playerIds: string[];
  shootout: boolean;
}

/** Extrae todos los eventos de los popups `popup_event_orderMin_*`. */
export function parseEvents(html: string): BesoccerEvent[] {
  const parts = html.split('id="popup_event_orderMin_');
  const out: BesoccerEvent[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < parts.length; i++) {
    const head = parts[i].match(/^(\d+)_(\d+)_(\d+)/);
    if (!head) continue;
    const [, order, minuteS, mainPlayerId] = head;
    const block = parts[i].slice(0, 1600);
    const typeM = block.match(/<span class="t-up">([^<]+)<\/span>/);
    const sideM = block.match(/alt="(local|visitor)"/);
    if (!typeM || !sideM) continue;
    const key = `${order}_${minuteS}_${mainPlayerId}_${norm(typeM[1])}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ids = [...block.matchAll(/\/jugador\/[a-z0-9-]+-(\d+)"/g)].map(x => x[1]);
    const nameM = block.match(/class="main-text[^"]*"[^>]*>\s*([^<]+?)\s*</);
    out.push({
      minute: parseInt(minuteS, 10),
      type: typeM[1].trim(),
      side: sideM[1] as Side,
      playerId: mainPlayerId,
      playerName: (nameM?.[1] ?? '').trim(),
      playerIds: ids.length ? ids : [mainPlayerId],
      shootout: /tanda|penaltis/i.test(typeM[1]),
    });
  }
  return out;
}

// ─── Alineaciones ────────────────────────────────────────────────────────────

/**
 * Titulares de cada equipo desde el campo (`panel-lineup`). BeSoccer pinta los 22
 * titulares EN ORDEN: primeros 11 = local, siguientes 11 = visitante (verificado con
 * Sudáfrica-Canadá en vivo). El banquillo NO se parsea: los suplentes que entran se
 * deducen de los eventos de cambio (que ya traen el lado y el minuto), y los que no
 * entran no puntúan, así que no hacen falta.
 */
export function parseLineup(alineacionesHtml: string): LineupEntry[] {
  const field = (alineacionesHtml.split('class="panel panel-lineup"')[1] ?? '').split('panel panel-bench')[0];
  const seen = new Set<string>();
  const players: { id: string; name: string }[] = [];
  for (const m of field.matchAll(/\/jugador\/([a-z0-9-]+)-(\d+)"[^>]*>(?:\s*<img[^>]*alt="([^"]*)")?/g)) {
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    players.push({ id, name: (m[3] ?? m[1].replace(/-/g, ' ')).trim() });
  }
  const xi = players.slice(0, 22); // 11 local + 11 visitante
  return xi.map((p, i) => ({
    fifaPlayerId: p.id,
    fifaTeamId: (i < 11 ? 'local' : 'visitor') as Side,
    name: p.name,
    isStarter: true,
  }));
}

/**
 * Nombres de todos los jugadores citados en una página (anchor `/jugador/{slug}-{id}`
 * con su `alt`/texto). Sirve para conciliar también a los suplentes que entran (que
 * no están en el once de inicio) por su nombre real, no por el slug.
 */
export function parsePlayerNames(html: string): Map<string, string> {
  const names = new Map<string, string>();
  // 1) <img ... alt="Nombre"> <a ... /jugador/slug-id>   (popups y filas)
  for (const m of html.matchAll(/alt="([^"]+)"\s*\/?>?\s*<a[^>]*\/jugador\/[a-z0-9-]+-(\d+)"/g)) {
    if (!names.has(m[2])) names.set(m[2], m[1].trim());
  }
  // 2) /jugador/slug-id"> Nombre <   (texto del propio anchor)
  for (const m of html.matchAll(/\/jugador\/([a-z0-9-]+)-(\d+)"[^>]*>\s*([^<]+?)\s*</g)) {
    const txt = m[3].trim();
    if (txt && !/^\s*$/.test(txt) && !names.has(m[2])) names.set(m[2], txt);
    else if (!names.has(m[2])) names.set(m[2], m[1].replace(/-/g, ' '));
  }
  return names;
}

// ─── Agregación: eventos + alineación → tallies ──────────────────────────────

export interface BesoccerAggregation {
  tallies: Map<string, PlayerTally>;
  goalEvents: GoalEvent[];
  /** liveData sintético para reconcileAndSaveTallies (mapea local/visitor → equipos). */
  liveData: { HomeTeam: { IdTeam: Side }; AwayTeam: { IdTeam: Side } };
}

/**
 * Convierte los eventos + alineación de BeSoccer en tallies por jugador, con el
 * MISMO formato que el mapper de FIFA, para pasarlos por `reconcileAndSaveTallies`.
 * `matchDurationMin`: 90 nunca se usa aquí (KO = 120 posibles); se pasa para los
 * minutos de titulares sin cambio.
 */
export function aggregateBesoccer(
  events: BesoccerEvent[],
  lineup: LineupEntry[],
  matchDurationMin: number,
): BesoccerAggregation {
  const tallies = new Map<string, PlayerTally>();
  const goalEvents: GoalEvent[] = [];
  const sideOf = new Map<string, Side>(lineup.map(l => [l.fifaPlayerId, l.fifaTeamId as Side]));
  const starterIds = new Set(lineup.filter(l => l.isStarter).map(l => l.fifaPlayerId));

  const get = (pid: string, side: Side): PlayerTally => {
    if (!tallies.has(pid)) tallies.set(pid, emptyTally(pid, side));
    return tallies.get(pid)!;
  };

  const subOut = new Map<string, number>(); // playerId → minuto de salida
  const subIn = new Map<string, number>();   // playerId → minuto de entrada
  const subInSide = new Map<string, Side>(); // playerId que entra → su lado
  const redMin = new Map<string, number>();
  const yellow = new Map<string, number>();

  for (const ev of events) {
    const t = norm(ev.type);
    const side = ev.side;

    if (t.includes('gol')) {
      const tally = get(ev.playerId, side);
      const isOwn = t.includes('propia');
      const isPen = t.includes('penal');
      if (ev.shootout) {
        if (!isOwn) tally.goals_penalty_shootout++;
      } else if (isOwn) {
        tally.own_goals++;
        goalEvents.push({ fifaTeamId: side, minute: ev.minute, isOwnGoal: true });
      } else if (isPen) {
        tally.goals_penalty_play++;
        goalEvents.push({ fifaTeamId: side, minute: ev.minute, isOwnGoal: false });
      } else {
        tally.goals_open_play++;
        goalEvents.push({ fifaTeamId: side, minute: ev.minute, isOwnGoal: false });
      }
    } else if (t.includes('penal') && (t.includes('falla') || t.includes('fallo'))) {
      const tally = get(ev.playerId, side);
      if (ev.shootout) tally.penalty_missed_shootout++; else tally.penalty_missed_play++;
    } else if (t.includes('penal') && (t.includes('para') || t.includes('ataja') || t.includes('detiene'))) {
      const tally = get(ev.playerId, side);
      if (ev.shootout) tally.penalty_saved_shootout++; else tally.penalty_saved_play++;
    } else if (t.includes('roja') || t.includes('expuls')) {
      get(ev.playerId, side).red_card = 1;
      redMin.set(ev.playerId, ev.minute);
    } else if (t.includes('amarilla')) {
      const n = (yellow.get(ev.playerId) ?? 0) + 1;
      yellow.set(ev.playerId, n);
      if (n >= 2 || t.includes('doble') || t.includes('segunda')) {
        get(ev.playerId, side).red_card = 1;
        redMin.set(ev.playerId, ev.minute);
      }
    } else if (t.includes('sustitu') || t.includes('cambio')) {
      // El popup cita 2 jugadores: el titular (en el once) SALE, el otro ENTRA.
      const ids = ev.playerIds.filter((v, idx, a) => a.indexOf(v) === idx);
      const out = ids.find(id => starterIds.has(id) && !subIn.has(id)) ?? ev.playerId;
      const inn = ids.find(id => id !== out);
      subOut.set(out, ev.minute);
      if (inn) { subIn.set(inn, ev.minute); subInSide.set(inn, ev.side); }
    } else if (t.includes('asist')) {
      get(ev.playerId, side).assists++;
    }
  }

  // Minutos e intervalo en campo (igual criterio que FIFA).
  const exit = (pid: string): number | undefined => {
    const s = subOut.get(pid); const r = redMin.get(pid);
    const arr = [s, r].filter((x): x is number => x !== undefined);
    return arr.length ? Math.min(...arr) : undefined;
  };
  for (const entry of lineup) {
    const tally = get(entry.fifaPlayerId, entry.fifaTeamId as Side);
    const out = exit(entry.fifaPlayerId);
    if (entry.isStarter) {
      tally.minute_in = 0;
      tally.minute_out = out !== undefined ? Math.min(out, matchDurationMin) : null;
      tally.minutes_played = tally.minute_out ?? matchDurationMin;
    } else {
      const inMin = subIn.get(entry.fifaPlayerId);
      if (inMin !== undefined) {
        tally.minute_in = Math.min(inMin, matchDurationMin);
        tally.minute_out = out !== undefined ? Math.min(out, matchDurationMin) : null;
        tally.minutes_played = Math.max(0, (tally.minute_out ?? matchDurationMin) - tally.minute_in);
      }
    }
  }

  // Suplentes que ENTRARON (no están en el once de inicio): su minuto de entrada
  // sale del evento de cambio. Así reciben "por jugar" (+5) y, si son portero/
  // defensa, su portería a cero / gol encajado usa el intervalo correcto.
  for (const [pid, minIn] of subIn) {
    if (starterIds.has(pid)) continue;
    const tally = get(pid, subInSide.get(pid) ?? 'local');
    tally.minute_in = Math.min(minIn, matchDurationMin);
    const out = exit(pid);
    tally.minute_out = out !== undefined ? Math.min(out, matchDurationMin) : null;
    tally.minutes_played = Math.max(0, (tally.minute_out ?? matchDurationMin) - tally.minute_in);
  }

  void sideOf;
  return {
    tallies, goalEvents,
    liveData: { HomeTeam: { IdTeam: 'local' }, AwayTeam: { IdTeam: 'visitor' } },
  };
}
