import React from 'react';
import { SELECCIONES, CATEGORIAS } from './datos';
import CampoFormacion from './CampoFormacion';

function getNombreSeleccion(id) {
  const sel = SELECCIONES.find(s => s.id === id);
  return sel ? `${sel.bandera} ${sel.nombre}` : id;
}

function getCatInfo(categoriaId) {
  return Object.values(CATEGORIAS).find(c => c.id === categoriaId);
}

function PasoRevision({ porra, onEnviar }) {
  const categorias = [
    { campo: 'favoritos', ...getCatInfo('favoritos') },
    { campo: 'sorpresas', ...getCatInfo('sorpresas') },
    { campo: 'petardazos', ...getCatInfo('petardazos') },
    { campo: 'cacaDeLaVaca', ...getCatInfo('cacaDeLaVaca') },
  ];

  const capitan = porra.titular.find(j => j.esCopitan);
  const selGanadora = SELECCIONES.find(s => s.id === porra.equipoGanador);

  return (
    <div className="paso-revision">
      <div className="revision-bloque">
        <h3>Mis equipos</h3>
        {categorias.map(cat => (
          <div key={cat.id} className="revision-categoria" style={{ '--color-cat': cat.color }}>
            <div className="revision-cat-titulo">
              <span>{cat.emoji} {cat.nombre}</span>
            </div>
            <div className="revision-equipos">
              {porra[cat.campo].map(id => (
                <span
                  key={id}
                  className={`revision-equipo ${porra.equipoGanador === id ? 'ganador' : ''}`}
                >
                  {getNombreSeleccion(id)}
                  {porra.equipoGanador === id && ' ★'}
                </span>
              ))}
            </div>
          </div>
        ))}
        {selGanadora && (
          <div className="revision-ganador">
            <strong>Campeón del mundo:</strong> {selGanadora.bandera} {selGanadora.nombre} ★
          </div>
        )}
      </div>

      <div className="revision-bloque">
        <h3>Mi 11 titular</h3>
        <CampoFormacion titular={porra.titular} suplentes={porra.suplentes} />
        {capitan && (
          <div className="revision-ganador" style={{ marginTop: '12px' }}>
            <strong>Capitán:</strong> {capitan.nombre} ©
          </div>
        )}
      </div>

      <button className="btn-enviar" onClick={onEnviar} type="button">
        Enviar mi Porra
      </button>
    </div>
  );
}

export default PasoRevision;
