import React from 'react';
import { SELECCIONES, CATEGORIAS } from './datos';
import TarjetaSeleccion from './TarjetaSeleccion';

function PasoSelecciones({ porra, setPorra }) {
  const totalElegidos =
    porra.favoritos.length + porra.sorpresas.length +
    porra.petardazos.length + porra.cacaDeLaVaca.length;
  const todosElegidos = totalElegidos === 14;

  function getCampo(categoriaId) {
    const mapa = {
      favoritos: 'favoritos',
      sorpresas: 'sorpresas',
      petardazos: 'petardazos',
      cacaDeLaVaca: 'cacaDeLaVaca',
    };
    return mapa[categoriaId];
  }

  function toggleSeleccion(seleccion) {
    const campo = getCampo(seleccion.categoria);
    const lista = porra[campo];
    const catInfo = Object.values(CATEGORIAS).find(c => c.id === seleccion.categoria);

    if (lista.includes(seleccion.id)) {
      // Deseleccionar — si era el ganador, limpiarlo también
      setPorra(prev => ({
        ...prev,
        [campo]: lista.filter(id => id !== seleccion.id),
        equipoGanador: prev.equipoGanador === seleccion.id ? null : prev.equipoGanador,
      }));
    } else {
      if (lista.length < catInfo.max) {
        setPorra(prev => ({ ...prev, [campo]: [...lista, seleccion.id] }));
      }
    }
  }

  function toggleGanador(seleccionId) {
    setPorra(prev => ({
      ...prev,
      equipoGanador: prev.equipoGanador === seleccionId ? null : seleccionId,
    }));
  }

  function isSeleccionada(seleccion) {
    return porra[getCampo(seleccion.categoria)]?.includes(seleccion.id);
  }

  function isDeshabilitada(seleccion) {
    const campo = getCampo(seleccion.categoria);
    const lista = porra[campo];
    const catInfo = Object.values(CATEGORIAS).find(c => c.id === seleccion.categoria);
    return lista.length >= catInfo.max && !lista.includes(seleccion.id);
  }

  const seleccionadasIds = [
    ...porra.favoritos, ...porra.sorpresas,
    ...porra.petardazos, ...porra.cacaDeLaVaca,
  ];

  return (
    <div className="paso-selecciones">
      {Object.values(CATEGORIAS).map(cat => {
        const equiposCat = SELECCIONES.filter(s => s.categoria === cat.id);
        const elegidosCat = porra[cat.id]?.length || 0;
        const completa = elegidosCat === cat.max;

        return (
          <div key={cat.id} className="bloque-categoria">
            <div className="categoria-header" style={{ '--color-cat': cat.color }}>
              <div className="categoria-titulo">
                <span className="categoria-emoji">{cat.emoji}</span>
                <span className="categoria-nombre">{cat.nombre}</span>
              </div>
              <span className={`categoria-contador ${completa ? 'completo' : ''}`}>
                {elegidosCat}/{cat.max}
              </span>
            </div>
            <div className="grid-selecciones">
              {equiposCat.map(sel => (
                <TarjetaSeleccion
                  key={sel.id}
                  seleccion={sel}
                  seleccionada={isSeleccionada(sel)}
                  deshabilitada={isDeshabilitada(sel)}
                  esGanadora={false}
                  onClick={() => toggleSeleccion(sel)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {todosElegidos && (
        <div className="seccion-ganador">
          <h3>¿Cuál será el campeón del mundo?</h3>
          <p>Elige uno de tus 14 equipos como ganador. Puntúa el doble.</p>
          <div className="grid-ganador">
            {seleccionadasIds.map(id => {
              const sel = SELECCIONES.find(s => s.id === id);
              if (!sel) return null;
              return (
                <TarjetaSeleccion
                  key={sel.id}
                  seleccion={sel}
                  seleccionada={porra.equipoGanador === sel.id}
                  esGanadora={porra.equipoGanador === sel.id}
                  onClick={() => toggleGanador(sel.id)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PasoSelecciones;
