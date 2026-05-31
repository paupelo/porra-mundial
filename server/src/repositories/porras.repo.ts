import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database';
import {
  ParticipantRecord, PorraFull, PorraLineupRecord,
  PorraRecord, PorraSelectionRecord,
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

export const PorrasRepo = {
  findAll(): PorraRecord[] {
    return getDb().prepare('SELECT id,participant_id,mvp_player_id,is_locked FROM porras').all() as PorraRecord[];
  },

  findByParticipant(participantId: string): PorraRecord | undefined {
    return getDb().prepare('SELECT id,participant_id,mvp_player_id,is_locked FROM porras WHERE participant_id=?').get(participantId) as PorraRecord | undefined;
  },

  create(participantId: string): PorraRecord {
    const id = uuid();
    getDb().prepare('INSERT INTO porras(id,participant_id) VALUES(?,?)').run(id, participantId);
    return { id, participant_id: participantId, is_locked: 0 };
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

  // Full porra (used by the scoring engine)
  findAllFull(): PorraFull[] {
    const db = getDb();
    const participants = db.prepare('SELECT id,name,email FROM participants').all() as ParticipantRecord[];
    const allPorras = db.prepare('SELECT id,participant_id,mvp_player_id,is_locked FROM porras').all() as (PorraRecord & { mvp_player_id?: string })[];
    const allSels = db.prepare('SELECT id,porra_id,team_id,is_winner FROM porra_selections').all() as PorraSelectionRecord[];
    const allLinup = db.prepare('SELECT id,porra_id,player_id,role,position_slot,is_captain FROM porra_lineup').all() as PorraLineupRecord[];

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
