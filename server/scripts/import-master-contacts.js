const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');

const DEFAULT_PASSWORD = 'ContactImport2026!';
const DB_PATH = path.join(__dirname, '..', 'users.db');
const DEFAULT_XLSX_PATH = path.join(process.env.USERPROFILE || process.env.HOME || '', '.copilot', 'workspaces', '530f8536-ccb2-46e7-a70c-e85900d93f49', 'attachments', '7b5d2e00-bbea-4c1f-9499-100184077592-Master.xlsx');
const workbookPath = process.argv[2] || DEFAULT_XLSX_PATH;

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
}

function pickString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

function normalizePhone(raw) {
  const value = pickString(raw);
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? value : null;
}

function normalizeBirthday(raw) {
  const value = pickString(raw);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const m = value.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const day = Number(m[2]);
  if (!month || day < 1 || day > 31) return null;
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found: ${filePath}`);
    process.exit(1);
  }
}

function readContacts(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('soi')) || workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });

  const contacts = [];
  const seenEmails = new Set();
  for (const row of rows) {
    const firstName = pickString(row['First Name'] || row['First name'] || row['first_name']);
    const lastName = pickString(row['Last Name'] || row['Last name'] || row['last_name']);
    if (!firstName && !lastName && !row['Email Address'] && !row['Phone Number']) continue;

    const rawEmail = pickString(row['Email Address'] || row['Email'] || row['email']);
    const email = rawEmail || createSyntheticEmail(firstName, lastName, seenEmails, contacts.length + 1);
    seenEmails.add(email.toLowerCase());

    contacts.push({
      first_name: firstName || null,
      last_name: lastName || null,
      email: email.toLowerCase(),
      phone_number: normalizePhone(row['Phone Number'] || row['Phone'] || row['phone_number']) || null,
      birthday: normalizeBirthday(row['Happy Birthday'] || row['Birthday'] || row['birthdate']) || null,
      organization: null,
      role: 'user',
      buy_box: null
    });
  }

  return contacts;
}

function createSyntheticEmail(firstName, lastName, usedSet, index) {
  const base = slugify([firstName, lastName].filter(Boolean).join(' ')) || `contact${index}`;
  let candidate = `${base}@contact.local`;
  let suffix = 2;
  while (usedSet.has(candidate.toLowerCase())) {
    candidate = `${base}${suffix}@contact.local`;
    suffix += 1;
  }
  return candidate.toLowerCase();
}

function runImport() {
  ensureFileExists(workbookPath);
  const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  const contacts = readContacts(workbookPath);

  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      first_name TEXT,
      last_name TEXT,
      organization TEXT,
      phone_number TEXT,
      buy_box TEXT,
      birthday TEXT,
      profile_photo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`);

    const ensureColumn = (columnName, columnType) => new Promise((resolve) => {
      db.all('PRAGMA table_info(users)', (err, columns) => {
        if (err) return resolve();
        const exists = columns.some(col => col.name === columnName);
        if (!exists) {
          db.run(`ALTER TABLE users ADD COLUMN ${columnName} ${columnType}`, () => resolve());
        } else {
          resolve();
        }
      });
    });

    Promise.all([
      ensureColumn('birthday', 'TEXT'),
      ensureColumn('profile_photo', 'TEXT'),
      ensureColumn('created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'),
      ensureColumn('updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP'),
      ensureColumn('last_login', 'DATETIME')
    ]).then(() => {
      const stmt = db.prepare(`INSERT INTO users (
        email, password, role, first_name, last_name, organization, phone_number, buy_box, birthday,
        profile_photo, created_at, updated_at, last_login
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'), NULL)
      ON CONFLICT(email) DO UPDATE SET
        password = excluded.password,
        role = excluded.role,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        organization = excluded.organization,
        phone_number = excluded.phone_number,
        buy_box = excluded.buy_box,
        birthday = excluded.birthday,
        updated_at = datetime('now')`);

      let inserted = 0;
      contacts.forEach((contact) => {
        stmt.run([
          contact.email,
          passwordHash,
          contact.role,
          contact.first_name,
          contact.last_name,
          contact.organization,
          contact.phone_number,
          contact.buy_box,
          contact.birthday
        ], (err) => {
          if (err) {
            console.error('Insert failed for', contact.email, err.message);
            return;
          }
          inserted += 1;
        });
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Finalize failed:', err.message);
          db.close();
          process.exit(1);
        }
        console.log(`Imported ${inserted} contacts into ${DB_PATH}`);
        db.close();
      });
    }).catch((err) => {
      console.error('Failed to prepare import:', err.message);
      db.close();
      process.exit(1);
    });
  });
}

runImport();
