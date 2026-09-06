/* ─── Google Calendar API access ─────────────────────────────────────
 * Two credential styles, both configured purely through env secrets:
 *
 *   1. Service account (works with PRIVATE calendars)
 *      GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *      Share the calendar with the service account address, then it can read
 *      it. Auth is a signed JWT exchanged for an access token — no browser
 *      round trip, so nothing to click at deploy time.
 *
 *   2. API key (works with PUBLIC calendars only)
 *      GOOGLE_CALENDAR_API_KEY
 *      Google rejects key-only access to private calendars with a 404, so this
 *      is only useful for a calendar set to "Make available to public".
 *
 * Signing uses node's crypto, so no extra dependency is needed.
 * ------------------------------------------------------------------- */

const crypto = require('crypto');

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_SKEW_MS = 60 * 1000;

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Env vars and secret managers mangle PEM newlines in different ways.
function normalizePrivateKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  // Some UIs wrap the whole value in quotes.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Literal backslash-n is the most common form when pasting a JSON key.
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  return key.trim();
}

function createGoogleCalendarClient({
  serviceAccountEmail,
  serviceAccountPrivateKey,
  apiKey,
  fetchImpl,
} = {}) {
  const email = String(serviceAccountEmail || '').trim();
  const privateKey = normalizePrivateKey(serviceAccountPrivateKey);
  const key = String(apiKey || '').trim();
  const doFetch = (...args) => (fetchImpl || globalThis.fetch)(...args);

  let tokenCache = { token: null, expiresAt: 0 };

  const hasServiceAccount = Boolean(email && privateKey);
  const hasApiKey = Boolean(key);

  function mode() {
    if (hasServiceAccount) return 'service_account';
    if (hasApiKey) return 'api_key';
    return null;
  }

  function signAssertion() {
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64Url(JSON.stringify({
      iss: email,
      scope: CALENDAR_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    }));
    const signingInput = `${header}.${claims}`;
    let signature;
    try {
      signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey);
    } catch (error) {
      throw new Error(
        'the service account private key could not be read. Paste the full private_key value from the JSON key file, including the BEGIN and END lines.'
      );
    }
    return `${signingInput}.${base64Url(signature)}`;
  }

  async function getAccessToken({ force = false } = {}) {
    if (!hasServiceAccount) throw new Error('no service account configured');
    if (!force && tokenCache.token && Date.now() < tokenCache.expiresAt - TOKEN_SKEW_MS) {
      return tokenCache.token;
    }
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signAssertion(),
    });
    const resp = await doFetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) {
      const detail = data.error_description || data.error || `HTTP ${resp.status}`;
      if (/invalid_grant/i.test(String(data.error || ''))) {
        throw new Error(
          `Google rejected the service account credentials (${detail}). Check the client email and private key match the same JSON key, and that the server clock is correct.`
        );
      }
      throw new Error(`could not get a Google access token: ${detail}`);
    }
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    return tokenCache.token;
  }

  function describeApiError(status, data, calendarId) {
    const reason = data?.error?.message || `HTTP ${status}`;
    if (status === 404) {
      return hasServiceAccount
        ? `calendar "${calendarId}" was not found. Share it with ${email} in Google Calendar (Settings -> Share with specific people), then try again.`
        : `calendar "${calendarId}" was not found. An API key can only read calendars that are public — use a service account for a private calendar.`;
    }
    if (status === 401 || status === 403) {
      if (/not been used|disabled/i.test(reason)) {
        return `the Google Calendar API is not enabled for this project. Enable it in the Google Cloud console, then try again. (${reason})`;
      }
      return hasServiceAccount
        ? `access denied for calendar "${calendarId}". Make sure it is shared with ${email}. (${reason})`
        : `access denied for calendar "${calendarId}". API keys only work on public calendars. (${reason})`;
    }
    return `Google Calendar API error: ${reason}`;
  }

  /** Fetch events, letting Google expand recurrence for us. */
  async function listEvents(calendarId, { timeMin, timeMax, maxResults = 2500 } = {}) {
    if (!calendarId) throw new Error('no calendar ID configured');
    if (!hasServiceAccount && !hasApiKey) throw new Error('no Google API credentials configured');

    const collected = [];
    let pageToken = null;
    let pages = 0;

    do {
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: String(Math.min(2500, maxResults)),
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
      });
      if (pageToken) params.set('pageToken', pageToken);
      if (!hasServiceAccount && hasApiKey) params.set('key', key);

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
      const headers = { Accept: 'application/json' };
      if (hasServiceAccount) headers.Authorization = `Bearer ${await getAccessToken()}`;

      let resp;
      try {
        resp = await doFetch(url, { headers });
      } catch (error) {
        throw new Error(`could not reach the Google Calendar API (${error.message})`);
      }
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(describeApiError(resp.status, data, calendarId));

      collected.push(...(data.items || []));
      pageToken = data.nextPageToken || null;
      pages += 1;
    } while (pageToken && pages < 10 && collected.length < maxResults);

    return collected.filter(item => item.status !== 'cancelled').map(normalizeEvent);
  }

  async function verify(calendarId) {
    const now = Date.now();
    await listEvents(calendarId, {
      timeMin: new Date(now - 24 * 60 * 60 * 1000),
      timeMax: new Date(now + 24 * 60 * 60 * 1000),
      maxResults: 1,
    });
    return true;
  }

  return { mode, hasServiceAccount, hasApiKey, listEvents, verify, getAccessToken, serviceAccountEmail: email };
}

/** Map a Calendar API resource onto the same shape the ICS parser produces. */
function normalizeEvent(item) {
  const allDay = Boolean(item.start && item.start.date && !item.start.dateTime);
  const startRaw = item.start?.dateTime || item.start?.date;
  const endRaw = item.end?.dateTime || item.end?.date;
  const start = startRaw ? new Date(allDay ? `${item.start.date}T00:00:00Z` : startRaw) : null;
  const end = endRaw ? new Date(allDay ? `${item.end.date}T00:00:00Z` : endRaw) : null;

  // Recurring instances share recurringEventId, so a notification rule attached
  // to the series keeps matching every occurrence — same as an ICS UID.
  const seriesId = item.recurringEventId || item.id;

  return {
    uid: seriesId,
    occurrence_id: item.id,
    title: item.summary || '(no title)',
    description: item.description || '',
    location: item.location || '',
    all_day: allDay,
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : (start ? new Date(start.getTime() + 3600000).toISOString() : null),
    recurring: Boolean(item.recurringEventId),
    html_link: item.htmlLink || null,
  };
}

module.exports = { createGoogleCalendarClient, normalizeEvent, normalizePrivateKey, base64Url };
