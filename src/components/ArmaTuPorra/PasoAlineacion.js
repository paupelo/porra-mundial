import React, { useState } from 'react';
import { SELECCIONES, CATEGORIAS, getJugadoresMock } from './datos';
import CampoFormacion from './CampoFormacion';

const POSICIONES_TITULAR = [
  { pos: 'POR', cantidad: 1, label: 'Portero' },
  { pos: 'DEF', cantidad: 3, label: 'Defensas' },
  { pos: 'MED', cantidad: 4, label: 'Medios' },
  { pos: 'DEL', cantidad: 3, label: 'Delanteros' },
];


function getCategoria(seleccionId) {
  const sel = SELECCIONES.find(s => s.id === seleccionId);
  return sel ? sel.categoria : null;
}

function getCatColor(categoriaId) {
  const cat = Object.values(CATEGORIAS).find(c => c.id === categoriaId);
  return cat?.color || '#003DA5';
}

export function validarAlineacion(porra) {
  const errores = [];

  if (porra.titular.length < 11) {
    errores.push('Faltan titulares por elegir.');
    return errores;
  }

  const catCount = (cat) =>
    porra.titular.filter(j => getCategoria(j.seleccionId) === cat).length;

  if (catCount('cacaDeLaVaca') < 2)
    errores.push('Necesitas al menos 2 titulares de Caca de la Vaca.');
  if (catCount('petardazos') < 2)
    errores.push('Necesitas al menos 2 titulares de Petardazos.');
  if (catCount('sorpresas') < 3)
    errores.push('Necesitas al menos 3 titulares de Sorpresas.');

  const supFavoritos = porra.suplentes.filter(
    j => getCategoria(j.seleccionId) === 'favoritos'
  ).length;
  if (supFavoritos > 1)
    errores.push('Solo 1 de los 3 suplentes puede ser de Favoritos.');

  if (!porra.titular.some(j => j.esCopitan))
    errores.push('Debes elegir un Capitán entre los titulares.');

  return errores;
}

function PasoAlineacion({ porra, setPorra }) {
  const [catSelectorActiva, setCatSelectorActiva] = useState('favoritos');
  const [seleccionActiva, setSeleccionActiva] = useState(
    SELECCIONES.find(s => s.categoria === 'favoritos')?.id || SELECCIONES[0].id
  );

  const jugadoresMock = seleccionActiva ? getJugadoresMock(seleccionActiva) : [];

  function seleccionInfo(id) {
    return SELECCIONES.find(s => s.id === id);
  }

  function esTitular(jugadorId) {
    return porra.titular.some(j => j.id === jugadorId);
  }

  function esSuplente(jugadorId) {
    return porra.suplentes.some(j => j.id === jugadorId);
  }

  function titularesPorPos(pos) {
    return porra.titular.filter(j => j.posicion === pos);
  }

  function suplentesPorPos(pos) {
    return porra.suplentes.filter(j => j.posicion === pos);
  }

  function maxTitularesPorPos(pos) {
    return POSICIONES_TITULAR.find(p => p.pos === pos)?.cantidad || 0;
  }

  function toggleTitular(jugador) {
    if (esTitular(jugador.id)) {
      setPorra(prev => ({
        ...prev,
        titular: prev.titular.filter(j => j.id !== jugador.id),
      }));
    } else if (esSuplente(jugador.id)) {
      return;
    } else {
      const maxPos = maxTitularesPorPos(jugador.posicion);
      const actualesPos = titularesPorPos(jugador.posicion).length;
      if (actualesPos < maxPos) {
        setPorra(prev => ({
          ...prev,
          titular: [...prev.titular, { ...jugador, esCopitan: false }],
        }));
      }
    }
  }

  function toggleSuplente(jugador) {
    if (esSuplente(jugador.id)) {
      setPorra(prev => ({
        ...prev,
        suplentes: prev.suplentes.filter(j => j.id !== jugador.id),
      }));
    } else if (esTitular(jugador.id)) {
      return;
    } else {
      const supPos = suplentesPorPos(jugador.posicion).length;
      if (supPos < 1 && jugador.posicion !== 'POR') {
        setPorra(prev => ({
          ...prev,
          suplentes: [...prev.suplentes, jugador],
        }));
      }
    }
  }

  function toggleCopitan(jugadorId) {
    setPorra(prev => ({
      ...prev,
      titular: prev.titular.map(j => ({
        ...j,
        esCopitan: j.id === jugadorId ? !j.esCopitan : false,
      })),
    }));
  }

  function cambiarCategoria(catId) {
    setCatSelectorActiva(catId);
    const primero = SELECCIONES.find(s => s.categoria === catId);
    if (primero) setSeleccionActiva(primero.id);
  }

  const errores = validarAlineacion(porra);

  return (
    <div className="paso-alineacion">
      <div className="alineacion-layout">
        {/* Panel izquierdo */}
        <div className="alineacion-panel-izq">
          <div className="tabs-categorias">
            {Object.values(CATEGORIAS).map(cat => (
              <button
                key={cat.id}
                className={`tab-categoria ${catSelectorActiva === cat.id ? 'activo' : ''}`}
                style={{ '--color-cat': cat.color }}
                onClick={() => cambiarCategoria(cat.id)}
                type="button"
              >
                {cat.emoji} {cat.nombre}
              </button>
            ))}
          </div>

          <div className="selector-seleccion">
            {SELECCIONES.filter(s => s.categoria === catSelectorActiva).map(equipo => (
              <button
                key={equipo.id}
                className={`btn-seleccion ${seleccionActiva === equipo.id ? 'activo' : ''}`}
                style={{ '--color-cat': getCatColor(equipo.categoria) }}
                onClick={() => setSeleccionActiva(equipo.id)}
                type="button"
              >
                <span>{equipo.bandera}</span>
                <span>{equipo.nombre}</span>
              </button>
            ))}
          </div>

          {seleccionActiva && (
            <div className="lista-jugadores">
              <h4>{seleccionInfo(seleccionActiva)?.nombre} — Elige jugadores</h4>
              {['POR', 'DEF', 'MED', 'DEL'].map(pos => {
                const jugadoresPos = jugadoresMock.filter(j => j.posicion === pos);
                const labelPos = { POR: 'Porteros', DEF: 'Defensas', MED: 'Medios', DEL: 'Delanteros' }[pos];
                return (
                  <div key={pos} className="grupo-posicion">
                    <span className="label-posicion">{labelPos}</span>
                    {jugadoresPos.map(jugador => {
                      const esTit = esTitular(jugador.id);
                      const esSup = esSuplente(jugador.id);
                      const maxTit = maxTitularesPorPos(pos);
                      const titActuales = titularesPorPos(pos).length;
                      const supActuales = suplentesPorPos(pos).length;
                      const puedeSerTitular = !esTit && !esSup && titActuales < maxTit;
                      const puedeSerSuplente = !esTit && !esSup && supActuales < 1 && pos !== 'POR';

                      return (
                        <div key={jugador.id} className={`fila-jugador ${esTit ? 'es-titular' : ''} ${esSup ? 'es-suplente' : ''}`}>
                          <span className="jugador-nombre">{jugador.nombre}</span>
                          <div className="jugador-acciones">
                            {esTit && (
                              <button
                                className={`btn-copitan ${porra.titular.find(j => j.id === jugador.id)?.esCopitan ? 'activo' : ''}`}
                                onClick={() => toggleCopitan(jugador.id)}
                                type="button"
                                title="Capitán"
                              >C</button>
                            )}
                            <button
                              className={`btn-rol titular ${esTit ? 'activo' : ''}`}
                              onClick={() => toggleTitular(jugador)}
                              disabled={!esTit && !puedeSerTitular}
                              type="button"
                            >
                              {esTit ? '✓ Titular' : 'Titular'}
                            </button>
                            {pos !== 'POR' && (
                              <button
                                className={`btn-rol suplente ${esSup ? 'activo' : ''}`}
                                onClick={() => toggleSuplente(jugador)}
                                disabled={!esSup && !puedeSerSuplente}
                                type="button"
                              >
                                {esSup ? '✓ Sup.' : 'Sup.'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel derecho: campo de fútbol visual */}
        <div className="alineacion-panel-der">
          <h4>Tu 11 titular</h4>
          <CampoFormacion titular={porra.titular} suplentes={porra.suplentes} />
          {errores.length > 0 && (
            <div className="errores-alineacion">
              {errores.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PasoAlineacion;
