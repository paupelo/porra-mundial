import { getDb } from './database';
import fs from 'fs';
import path from 'path';

export async function runMigrations(): Promise<void> {
  const db = getDb();

  // Columnas nuevas en tablas existentes. Deben ir ANTES de schema.sql porque
  // este crea un índice sobre matches(fifa_match_id) que fallaría si la columna
  // no existe todavía en una BD antigua. En una BD nueva fallan (la tabla aún no
  // existe) y se ignoran: schema.sql ya crea la tabla con estas columnas.
  const preAlters = [
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_match_id TEXT',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS fifa_stage_id TEXT',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS group_name TEXT',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue TEXT',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ',
  ];
  for (const sql of preAlters) {
    await db.query(sql).catch(() => {});
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await db.query(schema);

  // Add columns if missing (idempotent ALTER TABLE)
  const alters = [
    "ALTER TABLE porras ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'",
    'ALTER TABLE porras ADD COLUMN IF NOT EXISTS submitted_email TEXT',
    'ALTER TABLE porras ADD COLUMN IF NOT EXISTS submitted_data_json TEXT',
    // Estado en vivo (junio 2026): minuto/marcador provisional + flags is_live
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS minute INTEGER',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_home_score INTEGER',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_away_score INTEGER',
    'ALTER TABLE match_player_events ADD COLUMN IF NOT EXISTS is_live INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE team_points_log ADD COLUMN IF NOT EXISTS is_live INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE player_points_log ADD COLUMN IF NOT EXISTS is_live INTEGER NOT NULL DEFAULT 0',
    // Portería a cero y goles encajados por tiempo en campo (junio 2026): minuto
    // de entrada/salida por jugador y minutos de gol por equipo en cada partido.
    'ALTER TABLE match_player_events ADD COLUMN IF NOT EXISTS minute_in INTEGER',
    'ALTER TABLE match_player_events ADD COLUMN IF NOT EXISTS minute_out INTEGER',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_goal_minutes INTEGER[]',
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_goal_minutes INTEGER[]',
    // Fuente BeSoccer para fase KO (junio 2026): URL del partido en es.besoccer.com.
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS besoccer_url TEXT',
    // Autocorrección post-partido (junio 2026): versión de la lógica con la que se
    // derivaron los eventos. El scheduler re-scrapea los partidos cuya versión sea
    // inferior a RECONCILE_VERSION para reaplicar cambios de scraper/scoring sin admin.
    'ALTER TABLE matches ADD COLUMN IF NOT EXISTS reconcile_version INTEGER NOT NULL DEFAULT 0',
    // Ampliar el CHECK de source para admitir borradores del scraper de FIFA.
    // El par DROP+ADD es idempotente ejecutado en este orden.
    'ALTER TABLE match_player_events DROP CONSTRAINT IF EXISTS match_player_events_source_check',
    "ALTER TABLE match_player_events ADD CONSTRAINT match_player_events_source_check CHECK (source IN ('manual','besoccer_draft','fifa_draft'))",
  ];
  for (const sql of alters) {
    await db.query(sql).catch(() => {});
  }
  console.log('✓ Migrations applied');
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0)).catch(console.error);
}
