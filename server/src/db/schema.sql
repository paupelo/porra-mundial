PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Catálogo del torneo ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  country_code TEXT,
  category     TEXT NOT NULL CHECK (category IN ('favoritos','sorpresas','petardazos','caca')),
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  position   TEXT NOT NULL CHECK (position IN ('portero','defensa','medio','delantero')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── Partidos y eventos ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
  id                   TEXT PRIMARY KEY,
  phase                TEXT NOT NULL CHECK (phase IN ('grupos','dieciseisavos','octavos','cuartos','semifinales','final')),
  home_team_id         TEXT NOT NULL REFERENCES teams(id),
  away_team_id         TEXT NOT NULL REFERENCES teams(id),
  match_date           TEXT,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','live','finished')),
  home_score           INTEGER,
  away_score           INTEGER,
  decided_by_penalties INTEGER NOT NULL DEFAULT 0,
  penalty_winner_id    TEXT REFERENCES teams(id),
  created_at           TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match_player_events (
  id                        TEXT PRIMARY KEY,
  match_id                  TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id                 TEXT NOT NULL REFERENCES players(id),
  team_id                   TEXT NOT NULL REFERENCES teams(id),
  minutes_played            INTEGER NOT NULL DEFAULT 0,
  goals_open_play           INTEGER NOT NULL DEFAULT 0,
  goals_penalty_play        INTEGER NOT NULL DEFAULT 0,
  goals_penalty_shootout    INTEGER NOT NULL DEFAULT 0,
  assists                   INTEGER NOT NULL DEFAULT 0,
  penalty_saved_play        INTEGER NOT NULL DEFAULT 0,
  penalty_saved_shootout    INTEGER NOT NULL DEFAULT 0,
  red_card                  INTEGER NOT NULL DEFAULT 0,
  penalty_conceded          INTEGER NOT NULL DEFAULT 0,
  penalty_missed_play       INTEGER NOT NULL DEFAULT 0,
  penalty_missed_shootout   INTEGER NOT NULL DEFAULT 0,
  own_goals                 INTEGER NOT NULL DEFAULT 0,
  is_improvised_goalkeeper  INTEGER NOT NULL DEFAULT 0,
  source                    TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','besoccer_draft')),
  is_confirmed              INTEGER NOT NULL DEFAULT 0,
  created_at                TEXT DEFAULT (datetime('now')),
  UNIQUE(match_id, player_id)
);

CREATE TABLE IF NOT EXISTS team_phase_results (
  id         TEXT PRIMARY KEY,
  team_id    TEXT NOT NULL REFERENCES teams(id),
  phase      TEXT NOT NULL CHECK (phase IN ('grupos','dieciseisavos','octavos','cuartos','semifinales','final')),
  result     TEXT NOT NULL CHECK (result IN ('advanced','eliminated','winner')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(team_id, phase)
);

-- ─── Participantes y porras ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS participants (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS porras (
  id             TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  mvp_player_id  TEXT REFERENCES players(id),
  is_locked      INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS porra_selections (
  id         TEXT PRIMARY KEY,
  porra_id   TEXT NOT NULL REFERENCES porras(id) ON DELETE CASCADE,
  team_id    TEXT NOT NULL REFERENCES teams(id),
  is_winner  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(porra_id, team_id)
);

CREATE TABLE IF NOT EXISTS porra_lineup (
  id             TEXT PRIMARY KEY,
  porra_id       TEXT NOT NULL REFERENCES porras(id) ON DELETE CASCADE,
  player_id      TEXT NOT NULL REFERENCES players(id),
  role           TEXT NOT NULL CHECK (role IN ('titular','suplente')),
  position_slot  TEXT NOT NULL CHECK (position_slot IN ('portero','defensa','medio','delantero')),
  is_captain     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(porra_id, player_id)
);

-- ─── Puntuaciones cacheadas (fuente de verdad = eventos + porras) ─────────────

CREATE TABLE IF NOT EXISTS porra_scores (
  id             TEXT PRIMARY KEY,
  porra_id       TEXT NOT NULL UNIQUE REFERENCES porras(id) ON DELETE CASCADE,
  total_points   REAL NOT NULL DEFAULT 0,
  breakdown_json TEXT,
  calculated_at  TEXT DEFAULT (datetime('now'))
);

-- ─── Admin ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_players_team     ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_matches_phase    ON matches(phase);
CREATE INDEX IF NOT EXISTS idx_events_match     ON match_player_events(match_id);
CREATE INDEX IF NOT EXISTS idx_events_player    ON match_player_events(player_id);
CREATE INDEX IF NOT EXISTS idx_events_confirmed ON match_player_events(is_confirmed);
CREATE INDEX IF NOT EXISTS idx_phase_results    ON team_phase_results(team_id);
CREATE INDEX IF NOT EXISTS idx_porra_sel        ON porra_selections(porra_id);
CREATE INDEX IF NOT EXISTS idx_porra_lineup     ON porra_lineup(porra_id);
