/**
 * Scheduler de scraping automático.
 *
 * Sin estado propio persistente: cada tick decide qué hacer mirando la BD
 * (status, last_scraped_at, eventos existentes), así que sobrevive a
 * reinicios sin perder trabajo pendiente.
 *
 * Política de puntuación:
 * - El MARCADOR de un partido finalizado puntúa en cuanto se scrapea y se
 *   recalcula (las victorias/derrotas/empates salen de `matches`, no de eventos).
 * - Los EVENTOS de un partido finalizado se auto-confirman y puntúan sin admin.
 *   Además se RE-DERIVAN solos cuando cambia la lógica del scraper/scoring
 *   (ver RECONCILE_VERSION): el sistema revisa y corrige todo lo ya jugado sin
 *   intervención manual; solo las ediciones `source='manual'` son intocables.
 * - En eliminatorias se derivan advanced/eliminated/winner automáticamente,
 *   sin pisar resultados de fase que el admin haya fijado a mano. La fase de
 *   grupos (depende de clasificaciones y mejores terceros) queda en manos del admin.
 *
 * ⚠️ En el plan free de Render el proceso se duerme sin tráfico: este scheduler
 * solo corre mientras el servicio está despierto. Ver CLAUDE.md (ping externo).
 */

import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';
import { EventsRepo } from '../repositories/events.repo';
import { syncCalendar, syncLiveMatch, syncMatchEvents, CalendarSyncSummary } from './fifa/sync';
import { recalcularYGuardar } from './recalc';
import { computeGroupBonuses } from './group-bonuses';
import { syncBesoccerMatch } from './besoccer/sync';
import { MatchRecord } from '../types';

const TICK_MS = 60_000;
const FAST_CALENDAR_MIN = 10;              // refresco con partidos "calientes"
const KNOCKOUT_PHASES = ['dieciseisavos', 'octavos', 'cuartos', 'semifinales', 'final'];

/**
 * Fuente de datos de la fase KO: 'fifa' (por defecto) o 'besoccer'. Con 'besoccer',
 * los partidos KO que tengan `besoccer_url` se scrapean desde BeSoccer (en vivo y
 * final), con FIFA como fallback automático si BeSoccer falla o no hay URL. La fase
 * de grupos siempre usa FIFA.
 */
const KO_SOURCE = (process.env.KO_SOURCE ?? 'fifa').toLowerCase();

/** ¿Este partido debe scrapearse desde BeSoccer? (KO + flag + URL guardada). */
function useBesoccer(m: MatchRecord): boolean {
  return KO_SOURCE === 'besoccer' && KNOCKOUT_PHASES.includes(m.phase) && !!m.besoccer_url;
}

/**
 * Versión de la lógica de reconciliación (scraper + scoring de eventos).
 * El scheduler re-deriva una vez —sin admin— los eventos de cada partido
 * finalizado cuyo `reconcile_version` sea inferior, y luego lo sella con esta
 * versión. Es la "revisión automática de todo al terminar cada partido": un
 * cambio en cómo se interpretan los datos de FIFA (p. ej. un penalti fallado o
 * los 5 puntos por jugar) se reaplica solo a todo lo ya jugado.
 *
 * ⚠️ SUBIR ESTE NÚMERO cada vez que cambie la lógica del scraper/scoring de
 * eventos para forzar el recálculo retroactivo automático.
 *   v1 (jun-2026): fix "por jugar" a suplentes de prórroga + captura de penalti
 *                  fallado (antes mal clasificado como gol).
 *   v2 (jun-2026): penalti fallado real = Type 6 sin gol del lanzador (Messi);
 *                  cambios al descanso (MatchMinute vacío) = minuto 45 (Gvardiol).
 *   v3 (jun-2026): penalti PARADO = Type 57 (parada del portero) en el mismo
 *                  minuto que un penalti no convertido del rival → +30 al portero
 *                  (antes el Type 57 se ignoraba; Maignan a Strand Larsen, NOR-FRA).
 *   v4 (jun-2026): la TANDA de penaltis ya NO puntúa a JUGADORES (solo a
 *                  selecciones). Fuerza el recálculo retroactivo de los partidos
 *                  resueltos en tanda (Paraguay-Alemania, Países Bajos-Marruecos):
 *                  se anulan los puntos de jugador por penalti parado/gol/fallado
 *                  en tanda. Las selecciones (empate + Ganar Penaltis) no cambian.
 */
const RECONCILE_VERSION = 4;

function envInt(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  lastTickAt: string | null;
  lastCalendarSyncAt: string | null;
  lastCalendarSummary: CalendarSyncSummary | null;
  lastError: string | null;
  recentLog: string[];
}

const status: SchedulerStatus = {
  enabled: false, running: false, lastTickAt: null,
  lastCalendarSyncAt: null, lastCalendarSummary: null, lastError: null, recentLog: [],
};

function log(msg: string): void {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(`[scheduler] ${msg}`);
  status.recentLog.push(line);
  if (status.recentLog.length > 50) status.recentLog.shift();
}

export function getSchedulerStatus(): SchedulerStatus {
  return status;
}

// ─── Decisiones por partido ───────────────────────────────────────────────────

/** ¿Ya debería haber terminado? inicio + duración estimada + margen. */
function isDue(match: MatchRecord, now: Date): boolean {
  if (!match.match_date) return false;
  const start = new Date(match.match_date).getTime();
  if (!Number.isFinite(start)) return false;
  const durationMin = envInt('FIFA_MATCH_DURATION_MIN', 105) + envInt('FIFA_SCRAPE_DELAY_MIN', 15);
  return now.getTime() >= start + durationMin * 60_000;
}

/** ¿Ya empezó (hora de inicio pasada) sin haber terminado? */
function kickoffPassed(match: MatchRecord, now: Date): boolean {
  if (!match.match_date) return false;
  const start = new Date(match.match_date).getTime();
  return Number.isFinite(start) && now.getTime() >= start;
}

/**
 * Resultados de fase automáticos para eliminatorias (sin pisar al admin). Aplica a
 * TODAS las rondas KO (16avos…final): el ganador `advanced` (o `winner` en la final),
 * el perdedor `eliminated`. Devuelve true si escribió algo nuevo, para que el tick
 * recalcule y aplique sin demora el bonus de pasar ronda (equipo +pasaRonda y todos
 * sus jugadores +15) y, si procede, la penalización por quedar eliminado.
 */
async function deriveKnockoutPhaseResults(match: MatchRecord): Promise<boolean> {
  if (!KNOCKOUT_PHASES.includes(match.phase) || match.status !== 'finished') return false;
  if (match.home_score === null || match.away_score === null) return false;

  let winnerId: string | null = null;
  if (match.decided_by_penalties) {
    winnerId = match.penalty_winner_id;
  } else if (match.home_score > match.away_score) {
    winnerId = match.home_team_id;
  } else if (match.away_score > match.home_score) {
    winnerId = match.away_team_id;
  }
  if (!winnerId) return false;
  const loserId = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;

  const existing = await PhaseResultsRepo.findAll();
  const has = (teamId: string) => existing.some(r => r.team_id === teamId && r.phase === match.phase);
  let wrote = false;

  if (!has(winnerId)) {
    await PhaseResultsRepo.upsert(winnerId, match.phase, match.phase === 'final' ? 'winner' : 'advanced');
    log(`fase ${match.phase}: ${winnerId} → ${match.phase === 'final' ? 'winner' : 'advanced'}`);
    wrote = true;
  }
  if (!has(loserId)) {
    await PhaseResultsRepo.upsert(loserId, match.phase, 'eliminated');
    log(`fase ${match.phase}: ${loserId} → eliminated`);
    wrote = true;
  }
  return wrote;
}

// ─── Tick principal ───────────────────────────────────────────────────────────

let lastCalendarSyncMs = 0;
let ticking = false;
// Partidos finalizados ANTES de existir los minutos de gol / intervalo: se
// re-scrapean una vez para rellenarlos. El Set evita reintentos en bucle si el
// timeline no llega a poblarlos (idempotente: se reintenta al reiniciar).
const intervalBackfillAttempted = new Set<string>();

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  status.lastTickAt = new Date().toISOString();
  try {
    const now = new Date();
    let matches = await MatchesRepo.findAll();
    const fifaMatches = matches.filter(m => m.fifa_match_id);

    // ¿Hay partidos que exigen refresco rápido del calendario?
    // (en juego, o programados que ya deberían haber empezado/terminado)
    const hot = fifaMatches.some(m =>
      m.status === 'live' ||
      (m.status === 'pending' && (kickoffPassed(m, now) || isDue(m, now))),
    );
    const refreshMin = hot ? FAST_CALENDAR_MIN : envInt('FIFA_CALENDAR_REFRESH_HOURS', 6) * 60;
    let didWork = false;

    if (now.getTime() - lastCalendarSyncMs >= refreshMin * 60_000) {
      lastCalendarSyncMs = now.getTime();
      const summary = await syncCalendar();
      status.lastCalendarSyncAt = now.toISOString();
      status.lastCalendarSummary = summary;
      log(`calendario: ${summary.total} partidos FIFA · ${summary.created} creados · ${summary.updated} actualizados · ${summary.linked} enlazados · ${summary.skipped.length} omitidos`);
      if (summary.created || summary.updated || summary.linked) didWork = true;
      matches = await MatchesRepo.findAll();
    }

    // Avance de fase de GRUPOS automático (sin admin): en cuanto el cuadro de
    // dieciseisavos está completo (32 equipos), se derivan y puntúan los bonus de
    // fin de grupos (pasaRonda a equipos y jugadores, penalización a eliminados).
    // Idempotente: solo corre mientras no haya ningún resultado de fase 'grupos'.
    if (!(await PhaseResultsRepo.findAll()).some(r => r.phase === 'grupos')) {
      const r16Teams = new Set<string>();
      for (const m of matches.filter(x => x.phase === 'dieciseisavos')) {
        r16Teams.add(m.home_team_id); r16Teams.add(m.away_team_id);
      }
      if (r16Teams.size === 32) {
        const gb = await computeGroupBonuses(true);
        if (gb.applied) {
          log(`fase de grupos derivada automáticamente: ${gb.totals.advancing} avanzan, ${gb.totals.eliminated} eliminados`);
          didWork = true;
        }
      }
    }

    // Partidos EN JUEGO: poll cada tick (60s) → minuto, marcador provisional y
    // eventos en vivo (is_live=1). Cubre también prórroga y penaltis.
    let liveFinished = false;
    for (const m of matches.filter(x => x.fifa_match_id && x.fifa_stage_id && x.status === 'live')) {
      didWork = true; // recalcular cada tick mientras haya partidos en vivo
      if (useBesoccer(m)) {
        try {
          const s = await syncBesoccerMatch(m, m.besoccer_url!, true);
          log(`en vivo (BeSoccer) ${m.id}: min ${s.minute ?? '?'} · ${s.homeScore ?? '-'}–${s.awayScore ?? '-'} · ${s.eventsParsed} ev · ${s.saved} guardados`);
          continue; // el cambio de estado live→finished lo marca el refresco del calendario (FIFA)
        } catch (e) {
          log(`BeSoccer en vivo falló para ${m.id}; fallback a FIFA: ${(e as Error).message}`);
        }
      }
      const s = await syncLiveMatch(m);
      log(`en vivo ${m.id}: min ${s.minute ?? '?'} · ${s.homeScore ?? '-'}–${s.awayScore ?? '-'} · ${s.eventsSaved} eventos`);
      if (s.finishedDetected) liveFinished = true;
    }
    // Si el endpoint live ya da el partido por terminado, el calendario (que es
    // la fuente autoritativa del resultado/penaltis) se refresca en este mismo tick
    if (liveFinished) {
      lastCalendarSyncMs = now.getTime();
      const summary = await syncCalendar();
      status.lastCalendarSyncAt = new Date().toISOString();
      status.lastCalendarSummary = summary;
      log('partido terminado detectado en vivo → calendario refrescado');
      matches = await MatchesRepo.findAll();
    }

    // Partidos finalizados sin scrape final (sin eventos, o solo con
    // provisionales del modo en vivo) → descargar timeline definitivo
    for (const m of matches.filter(x => x.fifa_match_id && x.fifa_stage_id && x.status === 'finished')) {
      const counts = await EventsRepo.countByMatch(m.id);
      // Backfill de minutos de gol/intervalo en partidos cerrados antes de la feature.
      const needsIntervalBackfill = m.home_goal_minutes == null && m.away_goal_minutes == null
        && !intervalBackfillAttempted.has(m.id);
      // Revisión automática: re-derivar los eventos si se derivaron con una
      // versión de lógica anterior (autocorrige todo lo ya jugado, sin admin).
      const needsVerify = (m.reconcile_version ?? 0) < RECONCILE_VERSION;
      if (counts.total === 0 || counts.live > 0 || needsIntervalBackfill || needsVerify) {
        if (needsIntervalBackfill) intervalBackfillAttempted.add(m.id);
        log(needsVerify
          ? `revisando eventos de ${m.id} (re-derivación v${m.reconcile_version ?? 0}→${RECONCILE_VERSION})…`
          : `scrapeando eventos de ${m.id} (${useBesoccer(m) ? 'BeSoccer' : 'FIFA ' + m.fifa_match_id})…`);
        let fetched = false;
        if (useBesoccer(m)) {
          try {
            const s = await syncBesoccerMatch(m, m.besoccer_url!, false);
            fetched = true;
            log(`eventos (BeSoccer) de ${m.id}: ${s.saved} guardados, ${s.skippedManual} manuales intactos, ${s.unreconciled.length} sin conciliar`);
          } catch (e) {
            log(`BeSoccer final falló para ${m.id}; fallback a FIFA: ${(e as Error).message}`);
          }
        }
        if (!fetched) {
          const summary = await syncMatchEvents(m);
          fetched = summary.timelineFetched;
          log(`eventos de ${m.id}: ${summary.saved} guardados/actualizados, ${summary.skippedManual} manuales intactos, ${summary.unreconciled.length} sin conciliar`);
        }
        // Sellar con la versión actual SOLO si la fuente respondió (si no, se reintenta
        // en el próximo tick en vez de marcar el partido como revisado en falso).
        if (fetched && needsVerify) {
          await MatchesRepo.update(m.id, { reconcile_version: RECONCILE_VERSION });
        }
        didWork = true;
      }
      // Sin aprobación manual: los eventos de un partido finalizado puntúan
      // automáticamente. El admin puede corregirlos a posteriori en el panel.
      const after = await EventsRepo.countByMatch(m.id);
      if (after.confirmed < after.total) {
        await EventsRepo.confirmAll(m.id);
        log(`eventos de ${m.id} aplicados automáticamente (${after.total})`);
        didWork = true;
      }
      if (await deriveKnockoutPhaseResults(m)) didWork = true;
    }

    if (didWork) {
      const results = await recalcularYGuardar();
      log(`clasificación recalculada: ${results.length} porras`);
    }
    status.lastError = null;
  } catch (err) {
    status.lastError = (err as Error).message;
    log(`ERROR: ${(err as Error).message}`);
  } finally {
    ticking = false;
  }
}

let timer: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  if (process.env.FIFA_ENABLED === 'false') {
    console.log('[scheduler] desactivado (FIFA_ENABLED=false)');
    return;
  }
  status.enabled = true;
  status.running = true;
  // Primer tick inmediato (carga el calendario al arrancar) y luego cada minuto
  void tick();
  timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  console.log('[scheduler] activo: tick cada 60s');
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
  status.running = false;
}

/** Disparo manual desde el panel de admin. */
export async function runTickNow(): Promise<SchedulerStatus> {
  lastCalendarSyncMs = 0; // fuerza refresco del calendario
  await tick();
  return status;
}
