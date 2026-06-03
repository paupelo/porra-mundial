import React, { useState, useEffect } from 'react';
import { apiGet } from '../../hooks/useApi';

const CAT_LABEL  = { favoritos: 'Favoritos 🔴', sorpresas: 'Sorpresas 🔵', petardazos: 'Petardazos 🟢', caca: 'Caca de la Vaca ⚫' };
const CAT_COLOR  = { favoritos: '#b91c1c', sorpresas: '#1d4ed8', petardazos: '#15803d', caca: '#4b5563' };
const CAT_ORDER  = ['favoritos', 'sorpresas', 'petardazos', 'caca'];

export default function AdminSelecciones() {
  const [porras,  setPorras]  = useState([]);
  const [teams,   setTeams]   = useState([]);
  const [scores,  setScores]  = useState({}); // porraId → breakdown
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGet('/admin/porras'), apiGet('/admin/teams')])
      .then(([p, t]) => {
        setPorras(p.filter(pf => pf.porra.status === 'approved'));
        setTeams(t);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="clas-loading">Cargando…</div>;

  const approved = porras;
  if (approved.length === 0) {
    return (
      <div>
        <h2>Selecciones</h2>
        <div className="admin-card" style={{ textAlign: 'center', padding: '40px 24px', color: '#9aa5b4' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>📋</p>
          <p>Aquí aparecerán las selecciones cuando haya porras aprobadas.</p>
        </div>
      </div>
    );
  }

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  // Agregar picks: team_id → { team, participants: [{name, isWinner}], pts }
  const teamPicks = {};
  for (const pf of approved) {
    for (const s of pf.selections) {
      if (!teamPicks[s.team_id]) teamPicks[s.team_id] = { team: teamMap[s.team_id], pickers: [] };
      teamPicks[s.team_id].pickers.push({ name: pf.participant.name, isWinner: !!s.is_winner });
    }
  }

  // Agrupar por categoría
  const byCat = {};
  for (const [tid, data] of Object.entries(teamPicks)) {
    const cat = data.team?.category || 'caca';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push({ tid, ...data });
  }
  for (const cat of Object.keys(byCat)) {
    byCat[cat].sort((a, b) => (b.pickers.length - a.pickers.length) || (a.team?.name || '').localeCompare(b.team?.name || ''));
  }

  return (
    <div>
      <h2>Selecciones elegidas</h2>
      <p style={{ color: '#6b7c93', fontSize: '0.85rem', marginBottom: 20 }}>
        Equipos seleccionados en {approved.length} porra{approved.length !== 1 ? 's' : ''} aprobada{approved.length !== 1 ? 's' : ''}.
        Los puntos se actualizarán al recalcular.
      </p>

      {CAT_ORDER.map(cat => {
        const items = byCat[cat];
        if (!items?.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: CAT_COLOR[cat], marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {CAT_LABEL[cat]} — {items.length} equipo{items.length !== 1 ? 's' : ''}
            </h3>
            <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Elegido por</th>
                    <th>¿Campeón?</th>
                    <th style={{ textAlign: 'right' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ tid, team, pickers }) => {
                    const winners = pickers.filter(p => p.isWinner);
                    return (
                      <tr key={tid}>
                        <td style={{ fontWeight: 600 }}>{team?.name ?? tid}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {pickers.map(pk => (
                              <span key={pk.name} style={{
                                background: '#f1f5f9', borderRadius: 6, padding: '1px 8px',
                                fontSize: '0.75rem', fontWeight: 600, color: '#374151',
                              }}>{pk.name}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          {winners.length > 0
                            ? <span style={{ color: '#d97706', fontWeight: 700, fontSize: '0.82rem' }}>
                                ⭐ {winners.map(w => w.name).join(', ')}
                              </span>
                            : <span style={{ color: '#9aa5b4', fontSize: '0.82rem' }}>—</span>
                          }
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
