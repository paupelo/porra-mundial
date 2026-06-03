import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';

const POS_ORDER = ['portero', 'defensa', 'medio', 'delantero'];
const POS_LABEL = { portero: '🧤 Porteros', defensa: '🛡 Defensas', medio: '⚙️ Medios', delantero: '⚽ Delanteros' };
const CAT_COLOR = { favoritos: '#b91c1c', sorpresas: '#1d4ed8', petardazos: '#15803d', caca: '#4b5563' };

export default function AdminJugadores() {
  const [porras,  setPorras]  = useState([]);
  const [players, setPlayers] = useState([]);
  const [teams,   setTeams]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGet('/admin/porras'), apiGet('/admin/players'), apiGet('/admin/teams')])
      .then(([p, pl, t]) => {
        setPorras(p.filter(pf => pf.porra.status === 'approved'));
        setPlayers(pl);
        setTeams(t);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="clas-loading">Cargando…</div>;

  const approved = porras;
  if (approved.length === 0) {
    return (
      <div>
        <h2>Jugadores</h2>
        <div className="admin-card" style={{ textAlign: 'center', padding: '40px 24px', color: '#9aa5b4' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>👥</p>
          <p>Aquí aparecerán los jugadores cuando haya porras aprobadas.</p>
        </div>
      </div>
    );
  }

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap   = Object.fromEntries(teams.map(t => [t.id, t]));

  // Agregar picks: player_id → { player, team, role más común, pickers }
  const playerPicks = {};
  for (const pf of approved) {
    for (const l of pf.lineup) {
      if (!playerPicks[l.player_id]) {
        const pl = playerMap[l.player_id];
        const tm = pl ? teamMap[pl.team_id] : null;
        playerPicks[l.player_id] = {
          player: pl,
          team: tm,
          position: pl?.position || l.position_slot,
          pickers: [],
        };
      }
      playerPicks[l.player_id].pickers.push({
        name: pf.participant.name,
        role: l.role,
        isCaptain: l.is_captain === 1,
      });
    }
  }

  // Agrupar por posición
  const byPos = {};
  for (const [pid, data] of Object.entries(playerPicks)) {
    const pos = data.position || 'medio';
    if (!byPos[pos]) byPos[pos] = [];
    byPos[pos].push({ pid, ...data });
  }
  for (const pos of Object.keys(byPos)) {
    byPos[pos].sort((a, b) => (b.pickers.length - a.pickers.length) || (a.player?.name || '').localeCompare(b.player?.name || ''));
  }

  return (
    <div>
      <h2>Jugadores elegidos</h2>
      <p style={{ color: '#6b7c93', fontSize: '0.85rem', marginBottom: 20 }}>
        Jugadores seleccionados en {approved.length} porra{approved.length !== 1 ? 's' : ''} aprobada{approved.length !== 1 ? 's' : ''}.
        Los puntos se actualizarán al recalcular.
      </p>

      {POS_ORDER.map(pos => {
        const items = byPos[pos];
        if (!items?.length) return null;
        return (
          <div key={pos} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#003DA5', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {POS_LABEL[pos]} — {items.length} jugador{items.length !== 1 ? 'es' : ''}
            </h3>
            <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Jugador</th>
                    <th>Selección</th>
                    <th>Elegido por</th>
                    <th style={{ textAlign: 'right' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ pid, player, team, pickers }) => {
                    const catColor = CAT_COLOR[team?.category] || '#6b7c93';
                    return (
                      <tr key={pid}>
                        <td style={{ fontWeight: 600 }}>{player?.name ?? pid.slice(0, 8) + '…'}</td>
                        <td>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: catColor }}>
                            {team?.name ?? '—'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {pickers.map((pk, i) => (
                              <span key={i} style={{
                                background: pk.role === 'titular' ? '#eff6ff' : '#f8fafc',
                                border: `1px solid ${pk.role === 'titular' ? '#bfdbfe' : '#e2e8f0'}`,
                                borderRadius: 6, padding: '1px 8px',
                                fontSize: '0.75rem', fontWeight: 600, color: '#374151',
                              }}>
                                {pk.name}
                                {pk.isCaptain ? ' ©' : ''}
                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: 3 }}>
                                  {pk.role === 'titular' ? 'TIT' : 'SUP'}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#003DA5' }}>0</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
