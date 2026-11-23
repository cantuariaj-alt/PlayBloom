import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

let server, base, token;
const call = async (path, { method = 'GET', body, auth = true } = {}) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: 'Bearer ' + token } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
};
before(async () => {
  server = http.createServer(createApp(openDb(':memory:')));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

test('cadastro valida dados e cria usuário', async () => {
  assert.equal((await call('/api/auth/register', { method: 'POST', body: { name: 'A', email: 'x', password: '1' }, auth: false })).status, 400);
  const r = await call('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@teste.com', password: 'senha1234' }, auth: false });
  assert.equal(r.status, 201); token = r.data.token;
  assert.equal((await call('/api/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@teste.com', password: 'senha1234' }, auth: false })).status, 409);
});
test('login correto e incorreto', async () => {
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'ana@teste.com', password: 'errada123' }, auth: false })).status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'ana@teste.com', password: 'senha1234' }, auth: false })).status, 200);
});
test('rotas protegidas exigem token', async () => {
  assert.equal((await call('/api/movies', { auth: false })).status, 401);
  assert.equal((await call('/api/movies')).status, 200);
});
test('filmes: busca, nota e média', async () => {
  const list = (await call('/api/movies?q=chihiro')).data;
  assert.equal(list.length, 1);
  assert.equal((await call(`/api/movies/${list[0].id}/reviews`, { method: 'POST', body: { rating: 9 } })).status, 400);
  assert.equal((await call(`/api/movies/${list[0].id}/reviews`, { method: 'POST', body: { rating: 5, comment: 'Lindo' } })).status, 201);
  const m = (await call(`/api/movies/${list[0].id}`)).data;
  assert.equal(m.rating, 5); assert.equal(m.reviewList.length, 1);
});
test('início, comunidade e chat', async () => {
  const home = (await call('/api/home')).data;
  assert.equal(home.featured.length, 4); assert.equal(home.stats.members, 1);
  const p = await call('/api/posts', { method: 'POST', body: { title: 'Melhor de 2024?', body: 'Vamos debater.' } });
  assert.equal(p.status, 201);
  assert.equal((await call(`/api/posts/${p.data.id}/comments`, { method: 'POST', body: { body: 'Concordo!' } })).status, 201);
  assert.equal((await call('/api/posts')).data[0].comments, 1);
  assert.equal((await call('/api/messages')).status, 200);
});
