require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'users.db');
const PORT = process.env.PORT || 3000;

// If DB_PATH points at a mounted persistent disk and the file doesn't exist there
// but a local users.db exists in the repository area, copy it once so existing users persist.
try {
  const defaultLocal = path.join(__dirname, 'users.db');
  if (DB_PATH !== defaultLocal && fs.existsSync(defaultLocal) && !fs.existsSync(DB_PATH)) {
    // copy local DB to persistent path
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.copyFileSync(defaultLocal, DB_PATH);
    console.log(`Copied existing users.db to persistent DB_PATH: ${DB_PATH}`);
  }
} catch (e) {
  console.warn('Could not auto-migrate users.db to DB_PATH:', e && e.message);
}

const db = new sqlite3.Database(DB_PATH);

// Initialize users table with email column and migrate username->email if needed
db.serialize(() => {
  // Create table if it doesn't exist with the desired schema
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  // Inspect existing columns to detect legacy 'username' column
  db.all("PRAGMA table_info(users)", (err, cols) => {
    if (err) return console.error('PRAGMA failed', err);
    const hasUsername = cols && cols.some(c => c.name === 'username');
    const hasEmail = cols && cols.some(c => c.name === 'email');

    if (hasUsername && !hasEmail) {
      // Add email column and copy values from username
      db.run("ALTER TABLE users ADD COLUMN email TEXT", function (aerr) {
        if (aerr) return console.warn('Could not add email column:', aerr.message);
        db.run("UPDATE users SET email = username WHERE email IS NULL", function (uerr) {
          if (uerr) console.warn('Could not migrate username to email', uerr.message);
          // Create unique index on email to enforce uniqueness
          db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)", () => {});
        });
      });
    } else if (!hasEmail) {
      // No email column and no username — ensure unique index exists if email present
      db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)", () => {});
    } else {
      // Ensure unique index exists
      db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)", () => {});
    }
  });
});

const app = express();
app.use(express.json());

// Session store selection: prefer Postgres, then disk-backed file store (SESSION_DIR), then MemoryStore.
let sessionStore;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    const PgSession = require('connect-pg-simple')(session);
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
    // Ensure session table exists (idempotent)
    pool.query(`CREATE TABLE IF NOT EXISTS "session" (sid VARCHAR PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP NOT NULL)`).catch(e => console.warn('Could not ensure session table exists:', e && e.message));
    sessionStore = new PgSession({ pool });
    console.log('Using Postgres-backed session store')
  } catch (e) {
    console.warn('Postgres session store setup failed:', e && e.message);
  }
}

// If no DATABASE_URL or Postgres setup failed, attempt disk-backed session store using SESSION_DIR
if (!sessionStore && process.env.SESSION_DIR) {
  try {
    const FileStore = require('session-file-store')(session);
    let sessionsDir = process.env.SESSION_DIR;

    // Ensure the directory exists and is writable. If not, fall back to a temp dir.
    try {
      fs.mkdirSync(sessionsDir, { recursive: true });
    } catch (e) {
      console.warn('Could not create SESSION_DIR', sessionsDir, e && e.message);
      sessionsDir = null;
    }

    if (sessionsDir) {
      try {
        fs.accessSync(sessionsDir, fs.constants.R_OK | fs.constants.W_OK);
      } catch (e) {
        console.warn('SESSION_DIR not writable, falling back to tmpdir:', sessionsDir, e && e.message);
        sessionsDir = null;
      }
    }

    if (!sessionsDir) {
      // Create a dedicated temp sessions directory to avoid ENOENT noise
      sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-'));
      console.log('Using temporary sessions dir:', sessionsDir);
    }

    sessionStore = new FileStore({ path: sessionsDir, ttl: 86400 });

    // Log current directory contents for easier debugging on startup
    try {
      const files = fs.readdirSync(sessionsDir).slice(0, 20);
      console.log('Session store directory contents:', sessionsDir, files.length ? files : '(empty)');
    } catch (e) {
      console.warn('Could not read SESSION_DIR contents:', e && e.message);
    }

    console.log('Using disk-backed session-file-store at', sessionsDir);
  } catch (e) {
    console.warn('session-file-store setup failed:', e && e.message);
  }
}

// Final fallback to MemoryStore (not for production)
if (!sessionStore) {
  console.warn('No persistent session store configured — using MemoryStore (not for production)');
  sessionStore = new session.MemoryStore();
}

// Trust reverse proxy (Render) so secure cookies and req.protocol work correctly
app.set('trust proxy', 1);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  domain: process.env.COOKIE_DOMAIN || '.rospopa.com'
};

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: cookieOptions
}));

// Register
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email.toLowerCase(), hashed], function(err) {
    if (err) {
      if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'email exists' });
      return res.status(500).json({ error: 'db error' });
    }
    req.session.user = { id: this.lastID, email: email.toLowerCase() };
    res.json({ id: this.lastID, email: email.toLowerCase() });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  db.get('SELECT id, email, password FROM users WHERE email = ?', [email.toLowerCase()], async (err, row) => {
    if (err) return res.status(500).json({ error: 'db error' });
    if (!row) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    req.session.user = { id: row.id, email: row.email };
    res.json({ id: row.id, email: row.email });
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
  // Serve index.html for any unmatched route without registering a path pattern
  app.use((req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
