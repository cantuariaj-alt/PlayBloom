# CineComunidade

Site de filmes com login/cadastro, página inicial, catálogo com avaliações, comunidade (posts e comentários) e chat em tempo real.
Backend: Node.js + Express + SQLite + Socket.IO. Frontend: React (Vite).

## Docker
    docker compose up --build
Abra http://localhost:3000 (API em http://localhost:3001/api). Defina `JWT_SECRET` no ambiente para produção.

## Local (Node 20+)
    cd backend && npm install && npm run dev      # http://localhost:3001
    cd frontend && npm install && npm run dev     # http://localhost:5173

## Testes
    cd backend && npm test

## Segurança implementada
Senhas com bcrypt, JWT (7 dias), helmet, rate limit nas rotas de login/cadastro, validação de entrada, SQL parametrizado, limite de tamanho do body, escape automático do React, autenticação também no WebSocket.
