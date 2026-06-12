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

export default function Clasificacion() {
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPorraId, setSelectedPorraId] = useState(null);
  const [vista, setVista] = useState('ranking');

  useEffect(() => {
    let alive = true;
    const load = () =>
      apiGet('/clasificacion')
        .then(d => { if (alive) { setRanking(d); setError(null); } })
        .catch(e => { if (alive) setError(e.message); })
        .finally(() => { if (alive) setLoading(false); });
    load();
    // Actualización en tiempo real: el scheduler recalcula en el servidor
    const timer = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

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
          <table className="ranking-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Participante</th>
                <th style={{ textAlign: 'right' }}>Puntos</th>
                <th style={{ textAlign: 'right' }}>Dif.</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(entry => (
                <tr
                  key={entry.porraId}
                  className="ranking-row"
                  onClick={() => setSelectedPorraId(entry.porraId)}
                  title="Ver desglose completo"
                >
                  <td>
                    <span className={`pos-badge pos-${entry.position <= 3 ? entry.position : 'n'}`}>
                      {entry.position}
                    </span>
                  </td>
                  <td className="participant-name">{entry.participantName}</td>
                  <td className="participant-pts">{entry.totalPoints.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {entry.position === 1 ? '—' : (entry.totalPoints - ranking[0].totalPoints).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
