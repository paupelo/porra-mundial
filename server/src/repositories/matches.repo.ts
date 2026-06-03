import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { MatchRecord, TeamPhaseResultRecord } from '../types';

export const MatchesRepo = {
  async findAll(): Promise<MatchRecord[]> {
    const result = await getDb().query(`SELECT id,phase,home_team_id,away_team_id,match_date,status,
      home_score,away_score,decided_by_penalties,penalty_winner_id FROM matches ORDER BY match_date`);
    return result.rows as MatchRecord[];
  },

  async findById(id: string): Promise<MatchRecord | undefined> {
    const result = await getDb().query(`SELECT id,phase,home_team_id,away_team_id,match_date,status,
      home_score,away_score,decided_by_penalties,penalty_winner_id FROM matches WHERE id=$1`, [id]);
    return result.rows[0] as MatchRecord | undefined;
  },

  async create(data: Omit<MatchRecord, 'id'>): Promise<MatchRecord> {
    const id = uuid();
    await getDb().query(`INSERT INTO matches(id,phase,home_team_id,away_team_id,match_date,status,
      home_score,away_score,decided_by_penalties,penalty_winner_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.phase, data.home_team_id, data.away_team_id, data.match_date ?? null,
        data.status, data.home_score ?? null, data.away_score ?? null,
        data.decided_by_penalties, data.penalty_winner_id ?? null],
    );
    return { id, ...data };
  },

  async update(id: string, data: Partial<Omit<MatchRecord, 'id'>>): Promise<void> {
    const keys = Object.keys(data);
    const fields = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
    await getDb().query(`UPDATE matches SET ${fields} WHERE id=$${keys.length + 1}`, [...Object.values(data), id]);
  },

  async delete(id: string): Promise<void> {
    await getDb().query('DELETE FROM matches WHERE id=$1', [id]);
  },
};

export const PhaseResultsRepo = {
  async findAll(): Promise<TeamPhaseResultRecord[]> {
    const result = await getDb().query('SELECT id,team_id,phase,result FROM team_phase_results');
    return result.rows as TeamPhaseResultRecord[];
  },

  async upsert(teamId: string, phase: string, result: string): Promise<void> {
    const id = uuid();
    await getDb().query(`INSERT INTO team_phase_results(id,team_id,phase,result) VALUES($1,$2,$3,$4)
      ON CONFLICT(team_id,phase) DO UPDATE SET result=EXCLUDED.result`,
      [id, teamId, phase, result]);
  },

  async delete(teamId: string, phase: string): Promise<void> {
    await getDb().query('DELETE FROM team_phase_results WHERE team_id=$1 AND phase=$2', [teamId, phase]);
  },
};
