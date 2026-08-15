import { lazy, Suspense, useState, useEffect, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { apiFetch, downloadAttachment, fmtLastLogin, fmtLastNote, fmtBirthday, birthdayAge, daysUntilBirthday, SaveButton, Avatar, useSharedOnlineStatus, useDebounce, prefetchPropertyDetail, getPrefetchedProperty } from './shared'

const CONTACT_TYPE_OPTIONS = [
  { value: 'investor', label: 'Investor' },
  { value: 'colleague', label: 'Colleague' },
  { value: 'family', label: 'Family' },
  { value: 'partner', label: 'Partner' },
]

function getTypeBadgeClass(type) {
  const classes = {
    investor: 'badge-info',
    colleague: 'badge-secondary',
    family: 'badge-warning',
    partner: 'badge-success',
  }
  return classes[String(type || '').toLowerCase()] || 'badge-ghost'
}

function typeLabel(type) {
  const opt = CONTACT_TYPE_OPTIONS.find(o => o.value === String(type || '').toLowerCase())
  return opt ? opt.label : null
}

const LazyPropertyDetailModal = lazy(() => import('./PropertyDetailModal'))

function PhoneLink({ phone }) {
  if (!phone) return <span className="text-base-content/40">—</span>
  const digits = phone.replace(/\D/g, '')
  return (
    <a href={`tel:+${digits}`} className="text-blue-600 underline underline-offset-2 hover:text-blue-800 whitespace-nowrap">
      {phone}
    </a>
  )
}

function EmailLink({ email }) {
  if (!email) return <span className="text-base-content/40">—</span>
  return (
    <a href={`mailto:${email}`} className="text-blue-600 underline underline-offset-2 hover:text-blue-800 truncate">
      {email}
    </a>
  )
}

function ContactAvatar({ contact, size = 'md' }) {
  const initials = [contact.first_name, contact.last_name].filter(Boolean).map(s => s[0]).join('').toUpperCase() || contact.email[0].toUpperCase()
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-11 h-11 text-base'
  return contact.profile_photo
    ? <img src={contact.profile_photo} alt={fullName} className={`${sz} rounded-full object-cover flex-shrink-0`} />
    : <div className={`${sz} rounded-full bg-primary flex items-center justify-center text-primary-content font-bold flex-shrink-0`}>{initials}</div>
}

function BirthdayText({ birthday, className = '' }) {
  const label = fmtBirthday(birthday)
  if (!label) return <span className="text-base-content/40">—</span>
  const age = birthdayAge(birthday)
  const days = daysUntilBirthday(birthday)
  const soon = days !== null && days <= 30
  return (
    <span className={`whitespace-nowrap ${className}`}>
      🎂 {label}{age !== null ? ` (${age})` : ''}
      {soon && (
        <span className="badge badge-xs badge-warning ml-1 align-middle">
          {days === 0 ? 'Today!' : `in ${days}d`}
        </span>
      )}
    </span>
  )
}

function ContactCard({ contact, onViewNotes }) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email
  return (
    <div className="card bg-base-100 border border-base-200 hover:shadow-md transition-shadow h-full">
      <div className="card-body p-4 gap-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <ContactAvatar contact={contact} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base leading-tight">{fullName}</div>
            <EmailLink email={contact.email} />
            {contact.contact_type && (
              <span className={`badge badge-xs mt-1 ${getTypeBadgeClass(contact.contact_type)}`}>{typeLabel(contact.contact_type)}</span>
            )}
          </div>
        </div>
        {/* Details */}
        <div className="space-y-1 text-sm">
          {contact.organization && (
            <div className="text-base-content/70 truncate">{contact.organization}</div>
          )}
          <div><PhoneLink phone={contact.phone_number} /></div>
          {contact.birthday && (
            <div className="text-xs text-base-content/60"><BirthdayText birthday={contact.birthday} /></div>
          )}
          {contact.buy_box && (
            <div className="text-xs text-base-content/60 line-clamp-2">{contact.buy_box}</div>
          )}
        </div>
        {/* Footer */}
        <div className="flex flex-col gap-1 pt-1 border-t border-base-200 mt-auto">
          <div className="flex items-center gap-2">
            <span className="badge badge-ghost badge-sm">{contact.note_count} {contact.note_count === 1 ? 'note' : 'notes'}</span>
            {contact.last_note_at && (
              <span className="text-xs text-base-content/40">last: {fmtLastNote(contact.last_note_at)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactNotesDrawer({ contact, onClose, onRefreshContacts }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const loadNotes = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/contacts/${contact.id}/notes`)
      setNotes(data)
    } catch(e) { setError('Failed to load notes') }
    setLoading(false)
  }

  useEffect(() => { loadNotes() }, [contact.id])

  const handleFileAdd = (e) => {
    const selected = Array.from(e.target.files)
    setFiles(prev => [...prev, ...selected])
    e.target.value = ''
  }

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!noteText.trim() && files.length === 0) { setError('Enter a note or attach a file.'); return }
    setSaving(true); setError('')
    try {
      const attachments = await Promise.all(files.map(f => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ filename: f.name, file_type: f.type, file_data: reader.result.split(',')[1], file_size: f.size })
        reader.onerror = reject
        reader.readAsDataURL(f)
      })))
      await apiFetch(`/api/contacts/${contact.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: noteText.trim() || null, attachments })
      })
      setNoteText(''); setFiles([])
      await loadNotes()
      onRefreshContacts()
    } catch(e) { setError(e.message || 'Failed to save note') }
    setSaving(false)
  }

  const handleDelete = async (noteId) => {
    if (!confirm('Delete this note?')) return
    try {
      await apiFetch(`/api/contacts/${contact.id}/notes/${noteId}`, { method: 'DELETE' })
      await loadNotes()
      onRefreshContacts()
    } catch(e) { setError('Failed to delete note') }
  }

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-base-100 shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-base-200 gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-lg truncate">{fullName}</h3>
            {contact.phone_number && <PhoneLink phone={contact.phone_number} />}
          </div>
          <button className="btn btn-sm btn-ghost btn-circle flex-shrink-0" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <div className="text-center py-8 text-base-content/50">Loading…</div>}
          {!loading && notes.length === 0 && <div className="text-center py-8 text-base-content/40">No notes yet</div>}
          {notes.map(note => (
            <div key={note.id} className="card bg-base-200 shadow-sm">
              <div className="card-body p-3 gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-base-content/50">{new Date(note.created_at).toLocaleString()}</span>
                  <button className="btn btn-xs btn-ghost text-error" onClick={() => handleDelete(note.id)} title="Delete note">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                {note.note_text && <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>}
                {note.attachments && note.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {note.attachments.map(att => (
                      <button key={att.id} className="badge badge-outline gap-1 cursor-pointer hover:badge-primary" onClick={() => downloadAttachment(contact.id, note.id, att.id, att.filename)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span className="text-xs max-w-[120px] truncate">{att.filename}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="p-4 border-t border-base-200 space-y-3">
          {error && <div className="text-error text-sm">{error}</div>}
          <textarea
            className="textarea textarea-bordered w-full text-sm"
            rows={3}
            placeholder="Add a note…"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" className="btn btn-sm btn-ghost border border-base-300" onClick={() => fileInputRef.current?.click()}>
              📎 Attach File
            </button>
            <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.mp3,.mp4,.mov,.png,.jpg,.jpeg" onChange={handleFileAdd} />
            {files.map((f, i) => (
              <span key={i} className="badge badge-outline gap-1">
                <span className="max-w-[100px] truncate text-xs">{f.name}</span>
                <button type="button" className="ml-1 text-error" onClick={() => removeFile(i)}>✕</button>
              </span>
            ))}
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </form>
      </div>
    </div>
  )
}

const BULK_IMPORT_MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function slugifyForEmail(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.')
}

function createSyntheticEmail(firstName, lastName, usedSet, index) {
  const base = slugifyForEmail([firstName, lastName].filter(Boolean).join(' ')) || `contact${index}`
  let candidate = `${base}@contact.local`
  let suffix = 2
  while (usedSet.has(candidate)) {
    candidate = `${base}${suffix}@contact.local`
    suffix += 1
  }
  return candidate
}

function normalizeBulkImportRow(row, seenEmails, index) {
  if (!row || typeof row !== 'object') return null

  const normalizeKey = (key) => String(key ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  const keyMap = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value]))

  const getCell = (...candidates) => {
    for (const candidate of candidates) {
      const normalized = normalizeKey(candidate)
      if (keyMap[normalized] !== undefined && keyMap[normalized] !== null && String(keyMap[normalized]).trim() !== '') {
        return String(keyMap[normalized]).trim()
      }
    }
    return ''
  }

  const firstName = getCell('first name', 'firstname', 'first_name', 'first')
  const lastName = getCell('last name', 'lastname', 'last_name', 'last')
  const email = getCell('email', 'email address', 'emailaddress', 'e mail')
  const phone = getCell('phone', 'phone number', 'phonenumber', 'mobile', 'mobile phone')
  const birthdayRaw = getCell('birthday', 'happy birthday', 'birthdate', 'date of birth', 'dob')

  if (!firstName && !lastName && !email && !phone) return null

  const emailValue = (email || createSyntheticEmail(firstName, lastName, seenEmails, index)).toLowerCase()
  seenEmails.add(emailValue)
  const first = firstName || ''
  const last = lastName || ''
  const phoneValue = phone ? phone.replace(/[^\d+]/g, '').replace(/\+(?=\d)/, '+').replace(/^\+?1(?=\d{10}$)/, '+1') : ''

  let birthdayValue = ''
  if (birthdayRaw) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw)) {
      birthdayValue = birthdayRaw
    }
    if (!birthdayValue) {
      // "April 11th", "Oct 3" — month/day only, use the current year
      const md = birthdayRaw.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?$/i)
      if (md) {
        const month = BULK_IMPORT_MONTHS[md[1].toLowerCase()]
        const day = Number(md[2])
        if (month && day >= 1 && day <= 31) {
          let year = new Date().getFullYear()
          const candidate = new Date(year, month - 1, day)
          if (candidate.getTime() > Date.now()) year -= 1
          birthdayValue = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
      }
    }
    if (!birthdayValue) {
      const asNum = Number(birthdayRaw)
      if (!Number.isNaN(asNum) && asNum > 0) {
        const date = XLSX.SSF.parse_date_code(asNum)
        if (date) {
          birthdayValue = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
        }
      }
    }
    if (!birthdayValue) {
      const parsed = new Date(birthdayRaw)
      if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear()
        if (y >= 1900 && y <= new Date().getFullYear()) {
          birthdayValue = `${y}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
        }
      }
    }
  }

  return {
    first_name: first || null,
    last_name: last || null,
    email: emailValue,
    phone_number: phoneValue || null,
    birthday: birthdayValue || null,
  }
}

function BulkImportButton({ onImported }) {
  const fileInputRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  const handleFile = async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    setImporting(true)
    setStatus({ type: '', message: '' })

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
      const seenEmails = new Set()
      const contacts = rows.map((row, i) => normalizeBulkImportRow(row, seenEmails, i + 1)).filter(Boolean)

      if (!contacts.length) {
        throw new Error('No valid contacts were found in that file. Use columns like First Name, Last Name, Phone Number, Email, Birthday.')
      }

      const response = await apiFetch('/api/contacts/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts })
      })

      const importedCount = response?.imported ?? contacts.length
      setStatus({ type: 'success', message: `Imported ${importedCount} contact${importedCount === 1 ? '' : 's'}.` })
      if (onImported) onImported()
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Bulk import failed.' })
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  return (
    <>
      <button type="button" className="btn btn-sm btn-primary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
        {importing ? 'Importing…' : 'Bulk Import'}
      </button>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
      {status.message && (
        <div className={`text-xs ${status.type === 'error' ? 'text-error' : 'text-success'}`}>
          {status.message}
        </div>
      )}
    </>
  )
}

function BuyBoxEditor({ userId, initialValue }) {
  const [value, setValue] = useState(initialValue || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedSignal, setSavedSignal] = useState(0)

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiFetch(`/api/contacts/${userId}/buybox`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buy_box: value.trim() || null })
      })
      setSavedSignal(s => s + 1)
      setEditing(false)
    } catch { /* silent */ }
    setSaving(false)
  }

  if (!editing) return (
    <div className="group relative">
      <p className="text-sm text-base-content/70 whitespace-pre-wrap min-h-[24px]">
        {value || <span className="text-base-content/30 italic">Not set — click to add</span>}
      </p>
      <button className="btn btn-xs btn-ghost mt-1 opacity-60 group-hover:opacity-100" onClick={() => setEditing(true)}>
        ✏️ Edit
      </button>
    </div>
  )

  return (
    <div className="space-y-2">
      <textarea className="textarea textarea-bordered w-full text-sm leading-relaxed" rows={4}
        placeholder="Describe investment criteria — preferred asset types, geography, deal size, cap rate targets…"
        value={value} onChange={e => setValue(e.target.value)} autoFocus />
      <div className="flex gap-2">
        <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal} label="Save" className="btn-sm" />
        <button className="btn btn-sm btn-ghost" onClick={() => { setValue(initialValue || ''); setEditing(false) }}>Cancel</button>
      </div>
    </div>
  )
}

function BirthdayEditor({ userId, initialValue, onSaved }) {
  const [value, setValue] = useState(initialValue || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedSignal, setSavedSignal] = useState(0)

  useEffect(() => { setValue(initialValue || '') }, [initialValue])

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await apiFetch(`/api/contacts/${userId}/birthday`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday: value || null })
      })
      setSavedSignal(s => s + 1)
      setEditing(false)
      if (onSaved) onSaved(value || null)
    } catch (e) { setError(e.message || 'Failed to save birthday') }
    setSaving(false)
  }

  if (!editing) return (
    <div className="group relative">
      <p className="text-sm text-base-content/70 min-h-[24px]">
        {value ? <BirthdayText birthday={value} /> : <span className="text-base-content/30 italic">Not set — click to add</span>}
      </p>
      <button className="btn btn-xs btn-ghost mt-1 opacity-60 group-hover:opacity-100" onClick={() => setEditing(true)}>
        ✏️ Edit
      </button>
    </div>
  )

  return (
    <div className="space-y-2">
      <input type="date" className="input input-bordered input-sm w-full max-w-[200px]"
        max={new Date().toISOString().slice(0, 10)} min="1900-01-01"
        value={value} onChange={e => setValue(e.target.value)} autoFocus />
      {error && <p className="text-error text-xs">{error}</p>}
      <div className="flex gap-2">
        <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal} label="Save" className="btn-sm" />
        <button className="btn btn-sm btn-ghost" onClick={() => { setValue(initialValue || ''); setError(''); setEditing(false) }}>Cancel</button>
      </div>
    </div>
  )
}

function TypeSelector({ userId, contactType, isAdmin, onChanged }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const value = String(contactType || '').toLowerCase()

  if (!isAdmin) {
    return value
      ? <span className={`badge ${getTypeBadgeClass(value)}`}>{typeLabel(value)}</span>
      : null
  }

  const handleChange = async (e) => {
    const next = e.target.value
    if (next === value) return
    setSaving(true); setError('')
    try {
      await apiFetch(`/api/contacts/${userId}/type`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_type: next || null })
      })
      if (onChanged) onChanged(next || null)
    } catch (err) { setError(err.message || 'Failed to update type') }
    setSaving(false)
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        className={`select select-xs select-bordered font-semibold ${saving ? 'opacity-60' : ''}`}
        value={value}
        onChange={handleChange}
        disabled={saving}
        title="Contact type"
      >
        <option value="">No type</option>
        {CONTACT_TYPE_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="text-error text-xs">{error}</span>}
    </span>
  )
}

function ContactDetailPage({ contactId, onBack, splitMode = false, isAdmin = false }) {
  const [data, setData] = useState(null)
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [notesLoading, setNotesLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const [viewProp, setViewProp] = useState(null)     // full property object for modal
  const [propModalOpen, setPropModalOpen] = useState(false)

  const openPropertyModal = async (propId) => {
    try {
      const prefetched = getPrefetchedProperty(propId)
      if (prefetched) {
        setViewProp(prefetched)
      } else {
        const full = await apiFetch(`/api/properties/${propId}`)
        setViewProp(full)
      }
      setPropModalOpen(true)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    setLoading(true)
    apiFetch(`/api/contacts/${contactId}`)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [contactId])

  const loadNotes = () => {
    setNotesLoading(true)
    apiFetch(`/api/contacts/${contactId}/notes`)
      .then(d => { setNotes(d); setNotesLoading(false) })
      .catch(() => setNotesLoading(false))
  }
  useEffect(loadNotes, [contactId])

  const handleFileAdd = (e) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files)])
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!noteText.trim() && files.length === 0) { setError('Enter a note or attach a file.'); return }
    setSaving(true); setError('')
    try {
      const attachments = await Promise.all(files.map(f => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ filename: f.name, file_type: f.type, file_data: reader.result.split(',')[1], file_size: f.size })
        reader.onerror = reject
        reader.readAsDataURL(f)
      })))
      await apiFetch(`/api/contacts/${contactId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_text: noteText.trim() || null, attachments })
      })
      setNoteText(''); setFiles([])
      loadNotes()
    } catch (e) { setError(e.message || 'Failed to save') }
    setSaving(false)
  }

  const handleDelete = async (noteId) => {
    if (!confirm('Delete this note?')) return
    try {
      await apiFetch(`/api/contacts/${contactId}/notes/${noteId}`, { method: 'DELETE' })
      loadNotes()
    } catch { setError('Failed to delete note') }
  }

  if (loading) return <div className="flex justify-center py-20 text-base-content/40">Loading…</div>
  if (!data) return <div className="text-center py-20 text-error">Contact not found</div>

  const { user, properties } = data
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
  const initials = [user.first_name, user.last_name].filter(Boolean).map(s => s[0]).join('').toUpperCase() || user.email[0].toUpperCase()

  return (
    <div className="space-y-6">
      {/* Back button — hidden in split mode */}
      {!splitMode && (
        <button className="btn btn-ghost btn-sm gap-2" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Back to Contacts
        </button>
      )}

      {/* Profile header */}
      <div className="card bg-base-100 border border-base-200">
        <div className="card-body p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {user.profile_photo
              ? <img src={user.profile_photo} alt={fullName} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover flex-shrink-0 border-2 border-base-300" />
              : <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold text-3xl flex-shrink-0">{initials}</div>
            }
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{fullName}</h2>
                <TypeSelector
                  userId={user.id}
                  contactType={user.contact_type}
                  isAdmin={isAdmin}
                  onChanged={contact_type => setData(prev => prev ? { ...prev, user: { ...prev.user, contact_type } } : prev)}
                />
              </div>
              <EmailLink email={user.email} />
              {user.phone_number && <div className="text-sm"><PhoneLink phone={user.phone_number} /></div>}
              {user.organization && <div className="text-sm text-base-content/60">{user.organization}</div>}
              {user.birthday && <div className="text-sm text-base-content/60"><BirthdayText birthday={user.birthday} /></div>}
            </div>
            <div className="text-xs text-base-content/40 text-right flex-shrink-0 space-y-0.5">
              <div>Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
              <div>Last updated {new Date(user.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <span className={`w-2 h-2 rounded-full ${user.last_login ? 'bg-red-400' : 'bg-base-300'}`} />
                <span>Last login: {fmtLastLogin(user.last_login)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-base-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-1">Buy Box</p>
              <BuyBoxEditor userId={user.id} initialValue={user.buy_box || ''} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-1">Birthday</p>
              <BirthdayEditor
                userId={user.id}
                initialValue={user.birthday || ''}
                onSaved={birthday => setData(prev => prev ? { ...prev, user: { ...prev.user, birthday } } : prev)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Two-column: Properties + Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Properties */}
        <div className="card bg-base-100 border border-base-200">
          <div className="card-body p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-base-content/50 mb-3">
              Assigned Properties <span className="badge badge-ghost badge-sm ml-1">{properties.length}</span>
            </h3>
            {properties.length === 0 && (
              <p className="text-sm text-base-content/40 text-center py-6">No properties assigned</p>
            )}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {properties.map(p => (
                <button
                  key={p.id}
                  onClick={() => openPropertyModal(p.id)}
                  onMouseEnter={() => prefetchPropertyDetail(p.id)}
                  className="w-full text-left flex items-start justify-between gap-3 p-3 rounded-lg bg-base-200/60 hover:bg-base-200 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.address}</div>
                    <div className="text-xs text-base-content/50 mt-0.5">{p.county} · PIN: {p.pin}</div>
                    {p.price && <div className="text-xs text-base-content/60 mt-0.5">${Number(p.price).toLocaleString()}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="badge badge-xs badge-outline">{p.status}</span>
                    <span className="text-[10px] text-base-content/40">
                      Assigned {new Date(p.assigned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-primary/70 font-medium">Click to open →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card bg-base-100 border border-base-200 flex flex-col">
          <div className="card-body p-5 flex flex-col gap-3 min-h-0">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-base-content/50">
              Notes <span className="badge badge-ghost badge-sm ml-1">{notes.length}</span>
            </h3>

            {/* Notes thread */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[280px] pr-1">
              {notesLoading && <div className="text-center py-4 text-base-content/40 text-sm">Loading…</div>}
              {!notesLoading && notes.length === 0 && <div className="text-center py-4 text-base-content/40 text-sm">No notes yet</div>}
              {notes.map(note => (
                <div key={note.id} className="bg-base-200 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-base-content/50">{new Date(note.created_at).toLocaleString()}</span>
                    <button className="btn btn-xs btn-ghost text-error" onClick={() => handleDelete(note.id)}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                  {note.note_text && <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>}
                  {note.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {note.attachments.map(att => (
                       <button key={att.id} className="badge badge-outline gap-1 hover:badge-primary text-xs"
                         onClick={() => downloadAttachment(contactId, note.id, att.id, att.filename)}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                         <span className="max-w-[110px] truncate">{att.filename}</span>
                       </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add note form */}
            <form onSubmit={handleSubmit} className="space-y-2 pt-3 border-t border-base-200">
              {error && <div className="text-error text-xs">{error}</div>}
              <textarea className="textarea textarea-bordered w-full text-sm" rows={3} placeholder="Add a note…"
                value={noteText} onChange={e => setNoteText(e.target.value)} />
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" className="btn btn-sm btn-ghost border border-base-300" onClick={() => fileInputRef.current?.click()}>
                  📎 Attach
                </button>
                <input ref={fileInputRef} type="file" className="hidden" multiple
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.mp3,.mp4,.mov,.png,.jpg,.jpeg" onChange={handleFileAdd} />
                {files.map((f, i) => (
                  <span key={i} className="badge badge-outline gap-1 text-xs">
                    <span className="max-w-[90px] truncate">{f.name}</span>
                    <button type="button" className="text-error" onClick={() => setFiles(p => p.filter((_,j) => j !== i))}>✕</button>
                  </span>
                ))}
              </div>
              <button type="submit" className="btn btn-primary btn-sm w-full" disabled={saving}>
                {saving ? 'Saving…' : 'Save Note'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Property detail modal */}
      <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>}>
        <LazyPropertyDetailModal
          open={propModalOpen}
          property={viewProp}
          isAdmin={isAdmin}
          onClose={() => { setPropModalOpen(false); setViewProp(null) }}
          onSave={() => { setPropModalOpen(false); setViewProp(null) }}
        />
      </Suspense>
    </div>
  )
}

export { ContactDetailPage }

export default function ContactsPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(() => localStorage.getItem('contacts_view') || 'split')
  const [selectedContact, setSelectedContact] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [splitDetailId, setSplitDetailId] = useState(() => {
    const saved = localStorage.getItem('contacts_split_id')
    return saved ? Number(saved) : null
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const onlineStatus = useSharedOnlineStatus()
  const [search, setSearch] = useState('')
  const [listSort, setListSort] = useState({ col: 'last_name', dir: 'asc' })
  const [filterType, setFilterType] = useState('')

  // Persist view selection
  const changeView = (v) => { setView(v); localStorage.setItem('contacts_view', v) }

  // Persist split selection
  const selectSplit = (id) => {
    setSplitDetailId(id)
    if (id != null) localStorage.setItem('contacts_split_id', String(id))
    else localStorage.removeItem('contacts_split_id')
  }

  useEffect(() => {
    setLoading(true)
    apiFetch('/api/contacts').then(data => { setContacts(data); setLoading(false) }).catch(() => setLoading(false))
  }, [refreshKey])

  useEffect(() => {
    const seededQuery = localStorage.getItem('rep_global_contacts_query')
    if (!seededQuery) return
    setSearch(seededQuery)
    localStorage.removeItem('rep_global_contacts_query')
  }, [])

  const openNotes = (c) => setSelectedContact(c)
  const closeNotes = () => setSelectedContact(null)
  const refreshContacts = () => setRefreshKey(k => k + 1)
  const openDetail = (c) => setDetailId(c.id)
  const closeDetail = () => setDetailId(null)

  // Debounce search input
  const debouncedSearch = useDebounce(search, 200)

  const cq = debouncedSearch.trim().toLowerCase()
  const filteredContacts = useMemo(() => 
    cq
      ? contacts.filter(c =>
          [c.first_name, c.last_name, c.email, c.organization, c.phone_number, c.buy_box, c.last_note_text, fmtBirthday(c.birthday)]
            .filter(Boolean).some(v => v.toLowerCase().includes(cq))
        )
      : contacts,
    [contacts, cq]
  )

  const roleFilteredContacts = useMemo(() => {
    if (!filterType) return filteredContacts
    if (filterType === 'none') {
      return filteredContacts.filter(c => !CONTACT_TYPE_OPTIONS.some(o => o.value === String(c.contact_type || '').toLowerCase()))
    }
    return filteredContacts.filter(c => String(c.contact_type || '').toLowerCase() === filterType)
  }, [filteredContacts, filterType])

  function toggleListSort(col) {
    setListSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }
  function ListSortIcon({ col: c }) {
    if (listSort.col !== c) return <span className="ml-1 opacity-25">⇅</span>
    return <span className="ml-1">{listSort.dir === 'asc' ? '↑' : '↓'}</span>
  }

  const sortedListContacts = useMemo(() => {
    const sorted = [...roleFilteredContacts].sort((a, b) => {
      const { col, dir } = listSort
      let av, bv
      if (col === 'name') {
        av = ([a.first_name, a.last_name].filter(Boolean).join(' ') || a.email).toLowerCase()
        bv = ([b.first_name, b.last_name].filter(Boolean).join(' ') || b.email).toLowerCase()
      } else if (col === 'note_count') {
        av = a.note_count || 0; bv = b.note_count || 0
      } else if (col === 'last_note_at') {
        av = a.last_note_at || ''; bv = b.last_note_at || ''
      } else if (col === 'last_login') {
        av = a.last_login || ''; bv = b.last_login || ''
      } else if (col === 'birthday') {
        // Sort by upcoming birthday; contacts without a birthday sort last
        const ad = daysUntilBirthday(a.birthday), bd = daysUntilBirthday(b.birthday)
        av = ad === null ? Infinity : ad; bv = bd === null ? Infinity : bd
      } else {
        av = (a[col] || '').toString().toLowerCase()
        bv = (b[col] || '').toString().toLowerCase()
      }
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [roleFilteredContacts, listSort])

  // If a contact detail is open, render full-page view instead
  if (detailId) {
    return (
      <ContactDetailPage
        contactId={detailId}
        onBack={closeDetail}
        isAdmin
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Contacts</h2>
          <p className="text-xs text-base-content/40 mt-0.5">
            {view === 'split' ? 'Click a contact to view details' : 'Double-click any contact to open full profile'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Search */}
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search name, email, org, notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input input-bordered input-sm pl-8 w-56"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
          {/* Type filter */}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="select select-bordered select-sm">
            <option value="">All Types</option>
            {CONTACT_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
            <option value="none">No Type</option>
          </select>
          <BulkImportButton onImported={refreshContacts} />
          {/* View toggles */}
          <div className="flex gap-1">
            {[
              { id: 'grid',   label: 'Grid' },
              { id: 'list',   label: 'List' },
              { id: 'kanban', label: 'Kanban' },
              { id: 'split',  label: 'Split' },
            ].map(({ id, label }) => (
              <button key={id} className={`btn btn-sm ${view === id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => changeView(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-base-content/50">Loading contacts…</div>}

      {!loading && contacts.length > 0 && roleFilteredContacts.length === 0 && (
        <div className="py-10 text-center text-base-content/30">
          <p>No contacts match{search ? ` "${search}"` : ''}{filterType ? ` with type "${filterType}"` : ''}</p>
          <button className="btn btn-xs btn-ghost mt-2" onClick={() => { setSearch(''); setFilterType('') }}>Clear filters</button>
        </div>
      )}

      {!loading && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleFilteredContacts.map(c => (
            <div key={c.id} onDoubleClick={() => openDetail(c)} className="cursor-pointer select-none">
              <ContactCard contact={c} onViewNotes={openNotes} />
            </div>
          ))}
        </div>
      )}

      {!loading && view === 'list' && (
        <div className="rounded-box border border-base-200 overflow-x-auto">
          <table className="table table-zebra table-sm w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-base-content/50 select-none">
                <th className="w-10">Photo</th>
                {[
                  { label: 'Name', col: 'name' },
                  { label: 'Email', col: 'email', cls: 'hidden md:table-cell' },
                  { label: 'Type', col: 'contact_type', cls: 'w-16' },
                  { label: 'Organization', col: 'organization', cls: 'hidden lg:table-cell' },
                  { label: 'Phone', col: 'phone_number', cls: 'hidden sm:table-cell' },
                  { label: 'Birthday', col: 'birthday', cls: 'hidden xl:table-cell' },
                  { label: 'Buy Box', col: 'buy_box', cls: 'hidden 2xl:table-cell' },
                  { label: 'Notes', col: 'note_count', cls: 'text-center w-12' },
                  { label: 'Last Login', col: 'last_login', cls: 'hidden lg:table-cell w-20' },
                  { label: 'Last Note', col: 'last_note_at', cls: 'hidden xl:table-cell text-center w-16' },
                ].map(({ label, col, cls = '' }) => (
                  <th key={col} className={`cursor-pointer hover:text-base-content whitespace-nowrap ${cls}`} onClick={() => toggleListSort(col)}>
                    {label}<ListSortIcon col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedListContacts.map(c => {
                const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email
                const isOnline = onlineStatus.online.includes(c.id)
                const lastLogin = onlineStatus.lastLogin[c.id] || c.last_login
                return (
                  <tr key={c.id} className="hover cursor-pointer" onDoubleClick={() => openDetail(c)}>
                    <td>
                      <div className="relative inline-block">
                        <ContactAvatar contact={c} size="sm" />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-base-100 ${isOnline ? 'bg-green-500' : 'bg-red-400'}`} />
                      </div>
                    </td>
                    <td className="max-w-[150px]">
                      <div className="font-medium truncate">{fullName}</div>
                      <div className="md:hidden mt-0.5 truncate"><EmailLink email={c.email} /></div>
                    </td>
                    <td className="hidden md:table-cell text-sm max-w-[190px]"><div className="truncate"><EmailLink email={c.email} /></div></td>
                    <td>{c.contact_type ? <span className={`badge badge-sm ${getTypeBadgeClass(c.contact_type)}`}>{typeLabel(c.contact_type)}</span> : <span className="text-base-content/30">—</span>}</td>
                    <td className="hidden lg:table-cell text-sm max-w-[130px]"><div className="truncate">{c.organization || <span className="text-base-content/30">—</span>}</div></td>
                    <td className="hidden sm:table-cell text-sm whitespace-nowrap"><PhoneLink phone={c.phone_number} /></td>
                    <td className="hidden xl:table-cell text-sm whitespace-nowrap"><BirthdayText birthday={c.birthday} /></td>
                    <td className="hidden 2xl:table-cell text-sm max-w-[180px]">
                      <span className="line-clamp-2 text-base-content/60">{c.buy_box || <span className="text-base-content/30">—</span>}</span>
                    </td>
                    <td className="text-center"><span className="badge badge-ghost badge-sm">{c.note_count}</span></td>
                    <td className="hidden lg:table-cell text-xs whitespace-nowrap">
                      <span className={isOnline ? 'text-green-600 font-medium' : 'text-base-content/50'}>
                        {isOnline ? '● Online' : fmtLastLogin(lastLogin)}
                      </span>
                    </td>
                    <td className="hidden xl:table-cell text-center text-xs text-base-content/50 whitespace-nowrap">
                      {fmtLastNote(c.last_note_at) || <span className="text-base-content/25">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && view === 'kanban' && (() => {
        const typeGroups = CONTACT_TYPE_OPTIONS.map(({ value, label }) => ({
          label,
          value,
          items: roleFilteredContacts.filter(c => String(c.contact_type || '').toLowerCase() === value),
          badgeCls: getTypeBadgeClass(value),
        }))
        const otherItems = roleFilteredContacts.filter(c => !CONTACT_TYPE_OPTIONS.some(option => option.value === String(c.contact_type || '').toLowerCase()))
        if (otherItems.length) {
          typeGroups.push({ label: 'No Type', value: 'other', items: otherItems, badgeCls: 'badge-ghost' })
        }
        return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {typeGroups.map(({ label, items, badgeCls }) => (
            <div key={label} className="bg-base-200 rounded-box p-4 flex flex-col gap-3 min-h-[200px]">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm uppercase tracking-widest">{label}</h3>
                <span className={`badge badge-sm ${badgeCls}`}>{items.length}</span>
              </div>
              {items.length === 0 && <div className="text-sm text-base-content/40 text-center py-6">Empty</div>}
              <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-0.5">
                {items.map(c => {
                  const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email
                  const isOnline = onlineStatus.online.includes(c.id)
                  const lastLogin = onlineStatus.lastLogin[c.id] || c.last_login
                  return (
                    <div key={c.id} className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer select-none"
                      onDoubleClick={() => openDetail(c)}>
                      <div className="card-body p-3 gap-2">
                       <div className="flex items-center gap-2">
                         <div className="relative flex-shrink-0">
                           <ContactAvatar contact={c} size="sm" />
                           <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-base-100 ${isOnline ? 'bg-green-500' : 'bg-red-400'}`} />
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="font-medium text-sm truncate">{fullName}</div>
                           <div className="text-xs text-base-content/50 truncate">{c.email}</div>
                         </div>
                       </div>
                       {c.organization && (
                         <div className="text-xs text-base-content/60 truncate">{c.organization}</div>
                       )}
                       {c.phone_number && (
                         <div className="text-xs"><PhoneLink phone={c.phone_number} /></div>
                       )}
                       {c.birthday && (
                         <div className="text-xs text-base-content/60"><BirthdayText birthday={c.birthday} /></div>
                       )}
                       <div className="flex flex-col gap-0.5 pt-1 border-t border-base-200">
                         <span className="badge badge-ghost badge-xs">{c.note_count} {c.note_count === 1 ? 'note' : 'notes'}</span>
                         <span className={`text-[10px] ${isOnline ? 'text-green-600 font-medium' : 'text-base-content/40'}`}>
                           {isOnline ? '● Online' : fmtLastLogin(lastLogin)}
                         </span>
                         {c.last_note_at && (
                           <span className="text-[10px] text-base-content/40">last note: {fmtLastNote(c.last_note_at)}</span>
                         )}
                       </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        )
      })()}

      {!loading && view === 'split' && (
        <div className="flex gap-0 border border-base-200 rounded-box overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}>
          {/* Left: contact list */}
          <div className="w-72 flex-shrink-0 border-r border-base-200 flex flex-col bg-base-100 overflow-hidden">
            <div className="px-3 py-2 border-b border-base-200 bg-base-200/40">
              <span className="text-xs font-semibold uppercase tracking-widest text-base-content/50">
                {roleFilteredContacts.length}{roleFilteredContacts.length !== contacts.length ? `/${contacts.length}` : ''} Contacts
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {roleFilteredContacts.map(c => {
                const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email
                const isActive = splitDetailId === c.id
                const isOnline = onlineStatus.online.includes(c.id)
                const lastLogin = onlineStatus.lastLogin[c.id] || c.last_login
                return (
                  <button
                    key={c.id}
                    onClick={() => selectSplit(c.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-base-200/60 transition-colors
                      ${isActive ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-base-200/60'}`}
                  >
                    <div className="relative flex-shrink-0">
                      <ContactAvatar contact={c} size="sm" />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-base-100 ${isOnline ? 'bg-green-500' : 'bg-red-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isActive ? 'text-primary' : ''}`}>{fullName}</div>
                      <div className="text-xs text-base-content/50 truncate">{c.organization || c.email}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] ${isOnline ? 'text-green-600 font-medium' : 'text-base-content/40'}`}>
                          {isOnline ? '● Online' : fmtLastLogin(lastLogin)}
                        </span>
                        {c.last_note_at && <span className="text-[10px] text-base-content/30">· {fmtLastNote(c.last_note_at)}</span>}
                      </div>
                    </div>
                    {c.contact_type && <span className={`badge badge-xs flex-shrink-0 ${getTypeBadgeClass(c.contact_type)}`}>{typeLabel(c.contact_type)}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: detail panel */}
          <div className="flex-1 overflow-y-auto bg-base-50">
            {splitDetailId ? (
              <div className="p-4 md:p-6">
                <ContactDetailPage
                  key={splitDetailId}
                  contactId={splitDetailId}
                  onBack={() => selectSplit(null)}
                  splitMode
                  isAdmin
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-base-content/30 gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <p className="text-sm">Select a contact to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedContact && (
        <ContactNotesDrawer contact={selectedContact} onClose={closeNotes} onRefreshContacts={refreshContacts} />
      )}
    </div>
  )
}
