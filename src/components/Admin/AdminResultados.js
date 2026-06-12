import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../../hooks/useApi';

// Sección "Resultados y eventos": partidos sincronizados desde FIFA con sus
// eventos scrapeados en borrador. El admin los revisa, corrige y confirma;
// confirmar dispara el recálculo de la clasificación en el servidor.

const FASE_LABELS = {
  grupos: 'Grupos', dieciseisavos: '16avos', octavos: 'Octavos',
  cuartos: 'Cuartos', semifinales: 'Semis', final: 'Final',
};
const ESTADO_LABELS = { pending: 'Programado', live: 'EN JUEGO', finished: 'Finalizado' };

// Campos numéricos editables de un evento, en orden de columna
const NUM_FIELDS = [
  ['minutes_played', 'Min'],
  ['goals_open_play', 'G.jgo'],
  ['goals_penalty_play', 'G.pen'],
  ['goals_penalty_shootout', 'G.tda'],
  ['assists', 'Asis'],
  ['penalty_saved_play', 'P.par'],
  ['penalty_saved_shootout', 'P.par.tda'],
  ['red_card', 'Roja'],
  ['penalty_conceded', 'P.com'],
  ['penalty_missed_play', 'P.fal'],
  ['penalty_missed_shootout', 'P.fal.tda'],
  ['own_goals', 'G.prop'],
];

function FilaEvento({ ev, playerMap, onSaved, setMsg }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(ev);

  async function guardar() {
    try {
      await apiPost('/admin/events', { ...form, is_confirmed: ev.is_confirmed });
      setMsg('✓ Evento guardado');
      setEdit(false);
      onSaved();
    } catch (e) { setMsg('Error: ' + e.message); }
  }

  return (
    <tr>
      <td>{playerMap[ev.player_id] ?? ev.player_id}</td>
      {NUM_FIELDS.map(([field]) => (
        <td key={field} style={{ textAlign: 'center' }}>
          {edit ? (
            <input
              type="number" min={0} value={form[field]}
              style={{ width: 44 }}
              onChange={e => setForm(f => ({ ...f, [field]: +e.target.value }))}
            />
          ) : (
            ev[field] || '·'
          )}
        </td>
      ))}
      <td>
        <span className={`badge badge-${ev.is_confirmed ? 'confirmed' : 'draft'}`}>
          {ev.is_confirmed ? 'OK' : 'borrador'}
        </span>
      </td>
      <td>
        {edit ? (
          <>
            <button className="btn btn-success btn-sm" onClick={guardar}>💾</button>{' '}
            <button className="btn btn-sm" onClick={() => { setForm(ev); setEdit(false); }}>✕</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => setEdit(true)}>✏️ Editar</button>
        )}
      </td>
    </tr>
  );
}

function PanelPartido({ match, playerMap, setMsg, refrescar }) {
  const [events, setEvents] = useState(null);

  const cargarEventos = useCallback(() => {
    apiGet(`/admin/events/${match.id}`).then(setEvents).catch(() => setEvents([]));
  }, [match.id]);

  useEffect(() => { cargarEventos(); }, [cargarEventos]);

  async function reScrapear() {
    try {
      const r = await apiPost(`/admin/fifa/sync-match/${match.id}`, {});
      setMsg(`✓ Re-scrapeado: ${r.saved} borradores guardados, ${r.unreconciled?.length ?? 0} jugadores sin conciliar`);
      cargarEventos();
    } catch (e) { setMsg('Error: ' + e.message); }
  }

  return (
    <div style={{ padding: '8px 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
          Las puntuaciones se aplican automáticamente al finalizar el partido. Si corriges un evento, se recalcula al guardar.
        </span>
        {match.fifa_match_id && (
          <button className="btn btn-sm" onClick={reScrapear}>📡 Re-scrapear eventos de FIFA</button>
        )}
      </div>
      {events === null && <p style={{ color: '#94a3b8' }}>Cargando eventos…</p>}
      {events && events.length === 0 && (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          Sin eventos todavía. Llegarán y puntuarán solos cuando el scheduler scrapee el partido, o añádelos en la pestaña «Eventos».
        </p>
      )}
      {events && events.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Jugador</th>
                {NUM_FIELDS.map(([f, label]) => <th key={f} style={{ textAlign: 'center' }}>{label}</th>)}
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <FilaEvento key={ev.id} ev={ev} playerMap={playerMap} onSaved={cargarEventos} setMsg={setMsg} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminResultados() {
  const [overview, setOverview] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [fifaStatus, setFifaStatus] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [msg, setMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  const refrescar = useCallback(() => {
    apiGet('/admin/fifa/matches-overview').then(setOverview).catch(e => setMsg('Error: ' + e.message));
    apiGet('/admin/fifa/status').then(setFifaStatus).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([apiGet('/admin/teams'), apiGet('/admin/players')]).then(([t, p]) => { setTeams(t); setPlayers(p); });
    refrescar();
  }, [refrescar]);

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t.name]));
  const playerMap = Object.fromEntries(players.map(p => [p.id, p.name]));

  async function sincronizarAhora() {
    setSyncing(true); setMsg('');
    try {
      await apiPost('/admin/fifa/tick', {});
      setMsg('✓ Sincronización completa (calendario + eventos pendientes + recálculo)');
      refrescar();
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setSyncing(false); }
  }

  const finalizados = overview.filter(m => m.status === 'finished');
  const ordenados = [...overview].sort((a, b) => {
    if (a.needs_confirmation !== b.needs_confirmation) return a.needs_confirmation ? -1 : 1;
    return (b.match_date ?? '').localeCompare(a.match_date ?? '');
  });

  return (
    <div>
      <h2>Resultados y eventos</h2>
      {msg && <p style={{ color: msg.startsWith('Error') ? '#b91c1c' : '#15803d', marginBottom: 12, fontWeight: 600 }}>{msg}</p>}

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>Scraper de FIFA</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
              {fifaStatus?.enabled
                ? <>Scheduler activo · último tick: {fifaStatus.lastTickAt ? new Date(fifaStatus.lastTickAt).toLocaleTimeString() : '—'} · último calendario: {fifaStatus.lastCalendarSyncAt ? new Date(fifaStatus.lastCalendarSyncAt).toLocaleString() : '—'}</>
                : 'Scheduler desactivado (FIFA_ENABLED=false)'}
              {fifaStatus?.lastError && <span style={{ color: '#b91c1c' }}> · Último error: {fifaStatus.lastError}</span>}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
              {finalizados.length} partidos finalizados · las puntuaciones se aplican <strong>automáticamente</strong> al finalizar
            </p>
          </div>
          <button className="btn btn-primary" onClick={sincronizarAhora} disabled={syncing}>
            {syncing ? '…' : '📡 Sincronizar con FIFA ahora'}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr><th>Partido</th><th>Fase</th><th>Fecha</th><th>Estado</th><th>Marcador</th><th>Eventos</th><th>Puntuación</th></tr>
          </thead>
          <tbody>
            {ordenados.map(m => (
              <React.Fragment key={m.id}>
                <tr onClick={() => setAbierto(a => a === m.id ? null : m.id)} style={{ cursor: 'pointer' }} title="Ver eventos del partido">
                  <td style={{ fontWeight: 600 }}>
                    {abierto === m.id ? '▾' : '▸'} {teamMap[m.home_team_id] ?? m.home_team_id} – {teamMap[m.away_team_id] ?? m.away_team_id}
                  </td>
                  <td>{FASE_LABELS[m.phase] ?? m.phase}</td>
                  <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{m.match_date ? new Date(m.match_date).toLocaleString() : '—'}</td>
                  <td>
                    <span className={`badge badge-${m.status === 'finished' ? 'confirmed' : 'draft'}`}>
                      {ESTADO_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                  <td>
                    {m.home_score !== null ? `${m.home_score}–${m.away_score}` : '—'}
                    {m.decided_by_penalties ? ' (pen.)' : ''}
                  </td>
                  <td>{m.events_confirmed}/{m.events_total}</td>
                  <td>
                    {m.status !== 'finished' ? '—' : m.needs_confirmation
                      ? <span className="badge badge-draft">⏳ Aplicando…</span>
                      : m.events_total > 0
                        ? <span className="badge badge-confirmed">✓ Aplicada</span>
                        : <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>sin eventos</span>}
                  </td>
                </tr>
                {abierto === m.id && (
                  <tr>
                    <td colSpan={7} style={{ background: '#f8fafc' }}>
                      <PanelPartido match={m} playerMap={playerMap} setMsg={setMsg} refrescar={refrescar} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {ordenados.length === 0 && (
              <tr><td colSpan={7} style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>
                No hay partidos todavía. Pulsa «Sincronizar con FIFA ahora» para cargar el calendario.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
