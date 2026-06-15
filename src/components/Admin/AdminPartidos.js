import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../hooks/useApi';

const PHASES = ['grupos', 'dieciseisavos', 'octavos', 'cuartos', 'semifinales', 'final'];
const STATUS  = ['pending', 'live', 'finished'];
const PHASE_RESULTS = ['advanced', 'eliminated', 'winner'];

const EMPTY_M = { phase: 'grupos', home_team_id: '', away_team_id: '', match_date: '', status: 'pending', home_score: '', away_score: '', decided_by_penalties: 0, penalty_winner_id: '', home_goal_minutes: '', away_goal_minutes: '' };

// "12, 45, 80" → [12, 45, 80]; vacío → null (sin datos → cae al marcador final)
function parseMinutes(raw) {
  if (raw == null) return null;
  const mins = String(raw).split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n));
  return mins.length ? mins.sort((a, b) => a - b) : null;
}
const minutesToStr = (arr) => Array.isArray(arr) ? arr.join(', ') : '';

export default function AdminPartidos() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [phaseResults, setPhaseResults] = useState([]);
  const [form, setForm] = useState(EMPTY_M);
  const [editing, setEditing] = useState(null);
  const [prForm, setPrForm] = useState({ team_id: '', phase: 'grupos', result: 'advanced' });

  const load = () => Promise.all([apiGet('/admin/matches'), apiGet('/admin/teams'), apiGet('/api/phase-results').catch(() => [])]).then(([m, t]) => { setMatches(m); setTeams(t); });
  useEffect(() => { load(); }, []);

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));

  async function saveMatch() {
    const body = { ...form, home_score: form.home_score === '' ? null : +form.home_score, away_score: form.away_score === '' ? null : +form.away_score, decided_by_penalties: +form.decided_by_penalties, penalty_winner_id: form.penalty_winner_id || null, home_goal_minutes: parseMinutes(form.home_goal_minutes), away_goal_minutes: parseMinutes(form.away_goal_minutes) };
    if (editing) await apiPut(`/admin/matches/${editing}`, body);
    else await apiPost('/admin/matches', body);
    setForm(EMPTY_M); setEditing(null); load();
  }

  async function savePhaseResult() {
    await apiPost('/admin/phase-results', prForm);
    setPrForm({ team_id: '', phase: 'grupos', result: 'advanced' });
    load();
  }

  return (
    <div>
      <h2>Partidos</h2>

      <div className="admin-card">
        <div className="inline-form" style={{ flexWrap: 'wrap' }}>
          <div className="form-group"><label>Fase</label>
            <select value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}>
              {PHASES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Local</label>
            <select value={form.home_team_id} onChange={e => setForm(f => ({ ...f, home_team_id: e.target.value }))}>
              <option value="">— Local —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Visitante</label>
            <select value={form.away_team_id} onChange={e => setForm(f => ({ ...f, away_team_id: e.target.value }))}>
              <option value="">— Visitante —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Fecha</label>
            <input type="datetime-local" value={form.match_date} onChange={e => setForm(f => ({ ...f, match_date: e.target.value }))} />
          </div>
          <div className="form-group"><label>Estado</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Local</label>
            <input type="number" value={form.home_score} onChange={e => setForm(f => ({ ...f, home_score: e.target.value }))} style={{ width: 60 }} placeholder="—" />
          </div>
          <div className="form-group"><label>Visit.</label>
            <input type="number" value={form.away_score} onChange={e => setForm(f => ({ ...f, away_score: e.target.value }))} style={{ width: 60 }} placeholder="—" />
          </div>
          <div className="form-group"><label>Penaltis</label>
            <select value={form.decided_by_penalties} onChange={e => setForm(f => ({ ...f, decided_by_penalties: +e.target.value }))}>
              <option value={0}>No</option><option value={1}>Sí</option>
            </select>
          </div>
          {form.decided_by_penalties === 1 && (
            <div className="form-group"><label>Ganador tanda</label>
              <select value={form.penalty_winner_id} onChange={e => setForm(f => ({ ...f, penalty_winner_id: e.target.value }))}>
                <option value="">—</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group"><label>Min. goles local</label>
            <input value={form.home_goal_minutes} onChange={e => setForm(f => ({ ...f, home_goal_minutes: e.target.value }))} style={{ width: 130 }} placeholder="p. ej. 12, 67" title="Minutos en los que marcó el local (separados por comas). Para portería a cero / gol encajado por intervalo." />
          </div>
          <div className="form-group"><label>Min. goles visit.</label>
            <input value={form.away_goal_minutes} onChange={e => setForm(f => ({ ...f, away_goal_minutes: e.target.value }))} style={{ width: 130 }} placeholder="p. ej. 45, 90" title="Minutos en los que marcó el visitante (separados por comas)." />
          </div>
          <button className="btn btn-primary" onClick={saveMatch}>{editing ? 'Actualizar' : 'Añadir'}</button>
          {editing && <button className="btn" onClick={() => { setEditing(null); setForm(EMPTY_M); }}>Cancelar</button>}
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead><tr><th>Fase</th><th>Partido</th><th>Resultado</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {matches.map(m => (
              <tr key={m.id}>
                <td>{m.phase}</td>
                <td>{teamMap[m.home_team_id] ?? '?'} vs {teamMap[m.away_team_id] ?? '?'}</td>
                <td>{m.home_score ?? '—'} – {m.away_score ?? '—'}{m.decided_by_penalties ? ' (P)' : ''}</td>
                <td>{m.status}</td>
                <td>
                  <div className="btn-group">
                    <button className="btn btn-sm" onClick={() => { setEditing(m.id); setForm({ phase: m.phase, home_team_id: m.home_team_id, away_team_id: m.away_team_id, match_date: m.match_date ?? '', status: m.status, home_score: m.home_score ?? '', away_score: m.away_score ?? '', decided_by_penalties: m.decided_by_penalties, penalty_winner_id: m.penalty_winner_id ?? '', home_goal_minutes: minutesToStr(m.home_goal_minutes), away_goal_minutes: minutesToStr(m.away_goal_minutes) }); }}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={async () => { if (window.confirm('¿Eliminar?')) { await apiDelete(`/admin/matches/${m.id}`); load(); } }}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Resultados de fase</h2>
      <div className="admin-card">
        <div className="inline-form">
          <div className="form-group"><label>Equipo</label>
            <select value={prForm.team_id} onChange={e => setPrForm(f => ({ ...f, team_id: e.target.value }))}>
              <option value="">— Equipo —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Fase</label>
            <select value={prForm.phase} onChange={e => setPrForm(f => ({ ...f, phase: e.target.value }))}>
              {PHASES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Resultado</label>
            <select value={prForm.result} onChange={e => setPrForm(f => ({ ...f, result: e.target.value }))}>
              {PHASE_RESULTS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={savePhaseResult}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
