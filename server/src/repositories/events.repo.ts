import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { MatchPlayerEventRecord } from '../types';

const COLS = `id,match_id,player_id,team_id,minutes_played,goals_open_play,goals_penalty_play,
  goals_penalty_shootout,assists,penalty_saved_play,penalty_saved_shootout,red_card,
  penalty_conceded,penalty_missed_play,penalty_missed_shootout,own_goals,
  is_improvised_goalkeeper,source,is_confirmed`;

export const EventsRepo = {
  findByMatch(matchId: string): MatchPlayerEventRecord[] {
    return getDb().prepare(`SELECT ${COLS} FROM match_player_events WHERE match_id=?`).all(matchId) as MatchPlayerEventRecord[];
  },

  findAllConfirmed(): MatchPlayerEventRecord[] {
    return getDb().prepare(`SELECT ${COLS} FROM match_player_events WHERE is_confirmed=1`).all() as MatchPlayerEventRecord[];
  },

  findAll(): MatchPlayerEventRecord[] {
    return getDb().prepare(`SELECT ${COLS} FROM match_player_events`).all() as MatchPlayerEventRecord[];
  },

  upsert(data: Omit<MatchPlayerEventRecord, 'id'>): void {
    const id = uuid();
    getDb().prepare(`
      INSERT INTO match_player_events(id,match_id,player_id,team_id,minutes_played,goals_open_play,
        goals_penalty_play,goals_penalty_shootout,assists,penalty_saved_play,penalty_saved_shootout,
        red_card,penalty_conceded,penalty_missed_play,penalty_missed_shootout,own_goals,
        is_improvised_goalkeeper,source,is_confirmed)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(match_id,player_id) DO UPDATE SET
        minutes_played=excluded.minutes_played, goals_open_play=excluded.goals_open_play,
        goals_penalty_play=excluded.goals_penalty_play, goals_penalty_shootout=excluded.goals_penalty_shootout,
        assists=excluded.assists, penalty_saved_play=excluded.penalty_saved_play,
        penalty_saved_shootout=excluded.penalty_saved_shootout, red_card=excluded.red_card,
        penalty_conceded=excluded.penalty_conceded, penalty_missed_play=excluded.penalty_missed_play,
        penalty_missed_shootout=excluded.penalty_missed_shootout, own_goals=excluded.own_goals,
        is_improvised_goalkeeper=excluded.is_improvised_goalkeeper, source=excluded.source,
        is_confirmed=excluded.is_confirmed
    `).run(id, data.match_id, data.player_id, data.team_id, data.minutes_played,
      data.goals_open_play, data.goals_penalty_play, data.goals_penalty_shootout,
      data.assists, data.penalty_saved_play, data.penalty_saved_shootout,
      data.red_card, data.penalty_conceded, data.penalty_missed_play,
      data.penalty_missed_shootout, data.own_goals, data.is_improvised_goalkeeper,
      data.source, data.is_confirmed,
    );
  },

  confirmAll(matchId: string): void {
    getDb().prepare(`UPDATE match_player_events SET is_confirmed=1 WHERE match_id=?`).run(matchId);
  },

  delete(matchId: string, playerId: string): void {
    getDb().prepare('DELETE FROM match_player_events WHERE match_id=? AND player_id=?').run(matchId, playerId);
  },
};
