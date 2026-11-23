import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, getToken, setToken } from './api.js';
import { Login, Home, Movies, Community, Chat } from './pages.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  useEffect(() => {
    if (getToken()) api('/auth/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);
  const login = ({ token, user }) => { setToken(token); setUser(user); };
  const logout = () => { setToken(null); setUser(null); };
  if (!ready) return <p className="center">Carregando…</p>;
  const guard = (el) => (user ? el : <Navigate to="/login" replace />);
  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      {user && <Nav />}
      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/" element={guard(<Home />)} />
          <Route path="/filmes" element={guard(<Movies />)} />
          <Route path="/comunidade" element={guard(<Community />)} />
          <Route path="/chat" element={guard(<Chat />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </AuthCtx.Provider>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="nav">
      <span className="brand">CineComunidade</span>
      <nav>
        <NavLink to="/" end>Início</NavLink>
        <NavLink to="/filmes">Filmes</NavLink>
        <NavLink to="/comunidade">Comunidade</NavLink>
        <NavLink to="/chat">Chat</NavLink>
      </nav>
      <span className="who">{user.name}<button className="link" onClick={() => { logout(); nav('/login'); }}>Sair</button></span>
    </header>
  );
}
