// Members' community Q&A. Only signed-in secure.rospopa.com accounts may read
// or post. The board lives inside the workspace, so the only allowed Origin is
// secure.rospopa.com, and every state-changing request must come from it.
const rateLimit = require('express-rate-limit');

const ALLOWED_ORIGINS = new Set([
  'https://secure.rospopa.com',
  ...(process.env.COMMUNITY_EXTRA_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
]);

const CATEGORIES = {
  buying: 'Buying and investing',
  leasing: 'Leasing and tenants',
  building: 'Building and operations',
  taxes: 'Illinois taxes and incentives',
  financing: 'Financing',
  selling: 'Selling and exit',
  general: 'General',
};

const LIMITS = { title: [8, 160], body: [10, 5000], reply: [2, 5000] };

async function initSchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS community_threads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_replies (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES community_threads(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_community_threads_activity" ON community_threads (status, last_activity_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_community_replies_thread" ON community_replies (thread_id, created_at)`);
}

/** Public name: first name and last initial, never the email address. */
function displayName(first, last) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  if (f && l) return `${f} ${l[0].toUpperCase()}.`;
  return f || l || 'Member';
}

function cleanText(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    // Strip control characters other than newline and tab.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function checkLength(text, [min, max], label) {
  if (text.length < min) return `${label} must be at least ${min} characters.`;
  if (text.length > max) return `${label} must be at most ${max} characters.`;
  return null;
}

function cors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '600');
  }
  res.vary('Origin');
  if (req.method === 'OPTIONS') return res.status(origin && ALLOWED_ORIGINS.has(origin) ? 204 : 403).end();
  next();
}

// Cookies are SameSite=Lax, and rospopa.com is same-site with the API host, so
// an Origin check is what stops other sites from posting as a member.
function requireAllowedOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ error: 'Requests must come from secure.rospopa.com.' });
  if (!req.is('application/json')) return res.status(415).json({ error: 'JSON body required.' });
  next();
}

function requireMember(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Sign in at secure.rospopa.com to use the community board.' });
  next();
}

const isAdmin = req => req.session?.user?.role === 'admin';

function registerRoutes(app, { pool, logAudit, clientIp }) {
  const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: req => `community:${req.session?.user?.id || 'anon'}`,
    message: { error: 'You are posting too quickly. Please try again later.' },
  });
  const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

  const base = '/api/community';

  app.get(`${base}/me`, (req, res) => {
    res.set('Cache-Control', 'no-store');
    const u = req.session?.user;
    if (!u) return res.json({ user: null });
    res.json({ user: { id: u.id, name: displayName(u.first_name, u.last_name), role: u.role === 'admin' ? 'admin' : 'member' } });
  });

  app.get(`${base}/categories`, (req, res) => {
    res.json({ categories: Object.entries(CATEGORIES).map(([id, title]) => ({ id, title })) });
  });

  app.get(`${base}/threads`, requireMember, readLimiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const admin = isAdmin(req);
    const category = CATEGORIES[req.query.category] ? req.query.category : null;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const params = [];
    const where = [];
    if (!admin) where.push(`t.status = 'visible'`);
    if (category) { params.push(category); where.push(`t.category = $${params.length}`); }
    params.push(limit, offset);
    try {
      const r = await pool.query(
        `SELECT t.id, t.category, t.title, t.body, t.status, t.created_at, t.last_activity_at, t.user_id,
                u.first_name, u.last_name, u.role AS author_role,
                COALESCE(rc.reply_count, 0) AS reply_count,
                COALESCE(rc.answered, 0) = 1 AS answered
           FROM community_threads t
           LEFT JOIN users u ON u.id = t.user_id
           LEFT JOIN (
             SELECT thread_id, COUNT(*)::int AS reply_count, MAX(CASE WHEN accepted THEN 1 ELSE 0 END) AS answered
               FROM community_replies WHERE status = 'visible' GROUP BY thread_id
           ) rc ON rc.thread_id = t.id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY t.last_activity_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      const me = req.session?.user?.id;
      res.json({
        threads: r.rows.map(t => ({
          id: t.id,
          category: t.category,
          categoryTitle: CATEGORIES[t.category] || 'General',
          title: t.title,
          excerpt: t.body.length > 240 ? t.body.slice(0, 237).trimEnd() + '…' : t.body,
          status: t.status,
          author: displayName(t.first_name, t.last_name),
          authorIsAdmin: t.author_role === 'admin',
          mine: !!me && me === t.user_id,
          createdAt: t.created_at,
          lastActivityAt: t.last_activity_at,
          replyCount: t.reply_count,
          answered: t.answered,
        })),
      });
    } catch (e) {
      console.error('community threads:', e.message);
      res.status(500).json({ error: 'Could not load the community board.' });
    }
  });

  app.get(`${base}/threads/:id`, requireMember, readLimiter, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(404).json({ error: 'Thread not found.' });
    const admin = isAdmin(req);
    const me = req.session?.user?.id;
    try {
      const t = await pool.query(
        `SELECT t.*, u.first_name, u.last_name, u.role AS author_role FROM community_threads t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
        [id]
      );
      const thread = t.rows[0];
      if (!thread || (!admin && thread.status !== 'visible')) return res.status(404).json({ error: 'Thread not found.' });
      const r = await pool.query(
        `SELECT r.id, r.body, r.accepted, r.status, r.created_at, r.user_id, u.first_name, u.last_name, u.role AS author_role
           FROM community_replies r LEFT JOIN users u ON u.id = r.user_id
          WHERE r.thread_id = $1 ${admin ? '' : `AND r.status = 'visible'`}
          ORDER BY r.accepted DESC, r.created_at ASC`,
        [id]
      );
      res.json({
        thread: {
          id: thread.id,
          category: thread.category,
          categoryTitle: CATEGORIES[thread.category] || 'General',
          title: thread.title,
          body: thread.body,
          status: thread.status,
          author: displayName(thread.first_name, thread.last_name),
          authorIsAdmin: thread.author_role === 'admin',
          mine: !!me && me === thread.user_id,
          createdAt: thread.created_at,
        },
        replies: r.rows.map(x => ({
          id: x.id,
          body: x.body,
          accepted: x.accepted,
          status: x.status,
          author: displayName(x.first_name, x.last_name),
          authorIsAdmin: x.author_role === 'admin',
          mine: !!me && me === x.user_id,
          createdAt: x.created_at,
        })),
      });
    } catch (e) {
      console.error('community thread:', e.message);
      res.status(500).json({ error: 'Could not load this thread.' });
    }
  });

  app.post(`${base}/threads`, requireAllowedOrigin, requireMember, postLimiter, async (req, res) => {
    const title = cleanText(req.body?.title).replace(/\s+/g, ' ');
    const body = cleanText(req.body?.body);
    const category = CATEGORIES[req.body?.category] ? req.body.category : 'general';
    const err = checkLength(title, LIMITS.title, 'Title') || checkLength(body, LIMITS.body, 'Question');
    if (err) return res.status(400).json({ error: err });
    const u = req.session.user;
    try {
      const r = await pool.query(
        `INSERT INTO community_threads (user_id, category, title, body) VALUES ($1, $2, $3, $4) RETURNING id`,
        [u.id, category, title, body]
      );
      logAudit(u.id, u.email, 'community_thread_created', { thread_id: r.rows[0].id, ip: clientIp(req) }, null, null, clientIp(req));
      res.status(201).json({ id: r.rows[0].id });
    } catch (e) {
      console.error('community post:', e.message);
      res.status(500).json({ error: 'Could not post your question.' });
    }
  });

  app.post(`${base}/threads/:id/replies`, requireAllowedOrigin, requireMember, postLimiter, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const body = cleanText(req.body?.body);
    const err = checkLength(body, LIMITS.reply, 'Reply');
    if (err) return res.status(400).json({ error: err });
    const u = req.session.user;
    try {
      const t = await pool.query(`SELECT id, status FROM community_threads WHERE id = $1`, [id]);
      if (!t.rows[0] || t.rows[0].status !== 'visible') return res.status(404).json({ error: 'Thread not found.' });
      const r = await pool.query(
        `INSERT INTO community_replies (thread_id, user_id, body) VALUES ($1, $2, $3) RETURNING id`,
        [id, u.id, body]
      );
      await pool.query(`UPDATE community_threads SET last_activity_at = NOW() WHERE id = $1`, [id]);
      logAudit(u.id, u.email, 'community_reply_created', { thread_id: id, reply_id: r.rows[0].id, ip: clientIp(req) }, null, null, clientIp(req));
      res.status(201).json({ id: r.rows[0].id });
    } catch (e) {
      console.error('community reply:', e.message);
      res.status(500).json({ error: 'Could not post your reply.' });
    }
  });

  // Authors may remove their own posts; admins may hide or restore any post.
  app.patch(`${base}/threads/:id`, requireAllowedOrigin, requireMember, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const status = req.body?.status;
    if (!['visible', 'hidden', 'deleted'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const u = req.session.user;
    try {
      const t = await pool.query(`SELECT user_id FROM community_threads WHERE id = $1`, [id]);
      if (!t.rows[0]) return res.status(404).json({ error: 'Thread not found.' });
      const own = t.rows[0].user_id === u.id;
      if (!isAdmin(req) && !(own && status === 'deleted')) return res.status(403).json({ error: 'forbidden' });
      await pool.query(`UPDATE community_threads SET status = $2, updated_at = NOW() WHERE id = $1`, [id, status]);
      logAudit(u.id, u.email, 'community_thread_status', { thread_id: id, status }, null, null, clientIp(req));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Could not update the thread.' });
    }
  });

  // The thread's author or an admin may mark the accepted answer.
  app.patch(`${base}/replies/:id`, requireAllowedOrigin, requireMember, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const u = req.session.user;
    const { status, accepted } = req.body || {};
    if (status !== undefined && !['visible', 'hidden', 'deleted'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    if (accepted !== undefined && typeof accepted !== 'boolean') return res.status(400).json({ error: 'Invalid value.' });
    try {
      const r = await pool.query(
        `SELECT r.user_id, r.thread_id, t.user_id AS thread_owner FROM community_replies r JOIN community_threads t ON t.id = r.thread_id WHERE r.id = $1`,
        [id]
      );
      const row = r.rows[0];
      if (!row) return res.status(404).json({ error: 'Reply not found.' });
      const admin = isAdmin(req);
      if (status !== undefined && !admin && !(row.user_id === u.id && status === 'deleted')) return res.status(403).json({ error: 'forbidden' });
      if (accepted !== undefined && !admin && row.thread_owner !== u.id) return res.status(403).json({ error: 'forbidden' });
      if (accepted === true) await pool.query(`UPDATE community_replies SET accepted = FALSE WHERE thread_id = $1`, [row.thread_id]);
      await pool.query(
        `UPDATE community_replies SET status = COALESCE($2, status), accepted = COALESCE($3, accepted), updated_at = NOW() WHERE id = $1`,
        [id, status ?? null, accepted ?? null]
      );
      logAudit(u.id, u.email, 'community_reply_update', { reply_id: id, status, accepted }, null, null, clientIp(req));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Could not update the reply.' });
    }
  });
}

module.exports = { initSchema, registerRoutes, cors, CATEGORIES, displayName };
