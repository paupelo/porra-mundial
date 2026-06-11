import React, { useState } from 'react';
import AdminSelecciones from './AdminSelecciones';
import AdminJugadores from './AdminJugadores';
import AdminPartidos from './AdminPartidos';
import AdminEventos from './AdminEventos';
import AdminResultados from './AdminResultados';
import AdminParticipantes from './AdminParticipantes';
import AdminPorras from './AdminPorras';
import { apiPost } from '../../hooks/useApi';
import './Admin.css';

const SECTIONS = [
  { id: 'selecciones',  label: 'Selecciones',   icon: '🏳️' },
  { id: 'jugadores',    label: 'Jugadores',      icon: '👤' },
  { id: 'partidos',     label: 'Partidos',       icon: '⚽' },
  { id: 'eventos',      label: 'Eventos',        icon: '📋' },
  { id: 'resultados',   label: 'Resultados y eventos', icon: '📡' },
  { id: 'participantes',label: 'Participantes',  icon: '👥' },
  { id: 'porras',       label: 'Porras',         icon: '📝' },
];

export default function AdminDashboard({ onLogout }) {
  const [section, setSection] = useState('selecciones');
  const [recalcMsg, setRecalcMsg] = useState('');
  const [recalcLoading, setRecalcLoading] = useState(false);

  async function handleRecalcular() {
    setRecalcLoading(true); setRecalcMsg('');
    try {
      const r = await apiPost('/admin/recalcular', {});
      setRecalcMsg(`✓ Recalculado: ${r.recalculated} porras`);
    } catch (e) {
      setRecalcMsg(`Error: ${e.message}`);
    } finally {
      setRecalcLoading(false);
    }
  }

  const views = {
    selecciones:   <AdminSelecciones />,
    jugadores:     <AdminJugadores />,
    partidos:      <AdminPartidos />,
    eventos:       <AdminEventos />,
    resultados:    <AdminResultados />,
    participantes: <AdminParticipantes />,
    porras:        <AdminPorras />,
  };

  return (
    <div className="admin-layout">
      <nav className="admin-sidebar">
        <div className="logo">⚽ Admin</div>
        <h3>Gestión</h3>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`sidebar-link${section === s.id ? ' active' : ''}`}
            onClick={() => setSection(s.id)}
          >
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
        <div className="sidebar-spacer" />
        <div className="sidebar-logout">
          <button className="sidebar-link" onClick={onLogout} style={{ color: 'rgba(255,255,255,0.5)' }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="admin-main">
        <div className="recalc-banner">
          <div>
            <h3>Recalcular clasificación</h3>
            <p>Aplica todos los eventos confirmados y actualiza el ranking.</p>
            {recalcMsg && <p style={{ fontWeight: 700, marginTop: 6 }}>{recalcMsg}</p>}
          </div>
          <button className="btn btn-primary" onClick={handleRecalcular} disabled={recalcLoading}>
            {recalcLoading ? '…' : '↺ Recalcular'}
          </button>
        </div>

        {views[section]}
      </main>
    </div>
  );
}
