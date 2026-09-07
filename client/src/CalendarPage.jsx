import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

function dayKey(iso, allDay = false) {
  const date = new Date(iso)
  // All-day events are stored as UTC midnight, so reading them in local time
  // would shift them a day west of Greenwich. Timed events are the opposite:
  // they must be read locally or a late evening event lands on tomorrow.
  if (allDay) return date.toISOString().slice(0, 10)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function todayKey() {
  return dayKey(new Date().toISOString())
}

function addMonths(key, delta) {
  const [y, m] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// The six-week grid the month is drawn on, starting on Sunday.
function monthGridDays(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1))
  const start = new Date(first)
  start.setUTCDate(1 - first.getUTCDay())
  const days = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + i)
    days.push({
      key: date.toISOString().slice(0, 10),
      dayOfMonth: date.getUTCDate(),
      inMonth: date.getUTCMonth() === m - 1,
    })
  }
  return days
}

function fmtChipTime(event) {
  if (event.all_day) return 'All day'
  return new Date(event.start)
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(':00', '')
}

// Google returns descriptions as HTML. Rendering it as markup would be an
// injection risk, so it is flattened to readable text instead.
function plainText(html) {
  if (!html) return ''
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
                  From that JSON file, set <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>{' '}
                  to its <code className="text-xs">client_email</code> and{' '}
                  <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> to its{' '}
                  <code className="text-xs">private_key</code> (the whole value, BEGIN and END lines
                  included). Set <code className="text-xs">GOOGLE_CALENDAR_ID</code> to your own Gmail
                  address &mdash; that is the calendar being read, not the service account.
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

/* ─── Month grid ────────────────────────────────────────────────── */

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MonthGrid({ monthKey, onMonthChange, eventsByDay, selectedDay, onSelectDay, onOpenEvent }) {
  const days = useMemo(() => monthGridDays(monthKey), [monthKey])
  const today = todayKey()

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <h3 className="font-semibold">{monthLabel(monthKey)}</h3>
        <div className="join">
          <button
            className="btn btn-xs join-item"
            onClick={() => onMonthChange(addMonths(monthKey, -1))}
            aria-label="Previous month"
          >‹</button>
          <button className="btn btn-xs join-item" onClick={() => onMonthChange(today.slice(0, 7))}>Today</button>
          <button
            className="btn btn-xs join-item"
            onClick={() => onMonthChange(addMonths(monthKey, 1))}
            aria-label="Next month"
          >›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-base-300 bg-base-200/50">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="px-1 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-base-content/50">
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map(day => {
          const dayEvents = eventsByDay.get(day.key) || []
          const isToday = day.key === today
          const isSelected = day.key === selectedDay
          return (
            <div
              key={day.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(day.key)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDay(day.key) }
              }}
              className={[
                // min-w-0 lets the cell shrink so long titles truncate instead
                // of pushing the seven columns wider than the viewport.
                'flex min-w-0 flex-col min-h-[64px] sm:min-h-[92px] border-b border-r border-base-200 p-1',
                'cursor-pointer transition-colors hover:bg-base-200/60 focus:outline-none focus-visible:ring focus-visible:ring-primary/40',
                day.inMonth ? '' : 'bg-base-200/30 text-base-content/35',
                isSelected ? 'bg-primary/10' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]',
                  isToday ? 'bg-primary font-bold text-primary-content' : 'text-base-content/70',
                ].join(' ')}
              >
                {day.dayOfMonth}
              </span>

              {/* Phones have no room for labels, so the day shows a density dot. */}
              <span className="mt-1 flex gap-0.5 sm:hidden">
                {dayEvents.slice(0, 3).map(event => (
                  <span key={event.occurrence_id} className="h-1.5 w-1.5 rounded-full bg-primary" />
                ))}
              </span>

              <span className="mt-1 hidden min-w-0 flex-col gap-0.5 sm:flex">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.occurrence_id}
                    type="button"
                    title={event.title}
                    onClick={e => { e.stopPropagation(); onOpenEvent(event) }}
                    className="block w-full truncate rounded bg-primary/15 px-1 py-[1px] text-left text-[11px] leading-tight text-primary hover:bg-primary/30"
                  >
                    {event.all_day ? '' : `${fmtChipTime(event)} `}{event.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="px-1 text-[10px] text-base-content/50">+{dayEvents.length - 3} more</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Event details ─────────────────────────────────────────────── */

function EventDetailModal({ event, rules, onClose, onAddNotification }) {
  if (!event) return null
  const description = plainText(event.description)
  return (
    <div className="modal modal-open" onClick={onClose}>
      <div className="modal-box max-w-lg" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{event.title}</h3>
        <p className="mt-1 text-sm text-base-content/70">{fmtEventTime(event)}</p>
        {event.location && <p className="mt-1 text-sm text-base-content/60">📍 {event.location}</p>}
        {event.recurring && <p className="mt-1 text-xs text-base-content/45">Repeats</p>}
        {description && (
          <p className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-sm text-base-content/75">{description}</p>
        )}
        {rules.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/45">Notifications</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {rules.map(rule => (
                <span key={rule.id} className={`badge badge-sm gap-1 ${rule.enabled ? 'badge-primary badge-outline' : 'badge-ghost'}`}>
                  {channelMeta(rule.channel).icon} {leadLabel(rule.minutes_before)}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="modal-action">
          <button className="btn btn-sm" onClick={onClose}>Close</button>
          <button className="btn btn-sm btn-primary" onClick={() => onAddNotification(event)}>+ Notification</button>
        </div>
      </div>
    </div>
  )
}

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
  const [lastSynced, setLastSynced] = useState(null)
  const [detailsHidden, setDetailsHidden] = useState(false)
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

  const lastFetchRef = useRef(0)

  const loadEvents = useCallback(async (force = false) => {
    lastFetchRef.current = Date.now()
    try {
      // The month grid can be paged in either direction, so load the widest
      // window the API allows rather than just the upcoming few months.
      const data = await apiFetch(`/api/calendar/events?days=365&days_back=90${force ? '&refresh=1' : ''}`)
      setEvents(data.events || [])
      setDetailsHidden(Boolean(data.details_hidden))
      setLastSynced(data.synced_at || Date.now())
      // The server keeps serving its last good copy when Google stops
      // answering; say so rather than silently showing stale days.
      setError(data.sync_error ? `Google sync is failing: ${data.sync_error}` : '')
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
        // None of these depend on each other, so don't load them in single file.
        await Promise.all([
          loadRules(),
          s.connected ? loadEvents() : Promise.resolve(),
          apiFetch('/api/contacts')
            .then(contactData => {
              if (!cancelled) setContacts(Array.isArray(contactData) ? contactData : (contactData.contacts || []))
            })
            .catch(() => { /* contacts are optional for the picker */ }),
        ])
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load the calendar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [loadSettings, loadRules, loadEvents])

  // Google is the source of truth, so an event added there has to appear here
  // without the user having to know that a Refresh button exists.
  useEffect(() => {
    if (!settings?.connected) return undefined
    const SYNC_INTERVAL_MS = 5 * 60 * 1000
    const MIN_GAP_MS = 60 * 1000

    const sync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (Date.now() - lastFetchRef.current < MIN_GAP_MS) return
      loadEvents(true)
    }

    const timer = setInterval(sync, SYNC_INTERVAL_MS)
    // Coming back to the tab is the moment a stale calendar is most obvious.
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [settings?.connected, loadEvents])

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
      const key = dayKey(event.start, event.all_day)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [events])

  const eventsByDay = useMemo(() => {
    const map = new Map()
    for (const event of events) {
      const key = dayKey(event.start, event.all_day)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.start) - new Date(b.start))
    return map
  }, [events])

  const [monthKey, setMonthKey] = useState(() => todayKey().slice(0, 7))
  const [selectedDay, setSelectedDay] = useState(() => todayKey())
  const [detailEvent, setDetailEvent] = useState(null)

  const selectedDayEvents = eventsByDay.get(selectedDay) || []

  // Matches the window loadEvents requests, so an empty month can say whether
  // it is genuinely empty or simply outside the data that was fetched.
  const loadedRange = useMemo(() => {
    const day = 86400000
    return {
      from: dayKey(new Date(Date.now() - 90 * day).toISOString()).slice(0, 7),
      to: dayKey(new Date(Date.now() + 365 * day).toISOString()).slice(0, 7),
    }
  }, [])
  const outsideLoadedRange = monthKey < loadedRange.from || monthKey > loadedRange.to

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
          {settings?.connected && (
            <p className="text-xs text-base-content/45 mt-1">
              {error
                ? 'Could not reach your calendar — the days below may be out of date.'
                : lastSynced
                  ? `Synced ${new Date(lastSynced).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · updates automatically`
                  : 'Syncing…'}
            </p>
          )}
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
        <>
        <div className="mb-6 space-y-3">
          {detailsHidden && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium">Events are syncing, but Google is hiding their names.</p>
              <p className="mt-1 text-base-content/70">
                The calendar is shared with{' '}
                <code className="text-xs break-all">{settings.service_account_email || 'the service account'}</code>{' '}
                as <strong>See only free/busy (hide details)</strong>. In Google Calendar open{' '}
                <strong>Settings → Share with specific people</strong>, find that address, and change its
                permission to <strong>See all event details</strong>. Titles appear on the next sync.
              </p>
            </div>
          )}

          {!error && events.length === 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium">Your calendar was read, but it returned no events.</p>
              <p className="mt-1 text-base-content/70">
                {settings.embed_calendar_id
                  ? <>Reading <code className="text-xs">{settings.embed_calendar_id}</code>. If your events live on a different calendar, point <code className="text-xs">GOOGLE_CALENDAR_ID</code> at that one.</>
                  : <>No calendar ID is set. Point <code className="text-xs">GOOGLE_CALENDAR_ID</code> at the calendar you want to read.</>}
                {settings.service_account_email && (
                  <> It also has to be shared with <code className="text-xs break-all">{settings.service_account_email}</code> using <strong>See all event details</strong>.</>
                )}
              </p>
            </div>
          )}

          <MonthGrid
            monthKey={monthKey}
            onMonthChange={setMonthKey}
            eventsByDay={eventsByDay}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onOpenEvent={setDetailEvent}
          />

          <div className="rounded-xl border border-base-300 bg-base-100 p-3 shadow-sm">
            {outsideLoadedRange && (
              <p className="mb-2 text-xs text-base-content/50">
                This month is outside the range loaded from your calendar, so it may look empty.
              </p>
            )}
            <p className="text-xs font-semibold uppercase tracking-widest text-base-content/45">
              {fmtDayHeading(selectedDay)}
            </p>
            {selectedDayEvents.length === 0 ? (
              <p className="mt-2 text-sm text-base-content/50">
                {error ? 'Your calendar could not be read, so nothing can be shown here.' : 'Nothing scheduled.'}
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                {selectedDayEvents.map(event => (
                  <button
                    key={event.occurrence_id}
                    type="button"
                    onClick={() => setDetailEvent(event)}
                    className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-base-200"
                  >
                    <span className="w-20 shrink-0 text-xs text-base-content/55">{fmtChipTime(event)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
                    {(rulesByEvent.get(event.uid) || []).length > 0 && (
                      <span className="text-xs text-base-content/45">
                        {(rulesByEvent.get(event.uid) || []).map(r => channelMeta(r.channel).icon).join('')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() => setDetailEvent(event)}
                        >
                          <p className="font-medium truncate hover:underline">{event.title}</p>
                          <p className="text-xs text-base-content/60">{fmtEventTime(event)}</p>
                          {event.location && <p className="text-xs text-base-content/45 truncate">{event.location}</p>}
                        </button>
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
        </>
      )}

      <EventDetailModal
        event={detailEvent}
        rules={detailEvent ? (rulesByEvent.get(detailEvent.uid) || []) : []}
        onClose={() => setDetailEvent(null)}
        onAddNotification={event => { setDetailEvent(null); setModalEvent(event) }}
      />

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
