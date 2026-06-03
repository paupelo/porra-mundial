import React from 'react';
import './Normas.css';

const seleccionesData = [
  {
    cat: 'Favoritos',
    emoji: '🔴',
    className: 'cat-favoritos',
    barClass: 'dot-favoritos',
    borderClass: 'border-favoritos',
    count: 3,
    victoria: 10,
    empate: 1,
    derrota: -20,
    noDeciseisvos: -100,
    noOctavos: -50,
    penaltis: 5,
    pasaRonda: 10,
    ganarMundial: 50,
  },
  {
    cat: 'Sorpresas',
    emoji: '🔵',
    className: 'cat-sorpresas',
    barClass: 'dot-sorpresas',
    borderClass: 'border-sorpresas',
    count: 4,
    victoria: 20,
    empate: 5,
    derrota: -10,
    noDeciseisvos: -50,
    noOctavos: -25,
    penaltis: 10,
    pasaRonda: 20,
    ganarMundial: 100,
  },
  {
    cat: 'Petardazos',
    emoji: '🟢',
    className: 'cat-petardazos',
    barClass: 'dot-petardazos',
    borderClass: 'border-petardazos',
    count: 4,
    victoria: 30,
    empate: 10,
    derrota: -5,
    noDeciseisvos: -25,
    noOctavos: -10,
    penaltis: 20,
    pasaRonda: 40,
    ganarMundial: 200,
  },
  {
    cat: 'Caca de la Vaca',
    emoji: '⚫',
    className: 'cat-caca',
    barClass: 'dot-caca',
    borderClass: 'border-caca',
    count: 3,
    victoria: 40,
    empate: 20,
    derrota: 0,
    noDeciseisvos: -10,
    noOctavos: 0,
    penaltis: 40,
    pasaRonda: 80,
    ganarMundial: 400,
  },
];

const jugadoresData = [
  {
    pos: '🧤 Portero',
    partido: 5,
    porteriaCero: 15,
    golEncajado: -5,
    penaltiParado: 30,
    gol: 50,
    asistencia: 50,
    extra: null,
  },
  {
    pos: '🛡 Defensa',
    partido: 5,
    porteriaCero: 10,
    golEncajado: -5,
    penaltiParado: null,
    gol: 30,
    asistencia: 20,
    extra: null,
  },
  {
    pos: '⚙️ Medio',
    partido: 5,
    porteriaCero: null,
    golEncajado: null,
    penaltiParado: null,
    gol: 25,
    asistencia: 15,
    extra: 'Doble asist. +40 · Hat-trick +90',
  },
  {
    pos: '⚽ Delantero',
    partido: 5,
    porteriaCero: null,
    golEncajado: null,
    penaltiParado: null,
    gol: 20,
    asistencia: 10,
    extra: 'Doblete +50 · Hat-trick +90',
  },
];

function ValCell({ val }) {
  if (val === null) return <td className="val-neutral">—</td>;
  if (val > 0) return <td className="val-pos">+{val}</td>;
  if (val < 0) return <td className="val-neg">{val}</td>;
  return <td className="val-zero">0</td>;
}

function SelVal({ val }) {
  if (val === null) return <td className="val-neutral">—</td>;
  if (val > 0) return <td className="val-pos">+{val}</td>;
  if (val < 0) return <td className="val-neg">{val}</td>;
  return <td className="val-zero">0</td>;
}

export default function Normas() {
  return (
    <div className="normas-page">

      {/* PAGE HERO */}
      <div className="normas-hero">
        <div className="normas-hero-badge">Reglamento Oficial</div>
        <h1>Las <span>Normas</span></h1>
        <p>Todo lo que necesitas saber para montar la porra y no llevarte una paliza épica.</p>
      </div>

      <div className="normas-content">

        {/* ===================== PRECIO ===================== */}
        <div className="nota-box nota-yellow" style={{ marginBottom: 32 }}>
          <span className="nota-icon">💶</span>
          <p className="nota-text">
            <strong>Inscripción: 25 €</strong> por porra. El bote total se reparte entre los primeros clasificados según las normas del grupo.
          </p>
        </div>

        {/* ===================== SECCIÓN 1: SELECCIONES ===================== */}
        <div className="normas-section">
          <div className="section-header">
            <span className="section-number">SECCIÓN 1</span>
            <div>
              <div className="section-title">Selecciones</div>
              <div className="section-subtitle">14 equipos + 1 Ganador del Mundial</div>
            </div>
          </div>

          {/* Categorías resumen */}
          <div className="cards-grid-4">
            {seleccionesData.map(c => (
              <div key={c.cat} className={`info-card ${c.borderClass}`}>
                <div className="info-card-header">
                  <span className="info-card-emoji">{c.emoji}</span>
                  <span className={`info-card-title ${c.className}`}>{c.cat}</span>
                </div>
                <div className="info-card-body">
                  <strong>{c.count} equipos</strong> a elegir
                </div>
              </div>
            ))}
          </div>

          {/* Nota Ganador */}
          <div className="nota-box nota-yellow">
            <span className="nota-icon">🏆</span>
            <p className="nota-text">
              <strong>Ganador del Mundial:</strong> elige 1 equipo como campeón. Todos sus puntos durante el torneo <strong>se multiplican por ×2</strong>. Puede ser de cualquier categoría.
            </p>
          </div>

          {/* Tabla puntuaciones */}
          <div className="table-wrap">
            <div className="table-label">Puntos por resultado · (con multiplicador de fase)</div>
            <table className="normas-table">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Victoria</th>
                  <th>Empate</th>
                  <th>Derrota</th>
                  <th>No 16avos</th>
                  <th>No Octavos</th>
                  <th>Ganar Pen.</th>
                  <th>Pasar Ronda</th>
                  <th>🏆 Ganar Mundial</th>
                </tr>
              </thead>
              <tbody>
                {seleccionesData.map(c => (
                  <tr key={c.cat}>
                    <td>
                      <div className="row-cat">
                        <div className={`row-cat-bar ${c.barClass}`} style={{ background: c.barClass === 'dot-favoritos' ? '#e63946' : c.barClass === 'dot-sorpresas' ? '#3b82f6' : c.barClass === 'dot-petardazos' ? '#22c55e' : '#9ca3af' }} />
                        <span className={c.className}>{c.emoji} {c.cat}</span>
                      </div>
                    </td>
                    <SelVal val={c.victoria} />
                    <SelVal val={c.empate} />
                    <SelVal val={c.derrota} />
                    <SelVal val={c.noDeciseisvos} />
                    <SelVal val={c.noOctavos} />
                    <SelVal val={c.penaltis} />
                    <SelVal val={c.pasaRonda} />
                    <td className="val-special">+{c.ganarMundial} 🔒</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Multiplicadores */}
          <div className="table-label" style={{ background: 'transparent', padding: '0 0 12px 0', border: 'none' }}>Multiplicadores por fase</div>
          <div className="mult-grid">
            <div className="mult-card">
              <div className="mult-phase">Grupos · 16avos · Octavos</div>
              <div className="mult-value"><span>×</span>1</div>
              <div className="mult-phases">Sin multiplicador</div>
            </div>
            <div className="mult-card">
              <div className="mult-phase">Cuartos</div>
              <div className="mult-value"><span>×</span>1,5</div>
              <div className="mult-phases">Bonus del 50%</div>
            </div>
            <div className="mult-card">
              <div className="mult-phase">Semifinales</div>
              <div className="mult-value"><span>×</span>2</div>
              <div className="mult-phases">Doble de puntos</div>
            </div>
            <div className="mult-card">
              <div className="mult-phase">Final</div>
              <div className="mult-value"><span>×</span>3</div>
              <div className="mult-phases">Triple de puntos</div>
            </div>
          </div>

          {/* Notas selecciones */}
          <div className="nota-box">
            <span className="nota-icon">🔒</span>
            <p className="nota-text">
              <strong>Ganar Mundial es un bonus fijo:</strong> no se multiplica por la fase. Los +50/+100/+200/+400 se suman directamente, sea cual sea el multiplicador activo en la final.
            </p>
          </div>
          <div className="nota-box nota-blue">
            <span className="nota-icon">🥅</span>
            <p className="nota-text">
              <strong>Tandas de penaltis:</strong> los penaltis cuentan como empate en el marcador. El equipo ganador suma los puntos de <strong>empate + bonus de Ganar Penaltis</strong>. El perdedor solo suma el empate.
            </p>
          </div>
        </div>

        <div className="normas-divider" />

        {/* ===================== SECCIÓN 2: JUGADORES ===================== */}
        <div className="normas-section">
          <div className="section-header">
            <span className="section-number">SECCIÓN 2</span>
            <div>
              <div className="section-title">Jugadores</div>
              <div className="section-subtitle">Once titular + 3 suplentes</div>
            </div>
          </div>

          {/* Formación */}
          <div className="formation-card">
            <div className="formation-diagram">
              <div className="f-row"><div className="f-player f-fwd">DEL</div><div className="f-player f-fwd">DEL</div><div className="f-player f-fwd">DEL</div></div>
              <div className="f-row"><div className="f-player f-mid">MED</div><div className="f-player f-mid">MED</div><div className="f-player f-mid">MED</div><div className="f-player f-mid">MED</div></div>
              <div className="f-row"><div className="f-player f-def">DEF</div><div className="f-player f-def">DEF</div><div className="f-player f-def">DEF</div></div>
              <div className="f-row"><div className="f-player f-gk">POR</div></div>
            </div>
            <div className="formation-rules">
              <h4>Reglas del once</h4>
              <ul>
                <li><span><strong>1</strong> Portero · <strong>3</strong> Defensas · <strong>4</strong> Medios · <strong>3</strong> Delanteros</span></li>
                <li><span>Mínimo <strong>2 Caca de la Vaca ⚫</strong>, <strong>2 Petardazos 🟢</strong> y <strong>3 Sorpresas 🔵</strong> en el once</span></li>
                <li><span><strong>Capitán:</strong> el jugador elegido como capitán puntúa <strong>el doble</strong></span></li>
                <li><span>Máximo <strong>2 jugadores de la misma selección</strong> en tu once (titulares + suplentes en conjunto)</span></li>
                <li><span><strong>3 suplentes</strong> (1 Defensa, 1 Medio, 1 Delantero). Máximo <strong>1 Favorito</strong> entre los suplentes</span></li>
                <li><span>Suplentes puntúan la <strong>mitad</strong> mientras su línea esté completa. Si un titular de esa línea es eliminado, el suplente entra y suma <strong>puntos completos</strong>.</span></li>
              </ul>
            </div>
          </div>

          {/* Tabla puntuaciones jugadores */}
          <div className="table-wrap">
            <div className="table-label">Puntos por acción · (Pasar Ronda lleva multiplicador de fase)</div>
            <table className="normas-table">
              <thead>
                <tr>
                  <th>Posición</th>
                  <th>Partido jugado</th>
                  <th>Portería a cero</th>
                  <th>Gol encajado</th>
                  <th>Penalti parado</th>
                  <th>Gol</th>
                  <th>Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {jugadoresData.map(j => (
                  <React.Fragment key={j.pos}>
                    <tr>
                      <td style={{ fontWeight: 800 }}>{j.pos}</td>
                      <ValCell val={j.partido} />
                      <ValCell val={j.porteriaCero} />
                      <ValCell val={j.golEncajado} />
                      <ValCell val={j.penaltiParado} />
                      <ValCell val={j.gol} />
                      <ValCell val={j.asistencia} />
                    </tr>
                    {j.extra && (
                      <tr>
                        <td colSpan={7} style={{ color: '#fbbf24', fontSize: '0.78rem', paddingTop: '4px', paddingBottom: '10px', fontStyle: 'italic' }}>
                          ✨ Bonus especiales: {j.extra}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pasar ronda jugadores */}
          <div className="nota-box nota-green">
            <span className="nota-icon">⬆️</span>
            <p className="nota-text">
              <strong>Pasar ronda (+15):</strong> cada jugador del once gana +15 puntos cuando su selección pasa a la siguiente fase. Estos 15 puntos <strong>sí llevan el multiplicador de fase</strong> (×1,5 en cuartos, ×2 en semis, ×3 en final).
            </p>
          </div>

          {/* Penalizaciones */}
          <div className="table-label" style={{ background: 'transparent', padding: '0 0 12px 0', border: 'none' }}>Penalizaciones</div>
          <div className="penal-grid">
            <div className="penal-card">
              <span className="penal-emoji">🦵</span>
              <span className="penal-label">Penalti cometido</span>
              <span className="penal-val val-neg">−15</span>
            </div>
            <div className="penal-card">
              <span className="penal-emoji">❌</span>
              <span className="penal-label">Penalti fallado</span>
              <span className="penal-val val-neg">−20</span>
            </div>
            <div className="penal-card">
              <span className="penal-emoji">🟥</span>
              <span className="penal-label">Tarjeta roja</span>
              <span className="penal-val val-neg">−20</span>
            </div>
            <div className="penal-card">
              <span className="penal-emoji">🥅</span>
              <span className="penal-label">Gol en propia meta</span>
              <span className="penal-val val-neg">−15</span>
            </div>
            <div className="penal-card">
              <span className="penal-emoji">🏆</span>
              <span className="penal-label">MVP del Mundial</span>
              <span className="penal-val val-pos">+50</span>
            </div>
            <div className="penal-card">
              <span className="penal-emoji">🦺</span>
              <span className="penal-label">Jugador de campo como portero</span>
              <span className="penal-val val-pos">+30</span>
            </div>
          </div>

          {/* Notas jugadores */}
          <div className="nota-box">
            <span className="nota-icon">🧤</span>
            <p className="nota-text">
              <strong>Portería a cero:</strong> requiere que el portero (o el jugador de campo que haga de portero) juegue <strong>60 minutos o más</strong>. Las tandas de penaltis no cuentan para la portería a cero.
            </p>
          </div>
          <div className="nota-box nota-blue">
            <span className="nota-icon">🦺</span>
            <p className="nota-text">
              <strong>Jugador de campo como portero:</strong> si un jugador de campo acaba el partido bajo palos (por expulsión o lesión del portero), suma <strong>+30 puntos de mérito</strong> adicionales, independientemente del resultado.
            </p>
          </div>
          <div className="nota-box nota-yellow">
            <span className="nota-icon">⭐</span>
            <p className="nota-text">
              <strong>MVP del Mundial:</strong> el jugador elegido mejor jugador del torneo suma <strong>+50 puntos fijos</strong> al marcador de su propietario. Bonus único, no se multiplica.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
