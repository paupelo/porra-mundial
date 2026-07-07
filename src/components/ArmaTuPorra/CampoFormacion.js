import React from 'react';
import { SELECCIONES, CATEGORIAS } from './datos';

/**
 * Formación 1-3-4-3  —  DEL arriba, POR abajo
 * viewBox: "0 0 300 460"
 * Campo:   rect(15, 20, 270, 420)  →  y: 20…440, x: 15…285
 */
const SLOTS = [
  { pos: 'DEL', idx: 0, cx: 83,  cy: 130 },
  { pos: 'DEL', idx: 1, cx: 150, cy: 130 },
  { pos: 'DEL', idx: 2, cx: 217, cy: 130 },
  { pos: 'MED', idx: 0, cx: 69,  cy: 230 },
  { pos: 'MED', idx: 1, cx: 123, cy: 230 },
  { pos: 'MED', idx: 2, cx: 177, cy: 230 },
  { pos: 'MED', idx: 3, cx: 231, cy: 230 },
  { pos: 'DEF', idx: 0, cx: 83,  cy: 328 },
  { pos: 'DEF', idx: 1, cx: 150, cy: 328 },
  { pos: 'DEF', idx: 2, cx: 217, cy: 328 },
  { pos: 'POR', idx: 0, cx: 150, cy: 390 },
];

const SUP_CONFIG = [
  { pos: 'DEF', label: 'DEF' },
  { pos: 'MED', label: 'MED' },
  { pos: 'DEL', label: 'DEL' },
];

function getCategoria(seleccionId) {
  return SELECCIONES.find(s => s.id === seleccionId)?.categoria ?? null;
}

function getCatColor(cat) {
  return Object.values(CATEGORIAS).find(c => c.id === cat)?.color ?? '#003DA5';
}

function selInfo(id) {
  return SELECCIONES.find(s => s.id === id);
}

/** Círculo de jugador o placeholder vacío */
function SlotJugador({ slot, jugador, onRemove, eliminado }) {
  const info      = jugador ? selInfo(jugador.seleccionId) : null;
  const cat       = jugador ? getCategoria(jugador.seleccionId) : null;
  const color     = cat ? getCatColor(cat) : null;
  const apellido  = jugador
    ? jugador.nombre.split(' ').pop().slice(0, 9).toUpperCase()
    : null;

  if (!jugador) {
    return (
      <g>
        <circle
          cx={slot.cx} cy={slot.cy} r="21"
          fill="rgba(255,255,255,0.10)"
          stroke="rgba(255,255,255,0.40)"
          strokeWidth="1.5"
          strokeDasharray="5 3"
        />
        <text
          x={slot.cx} y={slot.cy + 4}
          textAnchor="middle"
          fontSize="9" fontWeight="700"
          fill="rgba(255,255,255,0.55)"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {slot.pos}
        </text>
      </g>
    );
  }

  const clickable = !!onRemove;

  return (
    <g
      onClick={clickable ? () => onRemove(jugador) : undefined}
      style={clickable ? { cursor: 'pointer' } : {}}
      role={clickable ? 'button' : undefined}
      aria-label={clickable ? `Quitar ${jugador.nombre}` : undefined}
      // Ficha sombreada si su selección está eliminada del torneo
      opacity={eliminado ? 0.35 : undefined}
    >
      {/* Sombra */}
      <circle cx={slot.cx + 1} cy={slot.cy + 2} r="21" fill="rgba(0,0,0,0.28)" />
      {/* Círculo coloreado */}
      <circle cx={slot.cx} cy={slot.cy} r="21" fill={color} stroke="white" strokeWidth="2" />
      {/* Anillo interior — ✕ si es clickable */}
      {clickable
        ? <text x={slot.cx} y={slot.cy - 2} textAnchor="middle" fontSize="10" fontWeight="900" fill="rgba(255,255,255,0.0)" className="cf-remove-hint">✕</text>
        : <circle cx={slot.cx} cy={slot.cy} r="19" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      }
      {/* Bandera */}
      {info?.codigo && (
        <image
          href={`https://flagcdn.com/w20/${info.codigo}.png`}
          x={slot.cx - 10} y={slot.cy - 16}
          width="20" height="15"
        />
      )}
      {/* Apellido */}
      <text
        x={slot.cx} y={slot.cy + 13}
        textAnchor="middle"
        fontSize="6.5" fontWeight="800"
        fill="white"
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="0.4"
      >
        {apellido}
      </text>
      {/* Capitán */}
      {jugador.esCopitan && (
        <text
          x={slot.cx + 17} y={slot.cy - 14}
          fontSize="13" fontWeight="900"
          fill="#f5a623"
        >©</text>
      )}
    </g>
  );
}

/**
 * Renderiza el campo de fútbol SVG (formación 1-3-4-3) + fila de suplentes.
 * Componente único compartido entre PasoAlineacion (Paso 2) y PasoRevision (Paso 3).
 *
 * Props:
 *   titular  — [{id, nombre, posicion, seleccionId, esCopitan}]
 *   suplentes — mismo formato
 *   eliminados — Set opcional de seleccionId eliminadas del torneo (sombrea sus fichas)
 */
function CampoFormacion({ titular, suplentes, onRemoveTitular, onRemoveSuplente, eliminados }) {
  const byPos    = pos => titular.filter(j => j.posicion === pos);
  const supByPos = pos => suplentes.find(j => j.posicion === pos) ?? null;

  return (
    <div className="cf-wrapper">
      <svg
        viewBox="0 0 300 460"
        className="cf-svg"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Campo de fútbol con la alineación"
      >
        <defs>
          {/* Gradiente de césped */}
          <linearGradient id="cf-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1e7020" />
            <stop offset="48%"  stopColor="#23782a" />
            <stop offset="52%"  stopColor="#1e6b1e" />
            <stop offset="100%" stopColor="#185218" />
          </linearGradient>
          {/* Filtro sombra para fichas */}
          <filter id="cf-drop" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* ─── Fondo exterior ─── */}
        <rect width="300" height="460" fill="#164d16" rx="10"/>

        {/* ─── Campo verde ─── */}
        <rect x="15" y="20" width="270" height="420" fill="url(#cf-grass)" rx="3"/>

        {/* Franjas de césped alternas */}
        {[0,1,2,3,4,5].map(i => (
          <rect
            key={i}
            x="15" y={20 + i * 70}
            width="270" height="35"
            fill="rgba(0,0,0,0.04)"
          />
        ))}

        {/* ─── Líneas del campo ─── */}
        {/* Borde exterior */}
        <rect
          x="15" y="20" width="270" height="420"
          fill="none"
          stroke="rgba(255,255,255,0.88)" strokeWidth="2"
        />

        {/* ── Portería arriba (rival) ── */}
        <rect
          x="112" y="6" width="76" height="16"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* ── Área grande arriba ── */}
        <rect
          x="70" y="20" width="160" height="66"
          fill="none"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* ── Área pequeña arriba ── */}
        <rect
          x="114" y="20" width="72" height="22"
          fill="none"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* Punto penalti arriba */}
        <circle cx="150" cy="64" r="2.5" fill="rgba(255,255,255,0.88)"/>

        {/* Semicírculo del área arriba (sale hacia el centro del campo) */}
        <path
          d="M 120 86 A 37 37 0 0 0 180 86"
          fill="none"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* ── Línea de centro ── */}
        <line
          x1="15" y1="230" x2="285" y2="230"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* ── Círculo central ── */}
        <circle
          cx="150" cy="230" r="37"
          fill="none"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />
        <circle cx="150" cy="230" r="2.5" fill="rgba(255,255,255,0.88)"/>

        {/* ── Área grande abajo ── */}
        <rect
          x="70" y="374" width="160" height="66"
          fill="none"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* ── Área pequeña abajo ── */}
        <rect
          x="114" y="418" width="72" height="22"
          fill="none"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* Punto penalti abajo */}
        <circle cx="150" cy="396" r="2.5" fill="rgba(255,255,255,0.88)"/>

        {/* Semicírculo del área abajo (sale hacia el centro del campo) */}
        <path
          d="M 120 374 A 37 37 0 0 1 180 374"
          fill="none"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* ── Portería abajo (propia) ── */}
        <rect
          x="112" y="438" width="76" height="16"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.88)" strokeWidth="1.5"
        />

        {/* ─── Fichas de jugadores ─── */}
        {SLOTS.map(slot => {
          const jugador = byPos(slot.pos)[slot.idx] ?? null;
          return (
            <SlotJugador
              key={`${slot.pos}-${slot.idx}`}
              slot={slot}
              jugador={jugador}
              onRemove={onRemoveTitular}
              eliminado={!!(jugador && eliminados?.has(jugador.seleccionId))}
            />
          );
        })}
      </svg>

      {/* ─── Fila de suplentes ─── */}
      <div className="cf-suplentes">
        <p className="cf-suplentes-titulo">Suplentes</p>
        <div className="cf-suplentes-fila">
          {SUP_CONFIG.map(({ pos, label }) => {
            const jug    = supByPos(pos);
            const info   = jug ? selInfo(jug.seleccionId) : null;
            const cat    = jug ? getCategoria(jug.seleccionId) : null;
            const color  = cat ? getCatColor(cat) : null;
            const apellido = jug
              ? jug.nombre.split(' ').pop().slice(0, 9).toUpperCase()
              : null;
            const elim = !!(jug && eliminados?.has(jug.seleccionId));

            return (
              <div
                key={pos}
                className={`cf-sup-chip ${jug ? 'cf-sup-chip--lleno' : 'cf-sup-chip--vacio'}`}
                style={{
                  ...(color ? { '--cf-color': color } : {}),
                  // Chip sombreado si su selección está eliminada del torneo
                  ...(elim ? { opacity: 0.45, filter: 'grayscale(0.6)' } : {}),
                }}
                onClick={jug && onRemoveSuplente ? () => onRemoveSuplente(jug) : undefined}
                title={jug && onRemoveSuplente ? `Quitar ${jug.nombre}` : undefined}
              >
                {jug ? (
                  <>
                    <span className="cf-sup-bandera">
                      {info?.codigo && <img src={`https://flagcdn.com/w20/${info.codigo}.png`} width="20" height="15" alt={info.nombre} style={{ verticalAlign: 'middle' }} />}
                    </span>
                    <span className="cf-sup-nombre">{apellido}</span>
                    <span className="cf-sup-pos">{jug.posicion}</span>
                    {onRemoveSuplente && <span className="cf-sup-remove">✕</span>}
                  </>
                ) : (
                  <>
                    <span className="cf-sup-vacio-pos">{label}</span>
                    <span className="cf-sup-vacio-sub">suplente</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CampoFormacion;
