import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { PlayerRecord } from '../types';

export const PlayersRepo = {
  findAll(): PlayerRecord[] {
    return getDb().prepare('SELECT id,name,team_id,position FROM players ORDER BY team_id,position,name').all() as PlayerRecord[];
  },

  findByTeam(teamId: string): PlayerRecord[] {
    return getDb().prepare('SELECT id,name,team_id,position FROM players WHERE team_id=? ORDER BY position,name').all(teamId) as PlayerRecord[];
  },

  findById(id: string): PlayerRecord | undefined {
    return getDb().prepare('SELECT id,name,team_id,position FROM players WHERE id=?').get(id) as PlayerRecord | undefined;
  },

  create(data: Omit<PlayerRecord, 'id'>): PlayerRecord {
    const id = uuid();
    getDb().prepare('INSERT INTO players(id,name,team_id,position) VALUES(?,?,?,?)').run(id, data.name, data.team_id, data.position);
    return { id, ...data };
  },

  update(id: string, data: Partial<Omit<PlayerRecord, 'id'>>): void {
    const fields = Object.keys(data).map(k => `${k}=?`).join(',');
    getDb().prepare(`UPDATE players SET ${fields} WHERE id=?`).run(...Object.values(data), id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM players WHERE id=?').run(id);
  },
};
