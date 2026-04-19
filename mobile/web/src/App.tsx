import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import { authApi } from './api';
import { connectSocket } from './socket';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './pages/Layout';
import Servers from './pages/Servers';
import Channel from './pages/Channel';
import DMs from './pages/DMs';
import DM from './pages/DM';
import Friends from './pages/Friends';
import Profile from './pages/Profile';

function App() {
  const { isAuthenticated, setAuth } = useStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('cordyn_token');
    if (token) {
      authApi
        .me()
        .then((user) => {
          setAuth(token, user);
          connectSocket();
        })
        .catch(() => localStorage.removeItem('cordyn_token'))
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid #6366f1',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route
          path="/login"
          element={!isAuthenticated ? <Login /> : <Navigate to="/" />}
        />
        <Route
          path="/register"
          element={!isAuthenticated ? <Register /> : <Navigate to="/" />}
        />
        <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/servers" />} />
          <Route path="/servers" element={<Servers />} />
          <Route path="/channel/:id" element={<Channel />} />
          <Route path="/dms" element={<DMs />} />
          <Route path="/dm/:userId" element={<DM />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/servers' : '/login'} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
