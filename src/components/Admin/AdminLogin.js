import React, { useState } from 'react';
import { apiPost } from '../../hooks/useApi';
import './Admin.css';

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { token } = await apiPost('/auth/login', { email, password });
      localStorage.setItem('admin_token', token);
      onLogin(token);
    } catch (err) {
      setError('Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <h2>Admin</h2>
        <p>Porra Mundial 2026</p>
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <label>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
          {error && <div className="login-error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
