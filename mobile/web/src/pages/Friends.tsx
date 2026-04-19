import React, { useEffect, useState } from 'react';
import { friendsApi } from '../api';
import { useStore } from '../store';
import type { Friend } from '../api';

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

type Tab = 'online' | 'all' | 'requests';

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online' ? C.success :
    status === 'idle' ? '#f59e0b' :
    status === 'dnd' ? '#ef4444' :
    C.textMuted;
  return (
    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: `2px solid ${C.bg}`, position: 'absolute', bottom: 0, right: 0 }} />
  );
}

function Avatar({ name, status, size = 44 }: { name: string; status?: string; size?: number }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: C.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.38,
          fontWeight: 700,
          color: '#fff',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      {status && <StatusDot status={status} />}
    </div>
  );
}

function Spinner() {
  return (
    <>
      <div style={{ width: 28, height: 28, border: `3px solid rgba(99,102,241,0.2)`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

export default function Friends() {
  const { friends, setFriends, friendRequests, setFriendRequests, userStatuses } = useStore();
  const [tab, setTab] = useState<Tab>('online');
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    Promise.all([friendsApi.list(), friendsApi.requests()])
      .then(([f, r]) => { setFriends(f); setFriendRequests(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getStatus = (f: Friend) => userStatuses[f.id] ?? f.status;

  const onlineFriends = friends.filter((f) => getStatus(f) !== 'offline' && getStatus(f) !== 'invisible');
  const incomingRequests = friendRequests.filter((r) => r.direction === 'incoming');

  const displayFriends = tab === 'online' ? onlineFriends : friends;

  const handleAccept = async (id: string) => {
    try {
      await friendsApi.accept(id);
      setFriendRequests(friendRequests.filter((r) => r.id !== id));
      friendsApi.list().then(setFriends).catch(console.error);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await friendsApi.reject(id);
      setFriendRequests(friendRequests.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername.trim()) return;
    setAddError('');
    setAddSuccess('');
    setAddLoading(true);
    try {
      await friendsApi.send(addUsername.trim());
      setAddSuccess(`Prośba wysłana do ${addUsername}`);
      setAddUsername('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setAddLoading(false);
    }
  };

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${tab === t ? C.accent : 'transparent'}`,
    color: tab === t ? C.accent : C.textSub,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    position: 'relative',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '16px', background: C.bgCard, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Znajomi</h2>
        <button
          onClick={() => setAddModal(true)}
          style={{ background: C.accent, border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Dodaj
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.bgCard, borderBottom: `1px solid ${C.border}` }}>
        <button style={tabStyle('online')} onClick={() => setTab('online')}>Online</button>
        <button style={tabStyle('all')} onClick={() => setTab('all')}>Wszyscy</button>
        <button style={{ ...tabStyle('requests'), } } onClick={() => setTab('requests')}>
          Prośby
          {incomingRequests.length > 0 && (
            <span style={{ background: C.danger, color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 5px', marginLeft: 6, verticalAlign: 'middle' }}>
              {incomingRequests.length}
            </span>
          )}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><Spinner /></div>
        ) : tab === 'requests' ? (
          incomingRequests.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.textMuted, padding: '48px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 14 }}>Brak prośb o znajomość</div>
            </div>
          ) : (
            incomingRequests.map((req) => (
              <div
                key={req.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}
              >
                <Avatar name={req.from_username} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{req.from_username}</div>
                  <div style={{ color: C.textMuted, fontSize: 12 }}>chce być twoim znajomym</div>
                </div>
                <button
                  onClick={() => handleAccept(req.id)}
                  style={{ background: C.success, border: 'none', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 6 }}
                >
                  ✓
                </button>
                <button
                  onClick={() => handleReject(req.id)}
                  style={{ background: 'rgba(239,68,68,0.15)', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8, padding: '7px 12px', color: C.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            ))
          )
        ) : displayFriends.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: '48px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
            <div style={{ fontSize: 14 }}>{tab === 'online' ? 'Brak znajomych online' : 'Brak znajomych'}</div>
          </div>
        ) : (
          displayFriends.map((f) => (
            <div
              key={f.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}
            >
              <Avatar name={f.username} status={getStatus(f)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{f.username}</div>
                <div style={{ color: C.textMuted, fontSize: 12 }}>{getStatus(f)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Friend Modal */}
      {addModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
          onClick={() => { setAddModal(false); setAddError(''); setAddSuccess(''); }}
        >
          <div
            style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: C.bgCard, borderRadius: '16px 16px 0 0', padding: '24px', border: `1px solid ${C.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: C.text, fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Dodaj znajomego</h3>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Nazwa użytkownika..."
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                autoFocus
                autoCapitalize="none"
                style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', color: C.text, fontSize: 15, outline: 'none' }}
              />
              {addError && <div style={{ color: C.danger, fontSize: 13 }}>{addError}</div>}
              {addSuccess && <div style={{ color: C.success, fontSize: 13 }}>{addSuccess}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setAddModal(false); setAddError(''); setAddSuccess(''); }}
                  style={{ flex: 1, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 0', color: C.textSub, fontSize: 14, cursor: 'pointer' }}
                >
                  Zamknij
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  style={{ flex: 1, background: C.accent, border: 'none', borderRadius: 8, padding: '12px 0', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {addLoading ? 'Wysyłanie...' : 'Wyślij prośbę'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
