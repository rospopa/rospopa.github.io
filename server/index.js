require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const https = require('https');
const { Resend } = require('resend');
const { rateLimit } = require('express-rate-limit');
const compression = require('compression');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const RECAPTCHA_API_KEY = process.env.RECAPTCHA_API_KEY;
const RECAPTCHA_PROJECT_ID = 'rospopa-recaptcha';
const RECAPTCHA_SITE_KEY = '6LerA3ctAAAAAKpS3caYCY9pDLR26TQY060EFpYv';
const RECAPTCHA_MIN_SCORE = 0.5;
const FROM_EMAIL = 'noreply@rospopa.com';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const GOOGLE_AI_MODEL = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';
const GOOGLE_AI_FREE_TIER_LIMIT = 250;
const GOOGLE_AI_FREE_TIER_LABEL = 'Configured free-tier cap';
const PROVIDER_USAGE_RESET_START = new Date('2026-08-10T00:00:00.000Z');
const TRADINGVIEW_WEBHOOK_SECRET = process.env.TRADINGVIEW_WEBHOOK_SECRET || '';
const MARKET_SYMBOL_SUGGESTIONS = [
  { symbol: 'AAPL', exchange: 'NASDAQ', display_name: 'Apple Inc.', type: 'stock' },
  { symbol: 'MSFT', exchange: 'NASDAQ', display_name: 'Microsoft Corporation', type: 'stock' },
  { symbol: 'NVDA', exchange: 'NASDAQ', display_name: 'NVIDIA Corporation', type: 'stock' },
  { symbol: 'TSLA', exchange: 'NASDAQ', display_name: 'Tesla, Inc.', type: 'stock' },
  { symbol: 'AMZN', exchange: 'NASDAQ', display_name: 'Amazon.com, Inc.', type: 'stock' },
  { symbol: 'META', exchange: 'NASDAQ', display_name: 'Meta Platforms, Inc.', type: 'stock' },
  { symbol: 'GOOGL', exchange: 'NASDAQ', display_name: 'Alphabet Inc. Class A', type: 'stock' },
  { symbol: 'GOOG', exchange: 'NASDAQ', display_name: 'Alphabet Inc. Class C', type: 'stock' },
  { symbol: 'UBER', exchange: 'NYSE', display_name: 'Uber Technologies, Inc.', type: 'stock' },
  { symbol: 'CRM', exchange: 'NYSE', display_name: 'Salesforce, Inc.', type: 'stock' },
  { symbol: 'GDRX', exchange: 'NASDAQ', display_name: 'GoodRx Holdings, Inc.', type: 'stock' },
  { symbol: 'PLTR', exchange: 'NASDAQ', display_name: 'Palantir Technologies Inc.', type: 'stock' },
  { symbol: 'CBRS', exchange: 'NASDAQ', display_name: 'Cerebras Systems Inc.', type: 'stock' },
  { symbol: 'SPY', exchange: 'AMEX', display_name: 'SPDR S&P 500 ETF Trust', type: 'etf' },
  { symbol: 'QQQ', exchange: 'NASDAQ', display_name: 'Invesco QQQ Trust', type: 'etf' },
  { symbol: 'IWM', exchange: 'AMEX', display_name: 'iShares Russell 2000 ETF', type: 'etf' },
  { symbol: 'DIA', exchange: 'AMEX', display_name: 'SPDR Dow Jones Industrial Average ETF Trust', type: 'etf' },
  { symbol: 'VTI', exchange: 'AMEX', display_name: 'Vanguard Total Stock Market ETF', type: 'etf' },
  { symbol: 'GLD', exchange: 'AMEX', display_name: 'SPDR Gold Shares', type: 'etf' },
  { symbol: 'SLV', exchange: 'AMEX', display_name: 'iShares Silver Trust', type: 'etf' },
  { symbol: 'BTCUSD', exchange: 'INDEX', display_name: 'Bitcoin / U.S. Dollar', type: 'crypto' },
  { symbol: 'ETHUSD', exchange: 'INDEX', display_name: 'Ethereum / U.S. Dollar', type: 'crypto' },
  { symbol: 'SOLUSD', exchange: 'INDEX', display_name: 'Solana / U.S. Dollar', type: 'crypto' },
  { symbol: 'EURUSD', exchange: 'FX', display_name: 'Euro / U.S. Dollar', type: 'forex' },
  { symbol: 'GBPUSD', exchange: 'FX', display_name: 'British Pound / U.S. Dollar', type: 'forex' },
  { symbol: 'USDJPY', exchange: 'FX', display_name: 'U.S. Dollar / Japanese Yen', type: 'forex' },
  { symbol: 'ZN1!', exchange: 'CBOT', display_name: 'U.S. 10 Year Treasury Note Futures', type: 'bond' }
];

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory set of currently logged-in user IDs
const onlineUsers = new Set();

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// ─── Simple in-memory cache ──────────────────────────────────────
// Keyed by string. Each entry: { data, etag, ts }
const _cache = new Map();
const CACHE_TTL_MS = 15000; // 15 seconds — short enough to feel live, long enough to absorb bursts

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry;
}
function cacheSet(key, data) {
  const etag = '"' + crypto.createHash('md5').update(JSON.stringify(data)).digest('hex').slice(0, 16) + '"';
  _cache.set(key, { data, etag, ts: Date.now() });
  return etag;
}
function cacheInvalidate(patternOrKeys, isExact = false) {
  if (Array.isArray(patternOrKeys)) {
    for (const key of patternOrKeys) {
      _cache.delete(key);
    }
  } else if (isExact) {
    _cache.delete(patternOrKeys);
  } else {
    for (const key of _cache.keys()) {
      if (key.startsWith(patternOrKeys)) _cache.delete(key);
    }
  }
}

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
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0`);
  // Backfill last_login from audit_logs for users who logged in before column existed
  await pool.query(`
    UPDATE users u SET last_login = sub.last_login
    FROM (
      SELECT target_user_id AS uid, MAX(created_at) AS last_login
      FROM audit_logs WHERE action = 'login' AND target_user_id IS NOT NULL
      GROUP BY target_user_id
    ) sub
    WHERE u.id = sub.uid AND (u.last_login IS NULL OR sub.last_login > u.last_login)
  `).catch(() => {});
  // Also backfill using acted_by / admin_id when target_user_id is null (self-login rows)
  await pool.query(`
    UPDATE users u SET last_login = sub.last_login
    FROM (
      SELECT admin_id AS uid, MAX(created_at) AS last_login
      FROM audit_logs WHERE action = 'login' AND admin_id IS NOT NULL
      GROUP BY admin_id
    ) sub
    WHERE u.id = sub.uid AND (u.last_login IS NULL OR sub.last_login > u.last_login)
  `).catch(() => {});

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
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS grm NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS cap_rate NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS cash_on_cash NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS irr NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_per_sqft NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS rent_to_sales_ratio NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS num_skus INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_per_acre NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS electrical_voltage INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS electrical_amperage INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS asset_type TEXT`);
  // Income block
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS gross_scheduled_rent NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS vacancy_rate NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS other_income NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS operating_expenses NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS reserves_capex NUMERIC`);
  // Debt block
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS loan_amount NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS ltv NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS interest_rate NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS amortization_term INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS interest_only_period INTEGER`);
  // Deal block
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS unit_count INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS closing_costs NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS hold_period INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS rent_growth NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS expense_growth NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS exit_cap_rate NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS cost_of_sale NUMERIC`);
  // Tenant block
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenant_gross_sales NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenant_base_rent NUMERIC`);
  // Operating block
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS management_fee_pct NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS insurance NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_taxes NUMERIC`);
  // Tax / Cost Segregation block
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS land_value_pct NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS cost_seg_bonus_pct NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS effective_tax_rate NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS depreciation_recapture_rate NUMERIC`);
  // Debt / Refinance block
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS refi_ltv NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS refi_rate NUMERIC`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS refi_year INTEGER`);
  await pool.query(`ALTER TABLE properties ADD COLUMN IF NOT EXISTS dcf_model JSONB DEFAULT '{}'`);

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

  await pool.query(`CREATE TABLE IF NOT EXISTS contact_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS contact_attachments (
    id SERIAL PRIMARY KEY,
    note_id INTEGER NOT NULL REFERENCES contact_notes(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_data TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS market_symbols (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    display_name TEXT,
    exchange TEXT,
    note TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS market_alert_events (
    id SERIAL PRIMARY KEY,
    symbol TEXT,
    exchange TEXT,
    alert_name TEXT,
    timeframe TEXT,
    direction TEXT,
    payload JSONB NOT NULL,
    raw_body TEXT,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS provider_usage (
    provider TEXT PRIMARY KEY,
    used_credits NUMERIC NOT NULL DEFAULT 0,
    credit_limit NUMERIC NOT NULL DEFAULT 0,
    credit_cost_per_request NUMERIC NOT NULL DEFAULT 1,
    reset_period TEXT NOT NULL DEFAULT 'manual',
    reset_anchor TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`ALTER TABLE provider_usage ADD COLUMN IF NOT EXISTS reset_period TEXT NOT NULL DEFAULT 'manual'`);
  await pool.query(`ALTER TABLE provider_usage ADD COLUMN IF NOT EXISTS reset_anchor TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE provider_usage ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`
    INSERT INTO provider_usage (provider, used_credits, credit_limit, credit_cost_per_request, reset_period, reset_anchor, last_reset_at)
    VALUES
      ('hunter', 0, 50, 0.5, 'monthly', $1, $1),
      ('numverify', 0, 100, 1, 'monthly', $2, $2),
      ('google-ai-studio-search', 0, 250, 1, 'daily', $3, $3)
    ON CONFLICT (provider) DO UPDATE SET
      credit_limit = EXCLUDED.credit_limit,
      credit_cost_per_request = EXCLUDED.credit_cost_per_request,
      reset_period = EXCLUDED.reset_period,
      reset_anchor = COALESCE(provider_usage.reset_anchor, EXCLUDED.reset_anchor),
      last_reset_at = COALESCE(provider_usage.last_reset_at, EXCLUDED.last_reset_at)
  `, [
    PROVIDER_USAGE_RESET_START.toISOString(),
    PROVIDER_USAGE_RESET_START.toISOString(),
    PROVIDER_USAGE_RESET_START.toISOString()
  ]);

  // Drop and recreate session table with correct schema for connect-pg-simple v8
  await pool.query(`DROP TABLE IF EXISTS "session"`);
  await pool.query(`CREATE TABLE "session" (
    sid VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP(6) NOT NULL
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_properties_status" ON properties (status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_properties_asset_type" ON properties (asset_type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_properties_updated_at" ON properties (updated_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_property_assignments_user_assigned" ON property_assignments (user_id, assigned_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_property_assignments_property_id" ON property_assignments (property_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_contact_notes_user_created" ON contact_notes (user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_users_created_at" ON users (created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_users_email_lower" ON users (LOWER(email))`);
}

const app = express();

// Gzip all responses ≥ 1KB
app.use(compression({ threshold: 1024 }));

// Origin-guard: verifies requests arrived via the Cloudflare zone,
// which injects x-origin-key through a Transform Rule.
const _originKey = process.env.ORIGIN_KEY || '';
const _healthPath = process.env.HEALTH_PATH || '/healthz';
if (!_originKey) {
  console.warn('[origin-guard] WARNING: ORIGIN_KEY is not set — all non-health requests will be rejected with 403');
}
app.use((req, res, next) => {
  if (req.path === _healthPath) return next();
  if (!_originKey) return res.status(403).send('Forbidden');
  const incoming = req.headers['x-origin-key'] || '';
  const a = Buffer.from(incoming);
  const b = Buffer.from(_originKey);
  if (a.length !== b.length) return res.status(403).send('Forbidden');
  if (!crypto.timingSafeEqual(a, b)) return res.status(403).send('Forbidden');
  next();
});

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

async function postJson(url, payload) {
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }
    return { ok: response.ok, status: response.status, data };
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const target = new URL(url);
    const request = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let data = null;
        if (raw) {
          try { data = JSON.parse(raw); } catch { data = { message: raw }; }
        }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode || 502, data });
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

async function getJson(url) {
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }
    return { ok: response.ok, status: response.status, data };
  }

  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let data = null;
        if (raw) {
          try { data = JSON.parse(raw); } catch { data = { message: raw }; }
        }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode || 502, data });
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function extractUpstreamError(data, fallback = 'lookup failed') {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  return errors[0]?.details
    || errors[0]?.message
    || data?.message
    || data?.error
    || data?.detail
    || fallback;
}

function getMarketSymbolSuggestions(query) {
  const trimmed = String(query || '').trim().toUpperCase();
  if (!trimmed) return [];
  const normalized = trimmed.replace(/[^A-Z0-9:.]/g, '');
  return MARKET_SYMBOL_SUGGESTIONS
    .filter(item => {
      const fullSymbol = `${item.exchange}:${item.symbol}`.toUpperCase();
      const displayName = item.display_name.toUpperCase();
      return item.symbol.includes(normalized)
        || fullSymbol.includes(normalized)
        || displayName.includes(trimmed);
    })
    .slice(0, 8)
    .map(item => ({
      ...item,
      fullSymbol: `${item.exchange}:${item.symbol}`
    }));
}

function normalizeTradingViewExchange(exchange) {
  const value = String(exchange || '').trim().toUpperCase();
  if (!value) return '';
  const aliases = {
    NMS: 'NASDAQ',
    NAS: 'NASDAQ',
    NGM: 'NASDAQ',
    NCM: 'NASDAQ',
    NASDAQGM: 'NASDAQ',
    NASDAQCM: 'NASDAQ',
    NASDAQGS: 'NASDAQ',
    NYQ: 'NYSE',
    NYC: 'NYSE',
    ASE: 'AMEX',
    PCX: 'AMEX',
    ARCA: 'AMEX',
    PNK: 'OTC',
    OTB: 'OTC',
    BATS: 'CBOE',
    BTS: 'CBOE',
    CBOE: 'CBOE',
    NEO: 'NEO',
    TOR: 'TSX',
    VAN: 'TSXV',
    LSE: 'LSE',
    AIM: 'LSE',
    FRA: 'FWB',
    GER: 'XETR',
    MUN: 'FWB',
    DUS: 'FWB',
    BER: 'FWB',
    HAM: 'FWB',
    STU: 'FWB',
    PAR: 'EURONEXT',
    AMS: 'EURONEXT',
    BRU: 'EURONEXT',
    LIS: 'EURONEXT',
    MIL: 'MIL',
    MAD: 'BME',
    SWX: 'SIX',
    VIE: 'VIE',
    OSL: 'OSL',
    CPH: 'OMXCOP',
    STO: 'OMXSTO',
    HEL: 'OMXHEX',
    ICE: 'OMXICE',
    TAI: 'TWSE',
    TWO: 'TPEX',
    HKG: 'HKEX',
    SHH: 'SSE',
    SHZ: 'SZSE',
    TOK: 'TSE',
    OSA: 'TSE',
    KSC: 'KRX',
    KOE: 'KRX',
    SES: 'SGX',
    JKT: 'IDX',
    BKK: 'SET',
    KLS: 'KLSE',
    SAO: 'BMFBOVESPA',
    BUE: 'BCBA',
    MEX: 'BMV',
    JNB: 'JSE',
    TLV: 'TASE',
    IST: 'BIST',
    WAR: 'GPW',
    PRA: 'PSE',
    ATH: 'ATHEX',
    RFX: 'INDEX',
    FGI: 'INDEX',
    CCC: 'CRYPTO'
  };
  return aliases[value] || value;
}
function normalizeMarketSymbolRow(row) {
  if (!row) return row;
  const normalizedType = String(row.note || '').trim().toLowerCase();
  const normalizedExchange = normalizeTradingViewExchange(row.exchange || '');
  const normalizedSymbol = normalizeTradingViewSymbol(row.symbol || '', normalizedExchange, normalizedType);
  return {
    ...row,
    symbol: normalizedSymbol,
    exchange: normalizedExchange
  };
}

function normalizeTradingViewSymbol(symbol, exchange, type = '') {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  const normalizedExchange = normalizeTradingViewExchange(exchange || '');
  const normalizedType = String(type || '').trim().toLowerCase();

  if (!normalizedSymbol) return '';

  if ((normalizedType === 'cryptocurrency' || normalizedType === 'crypto') && normalizedSymbol.includes('-')) {
    return normalizedSymbol.replace(/-/g, '');
  }

  return normalizedSymbol;
}
async function getYahooFinanceSymbolSuggestions(query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(trimmed)}&quotesCount=8&newsCount=0`;
  const upstream = await getJson(url);
  if (!upstream.ok) {
    throw new Error(`Yahoo Finance search failed (${upstream.status})`);
  }

  const quotes = Array.isArray(upstream.data?.quotes) ? upstream.data.quotes : [];
  return quotes
    .filter(item => item?.symbol && item?.quoteType !== 'ALTSYMBOL')
    .slice(0, 8)
    .map(item => {
      const exchange = normalizeTradingViewExchange(item.exchange || item.exchDisp || '');
      const type = String(item.quoteType || item.typeDisp || '').toLowerCase();
      const symbol = normalizeTradingViewSymbol(item.symbol || '', exchange, type);
      return {
        symbol,
        exchange,
        display_name: String(item.shortname || item.longname || item.symbol || '').trim(),
        type,
        fullSymbol: exchange ? `${exchange}:${symbol}` : symbol
      };
    });
}

async function getProviderUsage(provider) {
  const result = await pool.query(
    `SELECT provider, used_credits, credit_limit, credit_cost_per_request, reset_period, reset_anchor, last_reset_at, updated_at
     FROM provider_usage
     WHERE provider = $1`,
    [provider]
  );
  return result.rows[0] || null;
}

async function listProviderUsage() {
  const result = await pool.query(
    `SELECT provider, used_credits, credit_limit, credit_cost_per_request, reset_period, reset_anchor, last_reset_at, updated_at
     FROM provider_usage
     ORDER BY provider ASC`
  );
  return result.rows;
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date, months) {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function calculateNextReset(anchorDate, period, now = new Date()) {
  if (!(anchorDate instanceof Date) || Number.isNaN(anchorDate.getTime())) return null;
  if (period !== 'daily' && period !== 'monthly') return null;

  let next = new Date(anchorDate.getTime());
  while (next <= now) {
    next = period === 'daily' ? addUtcDays(next, 1) : addUtcMonths(next, 1);
  }
  return next;
}

function shouldResetProviderUsage(row, now = new Date()) {
  if (!row?.reset_period || row.reset_period === 'manual') return false;
  const anchor = row.reset_anchor ? new Date(row.reset_anchor) : null;
  const nextReset = calculateNextReset(anchor, row.reset_period, now);
  return !!nextReset && now >= nextReset;
}

async function resetProviderUsage(provider, resetAt) {
  const result = await pool.query(
    `UPDATE provider_usage
     SET used_credits = 0,
        last_reset_at = $2,
        updated_at = CURRENT_TIMESTAMP
     WHERE provider = $1
     RETURNING provider, used_credits, credit_limit, credit_cost_per_request, reset_period, reset_anchor, last_reset_at, updated_at`,
    [provider, resetAt.toISOString()]
  );
  return result.rows[0] || null;
}

async function syncProviderUsageWindow(provider) {
  const row = await getProviderUsage(provider);
  if (!row) return null;
  const now = new Date();
  if (!shouldResetProviderUsage(row, now)) {
    return row;
  }
  return resetProviderUsage(provider, now);
}

async function incrementProviderUsage(provider) {
  await syncProviderUsageWindow(provider);
  const result = await pool.query(
    `UPDATE provider_usage
     SET used_credits = used_credits + credit_cost_per_request,
     updated_at = CURRENT_TIMESTAMP
     WHERE provider = $1
     RETURNING provider, used_credits, credit_limit, credit_cost_per_request, reset_period, reset_anchor, last_reset_at, updated_at`,
    [provider]
  );
  return result.rows[0] || null;
}

async function setProviderUsageLimit(provider, limit) {
  const numericLimit = Number(limit);
  if (!Number.isFinite(numericLimit) || numericLimit < 0) {
    throw new Error(`Invalid provider usage limit for ${provider}`);
  }

  const result = await pool.query(
    `UPDATE provider_usage
     SET credit_limit = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE provider = $1
     RETURNING provider, used_credits, credit_limit, credit_cost_per_request, reset_period, reset_anchor, last_reset_at, updated_at`,
    [provider, numericLimit]
  );
  return result.rows[0] || null;
}

function serializeProviderUsageRow(row) {
  const used = Number(row.used_credits || 0);
  const limit = Number(row.credit_limit || 0);
  const costPerRequest = Number(row.credit_cost_per_request || 0);
  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    costPerRequest,
    resetPeriod: row.reset_period || 'manual',
    resetAnchor: row.reset_anchor || null,
    lastResetAt: row.last_reset_at || null,
    nextResetAt: calculateNextReset(row.reset_anchor ? new Date(row.reset_anchor) : null, row.reset_period || 'manual')?.toISOString() || null
  };
}

async function applyGoogleAiUsagePolicy() {
  await syncProviderUsageWindow('google-ai-studio-search');
  return setProviderUsageLimit('google-ai-studio-search', GOOGLE_AI_FREE_TIER_LIMIT);
}

async function refreshProviderUsagePolicies() {
  await Promise.all([
    syncProviderUsageWindow('hunter'),
    syncProviderUsageWindow('numverify'),
    applyGoogleAiUsagePolicy()
  ]);
}
function sanitizePhone(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlausiblePhone(value) {
  if (!value) return false;
  if (value.length < 7 || value.length > 32) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && /^[\d\s+().-]+$/.test(value);
}

function isNumverifyProviderError(data) {
  return data?.success === false || !!data?.error;
}

function sanitizeLookupQuery(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function postJsonWithHeaders(url, payload, headers = {}) {
  if (typeof fetch === 'function') {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }
    return { ok: response.ok, status: response.status, data };
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const target = new URL(url);
    const request = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body)
      }
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        let data = null;
        if (raw) {
          try { data = JSON.parse(raw); } catch { data = { message: raw }; }
        }
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode || 502, data });
      });
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
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
      'SELECT first_name, last_name, profile_photo, login_count FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) return res.json({ found: false });
    const { first_name, last_name, profile_photo, login_count } = result.rows[0];
    res.json({ found: true, first_name, last_name, profile_photo, login_count: login_count || 0 });
  } catch { res.json({ found: false }); }
});

app.post('/api/lookup/email', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const email = sanitizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'email required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'valid email required' });

  const hunterApiKey = process.env.HUNTER_API_KEY;
  if (!hunterApiKey) {
    return res.status(503).json({ error: 'lookup service not configured', code: 'LOOKUP_NOT_CONFIGURED' });
  }

  try {
    const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(hunterApiKey)}`;
    const upstream = await getJson(url);
    if (!upstream.ok) {
      const message = extractUpstreamError(upstream.data);
      return res.status(502).json({
        error: message,
        upstream_status: upstream.status
      });
    }

    const verifier = upstream.data?.data;
    if (!verifier) {
      return res.status(502).json({
        error: extractUpstreamError(upstream.data, 'lookup returned no verification data')
      });
    }

    const hasMxRecords = Array.isArray(verifier.mx_records) ? verifier.mx_records.length > 0 : !!verifier.mx_records;
    const sourceCount = Array.isArray(verifier.sources) ? verifier.sources.length : (typeof verifier.sources === 'number' ? verifier.sources : null);

    await incrementProviderUsage('hunter');

    return res.json({
      ok: true,
      input: email,
      result: {
        status: verifier.status ?? null,
        result: verifier.result ?? null,
        score: verifier.score ?? null,
        regexp: verifier.regexp ?? null,
        gibberish: verifier.gibberish ?? null,
        disposable: verifier.disposable ?? null,
        webmail: verifier.webmail ?? null,
        mx_records: hasMxRecords,
        mx_record_count: Array.isArray(verifier.mx_records) ? verifier.mx_records.length : (verifier.mx_records ? 1 : 0),
        smtp_server: verifier.smtp_server ?? null,
        smtp_check: verifier.smtp_check ?? null,
        accept_all: verifier.accept_all ?? null,
        block: verifier.block ?? null,
        sources: sourceCount,
        domain: verifier.domain ?? null,
        duration: verifier.duration ?? null,
        email: verifier.email ?? email,
        raw: verifier
      }
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'lookup failed' });
  }
});

app.post('/api/lookup/phone', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const phone = sanitizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: 'phone required' });
  if (!isPlausiblePhone(phone)) return res.status(400).json({ error: 'valid phone required' });

  const numverifyApiKey = process.env.NUMVERIFY_API_KEY;
  if (!numverifyApiKey) {
    return res.status(503).json({ error: 'lookup service not configured', code: 'LOOKUP_NOT_CONFIGURED' });
  }

  try {
    const url = `https://apilayer.net/api/validate?access_key=${encodeURIComponent(numverifyApiKey)}&number=${encodeURIComponent(phone)}`;
    const upstream = await getJson(url);

    if (!upstream.ok || isNumverifyProviderError(upstream.data)) {
      return res.status(502).json({ error: 'phone lookup provider error' });
    }

    const validation = upstream.data;
    await incrementProviderUsage('numverify');
    return res.json({
      ok: true,
      input: phone,
      result: {
        valid: validation.valid ?? false,
        international_format: validation.international_format ?? null,
        local_format: validation.local_format ?? null,
        country_prefix: validation.country_prefix ?? null,
        country_code: validation.country_code ?? null,
        country_name: validation.country_name ?? null,
        location: validation.location ?? null,
        carrier: validation.carrier ?? null,
        line_type: validation.line_type ?? null,
        raw: validation
      }
    });

  } catch (error) {
    return res.status(502).json({ error: 'phone lookup provider error' });
  }
});

app.post('/api/lookup/grounded-search', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const query = sanitizeLookupQuery(req.body?.query);
  if (!query) return res.status(400).json({ error: 'query required' });
  if (!GOOGLE_API_KEY) {
    return res.status(503).json({ error: 'grounded search is not configured', code: 'LOOKUP_NOT_CONFIGURED' });
  }

  try {
    const usageRow = await applyGoogleAiUsagePolicy();
    const usage = usageRow ? serializeProviderUsageRow(usageRow) : null;
    if (usage && usage.remaining < usage.costPerRequest) {
      return res.status(429).json({
        error: 'Google AI Studio free-tier cap reached',
        code: 'LOOKUP_LIMIT_REACHED'
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
    const upstream = await postJsonWithHeaders(url, {
      model: GOOGLE_AI_MODEL,
      input: query,
      tools: [{ type: 'google_search' }],
      systemInstruction: 'Answer with a concise factual summary grounded in web sources. Prefer business-relevant information and avoid speculation.'
    }, {
      'Content-Type': 'application/json'
    });
    if (!upstream.ok) {
      return res.status(502).json({
        error: extractUpstreamError(upstream.data, 'grounded search failed'),
        upstream_status: upstream.status
      });
    }

    const steps = Array.isArray(upstream.data?.steps) ? upstream.data.steps : [];
    const outputStep = steps.find(step => step?.type === 'model_output') || null;
    const contentBlocks = Array.isArray(outputStep?.content) ? outputStep.content : [];
    const textBlock = contentBlocks.find(block => block?.type === 'text') || null;
    const text = textBlock?.text?.trim() || '';
    const annotations = Array.isArray(textBlock?.annotations) ? textBlock.annotations : [];
    const sources = annotations
      .filter(annotation => annotation?.type === 'url_citation' && annotation?.url)
      .map((annotation, index) => ({
        title: annotation.title || `Source ${index + 1}`,
        url: annotation.url
      }))
      .filter((source, index, array) => array.findIndex(item => item.url === source.url) === index);
    const searchCallStep = steps.find(step => step?.type === 'google_search_call') || null;
    const webSearchQueries = Array.isArray(searchCallStep?.arguments?.queries) ? searchCallStep.arguments.queries : [];
    const searchResultStep = steps.find(step => step?.type === 'google_search_result') || null;
    const renderedContent = Array.isArray(searchResultStep?.result)
      ? searchResultStep.result
        .map(entry => entry?.search_suggestions)
        .find(Boolean) || null
      : null;

    await incrementProviderUsage('google-ai-studio-search');

    return res.json({
      ok: true,
      query,
      result: {
        text,
        sources,
        webSearchQueries,
        renderedContent,
        raw: upstream.data
      }
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'grounded search failed' });
  }
});

app.get('/api/lookup/usage', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    await refreshProviderUsagePolicies();
    const rows = await listProviderUsage();
    const usage = rows.reduce((acc, row) => {
      acc[row.provider] = serializeProviderUsageRow(row);
      return acc;
    }, {});
    return res.json({
      hunter: usage.hunter || { used: 0, limit: 0, remaining: 0, costPerRequest: 0 },
      numverify: usage.numverify || { used: 0, limit: 0, remaining: 0, costPerRequest: 0 },
      'google-ai-studio-search': {
        ...(usage['google-ai-studio-search'] || { used: 0, limit: 0, remaining: 0, costPerRequest: 1 }),
        quotaDisplayName: `Google AI Studio (${GOOGLE_AI_MODEL})`,
        quotaMetric: null,
        quotaDimensions: {},
        quotaDimensionMatch: null,
        quotaSource: 'backend-config',
        quotaPolicyLabel: GOOGLE_AI_FREE_TIER_LABEL,
        quotaExactMatch: false
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'failed to load provider usage' });
  }
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
      from: `ROSPOPA <${FROM_EMAIL}>`,
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
    const userObj = { id: row.id, email: row.email, role: row.role || 'user', first_name: row.first_name, last_name: row.last_name, organization: row.organization, phone_number: row.phone_number, buy_box: row.buy_box, profile_photo: row.profile_photo };
    req.session.user = userObj;
    req.session.save(err => {
      if (err) {
        console.error('Session save error on login:', err);
        return res.status(500).json({ error: 'session save failed' });
      }
      console.log('Session saved ok, sid:', req.session.id);
      onlineUsers.add(row.id);
      pool.query('UPDATE users SET last_login = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1', [row.id]).catch(() => {});
      logAudit(row.id, row.email, 'login', { ip: clientIp(req) }, null, null, clientIp(req));
      res.json({ user: { ...userObj, login_count: (row.login_count || 0) + 1 } });
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
    if (user) { onlineUsers.delete(user.id); logAudit(user.id, user.email, 'logout', { ip }, null, null, ip); }
    res.json({ ok: true });
  });
});

app.get('/api/me', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ user: null });
  onlineUsers.add(req.session.user.id); // re-sync after server restart
  try {
    const r = await pool.query('SELECT profile_photo, login_count FROM users WHERE id=$1', [req.session.user.id]);
    const extra = r.rows.length ? { profile_photo: r.rows[0].profile_photo, login_count: r.rows[0].login_count } : {};
    res.json({ user: { ...req.session.user, ...extra } });
  } catch {
    res.json({ user: req.session.user });
  }
});

app.get('/api/online-status', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await pool.query(`SELECT id, last_login FROM users ORDER BY id`);
    const lastLogin = {};
    result.rows.forEach(r => { lastLogin[r.id] = r.last_login; });
    res.json({ online: [...onlineUsers], lastLogin });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
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
      `SELECT id, email, role, first_name, last_name, organization, phone_number, buy_box, profile_photo, created_at, updated_at, last_login FROM users ${where} ORDER BY id DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    res.json({ users: listResult.rows, total: countResult.rows[0].total });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/markets/symbols', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await pool.query(
      `SELECT id, symbol, display_name, exchange, note, created_at, updated_at
       FROM market_symbols
       ORDER BY updated_at DESC, id DESC`
    );
    res.json({ symbols: (result.rows || []).map(normalizeMarketSymbolRow) });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/markets/symbol-search', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const query = String(req.query.q || '').trim();
  if (!query) return res.json({ suggestions: [] });
  try {
    const yahooSuggestions = await getYahooFinanceSymbolSuggestions(query);
    if (yahooSuggestions.length) {
      return res.json({ suggestions: yahooSuggestions, source: 'yahoo-finance' });
    }
  } catch {}
  res.json({ suggestions: getMarketSymbolSuggestions(query), source: 'fallback' });
});

app.post('/api/markets/symbols', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const symbol = String(req.body?.symbol || '').trim().toUpperCase();
  const displayName = String(req.body?.display_name || '').trim();
  const exchange = normalizeTradingViewExchange(req.body?.exchange || '');
  const note = String(req.body?.note || '').trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    const result = await pool.query(
      `INSERT INTO market_symbols (symbol, display_name, exchange, note, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, symbol, display_name, exchange, note, created_at, updated_at`,
      [symbol, displayName || null, exchange || null, note || null, req.session.user.id]
    );
    res.json({ symbol: normalizeMarketSymbolRow(result.rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'symbol already saved' });
    res.status(500).json({ error: 'db error' });
  }
});

app.put('/api/markets/symbols/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });

  const symbol = String(req.body?.symbol || '').trim().toUpperCase();
  const displayName = String(req.body?.display_name || '').trim();
  const exchange = normalizeTradingViewExchange(req.body?.exchange || '');
  const note = String(req.body?.note || '').trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    const result = await pool.query(
      `UPDATE market_symbols
       SET symbol = $1,
           display_name = $2,
           exchange = $3,
           note = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, symbol, display_name, exchange, note, created_at, updated_at`,
      [symbol, displayName || null, exchange || null, note || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'not found' });
    res.json({ symbol: normalizeMarketSymbolRow(result.rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'symbol already saved' });
    res.status(500).json({ error: 'db error' });
  }
});

app.delete('/api/markets/symbols/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });

  try {
    const result = await pool.query('DELETE FROM market_symbols WHERE id = $1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/markets/alerts', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await pool.query(
      `SELECT id, symbol, exchange, alert_name, timeframe, direction, payload, raw_body, received_at
       FROM market_alert_events
       ORDER BY received_at DESC, id DESC
       LIMIT 100`
    );
    res.json({ alerts: result.rows || [] });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/markets/tradingview-webhook', async (req, res) => {
  const providedSecret = String(req.headers['x-webhook-secret'] || req.query.secret || req.body?.secret || '').trim();
  if (!TRADINGVIEW_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'tradingview webhook is not configured' });
  }
  if (!providedSecret || providedSecret !== TRADINGVIEW_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'invalid webhook secret' });
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const symbol = String(payload.symbol || payload.ticker || '').trim().toUpperCase() || null;
  const exchange = String(payload.exchange || '').trim().toUpperCase() || null;
  const alertName = String(payload.alert_name || payload.name || payload.title || '').trim() || null;
  const timeframe = String(payload.timeframe || payload.interval || '').trim() || null;
  const direction = String(payload.direction || payload.side || payload.action || '').trim() || null;

  try {
    await pool.query(
      `INSERT INTO market_alert_events (symbol, exchange, alert_name, timeframe, direction, payload, raw_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [symbol, exchange, alertName, timeframe, direction, JSON.stringify(payload), JSON.stringify(req.body || {})]
    );
    res.json({ ok: true });
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
    // Fetch current values before update for before/after diff
    const preResult = await pool.query('SELECT first_name,last_name,organization,phone_number,buy_box,role,email FROM users WHERE id=$1', [id]);
    if (preResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const pre = preResult.rows[0];

    const updateResult = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
    if (updateResult.rowCount === 0) return res.status(404).json({ error: 'not found' });
    const userResult = await pool.query('SELECT id, email, role, first_name, last_name, organization, phone_number, buy_box, profile_photo, created_at, updated_at FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const row = userResult.rows[0];
    // Build before/after diff for loggable fields
    const trackFields = ['first_name','last_name','organization','phone_number','buy_box','role'];
    const changes = {};
    for (const f of trackFields) {
      if (req.body[f] !== undefined && String(req.body[f] ?? '') !== String(pre[f] ?? '')) {
        changes[f] = { from: pre[f] ?? null, to: row[f] ?? null };
      }
    }
    const changedFields = Object.keys(changes);
    await logAudit(userId, req.session.user.email, 'edit_user', { changed_fields: changedFields, changes: Object.keys(changes).length ? changes : undefined }, id, row.email, clientIp(req));
    if (userId === id) {
      req.session.user = { id: row.id, email: row.email, role: row.role, first_name: row.first_name, last_name: row.last_name, organization: row.organization, phone_number: row.phone_number, buy_box: row.buy_box, profile_photo: row.profile_photo };
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

/* ─── Contacts API ──────────────────────────────────────────────── */

app.get('/api/contacts', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.organization, u.phone_number,
             u.buy_box, u.profile_photo, u.created_at, u.updated_at, u.last_login,
             COUNT(cn.id)::int AS note_count,
             MAX(cn.created_at) AS last_note_at,
             latest_note.note_text AS last_note_text
      FROM users u
      LEFT JOIN contact_notes cn ON cn.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT cn2.note_text FROM contact_notes cn2 WHERE cn2.user_id = u.id ORDER BY cn2.created_at DESC LIMIT 1
      ) AS latest_note ON TRUE
      GROUP BY u.id, latest_note.note_text
      ORDER BY u.created_at DESC
    `);
    res.set('Cache-Control', 'public, max-age=60, must-revalidate');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/contacts/:id', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });
  try {
    const userResult = await pool.query(
      `SELECT id, email, role, first_name, last_name, organization, phone_number, buy_box, profile_photo, created_at, updated_at, last_login FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const user = userResult.rows[0];

    // Assigned properties
    const propsResult = await pool.query(
      `SELECT p.id, p.pin, p.address, p.county, p.price, p.square_feet, p.status, p.created_at, pa.assigned_at
       FROM properties p
       JOIN property_assignments pa ON p.id = pa.property_id
       WHERE pa.user_id = $1
       ORDER BY pa.assigned_at DESC`,
      [userId]
    );

    res.json({ user, properties: propsResult.rows });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.patch('/api/contacts/:id/buybox', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });
  const { buy_box } = req.body || {};
  try {
    await pool.query('UPDATE users SET buy_box=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [buy_box || null, userId]);
    await logAudit(req.session.user.id, req.session.user.email, 'edit_user', { changed_fields: ['buy_box'] }, userId, null, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/contacts/:id/notes', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const userId = Number(req.params.id);
  try {
    const notes = await pool.query(
      `SELECT id, user_id, admin_id, note_text, created_at FROM contact_notes WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    const noteIds = notes.rows.map(n => n.id);
    let attachments = [];
    if (noteIds.length > 0) {
      const attResult = await pool.query(
        `SELECT id, note_id, filename, file_type, file_size, created_at FROM contact_attachments WHERE note_id = ANY($1)`,
        [noteIds]
      );
      attachments = attResult.rows;
    }
    const rows = notes.rows.map(n => ({
      ...n,
      attachments: attachments.filter(a => a.note_id === n.id)
    }));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.post('/api/contacts/:id/notes', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const userId = Number(req.params.id);
  const adminId = req.session.user.id;
  const { note_text, attachments = [] } = req.body;
  try {
    // Fetch contact name for audit log
    const contactResult = await pool.query('SELECT first_name, last_name, email FROM users WHERE id=$1', [userId]);
    const contact = contactResult.rows[0] || {};
    const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email || `User #${userId}`;

    const noteResult = await pool.query(
      `INSERT INTO contact_notes (user_id, admin_id, note_text) VALUES ($1, $2, $3) RETURNING *`,
      [userId, adminId, note_text || null]
    );
    const note = noteResult.rows[0];
    const insertedAttachments = [];
    for (const att of attachments) {
      const ar = await pool.query(
        `INSERT INTO contact_attachments (note_id, filename, file_type, file_data, file_size) VALUES ($1,$2,$3,$4,$5) RETURNING id, note_id, filename, file_type, file_size, created_at`,
        [note.id, att.filename, att.file_type, att.file_data, att.file_size || null]
      );
      insertedAttachments.push(ar.rows[0]);
    }
    const notePreview = note_text ? (note_text.length > 120 ? note_text.slice(0, 120) + '…' : note_text) : null;
    const filenames = attachments.map(a => a.filename);
    await logAudit(adminId, req.session.user.email, 'add_contact_note', {
      contact_name: contactName, user_id: userId,
      note_preview: notePreview, attachment_count: attachments.length,
      filenames: filenames.length ? filenames : undefined,
    }, userId, contact.email || null, clientIp(req));
    res.json({ ...note, attachments: insertedAttachments });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.delete('/api/contacts/:id/notes/:noteId', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const noteId = Number(req.params.noteId);
  const contactId = Number(req.params.id);
  const adminId = req.session.user.id;
  try {
    // Fetch note text + contact name before deleting
    const noteResult = await pool.query(
      `SELECT cn.note_text, u.first_name, u.last_name, u.email
       FROM contact_notes cn JOIN users u ON u.id = cn.user_id WHERE cn.id=$1`, [noteId]
    );
    const row = noteResult.rows[0] || {};
    const contactName = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || `User #${contactId}`;
    const notePreview = row.note_text ? (row.note_text.length > 120 ? row.note_text.slice(0, 120) + '…' : row.note_text) : null;

    await pool.query('DELETE FROM contact_notes WHERE id = $1', [noteId]);
    await logAudit(adminId, req.session.user.email, 'delete_contact_note', {
      note_id: noteId, contact_name: contactName, note_preview: notePreview,
    }, contactId, row.email || null, clientIp(req));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/contacts/:id/notes/:noteId/attachments/:attachId', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const attachId = Number(req.params.attachId);
  try {
    const result = await pool.query('SELECT filename, file_type, file_data FROM contact_attachments WHERE id = $1', [attachId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const { filename, file_type, file_data } = result.rows[0];
    const buf = Buffer.from(file_data, 'base64');
    res.setHeader('Content-Type', file_type);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
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

app.get('/api/global-search', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });

  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.json({ properties: [], users: [], contacts: [], auditLogs: [] });
  }

  const pattern = `%${q}%`;

  try {
    const [propertiesResult, usersResult, contactsResult, auditLogsResult] = await Promise.all([
      pool.query(
        `SELECT id, address, pin, county, status, asset_type, updated_at
         FROM properties
         WHERE address ILIKE $1
            OR pin ILIKE $1
            OR county ILIKE $1
            OR status ILIKE $1
            OR asset_type ILIKE $1
         ORDER BY updated_at DESC NULLS LAST, id DESC
         LIMIT 5`,
        [pattern]
      ),
      pool.query(
        `SELECT id, email, first_name, last_name, organization, role, profile_photo
         FROM users
         WHERE email ILIKE $1
            OR first_name ILIKE $1
            OR last_name ILIKE $1
            OR organization ILIKE $1
            OR phone_number ILIKE $1
         ORDER BY updated_at DESC NULLS LAST, id DESC
         LIMIT 5`,
        [pattern]
      ),
      pool.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.organization, u.role, u.buy_box, u.profile_photo, latest_note.note_text AS last_note_text
         FROM users u
         LEFT JOIN LATERAL (
           SELECT cn.note_text
           FROM contact_notes cn
           WHERE cn.user_id = u.id
           ORDER BY cn.created_at DESC
           LIMIT 1
         ) AS latest_note ON TRUE
         WHERE u.email ILIKE $1
            OR u.first_name ILIKE $1
            OR u.last_name ILIKE $1
            OR u.organization ILIKE $1
            OR u.phone_number ILIKE $1
            OR u.buy_box ILIKE $1
            OR latest_note.note_text ILIKE $1
         ORDER BY u.updated_at DESC NULLS LAST, u.id DESC
         LIMIT 5`,
        [pattern]
      ),
      pool.query(
        `SELECT id, action, acted_by_email, target_email, created_at, details
         FROM audit_logs
         WHERE acted_by_email ILIKE $1
            OR target_email ILIKE $1
            OR action ILIKE $1
            OR details ILIKE $1
         ORDER BY created_at DESC NULLS LAST, id DESC
         LIMIT 5`,
        [pattern]
      )
    ]);

    res.json({
      properties: propertiesResult.rows,
      users: usersResult.rows,
      contacts: contactsResult.rows,
      auditLogs: auditLogsResult.rows
    });
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
    logistics_hubs, landmarks, water_sources, military_bases,
    grm, cap_rate, cash_on_cash, irr, price_per_unit, price_per_sqft,
    rent_to_sales_ratio, num_skus, price_per_acre, electrical_voltage, electrical_amperage,
    asset_type,
    gross_scheduled_rent, vacancy_rate, other_income, operating_expenses, reserves_capex,
    loan_amount, ltv, interest_rate, amortization_term, interest_only_period,
    unit_count, closing_costs, hold_period, rent_growth, expense_growth, exit_cap_rate, cost_of_sale,
    tenant_gross_sales, tenant_base_rent,
    management_fee_pct, insurance, property_taxes,
    land_value_pct, cost_seg_bonus_pct, effective_tax_rate, depreciation_recapture_rate,
    refi_ltv, refi_rate, refi_year, dcf_model
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
        logistics_hubs, landmarks, water_sources, military_bases,
        grm, cap_rate, cash_on_cash, irr, price_per_unit, price_per_sqft,
        rent_to_sales_ratio, num_skus, price_per_acre, electrical_voltage, electrical_amperage,
        asset_type,
        gross_scheduled_rent, vacancy_rate, other_income, operating_expenses, reserves_capex,
        loan_amount, ltv, interest_rate, amortization_term, interest_only_period,
        unit_count, closing_costs, hold_period, rent_growth, expense_growth, exit_cap_rate, cost_of_sale,
        tenant_gross_sales, tenant_base_rent,
        management_fee_pct, insurance, property_taxes,
        land_value_pct, cost_seg_bonus_pct, effective_tax_rate, depreciation_recapture_rate,
        refi_ltv, refi_rate, refi_year, dcf_model)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59,$60,$61,$62,$63) RETURNING id`,
      [pin.trim(), address.trim(), county.trim(), req.session.user.id,
       price || null, square_feet || null, lot_size || null, year_built || null,
       on_major_road || false, traffic_vpd || null, on_corner_lot || false,
       direct_water_access || false, next_to_public_land || false,
       JSON.stringify(major_interstates || []),
       household_income_min || null, household_income_max || null, population_density || null,
       JSON.stringify(logistics_hubs || []), JSON.stringify(landmarks || []),
       JSON.stringify(water_sources || []), JSON.stringify(military_bases || []),
       grm || null, cap_rate || null, cash_on_cash || null, irr || null,
       price_per_unit || null, price_per_sqft || null,
       rent_to_sales_ratio || null, num_skus || null, price_per_acre || null,
       electrical_voltage || null, electrical_amperage || null,
       asset_type || null,
       gross_scheduled_rent || null, vacancy_rate || null, other_income || null,
       operating_expenses || null, reserves_capex || null,
       loan_amount || null, ltv || null, interest_rate || null,
       amortization_term || null, interest_only_period || null,
       unit_count || null, closing_costs || null, hold_period || null,
       rent_growth || null, expense_growth || null, exit_cap_rate || null, cost_of_sale || null,
       tenant_gross_sales || null, tenant_base_rent || null,
       management_fee_pct || null, insurance || null, property_taxes || null,
       land_value_pct || null, cost_seg_bonus_pct || null, effective_tax_rate || null,
       depreciation_recapture_rate || null,
       refi_ltv || null, refi_rate || null, refi_year || null,
       JSON.stringify(dcf_model || {})]
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

  const cacheKey = `props:list:${q}:${limit}:${offset}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
    res.set('ETag', cached.etag);
    return res.json(cached.data);
  }

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
              logistics_hubs, landmarks, water_sources, military_bases, status,
              grm, cap_rate, cash_on_cash, irr, price_per_unit, price_per_sqft,
              rent_to_sales_ratio, num_skus, price_per_acre, electrical_voltage, electrical_amperage,
              asset_type,
              gross_scheduled_rent, vacancy_rate, other_income, operating_expenses, reserves_capex,
              loan_amount, ltv, interest_rate, amortization_term, interest_only_period,
              unit_count, closing_costs, hold_period, rent_growth, expense_growth, exit_cap_rate, cost_of_sale,
              tenant_gross_sales, tenant_base_rent,
              management_fee_pct, insurance, property_taxes,
              land_value_pct, cost_seg_bonus_pct, effective_tax_rate, depreciation_recapture_rate,
              refi_ltv, refi_rate, refi_year,
              created_by, created_at, updated_at
       FROM properties ${where} ORDER BY id DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    const payload = { properties: listResult.rows || [], total: countResult.rows[0].total };
    const etag = cacheSet(cacheKey, payload);
    res.set('ETag', etag);
    res.set('Cache-Control', 'public, max-age=60, must-revalidate');
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid id' });

  const cacheKey = `props:item:${propId}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    if (req.headers['if-none-match'] === cached.etag) return res.status(304).end();
    res.set('ETag', cached.etag);
    return res.json(cached.data);
  }

  try {
    const result = await pool.query(
      `SELECT id, pin, address, county, price, square_feet, lot_size, year_built,
              on_major_road, traffic_vpd, on_corner_lot, direct_water_access, next_to_public_land,
              major_interstates, household_income_min, household_income_max, population_density,
              logistics_hubs, landmarks, water_sources, military_bases, status,
              grm, cap_rate, cash_on_cash, irr, price_per_unit, price_per_sqft,
              rent_to_sales_ratio, num_skus, price_per_acre, electrical_voltage, electrical_amperage,
              asset_type,
              gross_scheduled_rent, vacancy_rate, other_income, operating_expenses, reserves_capex,
              loan_amount, ltv, interest_rate, amortization_term, interest_only_period,
              unit_count, closing_costs, hold_period, rent_growth, expense_growth, exit_cap_rate, cost_of_sale,
              tenant_gross_sales, tenant_base_rent,
              management_fee_pct, insurance, property_taxes,
              land_value_pct, cost_seg_bonus_pct, effective_tax_rate, depreciation_recapture_rate,
              refi_ltv, refi_rate, refi_year, dcf_model,
              created_by, created_at, updated_at
       FROM properties WHERE id = $1`, [propId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const etag = cacheSet(cacheKey, result.rows[0]);
    res.set('ETag', etag);
    res.set('Cache-Control', 'public, max-age=60, must-revalidate');
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
    logistics_hubs, landmarks, water_sources, military_bases,
    status,
    grm, cap_rate, cash_on_cash, irr, price_per_unit, price_per_sqft,
    rent_to_sales_ratio, num_skus, price_per_acre, electrical_voltage, electrical_amperage,
    asset_type,
    gross_scheduled_rent, vacancy_rate, other_income, operating_expenses, reserves_capex,
    loan_amount, ltv, interest_rate, amortization_term, interest_only_period,
    unit_count, closing_costs, hold_period, rent_growth, expense_growth, exit_cap_rate, cost_of_sale,
    tenant_gross_sales, tenant_base_rent,
    management_fee_pct, insurance, property_taxes,
    land_value_pct, cost_seg_bonus_pct, effective_tax_rate, depreciation_recapture_rate,
    refi_ltv, refi_rate, refi_year, dcf_model
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
              logistics_hubs, landmarks, water_sources, military_bases, status,
              grm, cap_rate, cash_on_cash, irr, price_per_unit, price_per_sqft,
              rent_to_sales_ratio, num_skus, price_per_acre, electrical_voltage, electrical_amperage,
              asset_type,
              gross_scheduled_rent, vacancy_rate, other_income, operating_expenses, reserves_capex,
              loan_amount, ltv, interest_rate, amortization_term, interest_only_period,
              unit_count, closing_costs, hold_period, rent_growth, expense_growth, exit_cap_rate, cost_of_sale,
              tenant_gross_sales, tenant_base_rent,
              management_fee_pct, insurance, property_taxes,
              land_value_pct, cost_seg_bonus_pct, effective_tax_rate, depreciation_recapture_rate,
              refi_ltv, refi_rate, refi_year, dcf_model
       FROM properties WHERE id=$1`, [propId]
    );
    if (oldResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const old = oldResult.rows[0];

    const newVals = {
      pin: pin.trim(), address: address.trim(), county: county.trim(),
      price: price || null, square_feet: square_feet || null, lot_size: lot_size || null, year_built: year_built || null,
      on_major_road: on_major_road === true || on_major_road === 'true',
      traffic_vpd: traffic_vpd || null,
      on_corner_lot: on_corner_lot === true || on_corner_lot === 'true',
      direct_water_access: direct_water_access === true || direct_water_access === 'true',
      next_to_public_land: next_to_public_land === true || next_to_public_land === 'true',
      major_interstates: JSON.stringify(major_interstates || []),
      household_income_min: household_income_min || null, household_income_max: household_income_max || null,
      population_density: population_density || null,
      logistics_hubs: JSON.stringify(logistics_hubs || []), landmarks: JSON.stringify(landmarks || []),
      water_sources: JSON.stringify(water_sources || []), military_bases: JSON.stringify(military_bases || []),
      status: ['New','Under Review','Active','Other'].includes(status) ? status : 'New',
      grm: grm || null, cap_rate: cap_rate || null, cash_on_cash: cash_on_cash || null, irr: irr || null,
      price_per_unit: price_per_unit || null, price_per_sqft: price_per_sqft || null,
      rent_to_sales_ratio: rent_to_sales_ratio || null, num_skus: num_skus || null,
      price_per_acre: price_per_acre || null,
      electrical_voltage: electrical_voltage || null, electrical_amperage: electrical_amperage || null,
      asset_type: asset_type || null,
      gross_scheduled_rent: gross_scheduled_rent || null, vacancy_rate: vacancy_rate || null,
      other_income: other_income || null, operating_expenses: operating_expenses || null,
      reserves_capex: reserves_capex || null,
      loan_amount: loan_amount || null, ltv: ltv || null, interest_rate: interest_rate || null,
      amortization_term: amortization_term || null, interest_only_period: interest_only_period || null,
      unit_count: unit_count || null, closing_costs: closing_costs || null,
      hold_period: hold_period || null, rent_growth: rent_growth || null,
      expense_growth: expense_growth || null, exit_cap_rate: exit_cap_rate || null,
      cost_of_sale: cost_of_sale || null,
      tenant_gross_sales: tenant_gross_sales || null, tenant_base_rent: tenant_base_rent || null,
      management_fee_pct: management_fee_pct || null, insurance: insurance || null,
      property_taxes: property_taxes || null,
      land_value_pct: land_value_pct || null, cost_seg_bonus_pct: cost_seg_bonus_pct || null,
      effective_tax_rate: effective_tax_rate || null,
      depreciation_recapture_rate: depreciation_recapture_rate || null,
      refi_ltv: refi_ltv || null, refi_rate: refi_rate || null, refi_year: refi_year || null,
      dcf_model: JSON.stringify(dcf_model || {})
    };

    // Build field-level diff — normalize types for accurate comparison
    const changes = {};
    const arrayFields = new Set(['major_interstates', 'logistics_hubs', 'landmarks', 'water_sources', 'military_bases']);
    const jsonFields = new Set(['dcf_model']);
    for (const key of Object.keys(newVals)) {
      let oldNorm, newNorm, oldDisplay, newDisplay;
      if (arrayFields.has(key)) {
        // Both sides normalised to JSON string; treat null/undefined DB value as "[]"
        oldNorm = JSON.stringify(old[key] ?? []);
        newNorm = newVals[key]; // already JSON.stringify'd
        oldDisplay = old[key] ?? [];
        newDisplay = JSON.parse(newNorm);
      } else if (jsonFields.has(key)) {
        oldNorm = JSON.stringify(old[key] ?? {});
        newNorm = newVals[key];
        oldDisplay = old[key] ?? {};
        newDisplay = JSON.parse(newNorm);
        if (key === 'dcf_model' && oldNorm !== newNorm) {
          const oldModel = oldDisplay || {};
          const newModel = newDisplay || {};
          const structuredDiff = {};
          const modelSections = ['scenarios', 'debtTerms', 'waterfall', 'timing', 'taxModel', 'governance', 'leaseEconomics', 'lenderConstraints', 'rentRoll'];
          for (const section of modelSections) {
            const beforeSection = oldModel[section] ?? null;
            const afterSection = newModel[section] ?? null;
            if (JSON.stringify(beforeSection) !== JSON.stringify(afterSection)) {
              structuredDiff[section] = { from: beforeSection, to: afterSection };
            }
          }
          const oldYears = Array.isArray(oldModel.years) ? oldModel.years : [];
          const newYears = Array.isArray(newModel.years) ? newModel.years : [];
          const yearlyChanges = [];
          const maxYears = Math.max(oldYears.length, newYears.length);
          for (let index = 0; index < maxYears; index += 1) {
            const beforeYear = oldYears[index] ?? null;
            const afterYear = newYears[index] ?? null;
            if (JSON.stringify(beforeYear) !== JSON.stringify(afterYear)) {
              yearlyChanges.push({ year: index + 1, from: beforeYear, to: afterYear });
            }
          }
          if (yearlyChanges.length > 0) structuredDiff.years = yearlyChanges;
          changes[key] = structuredDiff;
          continue;
        }
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
        grm=$22, cap_rate=$23, cash_on_cash=$24, irr=$25,
        price_per_unit=$26, price_per_sqft=$27,
        rent_to_sales_ratio=$28, num_skus=$29, price_per_acre=$30,
        electrical_voltage=$31, electrical_amperage=$32,
        asset_type=$33,
        gross_scheduled_rent=$34, vacancy_rate=$35, other_income=$36,
        operating_expenses=$37, reserves_capex=$38,
        loan_amount=$39, ltv=$40, interest_rate=$41,
        amortization_term=$42, interest_only_period=$43,
        unit_count=$44, closing_costs=$45, hold_period=$46,
        rent_growth=$47, expense_growth=$48, exit_cap_rate=$49, cost_of_sale=$50,
        tenant_gross_sales=$51, tenant_base_rent=$52,
        management_fee_pct=$53, insurance=$54, property_taxes=$55,
        land_value_pct=$56, cost_seg_bonus_pct=$57, effective_tax_rate=$58,
        depreciation_recapture_rate=$59,
        refi_ltv=$60, refi_rate=$61, refi_year=$62, dcf_model=$63,
        updated_at=CURRENT_TIMESTAMP
       WHERE id=$64`,
      [newVals.pin, newVals.address, newVals.county,
       newVals.price, newVals.square_feet, newVals.lot_size, newVals.year_built,
       newVals.on_major_road, newVals.traffic_vpd, newVals.on_corner_lot,
       newVals.direct_water_access, newVals.next_to_public_land,
       newVals.major_interstates,
       newVals.household_income_min, newVals.household_income_max,
       newVals.population_density,
       newVals.logistics_hubs, newVals.landmarks,
       newVals.water_sources, newVals.military_bases, newVals.status,
       newVals.grm, newVals.cap_rate, newVals.cash_on_cash, newVals.irr,
       newVals.price_per_unit, newVals.price_per_sqft,
       newVals.rent_to_sales_ratio, newVals.num_skus, newVals.price_per_acre,
       newVals.electrical_voltage, newVals.electrical_amperage,
       newVals.asset_type,
       newVals.gross_scheduled_rent, newVals.vacancy_rate, newVals.other_income,
       newVals.operating_expenses, newVals.reserves_capex,
       newVals.loan_amount, newVals.ltv, newVals.interest_rate,
       newVals.amortization_term, newVals.interest_only_period,
       newVals.unit_count, newVals.closing_costs, newVals.hold_period,
       newVals.rent_growth, newVals.expense_growth, newVals.exit_cap_rate, newVals.cost_of_sale,
       newVals.tenant_gross_sales, newVals.tenant_base_rent,
       newVals.management_fee_pct, newVals.insurance, newVals.property_taxes,
       newVals.land_value_pct, newVals.cost_seg_bonus_pct, newVals.effective_tax_rate,
       newVals.depreciation_recapture_rate,
       newVals.refi_ltv, newVals.refi_rate, newVals.refi_year, newVals.dcf_model,
       propId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    // Invalidate cached data for this property and the list
    cacheInvalidate(`props:item:${propId}`);
    cacheInvalidate('props:list:');
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
    const propResult = await pool.query('SELECT address, pin, county FROM properties WHERE id=$1', [propId]);
    if (propResult.rows.length === 0) return res.status(404).json({ error: 'not found' });
    const { address, pin, county } = propResult.rows[0];
    const result = await pool.query('DELETE FROM properties WHERE id = $1', [propId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'not found' });
    cacheInvalidate(`props:item:${propId}`);
    cacheInvalidate('props:list:');
    await logAudit(req.session.user.id, req.session.user.email, 'delete_property', { property_id: propId, address, pin, county }, null, null, clientIp(req));
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
    cacheInvalidate(`props:item:${propId}`);
    cacheInvalidate('props:list:');
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

// Calendar events — returns events for the requesting user's role
// Admin: property creations + audit log entries for the current month ± 1
// User: their assigned properties (assigned_at) + any property created dates
// ─── FOMC Meeting Calendar ─────────────────────────────────────────────────
// Fetches upcoming Federal Reserve (FOMC) meeting dates from the FRED API.
// Falls back to a hardcoded schedule if FRED_API_KEY is not set.
// Cache: stored in DB table `fomc_cache` to avoid hammering the API.

const FRED_API_KEY = process.env.FRED_API_KEY;
const FOMC_RELEASE_ID = 226; // "FOMC Press Release" in FRED

// Known FOMC meeting dates as fallback (both days listed; decision on 2nd day)
// Updated through end of 2026 per Fed published schedule
const FOMC_FALLBACK = [
  // 2026
  { start: '2026-01-28', end: '2026-01-29', decision: '2026-01-29' },
  { start: '2026-03-18', end: '2026-03-19', decision: '2026-03-19' },
  { start: '2026-04-29', end: '2026-04-30', decision: '2026-04-30' },
  { start: '2026-06-16', end: '2026-06-17', decision: '2026-06-17' },
  { start: '2026-07-28', end: '2026-07-29', decision: '2026-07-29' },
  { start: '2026-09-15', end: '2026-09-16', decision: '2026-09-16' },
  { start: '2026-10-27', end: '2026-10-28', decision: '2026-10-28' },
  { start: '2026-12-15', end: '2026-12-16', decision: '2026-12-16' },
  // 2027
  { start: '2027-01-26', end: '2027-01-27', decision: '2027-01-27' },
  { start: '2027-03-16', end: '2027-03-17', decision: '2027-03-17' },
  { start: '2027-04-27', end: '2027-04-28', decision: '2027-04-28' },
  { start: '2027-06-15', end: '2027-06-16', decision: '2027-06-16' },
  { start: '2027-07-27', end: '2027-07-28', decision: '2027-07-28' },
  { start: '2027-09-14', end: '2027-09-15', decision: '2027-09-15' },
  { start: '2027-10-26', end: '2027-10-27', decision: '2027-10-27' },
  { start: '2027-12-14', end: '2027-12-15', decision: '2027-12-15' },
];

async function ensureFomcCacheTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS fomc_cache (
    id SERIAL PRIMARY KEY,
    decision_date DATE NOT NULL UNIQUE,
    start_date DATE,
    end_date DATE,
    source TEXT DEFAULT 'fallback',
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

// Refresh FOMC dates from FRED if API key present and cache is stale (>24h)
async function refreshFomcCache() {
  await ensureFomcCacheTable();

  // Check last fetch time
  const last = await pool.query(`SELECT MAX(fetched_at) as t FROM fomc_cache`);
  const lastFetch = last.rows[0]?.t ? new Date(last.rows[0].t) : null;
  const stale = !lastFetch || (Date.now() - lastFetch.getTime() > 24 * 60 * 60 * 1000);

  if (FRED_API_KEY && stale) {
    try {
      const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${FOMC_RELEASE_ID}&api_key=${FRED_API_KEY}&file_type=json&include_release_dates_with_no_data=true&sort_order=asc`;
      const data = await new Promise((resolve, reject) => {
        https.get(url, res => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { reject(new Error('invalid json')); }
          });
        }).on('error', reject);
      });

      const dates = (data.release_dates || []).map(d => d.date).filter(Boolean);
      if (dates.length > 0) {
        // Upsert each FRED date as decision date (FRED only gives 1 date per meeting = decision day)
        for (const date of dates) {
          await pool.query(
            `INSERT INTO fomc_cache (decision_date, start_date, end_date, source, fetched_at)
             VALUES ($1, $1, $1, 'fred', NOW())
             ON CONFLICT (decision_date) DO UPDATE SET source='fred', fetched_at=NOW()`,
            [date]
          );
        }
        // Also upsert fallback dates to fill in start/end fields FRED doesn't provide
        for (const m of FOMC_FALLBACK) {
          await pool.query(
            `INSERT INTO fomc_cache (decision_date, start_date, end_date, source, fetched_at)
             VALUES ($1, $2, $3, 'fred+fallback', NOW())
             ON CONFLICT (decision_date) DO UPDATE
               SET start_date = EXCLUDED.start_date,
                   end_date   = EXCLUDED.end_date`,
            [m.decision, m.start, m.end]
          );
        }
        return;
      }
    } catch (e) {
      console.error('FRED fetch failed, using fallback:', e.message);
    }
  }

  // Seed fallback if table is empty
  const count = await pool.query(`SELECT COUNT(*) as n FROM fomc_cache`);
  if (parseInt(count.rows[0].n, 10) === 0) {
    for (const m of FOMC_FALLBACK) {
      await pool.query(
        `INSERT INTO fomc_cache (decision_date, start_date, end_date, source)
         VALUES ($1, $2, $3, 'fallback')
         ON CONFLICT DO NOTHING`,
        [m.decision, m.start, m.end]
      );
    }
  }
}

// Kick off background refresh on server start
refreshFomcCache().catch(e => console.error('FOMC cache init error:', e.message));

app.get('/api/fomc-meetings', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const { year, month } = req.query;
  const y = parseInt(year, 10) || new Date().getFullYear();
  const m = parseInt(month, 10) || (new Date().getMonth() + 1);
  const from = `${y}-${String(m).padStart(2,'0')}-01`;
  const to   = new Date(y, m, 1).toISOString().slice(0, 10); // first day of next month
  try {
    await ensureFomcCacheTable();
    // Async refresh in background (don't block response)
    refreshFomcCache().catch(() => {});
    const result = await pool.query(
      `SELECT decision_date, start_date, end_date, source
       FROM fomc_cache
       WHERE decision_date >= $1 AND decision_date < $2
       ORDER BY decision_date`,
      [from, to]
    );
    res.json({ meetings: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

// ─── Economic Indicators Calendar ─────────────────────────────────────────────
// Hardcoded release schedule for 2026–2027 major economic indicators.
// Dates are approximate based on historical release cadence (typically 1st–3rd
// business day of the month for ISM; mid-month for others).
// Update annually when BEA/Fed/Census publish their release calendars.

const ECON_INDICATORS = [
  // ── ISM Manufacturing (released 1st business day of month) ──
  ...['2026-01-02','2026-02-03','2026-03-02','2026-04-01','2026-05-01','2026-06-01',
      '2026-07-01','2026-08-03','2026-09-01','2026-10-01','2026-11-02','2026-12-01',
      '2027-01-04','2027-02-01','2027-03-01','2027-04-01','2027-05-03','2027-06-01',
      '2027-07-01','2027-08-02','2027-09-01','2027-10-01','2027-11-01','2027-12-01',
  ].map(date => ({ date, label: 'ISM Manufacturing PMI', short_label: 'ISM Mfg', category: 'ism',
    description: 'Institute for Supply Management Manufacturing PMI report' })),

  // ── ISM Non-Manufacturing / Services (released 3rd business day of month) ──
  ...['2026-01-07','2026-02-05','2026-03-04','2026-04-06','2026-05-05','2026-06-03',
      '2026-07-07','2026-08-05','2026-09-03','2026-10-05','2026-11-04','2026-12-03',
      '2027-01-07','2027-02-04','2027-03-03','2027-04-06','2027-05-05','2027-06-03',
      '2027-07-07','2027-08-04','2027-09-03','2027-10-05','2027-11-03','2027-12-02',
  ].map(date => ({ date, label: 'ISM Services PMI', short_label: 'ISM Svc', category: 'ism',
    description: 'Institute for Supply Management Non-Manufacturing (Services) PMI report' })),

  // ── Advance Retail Sales (released ~mid-month, typically 15th-17th) ──
  ...['2026-01-15','2026-02-13','2026-03-16','2026-04-15','2026-05-15','2026-06-16',
      '2026-07-16','2026-08-14','2026-09-15','2026-10-15','2026-11-16','2026-12-15',
      '2027-01-15','2027-02-12','2027-03-15','2027-04-14','2027-05-14','2027-06-15',
      '2027-07-15','2027-08-13','2027-09-15','2027-10-15','2027-11-15','2027-12-15',
  ].map(date => ({ date, label: 'Advance Retail Sales', short_label: 'Retail Sales', category: 'retail',
    description: 'U.S. Census Bureau Advance Monthly Sales for Retail and Food Services' })),

  // ── International Trade in Goods (Advance, released ~last week of month) ──
  ...['2026-01-28','2026-02-25','2026-03-25','2026-04-29','2026-05-27','2026-06-24',
      '2026-07-29','2026-08-26','2026-09-23','2026-10-28','2026-11-25','2026-12-23',
      '2027-01-27','2027-02-24','2027-03-24','2027-04-28','2027-05-26','2027-06-23',
      '2027-07-28','2027-08-25','2027-09-22','2027-10-27','2027-11-24','2027-12-22',
  ].map(date => ({ date, label: 'Intl Trade in Goods (Advance)', short_label: 'Trade Goods', category: 'trade',
    description: 'U.S. Census Bureau Advance International Trade in Goods report' })),

  // ── NY Fed Global Supply Chain Pressure Index (released monthly, ~1st week) ──
  ...['2026-01-06','2026-02-04','2026-03-03','2026-04-02','2026-05-05','2026-06-02',
      '2026-07-02','2026-08-04','2026-09-02','2026-10-02','2026-11-03','2026-12-02',
      '2027-01-05','2027-02-03','2027-03-02','2027-04-01','2027-05-04','2027-06-01',
      '2027-07-01','2027-08-03','2027-09-01','2027-10-01','2027-11-02','2027-12-01',
  ].map(date => ({ date, label: 'NY Fed GSCPI', short_label: 'GSCPI', category: 'gscpi',
    description: "NY Fed's Global Supply Chain Pressure Index" })),

  // ── Industrial Production & Capacity Utilization (released ~15th-17th) ──
  ...['2026-01-16','2026-02-17','2026-03-17','2026-04-16','2026-05-15','2026-06-17',
      '2026-07-17','2026-08-18','2026-09-16','2026-10-16','2026-11-17','2026-12-16',
      '2027-01-16','2027-02-17','2027-03-16','2027-04-15','2027-05-17','2027-06-16',
      '2027-07-16','2027-08-17','2027-09-15','2027-10-15','2027-11-16','2027-12-15',
  ].map(date => ({ date, label: 'Industrial Production & Cap. Utilization', short_label: 'Ind. Production', category: 'ip',
    description: 'Federal Reserve Industrial Production and Capacity Utilization report (G.17)' })),

  // ── Jobs Report / Employment Situation (BLS, 1st Friday of month) ──
  ...['2026-01-09','2026-02-06','2026-03-06','2026-04-03','2026-05-08','2026-06-05',
      '2026-07-02','2026-08-07','2026-09-04','2026-10-02','2026-11-06','2026-12-04',
      '2027-01-08','2027-02-05','2027-03-05','2027-04-02','2027-05-07','2027-06-04',
      '2027-07-02','2027-08-06','2027-09-03','2027-10-01','2027-11-05','2027-12-03',
  ].map(date => ({ date, label: 'Jobs Report (Employment Situation)', short_label: 'Jobs Report', category: 'unemployment',
    description: 'BLS Employment Situation: nonfarm payrolls, unemployment rate, wage growth (released 8:30 AM ET)' })),

  // ── Initial Jobless Claims (BLS, every Thursday) — show monthly totals only to avoid clutter ──
  // Listing the first Thursday of each month as the representative weekly release
  ...['2026-01-08','2026-02-05','2026-03-05','2026-04-02','2026-05-07','2026-06-04',
      '2026-07-02','2026-08-06','2026-09-03','2026-10-01','2026-11-05','2026-12-03',
      '2027-01-07','2027-02-04','2027-03-04','2027-04-01','2027-05-06','2027-06-03',
      '2027-07-01','2027-08-05','2027-09-02','2027-10-07','2027-11-04','2027-12-02',
  ].map(date => ({ date, label: 'Initial Jobless Claims (weekly)', short_label: 'Jobless Claims', category: 'unemployment',
    description: 'DOL weekly Initial Jobless Claims — leading unemployment indicator (released Thursdays 8:30 AM ET)' })),

  // ── CPI — Consumer Price Index (BLS, ~10th-12th of month) ──
  ...['2026-01-14','2026-02-11','2026-03-11','2026-04-10','2026-05-12','2026-06-10',
      '2026-07-14','2026-08-12','2026-09-11','2026-10-13','2026-11-12','2026-12-10',
      '2027-01-13','2027-02-10','2027-03-10','2027-04-09','2027-05-12','2027-06-10',
      '2027-07-13','2027-08-11','2027-09-10','2027-10-13','2027-11-10','2027-12-09',
  ].map(date => ({ date, label: 'CPI — Consumer Price Index', short_label: 'CPI', category: 'inflation',
    description: 'BLS Consumer Price Index: headline & core inflation (released 8:30 AM ET)' })),

  // ── PPI — Producer Price Index (BLS, ~11th-14th of month) ──
  ...['2026-01-15','2026-02-12','2026-03-12','2026-04-14','2026-05-13','2026-06-11',
      '2026-07-15','2026-08-13','2026-09-12','2026-10-14','2026-11-13','2026-12-11',
      '2027-01-14','2027-02-11','2027-03-11','2027-04-11','2027-05-13','2027-06-11',
      '2027-07-14','2027-08-12','2027-09-11','2027-10-14','2027-11-11','2027-12-10',
  ].map(date => ({ date, label: 'PPI — Producer Price Index', short_label: 'PPI', category: 'inflation',
    description: 'BLS Producer Price Index: upstream inflation pressures (released 8:30 AM ET)' })),

  // ── PCE Price Index (Fed's preferred inflation gauge, released ~last business day of month) ──
  ...['2026-01-30','2026-02-27','2026-03-27','2026-04-30','2026-05-29','2026-06-26',
      '2026-07-31','2026-08-28','2026-09-25','2026-10-30','2026-11-25','2026-12-23',
      '2027-01-29','2027-02-26','2027-03-26','2027-04-30','2027-05-28','2027-06-25',
      '2027-07-30','2027-08-27','2027-09-24','2027-10-29','2027-11-24','2027-12-22',
  ].map(date => ({ date, label: 'PCE Price Index (Personal Income & Outlays)', short_label: 'PCE Inflation', category: 'inflation',
    description: "BEA Personal Consumption Expenditures price index — the Fed's preferred inflation measure (released 8:30 AM ET)" })),
];

app.get('/api/econ-indicators', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const { year, month } = req.query;
  const y = parseInt(year, 10) || new Date().getFullYear();
  const m = parseInt(month, 10) || (new Date().getMonth() + 1);
  const prefix = `${y}-${String(m).padStart(2,'0')}-`;
  const indicators = ECON_INDICATORS.filter(e => e.date.startsWith(prefix));
  res.json({ indicators });
});

// Keep old /api/calendar-events for any future use but now returns empty
app.get('/api/calendar-events', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ events: [] });
});

app.get('/api/properties/:id/users', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const propId = Number(req.params.id);
  if (!Number.isFinite(propId)) return res.status(400).json({ error: 'invalid id' });

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.organization, u.phone_number, u.profile_photo, u.role,
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
  // Hashed assets (JS/CSS with content hash in filename) are immutable — cache 1 year
  app.use('/assets', express.static(path.join(clientDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));
  // Everything else (index.html, favicon, etc.) — no-cache so updates are picked up
  app.use(express.static(clientDist, { maxAge: 0, etag: true }));
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
