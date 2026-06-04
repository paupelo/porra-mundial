import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import {
  ParticipantRecord, PorraFull, PorraLineupRecord,
  PorraRecord, PorraSelectionRecord, PorraStatus,
} from '../types';

export const ParticipantsRepo = {
  async findAll(): Promise<ParticipantRecord[]> {
    const result = await getDb().query('SELECT id,name,email FROM participants ORDER BY name');
    return result.rows as ParticipantRecord[];
  },

  async findById(id: string): Promise<ParticipantRecord | undefined> {
    const result = await getDb().query('SELECT id,name,email FROM participants WHERE id=$1', [id]);
    return result.rows[0] as ParticipantRecord | undefined;
  },

  async create(data: Omit<ParticipantRecord, 'id'>): Promise<ParticipantRecord> {
    const id = uuid();
    await getDb().query('INSERT INTO participants(id,name,email) VALUES($1,$2,$3)', [id, data.name, data.email ?? null]);
    return { id, ...data };
  },

  async update(id: string, data: Partial<Omit<ParticipantRecord, 'id'>>): Promise<void> {
    const keys = Object.keys(data);
    const fields = keys.map((k, i) => `${k}=$${i + 1}`).join(',');
    await getDb().query(`UPDATE participants SET ${fields} WHERE id=$${keys.length + 1}`, [...Object.values(data), id]);
  },

  async delete(id: string): Promise<void> {
    await getDb().query('DELETE FROM participants WHERE id=$1', [id]);
  },
};

const PORRA_COLS = 'id,participant_id,mvp_player_id,is_locked,status,submitted_email,submitted_data_json';

export const PorrasRepo = {
  async findAll(): Promise<PorraRecord[]> {
    const result = await getDb().query(`SELECT ${PORRA_COLS} FROM porras`);
    return result.rows as PorraRecord[];
  },

  async findByParticipant(participantId: string): Promise<PorraRecord | undefined> {
    const result = await getDb().query(`SELECT ${PORRA_COLS} FROM porras WHERE participant_id=$1`, [participantId]);
    return result.rows[0] as PorraRecord | undefined;
  },

  async findPending(): Promise<PorraFull[]> {
    return PorrasRepo._findAllFullWhere("p.status = 'pending'");
  },

  async countByEmail(email: string): Promise<number> {
    const result = await getDb().query(
      'SELECT COUNT(*) as cnt FROM porras WHERE submitted_email = $1',
      [email]
    );
    return parseInt(result.rows[0].cnt, 10);
  },

  async nameExistsApproved(name: string): Promise<boolean> {
    const result = await getDb().query(
      "SELECT COUNT(*) as cnt FROM porras po JOIN participants pa ON pa.id = po.participant_id WHERE lower(pa.name) = lower($1) AND po.status = 'approved'",
      [name]
    );
    return parseInt(result.rows[0].cnt, 10) > 0;
  },

  async submit(nombre: string, email: string, rawData: object): Promise<PorraRecord> {
    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      const participantId = uuid();
      const porraId = uuid();
      await client.query('INSERT INTO participants(id,name,email) VALUES($1,$2,NULL)', [participantId, nombre]);
      await client.query(
        "INSERT INTO porras(id,participant_id,status,submitted_email,submitted_data_json) VALUES($1,$2,'pending',$3,$4)",
        [porraId, participantId, email, JSON.stringify(rawData)]
      );
      await client.query('COMMIT');
      return { id: porraId, participant_id: participantId, is_locked: 0, status: 'pending', submitted_email: email, submitted_data_json: JSON.stringify(rawData) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async setStatus(porraId: string, status: PorraStatus): Promise<void> {
    await getDb().query('UPDATE porras SET status=$1 WHERE id=$2', [status, porraId]);
  },

  async create(participantId: string): Promise<PorraRecord> {
    const id = uuid();
    await getDb().query("INSERT INTO porras(id,participant_id,status) VALUES($1,$2,'pending')", [id, participantId]);
    return { id, participant_id: participantId, is_locked: 0, status: 'pending', submitted_email: null, submitted_data_json: null };
  },

  async setMvp(porraId: string, playerId: string | null): Promise<void> {
    await getDb().query('UPDATE porras SET mvp_player_id=$1 WHERE id=$2', [playerId, porraId]);
  },

  async lock(porraId: string): Promise<void> {
    await getDb().query('UPDATE porras SET is_locked=1 WHERE id=$1', [porraId]);
  },

  // Selections
  async setSelections(porraId: string, selections: Array<{ team_id: string; is_winner: boolean }>): Promise<void> {
    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM porra_selections WHERE porra_id=$1', [porraId]);
      for (const s of selections) {
        await client.query('INSERT INTO porra_selections(id,porra_id,team_id,is_winner) VALUES($1,$2,$3,$4)', [uuid(), porraId, s.team_id, s.is_winner ? 1 : 0]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getSelections(porraId: string): Promise<PorraSelectionRecord[]> {
    const result = await getDb().query('SELECT id,porra_id,team_id,is_winner FROM porra_selections WHERE porra_id=$1', [porraId]);
    return result.rows as PorraSelectionRecord[];
  },

  // Lineup
  async setLineup(porraId: string, lineup: Array<Omit<PorraLineupRecord, 'id' | 'porra_id'>>): Promise<void> {
    const client = await getDb().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM porra_lineup WHERE porra_id=$1', [porraId]);
      for (const l of lineup) {
        await client.query('INSERT INTO porra_lineup(id,porra_id,player_id,role,position_slot,is_captain) VALUES($1,$2,$3,$4,$5,$6)', [uuid(), porraId, l.player_id, l.role, l.position_slot, l.is_captain]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getLineup(porraId: string): Promise<PorraLineupRecord[]> {
    const result = await getDb().query('SELECT id,porra_id,player_id,role,position_slot,is_captain FROM porra_lineup WHERE porra_id=$1', [porraId]);
    return result.rows as PorraLineupRecord[];
  },

  // Full porra — only approved ones (used by the scoring engine and clasificacion)
  async findAllFull(): Promise<PorraFull[]> {
    return PorrasRepo._findAllFullWhere("p.status = 'approved'");
  },

  // All porras regardless of status (used by admin)
  async findAllFullAdmin(): Promise<PorraFull[]> {
    return PorrasRepo._findAllFullWhere('1=1');
  },

  async _findAllFullWhere(where: string): Promise<PorraFull[]> {
    const db = getDb();
    const porrasResult = await db.query(
      `SELECT p.id,p.participant_id,p.mvp_player_id,p.is_locked,p.status,p.submitted_email,p.submitted_data_json FROM porras p WHERE ${where}`
    );
    const allPorras = porrasResult.rows as (PorraRecord & { mvp_player_id?: string })[];

    if (allPorras.length === 0) return [];

    const ids = allPorras.map(p => p.id);
    const participantsResult = await db.query('SELECT id,name,email FROM participants');
    const allSelsResult = await db.query(
      'SELECT id,porra_id,team_id,is_winner FROM porra_selections WHERE porra_id = ANY($1)',
      [ids]
    );
    const allLineupResult = await db.query(
      'SELECT id,porra_id,player_id,role,position_slot,is_captain FROM porra_lineup WHERE porra_id = ANY($1)',
      [ids]
    );

    const participants = participantsResult.rows as ParticipantRecord[];
    const allSels = allSelsResult.rows as PorraSelectionRecord[];
    const allLinup = allLineupResult.rows as PorraLineupRecord[];

    const partById = new Map(participants.map(p => [p.id, p]));
    return allPorras.map(porra => ({
      porra,
      participant: partById.get(porra.participant_id)!,
      selections: allSels.filter(s => s.porra_id === porra.id),
      lineup: allLinup.filter(l => l.porra_id === porra.id),
      mvpPlayerId: (porra as any).mvp_player_id ?? undefined,
    }));
  },
};
