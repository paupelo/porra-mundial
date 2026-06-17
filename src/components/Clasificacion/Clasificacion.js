import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';
import DetalleParticipante from './DetalleParticipante';
import ComparadorPorras from './ComparadorPorras';
import ResumenElegidos from './ResumenElegidos';
import './Clasificacion.css';

const VISTAS = [
  ['ranking', '🏆 Clasificación'],
  ['comparador', '⚖️ Comparador de porras'],
  ['resumen', '📊 Resumen de elegidos'],
];

// Indicador de cambio de posición respecto al cierre del día anterior.
// position_change: positivo = sube, negativo = baja, 0 = igual, null = sin día previo.
function PosChange({ change }) {
  if (change === null || change === undefined || change === 0) return null;
  const up = change > 0;
  return (
    <span
      className="clas-poschange"
      style={{ color: up ? '#16a34a' : '#dc2626', fontSize: '0.72rem', fontWeight: 800, marginLeft: 6 }}
      title={up ? `Sube ${change} puesto(s) respecto al día anterior` : `Baja ${Math.abs(change)} puesto(s) respecto al día anterior`}
    >
      {up ? '↑' : '↓'}{Math.abs(change)}
    </span>
  );
}

// Mini barra de progreso compacta (selecciones / jugadores) de la jornada en curso
function ProgBar({ icon, label, played, total }) {
  const pct = total > 0 ? Math.round((played / total) * 100) : 0;
  return (
    <div className="clas-prog-row" title={`${played}/${total} ${label} con partido esta jornada`}>
      <span className="clas-prog-ico" aria-hidden>{icon}</span>
      <span className="clas-prog-num">{played}/{total}</span>
      <span className="clas-prog-bar"><span className="clas-prog-fill" style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

export default function Clasificacion() {
  const [ranking, setRanking] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPorraId, setSelectedPorraId] = useState(null);
  const [vista, setVista] = useState('ranking');

  useEffect(() => {
    let alive = true;
    const load = () => {
      apiGet('/clasificacion')
        .then(d => { if (alive) { setRanking(d); setError(null); } })
        .catch(e => { if (alive) setError(e.message); })
        .finally(() => { if (alive) setLoading(false); });
      // Progreso de la jornada en curso (complementario; si falla no rompe el ranking)
      apiGet('/clasificacion/progreso-jornada')
        .then(d => { if (alive) setProgreso(d); })
        .catch(() => {});
    };
    load();
    // Actualización en tiempo real: el scheduler recalcula en el servidor
    const timer = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const progByPorra = {};
  if (progreso?.participantes) {
    for (const p of progreso.participantes) progByPorra[p.porraId] = p;
  }

  if (selectedPorraId) {
    return (
      <div className="clasificacion-page">
        <div className="clas-content">
          <DetalleParticipante
            porraId={selectedPorraId}
            onBack={() => setSelectedPorraId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="clasificacion-page">
      <div className="clas-hero">
        <h1>Clasificación</h1>
        <p>Puntuación actualizada tras cada jornada validada por el admin.</p>
      </div>

      <div className="clas-content">
        {/* Subsecciones de la pestaña Clasificación */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {VISTAS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setVista(id)}
              style={{
                padding: '8px 20px', borderRadius: 24, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem',
                background: vista === id ? '#003DA5' : '#f1f5f9',
                color: vista === id ? '#fff' : '#374151',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {vista === 'comparador' && <ComparadorPorras participantes={ranking} />}
        {vista === 'resumen' && <ResumenElegidos />}

        {vista === 'ranking' && loading && <div className="clas-loading">Cargando clasificación…</div>}

        {vista === 'ranking' && error && (
          <div className="clas-empty">
            <p>⚠️ No se pudo cargar la clasificación. Asegúrate de que el servidor está corriendo.</p>
          </div>
        )}

        {vista === 'ranking' && !loading && !error && (!ranking || ranking.length === 0) && (
          <div className="clas-empty">
            <p style={{ fontSize: '2rem' }}>🏆</p>
            <p>La clasificación está vacía. El admin debe cargar y validar los primeros eventos.</p>
          </div>
        )}

        {vista === 'ranking' && ranking && ranking.length > 0 && (
          <>
            {progreso?.jornada && (
              <div className="clas-jornada-tag">
                Progreso jornada en curso: <strong>{progreso.jornada.label}</strong>
                <span className="clas-jornada-hint"> · 🛡️ selecciones · ⚽ jugadores que ya han disputado / con partido esta jornada</span>
              </div>
            )}
            <table className="ranking-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Participante</th>
                  <th className="clas-prog-th">Jornada en curso</th>
                  <th style={{ textAlign: 'right' }}>Puntos</th>
                  <th style={{ textAlign: 'right' }}>Dif.</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(entry => {
                  const pr = progByPorra[entry.porraId];
                  return (
                    <tr
                      key={entry.porraId}
                      className="ranking-row"
                      onClick={() => setSelectedPorraId(entry.porraId)}
                      title="Ver desglose completo"
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className={`pos-badge pos-${entry.position <= 3 ? entry.position : 'n'}`}>
                          {entry.position}
                        </span>
                        <PosChange change={entry.position_change} />
                      </td>
                      <td className="participant-name">{entry.participantName}</td>
                      <td className="clas-prog-cell">
                        {pr ? (
                          <>
                            <ProgBar icon="🛡️" label="selecciones" played={pr.selecciones.disputadas} total={pr.selecciones.total} />
                            <ProgBar icon="⚽" label="jugadores" played={pr.jugadores.disputados} total={pr.jugadores.total} />
                          </>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                      <td className="participant-pts">{entry.totalPoints.toFixed(1)}</td>
                      <td style={{ textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem' }}>
                        {entry.position === 1 ? '—' : (entry.totalPoints - ranking[0].totalPoints).toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
