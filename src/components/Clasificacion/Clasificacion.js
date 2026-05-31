import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';
import DetalleParticipante from './DetalleParticipante';
import './Clasificacion.css';

export default function Clasificacion() {
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPorraId, setSelectedPorraId] = useState(null);

  useEffect(() => {
    apiGet('/clasificacion')
      .then(setRanking)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
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
        {loading && <div className="clas-loading">Cargando clasificación…</div>}

        {error && (
          <div className="clas-empty">
            <p>⚠️ No se pudo cargar la clasificación. Asegúrate de que el servidor está corriendo.</p>
          </div>
        )}

        {!loading && !error && (!ranking || ranking.length === 0) && (
          <div className="clas-empty">
            <p style={{ fontSize: '2rem' }}>🏆</p>
            <p>La clasificación está vacía. El admin debe cargar y validar los primeros eventos.</p>
          </div>
        )}

        {ranking && ranking.length > 0 && (
          <table className="ranking-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Participante</th>
                <th style={{ textAlign: 'right' }}>Puntos</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
