import React, { useState } from 'react';
import { SELECCIONES, CATEGORIAS } from './datos';
import CampoFormacion from './CampoFormacion';

// 11 junio 2026 19:00 hora de Madrid (UTC+2 en verano)
const DEADLINE = new Date('2026-06-11T17:00:00Z');

function esCerrada() {
  return new Date() > DEADLINE;
}

function getNombreSeleccion(id) {
  const sel = SELECCIONES.find(s => s.id === id);
  return sel ? `${sel.bandera} ${sel.nombre}` : id;
}

function getCatInfo(categoriaId) {
  return Object.values(CATEGORIAS).find(c => c.id === categoriaId);
}

function PasoRevision({ porra, onEnviar }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [aviso, setAviso] = useState(''); // warning no bloqueante
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cerrada = esCerrada();

  const categorias = [
    { campo: 'favoritos', ...getCatInfo('favoritos') },
    { campo: 'sorpresas', ...getCatInfo('sorpresas') },
    { campo: 'petardazos', ...getCatInfo('petardazos') },
    { campo: 'cacaDeLaVaca', ...getCatInfo('cacaDeLaVaca') },
  ];

  const capitan = porra.titular.find(j => j.esCopitan);
  const selGanadora = SELECCIONES.find(s => s.id === porra.equipoGanador);

  async function checkEmail(emailValue) {
    if (!emailValue || !emailValue.includes('@')) return;
    try {
      const r = await fetch(`/api/submit/check?email=${encodeURIComponent(emailValue)}`);
      const data = await r.json();
      if (data.emailCount >= 2) {
        setError('Este email ya tiene 2 porras registradas. No se pueden enviar más.');
      } else if (data.emailCount === 1) {
        setError('');
        setAviso('Este email ya tiene una porra registrada. Esta será tu segunda y última apuesta.');
      } else {
        setError('');
        setAviso('');
      }
    } catch {
      // Si falla el check, dejamos pasar — el backend validará igualmente
    }
  }

  async function handleEnviar() {
    setError('');

    if (!nombre.trim()) { setError('Introduce tu nombre o apodo.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Introduce un email válido.'); return; }

    setEnviando(true);
    try {
      const r = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          email: email.trim(),
          selections: [
            ...porra.favoritos.map(id => ({ team_id: id, is_winner: id === porra.equipoGanador })),
            ...porra.sorpresas.map(id => ({ team_id: id, is_winner: id === porra.equipoGanador })),
            ...porra.petardazos.map(id => ({ team_id: id, is_winner: id === porra.equipoGanador })),
            ...porra.cacaDeLaVaca.map(id => ({ team_id: id, is_winner: id === porra.equipoGanador })),
          ],
          lineup: [
            ...porra.titular.map(j => ({
              player_id: j.id,
              role: 'titular',
              position_slot: mapPos(j.posicion),
              is_captain: j.esCopitan ? 1 : 0,
            })),
            ...porra.suplentes.map(j => ({
              player_id: j.id,
              role: 'suplente',
              position_slot: mapPos(j.posicion),
              is_captain: 0,
            })),
          ],
        }),
      });

      const data = await r.json();

      if (!r.ok) {
        if (data.error === 'name_conflict') setError(data.message);
        else if (data.error === 'email_limit') setError(data.message);
        else setError(data.error ?? 'Error al enviar la porra. Inténtalo de nuevo.');
        return;
      }

      onEnviar({ nombre: nombre.trim(), email: email.trim(), porraId: data.porraId });
    } catch {
      setError('No se pudo conectar con el servidor. Comprueba tu conexión.');
    } finally {
      setEnviando(false);
    }
  }

  if (cerrada) {
    return (
      <div className="porra-cerrada">
        <div className="porra-cerrada-icono">🔒</div>
        <h3>El plazo de inscripción ha cerrado</h3>
        <p>La porra cerró el 11 de junio de 2026 a las 19:00 (hora de España).</p>
        <p>Puedes ver la clasificación en la pestaña correspondiente.</p>
      </div>
    );
  }

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

      <div className="revision-bloque revision-envio">
        <h3>Tus datos</h3>
        <p className="revision-envio-desc">
          Introduce el nombre con el que aparecerás en la clasificación y tu email. No se publicará.
        </p>
        <div className="envio-campos">
          <div className="envio-campo">
            <label htmlFor="envio-nombre">Nombre / apodo</label>
            <input
              id="envio-nombre"
              type="text"
              placeholder="Ej: Juanito, El Crack, Spike..."
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError(''); }}
              maxLength={40}
              disabled={enviando}
            />
          </div>
          <div className="envio-campo">
            <label htmlFor="envio-email">Email</label>
            <input
              id="envio-email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); setAviso(''); }}
              onBlur={e => checkEmail(e.target.value)}
              disabled={enviando}
            />
          </div>
        </div>

        {aviso && <div className="envio-aviso">{aviso}</div>}
        {error && <div className="envio-error">{error}</div>}

        <button
          className="btn-enviar"
          onClick={handleEnviar}
          disabled={enviando || !!error}
          type="button"
        >
          {enviando ? 'Enviando…' : 'Confirmar y enviar mi Porra'}
        </button>
      </div>
    </div>
  );
}

function mapPos(pos) {
  return { POR: 'portero', DEF: 'defensa', MED: 'medio', DEL: 'delantero' }[pos] ?? 'medio';
}

export default PasoRevision;
