import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const sign = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' });
export const userFromToken = (db, token) => {
  try {
    const { id } = jwt.verify(token || '', SECRET);
    return db.prepare('SELECT id,name,email FROM users WHERE id=?').get(id) || null;
  } catch { return null; }
};
const text = (s, max) => String(s ?? '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

const BASE = `SELECT m.*, ROUND(AVG(r.rating),1) AS rating, COUNT(r.id) AS reviews FROM movies m LEFT JOIN reviews r ON r.movie_id=m.id`;

export function createApp(db) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10kb' }));

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 30, standardHeaders: true, legacyHeaders: false });
  const auth = (req, res, next) => {
    const u = userFromToken(db, (req.headers.authorization || '').replace('Bearer ', ''));
    if (!u) return bad(res, 'Faça login para continuar.', 401);
    req.user = u; next();
  };

  // ---- Autenticação
  app.post('/api/auth/register', limiter, async (req, res) => {
    const name = text(req.body.name, 60), email = text(req.body.email, 120).toLowerCase(), password = String(req.body.password ?? '');
    if (name.length < 2) return bad(res, 'Informe seu nome (mínimo 2 letras).');
    if (!EMAIL.test(email)) return bad(res, 'E-mail inválido.');
    if (password.length < 8 || password.length > 72) return bad(res, 'A senha deve ter de 8 a 72 caracteres.');
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'Este e-mail já está cadastrado.', 409);
    const hash = await bcrypt.hash(password, 10);
    const id = db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name, email, hash).lastInsertRowid;
    const user = { id: Number(id), name, email };
    res.status(201).json({ token: sign(user), user });
  });

  app.post('/api/auth/login', limiter, async (req, res) => {
    const email = text(req.body.email, 120).toLowerCase();
    const row = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    const ok = row && (await bcrypt.compare(String(req.body.password ?? ''), row.password_hash));
    if (!ok) return bad(res, 'E-mail ou senha incorretos.', 401);
    const user = { id: row.id, name: row.name, email: row.email };
    res.json({ token: sign(user), user });
  });

  app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

  // ---- Início e filmes
  app.get('/api/home', auth, (req, res) => {
    const featured = db.prepare(BASE + ' GROUP BY m.id ORDER BY rating DESC, m.year DESC LIMIT 4').all();
    const posts = db.prepare('SELECT p.id,p.title,p.created_at,u.name author FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 3').all();
    const count = (t) => db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
    res.json({ featured, posts, stats: { movies: count('movies'), members: count('users'), reviews: count('reviews') } });
  });

  app.get('/api/movies', auth, (req, res) => {
    const q = text(req.query.q, 60), g = text(req.query.genre, 30);
    res.json(db.prepare(BASE + ` WHERE (?='' OR m.title LIKE '%'||?||'%') AND (?='' OR m.genre=?) GROUP BY m.id ORDER BY m.title`).all(q, q, g, g));
  });

  app.get('/api/movies/:id', auth, (req, res) => {
    const movie = db.prepare(BASE + ' WHERE m.id=? GROUP BY m.id').get(req.params.id);
    if (!movie) return bad(res, 'Filme não encontrado.', 404);
    const reviewList = db.prepare('SELECT r.id,r.rating,r.comment,r.created_at,u.name author FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.movie_id=? ORDER BY r.id DESC').all(movie.id);
    res.json({ ...movie, reviewList });
  });

  app.post('/api/movies/:id/reviews', auth, (req, res) => {
    const rating = Number(req.body.rating), comment = text(req.body.comment, 500);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad(res, 'A nota deve ser de 1 a 5.');
    if (!db.prepare('SELECT 1 FROM movies WHERE id=?').get(req.params.id)) return bad(res, 'Filme não encontrado.', 404);
    db.prepare(`INSERT INTO reviews(movie_id,user_id,rating,comment) VALUES(?,?,?,?)
      ON CONFLICT(movie_id,user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment`).run(req.params.id, req.user.id, rating, comment);
    res.status(201).json({ ok: true });
  });

  // ---- Comunidade
  app.get('/api/posts', auth, (req, res) => {
    res.json(db.prepare(`SELECT p.id,p.user_id,p.title,p.body,p.created_at,u.name author,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comments
      FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT 50`).all());
  });

  app.post('/api/posts', auth, (req, res) => {
    const title = text(req.body.title, 120), body = text(req.body.body, 2000);
    if (title.length < 3 || body.length < 3) return bad(res, 'Preencha título e texto (mínimo 3 caracteres).');
    const id = db.prepare('INSERT INTO posts(user_id,title,body) VALUES(?,?,?)').run(req.user.id, title, body).lastInsertRowid;
    res.status(201).json({ id: Number(id) });
  });

  app.delete('/api/posts/:id', auth, (req, res) => {
    const r = db.prepare('DELETE FROM posts WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
    if (!r.changes) return bad(res, 'Você só pode apagar seus próprios posts.', 403);
    res.json({ ok: true });
  });

  app.get('/api/posts/:id/comments', auth, (req, res) => {
    res.json(db.prepare('SELECT c.id,c.body,c.created_at,u.name author FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id').all(req.params.id));
  });

  app.post('/api/posts/:id/comments', auth, (req, res) => {
    const body = text(req.body.body, 500);
    if (!body) return bad(res, 'Escreva um comentário.');
    if (!db.prepare('SELECT 1 FROM posts WHERE id=?').get(req.params.id)) return bad(res, 'Post não encontrado.', 404);
    db.prepare('INSERT INTO comments(post_id,user_id,body) VALUES(?,?,?)').run(req.params.id, req.user.id, body);
    res.status(201).json({ ok: true });
  });

  // ---- Chat (histórico)
  app.get('/api/messages', auth, (req, res) => {
    res.json(db.prepare(`SELECT * FROM (SELECT m.id,m.user_id,u.name,m.body,m.created_at FROM messages m JOIN users u ON u.id=m.user_id ORDER BY m.id DESC LIMIT 50) ORDER BY id`).all());
  });

  app.use('/api', (req, res) => bad(res, 'Rota não encontrada.', 404));
  app.use((err, req, res, next) => { console.error(err); bad(res, 'Erro interno.', 500); });
  return app;
}
