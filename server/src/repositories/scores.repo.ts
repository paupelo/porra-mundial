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
  async findAll(): Promise<ScoreRow[]> {
    const result = await getDb().query('SELECT id,porra_id,total_points,breakdown_json,calculated_at FROM porra_scores ORDER BY total_points DESC');
    return result.rows as ScoreRow[];
  },

  async findByPorra(porraId: string): Promise<ScoreRow | undefined> {
    const result = await getDb().query('SELECT id,porra_id,total_points,breakdown_json,calculated_at FROM porra_scores WHERE porra_id=$1', [porraId]);
    return result.rows[0] as ScoreRow | undefined;
  },

  async upsert(porraId: string, totalPoints: number, breakdown: unknown): Promise<void> {
    const id = uuid();
    await getDb().query(`
      INSERT INTO porra_scores(id,porra_id,total_points,breakdown_json,calculated_at)
      VALUES($1,$2,$3,$4,NOW())
      ON CONFLICT(porra_id) DO UPDATE SET
        total_points=EXCLUDED.total_points,
        breakdown_json=EXCLUDED.breakdown_json,
        calculated_at=EXCLUDED.calculated_at
    `, [id, porraId, totalPoints, JSON.stringify(breakdown)]);
  },
};
