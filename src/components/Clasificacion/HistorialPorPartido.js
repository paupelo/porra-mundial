import React, { useState } from 'react';

// Desglose por partido: agrupa los ScoreLineItem del motor por matchId y los
// presenta como tabla Rival/Resultado/Fase/Brutos/Multiplicador/Finales con el
// detalle concepto a concepto expandible. Los conceptos sin partido (pasar
// ronda, ganar el Mundial, eliminaciones, MVP) van en un grupo "Bonus de fase".

const FASE_LABELS = {
  grupos: 'Grupos', dieciseisavos: '16avos', octavos: 'Octavos',
  cuartos: 'Cuartos', semifinales: 'Semis', final: 'Final',
};

export function agruparPorPartido(items) {
  const porPartido = new Map();
  const sinPartido = [];
  for (const it of items) {
    if (it.matchId) {
      if (!porPartido.has(it.matchId)) porPartido.set(it.matchId, []);
      porPartido.get(it.matchId).push(it);
    } else {
      sinPartido.push(it);
    }
  }
  return { porPartido, sinPartido };
}

function fmtPts(n) {
  const v = typeof n === 'number' ? n : parseFloat(n);
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

function multiplicadorDe(items) {
  return items.reduce((m, it) => Math.max(m, it.phaseMultiplier), 1);
}

function FilaConcepto({ item }) {
  const parts = [];
  if (item.phaseMultiplier !== 1) parts.push(`×${item.phaseMultiplier} fase`);
  if (item.winnerMultiplier !== 1) parts.push(`×${item.winnerMultiplier} ganador`);
  if (item.roleMultiplier !== 1) parts.push(`×${item.roleMultiplier} rol`);
  return (
    <tr>
      <td style={{ paddingLeft: 24, color: '#475569' }}>↳ {item.concept}</td>
      <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{fmtPts(item.basePoints)} base</td>
      <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{parts.join(', ') || '—'}</td>
      <td className={item.finalPoints > 0 ? 'pts-pos' : item.finalPoints < 0 ? 'pts-neg' : 'pts-zero'}>
        {fmtPts(item.finalPoints)}
      </td>
    </tr>
  );
}

function FilaPartido({ match, items, etiqueta, abiertoInicial }) {
  const [abierto, setAbierto] = useState(!!abiertoInicial);
  const brutos = items.reduce((s, i) => s + i.basePoints, 0);
  const finales = items.reduce((s, i) => s + i.finalPoints, 0);
  const fase = items[0]?.phase;
  const esProvisional = items.some(i => i.isLive);
  return (
    <>
      <tr onClick={() => setAbierto(o => !o)} style={{ cursor: 'pointer' }} title="Ver desglose concepto a concepto">
        <td style={{ fontWeight: 600 }}>
          {abierto ? '▾' : '▸'} {etiqueta}
          {esProvisional && (
            <span style={{
              fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
              background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5',
              padding: '1px 6px', borderRadius: 10, marginLeft: 6, whiteSpace: 'nowrap',
            }}>
              🔴 Provisional (en vivo)
            </span>
          )}
        </td>
        <td style={{ color: '#475569' }}>{match ? resultadoDe(match) : '—'}</td>
        <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{FASE_LABELS[fase] ?? fase}</td>
        <td style={{ color: '#475569' }}>{fmtPts(brutos)}</td>
        <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>×{multiplicadorDe(items)}</td>
        <td className={finales > 0 ? 'pts-pos' : finales < 0 ? 'pts-neg' : 'pts-zero'}>{fmtPts(finales)}</td>
      </tr>
      {abierto && items.map((it, i) => (
        <tr key={i}>
          <td colSpan={6} style={{ padding: 0, border: 'none' }}>
            <table className="breakdown-table" style={{ margin: 0 }}>
              <tbody><FilaConcepto item={it} /></tbody>
            </table>
          </td>
        </tr>
      ))}
    </>
  );
}

function resultadoDe(match) {
  if (match.status === 'live') {
    const res = `${match.live_home_score ?? 0}–${match.live_away_score ?? 0}`;
    return match.minute !== null && match.minute !== undefined ? `${res} (${match.minute}')` : res;
  }
  if (match.home_score === null || match.home_score === undefined) return 'Pendiente';
  let res = `${match.home_score}–${match.away_score}`;
  if (match.decided_by_penalties) res += ' (pen.)';
  return res;
}

function etiquetaPartido(match, teamId) {
  if (!match) return '(partido desconocido)';
  if (teamId) {
    // Perspectiva de una selección: mostramos el rival
    const rival = match.home_team_id === teamId ? match.away_team_name : match.home_team_name;
    return `vs ${rival}`;
  }
  return `${match.home_team_name} – ${match.away_team_name}`;
}

/**
 * Tabla de partidos para una selección (teamId) o un jugador (teamId=null).
 * - items: ScoreLineItem[] del motor para esa selección/jugador.
 * - matchesById: Map(id → partido de GET /api/matches).
 */
export function TablaPorPartido({ items, matchesById, teamId = null, expandido = false }) {
  const { porPartido, sinPartido } = agruparPorPartido(items);

  const grupos = [...porPartido.entries()]
    .map(([matchId, its]) => ({ match: matchesById?.get(matchId) ?? null, items: its }))
    .sort((a, b) => (a.match?.match_date ?? '').localeCompare(b.match?.match_date ?? ''));

  if (grupos.length === 0 && sinPartido.length === 0) {
    return <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '8px 0' }}>Aún no hay puntos.</p>;
  }

  return (
    <div className="breakdown-wrap">
      <table className="breakdown-table">
        <thead>
          <tr>
            <th>{teamId ? 'Rival' : 'Partido'}</th>
            <th>Resultado</th>
            <th>Fase</th>
            <th style={{ textAlign: 'right' }}>Brutos</th>
            <th>Mult.</th>
            <th style={{ textAlign: 'right' }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g, i) => (
            <FilaPartido
              key={i}
              match={g.match}
              items={g.items}
              etiqueta={etiquetaPartido(g.match, teamId)}
              abiertoInicial={expandido}
            />
          ))}
          {sinPartido.map((it, i) => (
            <tr key={`b${i}`}>
              <td style={{ fontWeight: 600, color: '#475569' }}>★ {it.concept}</td>
              <td style={{ color: '#94a3b8' }}>—</td>
              <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{FASE_LABELS[it.phase] ?? it.phase}</td>
              <td style={{ color: '#475569' }}>{fmtPts(it.basePoints)}</td>
              <td style={{ color: '#94a3b8', fontSize: '0.75rem' }}>×{it.phaseMultiplier}</td>
              <td className={it.finalPoints > 0 ? 'pts-pos' : it.finalPoints < 0 ? 'pts-neg' : 'pts-zero'}>{fmtPts(it.finalPoints)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Modal con el histórico completo partido a partido (selección o jugador). */
export function HistorialModal({ titulo, subtitulo, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, maxWidth: 720, width: '100%',
          maxHeight: '85vh', overflowY: 'auto', padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>{titulo}</h3>
            {subtitulo && <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>{subtitulo}</div>}
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
