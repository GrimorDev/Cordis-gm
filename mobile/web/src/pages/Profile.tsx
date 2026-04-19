import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi, authApi } from '../api';
import { useStore } from '../store';
import { disconnectSocket } from '../socket';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const C = {
  bg: '#09090b',
  bgCard: '#18181b',
  bgInput: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textSub: '#a1a1aa',
  textMuted: '#52525b',
  accent: '#6366f1',
  danger: '#ef4444',
  success: '#22c55e',
};

const STATUS_OPTIONS = [
  { value: 'online',    label: 'Online',      color: C.success },
  { value: 'idle',      label: 'Nieaktywny',  color: '#f59e0b' },
  { value: 'dnd',       label: 'Nie przeszkadzać', color: '#ef4444' },
  { value: 'invisible', label: 'Niewidoczny', color: C.textMuted },
];

export default function Profile() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, clearAuth } = useStore();
  const [aboutMe, setAboutMe] = useState(currentUser?.about_me ?? '');
  const [editingAbout, setEditingAbout] = useState(false);
  const [savingAbout, setSavingAbout] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(currentUser?.preferred_status ?? currentUser?.status ?? 'online');
  const [statusSaving, setStatusSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setAboutMe(currentUser.about_me ?? '');
      setSelectedStatus(currentUser.preferred_status ?? currentUser.status ?? 'online');
    }
  }, [currentUser]);

  const handleStatusChange = async (status: string) => {
    setSelectedStatus(status);
    setStatusSaving(true);
    try {
      await usersApi.updateStatus(status);
      if (currentUser) setCurrentUser({ ...currentUser, preferred_status: status, status });
    } catch (e) {
      console.error(e);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleSaveAbout = async () => {
    setSavingAbout(true);
    try {
      const updated = await usersApi.updateMe({ about_me: aboutMe });
      setCurrentUser(updated);
      setEditingAbout(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingAbout(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch (_) {}
    disconnectSocket();
    clearAuth();
    navigate('/login');
  };

  if (!currentUser) return null;

  const statusOption = STATUS_OPTIONS.find((s) => s.value === selectedStatus) ?? STATUS_OPTIONS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '16px', background: C.bgCard, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Profil</h2>
      </div>

      {/* Avatar + username */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 24px', gap: 12 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: C.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
          }}
        >
          {currentUser.username.charAt(0).toUpperCase()}
        </div>
        <div style={{ color: C.text, fontSize: 22, fontWeight: 700 }}>{currentUser.username}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusOption.color }} />
          <span style={{ color: statusOption.color, fontSize: 13, fontWeight: 500 }}>{statusOption.label}</span>
        </div>
        {currentUser.created_at && (
          <div style={{ color: C.textMuted, fontSize: 12 }}>
            Dołączył/a {format(new Date(currentUser.created_at), 'd MMM yyyy', { locale: pl })}
          </div>
        )}
      </div>

      {/* Status picker */}
      <div style={{ margin: '0 16px 16px', background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
        </div>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusChange(opt.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '13px 16px',
              background: selectedStatus === opt.value ? 'rgba(99,102,241,0.1)' : 'none',
              border: 'none',
              borderBottom: `1px solid ${C.border}`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
            <span style={{ color: C.text, fontSize: 15, flex: 1 }}>{opt.label}</span>
            {selectedStatus === opt.value && <span style={{ color: C.accent, fontSize: 18 }}>✓</span>}
          </button>
        ))}
      </div>

      {/* About me */}
      <div style={{ margin: '0 16px 16px', background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>O mnie</span>
          {!editingAbout && (
            <button
              onClick={() => setEditingAbout(true)}
              style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
            >
              Edytuj
            </button>
          )}
        </div>
        <div style={{ padding: 16 }}>
          {editingAbout ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                rows={4}
                placeholder="Napisz coś o sobie..."
                style={{
                  background: C.bgInput,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: C.text,
                  fontSize: 14,
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.5,
                }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setEditingAbout(false); setAboutMe(currentUser.about_me ?? ''); }}
                  style={{ flex: 1, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 0', color: C.textSub, fontSize: 13, cursor: 'pointer' }}
                >
                  Anuluj
                </button>
                <button
                  onClick={handleSaveAbout}
                  disabled={savingAbout}
                  style={{ flex: 1, background: C.accent, border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {savingAbout ? 'Zapisywanie...' : 'Zapisz'}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: aboutMe ? C.text : C.textMuted, fontSize: 14, lineHeight: 1.6 }}>
              {aboutMe || 'Brak opisu...'}
            </p>
          )}
        </div>
      </div>

      {/* Logout */}
      <div style={{ margin: '0 16px 32px' }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            width: '100%',
            background: 'rgba(239,68,68,0.1)',
            border: `1px solid rgba(239,68,68,0.25)`,
            borderRadius: 12,
            padding: '14px 0',
            color: C.danger,
            fontSize: 15,
            fontWeight: 600,
            cursor: loggingOut ? 'not-allowed' : 'pointer',
          }}
        >
          {loggingOut ? 'Wylogowywanie...' : 'Wyloguj się'}
        </button>
      </div>
    </div>
  );
}
