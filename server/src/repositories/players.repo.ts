import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { PlayerRecord } from '../types';

export const PlayersRepo = {
  async findAll(): Promise<PlayerRecord[]> {
    const result = await getDb().query('SELECT id,name,team_id,position FROM players ORDER BY team_id,position,name');
    return result.rows as PlayerRecord[];
  },

  async findByTeam(teamId: string): Promise<PlayerRecord[]> {
    const result = await getDb().query('SELECT id,name,team_id,position FROM players WHERE team_id=$1 ORDER BY position,name', [teamId]);
    return result.rows as PlayerRecord[];
  },

  async findById(id: string): Promise<PlayerRecord | undefined> {
    const result = await getDb().query('SELECT id,name,team_id,position FROM players WHERE id=$1', [id]);
    return result.rows[0] as PlayerRecord | undefined;
  },

  async create(data: Omit<PlayerRecord, 'id'>): Promise<PlayerRecord> {
    const id = uuid();
    await getDb().query('INSERT INTO players(id,name,team_id,position) VALUES($1,$2,$3,$4)', [id, data.name, data.team_id, data.position]);
    return { id, ...data };
  },

  async update(id: string, data: Partial<Omit<PlayerRecord, 'id'>>): Promise<void> {
    const keys = Object.keys(data);
    const fields = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
    await getDb().query(`UPDATE players SET ${fields} WHERE id=$${keys.length + 1}`, [...Object.values(data), id]);
  },

  async delete(id: string): Promise<void> {
    await getDb().query('DELETE FROM players WHERE id=$1', [id]);
  },
};
