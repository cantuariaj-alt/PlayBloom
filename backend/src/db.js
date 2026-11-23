import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const FILMS = [
  ['Cidade de Deus', 2002, 'Drama', 'A vida de jovens numa comunidade do Rio de Janeiro entre os anos 60 e 80.', '#c2542d'],
  ['Central do Brasil', 1998, 'Drama', 'Uma ex-professora e um menino órfão cruzam o país atrás de um pai.', '#3d7a8a'],
  ['Parasita', 2019, 'Suspense', 'Uma família pobre se infiltra na casa de uma família rica.', '#4f6b3a'],
  ['Interestelar', 2014, 'Ficção', 'Exploradores viajam por um buraco de minhoca para salvar a humanidade.', '#27456b'],
  ['A Origem', 2010, 'Ficção', 'Um ladrão invade sonhos para plantar uma ideia na mente de um alvo.', '#5a4a8a'],
  ['O Auto da Compadecida', 2000, 'Comédia', 'As aventuras de João Grilo e Chicó no sertão nordestino.', '#d09a2e'],
  ['Pulp Fiction', 1994, 'Crime', 'Histórias cruzadas de criminosos em Los Angeles.', '#a33a4a'],
  ['O Poderoso Chefão', 1972, 'Crime', 'A saga de uma família mafiosa e a sucessão do poder.', '#6b3b2a'],
  ['Viagem de Chihiro', 2001, 'Animação', 'Uma menina entra num mundo de espíritos para salvar os pais.', '#2f8a7a'],
  ['Tropa de Elite', 2007, 'Ação', 'Um capitão do BOPE busca um sucessor em meio à guerra do tráfico.', '#555d66'],
  ['Divertida Mente', 2015, 'Animação', 'As emoções de uma menina disputam o controle da sua cabeça.', '#e0883d'],
  ['Meu Malvado Favorito', 2010, 'Comédia', 'Um vilão adota três meninas e muda os planos.', '#8a6fc2'],
];

export function openDb(file = process.env.DB_FILE || './data/cine.db') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS movies(id INTEGER PRIMARY KEY, title TEXT NOT NULL, year INTEGER, genre TEXT, synopsis TEXT, color TEXT);
    CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(movie_id, user_id));
    CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  if (db.prepare('SELECT COUNT(*) c FROM movies').get().c === 0) {
    const ins = db.prepare('INSERT INTO movies(title,year,genre,synopsis,color) VALUES(?,?,?,?,?)');
    db.transaction(() => FILMS.forEach((f) => ins.run(...f)))();
  }
  return db;
}
