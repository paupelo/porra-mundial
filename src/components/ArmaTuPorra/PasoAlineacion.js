import React, { useState, useEffect, useMemo } from 'react';
import { SELECCIONES, CATEGORIAS } from './datos';
import CampoFormacion from './CampoFormacion';

// Posición de la API → código interno del wizard
const POS_API = { portero: 'POR', defensa: 'DEF', medio: 'MED', delantero: 'DEL' };
// Código interno → etiqueta de sección
const POS_LABEL = { POR: 'Porteros', DEF: 'Defensas', MED: 'Medios', DEL: 'Delanteros' };

const CUPOS_TITULAR = { POR: 1, DEF: 3, MED: 4, DEL: 3 };

// ─── Validación exportada (usada en ArmaTuPorra.js) ──────────────────────────

function getCategoriaDeSeleccion(seleccionId) {
  return SELECCIONES.find(s => s.id === seleccionId)?.categoria ?? null;
}

export function validarAlineacion(porra) {
  const errores = [];

  if (porra.titular.length < 11) {
    errores.push('Faltan titulares por elegir.');
    return errores;
  }

  const catCount = cat =>
    porra.titular.filter(j => getCategoriaDeSeleccion(j.seleccionId) === cat).length;

  if (catCount('cacaDeLaVaca') < 2)
    errores.push('Necesitas al menos 2 titulares de Caca de la Vaca.');
  if (catCount('petardazos') < 2)
    errores.push('Necesitas al menos 2 titulares de Petardazos.');
  if (catCount('sorpresas') < 3)
    errores.push('Necesitas al menos 3 titulares de Sorpresas.');

  const supFavoritos = porra.suplentes.filter(
    j => getCategoriaDeSeleccion(j.seleccionId) === 'favoritos'
  ).length;
  if (supFavoritos > 1)
    errores.push('Solo 1 de los 3 suplentes puede ser de Favoritos.');

  if (!porra.titular.some(j => j.esCopitan))
    errores.push('Debes elegir un Capitán entre los titulares.');

  const porSeleccion = {};
  for (const j of [...porra.titular, ...porra.suplentes]) {
    porSeleccion[j.seleccionId] = (porSeleccion[j.seleccionId] ?? 0) + 1;
    if (porSeleccion[j.seleccionId] > 2) {
      errores.push('Máximo 2 jugadores de la misma selección.');
      break;
    }
  }

  return errores;
}

// ─── Componente ──────────────────────────────────────────────────────────────

function PasoAlineacion({ porra, setPorra }) {
  const [jugadoresApi, setJugadoresApi] = useState([]); // todos los jugadores del API
  const [cargando, setCargando] = useState(true);
  const [errorApi, setErrorApi] = useState('');

  const equiposElegidos = SELECCIONES;
  const categoriasConEquipos = Object.values(CATEGORIAS);

  const [catActiva, setCatActiva] = useState(() =>
    categoriasConEquipos[0]?.id ?? 'favoritos'
  );
  const [seleccionActiva, setSeleccionActiva] = useState(() =>
    equiposElegidos.find(e => e.categoria === catActiva)?.id ?? equiposElegidos[0]?.id
  );

  // Carga todos los jugadores una sola vez
  useEffect(() => {
    fetch('/api/players')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        // Mapear al formato interno del wizard
        const mapped = data.map(j => ({
          id: j.id,
          nombre: j.name,
          posicion: POS_API[j.position] ?? 'MED',
          seleccionId: j.team_id,
        }));
        setJugadoresApi(mapped);
        setCargando(false);
      })
      .catch(err => {
        setErrorApi('No se pudieron cargar los jugadores. ' + err.message);
        setCargando(false);
      });
  }, []);

  // Jugadores del equipo actualmente seleccionado
  const jugadoresActivos = useMemo(
    () => jugadoresApi.filter(j => j.seleccionId === seleccionActiva),
    [jugadoresApi, seleccionActiva]
  );

  // ─── Helpers de estado ───────────────────────────────────────────────────

  function esTitular(id) { return porra.titular.some(j => j.id === id); }
  function esSuplente(id) { return porra.suplentes.some(j => j.id === id); }
  function titularesPorPos(pos) { return porra.titular.filter(j => j.posicion === pos); }
  function suplentesPorPos(pos) { return porra.suplentes.filter(j => j.posicion === pos); }
  function infoBanderas(id) { return SELECCIONES.find(s => s.id === id); }
  function jugadoresDe(seleccionId) {
    return porra.titular.filter(j => j.seleccionId === seleccionId).length
         + porra.suplentes.filter(j => j.seleccionId === seleccionId).length;
  }

  function cambiarCategoria(catId) {
    setCatActiva(catId);
    const primero = equiposElegidos.find(e => e.categoria === catId);
    if (primero) setSeleccionActiva(primero.id);
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────

  function toggleTitular(jugador) {
    if (esTitular(jugador.id)) {
      setPorra(prev => ({
        ...prev,
        titular: prev.titular.filter(j => j.id !== jugador.id),
      }));
      return;
    }
    if (esSuplente(jugador.id)) return;
    if (jugadoresDe(jugador.seleccionId) >= 2) return;

    const maxPos = CUPOS_TITULAR[jugador.posicion] ?? 0;
    if (titularesPorPos(jugador.posicion).length < maxPos) {
      setPorra(prev => ({
        ...prev,
        titular: [...prev.titular, { ...jugador, esCopitan: false }],
      }));
    }
  }

  function toggleSuplente(jugador) {
    if (esSuplente(jugador.id)) {
      setPorra(prev => ({
        ...prev,
        suplentes: prev.suplentes.filter(j => j.id !== jugador.id),
      }));
      return;
    }
    if (esTitular(jugador.id)) return;
    if (jugador.posicion === 'POR') return;
    if (jugadoresDe(jugador.seleccionId) >= 2) return;

    if (suplentesPorPos(jugador.posicion).length < 1) {
      setPorra(prev => ({
        ...prev,
        suplentes: [...prev.suplentes, jugador],
      }));
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

  const errores = validarAlineacion(porra);
  const equiposDeCategoria = equiposElegidos.filter(e => e.categoria === catActiva);

  return (
    <div className="paso-alineacion">
      <div className="alineacion-layout">
        {/* ── Panel izquierdo ─────────────────────────────────────────── */}
        <div className="alineacion-panel-izq">

          {/* Tabs de categoría */}
          <div className="tabs-categorias">
            {categoriasConEquipos.map(cat => (
              <button
                key={cat.id}
                className={`tab-categoria ${catActiva === cat.id ? 'activo' : ''}`}
                style={{ '--color-cat': cat.color }}
                onClick={() => cambiarCategoria(cat.id)}
                type="button"
              >
                {cat.emoji} {cat.nombre}
              </button>
            ))}
          </div>

          {/* Botones de selección */}
          <div className="selector-seleccion">
            {equiposDeCategoria.map(equipo => (
              <button
                key={equipo.id}
                className={`btn-seleccion ${seleccionActiva === equipo.id ? 'activo' : ''}`}
                style={{ '--color-cat': Object.values(CATEGORIAS).find(c => c.id === equipo.categoria)?.color }}
                onClick={() => setSeleccionActiva(equipo.id)}
                type="button"
              >
                <span>{equipo.bandera}</span>
                <span>{equipo.nombre}</span>
              </button>
            ))}
          </div>

          {/* Lista de jugadores */}
          {cargando ? (
            <div className="jugadores-estado">Cargando jugadores…</div>
          ) : errorApi ? (
            <div className="jugadores-estado jugadores-error">{errorApi}</div>
          ) : (
            <div className="lista-jugadores">
              <h4>
                {infoBanderas(seleccionActiva)?.bandera}{' '}
                {infoBanderas(seleccionActiva)?.nombre} — Elige jugadores
              </h4>

              {['POR', 'DEF', 'MED', 'DEL'].map(pos => {
                const jugadoresPos = jugadoresActivos.filter(j => j.posicion === pos);
                if (jugadoresPos.length === 0) return null;

                return (
                  <div key={pos} className="grupo-posicion">
                    <span className="label-posicion">{POS_LABEL[pos]}</span>
                    {jugadoresPos.map(jugador => {
                      const esTit = esTitular(jugador.id);
                      const esSup = esSuplente(jugador.id);
                      const cupoTit = CUPOS_TITULAR[pos] ?? 0;
                      const limiteSeleccion = jugadoresDe(jugador.seleccionId) >= 2;
                      const puedeSerTitular = !esTit && !esSup && titularesPorPos(pos).length < cupoTit && !limiteSeleccion;
                      const puedeSerSuplente = !esTit && !esSup && pos !== 'POR' && suplentesPorPos(pos).length < 1 && !limiteSeleccion;

                      return (
                        <div
                          key={jugador.id}
                          className={`fila-jugador${esTit ? ' es-titular' : ''}${esSup ? ' es-suplente' : ''}`}
                        >
                          <span className="jugador-nombre">{jugador.nombre}</span>
                          <div className="jugador-acciones">
                            {esTit && (
                              <button
                                className={`btn-copitan${porra.titular.find(j => j.id === jugador.id)?.esCopitan ? ' activo' : ''}`}
                                onClick={() => toggleCopitan(jugador.id)}
                                type="button"
                                title="Capitán"
                              >C</button>
                            )}
                            <button
                              className={`btn-rol titular${esTit ? ' activo' : ''}`}
                              onClick={() => toggleTitular(jugador)}
                              disabled={!esTit && !puedeSerTitular}
                              type="button"
                            >
                              {esTit ? '✓ Titular' : 'Titular'}
                            </button>
                            {pos !== 'POR' && (
                              <button
                                className={`btn-rol suplente${esSup ? ' activo' : ''}`}
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

        {/* ── Panel derecho: campo visual ──────────────────────────── */}
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
