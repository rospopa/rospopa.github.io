require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const https = require('https');
const { Resend } = require('resend');
const { rateLimit } = require('express-rate-limit');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const RECAPTCHA_API_KEY = process.env.RECAPTCHA_API_KEY;
const RECAPTCHA_PROJECT_ID = 'rospopa-recaptcha';
const RECAPTCHA_SITE_KEY = '6LerA3ctAAAAAKpS3caYCY9pDLR26TQY060EFpYv';
const RECAPTCHA_MIN_SCORE = 0.5;
const FROM_EMAIL = 'noreply@rospopa.com';

const resend = new Resend(process.env.RESEND_API_KEY);

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    first_name TEXT,
    last_name TEXT,
    organization TEXT,
    phone_number TEXT,
    buy_box TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migrate existing users table to add timestamp columns if missing
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`);

  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER,
    acted_by_email TEXT,
    action TEXT,
    target_user_id INTEGER,
    target_email TEXT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS acted_by_email TEXT`);
  await pool.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT`);

  await pool.query(`CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    pin TEXT NOT NULL,
    address TEXT NOT NULL,
    county TEXT NOT NULL,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // New property fields (added incrementally so existing data is preserved)
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS price NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS square_feet NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS lot_size NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS year_built INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS on_major_road BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS traffic_vpd INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS on_corner_lot BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS direct_water_access BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS next_to_public_land BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS major_interstates JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS household_income_min INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS household_income_max INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS population_density NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS logistics_hubs JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS landmarks JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS water_sources JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS military_bases JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'New'`);

  await pool.query(`CREATE TABLE IF NOT EXISTS property_assignments (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, user_id)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS property_media (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    media_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS property_documents (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_data TEXT NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS password_reset_otps (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // Drop and recreate session table with correct schema for connect-pg-simple v8
  await pool.query(`DROP TABLE IF EXISTS "session"`);
  await pool.query(`CREATE TABLE "session" (
    sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP(6) NOT NULL
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
}

const app = express();
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));

app.set('trust proxy', 1);

// Rate limiters
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // max 5 requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please try again in an hour.' }
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // max 10 code attempts per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset attempts. Please try again in an hour.' }
});

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

let sessionStoreType = 'unknown';

/** Fire-and-forget audit log helper */
async function logAudit(actorId, actorEmail, action, details = {}, targetUserId = null, targetEmail = null, ip = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (admin_id, acted_by_email, action, target_user_id, target_email, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [actorId, actorEmail, action, targetUserId, targetEmail, JSON.stringify(details), ip]
    );
  } catch (e) {
    console.warn('Audit log failed:', e.message);
  }
}

/** Extract real client IP, respecting X-Forwarded-For from Render's proxy */
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

/** Verify a reCAPTCHA Enterprise token. Returns { ok, score, reason } */
async function verifyRecaptcha(token, action) {
  if (!RECAPTCHA_API_KEY) return { ok: true, score: 1, reason: 'no_api_key_configured' };
  if (!token) return { ok: true, score: 1, reason: 'no_token_skipped' }; // fail-open if script not loaded
  return new Promise((resolve) => {
    const body = JSON.stringify({
      event: { token, expectedAction: action, siteKey: RECAPTCHA_SITE_KEY }
    });
    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${RECAPTCHA_PROJECT_ID}/assessments?key=${RECAPTCHA_API_KEY}`;
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const score = parsed?.riskAnalysis?.score ?? parsed?.score ?? 0;
          const valid = parsed?.tokenProperties?.valid ?? false;
          const actionMatch = !parsed?.tokenProperties?.action || parsed.tokenProperties.action === action;
          if (!valid) return resolve({ ok: false, score, reason: 'invalid_token' });
          if (!actionMatch) return resolve({ ok: false, score, reason: 'action_mismatch' });
          resolve({ ok: score >= RECAPTCHA_MIN_SCORE, score, reason: score < RECAPTCHA_MIN_SCORE ? 'low_score' : 'pass' });
        } catch { resolve({ ok: false, score: 0, reason: 'parse_error' }); }
      });
    });
    req.on('error', () => resolve({ ok: false, score: 0, reason: 'network_error' }));
    req.write(body);
    req.end();
  });
}

// Session middleware is initialized async (after DB schema ready) via a proxy
// When multiple connect.sid cookies exist (stale + new), keep only the last one
// MUST be registered before the session middleware placeholder
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || '';
  const matches = [...cookieHeader.matchAll(/connect\.sid=([^;]+)/g)];
  if (matches.length > 1) {
    const last = matches[matches.length - 1][1];
    const otherCookies = cookieHeader
      .split(';')
      .filter(c => !c.trim().startsWith('connect.sid'))
      .join('; ');
    req.headers.cookie = (otherCookies ? otherCookies + '; ' : '') + `connect.sid=${last}`;
  }
  next();
});

let _sessionMiddleware = (req, res, next) => next(); // placeholder until ready
app.use((req, res, next) => _sessionMiddleware(req, res, next));

async function initializeSessionMiddleware() {
  // Minimal custom Postgres session store — avoids connect-pg-simple compatibility issues
  const Store = require('express-session').Store;
  class PgStore extends Store {
    async get(sid, cb) {
      try {
        const r = await pool.query('SELECT sess FROM session WHERE sid=$1 AND expire > NOW()', [sid]);
        cb(null, r.rows.length ? r.rows[0].sess : null);
      } catch(e) { console.error('Session get error:', e.message); cb(e); }
    }
    async set(sid, sess, cb) {
      try {
        const exp = new Date(Date.now() + (sess.cookie?.maxAge || 7*24*60*60*1000));
        await pool.query(`
          INSERT INTO session(sid, sess, expire) VALUES($1,$2,$3)
          ON CONFLICT(sid) DO UPDATE SET sess=$2, expire=$3
        `, [sid, JSON.stringify(sess), exp]);
        cb(null);
      } catch(e) { console.error('Session set error:', e.message); cb(e); }
    }
    async destroy(sid, cb) {
      try {
        await pool.query('DELETE FROM session WHERE sid=$1', [sid]);
        cb(null);
      } catch(e) { cb(e); }
    }
    async touch(sid, sess, cb) {
      try {
        const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await pool.query('UPDATE session SET expire=$2 WHERE sid=$1', [sid, exp]);
        cb(null);
      } catch(e) { cb(e); }
    }
  }

  const sessionStore = new PgStore();
  sessionStoreType = 'postgres-custom';
  console.log('Using custom Postgres session store');

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  _sessionMiddleware = session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: cookieOptions
  });
}

app.post('/api/register', (req, res) => {
  res.status(403).json({ error: 'Registration is disabled. Contact your administrator.' })
});

/** Public endpoint — returns first_name, last_name, profile_photo for a given email.
 *  Used to personalise the login screen. Never returns sensitive data. */
app.post('/api/lookup-user', async (req, res) => {
  let { email } = req.body || {};
  email = sanitizeEmail(email);
  if (!email) return res.json({ found: false });
  try {
    const result = await pool.query(
      'SELECT first_name, last_name, profile_photo FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) return res.json({ found: false });
    const { first_name, last_name, profile_photo } = result.rows[0];
    res.json({ found: true, first_name, last_name, profile_photo });
  } catch { res.json({ found: false }); }
});

/** Send a 6-digit OTP to the user's email for password reset */
app.post('/api/forgot-password', forgotPasswordLimiter, async (req, res) => {
  let { email, recaptchaToken } = req.body || {};
  email = sanitizeEmail(email);
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'valid email required' });

  const captcha = await verifyRecaptcha(recaptchaToken, 'FORGOT_PASSWORD');
  if (!captcha.ok) {
    logAudit(null, email, 'recaptcha_failed', { action: 'FORGOT_PASSWORD', reason: captcha.reason, score: captcha.score }, null, email, clientIp(req));
    return res.status(403).json({ error: 'Security check failed. Please try again.' });
  }

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'No account found with that email address.' });

    // Invalidate old codes for this email
    await pool.query('UPDATE password_reset_otps SET used = TRUE WHERE email = $1', [email]);

    // Generate 6-digit code, hash it before storing
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await pool.query(
      'INSERT INTO password_reset_otps (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, codeHash, expiresAt]
    );

    await resend.emails.send({
      from: `Capitalization Rate Portal <${FROM_EMAIL}>`,
      to: email,
      subject: 'Your password reset code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="margin-bottom:8px">Password Reset</h2>
          <p style="color:#555">Enter this code in the portal to reset your password. It expires in <strong>15 minutes</strong>.</p>
          <div style="font-size:40px;font-weight:800;letter-spacing:12px;text-align:center;padding:24px;background:#f4f4f4;border-radius:8px;margin:24px 0">${code}</div>
          <p style="color:#999;font-size:12px">If you didn't request this, ignore this email. Your password won't change.</p>
        </div>
      `
    });

    logAudit(null, email, 'forgot_password', { email }, null, email, clientIp(req));
  } catch (e) {
    console.error('forgot-password error:', e.message);
  }
  res.json({ ok: true });
});

/** Verify OTP + set new password */
app.post('/api/reset-password', resetPasswordLimiter, async (req, res) => {
  let { email, code, newPassword } = req.body || {};
  email = sanitizeEmail(email);
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'email, code and newPassword required' });
  if (!isValidPassword(newPassword)) return res.status(400).json({ error: 'password must be 8-128 characters' });

  try {
    // Fetch the most recent unused, unexpired OTP for this email
    const otpResult = await pool.query(
      `SELECT id, code FROM password_reset_otps
       WHERE email = $1 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (otpResult.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired code' });

    // Compare submitted code against the stored hash
    const match = await bcrypt.compare(code.trim(), otpResult.rows[0].code);
    if (!match) return res.status(400).json({ error: 'Invalid or expired code' });

    // Mark used
    await pool.query('UPDATE password_reset_otps SET used = TRUE WHERE id = $1', [otpResult.rows[0].id]);

    const hashed = await bcrypt.hash(newPassword, 10);
    const upd = await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE email = $2 RETURNING id', [hashed, email]);
    if (upd.rowCount === 0) return res.status(404).json({ error: 'User not found' });

    logAudit(upd.rows[0].id, email, 'password_reset', {}, null, email, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    console.error('reset-password error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  let { email, password, recaptchaToken } = req.body || {};
  email = sanitizeEmail(email);
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid email' });

  const captcha = await verifyRecaptcha(recaptchaToken, 'LOGIN');
  if (!captcha.ok) {
    logAudit(null, email, 'recaptcha_failed', { action: 'LOGIN', reason: captcha.reason, score: captcha.score, ip: clientIp(req) }, null, email, clientIp(req));
    return res.status(403).json({ error: 'Security check failed. Please try again.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password, role, first_name, last_name, organization, phone_number, buy_box, profile_photo FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      logAudit(null, email, 'login_failed', { reason: 'user not found', ip: clientIp(req) }, null, email, clientIp(req));
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const row = result.rows[0];
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) {
      logAudit(row.id, row.email, 'login_failed', { reason: 'wrong password', ip: clientIp(req) }, null, row.email, clientIp(req));
      return res.status(401).json({ error: 'invalid credentials' });
    }
    // Note: profile_photo intentionally excluded from session to keep session size small
    const userObj = { id: row.id, email: row.email, role: row.role || 'user', first_name: row.first_name, last_name: row.last_name, organization: row.organization, phone_number: row.phone_number, buy_box: row.buy_box };
    req.session.user = userObj;
    req.session.save(err => {
      if (err) {
        console.error('Session save error on login:', err);
        return res.status(500).json({ error: 'session save failed' });
      }
      console.log('Session saved ok, sid:', req.session.id);
      logAudit(row.id, row.email, 'login', { ip: clientIp(req) }, null, null, clientIp(req));
      res.json({ user: userObj });
    });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/logout', async (req, res) => {
  const user = req.session.user;
  const ip = clientIp(req);
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'logout failed' });
    if (user) logAudit(user.id, user.email, 'logout', { ip }, null, null, ip);
    res.json({ ok: true });
  });
});

app.get('/api/me', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ user: null });
  try {
    const r = await pool.query('SELECT profile_photo FROM users WHERE id=$1', [req.session.user.id]);
    const profile_photo = r.rows.length ? r.rows[0].profile_photo : null;
    res.json({ user: { ...req.session.user, profile_photo } });
  } catch {
    res.json({ user: req.session.user });
  }
});

app.get('/api/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const q = (req.query.q || '').trim().toLowerCase();
  const limit = Math.min(100, parseInt(req.query.limit || '10', 10) || 10);
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);

  try {
    const countParams = [];
    const listParams = [];
    let where = '';
    if (q) {
      where = 'WHERE LOWER(email) LIKE $1';
      countParams.push(`%${q}%`);
      listParams.push(`%${q}%`);
    }
    listParams.push(limit, offset);
    const countResult = await pool.query(`SELECT COUNT(*)::int as total FROM users ${where}`, countParams);
    const listResult = await pool.query(
      `SELECT id, email, role, first_name, last_name, organization, phone_number, buy_box, profile_photo, created_at, updated_at FROM users ${where} ORDER BY id DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    res.json({ users: listResult.rows, total: countResult.rows[0].total });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/users/:id/role', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const adminId = req.session.user.id;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  if (adminId === id && role !== 'admin') return res.status(400).json({ error: 'cannot change own role' });

  try {
    const existingResult = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const row = existingResult.rows[0];
    const oldRole = row.role || 'user';
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    await logAudit(adminId, req.session.user.email, 'role_change', { from: oldRole, to: role }, id, row.email, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  let { email, password, role, first_name, last_name, organization, phone_number, buy_box, profile_photo } = req.body || {};
  email = sanitizeEmail(email);
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid email' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'password must be 8-128 characters' });
  if (role && !['admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  if (!profile_photo) return res.status(400).json({ error: 'profile photo is required' });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, role, first_name, last_name, organization, phone_number, buy_box, profile_photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [email, hashed, role || 'user', first_name || null, last_name || null, organization || null, phone_number || null, buy_box || null, profile_photo]
    );
    const id = result.rows[0].id;
    await logAudit(req.session.user.id, req.session.user.email, 'create_user', { role: role || 'user' }, id, email, clientIp(req));
    res.json({ id, email, role: role || 'user', first_name, last_name, organization, phone_number, buy_box });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'email exists' });
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const userId = req.session.user ? req.session.user.id : null;
  const userRole = req.session.user ? req.session.user.role : null;

  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  if (userRole !== 'admin' && userId !== id) return res.status(403).json({ error: 'forbidden' });

  const { first_name, last_name, organization, phone_number, buy_box, profile_photo, role } = req.body || {};
  const updates = [];
  const values = [];

  if (first_name !== undefined) { updates.push(`first_name = $${updates.length + 1}`); values.push(first_name || null); }
  if (last_name !== undefined) { updates.push(`last_name = $${updates.length + 1}`); values.push(last_name || null); }
  if (organization !== undefined) { updates.push(`organization = $${updates.length + 1}`); values.push(organization || null); }
  if (phone_number !== undefined) { updates.push(`phone_number = $${updates.length + 1}`); values.push(phone_number || null); }
  if (buy_box !== undefined) { updates.push(`buy_box = $${updates.length + 1}`); values.push(buy_box || null); }
  if (profile_photo !== undefined) { updates.push(`profile_photo = $${updates.length + 1}`); values.push(profile_photo || null); }
  if (role !== undefined && userRole === 'admin') {
    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'invalid role' });
    updates.push(`role = $${updates.length + 1}`); values.push(role);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  try {
    const updateResult = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
    if (updateResult.rowCount === 0) return res.status(404).json({ error: 'not found' });
    const userResult = await pool.query('SELECT id, email, role, first_name, last_name, organization, phone_number, buy_box, profile_photo, created_at, updated_at FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const row = userResult.rows[0];
    const changedFields = Object.keys(req.body || {}).filter(k => k !== 'profile_photo');
    await logAudit(userId, req.session.user.email, 'edit_user', { changed_fields: changedFields }, id, row.email, clientIp(req));
    if (userId === id) {
      req.session.user = { id: row.id, email: row.email, role: row.role, first_name: row.first_name, last_name: row.last_name, organization: row.organization, phone_number: row.phone_number, buy_box: row.buy_box };
    }
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const adminId = req.session.user.id;
  const id = Number(req.params.id);
  if (adminId === id) return res.status(400).json({ error: 'cannot delete self' });

  try {
    const existingResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const row = existingResult.rows[0];
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await logAudit(adminId, req.session.user.email, 'delete_user', {}, id, row.email, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const q = (req.query.q || '').trim().toLowerCase();
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10) || 20);
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);

  try {
    let where = '';
    const countParams = [];
    const listParams = [];
    if (q) {
      where = 'WHERE LOWER(target_email) LIKE $1 OR LOWER(action) LIKE $2';
      countParams.push(`%${q}%`, `%${q}%`);
      listParams.push(`%${q}%`, `%${q}%`);
    }
    listParams.push(limit, offset);
    const countResult = await pool.query(`SELECT COUNT(*)::int as total FROM audit_logs ${where}`, countParams);
    const listResult = await pool.query(
      `SELECT id, admin_id, acted_by_email, action, target_user_id, target_email, details, ip_address, created_at FROM audit_logs ${where} ORDER BY id DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    res.json({ logs: listResult.rows, total: countResult.rows[0].total });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/properties/:id/media', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid property id' });
  const { filename, mediaType, base64Data } = req.body || {};
  if (!filename || !mediaType || !base64Data) return res.status(400).json({ error: 'filename, mediaType, and base64Data required' });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowedTypes.includes(mediaType)) return res.status(400).json({ error: 'unsupported media type' });

  try {
    const result = await pool.query(
      'INSERT INTO property_media (property_id, filename, media_type, file_path, uploaded_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [propId, filename, mediaType, base64Data, req.session.user.id]
    );
    await logAudit(req.session.user.id, req.session.user.email, 'upload_media', { property_id: propId, filename, mediaType }, null, null, clientIp(req));
    res.json({ id: result.rows[0].id, filename, mediaType });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/properties/:id/media', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid property id' });

  try {
    const result = await pool.query('SELECT id, filename, media_type, uploaded_at FROM property_media WHERE property_id = $1 ORDER BY uploaded_at DESC', [propId]);
    res.json({ media: result.rows || [] });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/properties/:id/media/:mediaId', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const propId = Number(req.params.id);
  const mediaId = Number(req.params.mediaId);
  if (!Number.isFinite(propId) || !Number.isFinite(mediaId)) return res.status(400).json({ error: 'invalid ids' });

  try {
    const result = await pool.query('SELECT file_path, media_type FROM property_media WHERE id = $1 AND property_id = $2', [mediaId, propId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const row = result.rows[0];
    // file_path stores a base64 data URL like "data:image/jpeg;base64,/9j/..."
    // strip the prefix and decode to binary buffer
    const dataUrl = row.file_path;
    const base64Index = dataUrl.indexOf(',');
    if (base64Index === -1) {
      // fallback: send raw
      res.set('Content-Type', row.media_type);
      return res.send(dataUrl);
    }
    const base64 = dataUrl.substring(base64Index + 1);
    const buffer = Buffer.from(base64, 'base64');
    res.set('Content-Type', row.media_type);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.delete('/api/properties/:id/media/:mediaId', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  const mediaId = Number(req.params.mediaId);
  if (!Number.isFinite(propId) || !Number.isFinite(mediaId)) return res.status(400).json({ error: 'invalid ids' });

  try {
    const result = await pool.query('DELETE FROM property_media WHERE id = $1 AND property_id = $2', [mediaId, propId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    await logAudit(req.session.user.id, req.session.user.email, 'delete_media', { property_id: propId, media_id: mediaId }, null, null, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

/* ─── Documents endpoints ─────────────────────────────────────── */

app.post('/api/properties/:id/documents', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid property id' });
  const { filename, fileType, fileData } = req.body || {};
  if (!filename || !fileType || !fileData) return res.status(400).json({ error: 'filename, fileType, and fileData required' });
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'];
  if (!allowed.includes(fileType)) return res.status(400).json({ error: 'unsupported file type' });
  try {
    const result = await pool.query(
      'INSERT INTO property_documents (property_id, filename, file_type, file_data, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [propId, filename, fileType, fileData, req.session.user.id]
    );
    await logAudit(req.session.user.id, req.session.user.email, 'upload_document', { property_id: propId, filename, fileType }, null, null, clientIp(req));
    res.json({ id: result.rows[0].id, filename, fileType });
  } catch (e) { res.status(500).json({ error: 'db error' }); }
});

app.get('/api/properties/:id/documents', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid property id' });
  try {
    const result = await pool.query(
      `SELECT d.id, d.filename, d.file_type, d.uploaded_at, u.email AS uploaded_by_email
       FROM property_documents d LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.property_id = $1 ORDER BY d.uploaded_at DESC`, [propId]);
    res.json({ documents: result.rows || [] });
  } catch (e) { res.status(500).json({ error: 'db error' }); }
});

app.get('/api/properties/:id/documents/:docId', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const propId = Number(req.params.id);
  const docId = Number(req.params.docId);
  if (!Number.isFinite(propId) || !Number.isFinite(docId)) return res.status(400).json({ error: 'invalid ids' });
  try {
    const result = await pool.query('SELECT filename, file_type, file_data FROM property_documents WHERE id=$1 AND property_id=$2', [docId, propId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const { filename, file_type, file_data } = result.rows[0];
    const base64Index = file_data.indexOf(',');
    const base64 = base64Index !== -1 ? file_data.substring(base64Index + 1) : file_data;
    const buffer = Buffer.from(base64, 'base64');
    res.set('Content-Type', file_type);
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (e) { res.status(500).json({ error: 'db error' }); }
});

app.delete('/api/properties/:id/documents/:docId', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  const docId = Number(req.params.docId);
  if (!Number.isFinite(propId) || !Number.isFinite(docId)) return res.status(400).json({ error: 'invalid ids' });
  try {
    const result = await pool.query('DELETE FROM property_documents WHERE id=$1 AND property_id=$2', [docId, propId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    await logAudit(req.session.user.id, req.session.user.email, 'delete_document', { property_id: propId, doc_id: docId }, null, null, clientIp(req));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'db error' }); }
});

app.post('/api/properties', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const {
    pin, address, county,
    price, square_feet, lot_size, year_built,
    on_major_road, traffic_vpd, on_corner_lot, direct_water_access, next_to_public_land,
    major_interstates, household_income_min, household_income_max, population_density,
    logistics_hubs, landmarks, water_sources, military_bases
  } = req.body || {};
  if (!pin || !pin.trim()) return res.status(400).json({ error: 'PIN required' });
  if (!address || !address.trim()) return res.status(400).json({ error: 'address required' });
  if (!county || !county.trim()) return res.status(400).json({ error: 'county required' });

  try {
    const result = await pool.query(
      `INSERT INTO properties (pin, address, county, created_by,
        price, square_feet, lot_size, year_built,
        on_major_road, traffic_vpd, on_corner_lot, direct_water_access, next_to_public_land,
        major_interstates, household_income_min, household_income_max, population_density,
        logistics_hubs, landmarks, water_sources, military_bases)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
      [pin.trim(), address.trim(), county.trim(), req.session.user.id,
       price || null, square_feet || null, lot_size || null, year_built || null,
       on_major_road || false, traffic_vpd || null, on_corner_lot || false,
       direct_water_access || false, next_to_public_land || false,
       JSON.stringify(major_interstates || []),
       household_income_min || null, household_income_max || null, population_density || null,
       JSON.stringify(logistics_hubs || []), JSON.stringify(landmarks || []),
       JSON.stringify(water_sources || []), JSON.stringify(military_bases || [])]
    );
    await logAudit(req.session.user.id, req.session.user.email, 'create_property', { pin, address, county }, null, null, clientIp(req));
    res.json({ id: result.rows[0].id, pin, address, county });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/properties', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const q = (req.query.q || '').trim().toLowerCase();
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10) || 20);
  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);

  try {
    let where = '';
    const countParams = [];
    const listParams = [];
    if (q) {
      where = 'WHERE LOWER(pin) LIKE $1 OR LOWER(address) LIKE $2 OR LOWER(county) LIKE $3';
      countParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
      listParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    listParams.push(limit, offset);
    const countResult = await pool.query(`SELECT COUNT(*)::int as total FROM properties ${where}`, countParams);
    const listResult = await pool.query(
      `SELECT id, pin, address, county, price, square_feet, lot_size, year_built,
              on_major_road, traffic_vpd, on_corner_lot, direct_water_access, next_to_public_land,
              major_interstates, household_income_min, household_income_max, population_density,
              logistics_hubs, landmarks, water_sources, military_bases, status, created_by, created_at, updated_at
       FROM properties ${where} ORDER BY id DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    res.json({ properties: listResult.rows || [], total: countResult.rows[0].total });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid id' });

  try {
    const result = await pool.query(
      `SELECT id, pin, address, county, price, square_feet, lot_size, year_built,
              on_major_road, traffic_vpd, on_corner_lot, direct_water_access, next_to_public_land,
              major_interstates, household_income_min, household_income_max, population_density,
              logistics_hubs, landmarks, water_sources, military_bases, status, created_by, created_at, updated_at
       FROM properties WHERE id = $1`, [propId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.put('/api/properties/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid id' });
  const {
    pin, address, county,
    price, square_feet, lot_size, year_built,
    on_major_road, traffic_vpd, on_corner_lot, direct_water_access, next_to_public_land,
    major_interstates, household_income_min, household_income_max, population_density,
    logistics_hubs, landmarks, water_sources, military_bases
  } = req.body || {};
  if (!pin || !pin.trim()) return res.status(400).json({ error: 'PIN required' });
  if (!address || !address.trim()) return res.status(400).json({ error: 'address required' });
  if (!county || !county.trim()) return res.status(400).json({ error: 'county required' });

  try {
    // Fetch old values before update for diff
    const oldResult = await pool.query(
      `SELECT pin, address, county, price, square_feet, lot_size, year_built,
              on_major_road, traffic_vpd, on_corner_lot, direct_water_access, next_to_public_land,
              major_interstates, household_income_min, household_income_max, population_density,
              logistics_hubs, landmarks, water_sources, military_bases
       FROM properties WHERE id=$1`, [propId]
    );
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const old = oldResult.rows[0];

    const newVals = {
      pin: pin.trim(), address: address.trim(), county: county.trim(),
      price: price || null, square_feet: square_feet || null, lot_size: lot_size || null, year_built: year_built || null,
      on_major_road: on_major_road || false, traffic_vpd: traffic_vpd || null,
      on_corner_lot: on_corner_lot || false, direct_water_access: direct_water_access || false,
      next_to_public_land: next_to_public_land || false,
      major_interstates: JSON.stringify(major_interstates || []),
      household_income_min: household_income_min || null, household_income_max: household_income_max || null,
      population_density: population_density || null,
      logistics_hubs: JSON.stringify(logistics_hubs || []), landmarks: JSON.stringify(landmarks || []),
      water_sources: JSON.stringify(water_sources || []), military_bases: JSON.stringify(military_bases || []),
      status: ['New','Under Review','Active','Other'].includes(status) ? status : 'New'
    };

    // Build field-level diff — normalize types for accurate comparison
    const changes = {};
    const arrayFields = new Set(['major_interstates', 'logistics_hubs', 'landmarks', 'water_sources', 'military_bases']);
    for (const key of Object.keys(newVals)) {
      let oldNorm, newNorm, oldDisplay, newDisplay;
      if (arrayFields.has(key)) {
        // Both sides normalised to JSON string; treat null/undefined DB value as "[]"
        oldNorm = JSON.stringify(old[key] ?? []);
        newNorm = newVals[key]; // already JSON.stringify'd
        oldDisplay = old[key] ?? [];
        newDisplay = JSON.parse(newNorm);
      } else {
        // Scalar: compare as strings, treat null/0/'' consistently
        const oldRaw = old[key] ?? null;
        const newRaw = newVals[key] ?? null;
        // Convert numbers to string for comparison, keep null as null
        oldNorm = oldRaw === null ? '' : String(oldRaw);
        newNorm = newRaw === null ? '' : String(newRaw);
        oldDisplay = oldRaw;
        newDisplay = newRaw;
      }
      if (oldNorm !== newNorm) changes[key] = { from: oldDisplay, to: newDisplay };
    }

    const result = await pool.query(
      `UPDATE properties SET
        pin=$1, address=$2, county=$3,
        price=$4, square_feet=$5, lot_size=$6, year_built=$7,
        on_major_road=$8, traffic_vpd=$9, on_corner_lot=$10,
        direct_water_access=$11, next_to_public_land=$12,
        major_interstates=$13, household_income_min=$14, household_income_max=$15,
        population_density=$16, logistics_hubs=$17, landmarks=$18,
        water_sources=$19, military_bases=$20, status=$21,
        updated_at=CURRENT_TIMESTAMP
       WHERE id=$22`,
      [newVals.pin, newVals.address, newVals.county,
       newVals.price, newVals.square_feet, newVals.lot_size, newVals.year_built,
       newVals.on_major_road, newVals.traffic_vpd, newVals.on_corner_lot,
       newVals.direct_water_access, newVals.next_to_public_land,
       newVals.major_interstates,
       newVals.household_income_min, newVals.household_income_max,
       newVals.population_density,
       newVals.logistics_hubs, newVals.landmarks,
       newVals.water_sources, newVals.military_bases, newVals.status,
       propId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    await logAudit(req.session.user.id, req.session.user.email, 'edit_property',
      { property_id: propId, address: newVals.address, changed_fields: Object.keys(changes), changes },
      null, null, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.delete('/api/properties/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid id' });

  try {
    const result = await pool.query('DELETE FROM properties WHERE id = $1', [propId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    await logAudit(req.session.user.id, req.session.user.email, 'delete_property', { property_id: propId }, null, null, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

// Quick status update — used by Kanban move buttons
app.patch('/api/properties/:id/status', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid id' });
  const { status } = req.body || {};
  const valid = ['New', 'Under Review', 'Active', 'Other'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'invalid status' });
  try {
    const oldResult = await pool.query('SELECT status, address FROM properties WHERE id=$1', [propId]);
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const { status: oldStatus, address } = oldResult.rows[0];
    await pool.query('UPDATE properties SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [status, propId]);
    await logAudit(req.session.user.id, req.session.user.email, 'edit_property',
      { property_id: propId, address, changed_fields: ['status'], changes: { status: { from: oldStatus, to: status } } },
      null, null, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/properties/:id/assign', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid property id' });
  const { userIds } = req.body || {};
  if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ error: 'userIds array required' });

  try {
    const propertyResult = await pool.query('SELECT id FROM properties WHERE id = $1', [propId]);
    if (propertyResult.rows.length === 0) return res.status(404).json({ error: 'property not found' });

    let assigned = 0;
    for (const uid of userIds) {
      const userId = Number(uid);
      if (!Number.isFinite(userId)) continue;
      const result = await pool.query(
        'INSERT INTO property_assignments (property_id, user_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [propId, userId, req.session.user.id]
      );
      if (result.rowCount > 0) assigned++;
    }

    await logAudit(req.session.user.id, req.session.user.email, 'assign_property', { property_id: propId, user_count: assigned, user_ids: userIds }, null, null, clientIp(req));
    res.json({ ok: true, assigned });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.delete('/api/properties/:id/assign/:userId', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  const userId = Number(req.params.userId);
  if (!Number.isFinite(propId) || !Number.isFinite(userId)) return res.status(400).json({ error: 'invalid ids' });

  try {
    await pool.query('DELETE FROM property_assignments WHERE property_id = $1 AND user_id = $2', [propId, userId]);
    await logAudit(req.session.user.id, req.session.user.email, 'unassign_property', { property_id: propId, user_id: userId }, null, null, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/me/properties', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const userId = req.session.user.id;

  try {
    const result = await pool.query(
      `SELECT p.id, p.pin, p.address, p.county, p.created_at, pa.assigned_at
       FROM properties p
       JOIN property_assignments pa ON p.id = pa.property_id
       WHERE pa.user_id = $1
       ORDER BY pa.assigned_at DESC`,
      [userId]
    );
    res.json({ properties: result.rows || [] });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/properties/:id/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid id' });

  try {
    const result = await pool.query(
      `SELECT u.id, u.email,
              CASE WHEN pa.id IS NOT NULL THEN 1 ELSE 0 END as assigned
       FROM users u
       LEFT JOIN property_assignments pa ON u.id = pa.user_id AND pa.property_id = $1
       ORDER BY u.email`,
      [propId]
    );
    res.json({ users: result.rows || [] });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

async function initializeAdminUser() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    return;
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL.toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD;
    const hashed = await bcrypt.hash(adminPass, 10);
    const existingResult = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existingResult.rows.length > 0) {
      await pool.query('UPDATE users SET password = $1, role = $2 WHERE id = $3', [hashed, 'admin', existingResult.rows[0].id]);
      console.log('Updated admin user:', adminEmail);
    } else {
      await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', [adminEmail, hashed, 'admin']);
      console.log('Created admin user:', adminEmail);
    }
  } catch (e) {
    console.warn('Admin setup failed:', e && e.message);
  }
}

app.get('/favicon.ico', (req, res) => {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  const publicDir = path.join(__dirname, '..', 'client', 'public');
  const candidates = [
    path.join(clientDist, 'favicon.ico'),
    path.join(clientDist, 'favicon-32x32.png'),
    path.join(clientDist, 'favicon.svg'),
    path.join(publicDir, 'favicon.ico'),
    path.join(publicDir, 'favicon-32x32.png'),
    path.join(publicDir, 'favicon.svg')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
  }
  res.status(404).end();
});

app.get('/site.webmanifest', (req, res) => {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  const publicDir = path.join(__dirname, '..', 'client', 'public');
  const m1 = path.join(clientDist, 'site.webmanifest');
  const m2 = path.join(publicDir, 'site.webmanifest');
  if (fs.existsSync(m1)) return res.sendFile(m1);
  if (fs.existsSync(m2)) return res.sendFile(m2);
  res.status(404).end();
});

app.get('/api/status', async (req, res) => {
  res.json({
    sessionStore: sessionStoreType,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSession: !!req.session?.user,
    sessionId: req.session?.id || null,
    cookieHeader: req.headers.cookie || null
  });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (require('fs').existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
    res.status(err && err.statusCode ? err.statusCode : 500).json({ error: (err && err.message) || 'internal server error' });
  } else {
    res.status(err && err.statusCode ? err.statusCode : 500).send((err && err.message) || 'internal server error');
  }
});

(async () => {
  try {
    await initializeSchema();
    await initializeAdminUser();
    await initializeSessionMiddleware();
    app.listen(PORT, () => console.log(`Server listening on port ${PORT} [session: ${sessionStoreType}]`));
  } catch (err) {
    console.error('Failed to start server:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();

