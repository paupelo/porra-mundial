import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { TeamRecord } from '../types';

export const TeamsRepo = {
  async findAll(): Promise<TeamRecord[]> {
    const result = await getDb().query('SELECT id,name,country_code,category FROM teams ORDER BY category,name');
    return result.rows as TeamRecord[];
  },

  async findById(id: string): Promise<TeamRecord | undefined> {
    const result = await getDb().query('SELECT id,name,country_code,category FROM teams WHERE id=$1', [id]);
    return result.rows[0] as TeamRecord | undefined;
  },

  async create(data: Omit<TeamRecord, 'id'>): Promise<TeamRecord> {
    const id = uuid();
    await getDb().query('INSERT INTO teams(id,name,country_code,category) VALUES($1,$2,$3,$4)', [id, data.name, data.country_code ?? null, data.category]);
    return { id, ...data };
  },

  async update(id: string, data: Partial<Omit<TeamRecord, 'id'>>): Promise<void> {
    const keys = Object.keys(data);
    const fields = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
    await getDb().query(`UPDATE teams SET ${fields} WHERE id=$${keys.length + 1}`, [...Object.values(data), id]);
  },

  async delete(id: string): Promise<void> {
    await getDb().query('DELETE FROM teams WHERE id=$1', [id]);
  },
};
