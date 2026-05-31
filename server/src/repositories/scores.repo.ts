import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';

export interface ScoreRow {
  id: string;
  porra_id: string;
  total_points: number;
  breakdown_json: string | null;
  calculated_at: string;
}

export const ScoresRepo = {
  findAll(): ScoreRow[] {
    return getDb().prepare('SELECT id,porra_id,total_points,breakdown_json,calculated_at FROM porra_scores ORDER BY total_points DESC').all() as ScoreRow[];
  },

  findByPorra(porraId: string): ScoreRow | undefined {
    return getDb().prepare('SELECT id,porra_id,total_points,breakdown_json,calculated_at FROM porra_scores WHERE porra_id=?').get(porraId) as ScoreRow | undefined;
  },

  upsert(porraId: string, totalPoints: number, breakdown: unknown): void {
    const id = uuid();
    getDb().prepare(`
      INSERT INTO porra_scores(id,porra_id,total_points,breakdown_json,calculated_at)
      VALUES(?,?,?,?,datetime('now'))
      ON CONFLICT(porra_id) DO UPDATE SET
        total_points=excluded.total_points,
        breakdown_json=excluded.breakdown_json,
        calculated_at=excluded.calculated_at
    `).run(id, porraId, totalPoints, JSON.stringify(breakdown));
  },
};
