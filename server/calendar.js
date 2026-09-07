/* ─── Calendar module ───────────────────────────────────────────────
 * Links a Google Calendar through its secret iCal (ICS) address and lets
 * admins attach per-event notification rules delivered by Call / Email / SMS.
 *
 * The ICS address is read from Google Calendar → Settings → Settings for my
 * calendars → <calendar> → "Secret address in iCal format". No OAuth client
 * registration is required.
 * ------------------------------------------------------------------ */

const { createGoogleCalendarClient, normalizeEvent } = require('./googleCalendar');

const VALID_CHANNELS = ['call', 'email', 'sms'];

// When set, these take precedence over anything stored in the database, so the
// calendar can be wired up purely through deploy secrets.
const ENV_ICS_URL = (process.env.GOOGLE_CALENDAR_ICS_URL || '').trim();
const ENV_SA_EMAIL = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
const ENV_SA_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
const ENV_API_KEY = (process.env.GOOGLE_CALENDAR_API_KEY || '').trim();
const ENV_CALENDAR_ID = (process.env.GOOGLE_CALENDAR_ID || '').trim();
const ENV_TIME_ZONE = (process.env.GOOGLE_CALENDAR_TIME_ZONE || '').trim();
// A second, read-only calendar (e.g. a published Outlook/Office 365 feed)
// merged into the same view and tagged so the UI can tell the two apart.
const ENV_WORK_ICS_URL = (process.env.WORK_CALENDAR_ICS_URL || '').trim();
const ENV_WORK_LABEL = (process.env.WORK_CALENDAR_LABEL || 'Work').trim() || 'Work';
const ICS_CACHE_TTL_MS = 5 * 60 * 1000;
const ICS_REQUEST_TIMEOUT_MS = 15 * 1000;
const SCHEDULER_INTERVAL_MS = 60 * 1000;
// How long a synced copy of the events is served without asking Google again,
// and how often the background sync refreshes it.
const EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const EVENTS_SYNC_INTERVAL_MS = 5 * 60 * 1000;
// A rule fires when the event is this close to starting (minus its lead time).
const DISPATCH_TOLERANCE_MS = 5 * 60 * 1000;

/* ─── Contacts-on-events ──────────────────────────────────────────────
 * Contacts attached to an event are stored platform-side and mirrored to
 * Google. Real guest invites are attempted first, but Google forbids them
 * for service accounts without Workspace domain-wide delegation, so the
 * fallback writes a clearly-marked block into the event description. */
const CONTACTS_MARKER = '=== Contacts (synced from rospopa.com) ===';
// Google may HTML-ify the description after edits in its UI, so tolerate <br>s.
const CONTACTS_BLOCK_RE = /(?:\s|<br\s*\/?>)*={3,} Contacts \(synced from rospopa\.com\) ={3,}[\s\S]*$/;

function contactLabel(row) {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return name || row.email || `contact #${row.id}`;
}

function buildContactsBlock(rows) {
  if (!rows.length) return '';
  const lines = rows.map(row => {
    const bits = [contactLabel(row)];
    if (row.email) bits.push(row.email);
    if (row.organization) bits.push(row.organization);
    return `• ${bits.join(' — ')}`;
  });
  return `${CONTACTS_MARKER}\n${lines.join('\n')}`;
}

function stripContactsBlock(description) {
  return String(description || '').replace(CONTACTS_BLOCK_RE, '').trim();
}

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
// Google's secret ICS feed emits UTC (`Z`); Outlook's published feed emits
// wall-clock times tagged with Windows timezone names, which are resolved
// through the map below. Unknown zones fall back to UTC.
const WINDOWS_TZ_TO_IANA = {
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Atlantic Standard Time': 'America/Halifax',
  'SA Pacific Standard Time': 'America/Bogota',
  'Argentina Standard Time': 'America/Argentina/Buenos_Aires',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw',
  'Romance Standard Time': 'Europe/Paris',
  'FLE Standard Time': 'Europe/Kyiv',
  'GTB Standard Time': 'Europe/Bucharest',
  'E. Europe Standard Time': 'Europe/Chisinau',
  'Russian Standard Time': 'Europe/Moscow',
  'Israel Standard Time': 'Asia/Jerusalem',
  'Arabian Standard Time': 'Asia/Dubai',
  'India Standard Time': 'Asia/Kolkata',
  'SE Asia Standard Time': 'Asia/Bangkok',
  'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  'New Zealand Standard Time': 'Pacific/Auckland',
  'UTC': 'UTC',
  'Coordinated Universal Time': 'UTC',
};

function resolveTzid(tzid) {
  const raw = String(tzid || '').trim();
  if (!raw) return null;
  if (WINDOWS_TZ_TO_IANA[raw]) return WINDOWS_TZ_TO_IANA[raw];
  // Some feeds already use IANA names (e.g. America/New_York).
  if (raw.includes('/')) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: raw });
      return raw;
    } catch { return null; }
  }
  return null;
}

// Interprets wall-clock components in a zone and returns the UTC instant.
// Two passes converge across DST boundaries.
function zonedTimeToUtc(year, month, day, hour, minute, second, ianaZone) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 2; i += 1) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = {};
    for (const part of dtf.formatToParts(new Date(utc))) parts[part.type] = part.value;
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, (+parts.hour) % 24, +parts.minute, +parts.second);
    utc += Date.UTC(year, month - 1, day, hour, minute, second) - asUtc;
  }
  return new Date(utc);
}

function parseIcsDate(value, params = {}) {
  if (!value) return null;
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) {
    return {
      date: new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])),
      allDay: true,
      wallDate: new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])),
    };
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (dateTime) {
    const [, y, mo, d, h, mi, s, z] = dateTime;
    const wallDate = new Date(Date.UTC(+y, +mo - 1, +d));
    if (!z && params.TZID) {
      const iana = resolveTzid(params.TZID);
      if (iana) {
        return { date: zonedTimeToUtc(+y, +mo, +d, +h, +mi, +s, iana), allDay: false, tzid: params.TZID, wallDate };
      }
    }
    return {
      date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)),
      allDay: false,
      tzid: params.TZID || (z ? 'UTC' : null),
      wallDate,
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
    // Outlook marks all-day events with this instead of VALUE=DATE.
    else if (name === 'X-MICROSOFT-CDO-ALLDAYEVENT') current.msAllDay = /^TRUE$/i.test(value.trim());
    else if (name === 'DTSTART') {
      const d = parseIcsDate(value, params);
      if (d) { current.start = d.date; current.allDay = d.allDay; current.wallStart = d.wallDate || null; }
    } else if (name === 'DTEND') {
      const d = parseIcsDate(value, params);
      if (d) { current.end = d.date; current.wallEnd = d.wallDate || null; }
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

    // Outlook all-day events arrive as midnight-to-midnight TZID times; snap
    // them to their wall-clock dates so they render as true all-day entries.
    if (event.msAllDay && !event.allDay && event.wallStart) {
      event.allDay = true;
      event.start = event.wallStart;
      if (event.wallEnd) event.end = event.wallEnd;
    }

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

    await pool.query(`CREATE TABLE IF NOT EXISTS calendar_event_contacts (
      id SERIAL PRIMARY KEY,
      event_uid TEXT NOT NULL,
      contact_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (event_uid, contact_id)
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS calendar_event_contacts_uid_idx
      ON calendar_event_contacts (event_uid)`);
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

  // A hung feed would otherwise hold the request open until the hosting proxy
  // times out, which reaches the browser as an opaque 502.
  async function fetchWithTimeout(url, options = {}) {
    if (typeof AbortController !== 'function') return fetch(url, options);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ICS_REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error && (error.name === 'AbortError' || /abort/i.test(error.message || ''))) {
        throw new Error(`the calendar feed did not respond within ${ICS_REQUEST_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
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
      resp = await fetchWithTimeout(url, {
        headers: { Accept: 'text/calendar, text/plain' },
        redirect: 'follow',
      });
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

  async function fetchEventsLive(settings, { daysBack, daysAhead, force }) {
    const now = Date.now();
    const windowStart = new Date(now - daysBack * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now + daysAhead * 24 * 60 * 60 * 1000);

    const tag = (events, calendar, editable) =>
      events.map(event => ({ ...event, calendar, editable }));

    // Personal calendar: API credentials win over an ICS feed - Google expands
    // recurrence for us and the data is fresher than a cached .ics file.
    const loadPersonal = async () => {
      if (googleMode && settings.embed_calendar_id) {
        const result = await google.listEvents(settings.embed_calendar_id, {
          timeMin: windowStart,
          timeMax: windowEnd,
        });
        return {
          events: tag(result.events, 'personal', googleMode === 'service_account'),
          provider: googleMode,
          details_hidden: result.detailsHidden || false,
        };
      }
      if (!settings.ics_url) return null;
      const text = await fetchIcs(settings.ics_url, { force });
      return { events: tag(parseIcs(text, windowStart, windowEnd), 'personal', false), provider: 'ics', details_hidden: false };
    };

    // Work calendar: a published Outlook feed is read-only by nature.
    const loadWork = async () => {
      if (!ENV_WORK_ICS_URL) return null;
      const text = await fetchIcs(ENV_WORK_ICS_URL, { force });
      return { events: tag(parseIcs(text, windowStart, windowEnd), 'work', false) };
    };

    const [personal, work] = await Promise.allSettled([loadPersonal(), loadWork()]);

    // Both sources broken (or the only configured one): a real error.
    if (personal.status === 'rejected' && (work.status === 'rejected' || !ENV_WORK_ICS_URL)) {
      throw personal.reason;
    }
    if (personal.status === 'fulfilled' && personal.value === null && work.status === 'rejected') {
      throw new Error(`the work calendar feed failed: ${work.reason.message}`);
    }

    const personalValue = personal.status === 'fulfilled' ? personal.value : null;
    const workValue = work.status === 'fulfilled' ? work.value : null;
    const configured = Boolean(personalValue || workValue || ENV_WORK_ICS_URL);
    if (!personalValue && !workValue) return { configured: false, events: [], provider: null };

    const events = [...(personalValue ? personalValue.events : []), ...(workValue ? workValue.events : [])]
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    // One side failing degrades to a labelled partial view, not an error page.
    let syncError = null;
    if (personal.status === 'rejected') syncError = `the personal calendar failed: ${personal.reason.message}`;
    else if (work.status === 'rejected') syncError = `the ${ENV_WORK_LABEL} calendar feed failed: ${work.reason.message}`;

    return {
      configured,
      events,
      provider: personalValue ? personalValue.provider : 'ics',
      details_hidden: Boolean(personalValue && personalValue.details_hidden),
      work_calendar: Boolean(ENV_WORK_ICS_URL),
      work_label: ENV_WORK_ICS_URL ? ENV_WORK_LABEL : null,
      ...(syncError ? { sync_error: syncError } : {}),
    };
  }

  // Requests are answered from this synced copy, so a page load never waits on
  // a round trip to Google, and a Google outage degrades to slightly stale
  // data with a sync_error note instead of an error page.
  const eventsCache = new Map(); // source+window -> { fetchedAt, payload }

  async function loadEvents({ daysBack = 7, daysAhead = 90, force = false } = {}) {
    const settings = await getSettings();
    const source = googleMode && settings.embed_calendar_id
      ? `${googleMode}:${settings.embed_calendar_id}`
      : `ics:${settings.ics_url || ''}`;
    const key = `${source}:${daysBack}:${daysAhead}`;
    const cached = eventsCache.get(key);

    if (cached && !force && Date.now() - cached.fetchedAt < EVENTS_CACHE_TTL_MS) {
      return { ...cached.payload, synced_at: cached.fetchedAt };
    }

    try {
      const payload = await fetchEventsLive(settings, { daysBack, daysAhead, force });
      const fetchedAt = Date.now();
      if (payload.configured) {
        if (eventsCache.size > 20) eventsCache.clear();
        eventsCache.set(key, { fetchedAt, payload });
      }
      return { ...payload, synced_at: fetchedAt };
    } catch (error) {
      // Yesterday's calendar beats no calendar: keep serving the last good
      // copy for as long as the process lives, labelled with what is wrong.
      if (cached) {
        return { ...cached.payload, synced_at: cached.fetchedAt, sync_error: String(error.message || error) };
      }
      throw error;
    }
  }

  /** Mirror an event's contact list to Google: real guests when allowed,
   *  otherwise a marked block in the description. Never throws. */
  async function syncContactsToGoogle(calendarId, eventId, contactRows) {
    let current;
    try {
      current = await google.getEvent(calendarId, eventId);
    } catch (error) {
      return { synced: false, method: null, reason: `could not read the event from Google (${error.message})` };
    }

    const base = stripContactsBlock(current.description);
    const block = buildContactsBlock(contactRows);
    const description = block ? `${base}${base ? '\n\n' : ''}${block}` : base;

    // Only ever ADD guests: removing one that was invited directly in Google
    // Calendar is not ours to do.
    const existing = Array.isArray(current.attendees) ? current.attendees : [];
    const have = new Set(existing.map(a => String(a.email || '').toLowerCase()));
    const additions = contactRows
      .filter(row => row.email && !have.has(String(row.email).toLowerCase()))
      .map(row => ({ email: row.email, displayName: contactLabel(row) }));

    if (additions.length) {
      try {
        await google.patchEvent(calendarId, eventId, { description, attendees: [...existing, ...additions] });
        return { synced: true, method: 'attendees', reason: null };
      } catch (error) {
        if (error.code !== 'attendees_forbidden') {
          return { synced: false, method: null, reason: error.message };
        }
        // Fall back to the description block below.
      }
    }
    try {
      await google.patchEvent(calendarId, eventId, { description });
      return {
        synced: true,
        method: 'description',
        reason: additions.length
          ? 'Google blocks robot accounts from sending guest invites, so the contacts were written into the event description instead.'
          : null,
      };
    } catch (error) {
      return { synced: false, method: null, reason: error.message };
    }
  }

  /* ─── Delivery ──────────────────────────────────────────────────── */  function describeEvent(rule, startsAt) {
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

  // Keeps the synced copy warm so the first page load after a quiet spell is
  // answered from memory instead of waiting on Google. Uses the same window
  // the calendar page requests.
  let eventsSyncTimer = null;
  async function syncEventsCache() {
    try {
      const result = await loadEvents({ daysBack: 90, daysAhead: 365, force: true });
      if (result.sync_error) console.error('[calendar] background sync kept stale data:', result.sync_error);
    } catch (error) {
      console.error('[calendar] background sync failed:', error.message);
    }
  }

  function startScheduler() {
    if (schedulerTimer) return;
    schedulerTimer = setInterval(runDispatchCycle, SCHEDULER_INTERVAL_MS);
    if (schedulerTimer.unref) schedulerTimer.unref();
    syncEventsCache();
    eventsSyncTimer = setInterval(syncEventsCache, EVENTS_SYNC_INTERVAL_MS);
    if (eventsSyncTimer.unref) eventsSyncTimer.unref();
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
          connected: Boolean(googleMode ? settings.embed_calendar_id : settings.ics_url) || Boolean(ENV_WORK_ICS_URL),
          work_calendar: Boolean(ENV_WORK_ICS_URL),
          work_label: ENV_WORK_ICS_URL ? ENV_WORK_LABEL : null,
          work_ics_url_preview: ENV_WORK_ICS_URL ? `${ENV_WORK_ICS_URL.slice(0, 42)}…` : null,
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
      let settings;
      try {
        settings = await getSettings();
      } catch (error) {
        // 424, not 502: Cloudflare replaces origin 502 bodies with its own page.
        return res.status(424).json({ ok: false, error: error.message || 'could not load calendar settings' });
      }

      // Each configured source is tested independently so one broken feed
      // doesn't hide the other's status.
      const results = [];
      let accessRole = null;

      if (googleMode) {
        if (!settings.embed_calendar_id) {
          results.push({ ok: false, message: 'Personal: set GOOGLE_CALENDAR_ID to the calendar you want to read (usually your Gmail address).' });
        } else {
          try {
            const verified = await google.verify(settings.embed_calendar_id);
            accessRole = verified.accessRole || null;
            const freeBusyNote = verified.accessRole === 'freeBusyReader'
              ? ' However, the calendar is shared as free/busy only, so event titles are hidden - change the share to "See all event details".'
              : '';
            results.push({
              ok: true,
              message: (googleMode === 'service_account'
                ? `Personal: reached ${settings.embed_calendar_id} as ${google.serviceAccountEmail}.`
                : `Personal: reached ${settings.embed_calendar_id} with the API key.`) + freeBusyNote,
            });
          } catch (error) {
            results.push({ ok: false, message: `Personal: ${error.message}` });
          }
        }
      } else if (settings.ics_url) {
        try {
          const text = await fetchIcs(settings.ics_url, { force: true });
          const events = parseIcs(text, new Date(Date.now() - 86400000), new Date(Date.now() + 7 * 86400000));
          results.push({ ok: true, message: `Personal: read the calendar feed (${events.length} event(s) in the next week).` });
        } catch (error) {
          results.push({ ok: false, message: `Personal: ${error.message}` });
        }
      }

      if (ENV_WORK_ICS_URL) {
        try {
          const text = await fetchIcs(ENV_WORK_ICS_URL, { force: true });
          const events = parseIcs(text, new Date(Date.now() - 86400000), new Date(Date.now() + 7 * 86400000));
          results.push({ ok: true, message: `${ENV_WORK_LABEL}: read the published feed (${events.length} event(s) in the next week).` });
        } catch (error) {
          results.push({ ok: false, message: `${ENV_WORK_LABEL}: ${error.message}` });
        }
      }

      if (!results.length) {
        return res.status(400).json({ ok: false, error: 'No calendar is configured yet.' });
      }
      const ok = results.some(r => r.ok);
      const message = results.map(r => `${r.ok ? '✓' : '✗'} ${r.message}`).join('  ');
      if (!ok) return res.status(424).json({ ok: false, error: message });
      return res.json({ ok: true, provider: googleMode || 'ics', access_role: accessRole, message });
    });
    app.get('/api/calendar/events', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const daysAhead = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90));
      const daysBack = Math.min(90, Math.max(0, parseInt(req.query.days_back, 10) || 7));
      try {
        const result = await loadEvents({
          daysAhead, daysBack, force: req.query.refresh === '1',
        });
        res.json(result);
      } catch (error) {
        // Not 502: Cloudflare swaps the body of an origin 502/504 for its own
        // error page, which hides this message from the client entirely.
        res.status(424).json({ error: error.message || 'failed to read the calendar feed' });
      }
    });

    // Edit an event in place. Requires the calendar to be shared with the
    // service account as "Make changes to events".
    app.patch('/api/calendar/events/:eventId', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const eventId = String(req.params.eventId || '').trim();
      if (!eventId || eventId.length > 1024) return res.status(400).json({ error: 'invalid event id' });
      if ((req.body || {}).calendar === 'work') {
        return res.status(409).json({ error: `The ${ENV_WORK_LABEL} calendar is a published read-only feed - edit that event in Outlook.` });
      }
      try {
        const settings = await getSettings();
        if (!(googleMode === 'service_account' && settings.embed_calendar_id)) {
          return res.status(409).json({
            error: googleMode
              ? 'Editing needs the service account connection with GOOGLE_CALENDAR_ID set.'
              : 'Editing events needs the Google API connection - a read-only iCal feed cannot be written to.',
          });
        }
        const body = req.body || {};
        const patch = {};
        if (typeof body.title === 'string') {
          const title = body.title.trim();
          if (!title) return res.status(400).json({ error: 'the event needs a title' });
          patch.summary = title;
        }
        if (typeof body.description === 'string') patch.description = body.description;
        if (typeof body.location === 'string') patch.location = body.location.trim();
        if (body.start || body.end) {
          if (!body.start || !body.end) return res.status(400).json({ error: 'start and end must be set together' });
          if (body.all_day) {
            const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateOnly.test(body.start) || !dateOnly.test(body.end)) {
              return res.status(400).json({ error: 'all-day times must be YYYY-MM-DD dates' });
            }
            if (body.end <= body.start) return res.status(400).json({ error: 'the event must end after it starts' });
            // Google's all-day end date is exclusive; the client sends it that way.
            patch.start = { date: body.start };
            patch.end = { date: body.end };
          } else {
            const start = new Date(body.start);
            const end = new Date(body.end);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
              return res.status(400).json({ error: 'unreadable start or end time' });
            }
            if (end <= start) return res.status(400).json({ error: 'the event must end after it starts' });
            patch.start = { dateTime: start.toISOString() };
            patch.end = { dateTime: end.toISOString() };
          }
        }
        if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing to update' });

        // The description carries the synced contacts block; rebuild it from
        // the stored contact list so an edit can't silently erase it.
        if (typeof patch.description === 'string') {
          const uid = String(body.uid || eventId);
          const rows = (await pool.query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.organization
             FROM calendar_event_contacts ec JOIN users u ON u.id = ec.contact_id
             WHERE ec.event_uid = $1 ORDER BY u.first_name, u.last_name`,
            [uid]
          )).rows;
          const base = stripContactsBlock(patch.description);
          const block = buildContactsBlock(rows);
          patch.description = block ? `${base}${base ? '\n\n' : ''}${block}` : base;
        }

        const updated = await google.patchEvent(settings.embed_calendar_id, eventId, patch);
        eventsCache.clear();
        await logAudit(req.session.user.id, req.session.user.email, 'calendar_event_edited',
          { event_id: eventId, fields: Object.keys(patch) }, null, null, clientIp(req));
        res.json({ ok: true, event: normalizeEvent(updated) });
      } catch (error) {
        res.status(424).json({ error: error.message || 'could not update the event' });
      }
    });

    app.get('/api/calendar/event-contacts', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      try {
        const result = await pool.query(
          `SELECT ec.event_uid, ec.contact_id, u.first_name, u.last_name, u.email, u.organization
           FROM calendar_event_contacts ec
           JOIN users u ON u.id = ec.contact_id
           ORDER BY u.first_name, u.last_name`
        );
        res.json(result.rows);
      } catch (error) {
        res.status(500).json({ error: 'failed to load event contacts' });
      }
    });

    // Replace the set of contacts on an event (keyed by series uid so it
    // covers every occurrence), then mirror the list to Google.
    app.put('/api/calendar/events/:uid/contacts', async (req, res) => {
      if (!requireAdmin(req, res)) return;
      const uid = String(req.params.uid || '').trim();
      if (!uid || uid.length > 1024) return res.status(400).json({ error: 'invalid event id' });
      const ids = Array.from(new Set(
        (Array.isArray(req.body && req.body.contact_ids) ? req.body.contact_ids : [])
          .map(Number).filter(n => Number.isInteger(n) && n > 0)
      ));
      try {
        const contactRows = ids.length
          ? (await pool.query(
              `SELECT id, first_name, last_name, email, organization FROM users WHERE id = ANY($1::int[])`,
              [ids]
            )).rows
          : [];
        if (contactRows.length !== ids.length) {
          return res.status(400).json({ error: 'one of those contacts no longer exists' });
        }

        await pool.query(`DELETE FROM calendar_event_contacts WHERE event_uid = $1`, [uid]);
        for (const row of contactRows) {
          await pool.query(
            `INSERT INTO calendar_event_contacts (event_uid, contact_id, added_by)
             VALUES ($1, $2, $3) ON CONFLICT (event_uid, contact_id) DO NOTHING`,
            [uid, row.id, req.session.user.id]
          );
        }

        const settings = await getSettings();
        let googleSync = {
          synced: false, method: null,
          reason: 'The calendar is connected through a read-only feed, so Google was not updated.',
        };
        if (String((req.body || {}).source || '') === 'work') {
          googleSync = {
            synced: false, method: null,
            reason: `The ${ENV_WORK_LABEL} calendar is a read-only published feed, so contacts are saved on the platform only.`,
          };
        } else if (googleMode === 'service_account' && settings.embed_calendar_id) {
          googleSync = await syncContactsToGoogle(settings.embed_calendar_id, uid, contactRows);
          if (googleSync.synced) eventsCache.clear();
        }

        await logAudit(req.session.user.id, req.session.user.email, 'calendar_event_contacts_updated',
          { event_uid: uid, contact_ids: ids, google: googleSync.method || 'not_synced' }, null, null, clientIp(req));
        res.json({ ok: true, contacts: contactRows, google: googleSync });
      } catch (error) {
        res.status(424).json({ error: error.message || 'could not update the event contacts' });
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
        // 424, not 502: Cloudflare replaces origin 502 bodies with its own page.
        res.status(424).json({ error: error.message || 'test delivery failed' });
      }
    });
  }

  return { initSchema, registerRoutes, startScheduler, runDispatchCycle, parseIcs };
}

module.exports = { createCalendarModule, parseIcs, expandRecurrence };
