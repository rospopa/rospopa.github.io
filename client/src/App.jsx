import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Field, NumericInput, SaveButton, Avatar, Modal, PropertyCardCarousel, apiFetch, formatPhone, PhotoCropper, Logo, RecaptchaShield, getRecaptchaToken, ForgotPasswordModal, ErrorBoundary, fmtLastLogin, useSharedOnlineStatus, useDebounce } from './shared'

const PropertyDetailModal = lazy(() => import('./PropertyDetailModal'))
const ContactsPage = lazy(() => import('./ContactsPage'))
const AuditLogs = lazy(() => import('./AuditLogs'))

export { ErrorBoundary } from './shared'

function UsersTable({ users, onReload, onEdit }) {
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const onlineStatus = useSharedOnlineStatus()
  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    const seededQuery = localStorage.getItem('rep_global_users_query')
    if (!seededQuery) return
    setQuery(seededQuery)
    setPage(1)
    localStorage.removeItem('rep_global_users_query')
  }, [])

  async function fetchUsers() {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/users?q=${encodeURIComponent(debouncedQuery)}&perPage=${perPage}&page=${page}`)
      if (data.users) onReload(data.users)
    } catch (e) { console.error('Fetch failed:', e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [page, perPage, debouncedQuery])

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
              <th className="py-3 px-4">Last Login</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0
              ? <tr><td colSpan={7} className="text-center py-8 text-base-content/40">No users found</td></tr>
              : users.map((u, i) => {
                const isOnline = onlineStatus.online.includes(u.id)
                const lastLogin = onlineStatus.lastLogin[u.id] || u.last_login
                return (
                  <tr key={i}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <Avatar src={u.profile_photo} name={[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email} size="sm" />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-base-100 ${isOnline ? 'bg-green-500' : 'bg-red-400'}`} title={isOnline ? 'Online' : 'Offline'} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{[u.first_name, u.last_name].filter(Boolean).join(' ') || <span className="text-base-content/30">—</span>}</p>
                          <p className="text-xs text-base-content/50">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className="badge badge-primary badge-sm">{u.role}</span></td>
                    <td className="py-3 px-4">{u.organization || <span className="text-base-content/30">—</span>}</td>
                    <td className="py-3 px-4">{u.phone_number || <span className="text-base-content/30">—</span>}</td>
                    <td className="py-3 px-4 text-xs">
                      <span className={isOnline ? 'text-green-600 font-medium' : 'text-base-content/50'}>
                        {isOnline ? '● Online' : fmtLastLogin(lastLogin)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-base-content/50">{u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    <td className="py-3 px-4 text-right"><button className="btn btn-xs btn-ghost" onClick={() => onEdit?.(u)}>Edit</button></td>
                  </tr>
                )
              })
            }
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/50 uppercase tracking-widest">Rows</span>
          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }} className="select select-bordered select-sm">
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
  const [showCropper, setShowCropper] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsgType('error'); setMsg('Only image files allowed'); return }
    if (file.size > 5 * 1024 * 1024) { setMsgType('error'); setMsg('Photo must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => { setCropSrc(ev.target.result); setShowCropper(true) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function onCropSave(dataUrl) {
    setPhoto(dataUrl)
    setShowCropper(false)
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
    <form onSubmit={createUser} className="space-y-5" noValidate>
      {showCropper && cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onSave={onCropSave}
          onClose={() => setShowCropper(false)}
        />
      )}
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
            onChange={e => setPhoneNumber(formatPhone(e.target.value))} className="input input-bordered w-full" />
        </Field>
        <Field label="Role">
          <select value={role} onChange={e => setRole(e.target.value)} className="select select-bordered w-full">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
      </div>
      {msg && <div className={`alert ${msgType === 'error' ? 'alert-error' : 'alert-success'} text-sm`}>{msg}</div>}
      <button className="btn btn-primary w-full" type="submit" disabled={loading || !photo}>
        {loading ? 'Creating…' : 'Create User'}
      </button>
    </form>
  )
}

/* ─── Audit Logs ──────────────────────────────────────────────── */

function EditUserModal({ open, user, onClose, onSave }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [organization, setOrganization] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [role, setRole] = useState('user')
  const [buyBox, setBuyBox] = useState('')
  const [photo, setPhoto] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [savedSignal, setSavedSignal] = useState(0)

  useEffect(() => {
    if (open && user) {
      setFirstName(user.first_name || '')
      setLastName(user.last_name || '')
      setOrganization(user.organization || '')
      setPhoneNumber(user.phone_number || '')
      setRole(user.role || 'user')
      setBuyBox(user.buy_box || '')
      setPhoto(user.profile_photo || null)
      setErr('')
    }
  }, [open, user])

  function handlePhotoChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setCropSrc(ev.target.result); setShowCropper(true) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName || null,
          last_name: lastName || null,
          organization: organization || null,
          phone_number: phoneNumber || null,
          role,
          buy_box: buyBox || null,
          profile_photo: photo || null
        })
      })
      setSavedSignal(s => s + 1)
      setTimeout(() => { onSave(); onClose() }, 1200)
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !user) return null
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || user.email

  return (
    <div className="modal modal-open">
      <div className="modal-box w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {showCropper && cropSrc && (
          <PhotoCropper
            src={cropSrc}
            onSave={dataUrl => { setPhoto(dataUrl); setShowCropper(false) }}
            onClose={() => setShowCropper(false)}
          />
        )}

        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">Edit User</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-4">
          {/* Email (read-only identifier) */}
          <div className="text-sm text-base-content/50 pb-1 border-b border-base-300">
            <p className="font-medium text-base-content">{user.email}</p>
            <p className="text-xs">ID: {user.id}</p>
          </div>

          {/* Profile photo */}
          <div className="flex items-center gap-4">
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
              <p className="font-medium text-sm">{displayName}</p>
              {photo
                ? <p className="text-xs text-success mt-0.5">✓ Photo set</p>
                : <p className="text-xs text-base-content/40 mt-0.5">No photo uploaded</p>}
              {photo && (
                <button className="btn btn-xs btn-ghost text-error mt-1" onClick={() => setPhoto(null)}>Remove photo</button>
              )}
            </div>
          </div>

          <div className="divider my-1" />

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name">
              <input type="text" placeholder="First name" value={firstName}
                onChange={e => setFirstName(e.target.value)} className="input input-bordered w-full" />
            </Field>
            <Field label="Last Name">
              <input type="text" placeholder="Last name" value={lastName}
                onChange={e => setLastName(e.target.value)} className="input input-bordered w-full" />
            </Field>
          </div>

          <Field label="Organization">
            <input type="text" placeholder="Company or firm" value={organization}
              onChange={e => setOrganization(e.target.value)} className="input input-bordered w-full" />
          </Field>

          <Field label="Phone Number">
            <input type="text" placeholder="+1 (000) 000-0000" value={phoneNumber}
              onChange={e => setPhoneNumber(formatPhone(e.target.value))} className="input input-bordered w-full" />
          </Field>

          <Field label="Role">
            <select value={role} onChange={e => setRole(e.target.value)} className="select select-bordered w-full">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </Field>

          {err && <div className="alert alert-error text-sm">{err}</div>}

          <div className="flex gap-2 pt-2">
            <button className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal} className="flex-1" />
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>
    </div>
  )
}

function ProfilePage({ currentUser, onUpdate }) {
  const [firstName, setFirstName] = useState(currentUser.first_name || '')
  const [lastName, setLastName] = useState(currentUser.last_name || '')
  const [organization, setOrganization] = useState(currentUser.organization || '')
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phone_number || '')
  const [buyBox, setBuyBox] = useState(currentUser.buy_box || '')
  const [photo, setPhoto] = useState(currentUser.profile_photo || null)
  const [showCropper, setShowCropper] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedSignal, setSavedSignal] = useState(0)
  const [err, setErr] = useState('')

  useEffect(() => {
    setFirstName(currentUser.first_name || '')
    setLastName(currentUser.last_name || '')
    setOrganization(currentUser.organization || '')
    setPhoneNumber(currentUser.phone_number || '')
    setBuyBox(currentUser.buy_box || '')
    setPhoto(currentUser.profile_photo || null)
    setErr('')
  }, [currentUser])

  function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Only image files allowed'); return }
    if (file.size > 5 * 1024 * 1024) { setErr('Photo must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => { setCropSrc(ev.target.result); setShowCropper(true) }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleSave() {
    setSaving(true)
    setErr('')
    try {
      const updatedUser = await apiFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName || null,
          last_name: lastName || null,
          organization: organization || null,
          phone_number: phoneNumber || null,
          buy_box: buyBox || null,
          profile_photo: photo || null
        })
      })
      onUpdate(updatedUser.user || updatedUser)
      setSavedSignal(s => s + 1)
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || currentUser.email

  return (
    <div className="space-y-6">
      {showCropper && cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onSave={dataUrl => { setPhoto(dataUrl); setShowCropper(false) }}
          onClose={() => setShowCropper(false)}
        />
      )}

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-5 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <Avatar src={photo} name={displayName} size="lg" />
                <label className="absolute -bottom-1 -right-1 btn btn-xs btn-circle btn-primary cursor-pointer" title="Upload photo">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold truncate">{displayName}</h2>
                  <span className={`badge ${currentUser.role === 'admin' ? 'badge-error' : 'badge-primary'}`}>{currentUser.role}</span>
                </div>
                <p className="text-sm text-base-content/60 break-all">{currentUser.email}</p>
                {phoneNumber && <p className="text-sm text-base-content/60">{phoneNumber}</p>}
                {organization && <p className="text-sm text-base-content/60">{organization}</p>}
                {buyBox && <p className="text-sm text-base-content/60 line-clamp-2">{buyBox}</p>}
              </div>
            </div>
            <div className="text-xs text-base-content/40 space-y-1 lg:text-right">
              {currentUser.created_at && <div>Member since {new Date(currentUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>}
              {currentUser.updated_at && <div>Last updated {new Date(currentUser.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
            </div>
          </div>

          <div className="divider my-0" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="First Name">
              <input type="text" placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} className="input input-bordered w-full" />
            </Field>
            <Field label="Last Name">
              <input type="text" placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} className="input input-bordered w-full" />
            </Field>
            <Field label="Organization">
              <input type="text" placeholder="Company or firm" value={organization} onChange={e => setOrganization(e.target.value)} className="input input-bordered w-full" />
            </Field>
            <Field label="Phone Number">
              <input type="tel" placeholder="+1 (000) 000-0000" value={phoneNumber} onChange={e => setPhoneNumber(formatPhone(e.target.value))} className="input input-bordered w-full" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Buy Box">
                <textarea
                  value={buyBox}
                  onChange={e => setBuyBox(e.target.value)}
                  className="textarea textarea-bordered w-full min-h-[120px]"
                  placeholder="Describe target criteria, markets, asset types, budget, or notes"
                />
              </Field>
            </div>
          </div>

          {photo && (
            <div className="flex justify-start">
              <button className="btn btn-xs btn-ghost text-error" onClick={() => setPhoto(null)}>Remove photo</button>
            </div>
          )}

          {err && <div className="alert alert-error text-sm">{err}</div>}

          <div className="flex justify-end">
            <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Properties Page ─────────────────────────────────────────── */

function PropertiesPage({ user }) {
  const [properties, setProperties] = useState([])
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [propertyModalTopOffset, setPropertyModalTopOffset] = useState(64)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list' | 'kanban'
  const [search, setSearch] = useState('')
  const [listSort, setListSort] = useState({ col: 'updated_at', dir: 'desc' })
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAssetType, setFilterAssetType] = useState('')
  const isAdmin = user.role === 'admin'

  useEffect(() => {
    function measureTopOffset() {
      const nav = document.querySelector('nav.navbar')
      const mobileMenu = document.querySelector('[data-mobile-nav-menu="true"]')
      const navHeight = nav ? nav.getBoundingClientRect().height : 0
      const mobileMenuHeight = mobileMenu && window.getComputedStyle(mobileMenu).display !== 'none'
        ? mobileMenu.getBoundingClientRect().height
        : 0
      setPropertyModalTopOffset(Math.ceil(navHeight + mobileMenuHeight))
    }
    measureTopOffset()
    window.addEventListener('resize', measureTopOffset)
    return () => window.removeEventListener('resize', measureTopOffset)
  }, [])

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

  useEffect(() => {
    if (!properties.length) return
    const seededId = Number(localStorage.getItem('rep_global_property_id'))
    if (!Number.isFinite(seededId) || seededId <= 0) return
    const matchedProperty = properties.find(prop => prop.id === seededId)
    if (!matchedProperty) return
    openProperty(matchedProperty)
    localStorage.removeItem('rep_global_property_id')
  }, [properties])

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

  const effectiveView = isAdmin ? viewMode : 'grid'
  const fmt = (n) => n != null ? `$${Number(n).toLocaleString()}` : null

  const q = search.trim().toLowerCase()
  const allAssetTypes = useMemo(() => [...new Set(properties.map(p => p.asset_type).filter(Boolean))].sort(), [properties])

  const filteredProperties = useMemo(() => {
    let list = q
      ? properties.filter(p =>
          (p.address || '').toLowerCase().includes(q) ||
          (p.pin || '').toLowerCase().includes(q) ||
          (p.county || '').toLowerCase().includes(q) ||
          (p.status || '').toLowerCase().includes(q) ||
          (p.asset_type || '').toLowerCase().includes(q)
        )
      : properties
    if (filterStatus) list = list.filter(p => (p.status || 'New') === filterStatus)
    if (filterAssetType) list = list.filter(p => (p.asset_type || '') === filterAssetType)
    return list
  }, [properties, q, filterStatus, filterAssetType])

  const sortedListProperties = useMemo(() => {
    const { col, dir } = listSort
    return [...filteredProperties].sort((a, b) => {
      let av = a[col], bv = b[col]
      if (av == null) av = col === 'price' || col === 'square_feet' || col === 'year_built' ? -Infinity : ''
      if (bv == null) bv = col === 'price' || col === 'square_feet' || col === 'year_built' ? -Infinity : ''
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredProperties, listSort])

  function toggleSort(col) {
    setListSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  function SortIcon({ col: c }) {
    if (listSort.col !== c) return <span className="ml-1 opacity-25">⇅</span>
    return <span className="ml-1">{listSort.dir === 'asc' ? '↑' : '↓'}</span>
  }

  const kanbanColumns = [
    { label: 'New',          color: 'badge-neutral', status: 'New' },
    { label: 'Under Review', color: 'badge-info',    status: 'Under Review' },
    { label: 'Active',       color: 'badge-success', status: 'Active' },
    { label: 'Other',        color: 'badge-warning', status: 'Other' },
  ]

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {user.role === 'admin' && (
            <button className="btn btn-primary btn-sm" onClick={() => { setSelectedProperty(null); setShowPropertyModal(true) }}>
              + New Property
            </button>
          )}
          {/* Search */}
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search address, PIN, county, type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input input-bordered input-sm pl-8 w-60"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
          {/* List-mode filters */}
          {effectiveView === 'list' && (
            <>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select select-bordered select-sm">
                <option value="">All Statuses</option>
                {['New','Under Review','Active','Other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {allAssetTypes.length > 0 && (
                <select value={filterAssetType} onChange={e => setFilterAssetType(e.target.value)} className="select select-bordered select-sm">
                  <option value="">All Types</option>
                  {allAssetTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {(filterStatus || filterAssetType) && (
                <button className="btn btn-xs btn-ghost" onClick={() => { setFilterStatus(''); setFilterAssetType('') }}>Clear filters</button>
              )}
            </>
          )}
        </div>

        {/* View toggle — admin only */}
        {isAdmin && (
        <div className="join">
          <button
            className={`join-item btn btn-sm ${effectiveView === 'list' ? 'btn-neutral' : 'btn-outline'}`}
            title="List view" onClick={() => setViewMode('list')}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            className={`join-item btn btn-sm ${effectiveView === 'grid' ? 'btn-neutral' : 'btn-outline'}`}
            title="Grid view" onClick={() => setViewMode('grid')}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h6v6H4zm10 0h6v6h-6zM4 15h6v6H4zm10 0h6v6h-6z" />
            </svg>
          </button>
          <button
            className={`join-item btn btn-sm ${effectiveView === 'kanban' ? 'btn-neutral' : 'btn-outline'}`}
            title="Kanban view" onClick={() => setViewMode('kanban')}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v8a2 2 0 01-2 2h-4M9 3v18" />
            </svg>
          </button>
        </div>
        )}
      </div>

      <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>}>
        <PropertyDetailModal
          open={showPropertyModal}
          property={selectedProperty}
          isAdmin={user.role === 'admin'}
          onClose={() => setShowPropertyModal(false)}
          onSave={async (p) => { await saveProperty(p) }}
          topOffset={propertyModalTopOffset}
        />
      </Suspense>

      {loading && <p className="text-base-content/40 text-sm">Loading…</p>}

      {!loading && properties.length === 0 && (
        <div className="py-16 text-center text-base-content/30">
          <p className="text-lg">No properties yet</p>
          {user.role === 'admin' && <p className="text-sm mt-1">Click &quot;+ New Property&quot; to add one</p>}
          {user.role !== 'admin' && <p className="text-sm mt-1">Properties assigned to you will appear here</p>}
        </div>
      )}

      {!loading && properties.length > 0 && filteredProperties.length === 0 && (
        <div className="py-10 text-center text-base-content/30">
          <p>No properties match &ldquo;{search}&rdquo;</p>
          <button className="btn btn-xs btn-ghost mt-2" onClick={() => setSearch('')}>Clear search</button>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {effectiveView === 'grid' && !loading && filteredProperties.length > 0 && (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((prop, i) => (
            <div key={i}
              className="card bg-base-100 border border-base-300 hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
              <PropertyCardCarousel propertyId={prop.id} onClick={() => openProperty(prop)} />
              <div className="card-body gap-3 p-6" onClick={() => openProperty(prop)}>
                <h2 className="text-base font-semibold leading-snug">{prop.address}</h2>
                <div className="space-y-1">
                  <p className="text-sm text-base-content/60">{prop.county} County</p>
                  <p className="text-xs text-base-content/40 font-mono">PIN: {prop.pin}</p>
                  {prop.price && <p className="text-sm font-medium">{fmt(prop.price)}</p>}
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
      )}

      {/* ── LIST VIEW ── */}
      {effectiveView === 'list' && !loading && filteredProperties.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="text-xs text-base-content/50 uppercase tracking-wide select-none">
                {[
                  { label: 'Address', col: 'address' },
                  { label: 'County', col: 'county' },
                  { label: 'PIN', col: 'pin' },
                  { label: 'Status', col: 'status' },
                  { label: 'Type', col: 'asset_type' },
                  { label: 'Price', col: 'price' },
                  { label: 'Sq Ft', col: 'square_feet' },
                  { label: 'Year Built', col: 'year_built' },
                  { label: 'Updated', col: 'updated_at' },
                ].map(({ label, col }) => (
                  <th key={col} className="cursor-pointer hover:text-base-content whitespace-nowrap" onClick={() => toggleSort(col)}>
                    {label}<SortIcon col={col} />
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedListProperties.map((prop, i) => (
                <tr key={i} className="hover cursor-pointer" onClick={() => openProperty(prop)}>
                  <td className="font-medium max-w-xs truncate">{prop.address}</td>
                  <td className="text-sm text-base-content/60">{prop.county}</td>
                  <td className="font-mono text-xs text-base-content/50">{prop.pin}</td>
                  <td className="text-xs"><span className="badge badge-xs badge-outline">{prop.status || 'New'}</span></td>
                  <td className="text-xs text-base-content/60">{prop.asset_type || <span className="text-base-content/30">—</span>}</td>
                  <td className="text-sm">{fmt(prop.price) || <span className="text-base-content/30">—</span>}</td>
                  <td className="text-sm">{prop.square_feet ? Number(prop.square_feet).toLocaleString() : <span className="text-base-content/30">—</span>}</td>
                  <td className="text-sm">{prop.year_built || <span className="text-base-content/30">—</span>}</td>
                  <td className="text-xs text-base-content/40 whitespace-nowrap">
                    {prop.updated_at ? new Date(prop.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {user.role === 'admin' && (
                      <div className="flex gap-1">
                        <button className="btn btn-xs btn-ghost" onClick={() => openProperty(prop)}>Edit</button>
                        <button className="btn btn-xs btn-ghost text-error" onClick={() => deleteProperty(prop.id)}>Del</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {effectiveView === 'kanban' && !loading && filteredProperties.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map(col => {
            const colProps = filteredProperties.filter(p => (p.status || 'New') === col.status)
            return (
              <div key={col.label} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`badge badge-sm ${col.color}`}>{col.label}</span>
                  <span className="text-xs text-base-content/40">{colProps.length}</span>
                </div>
                <div className="space-y-3">
                  {colProps.length === 0 && (
                    <div className="rounded-lg border border-dashed border-base-300 p-4 text-center text-xs text-base-content/30">
                      No properties
                    </div>
                  )}
                  {colProps.map((prop, i) => (
                    <div key={i}
                      className="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openProperty(prop)}>
                      <div className="card-body p-4 gap-2">
                        <p className="font-medium text-sm leading-snug line-clamp-2">{prop.address}</p>
                        <p className="text-xs text-base-content/50">{prop.county} County</p>
                        {prop.price && <p className="text-sm font-semibold">{fmt(prop.price)}</p>}
                        <p className="text-xs text-base-content/40 font-mono">PIN: {prop.pin}</p>
                        {isAdmin && (
                          <div className="flex gap-1 pt-1 border-t border-base-200 flex-wrap" onClick={e => e.stopPropagation()}>
                            <select
                              value={prop.status || 'New'}
                              onChange={async e => {
                                const newStatus = e.target.value
                                try {
                                  await apiFetch(`/api/properties/${prop.id}/status`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: newStatus })
                                  })
                                  fetchProperties()
                                } catch {}
                              }}
                              className="select select-bordered select-xs flex-1 min-w-0"
                            >
                              {['New','Under Review','Active','Other'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <button className="btn btn-xs btn-ghost" onClick={() => openProperty(prop)}>Edit</button>
                            <button className="btn btn-xs btn-ghost text-error" onClick={() => deleteProperty(prop.id)}>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LookupPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notConfigured, setNotConfigured] = useState(false)
  const [result, setResult] = useState(null)
  const [phone, setPhone] = useState('')
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [phoneNotConfigured, setPhoneNotConfigured] = useState(false)
  const [phoneResult, setPhoneResult] = useState(null)
  const [groundingQuery, setGroundingQuery] = useState('')
  const [groundingLoading, setGroundingLoading] = useState(false)
  const [groundingError, setGroundingError] = useState('')
  const [groundingNotConfigured, setGroundingNotConfigured] = useState(false)
  const [groundingResult, setGroundingResult] = useState(null)
  const [usage, setUsage] = useState(null)
  const [usageLoading, setUsageLoading] = useState(true)
  const [usageError, setUsageError] = useState('')

  const formatCredits = useCallback((value) => {
    const numeric = Number(value || 0)
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)
  }, [])

  const loadUsage = useCallback(async () => {
    setUsageLoading(true)
    setUsageError('')
    try {
      const data = await apiFetch('/api/lookup/usage')
      setUsage(data)
    } catch (e) {
      setUsage(null)
      if (e.status === 403) {
        setUsageError('Usage is only available to admins')
      } else {
        setUsageError(e.message || 'Failed to load usage')
        console.error('Failed to load usage:', e.message)
      }
    } finally {
      setUsageLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsage()
  }, [loadUsage])

  async function verifyEmail(e) {
    e.preventDefault()
    setError('')
    setNotConfigured(false)
    setResult(null)
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    setLoading(true)
    try {
      const data = await apiFetch('/api/lookup/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      setResult(data)
      await loadUsage()
    } catch (e) {
      if (e.status === 503) {
        setNotConfigured(true)
        return
      }
      setError(e.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function validatePhone(e) {
    e.preventDefault()
    setPhoneError('')
    setPhoneNotConfigured(false)
    setPhoneResult(null)
    if (!phone.trim()) {
      setPhoneError('Phone number is required')
      return
    }
    setPhoneLoading(true)
    try {
      const data = await apiFetch('/api/lookup/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      setPhoneResult(data)
      await loadUsage()
    } catch (e) {
      if (e.status === 503) {
        setPhoneNotConfigured(true)
        return
      }
      setPhoneError(e.message || 'Validation failed')
    } finally {
      setPhoneLoading(false)
    }
  }

  async function runGroundedSearch(e) {
    e.preventDefault()
    setGroundingError('')
    setGroundingNotConfigured(false)
    setGroundingResult(null)
    if (!groundingQuery.trim()) {
      setGroundingError('Search query is required')
      return
    }
    setGroundingLoading(true)
    try {
      const data = await apiFetch('/api/lookup/grounded-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: groundingQuery })
      })
      setGroundingResult(data)
    } catch (e) {
      if (e.status === 503) {
        setGroundingNotConfigured(true)
        return
      }
      setGroundingError(e.message || 'Grounded search failed')
    } finally {
      setGroundingLoading(false)
    }
  }

  const flags = result?.result ? [
    { label: 'Disposable', value: result.result.disposable },
    { label: 'Webmail', value: result.result.webmail },
    { label: 'Gibberish', value: result.result.gibberish },
    { label: 'SMTP check', value: result.result.smtp_check },
    { label: 'Accept-all', value: result.result.accept_all },
    { label: 'Block', value: result.result.block },
    { label: 'MX present', value: result.result.mx_records }
  ] : []
  const verdictValue = result?.result?.result
  const verdictStatus = result?.result?.status
  const positiveVerdicts = ['deliverable', 'valid', 'reachable', 'accept_all']
  const isPositiveVerdict = [verdictValue, verdictStatus]
    .filter(Boolean)
    .some(value => positiveVerdicts.includes(String(value).toLowerCase()))
  const isPhoneValid = !!phoneResult?.result?.valid
  const usageCards = [
    { key: 'hunter', label: 'Hunter.io' },
    { key: 'numverify', label: 'Numverify' }
  ]

  const getUsagePercent = (providerUsage) => {
    if (!providerUsage?.limit) return 0
    return Math.min((providerUsage.used / providerUsage.limit) * 100, 100)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Lookup</h2>
        <p className="text-sm text-base-content/60 max-w-3xl">
          This admin area will host phone, email, name, address, and business lookup tools.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {usageCards.map(card => {
          const providerUsage = usage?.[card.key]
          const usagePercent = getUsagePercent(providerUsage)
          return (
            <div key={card.key} className="rounded-xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{card.label}</p>
                  <p className="text-xs text-base-content/55">
                    {providerUsage
                      ? `${formatCredits(providerUsage.remaining)} remaining / ${formatCredits(providerUsage.limit)} total`
                      : usageError || (usageLoading ? 'Loading usage…' : 'Usage unavailable')}
                  </p>
                </div>
                {providerUsage && (
                  <span className="text-xs text-base-content/45">
                    {formatCredits(providerUsage.costPerRequest)} credit / request
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-base-200">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                {providerUsage && (
                  <div className="flex items-center justify-between text-xs text-base-content/55">
                    <span>{formatCredits(providerUsage.used)} used</span>
                    <span>{Math.round(usagePercent)}%</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-5 md:p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Email Verification</h3>
            <p className="text-sm text-base-content/55">
              Verify an email address with Hunter.io without exposing the API key to the browser.
            </p>
          </div>
          <form onSubmit={verifyEmail} className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input input-bordered flex-1"
              />
              <button className="btn btn-primary md:min-w-32" type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </form>

          {error && (
            <div className="rounded-xl border border-base-300 bg-base-200/40 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {notConfigured && (
            <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 px-4 py-4 text-sm text-base-content/60">
              Hunter.io is not configured on this server yet.
            </div>
          )}

          {result?.result && (
            <div className="rounded-xl border border-base-300 bg-base-200/30 p-4 md:p-5 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-base-content/50">Overall verdict</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {isPositiveVerdict && (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-success/30 bg-success/12 text-sm font-semibold leading-none text-success">
                        ✓
                      </span>
                    )}
                    <span className={`badge ${isPositiveVerdict ? 'badge-success' : 'badge-neutral'}`}>{verdictValue || 'unknown'}</span>
                    {result.result.status && <span className="badge badge-outline">{result.result.status}</span>}
                  </div>
                </div>
                {result.result.score !== null && result.result.score !== undefined && (
                  <div className="text-sm text-base-content/70">
                    Score <span className="font-semibold text-base-content">{result.result.score}</span>
                  </div>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {flags.map(flag => (
                  <div key={flag.label} className="flex items-center justify-between rounded-lg border border-base-300 px-3 py-2 text-sm">
                    <span className="text-base-content/70">{flag.label}</span>
                    <span className={`badge badge-sm ${flag.value ? 'badge-neutral' : 'badge-outline'}`}>
                      {flag.value ? 'Yes' : 'No'}
                    </span>
                  </div>
                ))}
              </div>

              {result.result.sources !== null && result.result.sources !== undefined && (
                <div className="text-sm text-base-content/70">
                  Source count <span className="font-medium text-base-content">{result.result.sources}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-5 md:p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Grounded Google Search</h3>
            <p className="text-sm text-base-content/55">
              Research a person, company, or topic with Google-grounded Gemini results and source citations.
            </p>
          </div>
          <form onSubmit={runGroundedSearch} className="space-y-4">
            <div className="flex flex-col gap-3">
              <textarea
                placeholder="Search the public web for current facts about a person, company, email, or topic..."
                value={groundingQuery}
                onChange={e => setGroundingQuery(e.target.value)}
                className="textarea textarea-bordered min-h-28 w-full"
              />
              <div className="flex justify-end">
                <button className="btn btn-primary md:min-w-40" type="submit" disabled={groundingLoading}>
                  {groundingLoading ? 'Searching…' : 'Run grounded search'}
                </button>
              </div>
            </div>
          </form>

          {groundingError && (
            <div className="rounded-xl border border-base-300 bg-base-200/40 px-4 py-3 text-sm text-error">
              {groundingError}
            </div>
          )}

          {groundingNotConfigured && (
            <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 px-4 py-4 text-sm text-base-content/60">
              Grounded Google Search is not configured on this server yet.
            </div>
          )}

          {groundingResult?.result && (
            <div className="rounded-xl border border-base-300 bg-base-200/30 p-4 md:p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-base-content/50">Grounded summary</p>
                <div className="whitespace-pre-wrap text-sm leading-6 text-base-content">
                  {groundingResult.result.text || 'No grounded response returned.'}
                </div>
              </div>

              {Array.isArray(groundingResult.result.sources) && groundingResult.result.sources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-base-content/50">Sources</p>
                  <div className="space-y-2">
                    {groundingResult.result.sources.map((source, index) => (
                      <a
                        key={`${source.url}-${index}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border border-base-300 bg-base-100 px-3 py-3 text-sm hover:border-primary/35 hover:bg-base-100/90"
                      >
                        <p className="font-medium text-base-content">{source.title || `Source ${index + 1}`}</p>
                        <p className="mt-1 break-all text-xs text-base-content/60">{source.url}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(groundingResult.result.webSearchQueries) && groundingResult.result.webSearchQueries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-base-content/50">Google search suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {groundingResult.result.webSearchQueries.map(query => (
                      <span key={query} className="badge badge-outline">
                        {query}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-5 md:p-6 space-y-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Phone Validation</h3>
            <p className="text-sm text-base-content/55">
              Validate a phone number with Numverify while keeping the API key on the server.
            </p>
          </div>
          <form onSubmit={validatePhone} className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="tel"
                placeholder="+1 555 123 4567"
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                className="input input-bordered flex-1"
              />
              <button className="btn btn-primary md:min-w-32" type="submit" disabled={phoneLoading}>
                {phoneLoading ? 'Validating…' : 'Validate'}
              </button>
            </div>
          </form>

          {phoneError && (
            <div className="rounded-xl border border-base-300 bg-base-200/40 px-4 py-3 text-sm text-error">
              {phoneError}
            </div>
          )}

          {phoneNotConfigured && (
            <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 px-4 py-4 text-sm text-base-content/60">
              Numverify is not configured on this server yet.
            </div>
          )}

          {phoneResult?.result && (
            <div className="rounded-xl border border-base-300 bg-base-200/30 p-4 md:p-5 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-base-content/50">Validation result</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {isPhoneValid && (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-success/30 bg-success/12 text-sm font-semibold leading-none text-success">
                        ✓
                      </span>
                    )}
                    <span className={`badge ${isPhoneValid ? 'badge-success' : 'badge-neutral'}`}>{isPhoneValid ? 'valid' : 'invalid'}</span>
                    {phoneResult.result.line_type && <span className="badge badge-outline">{phoneResult.result.line_type}</span>}
                  </div>
                </div>
                {phoneResult.result.international_format && (
                  <div className="text-sm text-base-content/70">
                    <span className="font-semibold text-base-content">{phoneResult.result.international_format}</span>
                  </div>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  { label: 'Country', value: phoneResult.result.country_name || phoneResult.result.country_code || '—' },
                  { label: 'Location', value: phoneResult.result.location || '—' },
                  { label: 'Carrier', value: phoneResult.result.carrier || '—' },
                  { label: 'Line type', value: phoneResult.result.line_type || '—' },
                  { label: 'International format', value: phoneResult.result.international_format || '—' },
                  { label: 'Local format', value: phoneResult.result.local_format || '—' }
                ].map(field => (
                  <div key={field.label} className="rounded-lg border border-base-300 px-3 py-2 text-sm">
                    <p className="text-xs uppercase tracking-widest text-base-content/45">{field.label}</p>
                    <p className="mt-1 font-medium text-base-content">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [page, setPage] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null })
  const [authChecked, setAuthChecked] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('rep_theme') === 'dark')
  const [loginPreview, setLoginPreview] = useState(null)
  const [loginStatus, setLoginStatus] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [contactsKey, setContactsKey] = useState(0)
  const [globalSearch, setGlobalSearch] = useState('')
  const [globalResults, setGlobalResults] = useState({ properties: [], users: [], contacts: [], auditLogs: [] })
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalOpen, setGlobalOpen] = useState(false)
  const debouncedGlobalSearch = useDebounce(globalSearch, 250)
  const globalSearchRef = useRef(null)

  // Show/hide reCAPTCHA badge based on whether user is identified
  useEffect(() => {
    if (currentUser || loginPreview) {
      document.body.classList.remove('recaptcha-hidden')
    } else {
      document.body.classList.add('recaptcha-hidden')
    }
  }, [currentUser, loginPreview])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!globalSearchRef.current?.contains(event.target)) setGlobalOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      setGlobalResults({ properties: [], users: [], contacts: [], auditLogs: [] })
      setGlobalLoading(false)
      setGlobalOpen(false)
      return
    }
    const trimmed = debouncedGlobalSearch.trim()
    if (trimmed.length < 2) {
      setGlobalResults({ properties: [], users: [], contacts: [], auditLogs: [] })
      setGlobalLoading(false)
      if (!trimmed) setGlobalOpen(false)
      return
    }
    let cancelled = false
    setGlobalLoading(true)
    setGlobalOpen(true)
    apiFetch(`/api/global-search?q=${encodeURIComponent(trimmed)}`)
      .then(data => {
        if (!cancelled) setGlobalResults({
          properties: data.properties || [],
          users: data.users || [],
          contacts: data.contacts || [],
          auditLogs: data.auditLogs || []
        })
      })
      .catch(() => {
        if (!cancelled) setGlobalResults({ properties: [], users: [], contacts: [], auditLogs: [] })
      })
      .finally(() => {
        if (!cancelled) setGlobalLoading(false)
      })
    return () => { cancelled = true }
  }, [currentUser, debouncedGlobalSearch])

  function navigateTo(p) {
    if ((p === 'users' || p === 'audit' || p === 'contacts' || p === 'lookup') && currentUser?.role !== 'admin') return
    if (p === 'contacts') setContactsKey(k => k + 1) // reset ContactsPage state
    setPage(p); localStorage.setItem('rep_page', p)
  }

  function closeGlobalSearch() {
    setGlobalOpen(false)
  }

  function clearGlobalSearch() {
    setGlobalSearch('')
    setGlobalResults({ properties: [], users: [], contacts: [], auditLogs: [] })
    setGlobalOpen(false)
  }

  function handleGlobalResultClick(type, item) {
    if (type === 'property') {
      localStorage.setItem('rep_global_property_id', String(item.id))
      navigateTo('properties')
    } else if (type === 'user') {
      localStorage.setItem('rep_global_users_query', item.email || [item.first_name, item.last_name].filter(Boolean).join(' '))
      navigateTo('users')
    } else if (type === 'contact') {
      localStorage.setItem('rep_global_contacts_query', item.email || [item.first_name, item.last_name].filter(Boolean).join(' '))
      navigateTo('contacts')
    } else if (type === 'audit') {
      localStorage.setItem('rep_global_audit_query', item.target_email || item.acted_by_email || item.action || '')
      navigateTo('audit')
    }
    clearGlobalSearch()
    setMobileMenuOpen(false)
  }

  // Restore session on page load/refresh
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setCurrentUser(data.user)
          const saved = localStorage.getItem('rep_page')
          const adminPages = ['users', 'contacts', 'audit', 'lookup']
          const validPages = ['dashboard', 'properties', 'profile', ...( data.user.role === 'admin' ? adminPages : [])]
          setPage(saved && validPages.includes(saved) ? saved : 'dashboard')
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true))
  }, [])

  async function lookupEmail(emailVal) {    if (!emailVal || !emailVal.includes('@')) { setLoginPreview(null); return }
    try {
      const res = await fetch('/api/lookup-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailVal }) })
      const data = await res.json()
      if (data.found) {
        setLoginPreview(data)
        // Lazy-load reCAPTCHA only once user is recognised
        if (!window.grecaptcha && !document.getElementById('recaptcha-script')) {
          const s = document.createElement('script')
          s.id = 'recaptcha-script'
          s.src = 'https://www.google.com/recaptcha/enterprise.js?render=6LerA3ctAAAAAKpS3caYCY9pDLR26TQY060EFpYv'
          s.async = true
          document.head.appendChild(s)
        }
      } else {
        setLoginPreview(null)
      }
    } catch { setLoginPreview(null) }
  }

  async function login(e) {
    e.preventDefault(); setMsg(''); setLoading(true)
    setLoginStatus('verifying')
    try {
      const recaptchaToken = await getRecaptchaToken('LOGIN')
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, recaptchaToken }) })
      const data = await res.json()
      if (!res.ok) {
        setLoginStatus('denied')
        setMsg(data.error || 'Login failed')
        setTimeout(() => setLoginStatus(null), 2500)
        return
      }
      setLoginStatus('success')
      await new Promise(r => setTimeout(r, 900))
      setCurrentUser(data.user); setPage('dashboard'); setEmail(''); setPassword('')
      setLoginStatus(null)
    } catch {
      setLoginStatus('denied')
      setMsg('Network error')
      setTimeout(() => setLoginStatus(null), 2500)
    }
    finally { setLoading(false) }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    localStorage.removeItem('rep_page')
    setCurrentUser(null); setPage('login'); setEmail(''); setPassword(''); setLoginPreview(null)
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
      <>
      <div className="min-h-screen flex items-center justify-center"
        style={{ backgroundImage: "url('/assets/background-login.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/55" />
        <div className="relative z-10 w-full flex items-center justify-center px-4">
          <div className="card w-full max-w-md bg-base-100 shadow-2xl">
            <div className="card-body p-10 space-y-6">
              <div className="flex justify-center mb-2">
                {loginPreview ? (
                  <div className="flex flex-col items-center gap-3 animate-fade-in">
                    <Avatar src={loginPreview.profile_photo}
                      name={[loginPreview.first_name, loginPreview.last_name].filter(Boolean).join(' ') || email}
                      size="lg" />
                    <div className="text-center">
                      <p className="text-xl font-semibold">
                        {[loginPreview.first_name, loginPreview.last_name].filter(Boolean).join(' ') || email.split('@')[0]}
                      </p>
                      <p className="text-sm text-base-content/50">
                        {loginPreview.login_count > 0 ? 'Welcome back' : 'Welcome'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Logo />
                )}
              </div>
              <form onSubmit={login} className="space-y-5">
                <Field label="Email" required>
                  <input type="email" placeholder="your@email.com" value={email}
                    onChange={e => { setEmail(e.target.value); setLoginPreview(null) }}
                    onBlur={e => lookupEmail(e.target.value)}
                    className="input input-bordered w-full" required />
                </Field>
                <Field label="Password" required>
                  <input type="password" placeholder="Password" value={password}
                    onChange={e => setPassword(e.target.value)} className="input input-bordered w-full" required />
                </Field>
                {msg && <div className="alert alert-error text-sm">{msg}</div>}

                {/* reCAPTCHA shield indicator — only shown after loginPreview (user recognised) */}
                {loginPreview && (
                  <div className="flex justify-center">
                    <RecaptchaShield status={loginStatus} />
                  </div>
                )}

                <button className="btn btn-primary w-full" disabled={loading}>
                  {loading ? 'Processing…' : 'Sign In'}
                </button>
              </form>
              <div className="divider text-xs text-base-content/30 my-0" />
              <button className="btn btn-ghost btn-sm w-full text-base-content/60"
                onClick={() => { setShowForgot(true); setMsg('') }}>
                Forgot your password?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <ForgotPasswordModal onClose={() => setShowForgot(false)} prefillEmail={email} />
      )}
      </>
    )
  }

  /* ── Authenticated shell ── */
  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'properties', label: 'Properties' },
    ...(currentUser.role === 'admin' ? [{ id: 'users', label: 'Users' }, { id: 'contacts', label: 'Contacts' }, { id: 'audit', label: 'Audit Logs' }, { id: 'lookup', label: 'Lookup' }] : []),
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
  const globalSections = [
    { key: 'properties', label: 'Properties' },
    { key: 'users', label: 'Users' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'auditLogs', label: 'Audit Logs' }
  ]
  const globalHasResults = globalSections.some(section => (globalResults[section.key] || []).length > 0)

  function toggleDarkMode() {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('rep_theme', next ? 'dark' : 'light')
  }

  // Sun icon (day)
  const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  )

  // Moon icon (night)
  const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
    </svg>
  )

  const renderGlobalSearch = (mobile = false) => (
    <div ref={mobile ? undefined : globalSearchRef} className={`relative ${mobile ? 'w-full' : 'w-[360px]'}`}>
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search properties, users, contacts, logs…"
          value={globalSearch}
          onChange={e => { setGlobalSearch(e.target.value); setGlobalOpen(!!e.target.value.trim()) }}
          onFocus={() => { if (globalSearch.trim().length >= 2) setGlobalOpen(true) }}
          className={`input input-bordered ${mobile ? 'input-sm w-full' : 'input-sm'} pl-9 pr-9 w-full`}
        />
        {globalSearch && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content" onClick={clearGlobalSearch}>✕</button>
        )}
      </div>
      {globalOpen && (
        <div className={`absolute ${mobile ? 'left-0 right-0 top-full mt-2' : 'right-0 top-full mt-2'} rounded-xl border border-base-300 bg-base-100 shadow-2xl overflow-hidden z-50`}>
          <div className="max-h-[70vh] overflow-y-auto">
            {globalLoading && <div className="px-4 py-6 text-sm text-base-content/50 text-center">Searching…</div>}
            {!globalLoading && !globalHasResults && debouncedGlobalSearch.trim().length >= 2 && (
              <div className="px-4 py-6 text-sm text-base-content/50 text-center">No matches found</div>
            )}
            {!globalLoading && globalSections.map(section => {
              const items = globalResults[section.key] || []
              if (!items.length) return null
              return (
                <div key={section.key} className="border-t first:border-t-0 border-base-300">
                  <div className="px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-base-content/40 bg-base-200/60">{section.label}</div>
                  <div className="divide-y divide-base-300/70">
                    {section.key === 'properties' && items.map(item => (
                      <button key={`property-${item.id}`} className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors" onClick={() => handleGlobalResultClick('property', item)}>
                        <div className="text-sm font-medium truncate">{item.address}</div>
                        <div className="text-xs text-base-content/55 truncate">{item.county} · {item.asset_type || '—'} · {item.status || '—'}</div>
                        <div className="text-[11px] text-base-content/35 font-mono truncate">PIN: {item.pin}</div>
                      </button>
                    ))}
                    {section.key === 'users' && items.map(item => (
                      <button key={`user-${item.id}`} className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors" onClick={() => handleGlobalResultClick('user', item)}>
                        <div className="text-sm font-medium truncate">{[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}</div>
                        <div className="text-xs text-base-content/55 truncate">{item.email}</div>
                        <div className="text-[11px] text-base-content/35 truncate">{item.organization || item.role || '—'}</div>
                      </button>
                    ))}
                    {section.key === 'contacts' && items.map(item => (
                      <button key={`contact-${item.id}`} className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors" onClick={() => handleGlobalResultClick('contact', item)}>
                        <div className="text-sm font-medium truncate">{[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email}</div>
                        <div className="text-xs text-base-content/55 truncate">{item.email}</div>
                        <div className="text-[11px] text-base-content/35 truncate">{item.last_note_text || item.buy_box || item.organization || 'No recent note'}</div>
                      </button>
                    ))}
                    {section.key === 'auditLogs' && items.map(item => (
                      <button key={`audit-${item.id}`} className="w-full text-left px-4 py-3 hover:bg-base-200 transition-colors" onClick={() => handleGlobalResultClick('audit', item)}>
                        <div className="text-sm font-medium truncate">{item.action}</div>
                        <div className="text-xs text-base-content/55 truncate">{item.acted_by_email || 'system'} → {item.target_email || '—'}</div>
                        <div className="text-[11px] text-base-content/35 truncate">{item.details || new Date(item.created_at).toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-base-200" data-theme={darkMode ? 'monochrome-dark' : 'monochrome'}>
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
        <div className="hidden md:flex flex-none items-center gap-2">
          {currentUser.role === 'admin' && renderGlobalSearch()}
          <button className="btn btn-sm btn-ghost" onClick={toggleDarkMode} title={darkMode ? 'Day mode' : 'Night mode'}>
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className={`btn btn-ghost h-auto py-1.5 px-3 flex items-center gap-2.5 rounded-lg ${page === 'profile' ? 'btn-active' : ''}`}
            onClick={() => navigateTo('profile')}
          >
            <Avatar src={currentUser.profile_photo} name={displayName} size="sm" />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-xs text-base-content/50 font-normal">
                {(currentUser.login_count || 0) > 1 ? 'Welcome back,' : 'Welcome,'}
              </span>
              <span className="text-sm font-semibold truncate max-w-[160px]">
                {[currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.email.split('@')[0]}
              </span>
            </div>
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
        <div data-mobile-nav-menu="true" className="md:hidden bg-base-100 border-b border-base-300 px-4 py-3 flex flex-col gap-1 sticky top-[64px] z-40 shadow-md">
          {currentUser.role === 'admin' && <div className="mb-2">{renderGlobalSearch(true)}</div>}
          {navLinks.map(({ id, label }) => navBtn(id, label))}
          <div className="divider my-1" />
          <button className="btn btn-sm btn-ghost w-full justify-start gap-2" onClick={toggleDarkMode}>
            {darkMode ? <SunIcon /> : <MoonIcon />}
            {darkMode ? 'Day Mode' : 'Night Mode'}
          </button>
          <button className="btn btn-sm btn-outline w-full" onClick={() => { logout(); setMobileMenuOpen(false) }}>Sign Out</button>
        </div>
      )}

      {/* Main content */}
      <main className="container mx-auto px-4 md:px-6 py-6 md:py-10 max-w-6xl">
        <ErrorBoundary key={page}>

        {page === 'dashboard' && (
          <div className="space-y-6 py-6">
            <h1 className="text-2xl md:text-3xl font-bold">
              {(currentUser.login_count || 0) > 1 ? 'Welcome back, ' : 'Welcome, '}
              {[currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.email.split('@')[0]}
            </h1>
          </div>
        )}

        {page === 'users' && currentUser.role === 'admin' && (
          <div className="space-y-10">
            <h2 className="text-2xl font-bold">Manage Users</h2>
            <div className="card bg-base-100 border border-base-300">
              <div className="card-body p-4 md:p-8">
                <h3 className="text-base font-semibold uppercase tracking-widest text-base-content/50 mb-6">Create New User</h3>
                <AddUserForm onCreated={() => { }} />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold uppercase tracking-widest text-base-content/50 mb-4">All Users</h3>
              <UsersTable users={users} onReload={setUsers} onEdit={u => { setEditingUser(u); setShowEditUserModal(true) }} />
            </div>

            <EditUserModal
              open={showEditUserModal}
              user={editingUser}
              onClose={() => setShowEditUserModal(false)}
              onSave={async () => {
                const data = await apiFetch('/api/users')
                setUsers(data.users || [])
              }}
            />
          </div>
        )}

        {page === 'properties' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">
              {currentUser.role === 'admin' ? 'Manage Properties' : 'My Properties'}
            </h2>
            <PropertiesPage user={currentUser} />
          </div>
        )}

        {page === 'contacts' && currentUser.role === 'admin' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>}>
            <ContactsPage key={contactsKey} />
          </Suspense>
        )}

        {page === 'audit' && currentUser.role === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Audit Logs</h2>
            <Suspense fallback={<div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg" /></div>}>
              <AuditLogs />
            </Suspense>
          </div>
        )}

        {page === 'lookup' && currentUser.role === 'admin' && (
          <LookupPage />
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
