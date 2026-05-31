import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../hooks/useApi';

const EMPTY = { name: '', email: '' };

export default function AdminParticipantes() {
  const [participants, setParticipants] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);

  const load = () => apiGet('/admin/participants').then(setParticipants);
  useEffect(() => { load(); }, []);

  async function save() {
    if (editing) await apiPut(`/admin/participants/${editing}`, form);
    else {
      const p = await apiPost('/admin/participants', form);
      // Crear porra vacía automáticamente
      await apiPost('/admin/porras-create', { participant_id: p.id }).catch(() => {});
    }
    setForm(EMPTY); setEditing(null); load();
  }

  async function del(id) {
    if (!window.confirm('¿Eliminar participante y su porra?')) return;
    await apiDelete(`/admin/participants/${id}`); load();
  }

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
          <thead><tr><th>Nombre</th><th>Email</th><th></th></tr></thead>
          <tbody>
            {participants.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td><td>{p.email ?? '—'}</td>
                <td>
                  <div className="btn-group">
                    <button className="btn btn-sm" onClick={() => { setEditing(p.id); setForm({ name: p.name, email: p.email ?? '' }); }}>✏️</button>
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
