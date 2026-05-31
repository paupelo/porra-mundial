import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../hooks/useApi';

const CATS = ['favoritos', 'sorpresas', 'petardazos', 'caca'];
const EMPTY = { name: '', country_code: '', category: 'favoritos' };

export default function AdminSelecciones() {
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => apiGet('/admin/teams').then(setTeams).catch(() => {});
  useEffect(() => { load(); }, []);

  async function save() {
    try {
      if (editing) {
        await apiPut(`/admin/teams/${editing}`, form);
      } else {
        await apiPost('/admin/teams', form);
      }
      setForm(EMPTY); setEditing(null); setMsg('✓ Guardado'); load();
    } catch (e) { setMsg('Error: ' + e.message); }
  }

  async function del(id) {
    if (!window.confirm('¿Eliminar equipo?')) return;
    await apiDelete(`/admin/teams/${id}`);
    load();
  }

  function startEdit(t) {
    setEditing(t.id);
    setForm({ name: t.name, country_code: t.country_code ?? '', category: t.category });
  }

  return (
    <div>
      <h2>Selecciones</h2>
      {msg && <p style={{ color: '#15803d', marginBottom: 12 }}>{msg}</p>}

      <div className="admin-card">
        <div className="inline-form">
          <div className="form-group">
            <label>Nombre</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="España" />
          </div>
          <div className="form-group">
            <label>Código país</label>
            <input value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))} placeholder="ES" style={{ width: 80 }} />
          </div>
          <div className="form-group">
            <label>Categoría</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={save}>{editing ? 'Actualizar' : 'Añadir'}</button>
          {editing && <button className="btn" onClick={() => { setEditing(null); setForm(EMPTY); }}>Cancelar</button>}
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>País</th><th>Categoría</th><th></th></tr></thead>
          <tbody>
            {teams.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.country_code ?? '—'}</td>
                <td>{t.category}</td>
                <td>
                  <div className="btn-group">
                    <button className="btn btn-sm" onClick={() => startEdit(t)}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(t.id)}>🗑</button>
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
