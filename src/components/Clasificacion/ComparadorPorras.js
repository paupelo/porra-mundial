import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';
import './ComparadorPorras.css';

// Comparador de porras: hasta 4 porras lado a lado, selecciones por categoría
// y once por posición, resaltando las coincidencias entre las comparadas.

const CATS = [
  ['favoritos', '🔴 Favoritos'],
  ['sorpresas', '🔵 Sorpresas'],
  ['petardazos', '🟢 Petardazos'],
  ['caca', '⚫ Caca de la Vaca'],
];
const POSICIONES = [
  ['portero', '🧤 Portero'],
  ['defensa', '🛡 Defensas'],
  ['medio', '⚙️ Medios'],
  ['delantero', '⚽ Delanteros'],
];

function Chip({ texto, esMatch, title }) {
  return <span className={`comp-chip${esMatch ? ' match' : ''}`} title={title}>{esMatch ? '🤝 ' : ''}{texto}</span>;
}

export default function ComparadorPorras({ participantes }) {
  const [sel, setSel] = useState(['', '', '', '']);
  const [datos, setDatos] = useState({});
  const [cargando, setCargando] = useState(false);
  // Selecciones ya eliminadas del Mundial (cualquier fase con result='eliminated').
  // El comparador solo muestra lo que sigue VIVO: ni selecciones eliminadas ni
  // jugadores de selecciones eliminadas.
  const [eliminados, setEliminados] = useState(() => new Set());

  useEffect(() => {
    apiGet('/phase-results')
      .then(rs => setEliminados(new Set(rs.filter(r => r.result === 'eliminated').map(r => r.team_id))))
      .catch(() => {});
  }, []);

  const elegidos = sel.filter(Boolean);

  useEffect(() => {
    const faltan = elegidos.filter(id => !(id in datos));
    if (faltan.length === 0) return;
    setCargando(true);
    Promise.all(faltan.map(id => apiGet(`/porras/${id}`).then(d => [id, d]).catch(() => [id, null])))
      .then(pares => setDatos(prev => ({ ...prev, ...Object.fromEntries(pares) })))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.join('|')]);

  const cols = elegidos
    .map(id => ({ id, det: datos[id] }))
    .filter(c => c.det)
    // Solo elementos vivos: fuera selecciones eliminadas y jugadores cuyos equipos están eliminados
    .map(c => ({
      ...c,
      det: {
        ...c.det,
        selections: c.det.selections.filter(s => !eliminados.has(s.team_id)),
        lineup: c.det.lineup.filter(l => !eliminados.has(l.team_id)),
      },
    }));

  // Coincidencias entre las porras comparadas (equipo/jugador en ≥2 de ellas)
  const vecesEquipo = new Map();
  const vecesJugador = new Map();
  for (const c of cols) {
    for (const s of c.det.selections) vecesEquipo.set(s.team_id, (vecesEquipo.get(s.team_id) ?? 0) + 1);
    for (const l of c.det.lineup) vecesJugador.set(l.player_id, (vecesJugador.get(l.player_id) ?? 0) + 1);
  }
  const hayComparacion = cols.length >= 2;

  function cambiar(idx, valor) {
    setSel(prev => prev.map((v, i) => (i === idx ? valor : v)));
  }

  const opciones = participantes ?? [];

  return (
    <div>
      <div className="comp-selectores">
        {sel.map((valor, idx) => (
          <select key={idx} value={valor} onChange={e => cambiar(idx, e.target.value)}>
            <option value="">— Porra {idx + 1} —</option>
            {opciones
              .filter(p => p.porraId === valor || !sel.includes(p.porraId))
              .map(p => <option key={p.porraId} value={p.porraId}>{p.participantName}</option>)}
          </select>
        ))}
      </div>

      {cols.length === 0 && !cargando && (
        <div className="clas-empty">
          <p style={{ fontSize: '2rem' }}>⚖️</p>
          <p>Elige de 2 a 4 porras para compararlas lado a lado.</p>
        </div>
      )}
      {cargando && <div className="clas-loading">Cargando porras…</div>}

      {cols.length > 0 && (
        <>
          {hayComparacion && (
            <p className="comp-hint">🤝 = elegido también por otra de las porras comparadas.</p>
          )}
          <div className="comp-scroll">
            <div className="comp-table" style={{ gridTemplateColumns: `110px repeat(${cols.length}, minmax(170px, 1fr))` }}>
              <div className="comp-label" />
              {cols.map(c => <div key={c.id} className="comp-head">{c.det.participantName}</div>)}

              <div className="comp-section">Selecciones</div>
              {CATS.map(([cat, label]) => (
                <React.Fragment key={cat}>
                  <div className="comp-label">{label}</div>
                  {cols.map(c => {
                    const equipos = c.det.selections.filter(s => (s.category === 'cacaDeLaVaca' ? 'caca' : s.category) === cat);
                    return (
                      <div key={c.id} className="comp-cell">
                        {equipos.length === 0 && <span className="comp-vacio">—</span>}
                        {equipos.map(s => (
                          <Chip
                            key={s.team_id}
                            texto={`${s.team_name}${s.is_winner ? ' ⭐' : ''}`}
                            title={s.is_winner ? 'Ganador del Mundial' : undefined}
                            esMatch={hayComparacion && vecesEquipo.get(s.team_id) >= 2}
                          />
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}

              <div className="comp-section">Once (11 titulares + 3 suplentes)</div>
              {POSICIONES.map(([pos, label]) => (
                <React.Fragment key={pos}>
                  <div className="comp-label">{label}</div>
                  {cols.map(c => {
                    const jugadores = c.det.lineup.filter(l => l.position === pos);
                    return (
                      <div key={c.id} className="comp-cell">
                        {jugadores.length === 0 && <span className="comp-vacio">—</span>}
                        {jugadores.map(l => (
                          <Chip
                            key={l.player_id}
                            texto={`${l.player_name}${l.is_captain ? ' ⭐CAP' : ''}${l.role === 'suplente' ? ' (supl.)' : ''}`}
                            esMatch={hayComparacion && vecesJugador.get(l.player_id) >= 2}
                          />
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
