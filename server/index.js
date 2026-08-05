require('dotenv').config();
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'users.db');
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database(DB_PATH);

// Initialize users table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);
});

const app = express();
app.use(express.json());

const sessionStore = new FileStore({ path: path.join(__dirname, 'sessions'), ttl: 86400 });
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed], function(err) {
    if (err) {
      if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'username exists' });
      return res.status(500).json({ error: 'db error' });
    }
    req.session.user = { id: this.lastID, username };
    res.json({ id: this.lastID, username });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  db.get('SELECT id, username, password FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) return res.status(500).json({ error: 'db error' });
    if (!row) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    req.session.user = { id: row.id, username: row.username };
    res.json({ id: row.id, username: row.username });
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'logout failed' });
    res.json({ ok: true });
  });
});

// Current user
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ user: null });
  res.json({ user: req.session.user });
});

// Serve client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
