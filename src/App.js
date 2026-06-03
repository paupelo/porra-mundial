import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import ArmaTuPorra from './components/ArmaTuPorra/ArmaTuPorra';
import Normas from './components/Normas/Normas';
import Clasificacion from './components/Clasificacion/Clasificacion';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import './App.css';

function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  if (!token) return <AdminLogin onLogin={setToken} />;
  return <AdminDashboard onLogout={() => { localStorage.removeItem('admin_token'); setToken(null); }} />;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Panel de admin sin header público */}
        <Route path="/admin/*" element={<AdminPanel />} />

        {/* Rutas públicas con header */}
        <Route path="/*" element={
          <div className="App">
            <header className="app-header">
              <div className="header-logo">
                <img src="/Logo_Mundial.png" alt="Mundial 2026" className="logo-icon" />
                <span className="header-title">Porra Mundial 2026</span>
              </div>
              <nav>
                <NavLink to="/" end>Inicio</NavLink>
                <NavLink to="/arma-tu-porra">Arma tu Porra</NavLink>
                <NavLink to="/clasificacion">Clasificación</NavLink>
                <NavLink to="/normas">Normas</NavLink>
              </nav>
            </header>
            <main>
              <Routes>
                <Route path="/"              element={<Inicio />} />
                <Route path="/arma-tu-porra" element={<ArmaTuPorra />} />
                <Route path="/clasificacion" element={<Clasificacion />} />
                <Route path="/normas"        element={<Normas />} />
              </Routes>
            </main>
          </div>
        } />
      </Routes>
    </Router>
  );
}

function Inicio() {
  const navigate = useNavigate();
  return (
    <div className="inicio">
      <div className="hero">
        <div className="hero-content">
          <span className="inicio-badge">Mundial USA · Canadá · México 2026</span>
          <h2>La porra<br /><span>del Mundial</span></h2>
          <p>La porra de Fachat, la porra favorita de los DJs de mierda, la porra que casi siempre gana Spike, la porra que te da pereza hacer pero que luego le da vidilla al mundial... la porra de las porras. La puta porra del chat de la porra.</p>          <button className="btn-principal" onClick={() => navigate('/arma-tu-porra')}>Arma tu Porra</button>
        </div>
        <div className="hero-logo">
          <img src="/Logo_Mundial.png" alt="Logo Mundial 2026" className="mundial-logo" />
        </div>
      </div>
      <div className="stats-bar">
        <div className="stat">
          <div className="stat-number">48</div>
          <div className="stat-label">Equipos</div>
        </div>
        <div className="stat">
          <div className="stat-number">104</div>
          <div className="stat-label">Partidos</div>
        </div>
        <div className="stat">
          <div className="stat-number">3</div>
          <div className="stat-label">Países sede</div>
        </div>
        <div className="stat">
          <div className="stat-number">2026</div>
          <div className="stat-label">Año</div>
        </div>
      </div>
    </div>
  );
}

export default App;