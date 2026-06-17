import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import { ScoreLineItem } from '../types';

export interface TeamPointsLogRow {
  porra_id: string;
  team_id: string;
  team_name: string;
  match_id: string | null;
  category: string;
  is_ganador: 0 | 1;
  points_breakdown: ScoreLineItem[];
  points_raw: number;
  multiplier: number;
  points_total: number;
  is_live: 0 | 1;
}

export interface PlayerPointsLogRow {
  porra_id: string;
  player_id: string;
  player_name: string;
  match_id: string | null;
  position: string;
  is_captain: 0 | 1;
  is_substitute: 0 | 1;
  substitute_promoted: 0 | 1;
  points_breakdown: ScoreLineItem[];
  points_raw: number;
  multiplier: number;
  points_total: number;
  is_live: 0 | 1;
}

/**
 * Los logs son una proyección derivada del motor: se regeneran completos en
 * cada recálculo. La fuente de verdad sigue siendo eventos + porras.
 */
export const PointsLogRepo = {
  async replaceForPorra(porraId: string, teamRows: TeamPointsLogRow[], playerRows: PlayerPointsLogRow[]): Promise<void> {
    const db = getDb();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM team_points_log WHERE porra_id=$1', [porraId]);
      await client.query('DELETE FROM player_points_log WHERE porra_id=$1', [porraId]);
      for (const r of teamRows) {
        await client.query(
          `INSERT INTO team_points_log(id,porra_id,team_id,team_name,match_id,category,is_ganador,
             points_breakdown,points_raw,multiplier,points_total,is_live)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [uuid(), r.porra_id, r.team_id, r.team_name, r.match_id, r.category, r.is_ganador,
            JSON.stringify(r.points_breakdown), r.points_raw, r.multiplier, r.points_total, r.is_live]);
      }
      for (const r of playerRows) {
        await client.query(
          `INSERT INTO player_points_log(id,porra_id,player_id,player_name,match_id,position,
             is_captain,is_substitute,substitute_promoted,points_breakdown,points_raw,multiplier,points_total,is_live)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [uuid(), r.porra_id, r.player_id, r.player_name, r.match_id, r.position,
            r.is_captain, r.is_substitute, r.substitute_promoted,
            JSON.stringify(r.points_breakdown), r.points_raw, r.multiplier, r.points_total, r.is_live]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async findTeamLogByPorra(porraId: string): Promise<TeamPointsLogRow[]> {
    const result = await getDb().query('SELECT * FROM team_points_log WHERE porra_id=$1', [porraId]);
    return result.rows as TeamPointsLogRow[];
  },

  async findPlayerLogByPorra(porraId: string): Promise<PlayerPointsLogRow[]> {
    const result = await getDb().query('SELECT * FROM player_points_log WHERE porra_id=$1', [porraId]);
    return result.rows as PlayerPointsLogRow[];
  },
};
