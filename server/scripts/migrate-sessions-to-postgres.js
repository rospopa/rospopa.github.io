#!/usr/bin/env node
// Migrate session-file-store JSON files into Postgres session table.
// Usage: set DATABASE_URL and SESSION_DIR (optional), then run:
//   node server/scripts/migrate-sessions-to-postgres.js

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Abort.');
  process.exit(2);
}

const SESSION_DIR = process.env.SESSION_DIR || path.join('/var', 'data', 'sessions');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

  try {
    // Ensure session table exists
    await pool.query(`CREATE TABLE IF NOT EXISTS "session" (
      sid VARCHAR PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP NOT NULL
    )`);
  } catch (e) {
    console.error('Failed to ensure session table exists:', e.message || e);
    await pool.end();
    process.exit(3);
  }

  if (!fs.existsSync(SESSION_DIR)) {
    console.error('SESSION_DIR does not exist or is not accessible:', SESSION_DIR);
    await pool.end();
    process.exit(4);
  }

  const files = fs.readdirSync(SESSION_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} session file(s) in ${SESSION_DIR}`);

  let migrated = 0;
  for (const file of files) {
    const filePath = path.join(SESSION_DIR, file);
    let sid = path.basename(file, '.json');
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      let sess = JSON.parse(raw);

      // Determine expire: prefer cookie.expires, then cookie.maxAge, otherwise fallback to 24h from now
      let expireDate = null;
      if (sess && sess.cookie && sess.cookie.expires) {
        expireDate = new Date(sess.cookie.expires);
        if (isNaN(expireDate.getTime())) expireDate = null;
      }
      if (!expireDate && sess && sess.cookie && typeof sess.cookie.maxAge === 'number') {
        // Express's cookie.maxAge is in milliseconds when set via maxAge; assume ms
        expireDate = new Date(Date.now() + Number(sess.cookie.maxAge));
      }
      if (!expireDate) {
        // fallback TTL 24 hours
        expireDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      const sessJson = JSON.stringify(sess);
      // Upsert into session table
      await pool.query(
        `INSERT INTO "session" (sid, sess, expire) VALUES ($1, $2::json, $3)
         ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
        [sid, sessJson, expireDate]
      );

      migrated++;
    } catch (e) {
      console.warn(`Skipping ${file} due to parse/insert error: ${e.message || e}`);
      continue;
    }
  }

  console.log(`Migrated ${migrated} / ${files.length} sessions to Postgres.`);
  await pool.end();
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
