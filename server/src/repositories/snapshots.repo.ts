import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';

export interface SnapshotEntry {
  porraId: string;
  position: number;
  points: number;
}

export const SnapshotsRepo = {
  /**
   * Guarda una foto del ranking actual. Todas las filas se insertan en una sola
   * sentencia para que compartan el mismo `created_at` (NOW() es constante dentro
   * de una sentencia en Postgres), lo que permite recuperar el lote como unidad.
   */
  async save(snapshotType: string, entries: SnapshotEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const e of entries) {
      values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},NOW())`);
      params.push(uuid(), e.porraId, e.position, e.points, snapshotType);
    }
    await getDb().query(
      `INSERT INTO ranking_snapshots(id,porra_id,position,points,snapshot_type,created_at) VALUES ${values.join(',')}`,
      params,
    );
  },

  /**
   * Posiciones del snapshot más reciente disponible (porra_id → position).
   * Vacío si todavía no hay ningún snapshot.
   */
  async latestPositions(): Promise<Map<string, number>> {
    const res = await getDb().query(`
      SELECT porra_id, position FROM ranking_snapshots
      WHERE created_at = (SELECT MAX(created_at) FROM ranking_snapshots)
    `);
    const map = new Map<string, number>();
    for (const r of res.rows as Array<{ porra_id: string; position: number }>) {
      map.set(r.porra_id, Number(r.position));
    }
    return map;
  },
};
