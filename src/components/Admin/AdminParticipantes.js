import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../hooks/useApi';
import CampoFormacion from '../ArmaTuPorra/CampoFormacion';
import { SELECCIONES, CATEGORIAS } from '../ArmaTuPorra/datos';

const EMPTY = { name: '', email: '' };
const CAT_ORDER  = ['favoritos', 'sorpresas', 'petardazos', 'caca'];
const POS_MAP    = { portero: 'POR', defensa: 'DEF', medio: 'MED', delantero: 'DEL' };

// Mapa estático team_id → info (categoría, nombre, bandera)
const SEL_MAP = Object.fromEntries(SELECCIONES.map(s => [s.id, s]));

// Mapa catId → info de CATEGORIAS (incluyendo alias caca = cacaDeLaVaca)
const CAT_INFO = {
  favoritos:    Object.values(CATEGORIAS).find(c => c.id === 'favoritos'),
  sorpresas:    Object.values(CATEGORIAS).find(c => c.id === 'sorpresas'),
  petardazos:   Object.values(CATEGORIAS).find(c => c.id === 'petardazos'),
  caca:         Object.values(CATEGORIAS).find(c => c.id === 'cacaDeLaVaca'),
};

function PorraDetalle({ porraFull, players }) {
  if (!porraFull) return <p style={{ color: '#9aa5b4', fontSize: '0.82rem' }}>Sin porra registrada.</p>;

  const playerById = Object.fromEntries(players.map(p => [p.id, p]));

  // Selecciones: usar porra_selections si existen, si no leer del JSON crudo
  const rawSels = porraFull.selections?.length > 0
    ? porraFull.selections
    : (() => {
        try { return JSON.parse(porraFull.porra?.submitted_data_json || '{}').selections || []; }
        catch { return []; }
      })();

  // Agrupar por categoría usando SEL_MAP (estático, no puede fallar)
  const bycat = { favoritos: [], sorpresas: [], petardazos: [], caca: [] };
  for (const s of rawSels) {
    const info = SEL_MAP[s.team_id];
    const cat  = info?.categoria === 'cacaDeLaVaca' ? 'caca' : (info?.categoria || 'caca');
    if (bycat[cat]) bycat[cat].push({ ...s, selInfo: info });
  }

  const ganador = rawSels.find(s => s.is_winner === 1 || s.is_winner === true);

  // Alineación para CampoFormacion
  const lineup = porraFull.lineup || [];
  const titular = lineup
    .filter(l => l.role === 'titular')
    .map(l => {
      const p = playerById[l.player_id];
      return { id: l.player_id, nombre: p?.name || '—', posicion: POS_MAP[l.position_slot] || 'MED', seleccionId: p?.team_id || '', esCopitan: l.is_captain === 1 };
    });
  const suplentes = lineup
    .filter(l => l.role === 'suplente')
    .map(l => {
      const p = playerById[l.player_id];
      return { id: l.player_id, nombre: p?.name || '—', posicion: POS_MAP[l.position_slot] || 'MED', seleccionId: p?.team_id || '', esCopitan: false };
    });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
      {/* Selecciones */}
      <div>
        {ganador && (
          <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 8, padding: '6px 14px', marginBottom: 12, fontSize: '0.82rem', fontWeight: 700, color: '#92400e' }}>
            ⭐ Ganador: {SEL_MAP[ganador.team_id]?.nombre || ganador.team_id}
          </div>
        )}
        {CAT_ORDER.map(catId => {
          const items = bycat[catId];
          if (!items.length) return null;
          const cat = CAT_INFO[catId];
          return (
            <div key={catId} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: cat?.color || '#6b7c93', marginBottom: 4 }}>
                {cat?.emoji} {cat?.nombre}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {items.map(s => (
                  <span key={s.team_id} style={{
                    background: (s.is_winner === 1 || s.is_winner === true) ? '#fef9c3' : '#f8fafc',
                    border: `1px solid ${(s.is_winner === 1 || s.is_winner === true) ? '#fbbf24' : '#e2e8f0'}`,
                    borderRadius: 6, padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600,
                  }}>
                    {s.selInfo?.bandera} {s.selInfo?.nombre || s.team_id}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Campo */}
      <div style={{ maxWidth: 280 }}>
        {titular.length > 0
          ? <CampoFormacion titular={titular} suplentes={suplentes} />
          : <p style={{ color: '#9aa5b4', fontSize: '0.82rem' }}>Sin alineación.</p>
        }
      </div>
    </div>
  );
}

export default function AdminParticipantes() {
  const [participants, setParticipants] = useState([]);
  const [porras, setPorras]             = useState([]);
  const [players, setPlayers]           = useState([]);
  const [form, setForm]     = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null); // participant id

  const load = useCallback(async () => {
    const [parts, porrasList, playersList] = await Promise.all([
      apiGet('/admin/participants'),
      apiGet('/admin/porras'),
      apiGet('/admin/players'),
    ]);
    setParticipants(parts);
    setPorras(porrasList);
    setPlayers(playersList);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (editing) await apiPut(`/admin/participants/${editing}`, form);
    else {
      const p = await apiPost('/admin/participants', form);
      await apiPost('/admin/porras-create', { participant_id: p.id }).catch(() => {});
    }
    setForm(EMPTY); setEditing(null); load();
  }

  async function del(id) {
    if (!window.confirm('¿Eliminar participante y su porra?')) return;
    await apiDelete(`/admin/participants/${id}`); load();
  }

  // Mapa participant_id → PorraFull
  const porraByParticipant = Object.fromEntries(porras.map(pf => [pf.participant?.id, pf]));

  return (
    <div>
      <h2>Participantes</h2>
      <div className="admin-card">
        <div className="inline-form">
          <div className="form-group"><label>Nombre</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre" />
          </div>
          <div className="form-group"><label>Email (opcional)</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@..." />
          </div>
          <button className="btn btn-primary" onClick={save}>{editing ? 'Actualizar' : 'Añadir'}</button>
          {editing && <button className="btn" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancelar</button>}
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>Email</th><th>Porra</th><th></th></tr></thead>
          <tbody>
            {participants.map(p => {
              const pf = porraByParticipant[p.id];
              const isExpanded = expanded === p.id;
              return (
                <React.Fragment key={p.id}>
                  <tr style={isExpanded ? { background: '#f0f4fb' } : {}}>
                    <td>{p.name}</td>
                    <td style={{ color: '#6b7c93', fontSize: '0.82rem' }}>{p.email ?? '—'}</td>
                    <td>
                      {pf && (
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: pf.porra.status === 'approved' ? '#dcfce7' : pf.porra.status === 'pending' ? '#fef9c3' : '#fee2e2',
                          color: pf.porra.status === 'approved' ? '#15803d' : pf.porra.status === 'pending' ? '#854d0e' : '#b91c1c',
                        }}>
                          {pf.porra.status}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="btn-group">
                        {pf && (
                          <button className="btn btn-sm" onClick={() => setExpanded(isExpanded ? null : p.id)}>
                            {isExpanded ? '✕ Cerrar' : '👁 Ver porra'}
                          </button>
                        )}
                        <button className="btn btn-sm" onClick={() => { setEditing(p.id); setForm({ name: p.name, email: p.email ?? '' }); }}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && pf && (
                    <tr>
                      <td colSpan={4} style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                        <PorraDetalle porraFull={pf} players={players} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
