import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';
import './Calendario.css';

// Calendario: todos los partidos agrupados por fecha (zona horaria local),
// con estado Próximo / EN VIVO / Finalizado. El frontend solo consulta nuestra
// API; todo el scraping de FIFA ocurre en el backend.

const FASE_LABELS = {
  grupos: 'Fase de grupos', dieciseisavos: 'Dieciseisavos', octavos: 'Octavos',
  cuartos: 'Cuartos', semifinales: 'Semifinales', final: 'Final',
};
const POS_LABELS = { portero: '🧤 POR', defensa: '🛡 DEF', medio: '⚙️ MED', delantero: '⚽ DEL' };
const CAT_LABELS = { favoritos: 'Favoritos', sorpresas: 'Sorpresas', petardazos: 'Petardazos', caca: 'Caca de la Vaca' };

function fmtPts(n) {
  return `${n > 0 ? '+' : ''}${Number(n).toFixed(1)}`;
}

function EstadoBadge({ status }) {
  if (status === 'live') return <span className="cal-badge cal-badge-live">● En vivo</span>;
  if (status === 'finished') return <span className="cal-badge cal-badge-fin">Finalizado</span>;
  return <span className="cal-badge cal-badge-proximo">Próximo</span>;
}

function Marcador({ m }) {
  if (m.status === 'live') {
    return (
      <span className="cal-match-marcador">
        {m.live_home_score ?? 0}–{m.live_away_score ?? 0}
        {m.minute !== null && <span className="cal-minuto">{m.minute}'</span>}
      </span>
    );
  }
  if (m.status === 'finished' && m.home_score !== null) {
    return (
      <span className="cal-match-marcador">
        {m.home_score}–{m.away_score}{m.decided_by_penalties ? ' (pen.)' : ''}
      </span>
    );
  }
  const hora = m.match_date
    ? new Date(m.match_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
  return <span className="cal-match-hora">{hora}</span>;
}

// ─── Desglose por conceptos (mismo formato que Clasificación) ────────────────

function DesgloseConceptos({ items }) {
  return (
    <div className="breakdown-wrap" style={{ marginTop: 8 }}>
      <table className="breakdown-table">
        <thead><tr><th>Concepto</th><th>Modificadores</th><th style={{ textAlign: 'right' }}>Pts</th></tr></thead>
        <tbody>
          {items.map((it, i) => {
            const parts = [];
            if (it.phaseMultiplier !== 1) parts.push(`×${it.phaseMultiplier} fase`);
            if (it.winnerMultiplier !== 1) parts.push(`×${it.winnerMultiplier} ganador`);
            if (it.roleMultiplier !== 1) parts.push(`×${it.roleMultiplier} rol`);
            return (
              <tr key={i}>
                <td>{it.concept}{it.isLive ? ' 🔴' : ''}</td>
                <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{parts.join(', ') || '—'}</td>
                <td className={it.finalPoints > 0 ? 'pts-pos' : it.finalPoints < 0 ? 'pts-neg' : 'pts-zero'}>
                  {fmtPts(it.finalPoints)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilaImplicado({ nombre, meta, badges, points, items, showPoints }) {
  const [open, setOpen] = useState(false);
  const expandible = showPoints && items && items.length > 0;
  return (
    <div>
      <div
        className="cal-imp"
        onClick={() => expandible && setOpen(o => !o)}
        style={expandible ? { cursor: 'pointer' } : undefined}
      >
        <div className="cal-imp-info">
          <div className="cal-imp-nombre">{nombre} {badges}</div>
          <div className="cal-imp-meta">{meta}</div>
        </div>
        {showPoints && (
          <div className="cal-imp-pts">
            {fmtPts(points)} pts
            {expandible && <span style={{ fontSize: '0.65rem', marginLeft: 6, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>}
          </div>
        )}
      </div>
      {open && expandible && <div style={{ margin: '-4px 0 12px' }}><DesgloseConceptos items={items} /></div>}
    </div>
  );
}

// ─── Detalle de un partido ────────────────────────────────────────────────────

function DetallePartido({ matchId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiGet(`/calendario/${matchId}`)
        .then(d => { if (alive) { setData(d); setError(null); } })
        .catch(e => { if (alive) setError(e.message); });
    load();
    const timer = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, [matchId]);

  if (error) return <div className="clas-empty"><p>⚠️ No se pudo cargar el partido.</p></div>;
  if (!data) return <div className="clas-loading">Cargando partido…</div>;

  const { match, selecciones, jugadores } = data;
  const jugado = match.status !== 'pending';
  const etiqueta = match.status === 'live'
    ? <span className="cal-tag-provisional">Provisional (en vivo)</span>
    : match.status === 'finished'
      ? <span className="cal-tag-definitivo">Definitivo</span>
      : null;

  const fecha = match.match_date
    ? new Date(match.match_date).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div>
      <button className="detalle-back" onClick={onBack}>← Volver al calendario</button>

      <div className="detalle-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>{match.home_team_name} – {match.away_team_name}</h2>
          <EstadoBadge status={match.status} />
        </div>
        <div className="total" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Marcador m={match} />
          <span>{FASE_LABELS[match.phase] ?? match.phase}{match.group_name ? ` · ${match.group_name}` : ''}</span>
          {match.venue && <span>· {match.venue}</span>}
          <span>· {fecha}</span>
          {etiqueta}
        </div>
      </div>

      <div className="detalle-section">
        <h3>Selecciones en juego ({selecciones.length})</h3>
        {selecciones.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Ninguna porra tiene a estos equipos.</p>}
        {selecciones.map((s, i) => (
          <FilaImplicado
            key={i}
            nombre={s.participantName}
            meta={`${s.team_name} · ${CAT_LABELS[s.category] ?? s.category}`}
            badges={s.is_winner ? <span className="sel-winner-badge">⭐ GANADOR</span> : null}
            points={s.points}
            items={s.items}
            showPoints={jugado}
          />
        ))}
      </div>

      <div className="detalle-section">
        <h3>Jugadores en juego ({jugadores.length})</h3>
        {jugadores.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Ningún once tiene jugadores de estos equipos.</p>}
        {jugadores.map((j, i) => (
          <FilaImplicado
            key={i}
            nombre={j.player_name}
            meta={`${POS_LABELS[j.position] ?? j.position} · ${j.team_name} · porra de ${j.participantName}${j.role === 'suplente' ? ' · Suplente' : ''}`}
            badges={j.is_captain ? <span className="captain-badge">⭐ CAP</span> : null}
            points={j.points}
            items={j.items}
            showPoints={jugado}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Vista principal ──────────────────────────────────────────────────────────

export default function Calendario() {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiGet('/matches')
        .then(d => { if (alive) { setMatches(d); setError(null); } })
        .catch(e => { if (alive) setError(e.message); })
        .finally(() => { if (alive) setLoading(false); });
    load();
    const timer = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  if (selectedId) {
    return (
      <div className="clasificacion-page">
        <div className="clas-content">
          <DetallePartido matchId={selectedId} onBack={() => setSelectedId(null)} />
        </div>
      </div>
    );
  }

  // Agrupar por día en la zona horaria local del usuario
  const grupos = [];
  if (matches) {
    const ordenados = [...matches].sort((a, b) => (a.match_date ?? '').localeCompare(b.match_date ?? ''));
    let actual = null;
    for (const m of ordenados) {
      const dia = m.match_date
        ? new Date(m.match_date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
        : 'Fecha por confirmar';
      if (!actual || actual.dia !== dia) {
        actual = { dia, partidos: [] };
        grupos.push(actual);
      }
      actual.partidos.push(m);
    }
  }

  return (
    <div className="clasificacion-page">
      <div className="clas-hero">
        <h1>Calendario</h1>
        <p>Todos los partidos del Mundial. Pulsa uno para ver quién se juega puntos en él.</p>
      </div>

      <div className="clas-content">
        {loading && <div className="clas-loading">Cargando calendario…</div>}
        {error && (
          <div className="clas-empty">
            <p>⚠️ No se pudo cargar el calendario. Asegúrate de que el servidor está corriendo.</p>
          </div>
        )}
        {!loading && !error && (!matches || matches.length === 0) && (
          <div className="clas-empty">
            <p style={{ fontSize: '2rem' }}>📅</p>
            <p>Aún no hay partidos cargados.</p>
          </div>
        )}

        {grupos.map(g => (
          <div key={g.dia}>
            <div className="cal-fecha">{g.dia}</div>
            {g.partidos.map(m => (
              <div
                key={m.id}
                className={`cal-match${m.status === 'live' ? ' is-live' : ''}`}
                onClick={() => setSelectedId(m.id)}
                title="Ver detalle del partido"
              >
                <div className="cal-match-equipos">
                  <div className="cal-match-nombres">{m.home_team_name} – {m.away_team_name}</div>
                  <div className="cal-match-meta">
                    {FASE_LABELS[m.phase] ?? m.phase}
                    {m.group_name ? ` · ${m.group_name}` : ''}
                    {m.venue ? ` · ${m.venue}` : ''}
                  </div>
                </div>
                <Marcador m={m} />
                <EstadoBadge status={m.status} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
