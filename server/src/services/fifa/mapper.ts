/**
 * Funciones puras que traducen el JSON del API de FIFA al dominio de la porra.
 * Todo el parseo es defensivo: el API no tiene contrato público y puede cambiar.
 * Los datos resultantes entran SIEMPRE como borrador que el admin confirma.
 */

import { MatchStatus, Phase } from '../../types';

// ─── Helpers de extracción defensiva ─────────────────────────────────────────

type AnyObj = Record<string, any>;

/** Texto localizado de FIFA: [{ Locale, Description }] → primera Description. */
export function localized(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as AnyObj;
    if (typeof first?.Description === 'string') return first.Description;
  }
  return '';
}

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** "67'" | "90'+4" | "45+2'" → minuto entero (suma el descuento). */
export function parseMinute(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d+)(?:'?\s*\+\s*(\d+))?/);
  if (!m) return null;
  return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) : 0);
}

// ─── Fase ─────────────────────────────────────────────────────────────────────

/**
 * Nombre de fase de FIFA → fase del dominio.
 * Devuelve null para fases que la porra no puntúa (p. ej. tercer puesto):
 * esos partidos se omiten y, si procede, el admin los carga a mano.
 */
export function mapStageToPhase(stageName: string): Phase | null {
  const s = normalize(stageName);
  if (!s) return null;
  // FIFA llama "Primera fase" a la fase de grupos en el calendario de 2026
  if (s.includes('grupo') || s.includes('group') || s.includes('first stage') || s.includes('primera fase')) return 'grupos';
  if (s.includes('32') || s.includes('dieciseisavos')) return 'dieciseisavos';
  if (s.includes('16') || s.includes('octavos')) return 'octavos';
  if (s.includes('cuartos') || s.includes('quarter')) return 'cuartos';
  if (s.includes('semi')) return 'semifinales';
  // tercer puesto antes que 'final' (su nombre suele contener "final" o "play-off")
  if (s.includes('tercer') || s.includes('third') || s.includes('3rd')) return null;
  if (s.includes('final')) return 'final';
  return null;
}

// ─── Estado del partido ───────────────────────────────────────────────────────

/**
 * MatchStatus de FIFA → estado del dominio.
 * Códigos observados en api.fifa.com/v3: 0 = finalizado, 3 = en juego,
 * 1/2 = programado, 4+ = aplazado/cancelado (se tratan como pendientes).
 */
export function mapStatus(fifaStatus: unknown): MatchStatus {
  if (fifaStatus === 0) return 'finished';
  if (fifaStatus === 3) return 'live';
  return 'pending';
}

// ─── Partido del calendario ──────────────────────────────────────────────────

export interface FifaMatchDraft {
  fifaMatchId: string;
  fifaStageId: string;
  phase: Phase | null;
  stageNameRaw: string;
  groupName: string | null;
  venue: string | null;
  date: string | null;
  status: MatchStatus;
  homeCode: string | null;   // código FIFA de país, p. ej. "ARG"
  awayCode: string | null;
  homeNameRaw: string;
  awayNameRaw: string;
  homeScore: number | null;
  awayScore: number | null;
  decidedByPenalties: boolean;
  homePenalties: number | null;
  awayPenalties: number | null;
  /** Código de país del ganador de la tanda (si la hubo) */
  penaltyWinnerCode: string | null;
}

function teamCode(team: AnyObj | undefined): string | null {
  const code = team?.IdCountry ?? team?.Abbreviation ?? null;
  return typeof code === 'string' && code ? code.toUpperCase() : null;
}

function intOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function mapCalendarMatch(raw: unknown): FifaMatchDraft | null {
  const m = raw as AnyObj;
  const fifaMatchId = String(m?.IdMatch ?? '');
  if (!fifaMatchId) return null;

  const home = m.Home as AnyObj | undefined;
  const away = m.Away as AnyObj | undefined;
  const stageNameRaw = localized(m.StageName);
  const homeScore = intOrNull(home?.Score) ?? intOrNull(m.HomeTeamScore);
  const awayScore = intOrNull(away?.Score) ?? intOrNull(m.AwayTeamScore);
  const homePens = intOrNull(m.HomeTeamPenaltyScore) ?? intOrNull(home?.PenaltyScore);
  const awayPens = intOrNull(m.AwayTeamPenaltyScore) ?? intOrNull(away?.PenaltyScore);
  // ResultType 3 = decidido en tanda de penaltis (2 = prórroga, 1 = normal)
  const decidedByPenalties = m.ResultType === 3 || (homePens !== null && awayPens !== null && homePens + awayPens > 0);

  let penaltyWinnerCode: string | null = null;
  if (decidedByPenalties && homePens !== null && awayPens !== null) {
    penaltyWinnerCode = homePens > awayPens ? teamCode(home) : teamCode(away);
  }

  return {
    fifaMatchId,
    fifaStageId: String(m.IdStage ?? ''),
    phase: mapStageToPhase(stageNameRaw),
    stageNameRaw,
    groupName: localized(m.GroupName) || null,
    venue: localized((m.Stadium as AnyObj)?.Name) || null,
    date: typeof m.Date === 'string' ? m.Date : null,
    status: mapStatus(m.MatchStatus),
    homeCode: teamCode(home),
    awayCode: teamCode(away),
    homeNameRaw: localized(home?.TeamName) || localized(home?.ShortClubName) || '',
    awayNameRaw: localized(away?.TeamName) || localized(away?.ShortClubName) || '',
    homeScore,
    awayScore,
    decidedByPenalties,
    homePenalties: homePens,
    awayPenalties: awayPens,
    penaltyWinnerCode,
  };
}

// ─── Timeline → tallies por jugador ──────────────────────────────────────────

export interface PlayerTally {
  fifaPlayerId: string;
  fifaTeamId: string | null;
  goals_open_play: number;
  goals_penalty_play: number;
  goals_penalty_shootout: number;
  assists: number;
  penalty_saved_play: number;
  penalty_saved_shootout: number;
  red_card: 0 | 1;
  penalty_conceded: number;
  penalty_missed_play: number;
  penalty_missed_shootout: number;
  own_goals: number;
  minutes_played: number;
  /** Minuto en el que el jugador entró al campo (0 = titular). */
  minute_in: number;
  /** Minuto en el que salió (sustituido o expulsado); null = jugó hasta el final. */
  minute_out: number | null;
}

/**
 * Gol marcado en tiempo reglamentario/prórroga (NO tanda), para derivar los
 * minutos de gol de cada equipo. `isOwnGoal` => el tanto cuenta para el RIVAL
 * del equipo del jugador que lo marcó (se resuelve aguas arriba en sync.ts,
 * donde se conoce el mapeo equipo FIFA → local/visitante).
 */
export interface GoalEvent {
  fifaTeamId: string | null;
  minute: number;
  isOwnGoal: boolean;
}

export interface LineupEntry {
  fifaPlayerId: string;
  fifaTeamId: string | null;
  name: string;
  isStarter: boolean;
}

interface SubstitutionInfo {
  playerOutId: string;
  playerInId: string;
  minute: number;
}

function emptyTally(fifaPlayerId: string, fifaTeamId: string | null): PlayerTally {
  return {
    fifaPlayerId, fifaTeamId,
    goals_open_play: 0, goals_penalty_play: 0, goals_penalty_shootout: 0,
    assists: 0, penalty_saved_play: 0, penalty_saved_shootout: 0,
    red_card: 0, penalty_conceded: 0,
    penalty_missed_play: 0, penalty_missed_shootout: 0,
    own_goals: 0, minutes_played: 0,
    minute_in: 0, minute_out: null,
  };
}

/**
 * Tipos de evento que existen en el timeline pero no puntúan en la porra
 * (verificados contra el partido inaugural del Mundial 2026):
 * 2 amarilla · 7/8 inicio/fin de tiempo · 12 remate · 15 fuera de juego ·
 * 16 córner · 18 falta · 26 final · 57 parada · 71 VAR · 78/83 pausas · 79 sorteo
 */
const IGNORED_EVENT_TYPES = new Set([2, 7, 8, 12, 15, 16, 18, 26, 57, 71, 78, 79, 83]);

/**
 * Clasifica un evento del timeline. Códigos numéricos de api.fifa.com/v3
 * verificados contra datos reales del Mundial 2026 (goles, asistencias,
 * tarjetas, cambios); la descripción localizada actúa de respaldo por si los
 * códigos cambian. Lo no reconocido se ignora y se loguea aguas arriba
 * (el admin puede completarlo a mano).
 */
export function classifyEvent(type: unknown, description: string): string | null {
  const d = normalize(description);
  const isPenalty = d.includes('penal');

  if (typeof type === 'number' && IGNORED_EVENT_TYPES.has(type)) return 'ignore';

  switch (type) {
    case 0: return isPenalty ? 'penalty_goal' : 'goal';
    case 1: return 'assist'; // evento propio: "Asistencia de X"
    case 3: return 'red_card';
    case 4: return 'red_card'; // segunda amarilla
    case 5: return 'substitution';
    case 34: return 'own_goal';
    case 41: return 'penalty_missed';
    case 60: return 'penalty_saved';
  }

  // Respaldo por texto (es/en)
  if (d.includes('autogol') || d.includes('own goal') || d.includes('propia puerta') || d.includes('propia meta')) return 'own_goal';
  if (isPenalty && (d.includes('fallad') || d.includes('missed') || d.includes('falla') || d.includes('err'))) return 'penalty_missed';
  if (isPenalty && (d.includes('parad') || d.includes('saved') || d.includes('detien') || d.includes('atajad'))) return 'penalty_saved';
  if (isPenalty && (d.includes('gol') || d.includes('goal') || d.includes('marcad') || d.includes('convertid') || d.includes('scored'))) return 'penalty_goal';
  if (d.includes('roja') || d.includes('red card') || d.includes('expuls')) return 'red_card';
  if (d.includes('segunda amarilla') || d.includes('second yellow') || d.includes('doble amarilla')) return 'red_card';
  if (d.includes('cambio') || d.includes('sustituc') || d.includes('substitut')) return 'substitution';
  if (d.includes('asistencia') || d.includes('assist')) return 'assist';
  if ((d.includes('gol') || d.includes('goal')) && !d.includes('sin gol') && !d.includes('goalkeeper')) return 'goal';
  return null;
}

/** Period 11 = tanda de penaltis en api.fifa.com/v3. */
export function isShootoutEvent(event: AnyObj): boolean {
  if (event?.Period === 11) return true;
  const d = normalize(localized(event?.EventDescription) || '');
  return d.includes('tanda') || d.includes('shoot-out') || d.includes('shootout');
}

export interface TimelineAggregation {
  tallies: Map<string, PlayerTally>; // fifaPlayerId → tally
  /** Goles en tiempo reglamentario/prórroga, en orden de aparición. */
  goalEvents: GoalEvent[];
  unmappedTypes: Array<{ type: unknown; description: string }>;
}

/**
 * Agrega el timeline de FIFA en un registro por jugador (el formato de
 * match_player_events). Recibe la alineación para calcular minutos jugados.
 *
 * Limitaciones conocidas (se completan a mano en el panel de admin):
 * - "Penalti cometido" no aparece como evento propio en el timeline.
 * - Las asistencias solo se detectan si el evento de gol trae IdAssistPlayer/IdSubPlayer.
 */
export function aggregateTimeline(
  events: unknown[],
  lineup: LineupEntry[],
  matchDurationMin: number,
): TimelineAggregation {
  const tallies = new Map<string, PlayerTally>();
  const unmappedTypes: Array<{ type: unknown; description: string }> = [];
  const substitutions: SubstitutionInfo[] = [];
  const goalEvents: GoalEvent[] = [];
  // Minuto de expulsión: un jugador con roja abandona el campo (salida).
  const redMinuteByPlayer = new Map<string, number>();
  // Penaltis fallados/parados y goles marcados por jugador, para anular un
  // penalti fallado que el árbitro mandó repetir y acabó en gol (mismo jugador,
  // mismo minuto): contaría como fallo + gol cuando en realidad solo hay un gol.
  // Se cuenta como repetición convertida CUALQUIER gol del mismo jugador en ese
  // minuto (FIFA loguea el remate de la repetición como gol de penalti o, a
  // veces, como gol normal / remate de rechace).
  interface PenaltyAttempt { shootout: boolean; minute: number; kind: 'missed' | 'saved'; }
  const pendingPenaltyFails = new Map<string, PenaltyAttempt[]>();
  const playerGoals = new Map<string, Array<{ shootout: boolean; minute: number }>>();
  const recordGoal = (pid: string, isShootout: boolean, min: number) => {
    if (!playerGoals.has(pid)) playerGoals.set(pid, []);
    playerGoals.get(pid)!.push({ shootout: isShootout, minute: min });
  };

  const getTally = (fifaPlayerId: string, fifaTeamId: string | null): PlayerTally => {
    if (!tallies.has(fifaPlayerId)) tallies.set(fifaPlayerId, emptyTally(fifaPlayerId, fifaTeamId));
    const t = tallies.get(fifaPlayerId)!;
    if (!t.fifaTeamId && fifaTeamId) t.fifaTeamId = fifaTeamId;
    return t;
  };

  for (const raw of events) {
    const ev = raw as AnyObj;
    const playerId = ev?.IdPlayer ? String(ev.IdPlayer) : null;
    const teamId = ev?.IdTeam ? String(ev.IdTeam) : null;
    const description = localized(ev?.EventDescription) || localized(ev?.TypeLocalized) || '';
    const kind = classifyEvent(ev?.Type, description);
    const shootout = isShootoutEvent(ev);

    if (kind === null) {
      if (ev?.Type !== undefined && ev?.Type !== null) unmappedTypes.push({ type: ev.Type, description });
      continue;
    }
    if (kind === 'ignore') continue;
    if (kind === 'substitution') {
      // En v3 el que entra es IdPlayer y el que sale IdSubPlayer
      const minute = parseMinute(ev?.MatchMinute) ?? 0;
      if (playerId && ev?.IdSubPlayer) {
        substitutions.push({ playerInId: playerId, playerOutId: String(ev.IdSubPlayer), minute });
      }
      continue;
    }
    if (!playerId) continue;
    const tally = getTally(playerId, teamId);
    const minute = parseMinute(ev?.MatchMinute) ?? 0;

    switch (kind) {
      case 'goal':
        if (shootout) tally.goals_penalty_shootout++;
        else { tally.goals_open_play++; goalEvents.push({ fifaTeamId: teamId, minute, isOwnGoal: false }); }
        recordGoal(playerId, shootout, minute);
        break;
      case 'penalty_goal':
        if (shootout) tally.goals_penalty_shootout++;
        else { tally.goals_penalty_play++; goalEvents.push({ fifaTeamId: teamId, minute, isOwnGoal: false }); }
        recordGoal(playerId, shootout, minute);
        break;
      case 'own_goal':
        tally.own_goals++;
        goalEvents.push({ fifaTeamId: teamId, minute, isOwnGoal: true });
        break;
      case 'penalty_missed':
        if (!pendingPenaltyFails.has(playerId)) pendingPenaltyFails.set(playerId, []);
        pendingPenaltyFails.get(playerId)!.push({ shootout, minute, kind: 'missed' });
        break;
      case 'penalty_saved':
        if (!pendingPenaltyFails.has(playerId)) pendingPenaltyFails.set(playerId, []);
        pendingPenaltyFails.get(playerId)!.push({ shootout, minute, kind: 'saved' });
        break;
      case 'red_card':
        tally.red_card = 1;
        redMinuteByPlayer.set(playerId, minute);
        break;
      case 'assist':
        // Las asistencias llegan como evento propio (Type 1) con IdPlayer = asistente
        if (!shootout) tally.assists++;
        break;
    }
  }

  // ── Penaltis fallados que se mandaron repetir y acabaron en gol ──────────────
  // Un penalti fallado/parado seguido de un gol de penalti del mismo jugador en
  // el mismo minuto (±1) es una repetición convertida: cuenta solo como gol, no
  // como fallo. El resto de fallos/paradas se contabilizan normalmente.
  for (const [playerId, fails] of pendingPenaltyFails) {
    const goals = playerGoals.get(playerId) ?? [];
    const tally = getTally(playerId, null);
    for (const f of fails) {
      const retaken = goals.some(g => g.shootout === f.shootout && Math.abs(g.minute - f.minute) <= 1);
      if (retaken) continue; // repetido y marcado → no es fallo
      if (f.kind === 'missed') {
        if (f.shootout) tally.penalty_missed_shootout++; else tally.penalty_missed_play++;
      } else {
        if (f.shootout) tally.penalty_saved_shootout++; else tally.penalty_saved_play++;
      }
    }
  }

  // ── Minutos jugados e intervalo en campo ─────────────────────────────────────
  const subOutByPlayer = new Map(substitutions.map(s => [s.playerOutId, s.minute]));
  const inByPlayer = new Map(substitutions.map(s => [s.playerInId, s.minute]));

  // Salida = lo primero que ocurra entre sustitución y expulsión.
  const exitMinute = (fifaPlayerId: string): number | undefined => {
    const sub = subOutByPlayer.get(fifaPlayerId);
    const red = redMinuteByPlayer.get(fifaPlayerId);
    const mins = [sub, red].filter((m): m is number => m !== undefined);
    return mins.length ? Math.min(...mins) : undefined;
  };

  for (const entry of lineup) {
    const tally = getTally(entry.fifaPlayerId, entry.fifaTeamId);
    const out = exitMinute(entry.fifaPlayerId);
    if (entry.isStarter) {
      tally.minute_in = 0;
      tally.minute_out = out !== undefined ? Math.min(out, matchDurationMin) : null;
      tally.minutes_played = tally.minute_out ?? matchDurationMin;
    } else {
      const inMin = inByPlayer.get(entry.fifaPlayerId);
      if (inMin !== undefined) {
        tally.minute_in = Math.min(inMin, matchDurationMin);
        tally.minute_out = out !== undefined ? Math.min(out, matchDurationMin) : null;
        const end = tally.minute_out ?? matchDurationMin;
        tally.minutes_played = Math.max(0, end - tally.minute_in);
      }
      // Suplente que no entró: 0 minutos (no genera registro útil, se filtra después)
    }
  }

  return { tallies, goalEvents, unmappedTypes };
}

// ─── Estado en vivo de un partido ────────────────────────────────────────────

export interface LiveMatchStatus {
  status: MatchStatus;
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
}

/** Marcador y minuto actuales desde el endpoint live (parseo defensivo). */
export function extractLiveStatus(liveData: unknown): LiveMatchStatus {
  const d = liveData as AnyObj;
  return {
    status: mapStatus(d?.MatchStatus),
    minute: parseMinute(d?.MatchTime) ?? parseMinute(d?.MatchMinute) ?? null,
    homeScore: intOrNull(d?.HomeTeam?.Score) ?? intOrNull(d?.HomeTeamScore),
    awayScore: intOrNull(d?.AwayTeam?.Score) ?? intOrNull(d?.AwayTeamScore),
  };
}

/** Alineaciones desde el endpoint live: nombres + titular/suplente. */
export function extractLineup(liveData: unknown): LineupEntry[] {
  const data = liveData as AnyObj;
  const entries: LineupEntry[] = [];
  for (const side of ['HomeTeam', 'AwayTeam']) {
    const team = data?.[side] as AnyObj | undefined;
    const teamId = team?.IdTeam ? String(team.IdTeam) : null;
    const players = Array.isArray(team?.Players) ? team!.Players : [];
    for (const raw of players) {
      const p = raw as AnyObj;
      if (!p?.IdPlayer) continue;
      entries.push({
        fifaPlayerId: String(p.IdPlayer),
        fifaTeamId: teamId,
        name: localized(p.PlayerName) || localized(p.ShortName) || '',
        // Status 1 = titular en api.fifa.com/v3
        isStarter: p.Status === 1,
      });
    }
  }
  return entries;
}
