import { useState, useEffect, useCallback } from 'react';

const BASE = '/api';

function getToken() {
  return localStorage.getItem('admin_token');
}

export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}${path}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [path]);

  useEffect(() => { fetch_(); }, deps);

  return { data, loading, error, refetch: fetch_ };
}

function handleResponse(r) {
  if (r.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.reload();
    throw new Error('Sesión expirada, vuelve a iniciar sesión');
  }
  return r;
}

export async function apiGet(path) {
  const token = getToken();
  const r = handleResponse(await fetch(`${BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPost(path, body) {
  const token = getToken();
  const r = handleResponse(await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }));
  if (!r.ok) { const t = await r.text(); throw new Error(t); }
  return r.json();
}

export async function apiPut(path, body) {
  const token = getToken();
  const r = handleResponse(await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiDelete(path) {
  const token = getToken();
  const r = handleResponse(await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }));
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
