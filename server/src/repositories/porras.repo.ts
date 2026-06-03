import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import {
  ParticipantRecord, PorraFull, PorraLineupRecord,
  PorraRecord, PorraSelectionRecord, PorraStatus,
} from '../types';

export const ParticipantsRepo = {
  findAll(): ParticipantRecord[] {
    return getDb().prepare('SELECT id,name,email FROM participants ORDER BY name').all() as ParticipantRecord[];
  },
  findById(id: string): ParticipantRecord | undefined {
    return getDb().prepare('SELECT id,name,email FROM participants WHERE id=?').get(id) as ParticipantRecord | undefined;
  },
  create(data: Omit<ParticipantRecord, 'id'>): ParticipantRecord {
    const id = uuid();
    getDb().prepare('INSERT INTO participants(id,name,email) VALUES(?,?,?)').run(id, data.name, data.email ?? null);
    return { id, ...data };
  },
  update(id: string, data: Partial<Omit<ParticipantRecord, 'id'>>): void {
    const fields = Object.keys(data).map(k => `${k}=?`).join(',');
    getDb().prepare(`UPDATE participants SET ${fields} WHERE id=?`).run(...Object.values(data), id);
  },
  delete(id: string): void { getDb().prepare('DELETE FROM participants WHERE id=?').run(id); },
};

const PORRA_COLS = 'id,participant_id,mvp_player_id,is_locked,status,submitted_email,submitted_data_json';

export const PorrasRepo = {
  findAll(): PorraRecord[] {
    return getDb().prepare(`SELECT ${PORRA_COLS} FROM porras`).all() as PorraRecord[];
  },

  findByParticipant(participantId: string): PorraRecord | undefined {
    return getDb().prepare(`SELECT ${PORRA_COLS} FROM porras WHERE participant_id=?`).get(participantId) as PorraRecord | undefined;
  },

  findPending(): PorraFull[] {
    return PorrasRepo._findAllFullWhere("p.status = 'pending'");
  },

  countByEmail(email: string): number {
    const row = getDb().prepare(
      'SELECT COUNT(*) as cnt FROM porras WHERE submitted_email = ?'
    ).get(email) as { cnt: number };
    return row.cnt;
  },

  nameExistsApproved(name: string): boolean {
    const row = getDb().prepare(
      "SELECT COUNT(*) as cnt FROM porras po JOIN participants pa ON pa.id = po.participant_id WHERE lower(pa.name) = lower(?) AND po.status = 'approved'"
    ).get(name) as { cnt: number };
    return row.cnt > 0;
  },

  submit(nombre: string, email: string, rawData: object): PorraRecord {
    const db = getDb();
    const participantId = uuid();
    const porraId = uuid();
    db.prepare('INSERT INTO participants(id,name,email) VALUES(?,?,NULL)').run(participantId, nombre);
    db.prepare("INSERT INTO porras(id,participant_id,status,submitted_email,submitted_data_json) VALUES(?,?,'pending',?,?)").run(
      porraId, participantId, email, JSON.stringify(rawData)
    );
    return { id: porraId, participant_id: participantId, is_locked: 0, status: 'pending', submitted_email: email, submitted_data_json: JSON.stringify(rawData) };
  },

  setStatus(porraId: string, status: PorraStatus): void {
    getDb().prepare('UPDATE porras SET status=? WHERE id=?').run(status, porraId);
  },

  create(participantId: string): PorraRecord {
    const id = uuid();
    getDb().prepare("INSERT INTO porras(id,participant_id,status) VALUES(?,?,'approved')").run(id, participantId);
    return { id, participant_id: participantId, is_locked: 0, status: 'approved', submitted_email: null, submitted_data_json: null };
  },

  setMvp(porraId: string, playerId: string | null): void {
    getDb().prepare('UPDATE porras SET mvp_player_id=? WHERE id=?').run(playerId, porraId);
  },

  lock(porraId: string): void {
    getDb().prepare('UPDATE porras SET is_locked=1 WHERE id=?').run(porraId);
  },

  // Selections
  setSelections(porraId: string, selections: Array<{ team_id: string; is_winner: boolean }>): void {
    const db = getDb();
    db.prepare('DELETE FROM porra_selections WHERE porra_id=?').run(porraId);
    const ins = db.prepare('INSERT INTO porra_selections(id,porra_id,team_id,is_winner) VALUES(?,?,?,?)');
    for (const s of selections) ins.run(uuid(), porraId, s.team_id, s.is_winner ? 1 : 0);
  },

  getSelections(porraId: string): PorraSelectionRecord[] {
    return getDb().prepare('SELECT id,porra_id,team_id,is_winner FROM porra_selections WHERE porra_id=?').all(porraId) as PorraSelectionRecord[];
  },

  // Lineup
  setLineup(porraId: string, lineup: Array<Omit<PorraLineupRecord, 'id' | 'porra_id'>>): void {
    const db = getDb();
    db.prepare('DELETE FROM porra_lineup WHERE porra_id=?').run(porraId);
    const ins = db.prepare('INSERT INTO porra_lineup(id,porra_id,player_id,role,position_slot,is_captain) VALUES(?,?,?,?,?,?)');
    for (const l of lineup) ins.run(uuid(), porraId, l.player_id, l.role, l.position_slot, l.is_captain);
  },

  getLineup(porraId: string): PorraLineupRecord[] {
    return getDb().prepare('SELECT id,porra_id,player_id,role,position_slot,is_captain FROM porra_lineup WHERE porra_id=?').all(porraId) as PorraLineupRecord[];
  },

  // Full porra — only approved ones (used by the scoring engine and clasificacion)
  findAllFull(): PorraFull[] {
    return PorrasRepo._findAllFullWhere("p.status = 'approved'");
  },

  // All porras regardless of status (used by admin)
  findAllFullAdmin(): PorraFull[] {
    return PorrasRepo._findAllFullWhere('1=1');
  },

  _findAllFullWhere(where: string): PorraFull[] {
    const db = getDb();
    const allPorras = db.prepare(
      `SELECT p.id,p.participant_id,p.mvp_player_id,p.is_locked,p.status,p.submitted_email,p.submitted_data_json FROM porras p WHERE ${where}`
    ).all() as (PorraRecord & { mvp_player_id?: string })[];

    if (allPorras.length === 0) return [];

    const ids = allPorras.map(p => p.id);
    const placeholders = ids.map(() => '?').join(',');
    const participants = db.prepare('SELECT id,name,email FROM participants').all() as ParticipantRecord[];
    const allSels = db.prepare(`SELECT id,porra_id,team_id,is_winner FROM porra_selections WHERE porra_id IN (${placeholders})`).all(...ids) as PorraSelectionRecord[];
    const allLinup = db.prepare(`SELECT id,porra_id,player_id,role,position_slot,is_captain FROM porra_lineup WHERE porra_id IN (${placeholders})`).all(...ids) as PorraLineupRecord[];

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
