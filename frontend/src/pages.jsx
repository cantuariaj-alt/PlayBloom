import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, fmt, getToken } from './api.js';
import { useAuth } from './App.jsx';

const Err = ({ msg }) => (msg ? <p className="err" role="alert">{msg}</p> : null);
const Stars = ({ n }) => <span className="stars" aria-label={`${n ?? 0} de 5`}>{'★'.repeat(Math.round(n || 0)).padEnd(5, '☆')}</span>;
const Poster = ({ m }) => (
  <div className="poster" style={{ background: `linear-gradient(160deg, ${m.color}, #0c1524)` }}>
    <strong>{m.title}</strong><small>{m.year}</small>
  </div>
);

/* ---------- Login e cadastro ---------- */
export function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { login(await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: f })); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth">
      <section className="auth-hero">
        <h1>Sua sessão de cinema começa aqui.</h1>
        <p>Avalie filmes, discuta com a comunidade e converse em tempo real.</p>
      </section>
      <form className="card" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Entrar</button>
          <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>Criar conta</button>
        </div>
        {mode === 'register' && <label>Nome<input value={f.name} onChange={set('name')} required minLength={2} autoComplete="name" /></label>}
        <label>E-mail<input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>Senha<input type="password" value={f.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          {mode === 'register' && <small>Mínimo de 8 caracteres.</small>}</label>
        <Err msg={err} />
        <button className="primary" disabled={busy}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
      </form>
    </div>
  );
}

/* ---------- Página inicial ---------- */
export function Home() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/home').then(setD).catch((x) => setErr(x.message)); }, []);
  if (err) return <Err msg={err} />;
  if (!d) return <p className="center">Carregando…</p>;
  return (
    <>
      <h1>Olá, {user.name.split(' ')[0]}. O que vamos assistir?</h1>
      <p className="muted">{d.stats.movies} filmes, {d.stats.reviews} avaliações e {d.stats.members} membros na comunidade.</p>
      <h2>Mais bem avaliados</h2>
      <div className="grid">
        {d.featured.map((m) => (
          <Link key={m.id} to="/filmes" className="movie"><Poster m={m} /><div><Stars n={m.rating} /> <small>{m.rating ?? 'sem notas'}</small></div></Link>
        ))}
      </div>
      <h2>Últimas na comunidade</h2>
      {d.posts.length === 0 && <p className="muted">Ainda não há posts. <Link to="/comunidade">Escreva o primeiro.</Link></p>}
      <ul className="plain">{d.posts.map((p) => <li key={p.id}><Link to="/comunidade">{p.title}</Link> <small>por {p.author}, {fmt(p.created_at)}</small></li>)}</ul>
    </>
  );
}

/* ---------- Filmes ---------- */
const GENRES = ['Ação', 'Animação', 'Comédia', 'Crime', 'Drama', 'Ficção', 'Suspense'];
export function Movies() {
  const [q, setQ] = useState(''), [genre, setGenre] = useState('');
  const [list, setList] = useState([]), [sel, setSel] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    const t = setTimeout(() => api(`/movies?q=${encodeURIComponent(q)}&genre=${encodeURIComponent(genre)}`).then(setList).catch((x) => setErr(x.message)), 200);
    return () => clearTimeout(t);
  }, [q, genre]);
  return (
    <>
      <h1>Filmes</h1>
      <div className="row">
        <input placeholder="Buscar por título" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar por título" />
        <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Gênero">
          <option value="">Todos os gêneros</option>{GENRES.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      <Err msg={err} />
      {list.length === 0 && <p className="muted">Nenhum filme encontrado. Tente outro título ou gênero.</p>}
      <div className="grid">
        {list.map((m) => (
          <button key={m.id} className="movie" onClick={() => setSel(m.id)}>
            <Poster m={m} /><div><Stars n={m.rating} /> <small>{m.genre}</small></div>
          </button>
        ))}
      </div>
      {sel && <MovieDetail id={sel} onClose={() => setSel(null)} onChange={() => api(`/movies?q=${encodeURIComponent(q)}&genre=${encodeURIComponent(genre)}`).then(setList)} />}
    </>
  );
}

function MovieDetail({ id, onClose, onChange }) {
  const [m, setM] = useState(null), [rating, setRating] = useState(5), [comment, setComment] = useState(''), [err, setErr] = useState('');
  const load = () => api(`/movies/${id}`).then(setM).catch((x) => setErr(x.message));
  useEffect(() => { load(); }, [id]);
  const send = async (e) => {
    e.preventDefault(); setErr('');
    try { await api(`/movies/${id}/reviews`, { method: 'POST', body: { rating, comment } }); setComment(''); await load(); onChange(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="card wide" onClick={(e) => e.stopPropagation()}>
        <button className="link close" onClick={onClose}>Fechar</button>
        {!m ? <p>Carregando…</p> : (
          <>
            <h2>{m.title} <small>({m.year}, {m.genre})</small></h2>
            <p>{m.synopsis}</p>
            <p><Stars n={m.rating} /> {m.rating ?? 'sem notas'} <small>({m.reviews} avaliações)</small></p>
            <form onSubmit={send}>
              <label>Sua nota<select value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'estrela' : 'estrelas'}</option>)}</select></label>
              <label>Comentário<textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} /></label>
              <Err msg={err} />
              <button className="primary">Salvar avaliação</button>
            </form>
            <ul className="plain">{m.reviewList.map((r) => <li key={r.id}><Stars n={r.rating} /> <strong>{r.author}</strong> <small>{fmt(r.created_at)}</small>{r.comment && <p>{r.comment}</p>}</li>)}</ul>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Comunidade ---------- */
export function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]), [f, setF] = useState({ title: '', body: '' }), [err, setErr] = useState(''), [open, setOpen] = useState(null);
  const load = () => api('/posts').then(setPosts).catch((x) => setErr(x.message));
  useEffect(() => { load(); }, []);
  const create = async (e) => {
    e.preventDefault(); setErr('');
    try { await api('/posts', { method: 'POST', body: f }); setF({ title: '', body: '' }); load(); } catch (x) { setErr(x.message); }
  };
  const remove = async (id) => { if (confirm('Apagar este post?')) { await api(`/posts/${id}`, { method: 'DELETE' }).catch((x) => setErr(x.message)); load(); } };
  return (
    <>
      <h1>Comunidade</h1>
      <form className="card" onSubmit={create}>
        <label>Título<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} required /></label>
        <label>O que você quer discutir?<textarea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={2000} required /></label>
        <Err msg={err} />
        <button className="primary">Publicar</button>
      </form>
      {posts.length === 0 && <p className="muted">Nenhum post ainda. Seja a primeira pessoa a publicar.</p>}
      {posts.map((p) => (
        <article className="card post" key={p.id}>
          <h3>{p.title}</h3>
          <small>{p.author}, {fmt(p.created_at)}</small>
          <p>{p.body}</p>
          <div className="row">
            <button className="link" onClick={() => setOpen(open === p.id ? null : p.id)}>{p.comments} comentários</button>
            {p.user_id === user.id && <button className="link danger" onClick={() => remove(p.id)}>Apagar</button>}
          </div>
          {open === p.id && <Comments id={p.id} onAdd={load} />}
        </article>
      ))}
    </>
  );
}

function Comments({ id, onAdd }) {
  const [list, setList] = useState([]), [body, setBody] = useState(''), [err, setErr] = useState('');
  const load = () => api(`/posts/${id}/comments`).then(setList).catch((x) => setErr(x.message));
  useEffect(() => { load(); }, [id]);
  const send = async (e) => {
    e.preventDefault(); setErr('');
    try { await api(`/posts/${id}/comments`, { method: 'POST', body: { body } }); setBody(''); load(); onAdd(); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="comments">
      <ul className="plain">{list.map((c) => <li key={c.id}><strong>{c.author}</strong> <small>{fmt(c.created_at)}</small><p>{c.body}</p></li>)}</ul>
      <form className="row" onSubmit={send}><input value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Escreva um comentário" aria-label="Comentário" /><button className="primary">Comentar</button></form>
      <Err msg={err} />
    </div>
  );
}

/* ---------- Chat em tempo real ---------- */
export function Chat() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]), [text, setText] = useState(''), [status, setStatus] = useState('conectando');
  const sock = useRef(null), end = useRef(null);
  useEffect(() => {
    api('/messages').then(setMsgs).catch(() => {});
    const s = io({ auth: { token: getToken() } });
    sock.current = s;
    s.on('connect', () => setStatus('online'));
    s.on('disconnect', () => setStatus('desconectado'));
    s.on('connect_error', () => setStatus('sem conexão'));
    s.on('message', (m) => setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m])));
    return () => s.disconnect();
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);
  const send = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !sock.current?.connected) return;
    sock.current.emit('message', t); setText('');
  };
  return (
    <>
      <h1>Chat <small className={`status ${status === 'online' ? 'ok' : ''}`}>{status}</small></h1>
      <div className="chat card">
        {msgs.length === 0 && <p className="muted">Sem mensagens ainda. Diga olá.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.user_id === user.id ? 'mine' : ''}`}>
            <small>{m.user_id === user.id ? 'Você' : m.name}, {fmt(m.created_at)}</small>
            <p>{m.body}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="row" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Escreva uma mensagem" aria-label="Mensagem" />
        <button className="primary" disabled={status !== 'online'}>Enviar</button>
      </form>
    </>
  );
}
