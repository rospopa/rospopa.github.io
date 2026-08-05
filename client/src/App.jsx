import { useEffect, useState, Component } from 'react'

/* ─── Error Boundary ──────────────────────────────────────────── */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('React error boundary caught:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="card bg-base-100 shadow-xl max-w-md w-full">
            <div className="card-body items-center text-center gap-4">
              <h2 className="card-title text-error">Something went wrong</h2>
              <p className="text-base-content/60 text-sm">{this.state.error.message}</p>
              <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.reload() }}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export { ErrorBoundary }


/** Wrapper around fetch that always sends credentials and throws on non-ok */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status })
  }
  return res.json()
}

/** A labelled form field with consistent top-margin between label and input */
function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-base-content/60">
        {label}{required && <span className="text-base-content ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

/* ─── Property Card Carousel ──────────────────────────────────── */

function PropertyCardCarousel({ propertyId, onClick }) {
  const [media, setMedia] = useState([])
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/properties/${propertyId}/media`)
      .then(r => r.json())
      .then(d => { setMedia(d.media || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [propertyId])

  if (!loaded) return (
    <div className="w-full h-48 bg-base-200 animate-pulse" />
  )

  if (media.length === 0) return (
    <div className="w-full h-48 bg-base-200 flex items-center justify-center" onClick={onClick}>
      <span className="text-xs text-base-content/30 uppercase tracking-widest">No images</span>
    </div>
  )

  const current = media[idx]
  const isVideo = current.media_type?.startsWith('video')

  function prev(e) {
    e.stopPropagation()
    setIdx(i => (i - 1 + media.length) % media.length)
  }
  function next(e) {
    e.stopPropagation()
    setIdx(i => (i + 1) % media.length)
  }

  return (
    <div className="relative w-full h-48 overflow-hidden bg-black group" onClick={onClick}>
      {isVideo
        ? <video
            key={current.id}
            src={`/api/properties/${propertyId}/media/${current.id}`}
            className="w-full h-full object-cover"
            muted autoPlay={false}
          />
        : <img
            key={current.id}
            src={`/api/properties/${propertyId}/media/${current.id}`}
            alt={current.filename}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
      }

      {media.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-black/50 border-0 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={prev}
          >‹</button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-black/50 border-0 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={next}
          >›</button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {media.map((_, i) => (
              <button
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
                onClick={e => { e.stopPropagation(); setIdx(i) }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Logo ────────────────────────────────────────────────────── */

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-sm flex items-center justify-center">
        <img src="/apple-touch-icon.png" alt="Logo" className="w-9 h-9 object-contain" />
      </div>
      <div className="flex flex-col leading-none gap-0.5">
        <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.01em' }}>
          Real Estate
        </span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.45 }}>
          Portal
        </span>
      </div>
    </div>
  )
}

/* ─── Confirm Modal ───────────────────────────────────────────── */

function Modal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-base-content/70 leading-relaxed">{message}</p>
        <div className="modal-action mt-6">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onCancel}><button>close</button></form>
    </div>
  )
}

/* ─── Add User Form (Admin) ───────────────────────────────────── */

function AddUserForm({ onCreated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [organization, setOrganization] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [buyBox, setBuyBox] = useState('')
  const [photo, setPhoto] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsgType('error'); setMsg('Only image files allowed'); return }
    if (file.size > 5 * 1024 * 1024) { setMsgType('error'); setMsg('Photo must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setPhoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function createUser(e) {
    e.preventDefault()
    if (!photo) { setMsgType('error'); setMsg('Profile photo is required'); return }
    setMsg('')
    setLoading(true)
    try {
      const data = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, first_name: firstName, last_name: lastName, organization, phone_number: phoneNumber, buy_box: buyBox, profile_photo: photo })
      })
      setEmail(''); setPassword(''); setRole('user')
      setFirstName(''); setLastName(''); setOrganization(''); setPhoneNumber(''); setBuyBox(''); setPhoto(null)
      setMsgType('success'); setMsg('User created')
      if (onCreated) onCreated()
    } catch (e) { setMsgType('error'); setMsg(e.message || 'Create failed') }
    finally { setLoading(false); setTimeout(() => setMsg(''), 4000) }
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || 'New User'

  return (
    <form onSubmit={createUser} className="space-y-5">
      {/* Photo upload — required */}
      <Field label="Profile Photo" required>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <Avatar src={photo} name={displayName} size="lg" />
            <label className="absolute -bottom-1 -right-1 btn btn-xs btn-circle btn-primary cursor-pointer" title="Upload photo">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>
          <p className="text-xs text-base-content/50 leading-relaxed">Upload a square or circular photo.<br />JPG, PNG, or WebP · max 5 MB · required</p>
        </div>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Email" required>
          <input type="email" placeholder="email@example.com" value={email}
            onChange={e => setEmail(e.target.value)} className="input input-bordered w-full" required />
        </Field>
        <Field label="Password" required>
          <input type="password" placeholder="Min 8 characters" value={password}
            onChange={e => setPassword(e.target.value)} className="input input-bordered w-full" required />
        </Field>
        <Field label="First Name">
          <input type="text" placeholder="First name" value={firstName}
            onChange={e => setFirstName(e.target.value)} className="input input-bordered w-full" />
        </Field>
        <Field label="Last Name">
          <input type="text" placeholder="Last name" value={lastName}
            onChange={e => setLastName(e.target.value)} className="input input-bordered w-full" />
        </Field>
        <Field label="Organization">
          <input type="text" placeholder="Company or firm" value={organization}
            onChange={e => setOrganization(e.target.value)} className="input input-bordered w-full" />
        </Field>
        <Field label="Phone Number">
          <input type="tel" placeholder="+1 (000) 000-0000" value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)} className="input input-bordered w-full" />
        </Field>
        <Field label="Role">
          <select value={role} onChange={e => setRole(e.target.value)} className="select select-bordered w-full">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
      </div>
      <Field label="Buy Box">
        <textarea placeholder="Describe investment criteria, preferred asset types, geography, deal size…"
          value={buyBox} onChange={e => setBuyBox(e.target.value)}
          className="textarea textarea-bordered w-full leading-relaxed" rows={4} />
      </Field>
      {msg && <div className={`alert ${msgType === 'error' ? 'alert-error' : 'alert-success'} text-sm`}>{msg}</div>}
      <button className="btn btn-primary w-full" type="submit" disabled={loading || !photo}>
        {loading ? 'Creating…' : 'Create User'}
      </button>
    </form>
  )
}

/* ─── Audit Logs ──────────────────────────────────────────────── */

function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  async function fetchLogs() {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/audit-logs?q=${encodeURIComponent(q)}&page=${page}&perPage=${perPage}`)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (e) { console.error('Fetch logs failed:', e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs() }, [page, perPage])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input type="text" placeholder="Search by email or action…" value={q}
          onChange={e => setQ(e.target.value)}
          className="input input-bordered flex-1" />
        <button className="btn btn-primary" onClick={() => { setPage(1); fetchLogs() }}>Search</button>
      </div>

      <div className="overflow-x-auto rounded border border-base-300">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-base-content/50">
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0
              ? <tr><td colSpan={3} className="text-center py-8 text-base-content/40">No logs found</td></tr>
              : logs.map((log, i) => (
                <tr key={i}>
                  <td className="py-3 px-4">{log.email}</td>
                  <td className="py-3 px-4">{log.action}</td>
                  <td className="py-3 px-4 text-sm text-base-content/60">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <div className="flex justify-center items-center gap-3">
        <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>← Prev</button>
        <span className="text-sm text-base-content/60">Page {page} of {totalPages}</span>
        <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>Next →</button>
      </div>
    </div>
  )
}

/* ─── Users Table ─────────────────────────────────────────────── */

/* ─── Avatar ──────────────────────────────────────────────────── */

function Avatar({ src, name, size = 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-10 h-10 text-sm'
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return src
    ? <img src={src} alt={name} className={`${dim} rounded-full object-cover border border-base-300 flex-shrink-0`} />
    : <div className={`${dim} rounded-full bg-base-300 flex items-center justify-center font-semibold text-base-content/60 flex-shrink-0`}>{initials}</div>
}

/* ─── Users Table ─────────────────────────────────────────────── */

function UsersTable({ users, onReload }) {
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/users?q=${encodeURIComponent(query)}&perPage=${perPage}&page=${page}`)
      if (data.users) onReload(data.users)
    } catch (e) { console.error('Fetch failed:', e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [page, perPage])

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input type="text" placeholder="Search by email…" value={query}
          onChange={e => setQuery(e.target.value)} className="input input-bordered flex-1" />
        <button className="btn btn-primary" onClick={() => { setPage(1); fetchUsers() }}>Search</button>
      </div>

      <div className="overflow-x-auto rounded border border-base-300">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-base-content/50">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Organization</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0
              ? <tr><td colSpan={6} className="text-center py-8 text-base-content/40">No users found</td></tr>
              : users.map((u, i) => (
                <tr key={i}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.profile_photo} name={[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email} size="sm" />
                      <div>
                        <p className="font-medium text-sm">{[u.first_name, u.last_name].filter(Boolean).join(' ') || <span className="text-base-content/30">—</span>}</p>
                        <p className="text-xs text-base-content/50">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="badge badge-primary badge-sm">{u.role}</span>
                  </td>
                  <td className="py-3 px-4">{u.organization || <span className="text-base-content/30">—</span>}</td>
                  <td className="py-3 px-4">{u.phone_number || <span className="text-base-content/30">—</span>}</td>
                  <td className="py-3 px-4 text-xs text-base-content/50">{u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                  <td className="py-3 px-4 text-xs text-base-content/50">{u.updated_at ? new Date(u.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/50 uppercase tracking-widest">Rows</span>
          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
            className="select select-bordered select-sm">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>← Prev</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => p + 1)} disabled={loading}>Next →</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Property Detail Modal (edit + media + assign) ──────────── */

function PropertyDetailModal({ open, property, isAdmin, onClose, onSave }) {
  const [tab, setTab] = useState('details')
  const [pin, setPin] = useState('')
  const [address, setAddress] = useState('')
  const [county, setCounty] = useState('')
  const [saving, setSaving] = useState(false)

  // Media state
  const [media, setMedia] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Assignment state
  const [allUsers, setAllUsers] = useState([])
  const [assignLoading, setAssignLoading] = useState(false)

  useEffect(() => {
    if (open && property) {
      setPin(property.pin || '')
      setAddress(property.address || '')
      setCounty(property.county || '')
      setTab('details')
    } else if (open && !property) {
      setPin(''); setAddress(''); setCounty('')
      setTab('details')
    }
  }, [property, open])

  useEffect(() => {
    if (open && property?.id) {
      fetchMedia()
      if (isAdmin) fetchUsers()
    }
  }, [open, property?.id])

  async function fetchMedia() {
    setMediaLoading(true)
    try {
      const data = await apiFetch(`/api/properties/${property.id}/media`)
      setMedia(data.media || [])
    } catch (e) { console.error('Failed to fetch media', e.message) }
    finally { setMediaLoading(false) }
  }

  async function fetchUsers() {
    try {
      const data = await apiFetch(`/api/properties/${property.id}/users`)
      setAllUsers(data.users || [])
    } catch (e) { console.error('Failed to fetch users', e.message) }
  }

  async function handleSave() {
    if (!pin.trim() || !address.trim() || !county.trim()) { alert('All fields are required'); return }
    setSaving(true)
    await onSave({ ...property, pin, address, county })
    setSaving(false)
    if (!property?.id) onClose()
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files)
    setUploadError('')
    for (const file of files) {
      const maxMB = file.type.startsWith('video/') ? 50 : 10
      if (file.size > maxMB * 1024 * 1024) { setUploadError(`${file.name} exceeds ${maxMB}MB limit`); continue }
      const base64Data = await toBase64(file)
      try {
        await apiFetch(`/api/properties/${property.id}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mediaType: file.type, base64Data })
        })
      } catch (e) { setUploadError(e.message || 'Upload failed') }
    }
    e.target.value = ''
    fetchMedia()
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function deleteMedia(mediaId) {
    await apiFetch(`/api/properties/${property.id}/media/${mediaId}`, { method: 'DELETE' })
    fetchMedia()
  }

  async function toggleAssign(userId, currentlyAssigned) {
    setAssignLoading(true)
    try {
      if (currentlyAssigned) {
        await apiFetch(`/api/properties/${property.id}/assign/${userId}`, { method: 'DELETE' })
      } else {
        await apiFetch(`/api/properties/${property.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: [userId] })
        })
      }
      await fetchUsers()
    } catch { console.error('Assign failed') }
    finally { setAssignLoading(false) }
  }

  if (!open) return null

  const tabs = property?.id
    ? ['details', 'media', ...(isAdmin ? ['assign'] : [])]
    : ['details']

  const tabLabel = { details: 'Details', media: 'Media', assign: 'Assign Users' }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            {property?.id ? property.address : 'New Property'}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="tabs tabs-bordered mb-6">
            {tabs.map(t => (
              <button key={t} className={`tab ${tab === t ? 'tab-active font-semibold' : ''}`} onClick={() => setTab(t)}>
                {tabLabel[t]}
              </button>
            ))}
          </div>
        )}

        {/* Details tab */}
        {tab === 'details' && (
          <div className="space-y-5">
            <Field label="PIN(s)" required>
              <input type="text" placeholder="e.g. 12-34-567-890" value={pin}
                onChange={e => setPin(e.target.value)} className="input input-bordered w-full"
                disabled={!isAdmin} />
            </Field>
            <Field label="Address" required>
              <input type="text" placeholder="123 Main St, Chicago, IL" value={address}
                onChange={e => setAddress(e.target.value)} className="input input-bordered w-full"
                disabled={!isAdmin} />
            </Field>
            <Field label="County" required>
              <input type="text" placeholder="e.g. Cook" value={county}
                onChange={e => setCounty(e.target.value)} className="input input-bordered w-full"
                disabled={!isAdmin} />
            </Field>
            {isAdmin && (
              <div className="pt-2">
                <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : (property?.id ? 'Save Changes' : 'Create Property')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Media tab */}
        {tab === 'media' && (
          <div className="space-y-5">
            {isAdmin && (
              <div className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center">
                <p className="text-sm text-base-content/50 mb-3">Upload images (JPG, PNG, GIF — max 10MB) or videos (MP4, MOV — max 50MB)</p>
                <label className="btn btn-primary btn-sm cursor-pointer">
                  Choose Files
                  <input type="file" className="hidden" multiple accept="image/*,video/*" onChange={handleFileUpload} />
                </label>
                {uploadError && <p className="text-error text-sm mt-2">{uploadError}</p>}
              </div>
            )}
            {mediaLoading
              ? <p className="text-center text-base-content/40 py-6">Loading…</p>
              : media.length === 0
                ? <p className="text-center text-base-content/30 py-8">No media uploaded yet</p>
                : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {media.map(m => (
                      <div key={m.id} className="relative group rounded border border-base-300 overflow-hidden bg-base-200">
                        {m.media_type?.startsWith('video/')
                          ? <video src={`/api/properties/${property.id}/media/${m.id}`} className="w-full h-28 object-cover" controls />
                          : <img src={`/api/properties/${property.id}/media/${m.id}`} alt={m.filename} className="w-full h-28 object-cover" />
                        }
                        <div className="px-2 py-1 flex items-center justify-between">
                          <span className="text-xs text-base-content/50 truncate">{m.filename}</span>
                          {isAdmin && (
                            <button className="btn btn-xs btn-ghost text-error" onClick={() => deleteMedia(m.id)}>✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
            }
          </div>
        )}

        {/* Assign Users tab (admin only) */}
        {tab === 'assign' && isAdmin && (
          <div className="space-y-3">
            <p className="text-sm text-base-content/50 mb-4">Toggle to assign or unassign users. Assigned users can view this property.</p>
            {allUsers.length === 0
              ? <p className="text-center text-base-content/30 py-8">No users found</p>
              : (
                <div className="divide-y divide-base-200">
                  {allUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between py-3">
                      <span className="text-sm">{u.email}</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={!!u.assigned}
                        disabled={assignLoading}
                        onChange={() => toggleAssign(u.id, !!u.assigned)}
                      />
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>
    </div>
  )
}

/* ─── Properties Page ─────────────────────────────────────────── */

function PropertiesPage({ user }) {
  const [properties, setProperties] = useState([])
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [loading, setLoading] = useState(false)

  async function fetchProperties() {
    setLoading(true)
    try {
      const endpoint = user.role === 'admin' ? '/api/properties?allProps=true' : '/api/me/properties'
      const data = await apiFetch(endpoint)
      setProperties(data.properties || [])
    } catch (e) { console.error('Failed to fetch properties:', e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProperties() }, [user.role])

  async function saveProperty(prop) {
    try {
      const method = prop.id ? 'PUT' : 'POST'
      const endpoint = prop.id ? `/api/properties/${prop.id}` : '/api/properties'
      await apiFetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prop) })
      await fetchProperties()
    } catch (e) { console.error('Failed to save property:', e.message) }
  }

  async function deleteProperty(id) {
    if (!confirm('Delete this property?')) return
    try {
      await apiFetch(`/api/properties/${id}`, { method: 'DELETE' })
      await fetchProperties()
    } catch (e) { console.error('Delete failed:', e.message) }
  }

  function openProperty(prop) {
    setSelectedProperty(prop)
    setShowPropertyModal(true)
  }

  return (
    <div className="space-y-8">
      {user.role === 'admin' && (
        <button className="btn btn-primary" onClick={() => { setSelectedProperty(null); setShowPropertyModal(true) }}>
          + New Property
        </button>
      )}

      <PropertyDetailModal
        open={showPropertyModal}
        property={selectedProperty}
        isAdmin={user.role === 'admin'}
        onClose={() => setShowPropertyModal(false)}
        onSave={async (p) => { await saveProperty(p) }}
      />

      {loading && <p className="text-base-content/40 text-sm">Loading…</p>}

      {!loading && properties.length === 0 && (
        <div className="py-16 text-center text-base-content/30">
          <p className="text-lg">No properties yet</p>
          {user.role === 'admin' && <p className="text-sm mt-1">Click &quot;+ New Property&quot; to add one</p>}
          {user.role !== 'admin' && <p className="text-sm mt-1">Properties assigned to you will appear here</p>}
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((prop, i) => (
          <div key={i}
            className="card bg-base-100 border border-base-300 hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
            <PropertyCardCarousel propertyId={prop.id} onClick={() => openProperty(prop)} />
            <div className="card-body gap-3 p-6" onClick={() => openProperty(prop)}>
              <h2 className="text-base font-semibold leading-snug">{prop.address}</h2>
              <div className="space-y-1">
                <p className="text-sm text-base-content/60">{prop.county} County</p>
                <p className="text-xs text-base-content/40 font-mono">PIN: {prop.pin}</p>
                {prop.updated_at && (
                  <p className="text-xs text-base-content/30">Updated {new Date(prop.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                )}
              </div>
              {user.role === 'admin' && (
                <div className="card-actions pt-2 border-t border-base-200 mt-1">
                  <button className="btn btn-xs btn-ghost" onClick={e => { e.stopPropagation(); openProperty(prop) }}>Edit</button>
                  <button className="btn btn-xs btn-ghost text-error" onClick={e => { e.stopPropagation(); deleteProperty(prop.id) }}>Delete</button>
                </div>
              )}
              {user.role !== 'admin' && (
                <div className="pt-2 border-t border-base-200 mt-1">
                  <span className="text-xs text-base-content/40">Click to view details &amp; media</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Profile Page ────────────────────────────────────────────── */

function ProfilePage({ currentUser, onUpdate }) {
  const [firstName, setFirstName] = useState(currentUser.first_name || '')
  const [lastName, setLastName] = useState(currentUser.last_name || '')
  const [organization, setOrganization] = useState(currentUser.organization || '')
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phone_number || '')
  const [buyBox, setBuyBox] = useState(currentUser.buy_box || '')
  const [photo, setPhoto] = useState(currentUser.profile_photo || null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsgType('error'); setMsg('Only image files allowed'); return }
    if (file.size > 5 * 1024 * 1024) { setMsgType('error'); setMsg('Photo must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setPhoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function saveProfile(e) {
    e.preventDefault()
    if (!photo) { setMsgType('error'); setMsg('Profile photo is required'); return }
    setLoading(true); setMsg('')
    try {
      const data = await apiFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, organization, phone_number: phoneNumber, buy_box: buyBox, profile_photo: photo })
      })
      setMsgType('success'); setMsg('Profile saved successfully')
      onUpdate({ ...currentUser, first_name: firstName, last_name: lastName, organization, phone_number: phoneNumber, buy_box: buyBox, profile_photo: photo })
    } catch (e) { setMsgType('error'); setMsg(e.message || 'Save failed') }
    finally { setLoading(false); setTimeout(() => setMsg(''), 4000) }
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || currentUser.email

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-8" style={{ fontFamily: "'Playfair Display', serif" }}>My Profile</h2>
      <div className="card bg-base-100 border border-base-300">
        <form className="card-body p-8 space-y-6" onSubmit={saveProfile}>

          {/* Photo upload */}
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <Avatar src={photo} name={displayName} size="lg" />
              <label className="absolute -bottom-1 -right-1 btn btn-xs btn-circle btn-primary cursor-pointer" title="Upload photo">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            <div>
              <p className="font-semibold">{displayName}</p>
              <p className="text-sm text-base-content/50">{currentUser.email}</p>
              <p className="text-xs mt-1">
                {photo
                  ? <span className="text-success font-medium">✓ Photo uploaded</span>
                  : <span className="text-error font-medium">⚠ Profile photo required</span>
                }
              </p>
              <p className="text-xs text-base-content/40 mt-0.5">Square or circular · JPG, PNG, WebP · max 5 MB</p>
            </div>
          </div>

          <div className="divider my-0" />

          <Field label="Email">
            <input type="text" value={currentUser.email} disabled className="input input-bordered w-full bg-base-200 opacity-60" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="First Name">
              <input type="text" placeholder="First name" value={firstName}
                onChange={e => setFirstName(e.target.value)} className="input input-bordered w-full" />
            </Field>
            <Field label="Last Name">
              <input type="text" placeholder="Last name" value={lastName}
                onChange={e => setLastName(e.target.value)} className="input input-bordered w-full" />
            </Field>
            <Field label="Organization">
              <input type="text" placeholder="Company or firm" value={organization}
                onChange={e => setOrganization(e.target.value)} className="input input-bordered w-full" />
            </Field>
            <Field label="Phone Number">
              <input type="tel" placeholder="+1 (000) 000-0000" value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)} className="input input-bordered w-full" />
            </Field>
          </div>
          <Field label="Buy Box">
            <textarea
              placeholder="Describe your investment criteria — preferred asset types, geography, deal size, cap rate targets…"
              value={buyBox}
              onChange={e => setBuyBox(e.target.value)}
              className="textarea textarea-bordered w-full leading-relaxed"
              rows={5}
            />
          </Field>
          {msg && (
            <div className={`alert text-sm ${msgType === 'error' ? 'alert-error' : 'alert-success'}`}>{msg}</div>
          )}
          <div className="pt-2">
            <button className="btn btn-primary w-full" type="submit" disabled={loading || !photo}>
              {loading ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Root App ────────────────────────────────────────────────── */

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [page, setPage] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null })
  const [authChecked, setAuthChecked] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function navigateTo(p) { setPage(p); localStorage.setItem('rep_page', p) }

  // Restore session on page load/refresh
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setCurrentUser(data.user)
          const saved = localStorage.getItem('rep_page')
          const validPages = ['dashboard', 'properties', 'profile', 'users', 'audit']
          setPage(saved && validPages.includes(saved) ? saved : 'dashboard')
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true))
  }, [])

  async function login(e) {
    e.preventDefault(); setMsg(''); setLoading(true)
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'Login failed'); return }
      setCurrentUser(data.user); setPage('dashboard'); setEmail(''); setPassword('')
    } catch { setMsg('Network error') }
    finally { setLoading(false) }
  }

  async function register(e) {
    e.preventDefault(); setMsg(''); setLoading(true)
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'Register failed'); return }
      setCurrentUser(data.user); setPage('dashboard'); setEmail(''); setPassword('')
    } catch { setMsg('Network error') }
    finally { setLoading(false) }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    localStorage.removeItem('rep_page')
    setCurrentUser(null); setPage('login'); setEmail(''); setPassword('')
  }

  /* ── Auth check in flight ── */
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  /* ── Login / Register screen ── */
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundImage: "url('/assets/background-login.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full flex items-center justify-center px-4">
          <div className="card w-full max-w-md bg-base-100 shadow-2xl">
            <div className="card-body p-10 space-y-6">
              <div className="flex justify-center mb-2">
                <Logo />
              </div>
              <form onSubmit={isRegister ? register : login} className="space-y-5">
                <Field label="Email" required>
                  <input type="email" placeholder="your@email.com" value={email}
                    onChange={e => setEmail(e.target.value)} className="input input-bordered w-full" required />
                </Field>
                <Field label="Password" required>
                  <input type="password" placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)} className="input input-bordered w-full" required />
                </Field>
                {msg && <div className="alert alert-error text-sm">{msg}</div>}
                <button className="btn btn-primary w-full" disabled={loading}>
                  {loading ? 'Processing…' : (isRegister ? 'Create Account' : 'Sign In')}
                </button>
              </form>
              <div className="divider text-xs text-base-content/30 my-0">or</div>
              <button className="btn btn-ghost btn-sm w-full text-base-content/60" onClick={() => { setIsRegister(!isRegister); setMsg('') }}>
                {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Authenticated shell ── */
  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'properties', label: 'Properties' },
    ...(currentUser.role === 'admin' ? [{ id: 'users', label: 'Users' }, { id: 'audit', label: 'Audit Logs' }] : []),
  ]

  const navBtn = (id, label) => (
    <button
      key={id}
      className={`btn btn-sm ${page === id ? 'btn-primary' : 'btn-ghost'}`}
      onClick={() => { navigateTo(id); setMobileMenuOpen(false) }}
    >
      {label}
    </button>
  )

  const displayName = [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.email

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <nav className="navbar bg-base-100 border-b border-base-300 sticky top-0 z-50 px-4 md:px-6 gap-2">
        {/* Logo */}
        <div className="flex-none">
          <Logo />
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex flex-1 gap-1 ml-4">
          {navLinks.map(({ id, label }) => navBtn(id, label))}
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex flex-none items-center gap-3">
          <button
            className={`btn btn-sm ${page === 'profile' ? 'btn-primary' : 'btn-ghost'} flex items-center gap-2 max-w-[220px]`}
            onClick={() => navigateTo('profile')}
          >
            <Avatar src={currentUser.profile_photo} name={displayName} size="sm" />
            <span className="truncate">{currentUser.email}</span>
          </button>
          <button className="btn btn-sm btn-outline" onClick={logout}>Sign Out</button>
        </div>

        {/* Mobile: avatar + hamburger */}
        <div className="flex md:hidden flex-1 justify-end items-center gap-2">
          <button
            className={`btn btn-sm btn-ghost p-1 ${page === 'profile' ? 'btn-primary' : ''}`}
            onClick={() => { navigateTo('profile'); setMobileMenuOpen(false) }}
          >
            <Avatar src={currentUser.profile_photo} name={displayName} size="sm" />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Menu"
          >
            {mobileMenuOpen
              ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            }
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-base-100 border-b border-base-300 px-4 py-3 flex flex-col gap-1 sticky top-[64px] z-40 shadow-md">
          {navLinks.map(({ id, label }) => navBtn(id, label))}
          <div className="divider my-1" />
          <button className="btn btn-sm btn-outline w-full" onClick={() => { logout(); setMobileMenuOpen(false) }}>Sign Out</button>
        </div>
      )}

      {/* Main content */}
      <main className="container mx-auto px-6 py-10 max-w-6xl">
        <ErrorBoundary key={page}>

        {page === 'dashboard' && (
          <div className="text-center py-16">
            <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
              Welcome back
            </h1>
            <p className="text-base-content/50 text-lg mb-2">{currentUser.email}</p>
            <span className="badge badge-primary mb-8">{currentUser.role}</span>
            <div className="flex justify-center gap-4 mt-6">
              <button className="btn btn-primary" onClick={() => navigateTo('properties')}>View Properties</button>
              {currentUser.role === 'admin' && <button className="btn btn-outline" onClick={() => navigateTo('users')}>Manage Users</button>}
            </div>
          </div>
        )}

        {page === 'users' && currentUser.role === 'admin' && (
          <div className="space-y-10">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Manage Users</h2>
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body p-8">
                <h3 className="text-base font-semibold uppercase tracking-widest text-base-content/50 mb-6">Create New User</h3>
                <AddUserForm onCreated={() => { }} />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold uppercase tracking-widest text-base-content/50 mb-4">All Users</h3>
              <UsersTable users={users} onReload={setUsers} />
            </div>
          </div>
        )}

        {page === 'properties' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {currentUser.role === 'admin' ? 'Manage Properties' : 'My Properties'}
            </h2>
            <PropertiesPage user={currentUser} />
          </div>
        )}

        {page === 'audit' && currentUser.role === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Audit Logs</h2>
            <AuditLogs />
          </div>
        )}

        {page === 'profile' && (
          <ProfilePage currentUser={currentUser} onUpdate={u => setCurrentUser(u)} />
        )}

        </ErrorBoundary>
      </main>

      <Modal {...modal} />
    </div>
  )
}
