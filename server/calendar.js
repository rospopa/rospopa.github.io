/* ─── Calendar module ───────────────────────────────────────────────
 * Links a Google Calendar through its secret iCal (ICS) address and lets
 * admins attach per-event notification rules delivered by Call / Email / SMS.
 *
 * The ICS address is read from Google Calendar → Settings → Settings for my
 * calendars → <calendar> → "Secret address in iCal format". No OAuth client
 * registration is required.
 * ------------------------------------------------------------------ */

const { createGoogleCalendarClient } = require('./googleCalendar');

const VALID_CHANNELS = ['call', 'email', 'sms'];

// When set, these take precedence over anything stored in the database, so the
// calendar can be wired up purely through deploy secrets.
const ENV_ICS_URL = (process.env.GOOGLE_CALENDAR_ICS_URL || '').trim();
const ENV_SA_EMAIL = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
const ENV_SA_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
const ENV_API_KEY = (process.env.GOOGLE_CALENDAR_API_KEY || '').trim();
const ENV_CALENDAR_ID = (process.env.GOOGLE_CALENDAR_ID || '').trim();
const ENV_TIME_ZONE = (process.env.GOOGLE_CALENDAR_TIME_ZONE || '').trim();
const ICS_CACHE_TTL_MS = 5 * 60 * 1000;
const SCHEDULER_INTERVAL_MS = 60 * 1000;
// A rule fires when the event is this close to starting (minus its lead time).
const DISPATCH_TOLERANCE_MS = 5 * 60 * 1000;

/* ─── ICS parsing ─────────────────────────────────────────────────── */

// RFC 5545 folds long lines with CRLF + single space/tab.
function unfoldIcs(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

function unescapeIcsText(value) {
  return String(value)
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseIcsLine(line) {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const rawName = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = rawName.split(';');
  const name = parts[0].toUpperCase();
  const params = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

// Converts an ICS date/date-time value to a JS Date (UTC based).
// Floating times and TZID times are treated as UTC-ish; Google's secret ICS
// feed emits UTC (`Z`) for timed events, which is the common case.
function parseIcsDate(value, params = {}) {
  if (!value) return null;
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    return {
      date: new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])),
      allDay: true,
    };
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (dateTime) {
    return {
      date: new Date(Date.UTC(+dateTime[1], +dateTime[2] - 1, +dateTime[3], +dateTime[4], +dateTime[5], +dateTime[6])),
      allDay: false,
      tzid: params.TZID || (dateTime[7] ? 'UTC' : null),
    };
  }
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : { date: parsed, allDay: false };
}

function parseRRule(value) {
  const rule = {};
  for (const part of String(value).split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return rule;
}

const WEEKDAY_INDEX = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/**
 * Expands a recurrence rule into concrete occurrences inside [windowStart, windowEnd].
 * Supports DAILY / WEEKLY / MONTHLY / YEARLY with INTERVAL, COUNT, UNTIL and
 * (for WEEKLY) BYDAY — which covers the overwhelming majority of Google events.
 */
function expandRecurrence(start, rule, windowStart, windowEnd, maxOccurrences = 200) {
  const freq = String(rule.FREQ || '').toUpperCase();
  if (!freq) return [start];

  const interval = Math.max(1, parseInt(rule.INTERVAL, 10) || 1);
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : null;
  const untilParsed = rule.UNTIL ? parseIcsDate(rule.UNTIL) : null;
  const until = untilParsed ? untilParsed.date : null;
  const byDay = rule.BYDAY
    ? String(rule.BYDAY).split(',').map(d => WEEKDAY_INDEX[d.replace(/^[+-]?\d+/, '').toUpperCase()]).filter(d => d !== undefined)
    : null;

  const occurrences = [];
  let emitted = 0;
  let cursor = new Date(start.getTime());
  let guard = 0;

  const push = date => {
    if (until && date > until) return false;
    if (count !== null && emitted >= count) return false;
    emitted += 1;
    if (date >= windowStart && date <= windowEnd) occurrences.push(new Date(date.getTime()));
    return true;
  };

  while (guard < 5000 && occurrences.length < maxOccurrences) {
    guard += 1;
    if (cursor > windowEnd) break;
    if (count !== null && emitted >= count) break;

    if (freq === 'WEEKLY' && byDay && byDay.length) {
      const weekStart = new Date(cursor.getTime());
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      let stop = false;
      for (const day of [...byDay].sort((a, b) => a - b)) {
        const occurrence = new Date(weekStart.getTime());
        occurrence.setUTCDate(weekStart.getUTCDate() + day);
        occurrence.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0);
        if (occurrence < start) continue;
        if (!push(occurrence)) { stop = true; break; }
      }
      if (stop) break;
      cursor.setUTCDate(cursor.getUTCDate() + 7 * interval);
      continue;
    }

    if (!push(cursor)) break;

    if (freq === 'DAILY') cursor.setUTCDate(cursor.getUTCDate() + interval);
    else if (freq === 'WEEKLY') cursor.setUTCDate(cursor.getUTCDate() + 7 * interval);
    else if (freq === 'MONTHLY') cursor.setUTCMonth(cursor.getUTCMonth() + interval);
    else if (freq === 'YEARLY') cursor.setUTCFullYear(cursor.getUTCFullYear() + interval);
    else break;
  }

  return occurrences;
}

function parseIcs(text, windowStart, windowEnd) {
  const lines = unfoldIcs(text).split('\n');
  const events = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'BEGIN:VEVENT') { current = { exdates: [] }; continue; }
    if (trimmed === 'END:VEVENT') {
      if (current && current.start) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = parseIcsLine(trimmed);
    if (!parsed) continue;
    const { name, params, value } = parsed;

    if (name === 'UID') current.uid = value.trim();
    else if (name === 'SUMMARY') current.summary = unescapeIcsText(value);
    else if (name === 'DESCRIPTION') current.description = unescapeIcsText(value);
    else if (name === 'LOCATION') current.location = unescapeIcsText(value);
    else if (name === 'STATUS') current.status = value.trim().toUpperCase();
    else if (name === 'RRULE') current.rrule = parseRRule(value);
    else if (name === 'DTSTART') {
      const d = parseIcsDate(value, params);
      if (d) { current.start = d.date; current.allDay = d.allDay; }
    } else if (name === 'DTEND') {
      const d = parseIcsDate(value, params);
      if (d) current.end = d.date;
    } else if (name === 'EXDATE') {
      for (const piece of value.split(',')) {
        const d = parseIcsDate(piece, params);
        if (d) current.exdates.push(d.date.getTime());
      }
    }
  }

  const expanded = [];
  for (const event of events) {
    if (event.status === 'CANCELLED') continue;
    const durationMs = event.end && event.end > event.start
      ? event.end.getTime() - event.start.getTime()
      : (event.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000);

    const starts = event.rrule
      ? expandRecurrence(event.start, event.rrule, windowStart, windowEnd)
      : (event.start >= windowStart && event.start <= windowEnd ? [event.start] : []);

    for (const start of starts) {
      if (event.exdates.includes(start.getTime())) continue;
      expanded.push({
        uid: event.uid || `${event.summary || 'event'}-${start.toISOString()}`,
        occurrence_id: `${event.uid || 'event'}::${start.toISOString()}`,
        title: event.summary || '(no title)',
        description: event.description || '',
        location: event.location || '',
        all_day: Boolean(event.allDay),
        start: start.toISOString(),
        end: new Date(start.getTime() + durationMs).toISOString(),
        recurring: Boolean(event.rrule),
      });
    }
  }

  expanded.sort((a, b) => new Date(a.start) - new Date(b.start));
  return expanded;
}

/* ─── Module factory ──────────────────────────────────────────────── */

function createCalendarModule({ pool, logAudit, clientIp, resend, fromEmail, twilio }) {
  const icsCache = new Map(); // url -> { fetchedAt, text }
  const google = createGoogleCalendarClient({
    serviceAccountEmail: ENV_SA_EMAIL,
    serviceAccountPrivateKey: ENV_SA_KEY,
    apiKey: ENV_API_KEY,
  });
  const googleMode = google.mode();

  async function initSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS calendar_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      ics_url TEXT,
      embed_calendar_id TEXT,
      time_zone TEXT,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT calendar_settings_singleton CHECK (id = 1)
    )`);
    await pool.query(`INSERT INTO calendar_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);

    await pool.query(`CREATE TABLE IF NOT EXISTS calendar_event_notifications (
      id SERIAL PRIMARY KEY,
      event_uid TEXT NOT NULL,
      event_title TEXT,
      event_start TIMESTAMPTZ,
      channel TEXT NOT NULL,
      minutes_before INTEGER NOT NULL DEFAULT 15,
      recipient_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      recipient_name TEXT,
      recipient_email TEXT,
      recipient_phone TEXT,
      message TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent_for_start TIMESTAMPTZ,
      last_error TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS calendar_notifications_uid_idx
      ON calendar_event_notifications (event_uid)`);
  }

  async function getSettings() {
    const stored = await getStoredSettings();
    return {
      ics_url: ENV_ICS_URL || stored.ics_url || null,
      embed_calendar_id: ENV_CALENDAR_ID || stored.embed_calendar_id || null,
      time_zone: ENV_TIME_ZONE || stored.time_zone || null,
      updated_at: stored.updated_at || null,
      source: ENV_ICS_URL ? 'env' : (stored.ics_url ? 'database' : null),
      google_mode: googleMode,
      service_account_email: google.serviceAccountEmail || null,
    };
  }

  async function getStoredSettings() {
    const empty = { ics_url: null, embed_calendar_id: null, time_zone: null, updated_at: null };
    try {
      const result = await pool.query(
      `SELECT ics_url, embed_calendar_id, time_zone, updated_at FROM calendar_settings WHERE id = 1`
      );
      return result.rows[0] || empty;
    } catch (error) {
      // Table may not exist yet on a cold boot; env-based config still works.
      if (ENV_ICS_URL || ENV_SA_EMAIL || ENV_API_KEY) return empty;
      throw error;
    }
  }

  async function fetchIcs(url, { force = false } = {}) {
    const cached = icsCache.get(url);
    if (!force && cached && Date.now() - cached.fetchedAt < ICS_CACHE_TTL_MS) return cached.text;

    const isPublicUrl = /\/public\//.test(url);
    const publicHint = isPublicUrl
      ? ' This looks like the public iCal address, which only works if the calendar is shared publicly. Use the Secret address in iCal format instead.'
      : '';

    let resp;
    try {
      resp = await fetch(url, { headers: { Accept: 'text/calendar, text/plain' }, redirect: 'follow' });
    } catch (error) {
      throw new Error(`could not reach that URL (${error.message})`);
    }
    if (resp.status === 404) throw new Error(`the calendar feed was not found (404).${publicHint || ' Check the address was copied in full.'}`);
    if (resp.status === 401 || resp.status === 403) throw new Error(`access to that calendar feed was denied (${resp.status}).${publicHint}`);
    if (!resp.ok) throw new Error(`calendar feed returned ${resp.status}`);
    const text = await resp.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error(`the URL did not return an iCal feed.${publicHint || ' Make sure it ends in .ics'}`);
    icsCache.set(url, { fetchedAt: Date.now(), text });
    return text;
  }

  async function loadEvents({ daysBack = 7, daysAhead = 90, force = false } = {}) {
    const settings = await getSettings();
    const now = Date.now();
    const windowStart = new Date(now - daysBack * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now + daysAhead * 24 * 60 * 60 * 1000);

    // API credentials win over an ICS feed: Google expands recurrence for us
    // and the data is fresher than a cached .ics file.
    if (googleMode && settings.embed_calendar_id) {
      const events = await google.listEvents(settings.embed_calendar_id, {
        timeMin: windowStart,
        timeMax: windowEnd,
      });
      return { configured: true, events, provider: googleMode };
    }

    if (!settings.ics_url) return { configured: false, events: [], provider: null };
    const text = await fetchIcs(settings.ics_url, { force });
    return { configured: true, events: parseIcs(text, windowStart, windowEnd), provider: 'ics' };
  }

  /* ─── Delivery ──────────────────────────────────────────────────── */

  function describeEvent(rule, startsAt) {
    const when = startsAt
      ? new Date(startsAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
      : 'soon';
    const title = rule.event_title || 'your calendar event';
    return rule.message && rule.message.trim()
      ? rule.message.trim()
      : `Reminder: "${title}" starts at ${when}.`;
  }

  async function deliverSms(rule, body) {
    if (!twilio.configured()) throw new Error('SMS is not configured');
    const to = twilio.toE164(rule.recipient_phone);
    if (!to) throw new Error('recipient has no usable phone number');
    const from = twilio.toE164(twilio.fromNumber());
    if (!from) throw new Error('no Twilio from-number configured');
    const params = new URLSearchParams({ To: to, From: from, Body: body });
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid()}/Messages.json`,
      {
        method: 'POST',
        headers: { Authorization: twilio.authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.message || `Twilio error (${resp.status})`);
    return { sid: data.sid };
  }

  async function deliverCall(rule, body) {
    if (!twilio.configured()) throw new Error('Voice calls are not configured');
    const to = twilio.toE164(rule.recipient_phone);
    if (!to) throw new Error('recipient has no usable phone number');
    const from = twilio.toE164(twilio.fromNumber());
    if (!from) throw new Error('no Twilio from-number configured');
    const spoken = body.replace(/[<>&]/g, ' ');
    const twiml = `<Response><Say voice="alice">${spoken}</Say><Pause length="1"/><Say voice="alice">${spoken}</Say></Response>`;
    const params = new URLSearchParams({ To: to, From: from, Twiml: twiml });
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid()}/Calls.json`,
      {
        method: 'POST',
        headers: { Authorization: twilio.authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.message || `Twilio error (${resp.status})`);
    return { sid: data.sid };
  }

  async function deliverEmail(rule, body) {
    if (!rule.recipient_email) throw new Error('recipient has no email address');
    const title = rule.event_title || 'Calendar reminder';
    await resend.emails.send({
      from: `ROSPOPA <${fromEmail}>`,
      to: rule.recipient_email,
      subject: `Reminder: ${title}`,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 12px">${title}</h2>
        <p style="color:#444;font-size:15px;line-height:1.5;white-space:pre-wrap">${body}</p>
      </div>`,
    });
    return { ok: true };
  }

  async function deliver(rule, startsAt) {
    const body = describeEvent(rule, startsAt);
    if (rule.channel === 'sms') return deliverSms(rule, body);
    if (rule.channel === 'call') return deliverCall(rule, body);
    if (rule.channel === 'email') return deliverEmail(rule, body);
    throw new Error(`unsupported channel ${rule.channel}`);
  }

  /* ─── Scheduler ─────────────────────────────────────────────────── */

  let schedulerTimer = null;
  let schedulerRunning = false;

  async function runDispatchCycle() {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      const rulesResult = await pool.query(
        `SELECT * FROM calendar_event_notifications WHERE enabled = TRUE`
      );
      if (rulesResult.rows.length === 0) return;

      const { configured, events } = await loadEvents({ daysBack: 1, daysAhead: 30 });
      if (!configured) return;

      const byUid = new Map();
      for (const event of events) {
        if (!byUid.has(event.uid)) byUid.set(event.uid, []);
        byUid.get(event.uid).push(event);
      }

      const now = Date.now();
      for (const rule of rulesResult.rows) {
        const occurrences = byUid.get(rule.event_uid) || [];
        const target = occurrences.find(occurrence => {
          const start = new Date(occurrence.start).getTime();
          const fireAt = start - rule.minutes_before * 60 * 1000;
          if (now < fireAt || now > fireAt + DISPATCH_TOLERANCE_MS) return false;
          if (!rule.last_sent_for_start) return true;
          return new Date(rule.last_sent_for_start).getTime() !== start;
        });
        if (!target) continue;

        try {
          await deliver({ ...rule, event_title: rule.event_title || target.title }, target.start);
          await pool.query(
            `UPDATE calendar_event_notifications
             SET last_sent_for_start = $1, last_error = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [target.start, rule.id]
          );
          await logAudit(rule.created_by, null, 'calendar_notification_sent', {
            rule_id: rule.id, channel: rule.channel, event: rule.event_title, start: target.start,
          });
        } catch (error) {
          await pool.query(
            `UPDATE calendar_event_notifications
             SET last_error = $1, last_sent_for_start = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [String(error.message || error).slice(0, 500), target.start, rule.id]
          );
        }
      }
    } catch (error) {
      console.error('[calendar] dispatch cycle failed:', error.message);
    } finally {
      schedulerRunning = false;
    }
  }

  function startScheduler() {
    if (schedulerTimer) return;
    schedulerTimer = setInterval(runDispatchCycle, SCHEDULER_INTERVAL_MS);
    if (schedulerTimer.unref) schedulerTimer.unref();
  }

  /* ─── Routes ────────────────────────────────────────────────────── */

  function registerRoutes(app) {
    const requireAdmin = (req, res) => {
      if (!req.session.user || req.session.user.role !== 'admin') {
        res.status(403).json({ error: 'forbidden' });
        return false;
      }
      return true;
    };

    app.get('/api/calendar/settings', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        const settings = await getSettings();
        res.json({
          connected: Boolean(googleMode ? settings.embed_calendar_id : settings.ics_url),
          provider: googleMode || (settings.ics_url ? 'ics' : null),
          google_mode: settings.google_mode,
          service_account_email: settings.service_account_email,
          needs_calendar_id: Boolean(googleMode && !settings.embed_calendar_id),
          // Never echo the secret feed URL back in full.
          ics_url_preview: settings.ics_url ? `${String(settings.ics_url).slice(0, 42)}…` : null,
          embed_calendar_id: settings.embed_calendar_id || null,
          time_zone: settings.time_zone || null,
          updated_at: settings.updated_at || null,
          source: settings.source,
          env_managed: settings.source === 'env' || Boolean(googleMode),
          channels: {
            sms: twilio.configured() && Boolean(twilio.fromNumber()),
            call: twilio.configured() && Boolean(twilio.fromNumber()),
            email: true,
          },
        });
      } catch (error) {
        res.status(500).json({ error: 'failed to load calendar settings' });
      }
    });

    app.put('/api/calendar/settings', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      if (ENV_ICS_URL || googleMode) {
        return res.status(409).json({ error: 'The calendar is configured through environment variables. Change them in your host and redeploy.' });
      }
      const { ics_url, embed_calendar_id, time_zone } = req.body || {};
      const url = typeof ics_url === 'string' ? ics_url.trim() : '';
      const embedId = typeof embed_calendar_id === 'string' ? embed_calendar_id.trim() : '';
      if (url && !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: 'iCal address must be an http(s) URL' });
      }
      if (!url && !embedId) {
        const current = await getStoredSettings();
        return res.status(400).json({
          error: current.ics_url
            ? 'Nothing to update - paste a new iCal address or calendar ID.'
            : 'Paste the secret iCal address from Google Calendar to connect.',
        });
      }
      try {
        if (url) await fetchIcs(url, { force: true });
      } catch (error) {
        return res.status(400).json({ error: `could not read that calendar feed: ${error.message}` });
      }
      try {
        await pool.query(
          `UPDATE calendar_settings
           SET ics_url = COALESCE(NULLIF($1, ''), ics_url),
               embed_calendar_id = NULLIF($2, ''),
               time_zone = NULLIF($3, ''),
               updated_by = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = 1`,
          [url, String(embed_calendar_id || '').trim(), String(time_zone || '').trim(), req.session.user.id]
        );
        await logAudit(req.session.user.id, req.session.user.email, 'calendar_settings_updated',
          { connected: Boolean(url) }, null, null, clientIp(req));
        const settings = await getSettings();
        res.json({ ok: true, connected: Boolean(settings.ics_url) });
      } catch (error) {
        res.status(500).json({ error: 'failed to save calendar settings' });
      }
    });

    app.delete('/api/calendar/settings', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      if (ENV_ICS_URL || googleMode) {
        return res.status(409).json({ error: 'The calendar is configured through environment variables. Remove them in your host and redeploy.' });
      }
      try {
        await pool.query(
          `UPDATE calendar_settings SET ics_url = NULL, embed_calendar_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1`
        );
        icsCache.clear();
        await logAudit(req.session.user.id, req.session.user.email, 'calendar_disconnected', {}, null, null, clientIp(req));
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'failed to disconnect calendar' });
      }
    });

    app.post('/api/calendar/test-connection', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const settings = await getSettings();
      try {
        if (googleMode) {
          if (!settings.embed_calendar_id) {
            return res.status(400).json({
              ok: false,
              error: 'Set GOOGLE_CALENDAR_ID to the calendar you want to read (usually your Gmail address).',
            });
          }
          await google.verify(settings.embed_calendar_id);
          return res.json({
            ok: true,
            provider: googleMode,
            message: googleMode === 'service_account'
              ? `Reached ${settings.embed_calendar_id} as ${google.serviceAccountEmail}.`
              : `Reached ${settings.embed_calendar_id} with the API key.`,
          });
        }
        if (!settings.ics_url) {
          return res.status(400).json({ ok: false, error: 'No calendar is configured yet.' });
        }
        const result = await loadEvents({ daysAhead: 7, daysBack: 1, force: true });
        return res.json({
          ok: true,
          provider: 'ics',
          message: `Read the calendar feed (${result.events.length} event(s) in the next week).`,
        });
      } catch (error) {
        return res.status(502).json({ ok: false, error: error.message || 'could not reach the calendar' });
      }
    });
    app.get('/api/calendar/events', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const daysAhead = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90));
      const daysBack = Math.min(90, Math.max(0, parseInt(req.query.days_back, 10) || 7));
      try {
        const { configured, events, provider } = await loadEvents({
          daysAhead, daysBack, force: req.query.refresh === '1',
        });
        res.json({ configured, events, provider });
      } catch (error) {
        res.status(502).json({ error: error.message || 'failed to read the calendar feed' });
      }
    });

    app.get('/api/calendar/notifications', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        const result = await pool.query(
          `SELECT n.*, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS user_name, u.email AS user_email
           FROM calendar_event_notifications n
           LEFT JOIN users u ON u.id = n.recipient_user_id
           ORDER BY n.created_at DESC`
        );
        res.json(result.rows);
      } catch (error) {
        res.status(500).json({ error: 'failed to load notifications' });
      }
    });

    async function resolveRecipient(body) {
      const recipientUserId = Number(body.recipient_user_id) || null;
      let name = String(body.recipient_name || '').trim() || null;
      let email = String(body.recipient_email || '').trim() || null;
      let phone = String(body.recipient_phone || '').trim() || null;

      if (recipientUserId) {
        const result = await pool.query(
          `SELECT first_name, last_name, email, phone_number FROM users WHERE id = $1`, [recipientUserId]
        );
        const row = result.rows[0];
        if (!row) throw new Error('recipient not found');
        name = name || [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email;
        email = email || row.email || null;
        phone = phone || row.phone_number || null;
      }
      return { recipientUserId, name, email, phone };
    }

    app.post('/api/calendar/notifications', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const body = req.body || {};
      const channel = String(body.channel || '').toLowerCase();
      if (!VALID_CHANNELS.includes(channel)) {
        return res.status(400).json({ error: `channel must be one of ${VALID_CHANNELS.join(', ')}` });
      }
      const eventUid = String(body.event_uid || '').trim();
      if (!eventUid) return res.status(400).json({ error: 'event_uid is required' });
      const minutesBefore = Math.min(10080, Math.max(0, parseInt(body.minutes_before, 10) || 0));

      try {
        const recipient = await resolveRecipient(body);
        if (!recipient.recipientUserId && !recipient.email && !recipient.phone) {
          return res.status(400).json({ error: 'pick a recipient or provide an email/phone' });
        }
        if ((channel === 'sms' || channel === 'call') && !twilio.toE164(recipient.phone)) {
          return res.status(400).json({ error: 'that recipient has no usable phone number' });
        }
        if (channel === 'email' && !recipient.email) {
          return res.status(400).json({ error: 'that recipient has no email address' });
        }

        const result = await pool.query(
          `INSERT INTO calendar_event_notifications
             (event_uid, event_title, event_start, channel, minutes_before,
              recipient_user_id, recipient_name, recipient_email, recipient_phone, message, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING *`,
          [
            eventUid,
            String(body.event_title || '').trim() || null,
            body.event_start ? new Date(body.event_start) : null,
            channel,
            minutesBefore,
            recipient.recipientUserId,
            recipient.name,
            recipient.email,
            recipient.phone,
            String(body.message || '').trim() || null,
            req.session.user.id,
          ]
        );
        await logAudit(req.session.user.id, req.session.user.email, 'calendar_notification_created',
          { channel, event_uid: eventUid, minutes_before: minutesBefore }, null, null, clientIp(req));
        res.status(201).json(result.rows[0]);
      } catch (error) {
        res.status(500).json({ error: error.message || 'failed to create notification' });
      }
    });

    app.patch('/api/calendar/notifications/:id', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'invalid id' });
      const body = req.body || {};
      const updates = [];
      const values = [];

      if (body.channel !== undefined) {
        const channel = String(body.channel).toLowerCase();
        if (!VALID_CHANNELS.includes(channel)) return res.status(400).json({ error: 'invalid channel' });
        values.push(channel); updates.push(`channel = $${values.length}`);
      }
      if (body.minutes_before !== undefined) {
        values.push(Math.min(10080, Math.max(0, parseInt(body.minutes_before, 10) || 0)));
        updates.push(`minutes_before = $${values.length}`);
      }
      if (body.message !== undefined) {
        values.push(String(body.message || '').trim() || null);
        updates.push(`message = $${values.length}`);
      }
      if (body.enabled !== undefined) {
        values.push(Boolean(body.enabled)); updates.push(`enabled = $${values.length}`);
      }
      if (!updates.length) return res.status(400).json({ error: 'nothing to update' });

      values.push(id);
      try {
        const result = await pool.query(
          `UPDATE calendar_event_notifications
           SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
           WHERE id = $${values.length} RETURNING *`,
          values
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'not found' });
        res.json(result.rows[0]);
      } catch (error) {
        res.status(500).json({ error: 'failed to update notification' });
      }
    });

    app.delete('/api/calendar/notifications/:id', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'invalid id' });
      try {
        const result = await pool.query(
          `DELETE FROM calendar_event_notifications WHERE id = $1 RETURNING id`, [id]
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'not found' });
        await logAudit(req.session.user.id, req.session.user.email, 'calendar_notification_deleted',
          { rule_id: id }, null, null, clientIp(req));
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ error: 'failed to delete notification' });
      }
    });

    app.post('/api/calendar/notifications/:id/test', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ error: 'invalid id' });
      try {
        const result = await pool.query(`SELECT * FROM calendar_event_notifications WHERE id = $1`, [id]);
        const rule = result.rows[0];
        if (!rule) return res.status(404).json({ error: 'not found' });
        const outcome = await deliver(rule, rule.event_start);
        await logAudit(req.session.user.id, req.session.user.email, 'calendar_notification_test',
          { rule_id: id, channel: rule.channel }, null, null, clientIp(req));
        res.json({ ok: true, ...outcome });
      } catch (error) {
        res.status(502).json({ error: error.message || 'test delivery failed' });
      }
    });
  }

  return { initSchema, registerRoutes, startScheduler, runDispatchCycle, parseIcs };
}

module.exports = { createCalendarModule, parseIcs, expandRecurrence };
