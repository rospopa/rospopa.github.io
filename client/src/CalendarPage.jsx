import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, formatPhone } from './shared'

const CHANNELS = [
  { value: 'sms', label: 'SMS', icon: '💬', needs: 'phone' },
  { value: 'call', label: 'Call', icon: '📞', needs: 'phone' },
  { value: 'email', label: 'Email', icon: '✉️', needs: 'email' },
]

const LEAD_TIMES = [
  { value: 0, label: 'At start time' },
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
]

function channelMeta(value) {
  return CHANNELS.find(c => c.value === value) || CHANNELS[0]
}

function leadLabel(minutes) {
  const match = LEAD_TIMES.find(l => l.value === Number(minutes))
  return match ? match.label : `${minutes} minutes before`
}

function fmtEventTime(event) {
  const start = new Date(event.start)
  if (event.all_day) {
    return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) + ' · All day'
  }
  return start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function dayKey(iso) {
  return new Date(iso).toISOString().slice(0, 10)
}

function fmtDayHeading(key) {
  const date = new Date(`${key}T12:00:00Z`)
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  if (key === today) return 'Today'
  if (key === tomorrow) return 'Tomorrow'
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/* ─── Connect panel ─────────────────────────────────────────────── */

function ConnectPanel({ settings, onSaved }) {
  const envManaged = Boolean(settings?.env_managed)
  const googleMode = settings?.google_mode || null
  const apiMode = Boolean(googleMode)
  const [icsUrl, setIcsUrl] = useState('')
  const [embedId, setEmbedId] = useState(settings?.embed_calendar_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  async function save() {
    setSaving(true); setError('')
    try {
      await apiFetch('/api/calendar/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ics_url: icsUrl.trim(), embed_calendar_id: embedId.trim() }),
      })
      setIcsUrl('')
      onSaved()
    } catch (e) {
      setError(e.message || 'Could not save those calendar settings')
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true); setTestResult(null); setError('')
    try {
      const r = await apiFetch('/api/calendar/test-connection', { method: 'POST' })
      setTestResult({ ok: true, message: r.message || 'Connected.' })
    } catch (e) {
      setTestResult({ ok: false, message: e.message || 'Could not reach the calendar' })
    } finally {
      setTesting(false)
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect this Google Calendar? Notification rules are kept but will stop firing.')) return
    setSaving(true)
    try {
      await apiFetch('/api/calendar/settings', { method: 'DELETE' })
      onSaved()
    } catch (e) {
      setError(e.message || 'Could not disconnect')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold">Google Calendar connection</h3>
        {apiMode ? (
          <p className="text-sm text-base-content/60 mt-1">
            Connected through the Google Calendar API using{' '}
            {googleMode === 'service_account' ? 'a service account' : 'an API key'}. Configured entirely
            through environment variables &mdash; change them in your host and redeploy.
          </p>
        ) : envManaged ? (
          <p className="text-sm text-base-content/60 mt-1">
            This calendar is configured through deploy secrets. Point{' '}
            <code className="text-xs">GOOGLE_CALENDAR_ICS_URL</code> at your calendar's{' '}
            <strong>Secret address in iCal format</strong>, and optionally set{' '}
            <code className="text-xs">GOOGLE_CALENDAR_ID</code> for the embedded month view.
          </p>
        ) : (
          <p className="text-sm text-base-content/60 mt-1">
            Paste the <strong>Secret address in iCal format</strong> below, or configure the Google Calendar
            API instead with a service account &mdash; see the setup notes below.
          </p>
        )}
      </div>

      {apiMode ? (
        <div className="rounded-lg bg-base-200 px-3 py-2 space-y-1">
          <p className="text-sm">
            <span className={`badge badge-sm mr-2 ${settings.connected ? 'badge-success' : 'badge-warning'}`}>
              {settings.connected ? 'Connected' : 'Needs calendar ID'}
            </span>
            via {googleMode === 'service_account' ? 'service account' : 'API key'}
          </p>
          {settings.service_account_email && (
            <p className="text-xs text-base-content/55 break-all">
              Share your calendar with <code>{settings.service_account_email}</code>
            </p>
          )}
          {settings.embed_calendar_id && (
            <p className="text-xs text-base-content/55">Calendar: {settings.embed_calendar_id}</p>
          )}
          {settings.needs_calendar_id && (
            <p className="text-xs text-warning">
              Set <code>GOOGLE_CALENDAR_ID</code> to the calendar you want to read.
            </p>
          )}
        </div>
      ) : envManaged ? (
        <div className="rounded-lg bg-base-200 px-3 py-2 space-y-1">
          <p className="text-sm">
            <span className="badge badge-success badge-sm mr-2">Connected</span>
            via <code className="text-xs">GOOGLE_CALENDAR_ICS_URL</code>
          </p>
          <p className="text-xs text-base-content/55 break-all">{settings.ics_url_preview}</p>
          {settings.embed_calendar_id && (
            <p className="text-xs text-base-content/55">Embedded view: {settings.embed_calendar_id}</p>
          )}
        </div>
      ) : (
        <>
          <label className="form-control">
            <span className="label-text text-xs uppercase tracking-widest text-base-content/50">Secret iCal address</span>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder={settings?.connected ? settings.ics_url_preview || 'Connected' : 'https://calendar.google.com/calendar/ical/.../basic.ics'}
              value={icsUrl}
              onChange={e => setIcsUrl(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="form-control">
            <span className="label-text text-xs uppercase tracking-widest text-base-content/50">
              Calendar ID for the embedded view (optional)
            </span>
            <input
              className="input input-bordered w-full"
              placeholder="you@gmail.com"
              value={embedId}
              onChange={e => setEmbedId(e.target.value)}
            />
          </label>

          <details className="text-sm">
            <summary className="cursor-pointer text-base-content/70">
              Prefer API credentials instead of an iCal link?
            </summary>
            <div className="mt-2 space-y-2 text-base-content/60">
              <p>
                An API key alone can only read <strong>public</strong> calendars. For a private calendar,
                use a service account &mdash; still just environment variables, no browser sign-in:
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>In Google Cloud, enable the <strong>Google Calendar API</strong>.</li>
                <li>
                  Create a service account, then <strong>skip the optional IAM role step</strong> &mdash; roles
                  grant nothing on your calendar. Download its JSON key.
                </li>
                <li>
                  Set <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and{' '}
                  <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> from that file, plus{' '}
                  <code className="text-xs">GOOGLE_CALENDAR_ID</code>.
                </li>
                <li>
                  In Google Calendar, share the calendar with the service account address
                  (<em>Share with specific people</em>). Choose <strong>See all event details</strong> &mdash;
                  free/busy hides event titles. This sharing step is what grants access.
                </li>
              </ol>
              <p>
                For a public calendar you can instead set{' '}
                <code className="text-xs">GOOGLE_CALENDAR_API_KEY</code>.
              </p>
            </div>
          </details>
        </>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn btn-sm btn-outline" onClick={testConnection} disabled={testing}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        {testResult && (
          <span className={`text-sm ${testResult.ok ? 'text-success' : 'text-error'}`}>
            {testResult.message}
          </span>
        )}
      </div>

      {error && <div className="alert alert-error text-sm py-2">{error}</div>}

      {!envManaged && !apiMode && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || (!icsUrl.trim() && !embedId.trim())}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            {settings?.connected ? 'Update connection' : 'Connect calendar'}
          </button>
          {settings?.connected && (
            <button className="btn btn-ghost btn-sm text-error" onClick={disconnect} disabled={saving}>
              Disconnect
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Notification rule editor ──────────────────────────────────── */

function NotificationModal({ open, event, contacts, channels, onClose, onSaved }) {
  const [channel, setChannel] = useState('sms')
  const [minutesBefore, setMinutesBefore] = useState(15)
  const [recipientId, setRecipientId] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setChannel('sms'); setMinutesBefore(15); setRecipientId('')
      setManualEmail(''); setManualPhone(''); setMessage(''); setError('')
    }
  }, [open])

  const meta = channelMeta(channel)
  const selected = contacts.find(c => String(c.id) === String(recipientId))

  const eligible = useMemo(() => contacts.filter(c => (
    meta.needs === 'phone' ? Boolean(c.phone_number) : Boolean(c.email)
  )), [contacts, meta.needs])

  async function save() {
    setSaving(true); setError('')
    try {
      await apiFetch('/api/calendar/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_uid: event.uid,
          event_title: event.title,
          event_start: event.start,
          channel,
          minutes_before: Number(minutesBefore),
          recipient_user_id: recipientId ? Number(recipientId) : null,
          recipient_email: recipientId ? null : manualEmail.trim() || null,
          recipient_phone: recipientId ? null : manualPhone.trim() || null,
          message: message.trim() || null,
        }),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message || 'Could not create that notification')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !event) return null

  const canSave = Boolean(recipientId) || (meta.needs === 'phone' ? manualPhone.trim() : manualEmail.trim())

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg space-y-4">
        <h3 className="font-bold text-lg">Add notification</h3>
        <div className="rounded-lg bg-base-200 px-3 py-2">
          <p className="font-medium">{event.title}</p>
          <p className="text-xs text-base-content/60">{fmtEventTime(event)}</p>
        </div>

        <div>
          <span className="label-text text-xs uppercase tracking-widest text-base-content/50">Notify by</span>
          <div className="join mt-1 w-full">
            {CHANNELS.map(c => (
              <button
                key={c.value}
                type="button"
                className={`btn btn-sm join-item flex-1 ${channel === c.value ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setChannel(c.value); setRecipientId('') }}
              >
                <span aria-hidden>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
          {channels && channels[channel] === false && (
            <p className="text-xs text-warning mt-1">
              {channel === 'email'
                ? 'Email delivery is not configured on the server.'
                : 'Twilio is not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER.'}
            </p>
          )}
        </div>

        <label className="form-control">
          <span className="label-text text-xs uppercase tracking-widest text-base-content/50">When</span>
          <select className="select select-bordered" value={minutesBefore} onChange={e => setMinutesBefore(e.target.value)}>
            {LEAD_TIMES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>

        <label className="form-control">
          <span className="label-text text-xs uppercase tracking-widest text-base-content/50">Who to notify</span>
          <select className="select select-bordered" value={recipientId} onChange={e => setRecipientId(e.target.value)}>
            <option value="">— Enter manually —</option>
            {eligible.map(c => (
              <option key={c.id} value={c.id}>
                {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
                {meta.needs === 'phone' ? ` · ${formatPhone(c.phone_number)}` : ` · ${c.email}`}
              </option>
            ))}
          </select>
          {eligible.length === 0 && (
            <span className="text-xs text-base-content/50 mt-1">
              No contacts have a {meta.needs === 'phone' ? 'phone number' : 'email address'} on file.
            </span>
          )}
        </label>

        {!recipientId && meta.needs === 'phone' && (
          <label className="form-control">
            <span className="label-text text-xs uppercase tracking-widest text-base-content/50">Phone number</span>
            <input className="input input-bordered" placeholder="+1 407 972 4041" value={manualPhone} onChange={e => setManualPhone(e.target.value)} />
          </label>
        )}
        {!recipientId && meta.needs === 'email' && (
          <label className="form-control">
            <span className="label-text text-xs uppercase tracking-widest text-base-content/50">Email address</span>
            <input className="input input-bordered" placeholder="name@example.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
          </label>
        )}

        <label className="form-control">
          <span className="label-text text-xs uppercase tracking-widest text-base-content/50">
            Custom message (optional)
          </span>
          <textarea
            className="textarea textarea-bordered"
            rows={3}
            placeholder={`Reminder: "${event.title}" starts soon.`}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </label>

        {selected && (
          <p className="text-xs text-base-content/60">
            Will reach {[selected.first_name, selected.last_name].filter(Boolean).join(' ') || selected.email} at{' '}
            {meta.needs === 'phone' ? formatPhone(selected.phone_number) : selected.email}.
          </p>
        )}

        {error && <div className="alert alert-error text-sm py-2">{error}</div>}

        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !canSave}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            Add notification
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>
    </div>
  )
}

/* ─── Page ──────────────────────────────────────────────────────── */

export default function CalendarPage() {
  const [settings, setSettings] = useState(null)
  const [events, setEvents] = useState([])
  const [rules, setRules] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [modalEvent, setModalEvent] = useState(null)
  const [testing, setTesting] = useState(null)
  const [toast, setToast] = useState('')

  const loadSettings = useCallback(async () => {
    const data = await apiFetch('/api/calendar/settings')
    setSettings(data)
    return data
  }, [])

  const loadRules = useCallback(async () => {
    const data = await apiFetch('/api/calendar/notifications')
    setRules(Array.isArray(data) ? data : [])
  }, [])

  const loadEvents = useCallback(async (force = false) => {
    try {
      const data = await apiFetch(`/api/calendar/events?days=120${force ? '&refresh=1' : ''}`)
      setEvents(data.events || [])
      setError('')
    } catch (e) {
      setEvents([])
      setError(e.message || 'Could not read the calendar feed')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const s = await loadSettings()
        if (cancelled) return
        await loadRules()
        if (s.connected) await loadEvents()
        try {
          const contactData = await apiFetch('/api/contacts')
          if (!cancelled) setContacts(Array.isArray(contactData) ? contactData : (contactData.contacts || []))
        } catch { /* contacts are optional for the picker */ }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load the calendar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [loadSettings, loadRules, loadEvents])

  async function refresh() {
    setRefreshing(true)
    await loadEvents(true)
    await loadRules()
    setRefreshing(false)
  }

  async function removeRule(id) {
    if (!confirm('Delete this notification?')) return
    await apiFetch(`/api/calendar/notifications/${id}`, { method: 'DELETE' })
    loadRules()
  }

  async function toggleRule(rule) {
    await apiFetch(`/api/calendar/notifications/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    })
    loadRules()
  }

  async function testRule(rule) {
    setTesting(rule.id)
    try {
      await apiFetch(`/api/calendar/notifications/${rule.id}/test`, { method: 'POST' })
      setToast(`Test ${rule.channel} sent to ${rule.recipient_name || rule.recipient_email || rule.recipient_phone}`)
    } catch (e) {
      setToast(e.message || 'Test delivery failed')
    } finally {
      setTesting(null)
      setTimeout(() => setToast(''), 5000)
    }
  }

  const rulesByEvent = useMemo(() => {
    const map = new Map()
    for (const rule of rules) {
      if (!map.has(rule.event_uid)) map.set(rule.event_uid, [])
      map.get(rule.event_uid).push(rule)
    }
    return map
  }, [rules])

  const grouped = useMemo(() => {
    const now = Date.now()
    const upcoming = events.filter(e => new Date(e.end || e.start).getTime() >= now)
    const map = new Map()
    for (const event of upcoming) {
      const key = dayKey(event.start)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [events])

  const embedSrc = settings?.embed_calendar_id
    ? `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(settings.embed_calendar_id)}&mode=MONTH&showTitle=0&showPrint=0&showTabs=0&showCalendars=0`
    : null

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="loading loading-spinner loading-lg" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Calendar</h2>
          <p className="text-sm text-base-content/60">
            Your Google Calendar, with Call, Email and SMS notifications you can target at any contact.
          </p>
        </div>
        <div className="flex gap-2">
          {settings?.connected && (
            <button className="btn btn-sm btn-outline" onClick={refresh} disabled={refreshing}>
              {refreshing ? <span className="loading loading-spinner loading-xs" /> : null} Refresh
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setShowSettings(v => !v)}>
            {settings?.connected ? 'Connection settings' : 'Connect Google Calendar'}
          </button>
        </div>
      </div>

      {(showSettings || !settings?.connected) && (
        <ConnectPanel
          settings={settings}
          onSaved={async () => {
            const s = await loadSettings()
            setShowSettings(false)
            if (s.connected) await loadEvents(true)
          }}
        />
      )}

      {error && <div className="alert alert-warning text-sm">{error}</div>}

      {settings?.connected && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-base-content/50">Upcoming events</h3>
            {grouped.length === 0 && (
              <div className="rounded-xl border border-dashed border-base-300 p-8 text-center text-sm text-base-content/50">
                No upcoming events in the next 120 days.
              </div>
            )}
            {grouped.map(([key, dayEvents]) => (
              <div key={key} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-base-content/45">{fmtDayHeading(key)}</p>
                {dayEvents.map(event => {
                  const eventRules = rulesByEvent.get(event.uid) || []
                  return (
                    <div key={event.occurrence_id} className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{event.title}</p>
                          <p className="text-xs text-base-content/60">{fmtEventTime(event)}</p>
                          {event.location && <p className="text-xs text-base-content/45 truncate">{event.location}</p>}
                        </div>
                        <button className="btn btn-xs btn-outline" onClick={() => setModalEvent(event)}>
                          + Notification
                        </button>
                      </div>
                      {eventRules.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {eventRules.map(rule => (
                            <span
                              key={rule.id}
                              className={`badge badge-sm gap-1 ${rule.enabled ? 'badge-primary badge-outline' : 'badge-ghost'}`}
                              title={`${rule.recipient_name || rule.recipient_email || rule.recipient_phone} · ${leadLabel(rule.minutes_before)}`}
                            >
                              {channelMeta(rule.channel).icon} {leadLabel(rule.minutes_before)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="space-y-6">
            {embedSrc && (
              <div className="rounded-xl border border-base-300 bg-base-100 p-2 shadow-sm">
                <iframe
                  title="Google Calendar"
                  src={embedSrc}
                  className="w-full rounded-lg"
                  style={{ height: 420, border: 0 }}
                />
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-base-content/50">
                Notification rules ({rules.length})
              </h3>
              {rules.length === 0 && (
                <div className="rounded-xl border border-dashed border-base-300 p-6 text-center text-sm text-base-content/50">
                  No notifications yet. Pick an event and add one.
                </div>
              )}
              {rules.map(rule => (
                <div key={rule.id} className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {channelMeta(rule.channel).icon} {rule.event_title || 'Calendar event'}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {leadLabel(rule.minutes_before)} · {rule.recipient_name || rule.recipient_email || formatPhone(rule.recipient_phone)}
                      </p>
                      {rule.last_error && <p className="text-xs text-error truncate">Last attempt: {rule.last_error}</p>}
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-sm toggle-primary"
                      checked={Boolean(rule.enabled)}
                      onChange={() => toggleRule(rule)}
                      title={rule.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-xs btn-ghost" onClick={() => testRule(rule)} disabled={testing === rule.id}>
                      {testing === rule.id ? <span className="loading loading-spinner loading-xs" /> : null} Send test
                    </button>
                    <button className="btn btn-xs btn-ghost text-error" onClick={() => removeRule(rule.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <NotificationModal
        open={Boolean(modalEvent)}
        event={modalEvent}
        contacts={contacts}
        channels={settings?.channels}
        onClose={() => setModalEvent(null)}
        onSaved={loadRules}
      />

      {toast && (
        <div className="toast toast-end z-50">
          <div className="alert alert-info text-sm">{toast}</div>
        </div>
      )}
    </div>
  )
}
