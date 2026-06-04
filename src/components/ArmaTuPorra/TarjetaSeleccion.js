import React from 'react';
import { CATEGORIAS } from './datos';
import BanderaImg from './BanderaImg';

// Tarjeta clicable para una selección. Cambia aspecto según si está seleccionada.
function TarjetaSeleccion({ seleccion, seleccionada, onClick, deshabilitada, esGanadora }) {
  const categoria = Object.values(CATEGORIAS).find(c => c.id === seleccion.categoria);
  const color = categoria?.color || '#003DA5';
  const colorClaro = categoria?.colorClaro || '#f0f4fb';

  return (
    <button
      className={`tarjeta-seleccion ${seleccionada ? 'seleccionada' : ''} ${deshabilitada ? 'deshabilitada' : ''} ${esGanadora ? 'ganadora' : ''}`}
      style={{
        '--color-cat': color,
        '--color-cat-claro': colorClaro,
      }}
      onClick={onClick}
      disabled={deshabilitada && !seleccionada}
      type="button"
    >
      <span className="tarjeta-bandera">
        <BanderaImg codigo={seleccion.codigo} nombre={seleccion.nombre} />
      </span>
      <span className="tarjeta-nombre">{seleccion.nombre}</span>
      {esGanadora && <span className="tarjeta-ganadora-badge">★ Ganador</span>}
      {seleccionada && !esGanadora && <span className="tarjeta-check">✓</span>}
    </button>
  );
}

export default TarjetaSeleccion;
