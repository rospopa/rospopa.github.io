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
  // Create table if it doesn't exist with the desired schema (add role column)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
  )`);

  // Inspect existing columns to detect legacy 'username' column or missing role
  db.all("PRAGMA table_info(users)", (err, cols) => {
    if (err) return console.error('PRAGMA failed', err);
    const hasUsername = cols && cols.some(c => c.name === 'username');
    const hasEmail = cols && cols.some(c => c.name === 'email');
    const hasRole = cols && cols.some(c => c.name === 'role');

    const ensureEmailIndex = () => db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)", () => {});

    if (hasUsername && !hasEmail) {
      // Add email column and copy values from username
      db.run("ALTER TABLE users ADD COLUMN email TEXT", function (aerr) {
        if (aerr) return console.warn('Could not add email column:', aerr.message);
        db.run("UPDATE users SET email = username WHERE email IS NULL", function (uerr) {
          if (uerr) console.warn('Could not migrate username to email', uerr.message);
          ensureEmailIndex();
        });
      });
    } else if (!hasEmail) {
      // No email column and no username — ensure unique index exists if email present
      ensureEmailIndex();
    } else {
      // Ensure unique index exists
      ensureEmailIndex();
    }

    if (!hasRole) {
      // Add role column with default 'user' for existing rows
      db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", function (rerr) {
        if (rerr) return console.warn('Could not add role column:', rerr.message);
        db.run("UPDATE users SET role = 'user' WHERE role IS NULL", () => {});
      });
    }
  });
});

// Create audit_logs table for admin action auditing
db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT,
  target_user_id INTEGER,
  target_email TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const app = express();
app.use(express.json());

// Input validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}
function sanitizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function isValidPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128;
}

// Session store selection: prefer Postgres, then disk-backed file store (SESSION_DIR), then MemoryStore.
let sessionStore;
let sessionStoreType = 'unknown'; // 'postgres' | 'file' | 'memory' | 'unknown'
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    const PgSession = require('connect-pg-simple')(session);
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
    // Ensure session table exists (idempotent) but do not block session store creation
    pool.query(`CREATE TABLE IF NOT EXISTS "session" (sid VARCHAR PRIMARY KEY, sess JSON NOT NULL, expire TIMESTAMP NOT NULL)`).catch(e => console.warn('Could not ensure session table exists:', e && e.message));
    sessionStore = new PgSession({ pool });
    sessionStoreType = 'postgres';
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
    sessionStoreType = 'file';

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
  sessionStoreType = 'memory';
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
  let { email, password } = req.body || {};
  email = sanitizeEmail(email);
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid email' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'password must be 8-128 characters' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hashed, 'user'], function(err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'email exists' });
        return res.status(500).json({ error: 'db error' });
      }
      req.session.user = { id: this.lastID, email: email, role: 'user' };
      res.json({ id: this.lastID, email: email, role: 'user' });
    });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  let { email, password } = req.body || {};
  email = sanitizeEmail(email);
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid email' });
  db.get('SELECT id, email, password, role FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'db error' });
    if (!row) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    req.session.user = { id: row.id, email: row.email, role: row.role || 'user' };
    res.json({ id: row.id, email: row.email, role: row.role || 'user' });
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

// Admin-only: list users with search & pagination
app.get('/api/users', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const q = (req.query.q || '').trim().toLowerCase();
  const limit = Math.min(100, parseInt(req.query.limit || '10', 10) || 10);
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);

  const where = q ? 'WHERE LOWER(email) LIKE ?' : '';
  const params = q ? [`%${q}%`] : [];

  db.get(`SELECT COUNT(*) as total FROM users ${where}`, params, (cerr, countRow) => {
    if (cerr) return res.status(500).json({ error: 'db error' });
    db.all(`SELECT id, email, role FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, params.concat([limit, offset]), (err, rows) => {
      if (err) return res.status(500).json({ error: 'db error' });
      res.json({ users: rows, total: countRow.total });
    });
  });
});

// Admin-only: change role
app.post('/api/users/:id/role', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const adminId = req.session.user.id;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  // Prevent admin from demoting/removing their own admin role accidentally
  if (adminId === id && role !== 'admin') return res.status(400).json({ error: 'cannot change own role' });

  // Fetch existing user to log details
  db.get('SELECT id, email, role FROM users WHERE id = ?', [id], (gerr, row) => {
    if (gerr) return res.status(500).json({ error: 'db error' });
    if (!row) return res.status(404).json({ error: 'not found' });
    const oldRole = row.role || 'user';
    db.run('UPDATE users SET role = ? WHERE id = ?', [role, id], function (err) {
      if (err) return res.status(500).json({ error: 'db error' });
      // Log audit
      try {
        const details = JSON.stringify({ from: oldRole, to: role });
        db.run('INSERT INTO audit_logs (admin_id, action, target_user_id, target_email, details) VALUES (?, ?, ?, ?, ?)', [adminId, `role_change`, id, row.email, details]);
      } catch (e) { console.warn('Audit log failed', e && e.message); }
      res.json({ ok: true });
    });
  });
});

// Admin-only: create user
app.post('/api/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  let { email, password, role } = req.body || {};
  email = sanitizeEmail(email);
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid email' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'password must be 8-128 characters' });
  if (role && !['admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, hashed, (role || 'user')], function (err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'email exists' });
        return res.status(500).json({ error: 'db error' });
      }
      // Log audit
      try {
        const details = JSON.stringify({ created: true, role: role || 'user' });
        db.run('INSERT INTO audit_logs (admin_id, action, target_user_id, target_email, details) VALUES (?, ?, ?, ?, ?)', [req.session.user.id, `create_user`, this.lastID, email, details]);
      } catch (e) { console.warn('Audit log failed', e && e.message); }
      res.json({ id: this.lastID, email: email, role: role || 'user' });
    });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
});

// Admin-only: delete user
app.delete('/api/users/:id', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const adminId = req.session.user.id;
  const id = Number(req.params.id);
  // Prevent admin from deleting themselves
  if (adminId === id) return res.status(400).json({ error: 'cannot delete self' });

  db.get('SELECT id, email FROM users WHERE id = ?', [id], (gerr, row) => {
    if (gerr) return res.status(500).json({ error: 'db error' });
    if (!row) return res.status(404).json({ error: 'not found' });
    db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: 'db error' });
      // Log audit
      try {
        const details = JSON.stringify({ deleted: true });
        db.run('INSERT INTO audit_logs (admin_id, action, target_user_id, target_email, details) VALUES (?, ?, ?, ?, ?)', [adminId, `delete_user`, id, row.email, details]);
      } catch (e) { console.warn('Audit log failed', e && e.message); }
      res.json({ ok: true });
    });
  });
});

// Audit logs viewer
app.get('/api/audit-logs', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const q = (req.query.q || '').trim().toLowerCase();
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10) || 20);
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
  const where = q ? 'WHERE LOWER(target_email) LIKE ? OR LOWER(action) LIKE ?' : '';
  const params = q ? [`%${q}%`, `%${q}%`] : [];
  db.get(`SELECT COUNT(*) as total FROM audit_logs ${where}`, params, (cerr, countRow) => {
    if (cerr) return res.status(500).json({ error: 'db error' });
    db.all(`SELECT id, admin_id, action, target_user_id, target_email, details, created_at FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, params.concat([limit, offset]), (err, rows) => {
      if (err) return res.status(500).json({ error: 'db error' });
      res.json({ logs: rows, total: countRow.total });
    });
  });
});



// If ADMIN_EMAIL and ADMIN_PASSWORD are provided in the environment, create or update the admin user now
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  (async () => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL.toLowerCase();
      const adminPass = process.env.ADMIN_PASSWORD;
      const hashed = await bcrypt.hash(adminPass, 10);
      db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, row) => {
        if (err) return console.warn('Could not query for admin user:', err && err.message);
        if (row) {
          db.run('UPDATE users SET password = ?, role = ? WHERE id = ?', [hashed, 'admin', row.id], function (uerr) {
            if (uerr) return console.warn('Could not update admin user:', uerr && uerr.message);
            console.log('Updated admin user:', adminEmail);
          });
        } else {
          db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [adminEmail, hashed, 'admin'], function (ierr) {
            if (ierr) return console.warn('Could not create admin user:', ierr && ierr.message);
            console.log('Created admin user:', adminEmail);
          });
        }
      });
    } catch (e) {
      console.warn('Admin setup failed:', e && e.message);
    }
  })();
}

// Serve a favicon route (serve existing PNG or SVG as /favicon.ico)
app.get('/favicon.ico', (req, res) => {
  // Prefer an actual favicon.ico if present in public, else serve the 32x32 PNG
  const publicDir = path.join(__dirname, '..', 'client', 'public');
  const icoPath = path.join(publicDir, 'favicon.ico');
  const pngPath = path.join(publicDir, 'favicon-32x32.png');
  const svgPath = path.join(publicDir, 'favicon.svg');
  if (fs.existsSync(icoPath)) return res.sendFile(icoPath);
  if (fs.existsSync(pngPath)) return res.sendFile(pngPath);
  if (fs.existsSync(svgPath)) return res.sendFile(svgPath);
  res.status(404).end();
});

// Lightweight status endpoint to report which session store is active
app.get('/api/status', (req, res) => {
  res.json({ sessionStore: sessionStoreType, hasDatabaseUrl: !!process.env.DATABASE_URL });
});

// Serve client in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Serve index.html for any unmatched route without registering a path pattern
  app.use((req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
