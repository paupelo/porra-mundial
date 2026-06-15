import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../../hooks/useApi';

const EMPTY_EV = { player_id: '', team_id: '', minutes_played: 90, minute_in: 0, minute_out: '', goals_open_play: 0, goals_penalty_play: 0, goals_penalty_shootout: 0, assists: 0, penalty_saved_play: 0, penalty_saved_shootout: 0, red_card: 0, penalty_conceded: 0, penalty_missed_play: 0, penalty_missed_shootout: 0, own_goals: 0, is_improvised_goalkeeper: 0 };

function NumInput({ label, field, form, setForm }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <input type="number" min={0} value={form[field]} style={{ width: 60 }}
        onChange={e => setForm(f => ({ ...f, [field]: +e.target.value }))} />
    </div>
  );
}

export default function AdminEventos() {
  const [matches, setMatches] = useState([]);
  const [matchId, setMatchId] = useState('');
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(EMPTY_EV);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    Promise.all([apiGet('/admin/matches'), apiGet('/admin/players'), apiGet('/admin/teams')]).then(([m, p, t]) => { setMatches(m.filter(x => x.status === 'finished')); setPlayers(p); setTeams(t); });
  }, []);

  useEffect(() => {
    if (matchId) apiGet(`/admin/events/${matchId}`).then(setEvents);
    else setEvents([]);
  }, [matchId]);

  const playerMap = Object.fromEntries(players.map(p => [p.id, p.name]));
  const teamMap   = Object.fromEntries(teams.map(t => [t.id, t.name]));
  const matchLabel = (m) => `${teamMap[m.home_team_id] ?? '?'} vs ${teamMap[m.away_team_id] ?? '?'} (${m.phase})`;

  async function saveEvent() {
    if (!matchId || !form.player_id || !form.team_id) return setMsg('Elige partido, jugador y equipo');
    try {
      const payload = { ...form, minute_out: form.minute_out === '' ? null : +form.minute_out };
      await apiPost('/admin/events', { ...payload, match_id: matchId, source: 'manual', is_confirmed: 1 });
      setMsg('✓ Guardado'); setForm(EMPTY_EV);
      apiGet(`/admin/events/${matchId}`).then(setEvents);
    } catch (e) { setMsg('Error: ' + e.message); }
  }

  async function confirmAll() {
    await apiPost(`/admin/events/${matchId}/confirm`, {});
    setMsg('✓ Todos confirmados');
    apiGet(`/admin/events/${matchId}`).then(setEvents);
  }

  async function delEvent(pid) {
    await apiDelete(`/admin/events/${matchId}/${pid}`);
    apiGet(`/admin/events/${matchId}`).then(setEvents);
  }

  return (
    <div>
      <h2>Eventos de partido</h2>
      {msg && <p style={{ color: '#15803d', marginBottom: 12 }}>{msg}</p>}

      <div className="admin-card">
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Partido (solo finalizados)</label>
          <select value={matchId} onChange={e => setMatchId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', minWidth: 320 }}>
            <option value="">— Selecciona partido —</option>
            {matches.map(m => <option key={m.id} value={m.id}>{matchLabel(m)}</option>)}
          </select>
        </div>
      </div>

      {matchId && (
        <>
          <div className="admin-card">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: 16 }}>Añadir / editar evento</h3>
            <div className="inline-form" style={{ flexWrap: 'wrap' }}>
              <div className="form-group"><label>Jugador</label>
                <select value={form.player_id} onChange={e => { const p = players.find(x => x.id === e.target.value); setForm(f => ({ ...f, player_id: e.target.value, team_id: p?.team_id ?? '' })); }}>
                  <option value="">— Jugador —</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name} ({teamMap[p.team_id] ?? '?'})</option>)}
                </select>
              </div>
              <NumInput label="Min. jug." field="minutes_played" form={form} setForm={setForm} />
              <NumInput label="Min. entra" field="minute_in" form={form} setForm={setForm} />
              <div className="form-group"><label>Min. sale</label>
                <input type="number" min={0} value={form.minute_out} style={{ width: 60 }} placeholder="fin"
                  onChange={e => setForm(f => ({ ...f, minute_out: e.target.value }))} />
              </div>
              <NumInput label="Goles jgo" field="goals_open_play" form={form} setForm={setForm} />
              <NumInput label="Pen. jgo" field="goals_penalty_play" form={form} setForm={setForm} />
              <NumInput label="Pen. tanda" field="goals_penalty_shootout" form={form} setForm={setForm} />
              <NumInput label="Asist." field="assists" form={form} setForm={setForm} />
              <NumInput label="Pen. par. jgo" field="penalty_saved_play" form={form} setForm={setForm} />
              <NumInput label="Pen. par. tda" field="penalty_saved_shootout" form={form} setForm={setForm} />
              <div className="form-group"><label>Roja</label>
                <select value={form.red_card} onChange={e => setForm(f => ({ ...f, red_card: +e.target.value }))}>
                  <option value={0}>No</option><option value={1}>Sí</option>
                </select>
              </div>
              <NumInput label="Pen. cometido" field="penalty_conceded" form={form} setForm={setForm} />
              <NumInput label="Pen. fall. jgo" field="penalty_missed_play" form={form} setForm={setForm} />
              <NumInput label="Pen. fall. tda" field="penalty_missed_shootout" form={form} setForm={setForm} />
              <NumInput label="Gol propio" field="own_goals" form={form} setForm={setForm} />
              <div className="form-group"><label>Portero improv.</label>
                <select value={form.is_improvised_goalkeeper} onChange={e => setForm(f => ({ ...f, is_improvised_goalkeeper: +e.target.value }))}>
                  <option value={0}>No</option><option value={1}>Sí</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={saveEvent}>Guardar</button>
            </div>
          </div>

          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#374151' }}>{events.length} eventos en este partido</span>
              <button className="btn btn-success btn-sm" onClick={confirmAll}>✓ Confirmar todos</button>
            </div>
            <table className="admin-table">
              <thead><tr><th>Jugador</th><th>Min</th><th>En campo</th><th>G</th><th>A</th><th>Origen</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id}>
                    <td>{playerMap[ev.player_id] ?? ev.player_id}</td>
                    <td>{ev.minutes_played}'</td>
                    <td>{(ev.minute_in ?? 0)}'–{ev.minute_out != null ? `${ev.minute_out}'` : 'fin'}</td>
                    <td>{ev.goals_open_play + ev.goals_penalty_play}</td>
                    <td>{ev.assists}</td>
                    <td><span className={`badge badge-${ev.source === 'manual' ? 'confirmed' : 'draft'}`}>{ev.source}</span></td>
                    <td><span className={`badge badge-${ev.is_confirmed ? 'confirmed' : 'draft'}`}>{ev.is_confirmed ? 'confirmado' : 'borrador'}</span></td>
                    <td><button className="btn btn-danger btn-sm" onClick={() => delEvent(ev.player_id)}>🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
