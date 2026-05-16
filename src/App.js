import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <div className="header-logo">
            <img src="/Logo_Mundial.png" alt="Mundial 2026" className="logo-icon" />
            <span className="header-title">Porra Mundial 2026</span>
          </div>
          <nav>
            <a href="/">Inicio</a>
            <a href="/arma-tu-porra">Arma tu Porra</a>
            <a href="/clasificacion">Clasificación</a>
            <a href="/normas">Normas</a>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Inicio />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function Inicio() {
  return (
    <div className="inicio">
      <div className="hero">
        <div className="hero-content">
          <span className="inicio-badge">Mundial USA · Canadá · México 2026</span>
          <h2>La porra<br /><span>del Mundial</span></h2>
          <p>La porra de Fachat, la porra favorita de los DJs de mierda, la porra que casi siempre gana Spike, la porra que te da pereza hacer pero que luego le da vidilla al mundial... la porra de las porras. La puta porra del chat de la porra.</p>          <button className="btn-principal">Arma tu Porra</button>
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