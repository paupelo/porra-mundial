import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { MatchPlayerEventRecord } from '../types';

const COLS = `id,match_id,player_id,team_id,minutes_played,goals_open_play,goals_penalty_play,
  goals_penalty_shootout,assists,penalty_saved_play,penalty_saved_shootout,red_card,
  penalty_conceded,penalty_missed_play,penalty_missed_shootout,own_goals,
  is_improvised_goalkeeper,source,is_confirmed`;

export const EventsRepo = {
  async findByMatch(matchId: string): Promise<MatchPlayerEventRecord[]> {
    const result = await getDb().query(`SELECT ${COLS} FROM match_player_events WHERE match_id=$1`, [matchId]);
    return result.rows as MatchPlayerEventRecord[];
  },

  async findAllConfirmed(): Promise<MatchPlayerEventRecord[]> {
    const result = await getDb().query(`SELECT ${COLS} FROM match_player_events WHERE is_confirmed=1`);
    return result.rows as MatchPlayerEventRecord[];
  },

  async findAll(): Promise<MatchPlayerEventRecord[]> {
    const result = await getDb().query(`SELECT ${COLS} FROM match_player_events`);
    return result.rows as MatchPlayerEventRecord[];
  },

  async upsert(data: Omit<MatchPlayerEventRecord, 'id'>): Promise<void> {
    const id = uuid();
    await getDb().query(`
      INSERT INTO match_player_events(id,match_id,player_id,team_id,minutes_played,goals_open_play,
        goals_penalty_play,goals_penalty_shootout,assists,penalty_saved_play,penalty_saved_shootout,
        red_card,penalty_conceded,penalty_missed_play,penalty_missed_shootout,own_goals,
        is_improvised_goalkeeper,source,is_confirmed)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT(match_id,player_id) DO UPDATE SET
        minutes_played=EXCLUDED.minutes_played, goals_open_play=EXCLUDED.goals_open_play,
        goals_penalty_play=EXCLUDED.goals_penalty_play, goals_penalty_shootout=EXCLUDED.goals_penalty_shootout,
        assists=EXCLUDED.assists, penalty_saved_play=EXCLUDED.penalty_saved_play,
        penalty_saved_shootout=EXCLUDED.penalty_saved_shootout, red_card=EXCLUDED.red_card,
        penalty_conceded=EXCLUDED.penalty_conceded, penalty_missed_play=EXCLUDED.penalty_missed_play,
        penalty_missed_shootout=EXCLUDED.penalty_missed_shootout, own_goals=EXCLUDED.own_goals,
        is_improvised_goalkeeper=EXCLUDED.is_improvised_goalkeeper, source=EXCLUDED.source,
        is_confirmed=EXCLUDED.is_confirmed
    `, [id, data.match_id, data.player_id, data.team_id, data.minutes_played,
      data.goals_open_play, data.goals_penalty_play, data.goals_penalty_shootout,
      data.assists, data.penalty_saved_play, data.penalty_saved_shootout,
      data.red_card, data.penalty_conceded, data.penalty_missed_play,
      data.penalty_missed_shootout, data.own_goals, data.is_improvised_goalkeeper,
      data.source, data.is_confirmed]);
  },

  async confirmAll(matchId: string): Promise<void> {
    await getDb().query(`UPDATE match_player_events SET is_confirmed=1 WHERE match_id=$1`, [matchId]);
  },

  async delete(matchId: string, playerId: string): Promise<void> {
    await getDb().query('DELETE FROM match_player_events WHERE match_id=$1 AND player_id=$2', [matchId, playerId]);
  },
};
