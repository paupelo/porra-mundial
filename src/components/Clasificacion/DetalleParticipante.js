import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';
import CampoFormacion from '../ArmaTuPorra/CampoFormacion';
import { SELECCIONES, CATEGORIAS } from '../ArmaTuPorra/datos';

const CAT_LABELS = { favoritos: 'Favoritos', sorpresas: 'Sorpresas', petardazos: 'Petardazos', cacaDeLaVaca: 'Caca de la Vaca', caca: 'Caca de la Vaca' };
const CAT_COLORS = { favoritos: '#C41E3A', sorpresas: '#1E5BB8', petardazos: '#1FA67A', caca: '#5A6478', cacaDeLaVaca: '#5A6478' };
const CAT_EMOJI  = { favoritos: '🔴', sorpresas: '🔵', petardazos: '🟢', caca: '⚫', cacaDeLaVaca: '⚫' };
const POS_LABELS = { portero: '🧤 POR', defensa: '🛡 DEF', medio: '⚙️ MED', delantero: '⚽ DEL' };

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
            <thead><tr><th>Concepto</th><th>Fase</th><th>Modificadores</th><th style={{ textAlign: 'right' }}>Pts</th></tr></thead>
            <tbody>{sel.items.map((it, i) => <ConceptRow key={i} item={it} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function JugadorCard({ jug }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="jugador-card">
      <div className="jugador-card-header" onClick={() => setOpen(o => !o)}>
        <div className="jugador-info">
          <span className="jugador-pos">{POS_LABELS[jug.position] ?? jug.position}</span>
          <div>
            <span className="jugador-name">
              {jug.playerName}
              {jug.isCaptain && <span className="captain-badge">⭐ CAP</span>}
            </span>
            <div className="jugador-role">{jug.role === 'suplente' ? 'Suplente' : 'Titular'} · {jug.teamId}</div>
          </div>
        </div>
        <div className={`jugador-pts${jug.isCaptain ? ' captain' : ''}`}>
          {jug.totalPoints.toFixed(1)} pts
          <span style={{ fontSize: '0.65rem', marginLeft: 4, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>
      {open && jug.items && jug.items.length > 0 && (
        <div className="breakdown-wrap">
          <table className="breakdown-table">
            <thead><tr><th>Concepto</th><th>Fase</th><th>Modificadores</th><th style={{ textAlign: 'right' }}>Pts</th></tr></thead>
            <tbody>{jug.items.map((it, i) => <ConceptRow key={i} item={it} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Convierte la alineación de la API al formato que espera CampoFormacion
function buildCampoProps(lineup) {
  const POS_MAP = { portero: 'POR', defensa: 'DEF', medio: 'MED', delantero: 'DEL' };
  const toSlot = l => ({
    id: l.player_id,
    nombre: l.player_name,
    posicion: POS_MAP[l.position] ?? 'MED',
    seleccionId: l.team_id,
    esCopitan: l.is_captain === 1,
  });
  return {
    titular:   lineup.filter(l => l.role === 'titular').map(toSlot),
    suplentes: lineup.filter(l => l.role === 'suplente').map(toSlot),
  };
}

export default function DetalleParticipante({ porraId, onBack }) {
  const [score,   setScore]   = useState(null);
  const [porraData, setPorraData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('porra'); // 'porra' | 'puntuacion'

  useEffect(() => {
    Promise.allSettled([
      apiGet(`/clasificacion/${porraId}`),
      apiGet(`/porras/${porraId}`),
    ]).then(([scoreRes, porraRes]) => {
      if (scoreRes.status === 'fulfilled') setScore(scoreRes.value);
      if (porraRes.status === 'fulfilled') setPorraData(porraRes.value);
      setLoading(false);
    });
  }, [porraId]);

  if (loading) return <div className="clas-loading">Cargando…</div>;
  if (!score && !porraData) return <div className="clas-loading">No se encontró la porra.</div>;

  const participantName = score?.participantName ?? porraData?.participantName ?? '—';
  const selecciones = score?.breakdown?.selecciones ?? [];
  const jugadores   = score?.breakdown?.jugadores   ?? [];

  // Agrupamos las selecciones por categoría para el panel "Mi Porra"
  const CATS = ['favoritos', 'sorpresas', 'petardazos', 'caca'];
  const selsByCat = {};
  if (porraData?.selections) {
    for (const s of porraData.selections) {
      const cat = s.category === 'cacaDeLaVaca' ? 'caca' : s.category;
      if (!selsByCat[cat]) selsByCat[cat] = [];
      selsByCat[cat].push(s);
    }
  }

  const campoProps = porraData?.lineup ? buildCampoProps(porraData.lineup) : null;
  const ganador    = porraData?.selections?.find(s => s.is_winner);

  const hasScore = score && (selecciones.length > 0 || jugadores.length > 0);

  return (
    <div>
      <button className="detalle-back" onClick={onBack}>← Volver a clasificación</button>

      <div className="detalle-header">
        <h2>{participantName}</h2>
        {score && (
          <div className="total">Total: <span>{score.totalPoints.toFixed(1)} puntos</span></div>
        )}
      </div>

      {/* Tabs */}
      {hasScore && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['porra', 'puntuacion'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 20px', borderRadius: 24, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem',
                background: tab === t ? '#003DA5' : '#f1f5f9',
                color: tab === t ? '#fff' : '#374151',
              }}
            >
              {t === 'porra' ? '📋 Mi Porra' : '📊 Puntuación'}
            </button>
          ))}
        </div>
      )}

      {/* ── Panel "Mi Porra" ── */}
      {(tab === 'porra' || !hasScore) && porraData && (
        <div>
          {/* Selecciones por categoría */}
          <div className="detalle-section">
            <h3>Selecciones</h3>
            {ganador && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: 10,
                padding: '6px 16px', marginBottom: 16, fontWeight: 700, fontSize: '0.9rem',
              }}>
                ⭐ Ganador del Mundial: {ganador.team_name}
              </div>
            )}
            {CATS.map(cat => {
              const items = selsByCat[cat];
              if (!items?.length) return null;
              return (
                <div key={cat} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: CAT_COLORS[cat], marginBottom: 6 }}>
                    {CAT_EMOJI[cat]} {CAT_LABELS[cat]}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {items.map(s => {
                      const info = SELECCIONES.find(sel => sel.id === s.team_id);
                      return (
                        <span key={s.team_id} style={{
                          background: '#f8fafc', border: `1.5px solid ${CAT_COLORS[cat]}33`,
                          borderRadius: 8, padding: '4px 12px',
                          fontSize: '0.85rem', fontWeight: 600, color: '#1e293b',
                        }}>
                          {info?.bandera} {s.team_name}
                          {s.is_winner ? ' ⭐' : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Campo de formación */}
          {campoProps && (
            <div className="detalle-section">
              <h3>Alineación</h3>
              <div style={{ maxWidth: 380, margin: '0 auto' }}>
                <CampoFormacion titular={campoProps.titular} suplentes={campoProps.suplentes} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Panel "Puntuación" ── */}
      {tab === 'puntuacion' && hasScore && (
        <div>
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
      )}
    </div>
  );
}
