import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';

const CAT_LABELS = { favoritos: 'Favoritos', sorpresas: 'Sorpresas', petardazos: 'Petardazos', caca: 'Caca ⚫' };
const POS_LABELS  = { portero: '🧤 POR', defensa: '🛡 DEF', medio: '⚙️ MED', delantero: '⚽ DEL' };

function PtsCell({ val }) {
  const n = typeof val === 'number' ? val : parseFloat(val);
  const cls = n > 0 ? 'pts-pos' : n < 0 ? 'pts-neg' : 'pts-zero';
  return <td className={cls}>{n > 0 ? '+' : ''}{n.toFixed(1)}</td>;
}

function ConceptRow({ item }) {
  const parts = [];
  if (item.phaseMultiplier !== 1) parts.push(`×${item.phaseMultiplier} fase`);
  if (item.winnerMultiplier !== 1) parts.push(`×${item.winnerMultiplier} ganador`);
  if (item.roleMultiplier !== 1) parts.push(`×${item.roleMultiplier} rol`);

  return (
    <tr>
      <td>{item.concept}</td>
      <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{item.phase}</td>
      <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{parts.join(', ') || '—'}</td>
      <PtsCell val={item.finalPoints} />
    </tr>
  );
}

function SelCard({ sel }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`sel-card${sel.isWinner ? ' is-winner' : ''}`}>
      <div className="sel-card-header" onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="sel-name">{sel.teamName}</span>
            {sel.isWinner && <span className="sel-winner-badge">⭐ GANADOR</span>}
          </div>
          <span className={`sel-cat cat-${sel.category}`}>{CAT_LABELS[sel.category] ?? sel.category}</span>
        </div>
        <div>
          <div className="sel-pts">{sel.totalPoints.toFixed(1)} pts</div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right' }}>{open ? '▲' : '▼'}</div>
        </div>
      </div>
      {open && sel.items && sel.items.length > 0 && (
        <div className="breakdown-wrap">
          <table className="breakdown-table">
            <thead>
              <tr><th>Concepto</th><th>Fase</th><th>Modificadores</th><th style={{ textAlign: 'right' }}>Pts</th></tr>
            </thead>
            <tbody>{sel.items.map((it, i) => <ConceptRow key={i} item={it} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function JugadorCard({ jug }) {
  const [open, setOpen] = useState(false);
  const isCap = jug.isCaptain;
  return (
    <div className="jugador-card">
      <div className="jugador-card-header" onClick={() => setOpen(o => !o)}>
        <div className="jugador-info">
          <span className="jugador-pos">{POS_LABELS[jug.position] ?? jug.position}</span>
          <div>
            <span className="jugador-name">
              {jug.playerName}
              {isCap && <span className="captain-badge">⭐ CAP</span>}
            </span>
            <div className="jugador-role">{jug.role === 'suplente' ? 'Suplente' : 'Titular'} · {jug.teamId}</div>
          </div>
        </div>
        <div className={`jugador-pts${isCap ? ' captain' : ''}`}>
          {jug.totalPoints.toFixed(1)} pts
          <span style={{ fontSize: '0.65rem', marginLeft: 4, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && jug.items && jug.items.length > 0 && (
        <div className="breakdown-wrap">
          <table className="breakdown-table">
            <thead>
              <tr><th>Concepto</th><th>Fase</th><th>Modificadores</th><th style={{ textAlign: 'right' }}>Pts</th></tr>
            </thead>
            <tbody>{jug.items.map((it, i) => <ConceptRow key={i} item={it} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DetalleParticipante({ porraId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet(`/clasificacion/${porraId}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [porraId]);

  if (loading) return <div className="clas-loading">Cargando desglose…</div>;
  if (!data)   return <div className="clas-loading">No se encontró la porra.</div>;

  const selecciones = data.breakdown?.selecciones ?? [];
  const jugadores   = data.breakdown?.jugadores   ?? [];

  return (
    <div>
      <button className="detalle-back" onClick={onBack}>← Volver a clasificación</button>

      <div className="detalle-header">
        <h2>{data.participantName}</h2>
        <div className="total">Total: <span>{data.totalPoints.toFixed(1)} puntos</span></div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
          Calculado: {new Date(data.calculatedAt).toLocaleString('es-ES')}
        </div>
      </div>

      {selecciones.length > 0 && (
        <div className="detalle-section">
          <h3>Selecciones ({selecciones.length})</h3>
          <div className="sel-grid">
            {selecciones.map(s => <SelCard key={s.teamId} sel={s} />)}
          </div>
        </div>
      )}

      {jugadores.length > 0 && (
        <div className="detalle-section">
          <h3>Jugadores ({jugadores.length})</h3>
          {jugadores.map(j => <JugadorCard key={j.playerId} jug={j} />)}
        </div>
      )}
    </div>
  );
}
