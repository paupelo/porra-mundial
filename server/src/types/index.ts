// ─── Enumeraciones del dominio ────────────────────────────────────────────────

export type Phase =
  | 'grupos'
  | 'dieciseisavos'
  | 'octavos'
  | 'cuartos'
  | 'semifinales'
  | 'final';

export type Category = 'favoritos' | 'sorpresas' | 'petardazos' | 'caca';

export type Position = 'portero' | 'defensa' | 'medio' | 'delantero';

export type MatchStatus = 'pending' | 'live' | 'finished';

export type PhaseResultType = 'advanced' | 'eliminated' | 'winner';

export type LineupRole = 'titular' | 'suplente';

export type PorraStatus = 'pending' | 'approved' | 'rejected';

export type EventSource = 'manual' | 'besoccer_draft' | 'fifa_draft';

// ─── Registros de base de datos (lo que devuelven los repos) ─────────────────

export interface TeamRecord {
  id: string;
  name: string;
  country_code: string | null;
  category: Category;
}

export interface PlayerRecord {
  id: string;
  name: string;
  team_id: string;
  position: Position;
}

export interface MatchRecord {
  id: string;
  phase: Phase;
  home_team_id: string;
  away_team_id: string;
  match_date: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  decided_by_penalties: 0 | 1;
  penalty_winner_id: string | null;
  /** Campos del scraper de FIFA (null en partidos creados a mano) */
  fifa_match_id?: string | null;
  fifa_stage_id?: string | null;
  group_name?: string | null;
  venue?: string | null;
  last_scraped_at?: string | null;
}

export interface MatchPlayerEventRecord {
  id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  minutes_played: number;
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
  is_improvised_goalkeeper: 0 | 1;
  source: EventSource;
  is_confirmed: 0 | 1;
}

export interface TeamPhaseResultRecord {
  id: string;
  team_id: string;
  phase: Phase;
  result: PhaseResultType;
}

export interface ParticipantRecord {
  id: string;
  name: string;
  email: string | null;
}

export interface PorraRecord {
  id: string;
  participant_id: string;
  is_locked: 0 | 1;
  status: PorraStatus;
  submitted_email: string | null;
  submitted_data_json: string | null;
}

export interface PorraSubmission {
  nombre: string;
  email: string;
  selections: Array<{ team_id: string; is_winner: boolean }>;
  lineup: Array<Omit<PorraLineupRecord, 'id' | 'porra_id'>>;
}

export interface PorraSelectionRecord {
  id: string;
  porra_id: string;
  team_id: string;
  is_winner: 0 | 1;
}

export interface PorraLineupRecord {
  id: string;
  porra_id: string;
  player_id: string;
  role: LineupRole;
  position_slot: Position;
  is_captain: 0 | 1;
}

// ─── Entrada del motor de cálculo ─────────────────────────────────────────────

export interface PorraFull {
  porra: PorraRecord;
  participant: ParticipantRecord;
  selections: PorraSelectionRecord[];
  lineup: PorraLineupRecord[];
  /** Si un jugador tiene mvp=true, suma +50 plano al final */
  mvpPlayerId?: string;
}

export interface CalcInput {
  matches: MatchRecord[];
  /** Solo eventos con is_confirmed=1 */
  events: MatchPlayerEventRecord[];
  teamPhaseResults: TeamPhaseResultRecord[];
  porras: PorraFull[];
  teams: TeamRecord[];
  players: PlayerRecord[];
}

// ─── Salida del motor de cálculo ──────────────────────────────────────────────

export interface ScoreLineItem {
  concept: string;
  matchId?: string;
  phase: Phase;
  basePoints: number;
  phaseMultiplier: number;
  /** ×2 si equipo ganador, ×1 si no */
  winnerMultiplier: number;
  /** ×2 si capitán, ×0.5 si suplente activo, ×1 si no aplica */
  roleMultiplier: number;
  finalPoints: number;
}

export interface TeamScoreResult {
  teamId: string;
  teamName: string;
  category: Category;
  isWinner: boolean;
  totalPoints: number;
  items: ScoreLineItem[];
}

export interface PlayerScoreResult {
  playerId: string;
  playerName: string;
  position: Position;
  teamId: string;
  role: LineupRole;
  positionSlot: Position;
  isCaptain: boolean;
  totalPoints: number;
  items: ScoreLineItem[];
}

export interface PorraScoreResult {
  porraId: string;
  participantId: string;
  participantName: string;
  totalPoints: number;
  selecciones: TeamScoreResult[];
  jugadores: PlayerScoreResult[];
}

export interface ClasificacionResult {
  position: number;
  porraId: string;
  participantId: string;
  participantName: string;
  totalPoints: number;
  breakdown: {
    selecciones: TeamScoreResult[];
    jugadores: PlayerScoreResult[];
  };
}
