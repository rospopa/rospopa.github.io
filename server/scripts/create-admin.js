/* Usage:
 * node scripts/create-admin.js --email=admin@example.com --password=secret
 * or set ADMIN_EMAIL and ADMIN_PASSWORD in env and run: node scripts/create-admin.js
 */
require('dotenv').config();
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const argv = require('minimist')(process.argv.slice(2));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'users.db');
const email = (argv.email || process.env.ADMIN_EMAIL);
const password = (argv.password || process.env.ADMIN_PASSWORD);

if (!email || !password) {
  console.error('Please provide --email and --password or set ADMIN_EMAIL and ADMIN_PASSWORD in env');
  process.exit(1);
}

(async () => {
  const hashed = await bcrypt.hash(password, 10);
  const db = new sqlite3.Database(DB_PATH);
  db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
    if (err) {
      console.error('DB lookup failed:', err && err.message);
      process.exit(1);
    }
    if (row) {
      db.run('UPDATE users SET password = ?, role = ? WHERE id = ?', [hashed, 'admin', row.id], function (uerr) {
        if (uerr) {
          console.error('Failed to update admin user:', uerr && uerr.message);
          process.exit(1);
        }
        console.log('Updated admin user:', email.toLowerCase());
        process.exit(0);
      });
    } else {
      db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email.toLowerCase(), hashed, 'admin'], function (ierr) {
        if (ierr) {
          console.error('Failed to create admin user:', ierr && ierr.message);
          process.exit(1);
        }
        console.log('Created admin user:', email.toLowerCase());
        process.exit(0);
      });
    }
  });
})();
