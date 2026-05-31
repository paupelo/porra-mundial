import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { MatchRecord, TeamPhaseResultRecord } from '../types';

export const MatchesRepo = {
  findAll(): MatchRecord[] {
    return getDb().prepare(`SELECT id,phase,home_team_id,away_team_id,match_date,status,
      home_score,away_score,decided_by_penalties,penalty_winner_id FROM matches ORDER BY match_date`).all() as MatchRecord[];
  },

  findById(id: string): MatchRecord | undefined {
    return getDb().prepare(`SELECT id,phase,home_team_id,away_team_id,match_date,status,
      home_score,away_score,decided_by_penalties,penalty_winner_id FROM matches WHERE id=?`).get(id) as MatchRecord | undefined;
  },

  create(data: Omit<MatchRecord, 'id'>): MatchRecord {
    const id = uuid();
    getDb().prepare(`INSERT INTO matches(id,phase,home_team_id,away_team_id,match_date,status,
      home_score,away_score,decided_by_penalties,penalty_winner_id)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
      id, data.phase, data.home_team_id, data.away_team_id, data.match_date ?? null,
      data.status, data.home_score ?? null, data.away_score ?? null,
      data.decided_by_penalties, data.penalty_winner_id ?? null,
    );
    return { id, ...data };
  },

  update(id: string, data: Partial<Omit<MatchRecord, 'id'>>): void {
    const fields = Object.keys(data).map(k => `${k}=?`).join(',');
    getDb().prepare(`UPDATE matches SET ${fields} WHERE id=?`).run(...Object.values(data), id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM matches WHERE id=?').run(id);
  },
};

export const PhaseResultsRepo = {
  findAll(): TeamPhaseResultRecord[] {
    return getDb().prepare('SELECT id,team_id,phase,result FROM team_phase_results').all() as TeamPhaseResultRecord[];
  },

  upsert(teamId: string, phase: string, result: string): void {
    const id = uuid();
    getDb().prepare(`INSERT INTO team_phase_results(id,team_id,phase,result) VALUES(?,?,?,?)
      ON CONFLICT(team_id,phase) DO UPDATE SET result=excluded.result`).run(id, teamId, phase, result);
  },

  delete(teamId: string, phase: string): void {
    getDb().prepare('DELETE FROM team_phase_results WHERE team_id=? AND phase=?').run(teamId, phase);
  },
};
