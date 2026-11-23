import http from 'http';
import { Server } from 'socket.io';
import { openDb } from './db.js';
import { createApp, userFromToken } from './app.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) console.warn('Defina JWT_SECRET em produção!');
const db = openDb();
const server = http.createServer(createApp(db));
const io = new Server(server, { cors: { origin: true } });

io.use((socket, next) => {
  const user = userFromToken(db, socket.handshake.auth?.token);
  if (!user) return next(new Error('unauthorized'));
  socket.data.user = user;
  next();
});

io.on('connection', (socket) => {
  socket.on('message', (raw) => {
    const body = String(raw ?? '').trim().slice(0, 500);
    if (!body) return;
    const u = socket.data.user;
    const id = db.prepare('INSERT INTO messages(user_id,body) VALUES(?,?)').run(u.id, body).lastInsertRowid;
    io.emit('message', { id: Number(id), user_id: u.id, name: u.name, body, created_at: new Date().toISOString() });
  });
});

const port = process.env.PORT || 3001;
server.listen(port, () => console.log(`API em http://localhost:${port}`));
