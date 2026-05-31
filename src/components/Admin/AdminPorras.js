import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../../hooks/useApi';

const CAT_COLORS = { favoritos: '#b91c1c', sorpresas: '#1d4ed8', petardazos: '#15803d', caca: '#4b5563' };

export default function AdminPorras() {
  const [porras, setPorras] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => Promise.all([apiGet('/admin/porras'), apiGet('/admin/teams'), apiGet('/admin/players')]).then(([p, t, pl]) => { setPorras(p); setTeams(t); setPlayers(pl); });
  useEffect(() => { load(); }, []);

  const teamMap   = Object.fromEntries(teams.map(t => [t.id, t]));
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));

  async function setMvp(porraId, playerId) {
    await apiPost(`/admin/porras/${porraId}/mvp`, { player_id: playerId || null });
    setMsg('✓ MVP actualizado'); load();
  }

  async function lock(porraId) {
    if (!window.confirm('¿Bloquear porra? No se podrá editar.')) return;
    await apiPost(`/admin/porras/${porraId}/lock`, {});
    setMsg('✓ Bloqueada'); load();
  }

  const porra = selected ? porras.find(p => p.porra.id === selected) : null;

  return (
    <div>
      <h2>Porras</h2>
      {msg && <p style={{ color: '#15803d', marginBottom: 12 }}>{msg}</p>}

      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Participante</th><th>Sel.</th><th>Once</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {porras.map(({ porra, participant, selections, lineup }) => (
              <tr key={porra.id}>
                <td>{participant?.name ?? '—'}</td>
                <td>{selections.length}/14</td>
                <td>{lineup.filter(l => l.role === 'titular').length}/11</td>
                <td>{porra.is_locked ? '🔒 Bloqueada' : '✏️ Editable'}</td>
                <td>
                  <div className="btn-group">
                    <button className="btn btn-sm" onClick={() => setSelected(porra.id)}>👁 Ver</button>
                    {!porra.is_locked && <button className="btn btn-sm" onClick={() => lock(porra.id)}>🔒 Bloquear</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {porra && (
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#003DA5' }}>
              {porra.participant?.name} — detalle
            </h3>
            <button className="btn btn-sm" onClick={() => setSelected(null)}>✕ Cerrar</button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <strong style={{ fontSize: '0.8rem', color: '#64748b' }}>MVP:</strong>
            <select defaultValue={porra.porra.mvp_player_id ?? ''} onChange={e => setMvp(porra.porra.id, e.target.value)} style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <option value="">— Sin MVP —</option>
              {porra.lineup.map(l => { const p = playerMap[l.player_id]; return p ? <option key={l.player_id} value={l.player_id}>{p.name}</option> : null; })}
            </select>
          </div>

          <div style={{ marginBottom: 8, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>SELECCIONES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {porra.selections.map(s => {
              const t = teamMap[s.team_id];
              return (
                <span key={s.team_id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600, color: t ? CAT_COLORS[t.category] : '#374151' }}>
                  {t?.name ?? s.team_id}{s.is_winner ? ' ⭐' : ''}
                </span>
              );
            })}
          </div>

          <div style={{ marginBottom: 8, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>ALINEACIÓN</div>
          <table className="admin-table">
            <thead><tr><th>Jugador</th><th>Pos</th><th>Rol</th><th>Cap</th></tr></thead>
            <tbody>
              {porra.lineup.map(l => {
                const p = playerMap[l.player_id];
                return (
                  <tr key={l.player_id}>
                    <td>{p?.name ?? l.player_id}</td>
                    <td>{l.position_slot}</td>
                    <td>{l.role}</td>
                    <td>{l.is_captain ? '⭐' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
