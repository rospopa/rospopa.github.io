import { useEffect, useState } from 'react'

/* ─── Shared helpers ──────────────────────────────────────────── */

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

/* ─── Logo ────────────────────────────────────────────────────── */

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-sm flex items-center justify-center bg-primary"
        style={{ fontFamily: "'Playfair Display', serif" }}>
        <span className="text-primary-content font-bold text-sm leading-none">RE</span>
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
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function createUser(e) {
    e.preventDefault()
    setMsg('')
    setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, first_name: firstName, last_name: lastName, organization, phone_number: phoneNumber, buy_box: buyBox })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsgType('error'); setMsg(data.error || 'Create failed'); return }
      setEmail(''); setPassword(''); setRole('user')
      setFirstName(''); setLastName(''); setOrganization(''); setPhoneNumber(''); setBuyBox('')
      setMsgType('success'); setMsg('User created')
      if (onCreated) onCreated()
    } catch { setMsgType('error'); setMsg('Network error') }
    finally { setLoading(false); setTimeout(() => setMsg(''), 4000) }
  }

  return (
    <form onSubmit={createUser} className="space-y-5">
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
      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
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
      const res = await fetch(`/api/audit-logs?q=${encodeURIComponent(q)}&page=${page}&perPage=${perPage}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (e) { console.error('Fetch logs failed:', e) }
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

function UsersTable({ users, onReload }) {
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(query)}&perPage=${perPage}&page=${page}`)
      const data = await res.json()
      if (data.users) onReload(data.users)
    } catch (e) { console.error('Fetch failed:', e) }
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
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Organization</th>
              <th className="py-3 px-4">Phone</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0
              ? <tr><td colSpan={5} className="text-center py-8 text-base-content/40">No users found</td></tr>
              : users.map((u, i) => (
                <tr key={i}>
                  <td className="py-3 px-4">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className="badge badge-primary badge-sm">{u.role}</span>
                  </td>
                  <td className="py-3 px-4">{[u.first_name, u.last_name].filter(Boolean).join(' ') || <span className="text-base-content/30">—</span>}</td>
                  <td className="py-3 px-4">{u.organization || <span className="text-base-content/30">—</span>}</td>
                  <td className="py-3 px-4">{u.phone_number || <span className="text-base-content/30">—</span>}</td>
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

/* ─── Property Modal ──────────────────────────────────────────── */

function PropertyDetailModal({ open, property, onClose, onSave }) {
  const [pin, setPin] = useState(property?.pin || '')
  const [address, setAddress] = useState(property?.address || '')
  const [county, setCounty] = useState(property?.county || '')

  useEffect(() => {
    if (property) {
      setPin(property.pin || '')
      setAddress(property.address || '')
      setCounty(property.county || '')
    } else {
      setPin(''); setAddress(''); setCounty('')
    }
  }, [property, open])

  if (!open) return null

  async function handleSave() {
    if (!pin.trim() || !address.trim() || !county.trim()) {
      alert('All fields are required')
      return
    }
    await onSave({ ...property, pin, address, county })
    onClose()
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-xl mb-6">{property?.id ? 'Edit Property' : 'New Property'}</h3>
        <div className="space-y-5">
          <Field label="PIN(s)" required>
            <input type="text" placeholder="e.g. 12-34-567-890" value={pin}
              onChange={e => setPin(e.target.value)} className="input input-bordered w-full" />
          </Field>
          <Field label="Address" required>
            <input type="text" placeholder="123 Main St, Chicago, IL" value={address}
              onChange={e => setAddress(e.target.value)} className="input input-bordered w-full" />
          </Field>
          <Field label="County" required>
            <input type="text" placeholder="e.g. Cook" value={county}
              onChange={e => setCounty(e.target.value)} className="input input-bordered w-full" />
          </Field>
        </div>
        <div className="modal-action mt-8">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Property</button>
        </div>
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
      const res = await fetch(`/api/properties?${user.role === 'admin' ? 'allProps=true' : ''}`)
      const data = await res.json()
      setProperties(data.properties || [])
    } catch (e) { console.error('Failed to fetch properties:', e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProperties() }, [user.role])

  async function saveProperty(prop) {
    try {
      const method = prop.id ? 'PUT' : 'POST'
      const endpoint = prop.id ? `/api/properties/${prop.id}` : '/api/properties'
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prop) })
      if (res.ok) await fetchProperties()
    } catch (e) { console.error('Failed to save property:', e) }
  }

  async function deleteProperty(id) {
    try {
      await fetch(`/api/properties/${id}`, { method: 'DELETE' })
      await fetchProperties()
    } catch (e) { console.error('Delete failed:', e) }
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
        onClose={() => setShowPropertyModal(false)}
        onSave={async (p) => { await saveProperty(p) }}
      />

      {loading && <p className="text-base-content/40 text-sm">Loading…</p>}

      {!loading && properties.length === 0 && (
        <div className="py-16 text-center text-base-content/30">
          <p className="text-lg">No properties yet</p>
          {user.role === 'admin' && <p className="text-sm mt-1">Click &quot;+ New Property&quot; to add one</p>}
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((prop, i) => (
          <div key={i}
            className="card bg-base-100 border border-base-300 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => { setSelectedProperty(prop); if (user.role === 'admin') setShowPropertyModal(true) }}>
            <div className="card-body gap-3 p-6">
              <h2 className="text-base font-semibold leading-snug">{prop.address}</h2>
              <div className="space-y-1">
                <p className="text-sm text-base-content/60">{prop.county} County</p>
                <p className="text-xs text-base-content/40 font-mono">PIN: {prop.pin}</p>
              </div>
              {user.role === 'admin' && (
                <div className="card-actions pt-2 border-t border-base-200 mt-1">
                  <button className="btn btn-xs btn-ghost" onClick={e => { e.stopPropagation(); setSelectedProperty(prop); setShowPropertyModal(true) }}>Edit</button>
                  <button className="btn btn-xs btn-ghost text-error" onClick={e => { e.stopPropagation(); deleteProperty(prop.id) }}>Delete</button>
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
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')

  async function saveProfile(e) {
    e.preventDefault()
    setLoading(true); setMsg('')
    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, organization, phone_number: phoneNumber, buy_box: buyBox })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsgType('error'); setMsg(data.error || 'Save failed'); return }
      setMsgType('success'); setMsg('Profile saved successfully')
      onUpdate({ ...currentUser, first_name: firstName, last_name: lastName, organization, phone_number: phoneNumber, buy_box: buyBox })
    } catch { setMsgType('error'); setMsg('Network error') }
    finally { setLoading(false); setTimeout(() => setMsg(''), 4000) }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-8" style={{ fontFamily: "'Playfair Display', serif" }}>My Profile</h2>
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-8 space-y-6">
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
            <button className="btn btn-primary w-full" type="submit" disabled={loading} onClick={saveProfile}>
              {loading ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
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

  function logout() { setCurrentUser(null); setPage('login'); setEmail(''); setPassword('') }

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
  const navBtn = (id, label) => (
    <button
      key={id}
      className={`btn btn-sm ${page === id ? 'btn-primary' : 'btn-ghost'}`}
      onClick={() => setPage(id)}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <nav className="navbar bg-base-100 border-b border-base-300 sticky top-0 z-50 px-6 gap-4">
        <div className="flex-none">
          <Logo />
        </div>
        <div className="flex-1 flex gap-1 ml-4">
          {navBtn('dashboard', 'Dashboard')}
          {navBtn('properties', 'Properties')}
          {currentUser.role === 'admin' && navBtn('users', 'Users')}
          {currentUser.role === 'admin' && navBtn('audit', 'Audit Logs')}
        </div>
        <div className="flex-none flex items-center gap-3">
          <button
            className={`btn btn-sm ${page === 'profile' ? 'btn-primary' : 'btn-ghost'} max-w-[200px] truncate`}
            onClick={() => setPage('profile')}
          >
            {currentUser.email}
          </button>
          <button className="btn btn-sm btn-outline" onClick={logout}>Sign Out</button>
        </div>
      </nav>

      {/* Main content */}
      <main className="container mx-auto px-6 py-10 max-w-6xl">

        {page === 'dashboard' && (
          <div className="text-center py-16">
            <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
              Welcome back
            </h1>
            <p className="text-base-content/50 text-lg mb-2">{currentUser.email}</p>
            <span className="badge badge-primary mb-8">{currentUser.role}</span>
            <div className="flex justify-center gap-4 mt-6">
              <button className="btn btn-primary" onClick={() => setPage('properties')}>View Properties</button>
              {currentUser.role === 'admin' && <button className="btn btn-outline" onClick={() => setPage('users')}>Manage Users</button>}
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

      </main>

      <Modal {...modal} />
    </div>
  )
}
