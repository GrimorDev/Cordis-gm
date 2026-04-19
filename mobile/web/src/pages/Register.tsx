import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useStore } from '../store';
import { connectSocket } from '../socket';

const C = {
  bg: '#09090b',
  bgCard: '#18181b',
  bgInput: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textSub: '#a1a1aa',
  accent: '#6366f1',
  danger: '#ef4444',
};

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || !confirm) return;
    if (password !== confirm) {
      setError('Hasła nie są identyczne');
      return;
    }
    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { token, user } = await authApi.register(username.trim(), password);
      setAuth(token, user);
      connectSocket();
      navigate('/servers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd rejestracji');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: C.bgInput,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '12px 14px',
    color: C.text,
    fontSize: 15,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: C.textSub,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: C.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 16,
          boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
        }}
      >
        C
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 6 }}>Utwórz konto</h1>
      <p style={{ color: C.textSub, fontSize: 14, marginBottom: 32 }}>Dołącz do Cordyn już dziś</p>

      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 360,
          background: C.bgCard,
          borderRadius: 16,
          padding: '28px 24px',
          border: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Nazwa użytkownika</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Hasło</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle}>Potwierdź hasło</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
          />
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: `1px solid rgba(239,68,68,0.3)`,
              borderRadius: 8,
              padding: '10px 14px',
              color: C.danger,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? 'rgba(99,102,241,0.5)' : C.accent,
            border: 'none',
            borderRadius: 8,
            padding: '13px 0',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          {loading ? 'Rejestracja...' : 'Zarejestruj się'}
        </button>

        <p style={{ textAlign: 'center', color: C.textSub, fontSize: 13 }}>
          Masz już konto?{' '}
          <Link to="/login" style={{ color: C.accent, textDecoration: 'none', fontWeight: 500 }}>
            Zaloguj się
          </Link>
        </p>
      </form>
    </div>
  );
}
