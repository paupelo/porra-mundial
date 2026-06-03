import React, { useState } from 'react';
import { porraVacia, SELECCIONES, CATEGORIAS } from './datos';
import { validarAlineacion } from './PasoAlineacion';
import PasoSelecciones from './PasoSelecciones';
import PasoAlineacion from './PasoAlineacion';
import PasoRevision from './PasoRevision';
import CampoFormacion from './CampoFormacion';
import './ArmaTuPorra.css';

const PASOS = ['Elige equipos', 'Arma tu 11', 'Revisión'];

function puedeAvanzarPaso1(porra) {
  return (
    porra.favoritos.length === 3 &&
    porra.sorpresas.length === 4 &&
    porra.petardazos.length === 4 &&
    porra.cacaDeLaVaca.length === 3 &&
    porra.equipoGanador !== null
  );
}

function puedeAvanzarPaso2(porra) {
  return validarAlineacion(porra).length === 0;
}

function ArmaTuPorra() {
  const [paso, setPaso] = useState(0);
  const [porra, setPorra] = useState(porraVacia());
  const [enviada, setEnviada] = useState(null); // null | { nombre, email, porraId }

  function avanzar() {
    if (paso < PASOS.length - 1) setPaso(p => p + 1);
  }

  function retroceder() {
    if (paso > 0) setPaso(p => p - 1);
  }

  function handleEnviar(datos) {
    setEnviada(datos);
  }

  const puedeAvanzar =
    (paso === 0 && puedeAvanzarPaso1(porra)) ||
    (paso === 1 && puedeAvanzarPaso2(porra));

  if (enviada) {
    return <ResumenPorra enviada={enviada} porra={porra} />;
  }

  return (
    <div className="arma-porra">
      <div className="arma-porra-header">
        <h1>Arma tu Porra</h1>
        <p>Sigue los pasos para configurar tu participación en la porra del Mundial 2026</p>
      </div>

      {/* Indicador de pasos */}
      <div className="pasos-indicador">
        {PASOS.map((nombre, i) => (
          <div key={i} className={`paso-item ${i === paso ? 'activo' : ''} ${i < paso ? 'completado' : ''}`}>
            <div className="paso-numero">{i < paso ? '✓' : i + 1}</div>
            <span className="paso-nombre">{nombre}</span>
            {i < PASOS.length - 1 && <div className={`paso-linea ${i < paso ? 'completada' : ''}`} />}
          </div>
        ))}
      </div>

      {/* Contenido del paso actual */}
      <div className="paso-contenido">
        {paso === 0 && <PasoSelecciones porra={porra} setPorra={setPorra} />}
        {paso === 1 && <PasoAlineacion porra={porra} setPorra={setPorra} />}
        {paso === 2 && <PasoRevision porra={porra} onEnviar={handleEnviar} />}
      </div>

      {/* Navegación */}
      <div className="pasos-nav">
        {paso > 0 && (
          <button className="btn-nav anterior" onClick={retroceder} type="button">
            ← Anterior
          </button>
        )}
        {paso < PASOS.length - 1 && (
          <button
            className={`btn-nav siguiente ${puedeAvanzar ? '' : 'bloqueado'}`}
            onClick={avanzar}
            disabled={!puedeAvanzar}
            type="button"
          >
            Siguiente →
          </button>
        )}
      </div>

      {/* Mensaje de validación si no puede avanzar */}
      {!puedeAvanzar && paso === 0 && (
        <p className="nav-aviso">
          Elige exactamente 3 Favoritos, 4 Sorpresas, 4 Petardazos, 3 Caca de la Vaca y un Ganador para continuar.
        </p>
      )}
      {!puedeAvanzar && paso === 1 && (
        <p className="nav-aviso">
          Completa las validaciones del 11 para continuar.
        </p>
      )}
    </div>
  );
}

export default ArmaTuPorra;

const CAT_ORDER = ['favoritos', 'sorpresas', 'petardazos', 'cacaDeLaVaca'];

function ResumenPorra({ enviada, porra }) {
  const catInfo = id => Object.values(CATEGORIAS).find(c => c.id === id);
  const selInfo = id => SELECCIONES.find(s => s.id === id);

  return (
    <div className="resumen-enviada">
      {/* Cabecera */}
      <div className="resumen-header">
        <div className="resumen-check">✓</div>
        <h2>¡Porra enviada!</h2>
        <p className="resumen-sub">
          <strong>{enviada.nombre}</strong> — pendiente de aprobación por el admin.
        </p>
        <div className="resumen-screenshot-aviso">
          📸 Sácale un screenshot y guarda tu porra
        </div>
        <div className="resumen-bizum-aviso">
          💸 Envía un Bizum de <strong>25€</strong> a <strong>Txema</strong> (<strong>635 730 158</strong>) y tu porra será aprobada
        </div>
      </div>

      <div className="resumen-body">
        {/* Selecciones */}
        <div className="resumen-bloque">
          <h3>Mis equipos</h3>
          {CAT_ORDER.map(catId => {
            const cat = catInfo(catId);
            const equipos = porra[catId] ?? [];
            if (!equipos.length) return null;
            return (
              <div key={catId} className="resumen-cat-fila" style={{ '--cat-color': cat?.color }}>
                <span className="resumen-cat-label">{cat?.emoji} {cat?.nombre}</span>
                <div className="resumen-equipos-lista">
                  {equipos.map(id => {
                    const s = selInfo(id);
                    return (
                      <span
                        key={id}
                        className={`resumen-equipo-chip${porra.equipoGanador === id ? ' ganador' : ''}`}
                      >
                        {s?.bandera} {s?.nombre}{porra.equipoGanador === id ? ' ⭐' : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Campo */}
        <div className="resumen-bloque">
          <h3>Mi 11</h3>
          <div className="resumen-campo">
            <CampoFormacion titular={porra.titular} suplentes={porra.suplentes} />
          </div>
          {porra.titular.find(j => j.esCopitan) && (
            <p className="resumen-capitan">
              Capitán: <strong>{porra.titular.find(j => j.esCopitan).nombre}</strong> ©
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
