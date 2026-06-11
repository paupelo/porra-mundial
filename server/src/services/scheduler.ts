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
 * - Los EVENTOS de jugadores entran como borrador y solo puntúan cuando el
 *   admin confirma el partido (o con FIFA_AUTO_CONFIRM=true, no recomendado).
 * - En eliminatorias se derivan advanced/eliminated/winner automáticamente,
 *   sin pisar resultados de fase que el admin haya fijado a mano. La fase de
 *   grupos (depende de clasificaciones y mejores terceros) queda en manos del admin.
 *
 * ⚠️ En el plan free de Render el proceso se duerme sin tráfico: este scheduler
 * solo corre mientras el servicio está despierto. Ver CLAUDE.md (ping externo).
 */

import { MatchesRepo, PhaseResultsRepo } from '../repositories/matches.repo';
import { EventsRepo } from '../repositories/events.repo';
import { syncCalendar, syncMatchEvents, CalendarSyncSummary } from './fifa/sync';
import { recalcularYGuardar } from './recalc';
import { MatchRecord } from '../types';

const TICK_MS = 60_000;
const LIVE_RETRY_MIN = 10;                 // reintento para partidos en juego/prórroga
const FAST_CALENDAR_MIN = 10;              // refresco con partidos "calientes"
const KNOCKOUT_PHASES = ['dieciseisavos', 'octavos', 'cuartos', 'semifinales', 'final'];

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

function minutesSinceScrape(match: MatchRecord, now: Date): number {
  if (!match.last_scraped_at) return Infinity;
  return (now.getTime() - new Date(match.last_scraped_at).getTime()) / 60_000;
}

/** Resultados de fase automáticos para eliminatorias (sin pisar al admin). */
async function deriveKnockoutPhaseResults(match: MatchRecord): Promise<void> {
  if (!KNOCKOUT_PHASES.includes(match.phase) || match.status !== 'finished') return;
  if (match.home_score === null || match.away_score === null) return;

  let winnerId: string | null = null;
  if (match.decided_by_penalties) {
    winnerId = match.penalty_winner_id;
  } else if (match.home_score > match.away_score) {
    winnerId = match.home_team_id;
  } else if (match.away_score > match.home_score) {
    winnerId = match.away_team_id;
  }
  if (!winnerId) return;
  const loserId = winnerId === match.home_team_id ? match.away_team_id : match.home_team_id;

  const existing = await PhaseResultsRepo.findAll();
  const has = (teamId: string) => existing.some(r => r.team_id === teamId && r.phase === match.phase);

  if (!has(winnerId)) {
    await PhaseResultsRepo.upsert(winnerId, match.phase, match.phase === 'final' ? 'winner' : 'advanced');
    log(`fase ${match.phase}: ${winnerId} → ${match.phase === 'final' ? 'winner' : 'advanced'}`);
  }
  if (!has(loserId)) {
    await PhaseResultsRepo.upsert(loserId, match.phase, 'eliminated');
    log(`fase ${match.phase}: ${loserId} → eliminated`);
  }
}

// ─── Tick principal ───────────────────────────────────────────────────────────

let lastCalendarSyncMs = 0;
let ticking = false;

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  status.lastTickAt = new Date().toISOString();
  try {
    const now = new Date();
    let matches = await MatchesRepo.findAll();
    const fifaMatches = matches.filter(m => m.fifa_match_id);

    // ¿Hay partidos que exigen refresco rápido del calendario?
    const hot = fifaMatches.some(m =>
      m.status === 'live' ||
      (m.status === 'pending' && isDue(m, now)),
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

    // Partidos en juego: reintento cada 10 min (cubre prórroga y penaltis)
    for (const m of matches.filter(x => x.fifa_match_id && x.status === 'live')) {
      if (minutesSinceScrape(m, now) >= LIVE_RETRY_MIN) {
        await MatchesRepo.update(m.id, { last_scraped_at: now.toISOString() });
        // El marcador/estado llega con el próximo refresco rápido del calendario
      }
    }

    // Partidos finalizados sin eventos scrapeados → descargar timeline
    for (const m of matches.filter(x => x.fifa_match_id && x.fifa_stage_id && x.status === 'finished')) {
      const counts = await EventsRepo.countByMatch(m.id);
      if (counts.total === 0) {
        log(`scrapeando eventos de ${m.id} (FIFA ${m.fifa_match_id})…`);
        const summary = await syncMatchEvents(m);
        log(`eventos de ${m.id}: ${summary.saved} borradores guardados, ${summary.unreconciled.length} sin conciliar`);
        didWork = true;
        if (process.env.FIFA_AUTO_CONFIRM === 'true' && summary.saved > 0) {
          await EventsRepo.confirmAll(m.id);
          log(`auto-confirmados los eventos de ${m.id} (FIFA_AUTO_CONFIRM=true)`);
        }
      }
      await deriveKnockoutPhaseResults(m);
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
