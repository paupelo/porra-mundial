import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../hooks/useApi';

const POS = ['portero', 'defensa', 'medio', 'delantero'];
const EMPTY = { name: '', team_id: '', position: 'delantero' };

export default function AdminJugadores() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filterTeam, setFilterTeam] = useState('');

  const load = () => Promise.all([apiGet('/admin/players'), apiGet('/admin/teams')]).then(([p, t]) => { setPlayers(p); setTeams(t); });
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.team_id) return alert('Elige un equipo');
    if (editing) await apiPut(`/admin/players/${editing}`, form);
    else await apiPost('/admin/players', form);
    setForm(EMPTY); setEditing(null); load();
  }

  async function del(id) {
    if (!window.confirm('¿Eliminar jugador?')) return;
    await apiDelete(`/admin/players/${id}`); load();
  }

  const filtered = filterTeam ? players.filter(p => p.team_id === filterTeam) : players;
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

  return (
    <div>
      <h2>Jugadores</h2>
      <div className="admin-card">
        <div className="inline-form">
          <div className="form-group"><label>Nombre</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Morata" />
          </div>
          <div className="form-group"><label>Equipo</label>
            <select value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
              <option value="">— Equipo —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Posición</label>
            <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
              {POS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={save}>{editing ? 'Actualizar' : 'Añadir'}</button>
          {editing && <button className="btn" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancelar</button>}
        </div>
      </div>

      <div className="admin-card">
        <div style={{ marginBottom: 12 }}>
          <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
            <option value="">Todos los equipos ({players.length})</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({players.filter(p => p.team_id === t.id).length})</option>)}
          </select>
        </div>
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>Equipo</th><th>Posición</th><th></th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{teamMap[p.team_id] ?? p.team_id}</td>
                <td>{p.position}</td>
                <td>
                  <div className="btn-group">
                    <button className="btn btn-sm" onClick={() => { setEditing(p.id); setForm({ name: p.name, team_id: p.team_id, position: p.position }); }}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
