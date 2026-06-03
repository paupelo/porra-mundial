import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut } from '../../hooks/useApi';

const CAT_COLORS = {
  favoritos: '#b91c1c',
  sorpresas: '#1d4ed8',
  petardazos: '#15803d',
  caca: '#4b5563',
};

const STATUS_LABEL = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };
const STATUS_STYLE = {
  pending:  { background: '#fef9c3', color: '#854d0e' },
  approved: { background: '#dcfce7', color: '#15803d' },
  rejected: { background: '#fee2e2', color: '#b91c1c' },
};

export default function AdminPorras() {
  const [tab, setTab] = useState('pending'); // 'pending' | 'all'
  const [porras, setPorras] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [editingName, setEditingName] = useState(null); // porraId
  const [nameInput, setNameInput] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const endpoint = tab === 'pending' ? '/admin/porras/pending' : '/admin/porras';
    const [p, t, pl] = await Promise.all([apiGet(endpoint), apiGet('/admin/teams'), apiGet('/admin/players')]);
    setPorras(p);
    setTeams(t);
    setPlayers(pl);
    setChecked(new Set());
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const porra = selected ? porras.find(p => p.porra.id === selected) : null;

  function toast(m) { setMsg(m); setTimeout(() => setMsg(''), 4000); }

  async function handleApprove(id) {
    setLoading(true);
    await apiPost(`/admin/porras/${id}/approve`, {});
    toast('✓ Porra aprobada');
    setSelected(null);
    await load();
    setLoading(false);
  }

  async function handleReject(id, name) {
    if (!window.confirm(`¿Rechazar la porra de "${name}"? Se enviará un email al participante.`)) return;
    setLoading(true);
    await apiPost(`/admin/porras/${id}/reject`, {});
    toast('✓ Porra rechazada y email enviado');
    setSelected(null);
    await load();
    setLoading(false);
  }

  async function handleBulkApprove() {
    if (checked.size === 0) return;
    if (!window.confirm(`¿Aprobar ${checked.size} porra(s) seleccionadas?`)) return;
    setLoading(true);
    await apiPost('/admin/porras/bulk-approve', { ids: [...checked] });
    toast(`✓ ${checked.size} porra(s) aprobadas`);
    await load();
    setLoading(false);
  }

  async function handleSaveName(porraId) {
    if (!nameInput.trim()) return;
    await apiPut(`/admin/porras/${porraId}/name`, { name: nameInput.trim() });
    toast('✓ Nombre actualizado');
    setEditingName(null);
    await load();
  }

  function toggleCheck(id) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checked.size === porras.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(porras.map(p => p.porra.id)));
    }
  }

  return (
    <div>
      <h2>Porras</h2>
      {msg && <p style={{ color: '#15803d', marginBottom: 12, fontWeight: 600 }}>{msg}</p>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`btn ${tab === 'pending' ? 'btn-primary' : ''}`}
          style={tab !== 'pending' ? { background: '#f1f5f9', color: '#374151' } : {}}
          onClick={() => { setTab('pending'); setSelected(null); }}
        >
          Pendientes de aprobación
          {tab === 'pending' && porras.length > 0 && (
            <span style={{ marginLeft: 8, background: 'rgba(255,255,255,0.3)', borderRadius: 20, padding: '1px 7px', fontSize: '0.75rem' }}>
              {porras.length}
            </span>
          )}
        </button>
        <button
          className={`btn ${tab === 'all' ? 'btn-primary' : ''}`}
          style={tab !== 'all' ? { background: '#f1f5f9', color: '#374151' } : {}}
          onClick={() => { setTab('all'); setSelected(null); }}
        >
          Todas
        </button>
      </div>

      {/* Bulk actions (solo en pestaña pending) */}
      {tab === 'pending' && porras.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-success" onClick={handleBulkApprove} disabled={checked.size === 0 || loading}>
            ✓ Aprobar seleccionadas ({checked.size})
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="admin-card">
        {porras.length === 0 ? (
          <p style={{ color: '#9aa5b4', textAlign: 'center', padding: '24px 0' }}>
            {tab === 'pending' ? 'No hay porras pendientes de aprobación.' : 'No hay porras.'}
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {tab === 'pending' && (
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={checked.size === porras.length}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th>Nombre</th>
                <th>Email</th>
                <th>Equipos</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {porras.map(({ porra: p, participant, selections }) => (
                <tr key={p.id} style={selected === p.id ? { background: '#f0f4fb' } : {}}>
                  {tab === 'pending' && (
                    <td>
                      <input
                        type="checkbox"
                        checked={checked.has(p.id)}
                        onChange={() => toggleCheck(p.id)}
                      />
                    </td>
                  )}
                  <td>
                    {editingName === p.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          value={nameInput}
                          onChange={e => setNameInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveName(p.id)}
                          style={{ border: '1px solid #003DA5', borderRadius: 6, padding: '3px 8px', fontSize: '0.85rem', width: 160 }}
                          autoFocus
                        />
                        <button className="btn btn-sm btn-success" onClick={() => handleSaveName(p.id)}>✓</button>
                        <button className="btn btn-sm" style={{ background: '#f1f5f9' }} onClick={() => setEditingName(null)}>✕</button>
                      </div>
                    ) : (
                      <span>
                        {participant?.name ?? '—'}
                        <button
                          className="btn btn-sm"
                          style={{ marginLeft: 6, background: 'transparent', color: '#9aa5b4', padding: '2px 6px', fontSize: '0.7rem' }}
                          title="Editar nombre"
                          onClick={() => { setEditingName(p.id); setNameInput(participant?.name ?? ''); }}
                        >✎</button>
                      </span>
                    )}
                  </td>
                  <td style={{ color: '#6b7c93', fontSize: '0.82rem' }}>{p.submitted_email ?? '—'}</td>
                  <td style={{ color: '#6b7c93' }}>{selections?.length ?? 0}/14</td>
                  <td>
                    <span style={{ ...STATUS_STYLE[p.status], borderRadius: 12, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm" onClick={() => setSelected(selected === p.id ? null : p.id)}>
                        {selected === p.id ? '✕ Cerrar' : '👁 Ver'}
                      </button>
                      {p.status === 'pending' && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => handleApprove(p.id)} disabled={loading}>✓ Aprobar</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleReject(p.id, participant?.name)} disabled={loading}>✕ Rechazar</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detalle */}
      {porra && (
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#003DA5' }}>
              {porra.participant?.name} — detalle
            </h3>
            <button className="btn btn-sm" onClick={() => setSelected(null)}>✕ Cerrar</button>
          </div>

          {porra.porra.submitted_email && (
            <p style={{ fontSize: '0.82rem', color: '#6b7c93', marginBottom: 12 }}>
              Email: {porra.porra.submitted_email}
            </p>
          )}

          <div style={{ marginBottom: 8, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>SELECCIONES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {porra.selections.length > 0 ? porra.selections.map(s => {
              const t = teamMap[s.team_id];
              return (
                <span key={s.team_id} style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600,
                  color: t ? CAT_COLORS[t.category] : '#374151',
                }}>
                  {t?.name ?? s.team_id}{s.is_winner ? ' ⭐' : ''}
                </span>
              );
            }) : (
              <SubmittedDataPreview data={porra.porra.submitted_data_json} teamMap={teamMap} />
            )}
          </div>

          <div style={{ marginBottom: 8, fontWeight: 700, fontSize: '0.8rem', color: '#64748b' }}>ALINEACIÓN</div>
          <LineupPreview lineup={porra.lineup} submittedJson={porra.porra.submitted_data_json} playerMap={playerMap} teamMap={teamMap} />

          {porra.porra.status === 'pending' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-success" onClick={() => handleApprove(porra.porra.id)} disabled={loading}>✓ Aprobar porra</button>
              <button className="btn btn-danger" onClick={() => handleReject(porra.porra.id, porra.participant?.name)} disabled={loading}>✕ Rechazar y notificar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubmittedDataPreview({ data, teamMap = {} }) {
  if (!data) return <span style={{ color: '#9aa5b4', fontSize: '0.82rem' }}>Sin datos</span>;
  try {
    const parsed = JSON.parse(data);
    const sels = parsed.selections ?? [];
    if (sels.length === 0) return <span style={{ color: '#9aa5b4', fontSize: '0.82rem' }}>Sin selecciones</span>;
    return sels.map(s => {
      const t = teamMap[s.team_id];
      return (
        <span key={s.team_id} style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: '4px 12px', fontSize: '0.82rem', fontWeight: 600,
          color: t ? CAT_COLORS[t.category] : '#374151',
        }}>
          {t?.name ?? s.team_id}{s.is_winner ? ' ⭐' : ''}
        </span>
      );
    });
  } catch {
    return <span style={{ color: '#9aa5b4', fontSize: '0.82rem' }}>Error al leer datos</span>;
  }
}

const POS_LABEL = { portero: 'POR', defensa: 'DEF', medio: 'MED', delantero: 'DEL' };
const ROL_COLOR = { titular: '#1d4ed8', suplente: '#6b7280' };

function LineupPreview({ lineup, submittedJson, playerMap = {}, teamMap = {} }) {
  // Preferimos datos estructurados; si no hay, leemos el JSON crudo
  let entries = lineup ?? [];
  if (entries.length === 0 && submittedJson) {
    try {
      const parsed = JSON.parse(submittedJson);
      entries = (parsed.lineup ?? []).map(l => ({
        player_id: l.player_id,
        role: l.role,
        position_slot: l.position_slot,
        is_captain: l.is_captain,
      }));
    } catch { /* noop */ }
  }

  if (entries.length === 0) {
    return <p style={{ color: '#9aa5b4', fontSize: '0.82rem', marginBottom: 16 }}>Sin alineación</p>;
  }

  const titulares = entries.filter(l => l.role === 'titular');
  const suplentes = entries.filter(l => l.role === 'suplente');

  const renderEntry = (l, idx) => {
    const p = playerMap[l.player_id];
    const t = p ? teamMap[p.team_id] : null;
    return (
      <span key={idx} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
        padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600,
        color: '#374151',
      }}>
        <span style={{ fontSize: '0.7rem', background: ROL_COLOR[l.role], color: '#fff', borderRadius: 4, padding: '1px 5px' }}>
          {POS_LABEL[l.position_slot] ?? l.position_slot}
        </span>
        {p ? p.name : l.player_id}
        {t && <span style={{ fontSize: '0.75rem', color: CAT_COLORS[t.category] ?? '#6b7280' }}>({t.name})</span>}
        {l.is_captain ? ' ©' : ''}
      </span>
    );
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>Titulares ({titulares.length})</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {titulares.map(renderEntry)}
      </div>
      {suplentes.length > 0 && (
        <>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>Suplentes ({suplentes.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suplentes.map(renderEntry)}
          </div>
        </>
      )}
    </div>
  );
}
