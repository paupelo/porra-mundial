import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { TeamRecord } from '../types';

export const TeamsRepo = {
  findAll(): TeamRecord[] {
    return getDb().prepare('SELECT id,name,country_code,category FROM teams ORDER BY category,name').all() as TeamRecord[];
  },

  findById(id: string): TeamRecord | undefined {
    return getDb().prepare('SELECT id,name,country_code,category FROM teams WHERE id=?').get(id) as TeamRecord | undefined;
  },

  create(data: Omit<TeamRecord, 'id'>): TeamRecord {
    const id = uuid();
    getDb().prepare('INSERT INTO teams(id,name,country_code,category) VALUES(?,?,?,?)').run(id, data.name, data.country_code ?? null, data.category);
    return { id, ...data };
  },

  update(id: string, data: Partial<Omit<TeamRecord, 'id'>>): void {
    const fields = Object.keys(data).map(k => `${k}=?`).join(',');
    getDb().prepare(`UPDATE teams SET ${fields} WHERE id=?`).run(...Object.values(data), id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM teams WHERE id=?').run(id);
  },
};
