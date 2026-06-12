import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';
import './ResumenElegidos.css';

// Resumen de elegidos: todas las selecciones (y los jugadores elegidos)
// ordenados de más a menos populares entre las porras aprobadas, con quiénes
// los eligieron. Versión pública y visual de la agregación del panel admin.

const CAT_LABELS = { favoritos: 'Favoritos', sorpresas: 'Sorpresas', petardazos: 'Petardazos', caca: 'Caca de la Vaca' };
const POS_LABELS = { portero: '🧤 POR', defensa: '🛡 DEF', medio: '⚙️ MED', delantero: '⚽ DEL' };

function TarjetaResumen({ nombre, extraNombre, meta, count, maxCount, chips }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="res-card">
      <div className="res-card-header" onClick={() => setOpen(o => !o)}>
        <span className="res-nombre">{nombre} {extraNombre}</span>
        {meta}
        <span className="res-count">{count} {count === 1 ? 'porra' : 'porras'}</span>
        <span className="res-chevron">{open ? '▲' : '▼'}</span>
      </div>
      <div className="res-bar"><div style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }} /></div>
      {open && (
        count === 0
          ? <div className="res-body"><span className="res-vacio">Nadie lo ha elegido.</span></div>
          : <div className="res-body">{chips}</div>
      )}
    </div>
  );
}

export default function ResumenElegidos() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [seccion, setSeccion] = useState('selecciones');

  useEffect(() => {
    apiGet('/resumen-elegidos').then(setData).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="clas-empty"><p>⚠️ No se pudo cargar el resumen.</p></div>;
  if (!data) return <div className="clas-loading">Cargando resumen…</div>;

  const maxTeams = data.teams[0]?.count ?? 0;
  const maxPlayers = data.players[0]?.count ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['selecciones', `🏳️ Selecciones (${data.teams.length})`], ['jugadores', `👤 Jugadores (${data.players.length})`]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSeccion(id)}
            style={{
              padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8rem',
              border: seccion === id ? '1.5px solid #003DA5' : '1.5px solid #e2e8f0',
              background: seccion === id ? '#eff6ff' : '#fff',
              color: seccion === id ? '#003DA5' : '#64748b',
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ alignSelf: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
          sobre {data.totalPorras} porras · pulsa para ver quiénes
        </span>
      </div>

      {seccion === 'selecciones' && data.teams.map(t => (
        <TarjetaResumen
          key={t.team_id}
          nombre={t.team_name}
          meta={<span className={`sel-cat cat-${t.category}`}>{CAT_LABELS[t.category] ?? t.category}</span>}
          count={t.count}
          maxCount={maxTeams}
          chips={t.pickers.map((p, i) => (
            <span key={i} className={`res-chip${p.is_winner ? ' ganador' : ''}`} title={p.is_winner ? 'Lo eligió como Ganador del Mundial' : undefined}>
              {p.name}{p.is_winner ? ' ⭐ GANADOR' : ''}
            </span>
          ))}
        />
      ))}

      {seccion === 'jugadores' && data.players.map(j => (
        <TarjetaResumen
          key={j.player_id}
          nombre={j.player_name}
          extraNombre={<span className="res-meta">· {j.team_name}</span>}
          meta={<span className="jugador-pos">{POS_LABELS[j.position] ?? j.position}</span>}
          count={j.count}
          maxCount={maxPlayers}
          chips={j.pickers.map((p, i) => (
            <span key={i} className="res-chip">
              {p.name}{p.is_captain ? ' ⭐CAP' : ''}{p.role === 'suplente' ? ' (supl.)' : ''}
            </span>
          ))}
        />
      ))}
    </div>
  );
}
