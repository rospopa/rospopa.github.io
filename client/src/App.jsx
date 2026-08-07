import { useEffect, useState, useRef, Component } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix default Leaflet marker icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

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

/* ─── Property Map (OpenStreetMap / Leaflet) ───────────────────── */

function MapRecenter({ lat, lon }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lon], 14) }, [lat, lon])
  return null
}

function PropertyMap({ address }) {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(false)
  const prevAddress = useRef(null)

  useEffect(() => {
    if (!address || address === prevAddress.current) return
    prevAddress.current = address
    setCoords(null); setError(false)
    const encoded = encodeURIComponent(address)
    fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'CREPortal/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) {
          setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
  }, [address])

  if (!address) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200 text-base-content/30 text-sm">
      Enter an address to see the map
    </div>
  )
  if (error) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200 text-base-content/30 text-sm">
      Location not found
    </div>
  )
  if (!coords) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200">
      <span className="loading loading-spinner loading-md" />
    </div>
  )

  return (
    <MapContainer center={[coords.lat, coords.lon]} zoom={14}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={true}
      zoomControl={true}
      attributionControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapRecenter lat={coords.lat} lon={coords.lon} />
      <Marker position={[coords.lat, coords.lon]}>
        <Popup>{address}</Popup>
      </Marker>
    </MapContainer>
  )
}


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

/** Text input that displays numbers with comma formatting; stores raw digits in state */
function NumericInput({ value, onChange, placeholder, className, disabled, allowDecimal, style }) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (value === '' || value === null || value === undefined) { setDisplay(''); return }
    const num = allowDecimal ? parseFloat(value) : parseInt(value, 10)
    if (!isNaN(num)) setDisplay(num.toLocaleString('en-US', allowDecimal ? { maximumFractionDigits: 4 } : {}))
    else setDisplay(String(value))
  }, [value])

  function handleChange(e) {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || raw === '-') { setDisplay(raw); onChange(''); return }
    const num = allowDecimal ? parseFloat(raw) : parseInt(raw, 10)
    if (!isNaN(num)) {
      setDisplay(raw) // keep raw while typing so cursor stays natural
      onChange(raw)
    } else if (/^[\d.]*$/.test(raw)) {
      setDisplay(raw); onChange(raw)
    }
  }

  function handleBlur() {
    if (value === '' || value === null || value === undefined) { setDisplay(''); return }
    const num = allowDecimal ? parseFloat(value) : parseInt(value, 10)
    if (!isNaN(num)) setDisplay(num.toLocaleString('en-US', allowDecimal ? { maximumFractionDigits: 4 } : {}))
  }

  function handleFocus() {
    // Show plain number while editing
    setDisplay(value !== '' && value !== null && value !== undefined ? String(value) : '')
  }

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={className}
      style={style}
      disabled={disabled}
    />
  )
}

/* ─── Save sound ──────────────────────────────────────────────── */
function playSaveSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // Short soft chime: two sine tones fading out
    const notes = [523.25, 659.25] // C5, E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07)
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.07)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.07 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.35)
      osc.start(ctx.currentTime + i * 0.07)
      osc.stop(ctx.currentTime + i * 0.07 + 0.35)
    })
    setTimeout(() => ctx.close(), 800)
  } catch {}
}

/** Primary save button that flashes green + plays a chime on success.
 *  Pass savedSignal (a counter) — increment it after each successful save to trigger the effect. */
function SaveButton({ onClick, disabled, loading, label = 'Save Changes', loadingLabel = 'Saving…', className = 'w-full', type = 'button', savedSignal = 0 }) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (savedSignal === 0) return
    setSaved(true)
    playSaveSound()
    const t = setTimeout(() => setSaved(false), 1800)
    return () => clearTimeout(t)
  }, [savedSignal])

  return (
    <button
      type={type}
      className={`btn ${saved ? 'btn-save-success' : 'btn-primary'} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? loadingLabel : saved ? '✓ Saved' : label}
    </button>
  )
}

/* ─── Property Card Carousel ──────────────────────────────────── */

function PropertyCardCarousel({ propertyId, onClick }) {
  const [media, setMedia] = useState([])
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/properties/${propertyId}/media`, { credentials: 'include' })
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

function PropertyModalCarousel({ propertyId }) {
  const [media, setMedia] = useState([])
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/properties/${propertyId}/media`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setMedia(d.media || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [propertyId])

  if (!propertyId) return null
  if (!loaded) return <div className="w-full h-64 bg-base-200 animate-pulse rounded-lg mb-4" />
  if (media.length === 0) return (
    <div className="w-full h-40 bg-base-200 rounded-lg flex items-center justify-center mb-4">
      <span className="text-xs text-base-content/30 uppercase tracking-widest">No media uploaded</span>
    </div>
  )

  const current = media[idx]
  const isVideo = current.media_type?.startsWith('video')
  const prev = () => setIdx(i => (i - 1 + media.length) % media.length)
  const next = () => setIdx(i => (i + 1) % media.length)

  return (
    <>
      {/* Main image */}
      <div className="relative w-full h-64 md:h-80 bg-black rounded-lg overflow-hidden mb-3 group">
        {isVideo
          ? <video key={current.id}
              src={`/api/properties/${propertyId}/media/${current.id}`}
              className="w-full h-full object-contain"
              controls
            />
          : <img key={current.id}
              src={`/api/properties/${propertyId}/media/${current.id}`}
              alt={current.filename}
              className="w-full h-full object-contain transition-opacity duration-200"
            />
        }

        {/* Nav arrows */}
        {media.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 btn btn-sm btn-circle bg-black/60 border-0 text-white"
              onClick={prev}
            >‹</button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-circle bg-black/60 border-0 text-white"
              onClick={next}
            >›</button>
          </>
        )}

        {/* Counter */}
        <div className="absolute bottom-2 right-3 text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-full">
          {idx + 1} / {media.length}
        </div>
      </div>

      {/* Thumbnail strip */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {media.map((m, i) => {
            const isVid = m.media_type?.startsWith('video')
            return (
              <button
                key={m.id}
                onClick={() => setIdx(i)}
                className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors ${i === idx ? 'border-primary' : 'border-transparent'}`}
              >
                {isVid
                  ? <div className="w-full h-full bg-base-300 flex items-center justify-center text-xl">▶</div>
                  : <img src={`/api/properties/${propertyId}/media/${m.id}`} alt="" className="w-full h-full object-cover" />
                }
              </button>
            )
          })}
        </div>
      )}

    </>
  )
}

/* ─── Logo ────────────────────────────────────────────────────── */

function RecaptchaShield({ status }) {
  // status: null | 'verifying' | 'success' | 'denied'
  const r = 22, circ = 2 * Math.PI * r
  const ringColor = status === 'success' ? '#22c55e' : status === 'denied' ? '#ef4444' : '#9ca3af'
  const iconColor = status === 'success' ? '#22c55e' : status === 'denied' ? '#ef4444' : '#9ca3af'
  const label = status === 'verifying' ? 'Verifying…' : status === 'success' ? 'Verified' : status === 'denied' ? 'Denied' : 'Protected by reCAPTCHA'

  return (
    <div className="flex flex-col items-center gap-1 select-none" aria-live="polite">
      <div className="relative w-14 h-14 flex items-center justify-center">
        {/* Spinning progress ring */}
        <svg className="absolute inset-0 w-14 h-14" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="28" cy="28" r={r} fill="none" stroke={status ? ringColor + '33' : '#0001'} strokeWidth="3" />
          {status === 'verifying' && (
            <circle cx="28" cy="28" r={r} fill="none" stroke={ringColor} strokeWidth="3"
              strokeDasharray={circ} strokeDashoffset={circ * 0.7}
              strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 28 28" to="360 28 28" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
          {(status === 'success' || status === 'denied') && (
            <circle cx="28" cy="28" r={r} fill="none" stroke={ringColor} strokeWidth="3"
              strokeDasharray={circ} strokeDashoffset="0" strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          )}
          {!status && (
            <circle cx="28" cy="28" r={r} fill="none" stroke="#9ca3af55" strokeWidth="2"
              strokeDasharray="3 4" />
          )}
        </svg>

        {/* Shield icon */}
        <svg viewBox="0 0 24 24" className="w-7 h-7 relative z-10" fill={iconColor}
          style={{ transition: 'fill 0.3s ease' }}>
          {status === 'success' ? (
            // Shield with checkmark
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 13l-3-3 1.41-1.41L10 11.17l5.59-5.58L17 7l-7 7z" />
          ) : status === 'denied' ? (
            // Shield with X
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm3 13l-1.41 1.41L12 14l-1.59 1.41L9 14l1.41-1.41L9 11l1.41-1.41L12 11l1.59-1.41L15 11l-1.41 1.41L15 14z" />
          ) : (
            // Plain shield
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          )}
        </svg>
      </div>
      <span className="text-xs" style={{ color: ringColor, transition: 'color 0.3s ease' }}>
        {label}
      </span>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-sm flex items-center justify-center">
        <img src="/apple-touch-icon.png" alt="Logo" className="w-9 h-9 object-contain" />
      </div>
      <div className="flex flex-col leading-none gap-0.5">
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 800,
          fontSize: '1.1rem',
          letterSpacing: '0.08em',
          color: '#111111',
        }}>
          ROSPOPA
        </span>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600,
          fontSize: '0.7rem',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          opacity: 0.45,
        }}>
          PAVLO
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
      {msg && <div className={`alert ${msgType === 'error' ? 'alert-error' : 'alert-success'} text-sm`}>{msg}</div>}
      <button className="btn btn-primary w-full" type="submit" disabled={loading || !photo}>
        {loading ? 'Creating…' : 'Create User'}
      </button>
    </form>
  )
}

/* ─── Audit Logs ──────────────────────────────────────────────── */

const ACTION_LABELS = {
  register:           (d, t) => `New account registered (${t || d?.email || ''})`,
  login:              ()     => `Signed in`,
  login_failed:       (d, t) => `Failed sign-in attempt for ${t || d?.email || 'unknown email'}`,
  recaptcha_failed:   (d)    => `Security check failed (score: ${d?.score ?? '?'}, reason: ${d?.reason || '?'})`,
  logout:             ()     => `Signed out`,
  forgot_password:    (d, t) => `Password reset requested for ${t || d?.email || ''}`,
  password_reset:     (d, t) => `Password successfully reset for ${t || d?.email || ''}`,
  create_user:        (d, t) => `Created user ${t || ''} with role "${d?.role || 'user'}"`,
  edit_user:          (d, t) => {
    const fields = d?.changed_fields
    if (!fields?.length) return `Updated profile of ${t || 'user'}`
    const USER_FIELD_LABELS = { first_name: 'First Name', last_name: 'Last Name', organization: 'Organization', phone_number: 'Phone', buy_box: 'Buy Box', role: 'Role' }
    return `Updated profile of ${t || 'user'} — ${fields.map(f => USER_FIELD_LABELS[f] || f).join(', ')}`
  },
  delete_user:        (d, t) => `Deleted user ${t || ''}`,
  role_change:        (d, t) => `Changed role of ${t || 'user'} from "${d?.from}" to "${d?.to}"`,
  create_property:    (d)    => `Added property — ${d?.address || ''} (PIN: ${d?.pin || ''}, ${d?.county || ''})`,
  edit_property:      (d)    => `Edited property — ${d?.address || `ID ${d?.property_id || ''}`}${d?.changed_fields?.length ? ` — ${d.changed_fields.length} field(s) changed` : ''}`,
  delete_property:    (d)    => `Deleted property — ${d?.address || ''} (PIN: ${d?.pin || ''}, ID ${d?.property_id || ''})`,
  assign_property:    (d)    => `Assigned property ID ${d?.property_id || ''} to ${d?.user_count || 0} user(s)`,
  unassign_property:  (d)    => `Removed access to property ID ${d?.property_id || ''} from user ID ${d?.user_id || ''}`,
  upload_media:       (d)    => `Uploaded photo "${d?.filename || ''}" to property ID ${d?.property_id || ''}`,
  delete_media:       (d)    => `Deleted photo "${d?.media_id || ''}" from property ID ${d?.property_id || ''}`,
  upload_document:    (d)    => `Uploaded document "${d?.filename || ''}" to property ID ${d?.property_id || ''}`,
  delete_document:    (d)    => `Deleted document from property ID ${d?.property_id || ''}`,
  add_contact_note:   (d, t) => `Added note on contact ${d?.contact_name || t || `#${d?.user_id || ''}`}${d?.attachment_count ? ` + ${d.attachment_count} attachment(s)` : ''}`,
  delete_contact_note:(d, t) => `Deleted note on contact ${d?.contact_name || t || ''}`,
  edit_user_buybox:   (d, t) => `Updated Buy Box for ${t || `user #${d?.user_id || ''}`}`,
}

function formatLog(log) {
  let details = {}
  try { details = JSON.parse(log.details || '{}') } catch {}
  const fn = ACTION_LABELS[log.action]
  const text = fn ? fn(details, log.target_email) : log.action
  return text
}

function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [perPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  async function fetchLogs(pg = page) {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/audit-logs?q=${encodeURIComponent(q)}&limit=${perPage}&offset=${(pg - 1) * perPage}`)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (e) { console.error('Fetch logs failed:', e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs() }, [page])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search by email or action…" value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchLogs(1))}
          className="input input-bordered flex-1 min-w-0" />
        <button className="btn btn-primary" onClick={() => { setPage(1); fetchLogs(1) }}>Search</button>
      </div>

      {loading && <div className="flex justify-center py-6"><span className="loading loading-spinner" /></div>}

      {!loading && (
        <div className="space-y-1">
          {logs.length === 0
            ? <p className="text-center py-8 text-base-content/40">No activity found</p>
            : logs.map((log) => {
                let details = {}
                try { details = JSON.parse(log.details || '{}') } catch {}
                const actor = log.acted_by_email || log.target_email || '(system)'
                const text = formatLog(log)
                const ts = new Date(log.created_at).toLocaleString()
                const ip = log.ip_address
                let logDetails = {}
                try { logDetails = JSON.parse(log.details || '{}') } catch {}
                const changes = logDetails.changes || null
                const notePreview = logDetails.note_preview || null
                const filenames = logDetails.filenames || []

                const FIELD_LABELS = {
                  pin: 'PIN', address: 'Address', county: 'County',
                  price: 'Price ($)', square_feet: 'Square Feet', lot_size: 'Lot Size (ac)',
                  year_built: 'Year Built', on_major_road: 'On Major Road', traffic_vpd: 'Traffic VPD',
                  on_corner_lot: 'Corner Lot', direct_water_access: 'Direct Water Access',
                  next_to_public_land: 'Next to Public Land', major_interstates: 'Major Interstates',
                  household_income_min: 'Income Min ($)', household_income_max: 'Income Max ($)',
                  population_density: 'Population Density', logistics_hubs: 'Logistics Hubs',
                  landmarks: 'Landmarks', water_sources: 'Water Sources', military_bases: 'Military Bases',
                  first_name: 'First Name', last_name: 'Last Name', organization: 'Organization',
                  phone_number: 'Phone', buy_box: 'Buy Box', role: 'Role',
                  asset_type: 'Asset Type', grm: 'GRM', cap_rate: 'Cap Rate (%)', cash_on_cash: 'Cash-on-Cash (%)',
                  irr: 'IRR (%)', price_per_unit: 'Price/Unit ($)', price_per_sqft: 'Price/SqFt ($)',
                  rent_to_sales_ratio: 'Rent-to-Sales Ratio (%)', num_skus: '# SKUs',
                  price_per_acre: 'Price/Acre ($)', electrical_voltage: 'Voltage (V)', electrical_amperage: 'Amperage (A)',
                  gross_scheduled_rent: 'Gross Scheduled Rent ($)', vacancy_rate: 'Vacancy/Credit Loss (%)',
                  other_income: 'Other Income ($)', operating_expenses: 'Operating Expenses ($)',
                  reserves_capex: 'Reserves/Capex ($)',
                  loan_amount: 'Loan Amount ($)', ltv: 'LTV (%)', interest_rate: 'Interest Rate (%)',
                  amortization_term: 'Amortization Term (yrs)', interest_only_period: 'Interest-Only Period (yrs)',
                  unit_count: 'Unit / Bay / Suite Count', closing_costs: 'Closing Costs ($)',
                  hold_period: 'Hold Period (yrs)', rent_growth: 'Rent Growth (%)',
                  expense_growth: 'Expense Growth (%)', exit_cap_rate: 'Exit Cap Rate (%)',
                  cost_of_sale: 'Cost of Sale (%)',
                  tenant_gross_sales: 'Tenant Annual Gross Sales ($)', tenant_base_rent: 'Tenant Base Rent ($)',
                  management_fee_pct: 'Management Fee (%)', insurance: 'Insurance ($/yr)',
                  property_taxes: 'Property Taxes ($/yr)', land_value_pct: 'Land Value (%)',
                  cost_seg_bonus_pct: 'Cost Seg Bonus (%)', effective_tax_rate: 'Effective Tax Rate (%)',
                  depreciation_recapture_rate: 'Depreciation Recapture Rate (%)',
                  refi_ltv: 'Refi LTV (%)', refi_rate: 'Refi Interest Rate (%)', refi_year: 'Refi Year',
                }
                function fmtVal(v) {
                  if (v === null || v === undefined || v === '') return null
                  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
                  if (Array.isArray(v)) {
                    if (v.length === 0) return null
                    return v.map(item => item.name ? `${item.name}${item.distance ? ` (${item.distance}mi)` : ''}` : JSON.stringify(item)).join(', ')
                  }
                  const n = Number(v)
                  if (!isNaN(n) && v !== '' && ['price','square_feet','traffic_vpd','household_income_min','household_income_max','population_density'].some(f => changes && changes[Object.keys(changes).find(k => k === f)] !== undefined))
                    return n.toLocaleString()
                  return String(v)
                }

                return (
                  <div key={log.id} className="flex gap-3 items-start py-2.5 px-4 rounded-lg hover:bg-base-200 border-b border-base-300/50">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${log.action === 'login_failed' ? 'bg-error' : log.action === 'login' || log.action === 'logout' ? 'bg-success' : 'bg-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm break-all">{actor}</span>
                      <span className="text-base-content/70 text-sm"> — {text}</span>
                      {ip && <span className="text-xs text-base-content/30 ml-1">· {ip}</span>}
                      <div className="text-xs text-base-content/40 mt-0.5 md:hidden">{ts}</div>
                      {/* Note preview */}
                      {notePreview && (
                        <div className="mt-1 text-xs bg-base-300/50 rounded px-2 py-1 text-base-content/70 italic">
                          "{notePreview}"
                        </div>
                      )}
                      {/* Attachment filenames */}
                      {filenames.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {filenames.map((f, i) => (
                            <span key={i} className="text-[10px] bg-base-300/60 rounded px-1.5 py-0.5 font-mono">{f}</span>
                          ))}
                        </div>
                      )}
                      {/* Field diff (properties + user fields) */}
                      {changes && Object.keys(changes).length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {Object.entries(changes).map(([field, { from, to }]) => {
                            const fromStr = fmtVal(from)
                            const toStr = fmtVal(to)
                            return (
                              <div key={field} className="text-xs font-mono bg-base-300/50 rounded px-2 py-0.5 flex flex-wrap gap-x-2 items-center">
                                <span className="font-semibold text-base-content/70 not-italic font-sans">{FIELD_LABELS[field] || field}:</span>
                                {fromStr ? <span className="text-error/80 line-through">{fromStr}</span> : <em className="text-base-content/30">empty</em>}
                                <span className="text-base-content/40">→</span>
                                {toStr ? <span className="text-success/80">{toStr}</span> : <em className="text-base-content/30">empty</em>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <span className="hidden md:block text-xs text-base-content/40 flex-shrink-0 mt-0.5 whitespace-nowrap">{ts}</span>
                  </div>
                )
              })
          }
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
        <span className="text-xs text-base-content/40">{total} total events</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-xs btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>← Prev</button>
          <span className="text-xs text-base-content/60">Page {page} of {totalPages}</span>
          <button className="btn btn-xs btn-ghost" onClick={() => setPage(p => { const np = Math.min(totalPages, p + 1); fetchLogs(np); return np })} disabled={page >= totalPages || loading}>Next →</button>
        </div>
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

function UsersTable({ users, onReload, onEdit }) {
  const [query, setQuery] = useState('')
  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [onlineStatus, setOnlineStatus] = useState({ online: [], lastLogin: {} })

  async function fetchUsers() {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/users?q=${encodeURIComponent(query)}&perPage=${perPage}&page=${page}`)
      if (data.users) onReload(data.users)
    } catch (e) { console.error('Fetch failed:', e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    apiFetch('/api/online-status').then(d => setOnlineStatus(d)).catch(() => {})
    const t = setInterval(() => apiFetch('/api/online-status').then(d => setOnlineStatus(d)).catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [])

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
                  <td className="py-3 px-4">
                    <span className="badge badge-primary badge-sm">{u.role}</span>
                  </td>
                  <td className="py-3 px-4">{u.organization || <span className="text-base-content/30">—</span>}</td>
                  <td className="py-3 px-4">{u.phone_number || <span className="text-base-content/30">—</span>}</td>
                  <td className="py-3 px-4 text-xs">
                    <span className={isOnline ? 'text-green-600 font-medium' : 'text-base-content/50'}>
                      {isOnline ? '● Online' : fmtLastLogin(lastLogin)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-base-content/50">{u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <button className="btn btn-xs btn-ghost" onClick={() => onEdit?.(u)}>Edit</button>
                  </td>
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

function AssignUsersTab({ allUsers, assignLoading, toggleAssign, onViewContact }) {
  const [assignSearch, setAssignSearch] = useState('')
  const aq = assignSearch.trim().toLowerCase()
  const visibleUsers = allUsers.filter(u =>
    !aq || [u.first_name, u.last_name, u.email, u.organization]
      .filter(Boolean).some(v => v.toLowerCase().includes(aq))
  )
  const assigned = visibleUsers.filter(u => !!u.assigned)
  const unassigned = visibleUsers.filter(u => !u.assigned)

  function UserRow({ u }) {
    const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
    const initials = [u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join('').toUpperCase() || u.email[0].toUpperCase()
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-base-300 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold">
          {u.profile_photo
            ? <img src={u.profile_photo} alt={displayName} className="w-full h-full object-cover" />
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <button
            className="text-sm font-medium text-left hover:underline hover:text-primary truncate block w-full"
            onClick={() => onViewContact(u.id)}
          >
            {displayName}
          </button>
          {u.organization && <p className="text-xs text-base-content/50 truncate">{u.organization}</p>}
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm flex-shrink-0"
          checked={!!u.assigned}
          disabled={assignLoading}
          onChange={() => toggleAssign(u.id, !!u.assigned)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search users…"
          value={assignSearch}
          onChange={e => setAssignSearch(e.target.value)}
          className="input input-bordered input-sm pl-8 w-full"
        />
        {assignSearch && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content" onClick={() => setAssignSearch('')}>✕</button>
        )}
      </div>
      {allUsers.length === 0
        ? <p className="text-center text-base-content/30 py-8">No users found</p>
        : visibleUsers.length === 0
          ? <p className="text-center text-base-content/30 py-4">No users match &ldquo;{assignSearch}&rdquo;</p>
          : (
            <div>
              {assigned.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-content/40 pb-1 border-b border-base-200 mb-1">
                    Assigned ({assigned.length})
                  </p>
                  <div className="divide-y divide-base-200">
                    {assigned.map(u => <UserRow key={u.id} u={u} />)}
                  </div>
                </>
              )}
              {unassigned.length > 0 && (
                <>
                  <p className={`text-xs font-semibold uppercase tracking-wide text-base-content/40 pb-1 border-b border-base-200 mb-1 ${assigned.length > 0 ? 'mt-4' : ''}`}>
                    All Users ({unassigned.length})
                  </p>
                  <div className="divide-y divide-base-200">
                    {unassigned.map(u => <UserRow key={u.id} u={u} />)}
                  </div>
                </>
              )}
            </div>
          )
      }
    </div>
  )
}

function PropertyDetailModal({ open, property, isAdmin, onClose, onSave, topOffset = 0 }) {
  const DCF_ROW_DEFS = [
    { key: 'grossRevenue', label: 'Gross Revenue', type: 'currency', category: 'income' },
    { key: 'vacancyCreditLoss', label: 'Vacancy / Credit Loss', type: 'currency', category: 'income' },
    { key: 'percentageRentDcf', label: 'Percentage Rent', type: 'currency', category: 'income' },
    { key: 'otherIncomeDcf', label: 'Other Income', type: 'currency', category: 'income' },
    { key: 'effectiveGrossIncome', label: 'Effective Gross Income', type: 'currency', category: 'formula', readOnly: true },
    { key: 'operatingExpensesDcf', label: 'Operating Expenses', type: 'currency', category: 'expense' },
    { key: 'managementFeesDcf', label: 'Management Fees', type: 'currency', category: 'expense' },
    { key: 'propertyTaxesDcf', label: 'Property Taxes', type: 'currency', category: 'expense' },
    { key: 'insuranceDcf', label: 'Insurance', type: 'currency', category: 'expense' },
    { key: 'reservesCapexDcf', label: 'Reserves / Replacement Reserve', type: 'currency', category: 'expense' },
    { key: 'netOperatingIncomeDcf', label: 'Net Operating Income', type: 'currency', category: 'formula', readOnly: true },
    { key: 'tenantImprovements', label: 'Tenant Improvements (TI)', type: 'currency', category: 'capital' },
    { key: 'leasingCommissions', label: 'Leasing Commissions (LC)', type: 'currency', category: 'capital' },
    { key: 'capitalExpenditures', label: 'Additional Capex', type: 'currency', category: 'capital' },
    { key: 'debtServiceDcf', label: 'Debt Service', type: 'currency', category: 'debt' },
    { key: 'loanBalanceDcf', label: 'Loan Balance', type: 'currency', category: 'debt', readOnly: true },
    { key: 'refinanceProceeds', label: 'Refinance Proceeds', type: 'currency', category: 'capital' },
    { key: 'refinanceCostsDcf', label: 'Refinance Costs', type: 'currency', category: 'capital' },
    { key: 'loanPayoffAtRefi', label: 'Loan Payoff at Refi', type: 'currency', category: 'capital', readOnly: true },
    { key: 'taxesDcf', label: 'Taxes', type: 'currency', category: 'tax' },
    { key: 'cashFlowBeforeSale', label: 'Cash Flow Before Sale', type: 'currency', category: 'formula', readOnly: true },
    { key: 'grossSaleProceedsDcf', label: 'Gross Sale Proceeds', type: 'currency', category: 'exit', readOnly: true },
    { key: 'saleCostsDcf', label: 'Sale Costs', type: 'currency', category: 'exit', readOnly: true },
    { key: 'loanPayoffAtSale', label: 'Loan Payoff at Sale', type: 'currency', category: 'exit', readOnly: true },
    { key: 'recaptureTaxDcf', label: 'Recapture Tax', type: 'currency', category: 'exit', readOnly: true },
    { key: 'saleProceedsDcf', label: 'Sale Proceeds', type: 'currency', category: 'exit' },
    { key: 'cashFlowAfterSale', label: 'Cash Flow After Sale', type: 'currency', category: 'formula', readOnly: true },
    { key: 'waterfallSponsor', label: 'Sponsor Waterfall', type: 'currency', category: 'waterfall' },
    { key: 'waterfallInvestor', label: 'Investor Waterfall', type: 'currency', category: 'waterfall' },
  ]
  const DCF_MAX_YEARS = 10
  const defaultDcfModel = () => ({
    years: Array.from({ length: DCF_MAX_YEARS }, (_, index) => {
      const year = index + 1
      return {
        year,
        grossRevenue: '',
        vacancyCreditLoss: '',
        percentageRentDcf: '',
        otherIncomeDcf: '',
        operatingExpensesDcf: '',
        managementFeesDcf: '',
        propertyTaxesDcf: '',
        insuranceDcf: '',
        reservesCapexDcf: '',
        tenantImprovements: '',
        leasingCommissions: '',
        capitalExpenditures: '',
        debtServiceDcf: '',
        loanBalanceDcf: '',
        refinanceProceeds: '',
        refinanceCostsDcf: '',
        loanPayoffAtRefi: '',
        taxesDcf: '',
        grossSaleProceedsDcf: '',
        saleCostsDcf: '',
        loanPayoffAtSale: '',
        recaptureTaxDcf: '',
        saleProceedsDcf: '',
        waterfallSponsor: '',
        waterfallInvestor: '',
      }
    })
  })
  function toTextNumber(value) {
    return value === null || value === undefined ? '' : String(value)
  }
  function normalizeYearDraft(year = {}, yearNumber) {
    return {
      year: yearNumber,
      grossRevenue: toTextNumber(year.grossRevenue),
      vacancyCreditLoss: toTextNumber(year.vacancyCreditLoss),
      percentageRentDcf: toTextNumber(year.percentageRentDcf),
      otherIncomeDcf: toTextNumber(year.otherIncomeDcf),
      operatingExpensesDcf: toTextNumber(year.operatingExpensesDcf),
      managementFeesDcf: toTextNumber(year.managementFeesDcf),
      propertyTaxesDcf: toTextNumber(year.propertyTaxesDcf),
      insuranceDcf: toTextNumber(year.insuranceDcf),
      reservesCapexDcf: toTextNumber(year.reservesCapexDcf),
      tenantImprovements: toTextNumber(year.tenantImprovements),
      leasingCommissions: toTextNumber(year.leasingCommissions),
      capitalExpenditures: toTextNumber(year.capitalExpenditures),
      debtServiceDcf: toTextNumber(year.debtServiceDcf),
      loanBalanceDcf: toTextNumber(year.loanBalanceDcf),
      refinanceProceeds: toTextNumber(year.refinanceProceeds),
      refinanceCostsDcf: toTextNumber(year.refinanceCostsDcf),
      loanPayoffAtRefi: toTextNumber(year.loanPayoffAtRefi),
      taxesDcf: toTextNumber(year.taxesDcf),
      grossSaleProceedsDcf: toTextNumber(year.grossSaleProceedsDcf),
      saleCostsDcf: toTextNumber(year.saleCostsDcf),
      loanPayoffAtSale: toTextNumber(year.loanPayoffAtSale),
      recaptureTaxDcf: toTextNumber(year.recaptureTaxDcf),
      saleProceedsDcf: toTextNumber(year.saleProceedsDcf),
      waterfallSponsor: toTextNumber(year.waterfallSponsor),
      waterfallInvestor: toTextNumber(year.waterfallInvestor),
    }
  }
  function formatMoneyCell(value) {
    if (value === null || value === undefined || value === '') return '—'
    const num = Number(value)
    if (!Number.isFinite(num)) return '—'
    return '$' + num.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }
  function parseNum(value) {
    if (value === '' || value === null || value === undefined) return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  function calculateIrr(cashFlows) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) return null
    const hasPositive = cashFlows.some(value => value > 0)
    const hasNegative = cashFlows.some(value => value < 0)
    if (!hasPositive || !hasNegative) return null
    let rate = 0.1
    for (let iteration = 0; iteration < 100; iteration += 1) {
      let npv = 0
      let derivative = 0
      for (let year = 0; year < cashFlows.length; year += 1) {
        const denom = Math.pow(1 + rate, year)
        npv += cashFlows[year] / denom
        if (year > 0) derivative -= year * cashFlows[year] / Math.pow(1 + rate, year + 1)
      }
      if (Math.abs(npv) < 0.0001) return rate
      if (!Number.isFinite(derivative) || Math.abs(derivative) < 0.0000001) break
      const nextRate = rate - (npv / derivative)
      if (!Number.isFinite(nextRate) || nextRate <= -0.9999 || nextRate > 1000) break
      if (Math.abs(nextRate - rate) < 0.0000001) return nextRate
      rate = nextRate
    }

    let low = -0.9999
    let high = 10
    const npvAt = (discountRate) => cashFlows.reduce((sum, value, year) => sum + (value / Math.pow(1 + discountRate, year)), 0)
    let lowNpv = npvAt(low)
    let highNpv = npvAt(high)
    if (!Number.isFinite(lowNpv) || !Number.isFinite(highNpv) || lowNpv * highNpv > 0) return null
    for (let iteration = 0; iteration < 200; iteration += 1) {
      const mid = (low + high) / 2
      const midNpv = npvAt(mid)
      if (!Number.isFinite(midNpv)) return null
      if (Math.abs(midNpv) < 0.0001) return mid
      if (lowNpv * midNpv <= 0) {
        high = mid
        highNpv = midNpv
      } else {
        low = mid
        lowNpv = midNpv
      }
    }
    return (low + high) / 2
  }
  function paymentForLoan(principal, annualRate, amortYears) {
    if (!principal || principal <= 0) return 0
    const rate = annualRate / 100 / 12
    const months = amortYears * 12
    if (!months) return 0
    if (rate === 0) return principal / months
    return principal * rate / (1 - Math.pow(1 + rate, -months))
  }
  function endingLoanBalance(principal, annualRate, amortYears, monthsElapsed) {
    if (!principal || principal <= 0) return 0
    const months = Math.max(0, Math.round(monthsElapsed))
    const totalMonths = amortYears * 12
    if (!totalMonths) return 0
    const rate = annualRate / 100 / 12
    if (rate === 0) return Math.max(0, principal - (principal / totalMonths) * months)
    if (months <= 0) return principal
    return Math.max(0, principal * (Math.pow(1 + rate, totalMonths) - Math.pow(1 + rate, months)) / (Math.pow(1 + rate, totalMonths) - 1))
  }
  function buildDefaultDcfModelFromProperty(prop = {}) {
    const model = defaultDcfModel()
    const hold = Math.min(DCF_MAX_YEARS, Math.max(1, Number(prop.hold_period || 1)))
    const rentGrowthPct = Number(prop.rent_growth || 0) / 100
    const expenseGrowthPct = Number(prop.expense_growth || 0) / 100
    const grossRentBase = Number(prop.gross_scheduled_rent || 0)
    const vacancyPct = Number(prop.vacancy_rate || 0) / 100
    const otherIncomeBase = Number(prop.other_income || 0)
    const operatingExpensesBase = Number(prop.operating_expenses || 0)
    const reservesBase = Number(prop.reserves_capex || 0)
    const propertyTaxesBase = Number(prop.property_taxes || 0)
    const insuranceBase = Number(prop.insurance || 0)
    const managementFeePct = Number(prop.management_fee_pct || 0) / 100
    const effectiveTaxRatePct = Number(prop.effective_tax_rate || 0) / 100
    const loanAmt = Number(prop.loan_amount || 0)
    const interestRatePct = Number(prop.interest_rate || 0)
    const amortYears = Number(prop.amortization_term || 0)
    const ioYears = Math.max(0, Number(prop.interest_only_period || 0))
    const exitCapPct = Number(prop.exit_cap_rate || 0) / 100
    const costOfSalePct = Number(prop.cost_of_sale || 0) / 100
    const refiYearValue = Number(prop.refi_year || 0)
    const refiLtvPct = Number(prop.refi_ltv || 0) / 100
    const refiRatePct = Number(prop.refi_rate || 0)
    const recaptureRatePct = Number(prop.depreciation_recapture_rate || 0) / 100
    const rentToSalesPct = Number(prop.rent_to_sales_ratio || 0) / 100
    const tenantSalesBase = Number(prop.tenant_gross_sales || 0)
    const tenantBaseRentBase = Number(prop.tenant_base_rent || 0)
    const depBasis = Number(prop.price || 0) * (1 - Number(prop.land_value_pct || 0) / 100)
    let currentLoanPrincipal = loanAmt
    let currentLoanRate = interestRatePct
    let currentLoanAmortYears = amortYears
    let currentLoanStartMonth = 0

    for (let index = 0; index < DCF_MAX_YEARS; index += 1) {
      const year = index + 1
      const rentGrowthFactor = Math.pow(1 + rentGrowthPct, index)
      const expenseGrowthFactor = Math.pow(1 + expenseGrowthPct, index)
      const grossRevenue = grossRentBase * rentGrowthFactor
      const vacancyLoss = grossRevenue * vacancyPct
      const tenantSalesYear = tenantSalesBase * rentGrowthFactor
      const baseRentYear = tenantBaseRentBase * rentGrowthFactor
      const percentageRent = Math.max(0, tenantSalesYear * rentToSalesPct - baseRentYear)
      const otherIncome = otherIncomeBase * rentGrowthFactor
      const effectiveGrossIncome = grossRevenue - vacancyLoss + percentageRent + otherIncome
      const operatingExpensesYear = operatingExpensesBase * expenseGrowthFactor
      const managementFees = effectiveGrossIncome * managementFeePct
      const propertyTaxesYear = propertyTaxesBase * expenseGrowthFactor
      const insuranceYear = insuranceBase * expenseGrowthFactor
      const reservesYear = reservesBase * expenseGrowthFactor
      const noi = effectiveGrossIncome - operatingExpensesYear - managementFees - propertyTaxesYear - insuranceYear - reservesYear
      const taxesYear = Math.max(0, noi) * effectiveTaxRatePct
      const monthsElapsed = year * 12
      const monthsSinceLoanStart = monthsElapsed - currentLoanStartMonth
      const inIoPeriod = monthsSinceLoanStart > 0 && monthsSinceLoanStart <= ioYears * 12 && currentLoanPrincipal > 0
      const annualDebtService = currentLoanPrincipal > 0
        ? (inIoPeriod
          ? currentLoanPrincipal * (currentLoanRate / 100)
          : paymentForLoan(currentLoanPrincipal, currentLoanRate, currentLoanAmortYears) * 12)
        : 0
      const loanBalance = currentLoanPrincipal > 0
        ? (inIoPeriod
          ? currentLoanPrincipal
          : endingLoanBalance(currentLoanPrincipal, currentLoanRate, currentLoanAmortYears, monthsSinceLoanStart))
        : 0
      const stabilizedValue = exitCapPct > 0 ? Math.max(0, noi) / exitCapPct : 0
      const refiGrossProceeds = refiYearValue === year && refiLtvPct > 0 ? stabilizedValue * refiLtvPct : 0
      const refinanceCosts = refiGrossProceeds > 0 ? refiGrossProceeds * 0.01 : 0
      const loanPayoffAtRefi = refiGrossProceeds > 0 ? loanBalance : 0
      const refinanceProceeds = Math.max(0, refiGrossProceeds - refinanceCosts - loanPayoffAtRefi)
      if (refiGrossProceeds > 0) {
        currentLoanPrincipal = refiGrossProceeds
        currentLoanRate = refiRatePct > 0 ? refiRatePct : currentLoanRate
        currentLoanAmortYears = amortYears || currentLoanAmortYears
        currentLoanStartMonth = monthsElapsed
      }
      const grossSaleProceeds = year === hold ? stabilizedValue : 0
      const saleCosts = grossSaleProceeds > 0 ? grossSaleProceeds * costOfSalePct : 0
      const loanPayoffAtSale = grossSaleProceeds > 0
        ? endingLoanBalance(currentLoanPrincipal, currentLoanRate, currentLoanAmortYears, monthsElapsed - currentLoanStartMonth)
        : 0
      const recaptureTax = grossSaleProceeds > 0 ? depBasis * recaptureRatePct : 0
      const saleProceeds = Math.max(0, grossSaleProceeds - saleCosts - loanPayoffAtSale - recaptureTax)
      model.years[index] = normalizeYearDraft({
        year,
        grossRevenue: Math.round(grossRevenue),
        vacancyCreditLoss: Math.round(vacancyLoss),
        percentageRentDcf: Math.round(percentageRent),
        otherIncomeDcf: Math.round(otherIncome),
        operatingExpensesDcf: Math.round(operatingExpensesYear),
        managementFeesDcf: Math.round(managementFees),
        propertyTaxesDcf: Math.round(propertyTaxesYear),
        insuranceDcf: Math.round(insuranceYear),
        reservesCapexDcf: Math.round(reservesYear),
        debtServiceDcf: Math.round(annualDebtService),
        loanBalanceDcf: Math.round(loanBalance),
        refinanceProceeds: Math.round(refinanceProceeds),
        refinanceCostsDcf: Math.round(refinanceCosts),
        loanPayoffAtRefi: Math.round(loanPayoffAtRefi),
        taxesDcf: Math.round(taxesYear),
        grossSaleProceedsDcf: Math.round(grossSaleProceeds),
        saleCostsDcf: Math.round(saleCosts),
        loanPayoffAtSale: Math.round(loanPayoffAtSale),
        recaptureTaxDcf: Math.round(recaptureTax),
        saleProceedsDcf: Math.round(saleProceeds),
      }, year)
    }
    return model
  }
  function hydrateDcfModel(rawModel, prop = {}) {
    const base = rawModel && typeof rawModel === 'object' && !Array.isArray(rawModel) ? rawModel : {}
    const incomingYears = Array.isArray(base.years) ? base.years : []
    const fallback = buildDefaultDcfModelFromProperty(prop)
    return {
      years: Array.from({ length: DCF_MAX_YEARS }, (_, index) => {
        const yearNumber = index + 1
        const source = incomingYears[index] || fallback.years[index] || {}
        return normalizeYearDraft(source, yearNumber)
      })
    }
  }
  const [tab, setTab] = useState('details')
  const [pin, setPin] = useState('')
  const [address, setAddress] = useState('')
  const [county, setCounty] = useState('')
  const [price, setPrice] = useState('')
  const [sqft, setSqft] = useState('')
  const [lot, setLot] = useState('')
  const [yearBuilt, setYearBuilt] = useState('')
  const [onMajorRoad, setOnMajorRoad] = useState(false)
  const [trafficVpd, setTrafficVpd] = useState('')
  const [onCornerLot, setOnCornerLot] = useState(false)
  const [waterAccess, setWaterAccess] = useState(false)
  const [nextToPublicLand, setNextToPublicLand] = useState(false)
  const [interstates, setInterstates] = useState([]) // [{name, distance}]
  const [logisticsHubs, setLogisticsHubs] = useState([]) // [{type, name, distance}]
  const [landmarksList, setLandmarksList] = useState([]) // [{type, name, distance}]
  const [waterSources, setWaterSources] = useState([]) // [{name, distance}]
  const [militaryBases, setMilitaryBases] = useState([]) // [{name, distance}]
  const [incomeMin, setIncomeMin] = useState('')
  const [incomeMax, setIncomeMax] = useState('')
  const [popDensity, setPopDensity] = useState('')
  const [propStatus, setPropStatus] = useState('New')
  const [grm, setGrm] = useState('')
  const [capRate, setCapRate] = useState('')
  const [cashOnCash, setCashOnCash] = useState('')
  const [irr, setIrr] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [pricePerSqft, setPricePerSqft] = useState('')
  const [rentToSales, setRentToSales] = useState('')
  const [numSkus, setNumSkus] = useState('')
  const [pricePerAcre, setPricePerAcre] = useState('')
  const [elecVoltage, setElecVoltage] = useState('')
  const [elecAmperage, setElecAmperage] = useState('')
  const [assetType, setAssetType] = useState('')
  // Income block
  const [grossScheduledRent, setGrossScheduledRent] = useState('')
  const [vacancyRate, setVacancyRate] = useState('')
  const [otherIncome, setOtherIncome] = useState('')
  const [operatingExpenses, setOperatingExpenses] = useState('')
  const [reservesCapex, setReservesCapex] = useState('')
  // Debt block
  const [loanAmount, setLoanAmount] = useState('')
  const [ltv, setLtv] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [amortizationTerm, setAmortizationTerm] = useState('')
  const [interestOnlyPeriod, setInterestOnlyPeriod] = useState('')
  // Deal block
  const [unitCount, setUnitCount] = useState('')
  const [closingCosts, setClosingCosts] = useState('')
  const [holdPeriod, setHoldPeriod] = useState('')
  const [rentGrowth, setRentGrowth] = useState('')
  const [expenseGrowth, setExpenseGrowth] = useState('')
  const [exitCapRate, setExitCapRate] = useState('')
  const [costOfSale, setCostOfSale] = useState('')
  // Tenant block
  const [tenantGrossSales, setTenantGrossSales] = useState('')
  const [tenantBaseRent, setTenantBaseRent] = useState('')
  // Operating block
  const [managementFeePct, setManagementFeePct] = useState('')
  const [insurance, setInsurance] = useState('')
  const [propertyTaxes, setPropertyTaxes] = useState('')
  // Tax / Cost Seg block
  const [landValuePct, setLandValuePct] = useState('')
  const [costSegBonusPct, setCostSegBonusPct] = useState('')
  const [effectiveTaxRate, setEffectiveTaxRate] = useState('')
  const [depreciationRecaptureRate, setDepreciationRecaptureRate] = useState('')
  // Refi block
  const [refiLtv, setRefiLtv] = useState('')
  const [refiRate, setRefiRate] = useState('')
  const [refiYear, setRefiYear] = useState('')
  const [dcfModel, setDcfModel] = useState(defaultDcfModel())
  const [saving, setSaving] = useState(false)
  const [savedSignal, setSavedSignal] = useState(0)
  const [media, setMedia] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Documents state
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docUploadError, setDocUploadError] = useState('')

  // Assignment state
  const [allUsers, setAllUsers] = useState([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [viewContactId, setViewContactId] = useState(null)

  function loadProperty(p) {
    setPin(p.pin || '')
    setAddress(p.address || '')
    setCounty(p.county || '')
    setPrice(p.price ?? '')
    setSqft(p.square_feet ?? '')
    setLot(p.lot_size ?? '')
    setYearBuilt(p.year_built ?? '')
    setOnMajorRoad(p.on_major_road || false)
    setTrafficVpd(p.traffic_vpd ?? '')
    setOnCornerLot(p.on_corner_lot || false)
    setWaterAccess(p.direct_water_access || false)
    setNextToPublicLand(p.next_to_public_land || false)
    setInterstates(Array.isArray(p.major_interstates) ? p.major_interstates : [])
    setLogisticsHubs(Array.isArray(p.logistics_hubs) ? p.logistics_hubs : [])
    setLandmarksList(Array.isArray(p.landmarks) ? p.landmarks : [])
    setWaterSources(Array.isArray(p.water_sources) ? p.water_sources : [])
    setMilitaryBases(Array.isArray(p.military_bases) ? p.military_bases : [])
    setIncomeMin(p.household_income_min ?? '')
    setIncomeMax(p.household_income_max ?? '')
    setPopDensity(p.population_density ?? '')
    setPropStatus(p.status || 'New')
    setGrm(p.grm ?? '')
    setCapRate(p.cap_rate ?? '')
    setCashOnCash(p.cash_on_cash ?? '')
    setIrr(p.irr ?? '')
    setPricePerUnit(p.price_per_unit ?? '')
    setPricePerSqft(p.price_per_sqft ?? '')
    setRentToSales(p.rent_to_sales_ratio ?? '')
    setNumSkus(p.num_skus ?? '')
    setPricePerAcre(p.price_per_acre ?? '')
    setElecVoltage(p.electrical_voltage ?? '')
    setElecAmperage(p.electrical_amperage ?? '')
    setAssetType(p.asset_type || '')
    setGrossScheduledRent(p.gross_scheduled_rent ?? '')
    setVacancyRate(p.vacancy_rate ?? '')
    setOtherIncome(p.other_income ?? '')
    setOperatingExpenses(p.operating_expenses ?? '')
    setReservesCapex(p.reserves_capex ?? '')
    setLoanAmount(p.loan_amount ?? '')
    setLtv(p.ltv ?? '')
    setInterestRate(p.interest_rate ?? '')
    setAmortizationTerm(p.amortization_term ?? '')
    setInterestOnlyPeriod(p.interest_only_period ?? '')
    setUnitCount(p.unit_count ?? '')
    setClosingCosts(p.closing_costs ?? '')
    setHoldPeriod(p.hold_period ?? '')
    setRentGrowth(p.rent_growth ?? '')
    setExpenseGrowth(p.expense_growth ?? '')
    setExitCapRate(p.exit_cap_rate ?? '')
    setCostOfSale(p.cost_of_sale ?? '')
    setTenantGrossSales(p.tenant_gross_sales ?? '')
    setTenantBaseRent(p.tenant_base_rent ?? '')
    setManagementFeePct(p.management_fee_pct ?? '')
    setInsurance(p.insurance ?? '')
    setPropertyTaxes(p.property_taxes ?? '')
    setLandValuePct(p.land_value_pct ?? '')
    setCostSegBonusPct(p.cost_seg_bonus_pct ?? '')
    setEffectiveTaxRate(p.effective_tax_rate ?? '')
    setDepreciationRecaptureRate(p.depreciation_recapture_rate ?? '')
    setRefiLtv(p.refi_ltv ?? '')
    setRefiRate(p.refi_rate ?? '')
    setRefiYear(p.refi_year ?? '')
    setDcfModel(hydrateDcfModel(p.dcf_model, p))
  }

  useEffect(() => {
    if (open && property) {
      loadProperty(property)
      setTab('details')
    } else if (open && !property) {
      setPin(''); setAddress(''); setCounty(''); setPrice(''); setSqft(''); setLot('')
      setYearBuilt(''); setOnMajorRoad(false); setTrafficVpd(''); setOnCornerLot(false)
      setWaterAccess(false); setNextToPublicLand(false); setInterstates([])
      setLogisticsHubs([]); setLandmarksList([]); setWaterSources([]); setMilitaryBases([])
      setIncomeMin(''); setIncomeMax(''); setPopDensity(''); setPropStatus('New')
      setGrm(''); setCapRate(''); setCashOnCash(''); setIrr('')
      setPricePerUnit(''); setPricePerSqft(''); setRentToSales(''); setNumSkus('')
      setPricePerAcre(''); setElecVoltage(''); setElecAmperage(''); setAssetType('')
      setGrossScheduledRent(''); setVacancyRate(''); setOtherIncome(''); setOperatingExpenses(''); setReservesCapex('')
      setLoanAmount(''); setLtv(''); setInterestRate(''); setAmortizationTerm(''); setInterestOnlyPeriod('')
      setUnitCount(''); setClosingCosts(''); setHoldPeriod(''); setRentGrowth(''); setExpenseGrowth('')
      setExitCapRate(''); setCostOfSale(''); setTenantGrossSales(''); setTenantBaseRent('')
      setManagementFeePct(''); setInsurance(''); setPropertyTaxes('')
      setLandValuePct(''); setCostSegBonusPct(''); setEffectiveTaxRate(''); setDepreciationRecaptureRate('')
      setRefiLtv(''); setRefiRate(''); setRefiYear('')
      setDcfModel(defaultDcfModel())
      setTab('details')
    }
  }, [property, open])

  const activeHoldPeriod = Math.min(DCF_MAX_YEARS, Math.max(1, Number(holdPeriod || 1)))
  const visibleDcfYears = dcfModel.years.slice(0, activeHoldPeriod)
  const acquisitionBasis = (parseNum(price) || 0) + (parseNum(closingCosts) || 0)
  const initialEquity = acquisitionBasis - (parseNum(loanAmount) || 0)
  const discountRateDecimal = (parseNum(irr) || 0) / 100
  function updateDcfCell(yearIndex, field, value) {
    setDcfModel(prev => ({
      years: prev.years.map((row, index) => index === yearIndex ? { ...row, [field]: value } : row)
    }))
  }
  function getComputedDcfValue(yearRow, rowKey) {
    const grossRevenueVal = parseNum(yearRow.grossRevenue) || 0
    const vacancyLossVal = parseNum(yearRow.vacancyCreditLoss) || 0
    const percentageRentVal = parseNum(yearRow.percentageRentDcf) || 0
    const otherIncomeVal = parseNum(yearRow.otherIncomeDcf) || 0
    const operatingExpensesVal = parseNum(yearRow.operatingExpensesDcf) || 0
    const managementFeesVal = parseNum(yearRow.managementFeesDcf) || 0
    const propertyTaxesVal = parseNum(yearRow.propertyTaxesDcf) || 0
    const insuranceVal = parseNum(yearRow.insuranceDcf) || 0
    const reservesVal = parseNum(yearRow.reservesCapexDcf) || 0
    const tenantImprovementsVal = parseNum(yearRow.tenantImprovements) || 0
    const leasingCommissionsVal = parseNum(yearRow.leasingCommissions) || 0
    const capitalExpendituresVal = parseNum(yearRow.capitalExpenditures) || 0
    const debtServiceVal = parseNum(yearRow.debtServiceDcf) || 0
    const refinanceVal = parseNum(yearRow.refinanceProceeds) || 0
    const refinanceCostsVal = parseNum(yearRow.refinanceCostsDcf) || 0
    const taxesVal = parseNum(yearRow.taxesDcf) || 0
    const saleProceedsVal = parseNum(yearRow.saleProceedsDcf) || 0
    const sponsorVal = parseNum(yearRow.waterfallSponsor) || 0
    const investorVal = parseNum(yearRow.waterfallInvestor) || 0
    const effectiveGrossIncome = grossRevenueVal - vacancyLossVal + percentageRentVal + otherIncomeVal
    const netOperatingIncome = effectiveGrossIncome - operatingExpensesVal - managementFeesVal - propertyTaxesVal - insuranceVal - reservesVal
    const belowTheLineCapital = tenantImprovementsVal + leasingCommissionsVal + capitalExpendituresVal
    const cashFlowBeforeSale = netOperatingIncome - belowTheLineCapital - debtServiceVal + refinanceVal - refinanceCostsVal - taxesVal
    const cashFlowAfterSale = cashFlowBeforeSale + saleProceedsVal - sponsorVal - investorVal
    if (rowKey === 'effectiveGrossIncome') return effectiveGrossIncome
    if (rowKey === 'netOperatingIncomeDcf') return netOperatingIncome
    if (rowKey === 'cashFlowBeforeSale') return cashFlowBeforeSale
    if (rowKey === 'cashFlowAfterSale') return cashFlowAfterSale
    return null
  }
  const dcfYearSummaries = visibleDcfYears.map((yearRow) => {
    const effectiveGrossIncome = getComputedDcfValue(yearRow, 'effectiveGrossIncome') || 0
    const netOperatingIncome = getComputedDcfValue(yearRow, 'netOperatingIncomeDcf') || 0
    const cashFlowBeforeSale = getComputedDcfValue(yearRow, 'cashFlowBeforeSale') || 0
    const cashFlowAfterSale = getComputedDcfValue(yearRow, 'cashFlowAfterSale') || 0
    const debtService = parseNum(yearRow.debtServiceDcf) || 0
    return { effectiveGrossIncome, netOperatingIncome, cashFlowBeforeSale, cashFlowAfterSale, debtService }
  })
  const leveredCashFlows = initialEquity > 0
    ? [-initialEquity, ...dcfYearSummaries.map(row => row.cashFlowAfterSale)]
    : null
  const leveredIrr = leveredCashFlows ? calculateIrr(leveredCashFlows) : null
  const unleveredCashFlowsResolved = acquisitionBasis > 0
    ? [-acquisitionBasis, ...visibleDcfYears.map((yearRow) => {
      const noi = getComputedDcfValue(yearRow, 'netOperatingIncomeDcf') || 0
      const sale = parseNum(yearRow.saleProceedsDcf) || 0
      const taxes = parseNum(yearRow.taxesDcf) || 0
      return noi + sale - taxes
    })]
    : null
  const unleveredIrr = unleveredCashFlowsResolved ? calculateIrr(unleveredCashFlowsResolved) : null
  const leveredEquityMultiple = leveredCashFlows && initialEquity > 0
    ? leveredCashFlows.slice(1).reduce((sum, value) => sum + value, 0) / initialEquity
    : null
  const unleveredEquityMultiple = unleveredCashFlowsResolved && acquisitionBasis > 0
    ? unleveredCashFlowsResolved.slice(1).reduce((sum, value) => sum + value, 0) / acquisitionBasis
    : null
  const leveredNpv = leveredCashFlows && discountRateDecimal > -1
    ? leveredCashFlows.reduce((sum, value, index) => sum + (value / Math.pow(1 + discountRateDecimal, index)), 0)
    : null
  const unleveredNpv = unleveredCashFlowsResolved && discountRateDecimal > -1
    ? unleveredCashFlowsResolved.reduce((sum, value, index) => sum + (value / Math.pow(1 + discountRateDecimal, index)), 0)
    : null
  const debtYield = dcfYearSummaries[0] && parseNum(loanAmount) > 0
    ? dcfYearSummaries[0].netOperatingIncome / parseNum(loanAmount) * 100
    : null
  const yieldOnCost = dcfYearSummaries[0] && acquisitionBasis > 0
    ? dcfYearSummaries[0].netOperatingIncome / acquisitionBasis * 100
    : null
  const firstYearDcf = visibleDcfYears[0] || null
  const holdYearDcf = visibleDcfYears[visibleDcfYears.length - 1] || null
  const adjustedNoiValue = firstYearDcf ? (getComputedDcfValue(firstYearDcf, 'netOperatingIncomeDcf') || 0) : null
  const exitValueAmount = holdYearDcf ? (parseNum(holdYearDcf.grossSaleProceedsDcf) || 0) : null
  const netSaleProceedsAmount = holdYearDcf ? (parseNum(holdYearDcf.saleProceedsDcf) || 0) : null
  const loanBalanceAtExitAmount = holdYearDcf ? (parseNum(holdYearDcf.loanPayoffAtSale) || 0) : null
  const netEquityOnExitAmount = netSaleProceedsAmount
  const annualDebtServiceAmount = firstYearDcf ? (parseNum(firstYearDcf.debtServiceDcf) || 0) : null

  useEffect(() => {
    if (open && property?.id) {
      fetchMedia()
      fetchDocs()
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

  async function fetchDocs() {
    setDocsLoading(true)
    try {
      const data = await apiFetch(`/api/properties/${property.id}/documents`)
      setDocs(data.documents || [])
    } catch (e) { console.error('Failed to fetch documents', e.message) }
    finally { setDocsLoading(false) }
  }

  async function handleDocUpload(e) {
    const files = Array.from(e.target.files)
    setDocUploadError('')
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv']
    for (const file of files) {
      if (!allowed.includes(file.type)) { setDocUploadError(`${file.name}: unsupported type`); continue }
      if (file.size > 25 * 1024 * 1024) { setDocUploadError(`${file.name} exceeds 25MB limit`); continue }
      const fileData = await toBase64(file)
      try {
        await apiFetch(`/api/properties/${property.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, fileType: file.type, fileData })
        })
      } catch (err) { setDocUploadError(err.message || 'Upload failed') }
    }
    e.target.value = ''
    fetchDocs()
  }

  async function deleteDoc(docId) {
    if (!confirm('Delete this document?')) return
    await apiFetch(`/api/properties/${property.id}/documents/${docId}`, { method: 'DELETE' })
    fetchDocs()
  }

  async function fetchUsers() {
    try {
      const data = await apiFetch(`/api/properties/${property.id}/users`)
      setAllUsers(data.users || [])
    } catch (e) { console.error('Failed to fetch users', e.message) }
  }

  async function handleSave() {
    if (!pin.trim() || !address.trim() || !county.trim()) { alert('PIN, Address and County are required'); return }
    setSaving(true)
    await onSave({
      ...property, pin, address, county,
      price: price !== '' ? Number(price) : null,
      square_feet: sqft !== '' ? Number(sqft) : null,
      lot_size: lot !== '' ? Number(lot) : null,
      year_built: yearBuilt !== '' ? Number(yearBuilt) : null,
      on_major_road: onMajorRoad,
      traffic_vpd: trafficVpd !== '' ? Number(trafficVpd) : null,
      on_corner_lot: onCornerLot,
      direct_water_access: waterAccess,
      next_to_public_land: nextToPublicLand,
      major_interstates: interstates,
      logistics_hubs: logisticsHubs,
      landmarks: landmarksList,
      water_sources: waterSources,
      military_bases: militaryBases,
      household_income_min: incomeMin !== '' ? Number(incomeMin) : null,
      household_income_max: incomeMax !== '' ? Number(incomeMax) : null,
      population_density: popDensity !== '' ? Number(popDensity) : null,
      status: propStatus,
      grm: grm !== '' ? Number(grm) : null,
      cap_rate: capRate !== '' ? Number(capRate) : null,
      cash_on_cash: cashOnCash !== '' ? Number(cashOnCash) : null,
      irr: irr !== '' ? Number(irr) : null,
      price_per_unit: pricePerUnit !== '' ? Number(pricePerUnit) : null,
      price_per_sqft: pricePerSqft !== '' ? Number(pricePerSqft) : null,
      rent_to_sales_ratio: rentToSales !== '' ? Number(rentToSales) : null,
      num_skus: numSkus !== '' ? Number(numSkus) : null,
      price_per_acre: pricePerAcre !== '' ? Number(pricePerAcre) : null,
      electrical_voltage: elecVoltage !== '' ? Number(elecVoltage) : null,
      electrical_amperage: elecAmperage !== '' ? Number(elecAmperage) : null,
      asset_type: assetType || null,
      gross_scheduled_rent: grossScheduledRent !== '' ? Number(grossScheduledRent) : null,
      vacancy_rate: vacancyRate !== '' ? Number(vacancyRate) : null,
      other_income: otherIncome !== '' ? Number(otherIncome) : null,
      operating_expenses: operatingExpenses !== '' ? Number(operatingExpenses) : null,
      reserves_capex: reservesCapex !== '' ? Number(reservesCapex) : null,
      loan_amount: loanAmount !== '' ? Number(loanAmount) : null,
      ltv: ltv !== '' ? Number(ltv) : null,
      interest_rate: interestRate !== '' ? Number(interestRate) : null,
      amortization_term: amortizationTerm !== '' ? Number(amortizationTerm) : null,
      interest_only_period: interestOnlyPeriod !== '' ? Number(interestOnlyPeriod) : null,
      unit_count: unitCount !== '' ? Number(unitCount) : null,
      closing_costs: closingCosts !== '' ? Number(closingCosts) : null,
      hold_period: holdPeriod !== '' ? Number(holdPeriod) : null,
      rent_growth: rentGrowth !== '' ? Number(rentGrowth) : null,
      expense_growth: expenseGrowth !== '' ? Number(expenseGrowth) : null,
      exit_cap_rate: exitCapRate !== '' ? Number(exitCapRate) : null,
      cost_of_sale: costOfSale !== '' ? Number(costOfSale) : null,
      tenant_gross_sales: tenantGrossSales !== '' ? Number(tenantGrossSales) : null,
      tenant_base_rent: tenantBaseRent !== '' ? Number(tenantBaseRent) : null,
      management_fee_pct: managementFeePct !== '' ? Number(managementFeePct) : null,
      insurance: insurance !== '' ? Number(insurance) : null,
      property_taxes: propertyTaxes !== '' ? Number(propertyTaxes) : null,
      land_value_pct: landValuePct !== '' ? Number(landValuePct) : null,
      cost_seg_bonus_pct: costSegBonusPct !== '' ? Number(costSegBonusPct) : null,
      effective_tax_rate: effectiveTaxRate !== '' ? Number(effectiveTaxRate) : null,
      depreciation_recapture_rate: depreciationRecaptureRate !== '' ? Number(depreciationRecaptureRate) : null,
      refi_ltv: refiLtv !== '' ? Number(refiLtv) : null,
      refi_rate: refiRate !== '' ? Number(refiRate) : null,
      refi_year: refiYear !== '' ? Number(refiYear) : null,
      dcf_model: {
        years: dcfModel.years.map((year, index) => ({
          year: index + 1,
          grossRevenue: parseNum(year.grossRevenue),
          vacancyCreditLoss: parseNum(year.vacancyCreditLoss),
          percentageRentDcf: parseNum(year.percentageRentDcf),
          otherIncomeDcf: parseNum(year.otherIncomeDcf),
          operatingExpensesDcf: parseNum(year.operatingExpensesDcf),
          managementFeesDcf: parseNum(year.managementFeesDcf),
          propertyTaxesDcf: parseNum(year.propertyTaxesDcf),
          insuranceDcf: parseNum(year.insuranceDcf),
          reservesCapexDcf: parseNum(year.reservesCapexDcf),
          tenantImprovements: parseNum(year.tenantImprovements),
          leasingCommissions: parseNum(year.leasingCommissions),
          capitalExpenditures: parseNum(year.capitalExpenditures),
          debtServiceDcf: parseNum(year.debtServiceDcf),
          loanBalanceDcf: parseNum(year.loanBalanceDcf),
          refinanceProceeds: parseNum(year.refinanceProceeds),
          refinanceCostsDcf: parseNum(year.refinanceCostsDcf),
          loanPayoffAtRefi: parseNum(year.loanPayoffAtRefi),
          taxesDcf: parseNum(year.taxesDcf),
          grossSaleProceedsDcf: parseNum(year.grossSaleProceedsDcf),
          saleCostsDcf: parseNum(year.saleCostsDcf),
          loanPayoffAtSale: parseNum(year.loanPayoffAtSale),
          recaptureTaxDcf: parseNum(year.recaptureTaxDcf),
          saleProceedsDcf: parseNum(year.saleProceedsDcf),
          waterfallSponsor: parseNum(year.waterfallSponsor),
          waterfallInvestor: parseNum(year.waterfallInvestor),
        }))
      },
    })
    setSaving(false)
    setSavedSignal(s => s + 1)
    if (!property?.id) onClose()
  }

  function addInterstate() { setInterstates(prev => [...prev, { name: '', distance: '' }]) }
  function updateInterstate(i, field, val) {
    setInterstates(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeInterstate(i) { setInterstates(prev => prev.filter((_, idx) => idx !== i)) }

  function addHub() { setLogisticsHubs(prev => [...prev, { type: 'Airport', name: '', distance: '' }]) }
  function updateHub(i, field, val) {
    setLogisticsHubs(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeHub(i) { setLogisticsHubs(prev => prev.filter((_, idx) => idx !== i)) }

  function addLandmark() { setLandmarksList(prev => [...prev, { type: 'Major Metro', name: '', distance: '' }]) }
  function updateLandmark(i, field, val) {
    setLandmarksList(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeLandmark(i) { setLandmarksList(prev => prev.filter((_, idx) => idx !== i)) }

  function addWaterSource() { setWaterSources(prev => [...prev, { name: '', distance: '' }]) }
  function updateWaterSource(i, field, val) {
    setWaterSources(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeWaterSource(i) { setWaterSources(prev => prev.filter((_, idx) => idx !== i)) }

  function addMilitaryBase() { setMilitaryBases(prev => [...prev, { name: '', distance: '' }]) }
  function updateMilitaryBase(i, field, val) {
    setMilitaryBases(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeMilitaryBase(i) { setMilitaryBases(prev => prev.filter((_, idx) => idx !== i)) }

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
    ? ['details', 'financials', 'media', 'documents', ...(isAdmin ? ['assign'] : [])]
    : ['details', 'financials']

  const tabLabel = { details: 'Details', financials: 'Financials', media: 'Media', documents: 'Documents', assign: 'Assign Users' }

  return (
    <div className="modal modal-open" style={{ zIndex: 30, paddingTop: `${topOffset}px` }}>
      {/* Wide container: left form + right map */}
      <div className="modal-box p-0 w-screen max-w-none max-h-none rounded-none flex flex-col overflow-hidden" style={{ height: `calc(100vh - ${topOffset}px)` }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-base-300 md:hidden">
          <h3 className="font-bold text-xl">
            {property?.id ? property.address : 'New Property'}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        {tabs.length > 1 && (
          <div className="tabs tabs-bordered px-6 pt-2 md:hidden">
            {tabs.map(t => (
              <button key={t} className={`tab ${tab === t ? 'tab-active font-semibold' : ''}`} onClick={() => setTab(t)}>
                {tabLabel[t]}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row overflow-hidden min-h-0 flex-1 md:pt-0">
        {/* ── Left panel: form ── */}
        <div className="flex flex-col w-full md:w-[480px] md:flex-shrink-0 overflow-y-auto max-h-screen">
          <div className="hidden md:flex items-center justify-between px-6 py-2 border-b border-base-300">
            <h3 className="font-bold text-xl">
              {property?.id ? property.address : 'New Property'}
            </h3>
            <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
          </div>

          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="tabs tabs-bordered px-6 md:pt-0">
              {tabs.map(t => (
                <button key={t} className={`tab ${tab === t ? 'tab-active font-semibold' : ''}`} onClick={() => setTab(t)}>
                  {tabLabel[t]}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 px-6 py-5 overflow-y-auto">

        {/* Details tab */}
        {tab === 'details' && (
          <div className="space-y-5">
            {/* Media carousel — shown inline for existing properties */}
            {property?.id && <PropertyModalCarousel propertyId={property.id} />}
            {/* Core */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="PIN(s)" required>
                <input type="text" placeholder="e.g. 12-34-567-890" value={pin}
                  onChange={e => setPin(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="County" required>
                <input type="text" placeholder="e.g. Cook" value={county}
                  onChange={e => setCounty(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            </div>
            <Field label="Address" required>
              <input type="text" placeholder="123 Main St, Chicago, IL" value={address}
                onChange={e => setAddress(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
            </Field>

            {/* Status */}
            <Field label="Status">
              <select value={propStatus} onChange={e => setPropStatus(e.target.value)}
                className="select select-bordered w-full" disabled={!isAdmin}>
                {['New','Under Review','Active','Other'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            {/* Asset Type */}
            <Field label="Asset Type">
              <select value={assetType} onChange={e => setAssetType(e.target.value)}
                className="select select-bordered w-full" disabled={!isAdmin}>
                <option value="">— Select —</option>
                {['Multifamily','Retail','Net Lease','Office','Industrial',
                  'Hospitality / Golf','Student Housing','Seniors Housing','Self-Storage',
                  'Medical Office','Affordable Housing','Manufactured Housing','Land & Redevelopment','Mixed-Use'
                ].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            {/* Location attributes */}
            <div className="divider text-xs text-base-content/40 my-1">Location Attributes</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'On Major Road', val: onMajorRoad, set: setOnMajorRoad },
                { label: 'Corner Lot', val: onCornerLot, set: setOnCornerLot },
                { label: 'Direct Water Access', val: waterAccess, set: setWaterAccess },
                { label: 'Next to Public Land', val: nextToPublicLand, set: setNextToPublicLand },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-sm" checked={val}
                    onChange={e => set(e.target.checked)} disabled={!isAdmin} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            {onMajorRoad && (
              <Field label="Traffic (VPD — vehicles per day)">
                <NumericInput placeholder="e.g. 25,000" value={trafficVpd}
                  onChange={setTrafficVpd} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            )}

            {/* Interstates */}
            <div className="divider text-xs text-base-content/40 my-1">Major Interstates</div>
            <div className="space-y-2">
              {interstates.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" placeholder="e.g. I-80" value={item.name}
                    onChange={e => updateInterstate(i, 'name', e.target.value)}
                    className="input input-bordered input-sm w-32" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles away" value={item.distance}
                    onChange={e => updateInterstate(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-32" disabled={!isAdmin} />
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeInterstate(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && (
                <button className="btn btn-xs btn-outline" onClick={addInterstate}>+ Add Interstate</button>
              )}
              {interstates.length === 0 && <p className="text-sm text-base-content/40">No interstates added</p>}
            </div>

            {/* Demographics */}
            <div className="divider text-xs text-base-content/40 my-1">Logistics Hubs</div>
            <div className="space-y-2">
              {logisticsHubs.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <select value={item.type} onChange={e => updateHub(i, 'type', e.target.value)}
                    className="select select-bordered select-sm w-36" disabled={!isAdmin}>
                    <option>Airport</option>
                    <option>Railyard</option>
                  </select>
                  <input type="text" placeholder="e.g. O'Hare International Airport" value={item.name}
                    onChange={e => updateHub(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[160px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateHub(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeHub(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addHub}>+ Add Hub</button>}
              {logisticsHubs.length === 0 && <p className="text-sm text-base-content/40">No logistics hubs added</p>}
            </div>

            <div className="divider text-xs text-base-content/40 my-1">Landmarks</div>
            <div className="space-y-2">
              {landmarksList.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <select value={item.type} onChange={e => updateLandmark(i, 'type', e.target.value)}
                    className="select select-bordered select-sm w-44" disabled={!isAdmin}>
                    <option>Major Metro</option>
                    <option>National Park</option>
                    <option>Nature Preserve</option>
                  </select>
                  <input type="text" placeholder="e.g. Chicago" value={item.name}
                    onChange={e => updateLandmark(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[140px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateLandmark(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeLandmark(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addLandmark}>+ Add Landmark</button>}
              {landmarksList.length === 0 && <p className="text-sm text-base-content/40">No landmarks added</p>}
            </div>

            <div className="divider text-xs text-base-content/40 my-1">Water Sources</div>
            <div className="space-y-2">
              {waterSources.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <input type="text" placeholder="e.g. Lake Michigan" value={item.name}
                    onChange={e => updateWaterSource(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[180px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateWaterSource(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeWaterSource(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addWaterSource}>+ Add Water Source</button>}
              {waterSources.length === 0 && <p className="text-sm text-base-content/40">No water sources added</p>}
            </div>

            <div className="divider text-xs text-base-content/40 my-1">Military Bases</div>
            <div className="space-y-2">
              {militaryBases.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <input type="text" placeholder="e.g. Naval Station Great Lakes" value={item.name}
                    onChange={e => updateMilitaryBase(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[200px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateMilitaryBase(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeMilitaryBase(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addMilitaryBase}>+ Add Military Base</button>}
              {militaryBases.length === 0 && <p className="text-sm text-base-content/40">No military bases added</p>}
            </div>

            {/* Demographics */}
            <div className="divider text-xs text-base-content/40 my-1">Demographics</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Household Income Min ($)">
                <NumericInput placeholder="e.g. 45,000" value={incomeMin}
                  onChange={setIncomeMin} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Household Income Max ($)">
                <NumericInput placeholder="e.g. 120,000" value={incomeMax}
                  onChange={setIncomeMax} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Population Density (per sq mi)">
                <NumericInput placeholder="e.g. 3,500" value={popDensity}
                  onChange={setPopDensity} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            </div>

            {isAdmin && (
              <div className="pt-2 hidden md:block">
                <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal}
                  label={property?.id ? 'Save Changes' : 'Create Property'} />
              </div>
            )}

            {isAdmin && (
              <div className="pt-2 md:hidden">
                <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal}
                  label={property?.id ? 'Save Changes' : 'Create Property'} />
              </div>
            )}
          </div>
        )}


        {/* Financials tab */}
        {tab === 'financials' && (
          <div className="space-y-4">
              {/* Core financials */}
              <div className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Property</div>
                <Field label="Price ($)">
                  <NumericInput placeholder="0" value={price} onChange={setPrice}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Square Feet">
                  <NumericInput placeholder="0" value={sqft} onChange={setSqft}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Lot Size (acres)">
                  <input type="number" placeholder="0.00" step="0.01" value={lot}
                    onChange={e => setLot(e.target.value)} className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Year Built">
                  <input type="number" placeholder="e.g. 1998" value={yearBuilt}
                    onChange={e => setYearBuilt(e.target.value)} className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
              </div>

              {/* Investment metrics */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Investment Metrics</div>
                {/* GRM = Price / Gross Scheduled Rent */}
                <Field label="GRM">
                  <input readOnly
                    value={price !== '' && grossScheduledRent !== '' && Number(grossScheduledRent) > 0
                      ? (Number(price) / Number(grossScheduledRent)).toFixed(2) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                {/* Cap Rate = NOI / Price */}
                <Field label="Cap Rate (%)">
                  {(() => {
                    const noi = grossScheduledRent !== '' && vacancyRate !== '' && operatingExpenses !== ''
                      ? Number(grossScheduledRent) * (1 - Number(vacancyRate)/100) + Number(otherIncome||0) - Number(operatingExpenses) - Number(reservesCapex||0)
                      : null
                    const val = noi !== null && price !== '' && Number(price) > 0
                      ? (noi / Number(price) * 100).toFixed(2) + '%' : '—'
                    return <input readOnly value={val} className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
                {/* Cash-on-Cash = (NOI - Debt Service) / Equity */}
                <Field label="Cash-on-Cash (%)">
                  {(() => {
                    const noi = grossScheduledRent !== '' && vacancyRate !== '' && operatingExpenses !== ''
                      ? Number(grossScheduledRent) * (1 - Number(vacancyRate)/100) + Number(otherIncome||0) - Number(operatingExpenses) - Number(reservesCapex||0)
                      : null
                    let ds = 0
                    if (loanAmount !== '' && interestRate !== '' && amortizationTerm !== '' && Number(amortizationTerm) > 0) {
                      const r = Number(interestRate)/100/12, n = Number(amortizationTerm)*12
                      ds = r === 0 ? Number(loanAmount)/n*12 : Number(loanAmount)*r/(1-Math.pow(1+r,-n))*12
                    }
                    const equity = price !== '' && loanAmount !== '' ? Number(price) + Number(closingCosts||0) - Number(loanAmount) : null
                    const val = noi !== null && equity !== null && equity > 0
                      ? ((noi - ds) / equity * 100).toFixed(2) + '%' : '—'
                    return <input readOnly value={val} className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
                <Field label="Levered IRR (%)">
                  <input readOnly
                    value={leveredIrr !== null ? `${(leveredIrr * 100).toFixed(2)}%` : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Unlevered IRR (%)">
                  <input readOnly
                    value={unleveredIrr !== null ? `${(unleveredIrr * 100).toFixed(2)}%` : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Levered EMx">
                  <input readOnly
                    value={leveredEquityMultiple !== null ? `${leveredEquityMultiple.toFixed(2)}x` : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Unlevered EMx">
                  <input readOnly
                    value={unleveredEquityMultiple !== null ? `${unleveredEquityMultiple.toFixed(2)}x` : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Levered NPV ($)">
                  <input readOnly
                    value={leveredNpv !== null ? '$' + leveredNpv.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Unlevered NPV ($)">
                  <input readOnly
                    value={unleveredNpv !== null ? '$' + unleveredNpv.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="NPV Discount Rate (%)">
                  <NumericInput placeholder="e.g. 10.0" value={irr} onChange={setIrr}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                {/* Price/Unit = Price / Unit Count */}
                <Field label="Price / Unit ($)">
                  <input readOnly
                    value={price !== '' && unitCount !== '' && Number(unitCount) > 0
                      ? '$' + (Number(price) / Number(unitCount)).toLocaleString(undefined, {maximumFractionDigits:0}) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                {/* Price/SqFt = Price / SqFt */}
                <Field label="Price / Sq Ft ($)">
                  <input readOnly
                    value={price !== '' && sqft !== '' && Number(sqft) > 0
                      ? '$' + (Number(price) / Number(sqft)).toFixed(2) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Rent-to-Sales (%)">
                  <NumericInput placeholder="e.g. 5.0" value={rentToSales} onChange={setRentToSales}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="# SKUs">
                  <NumericInput placeholder="e.g. 500" value={numSkus} onChange={setNumSkus}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                {/* Price/Acre = Price / Lot Size */}
                <Field label="Price / Acre ($)">
                  <input readOnly
                    value={price !== '' && lot !== '' && Number(lot) > 0
                      ? '$' + (Number(price) / Number(lot)).toLocaleString(undefined, {maximumFractionDigits:0}) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
              </div>

              {/* Operating */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Operating</div>
                <Field label="Management Fee (%)">
                  <NumericInput placeholder="e.g. 8" value={managementFeePct} onChange={setManagementFeePct}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Management Fee ($/yr)">
                  {(() => {
                    const egi = grossScheduledRent !== '' && vacancyRate !== ''
                      ? Number(grossScheduledRent) * (1 - Number(vacancyRate) / 100) : null
                    const mgmtFee = egi !== null && managementFeePct !== '' ? egi * Number(managementFeePct) / 100 : null
                    return <input readOnly value={mgmtFee !== null ? '$' + mgmtFee.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                      className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
                <Field label="Insurance ($/yr)">
                  <NumericInput placeholder="e.g. 12000" value={insurance} onChange={setInsurance}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Property Taxes ($/yr)">
                  <NumericInput placeholder="e.g. 18000" value={propertyTaxes} onChange={setPropertyTaxes}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Adjusted NOI ($/yr)">
                  <input readOnly
                    value={adjustedNoiValue !== null ? '$' + adjustedNoiValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
              </div>

              {/* Income */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Income</div>
                <Field label="Gross Scheduled Rent ($/yr)">
                  <NumericInput placeholder="e.g. 120000" value={grossScheduledRent} onChange={setGrossScheduledRent}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Vacancy / Credit Loss (%)">
                  <NumericInput placeholder="e.g. 5" value={vacancyRate} onChange={setVacancyRate}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="EGI — Effective Gross Income ($/yr)">
                  <input readOnly
                    value={grossScheduledRent !== '' && vacancyRate !== '' ? '$' + (Number(grossScheduledRent) * (1 - Number(vacancyRate) / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Other Income ($/yr)">
                  <NumericInput placeholder="parking, RUBS, storage" value={otherIncome} onChange={setOtherIncome}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Operating Expenses ($/yr)">
                  <NumericInput placeholder="e.g. 40000" value={operatingExpenses} onChange={setOperatingExpenses}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Reserves / Replacement Capex ($/yr)">
                  <NumericInput placeholder="e.g. 5000" value={reservesCapex} onChange={setReservesCapex}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="NOI — Net Operating Income ($/yr)">
                  <input readOnly
                    value={grossScheduledRent !== '' && vacancyRate !== '' && operatingExpenses !== '' ? '$' + (
                      Number(grossScheduledRent) * (1 - Number(vacancyRate) / 100) +
                      Number(otherIncome || 0) - Number(operatingExpenses) - Number(reservesCapex || 0)
                    ).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
              </div>

              {/* Equity / Returns */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Equity / Returns</div>
                <Field label="Equity ($)">
                  <input readOnly
                    value={price !== '' && loanAmount !== ''
                      ? '$' + (Number(price) + Number(closingCosts || 0) - Number(loanAmount)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="DSCR">
                  {(() => {
                    const egi = grossScheduledRent !== '' && vacancyRate !== ''
                      ? Number(grossScheduledRent) * (1 - Number(vacancyRate) / 100) : null
                    const mgmtFee = egi !== null && managementFeePct !== '' ? egi * Number(managementFeePct) / 100 : 0
                    const noi = egi !== null && operatingExpenses !== ''
                      ? egi + Number(otherIncome || 0) - Number(operatingExpenses) - Number(reservesCapex || 0) : null
                    const adjNoi = noi !== null ? noi - mgmtFee - Number(insurance || 0) - Number(propertyTaxes || 0) : null
                    let ds = 0
                    if (loanAmount !== '' && interestRate !== '' && amortizationTerm !== '' && Number(amortizationTerm) > 0) {
                      const r = Number(interestRate) / 100 / 12, n = Number(amortizationTerm) * 12
                      ds = r === 0 ? Number(loanAmount) / n * 12 : Number(loanAmount) * r / (1 - Math.pow(1 + r, -n)) * 12
                    }
                    const val = adjNoi !== null && ds > 0 ? (adjNoi / ds).toFixed(2) : '—'
                    return <input readOnly value={val} className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
                <Field label="Debt Yield (%)">
                  <input readOnly
                    value={debtYield !== null ? `${debtYield.toFixed(2)}%` : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Yield on Cost (%)">
                  <input readOnly
                    value={yieldOnCost !== null ? `${yieldOnCost.toFixed(2)}%` : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
              </div>

              {/* Debt */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Debt</div>
                <Field label="Loan Amount ($)">
                  <NumericInput placeholder="e.g. 750000" value={loanAmount} onChange={setLoanAmount}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="LTV (%)">
                  <NumericInput placeholder="e.g. 75" value={ltv} onChange={setLtv}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Interest Rate (%)">
                  <NumericInput placeholder="e.g. 6.5" value={interestRate} onChange={setInterestRate}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Amortization Term (yrs)">
                  <NumericInput placeholder="e.g. 25" value={amortizationTerm} onChange={setAmortizationTerm}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Interest-Only Period (yrs)">
                  <NumericInput placeholder="e.g. 3" value={interestOnlyPeriod} onChange={setInterestOnlyPeriod}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Annual Debt Service ($/yr)">
                  <input readOnly
                    value={annualDebtServiceAmount !== null ? '$' + annualDebtServiceAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
              </div>

              {/* Tax & Cost Segregation */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Tax &amp; Cost Segregation</div>
                <Field label="Land Value (%)">
                  <NumericInput placeholder="e.g. 20" value={landValuePct} onChange={setLandValuePct}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Depreciable Basis ($)">
                  <input readOnly
                    value={price !== '' && landValuePct !== ''
                      ? '$' + (Number(price) * (1 - Number(landValuePct) / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Cost Seg Bonus (%)">
                  <NumericInput placeholder="e.g. 30" value={costSegBonusPct} onChange={setCostSegBonusPct}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Year 1 Bonus Depreciation ($)">
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const val = depBasis !== null && costSegBonusPct !== ''
                      ? '$' + (depBasis * Number(costSegBonusPct) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
                <Field label="Standard Depreciation / 39-yr ($)">
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const bonus = costSegBonusPct !== '' ? Number(costSegBonusPct) / 100 : 0
                    const val = depBasis !== null ? '$' + (depBasis * (1 - bonus) / 39).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
                <Field label="Total Year 1 Depreciation ($)">
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const bonus = costSegBonusPct !== '' ? Number(costSegBonusPct) / 100 : 0
                    const totalDepr = depBasis !== null ? depBasis * bonus + depBasis * (1 - bonus) / 39 : null
                    return <input readOnly value={totalDepr !== null ? '$' + totalDepr.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                      className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
                <Field label="Effective Tax Rate (%)">
                  <NumericInput placeholder="e.g. 37" value={effectiveTaxRate} onChange={setEffectiveTaxRate}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Tax Shield Year 1 ($)">
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const bonus = costSegBonusPct !== '' ? Number(costSegBonusPct) / 100 : 0
                    const totalDepr = depBasis !== null ? depBasis * bonus + depBasis * (1 - bonus) / 39 : null
                    const val = totalDepr !== null && effectiveTaxRate !== ''
                      ? '$' + (totalDepr * Number(effectiveTaxRate) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
                <Field label="Depreciation Recapture Rate (%)">
                  <NumericInput placeholder="e.g. 25" value={depreciationRecaptureRate} onChange={setDepreciationRecaptureRate}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Recapture Tax on Exit ($)">
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const val = depBasis !== null && depreciationRecaptureRate !== ''
                      ? '$' + (depBasis * Number(depreciationRecaptureRate) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  })()}
                </Field>
              </div>

              {/* Exit / Reversion */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Exit / Reversion</div>
                <Field label="Refi LTV (%)">
                  <NumericInput placeholder="e.g. 70" value={refiLtv} onChange={setRefiLtv}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Refi Interest Rate (%)">
                  <NumericInput placeholder="e.g. 6.0" value={refiRate} onChange={setRefiRate}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Refi Year">
                  <NumericInput placeholder="e.g. 3" value={refiYear} onChange={setRefiYear}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Exit Value ($)">
                  <input readOnly
                    value={exitValueAmount !== null ? '$' + exitValueAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Net Sale Proceeds ($)">
                  <input readOnly
                    value={netSaleProceedsAmount !== null ? '$' + netSaleProceedsAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Loan Balance at Exit ($)">
                  <input readOnly
                    value={loanBalanceAtExitAmount !== null ? '$' + loanBalanceAtExitAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
                <Field label="Net Equity on Exit ($)">
                  <input readOnly
                    value={netEquityOnExitAmount !== null ? '$' + netEquityOnExitAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                </Field>
              </div>

              {/* Deal */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Deal</div>
                <Field label="Unit / Bay / Suite Count">
                  <NumericInput placeholder="e.g. 24" value={unitCount} onChange={setUnitCount}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Closing Costs ($)">
                  <NumericInput placeholder="e.g. 25000" value={closingCosts} onChange={setClosingCosts}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Hold Period (yrs)">
                  <NumericInput placeholder="e.g. 7" value={holdPeriod} onChange={setHoldPeriod}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Rent Growth (% / yr)">
                  <NumericInput placeholder="e.g. 3" value={rentGrowth} onChange={setRentGrowth}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Expense Growth (% / yr)">
                  <NumericInput placeholder="e.g. 2" value={expenseGrowth} onChange={setExpenseGrowth}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Exit Cap Rate (%)">
                  <NumericInput placeholder="e.g. 6.5" value={exitCapRate} onChange={setExitCapRate}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Cost of Sale (%)">
                  <NumericInput placeholder="e.g. 2" value={costOfSale} onChange={setCostOfSale}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
              </div>

              {/* Electrical */}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Electrical</div>
                <Field label="Voltage (V)">
                  <NumericInput placeholder="e.g. 480" value={elecVoltage} onChange={setElecVoltage}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
                <Field label="Amperage (A)">
                  <NumericInput placeholder="e.g. 400" value={elecAmperage} onChange={setElecAmperage}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
              </div>

              {/* Tenant — retail / percentage-rent only */}
              {(assetType === 'Retail' || assetType === 'Net Lease' || assetType === '') && (
                <div className="space-y-3 pt-2">
                  <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Tenant</div>
                  <Field label="Tenant Annual Gross Sales ($)">
                    <NumericInput placeholder="e.g. 1200000" value={tenantGrossSales} onChange={setTenantGrossSales}
                      className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                  </Field>
                  <Field label="Tenant Base Rent ($/yr)">
                    <NumericInput placeholder="e.g. 60000" value={tenantBaseRent} onChange={setTenantBaseRent}
                      className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                  </Field>
                  <Field label="Rent-to-Sales Ratio (%)">
                    <input readOnly
                      value={tenantGrossSales !== '' && tenantBaseRent !== '' && Number(tenantGrossSales) > 0 ? (Number(tenantBaseRent) / Number(tenantGrossSales) * 100).toFixed(2) + '%' : '—'}
                      className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  </Field>
                </div>
              )}
            {isAdmin && (
              <div className="pt-2">
                <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal}
                  label={property?.id ? 'Save Changes' : 'Create Property'} />
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

        {/* Documents tab */}
        {tab === 'documents' && (
          <div className="space-y-5">
            {isAdmin && (
              <div className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center">
                <p className="text-sm text-base-content/50 mb-1">PDF, Word, Excel, CSV, images — max 25MB each</p>
                <p className="text-xs text-base-content/30 mb-3">These are property documents, not visual media</p>
                <label className="btn btn-primary btn-sm cursor-pointer">
                  Upload Documents
                  <input type="file" className="hidden" multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
                    onChange={handleDocUpload} />
                </label>
                {docUploadError && <p className="text-error text-sm mt-2">{docUploadError}</p>}
              </div>
            )}
            {docsLoading
              ? <p className="text-center text-base-content/40 py-6">Loading…</p>
              : docs.length === 0
                ? <p className="text-center text-base-content/30 py-8">No documents uploaded yet</p>
                : (
                  <div className="space-y-2">
                    {docs.map(doc => {
                      const isPdf = doc.file_type === 'application/pdf'
                      const isImg = doc.file_type?.startsWith('image/')
                      const icon = isPdf ? '📄' : isImg ? '🖼️' : doc.file_type?.includes('word') ? '📝' : doc.file_type?.includes('excel') || doc.file_type?.includes('sheet') ? '📊' : '📎'
                      return (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-100">
                          <span className="text-2xl flex-shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <a
                              href={`/api/properties/${property.id}/documents/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium hover:underline truncate block"
                            >
                              {doc.filename}
                            </a>
                            <p className="text-xs text-base-content/40">
                              {new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              {doc.uploaded_by_email && ` · ${doc.uploaded_by_email}`}
                            </p>
                          </div>
                          <a
                            href={`/api/properties/${property.id}/documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-xs btn-ghost"
                            title="Open"
                          >↗</a>
                          {isAdmin && (
                            <button className="btn btn-xs btn-ghost text-error" onClick={() => deleteDoc(doc.id)} title="Delete">✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
            }
          </div>
        )}

        {/* Assign Users tab (admin only) */}
        {tab === 'assign' && isAdmin && (
          <AssignUsersTab
            allUsers={allUsers}
            assignLoading={assignLoading}
            toggleAssign={toggleAssign}
            onViewContact={setViewContactId}
          />
        )}

          </div>{/* end tab content */}
        </div>{/* end left panel */}


        {/* ── Right panel: map / DCF ── */}
        {tab === 'financials' ? (
          <div className="hidden md:flex flex-1 border-l border-base-300 bg-base-100 min-h-0 flex-col">
            <div className="flex-1 p-6 overflow-auto">
              <div className="rounded-2xl border border-base-300 overflow-hidden bg-base-100 shadow-sm min-h-full">
                <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between gap-3 flex-wrap sticky top-0 bg-base-100 z-10">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-base-content/50">Discounted Cash Flow</div>
                  </div>
                  <div className="badge badge-outline">{activeHoldPeriod} Year Hold</div>
                </div>
                <div className="overflow-auto h-full">
                  <table className="table table-pin-rows table-pin-cols text-sm min-w-[1200px]">
                    <thead>
                      <tr className="bg-base-200/80">
                        <th className="min-w-[260px] bg-base-200">Line Item</th>
                        {visibleDcfYears.map((year) => (
                          <th key={year.year} className="text-center bg-base-200 min-w-[140px]">Year {year.year}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DCF_ROW_DEFS.map((row) => (
                        <tr key={row.key} className={row.readOnly ? 'bg-base-200/40' : ''}>
                          <th className="font-medium whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>{row.label}</span>
                              <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/35">{row.category}</span>
                            </div>
                          </th>
                          {visibleDcfYears.map((year, yearIndex) => {
                            const computedValue = row.readOnly ? getComputedDcfValue(year, row.key) : null
                            return (
                              <td key={`${row.key}-${year.year}`} className="align-middle">
                                {row.readOnly ? (
                                  <div className="input input-bordered input-md w-full md:text-base cursor-default flex items-center justify-end" style={{ color: '#000', fontWeight: 700 }}>
                                    {formatMoneyCell(computedValue)}
                                  </div>
                                ) : (
                                  <NumericInput
                                    placeholder="0"
                                    value={year[row.key]}
                                    onChange={(value) => updateDcfCell(yearIndex, row.key, value)}
                                    className="input input-bordered input-md w-full md:text-base text-right"
                                    style={{ color: '#1d4ed8' }}
                                    disabled={!isAdmin}
                                    allowDecimal={false}
                                  />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 border-l border-base-300 bg-base-100 min-h-0 flex-col">
            <div className="flex-1 min-h-0">
              <PropertyMap address={address} />
            </div>
          </div>
        )}

      </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>

      {/* Contact detail overlay — opened from Assign Users tab */}
      {viewContactId && (
        <div className="modal modal-open" style={{ zIndex: 60 }}>
          <div className="modal-box p-0 w-screen h-screen max-w-none max-h-none rounded-none overflow-y-auto">
            <ContactDetailPage
              contactId={viewContactId}
              onBack={() => setViewContactId(null)}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}
    </div>
  )
}

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

/* ─── Properties Page ─────────────────────────────────────────── */

function PropertiesPage({ user }) {
  const [properties, setProperties] = useState([])
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [propertyModalTopOffset, setPropertyModalTopOffset] = useState(64)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list' | 'kanban'
  const [search, setSearch] = useState('')
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
  const filteredProperties = q
    ? properties.filter(p =>
        (p.address || '').toLowerCase().includes(q) ||
        (p.pin || '').toLowerCase().includes(q) ||
        (p.county || '').toLowerCase().includes(q) ||
        (p.status || '').toLowerCase().includes(q)
      )
    : properties

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
              placeholder="Search address, PIN, county…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input input-bordered input-sm pl-8 w-56"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
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

      <PropertyDetailModal
        open={showPropertyModal}
        property={selectedProperty}
        isAdmin={user.role === 'admin'}
        onClose={() => setShowPropertyModal(false)}
        onSave={async (p) => { await saveProperty(p) }}
        topOffset={propertyModalTopOffset}
      />

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
              <tr className="text-xs text-base-content/50 uppercase tracking-wide">
                <th>Address</th>
                <th>County</th>
                <th>PIN</th>
                <th>Price</th>
                <th>Sq Ft</th>
                <th>Year Built</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.map((prop, i) => (
                <tr key={i} className="hover cursor-pointer" onClick={() => openProperty(prop)}>
                  <td className="font-medium max-w-xs truncate">{prop.address}</td>
                  <td className="text-sm text-base-content/60">{prop.county}</td>
                  <td className="font-mono text-xs text-base-content/50">{prop.pin}</td>
                  <td className="text-sm">{fmt(prop.price) || <span className="text-base-content/30">—</span>}</td>
                  <td className="text-sm">{prop.square_feet ? Number(prop.square_feet).toLocaleString() : <span className="text-base-content/30">—</span>}</td>
                  <td className="text-sm">{prop.year_built || <span className="text-base-content/30">—</span>}</td>
                  <td className="text-xs text-base-content/40">
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

/* ─── Phone formatter ─────────────────────────────────────────── */

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  // Strip leading 1
  const local = digits.startsWith('1') ? digits.slice(1) : digits
  const d = local.slice(0, 10)
  if (d.length <= 3) return `+1 (${d}`
  if (d.length <= 6) return `+1 (${d.slice(0,3)}) ${d.slice(3)}`
  return `+1 (${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

/* ─── Photo Cropper ───────────────────────────────────────────── */

function PhotoCropper({ src, onSave, onCancel }) {
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imgRef = useRef(new Image())
  const SIZE = 300

  useEffect(() => {
    const img = imgRef.current
    img.onload = () => {
      // Auto-fit: scale to fill the square
      const fit = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight)
      setScale(fit)
      setOffsetX(0); setOffsetY(0)
      draw(img, fit, 0, 0)
    }
    img.src = src
  }, [src])

  function draw(img, s, ox, oy) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    const w = img.naturalWidth * s
    const h = img.naturalHeight * s
    const x = (SIZE - w) / 2 + ox
    const y = (SIZE - h) / 2 + oy
    ctx.drawImage(img, x, y, w, h)
    // Darken outside circle
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE/2, SIZE/2 - 4, 0, Math.PI*2)
    ctx.fill()
    ctx.restore()
    // Circle border
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE/2, SIZE/2 - 4, 0, Math.PI*2); ctx.stroke()
  }

  useEffect(() => { draw(imgRef.current, scale, offsetX, offsetY) }, [scale, offsetX, offsetY])

  function onMouseDown(e) {
    setDragging(true)
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY })
  }
  function onMouseMove(e) {
    if (!dragging) return
    setOffsetX(e.clientX - dragStart.x)
    setOffsetY(e.clientY - dragStart.y)
  }
  function onMouseUp() { setDragging(false) }

  // Touch support
  function onTouchStart(e) {
    const t = e.touches[0]
    setDragging(true); setDragStart({ x: t.clientX - offsetX, y: t.clientY - offsetY })
  }
  function onTouchMove(e) {
    if (!dragging) return
    const t = e.touches[0]
    setOffsetX(t.clientX - dragStart.x); setOffsetY(t.clientY - dragStart.y)
  }

  function handleSave() {
    const canvas = canvasRef.current
    // Draw final clean circle crop
    const out = document.createElement('canvas')
    out.width = SIZE; out.height = SIZE
    const ctx = out.getContext('2d')
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE/2, SIZE/2, 0, Math.PI*2); ctx.clip()
    const img = imgRef.current
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const x = (SIZE - w) / 2 + offsetX
    const y = (SIZE - h) / 2 + offsetY
    ctx.drawImage(img, x, y, w, h)
    onSave(out.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-2xl p-6 space-y-4 w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-lg text-center">Adjust Profile Photo</h3>
        <p className="text-xs text-base-content/50 text-center">Drag to reposition · Scroll or slider to zoom</p>

        <div className="flex justify-center">
          <canvas ref={canvasRef} width={SIZE} height={SIZE}
            className="rounded-full cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
            onWheel={e => { e.preventDefault(); setScale(s => Math.max(0.5, Math.min(5, s - e.deltaY * 0.001))) }}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-base-content/40">Zoom</span>
          <input type="range" min="0.5" max="5" step="0.01" value={scale}
            onChange={e => setScale(Number(e.target.value))}
            className="range range-xs flex-1" />
        </div>

        <div className="flex gap-3">
          <button className="btn btn-outline flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={handleSave}>Use Photo</button>
        </div>
      </div>
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
  const [cropSrc, setCropSrc] = useState(null) // raw image src waiting to be cropped
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('success')
  const [savedSignal, setSavedSignal] = useState(0)

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsgType('error'); setMsg('Only image files allowed'); return }
    if (file.size > 5 * 1024 * 1024) { setMsgType('error'); setMsg('Photo must be under 5 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setCropSrc(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
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
      setSavedSignal(s => s + 1)
      onUpdate({ ...currentUser, first_name: firstName, last_name: lastName, organization, phone_number: phoneNumber, buy_box: buyBox, profile_photo: photo })
    } catch (e) { setMsgType('error'); setMsg(e.message || 'Save failed') }
    finally { setLoading(false); setTimeout(() => setMsg(''), 4000) }
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || currentUser.email

  return (
    <div className="max-w-2xl mx-auto">
      {cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onSave={dataUrl => { setPhoto(dataUrl); setCropSrc(null) }}
          onCancel={() => setCropSrc(null)}
        />
      )}
      <h2 className="text-2xl font-bold mb-8">My Profile</h2>
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
                onChange={e => setPhoneNumber(formatPhone(e.target.value))} className="input input-bordered w-full" />
            </Field>
          </div>
          {msg && (
            <div className={`alert text-sm ${msgType === 'error' ? 'alert-error' : 'alert-success'}`}>{msg}</div>
          )}
          <div className="pt-2">
            <SaveButton type="submit" loading={loading} disabled={!photo} savedSignal={savedSignal} label="Save Profile" />
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Root App ────────────────────────────────────────────────── */

/* ─── Shared reCAPTCHA helper (module-scope) ──────────────────── */

async function getRecaptchaToken(action) {
  try {
    await new Promise((resolve, reject) => {
      if (window.grecaptcha?.enterprise) return resolve()
      let attempts = 0
      const interval = setInterval(() => {
        if (window.grecaptcha?.enterprise) { clearInterval(interval); resolve() }
        else if (++attempts > 30) { clearInterval(interval); reject(new Error('timeout')) }
      }, 100)
    })
    return await window.grecaptcha.enterprise.execute('6LerA3ctAAAAAKpS3caYCY9pDLR26TQY060EFpYv', { action })
  } catch { return null }
}

/* ─── Forgot / Reset Password Modal ──────────────────────────── */

function ForgotPasswordModal({ onClose, prefillEmail }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState(prefillEmail || '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [captchaStatus, setCaptchaStatus] = useState(null) // null | 'verifying' | 'success' | 'denied'

  useEffect(() => {
    if (!document.getElementById('recaptcha-script')) {
      const s = document.createElement('script')
      s.id = 'recaptcha-script'
      s.src = 'https://www.google.com/recaptcha/enterprise.js?render=6LerA3ctAAAAAKpS3caYCY9pDLR26TQY060EFpYv'
      s.async = true; s.defer = true
      document.head.appendChild(s)
    }
  }, [])

  async function sendCode(e) {
    e.preventDefault()
    setMsg(''); setLoading(true); setCaptchaStatus('verifying')
    try {
      const recaptchaToken = await getRecaptchaToken('FORGOT_PASSWORD')
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken })
      })
      const data = await res.json()
      if (!res.ok) {
        setCaptchaStatus('denied')
        setTimeout(() => setCaptchaStatus(null), 2500)
        return setMsg(data.error || 'Failed to send code.')
      }
      setCaptchaStatus('success')
      await new Promise(r => setTimeout(r, 700))
      setCaptchaStatus(null)
      setStep('code')
    } catch {
      setCaptchaStatus('denied')
      setTimeout(() => setCaptchaStatus(null), 2500)
      setMsg('Network error. Please try again.')
    }
    finally { setLoading(false) }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setMsg('')
    if (newPassword !== confirmPassword) return setMsg('Passwords do not match')
    if (newPassword.length < 8) return setMsg('Password must be at least 8 characters')
    setLoading(true)
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      })
      const data = await res.json()
      if (!res.ok) return setMsg(data.error || 'Reset failed')
      setSuccess(true)
    } catch { setMsg('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">
            {success ? 'Password Reset' : step === 'email' ? 'Forgot Password' : 'Enter Code'}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <p className="font-medium">Your password has been reset.</p>
            <p className="text-sm text-base-content/50">You can now sign in with your new password.</p>
            <button className="btn btn-primary w-full" onClick={onClose}>Sign In</button>
          </div>
        ) : step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <p className="text-sm text-base-content/50">Enter your email and we'll send you a 6-digit code.</p>
            <Field label="Email" required>
              <input type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)} className="input input-bordered w-full" required />
            </Field>
            {msg && <div className="alert alert-error text-sm">{msg}</div>}
            {captchaStatus && (
              <div className="flex justify-center">
                <RecaptchaShield status={captchaStatus} />
              </div>
            )}
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <p className="text-sm text-base-content/50">
              A 6-digit code was sent to <strong>{email}</strong>. It expires in 15 minutes.
            </p>
            <Field label="Code" required>
              <input type="text" placeholder="000000" value={code} maxLength={6}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="input input-bordered w-full text-center tracking-[0.5em] text-xl font-bold" required />
            </Field>
            <Field label="New Password" required>
              <input type="password" placeholder="Min. 8 characters" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} className="input input-bordered w-full" required />
            </Field>
            <Field label="Confirm Password" required>
              <input type="password" placeholder="Repeat password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} className="input input-bordered w-full" required />
            </Field>
            {msg && <div className="alert alert-error text-sm">{msg}</div>}
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm w-full"
              onClick={() => { setStep('email'); setMsg('') }}>
              ← Back
            </button>
          </form>
        )}
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>
    </div>
  )
}

/* ─── Contacts Page ──────────────────────────────────────────────── */

async function downloadAttachment(userId, noteId, attachId, filename) {
  const res = await fetch(`/api/contacts/${userId}/notes/${noteId}/attachments/${attachId}`, { credentials: 'include' })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function fmtLastLogin(ts) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function OnlineDot({ online }) {
  return (
    <span
      title={online ? 'Online' : 'Offline'}
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-green-500' : 'bg-red-400'}`}
    />
  )
}

function fmtLastNote(ts) {
  if (!ts) return null
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffH   = Math.floor(diffMs / 3600000)
  const diffD   = Math.floor(diffMs / 86400000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffH < 24)   return `${diffH}h ago`
  if (diffD < 7)    return `${diffD}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffD > 365 ? 'numeric' : undefined })
}

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
            <span className={`badge badge-xs mt-1 ${contact.role === 'admin' ? 'badge-error' : 'badge-primary'}`}>{contact.role}</span>
          </div>
        </div>
        {/* Details */}
        <div className="space-y-1 text-sm">
          {contact.organization && (
            <div className="text-base-content/70 truncate">{contact.organization}</div>
          )}
          <div><PhoneLink phone={contact.phone_number} /></div>
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
      const full = await apiFetch(`/api/properties/${propId}`)
      setViewProp(full)
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
                <span className={`badge ${user.role === 'admin' ? 'badge-error' : 'badge-primary'}`}>{user.role}</span>
              </div>
              <EmailLink email={user.email} />
              {user.phone_number && <div className="text-sm"><PhoneLink phone={user.phone_number} /></div>}
              {user.organization && <div className="text-sm text-base-content/60">{user.organization}</div>}
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
          {user.buy_box && (
            <div className="mt-4 pt-4 border-t border-base-200">
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-1">Buy Box</p>
              <BuyBoxEditor userId={user.id} initialValue={user.buy_box} />
            </div>
          )}
          {!user.buy_box && (
            <div className="mt-4 pt-4 border-t border-base-200">
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/40 mb-1">Buy Box</p>
              <BuyBoxEditor userId={user.id} initialValue="" />
            </div>
          )}
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
      <PropertyDetailModal
        open={propModalOpen}
        property={viewProp}
        isAdmin={isAdmin}
        onClose={() => { setPropModalOpen(false); setViewProp(null) }}
        onSave={() => { setPropModalOpen(false); setViewProp(null) }}
      />
    </div>
  )
}

function ContactsPage() {
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
  const [onlineStatus, setOnlineStatus] = useState({ online: [], lastLogin: {} })
  const [search, setSearch] = useState('')

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
    apiFetch('/api/online-status').then(d => setOnlineStatus(d)).catch(() => {})
    const t = setInterval(() => apiFetch('/api/online-status').then(d => setOnlineStatus(d)).catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [])

  const openNotes = (c) => setSelectedContact(c)
  const closeNotes = () => setSelectedContact(null)
  const refreshContacts = () => setRefreshKey(k => k + 1)
  const openDetail = (c) => setDetailId(c.id)
  const closeDetail = () => setDetailId(null)

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

  const adminContacts = contacts.filter(c => c.role === 'admin')
  const userContacts = contacts.filter(c => c.role === 'user')
  const otherContacts = contacts.filter(c => c.role !== 'admin' && c.role !== 'user')

  const cq = search.trim().toLowerCase()
  const filteredContacts = cq
    ? contacts.filter(c =>
        [c.first_name, c.last_name, c.email, c.organization, c.phone_number]
          .filter(Boolean).some(v => v.toLowerCase().includes(cq))
      )
    : contacts

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
              placeholder="Search name, email, org…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input input-bordered input-sm pl-8 w-52"
            />
            {search && (
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
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

      {!loading && contacts.length > 0 && filteredContacts.length === 0 && (
        <div className="py-10 text-center text-base-content/30">
          <p>No contacts match &ldquo;{search}&rdquo;</p>
          <button className="btn btn-xs btn-ghost mt-2" onClick={() => setSearch('')}>Clear search</button>
        </div>
      )}

      {!loading && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map(c => (
            <div key={c.id} onDoubleClick={() => openDetail(c)} className="cursor-pointer select-none">
              <ContactCard contact={c} onViewNotes={openNotes} />
            </div>
          ))}
        </div>
      )}

      {!loading && view === 'list' && (
        <div className="rounded-box border border-base-200 overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-base-content/50">
                <th className="w-10">Photo</th>
                <th>Name</th>
                <th className="hidden md:table-cell">Email</th>
                <th className="w-16">Role</th>
                <th className="hidden lg:table-cell">Organization</th>
                <th className="hidden sm:table-cell">Phone</th>
                <th className="hidden xl:table-cell">Buy Box</th>
                <th className="text-center w-14">Notes</th>
                <th className="hidden sm:table-cell w-24">Last Login</th>
                <th className="hidden md:table-cell text-center w-20">Last Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(c => {
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
                    <td>
                      <div className="font-medium whitespace-nowrap">{fullName}</div>
                      <div className="md:hidden mt-0.5"><EmailLink email={c.email} /></div>
                    </td>
                    <td className="hidden md:table-cell text-sm"><EmailLink email={c.email} /></td>
                    <td><span className={`badge badge-sm ${c.role === 'admin' ? 'badge-error' : 'badge-primary'}`}>{c.role}</span></td>
                    <td className="hidden lg:table-cell text-sm">{c.organization || <span className="text-base-content/30">—</span>}</td>
                    <td className="hidden sm:table-cell text-sm"><PhoneLink phone={c.phone_number} /></td>
                    <td className="hidden xl:table-cell text-sm max-w-[180px]">
                      <span className="line-clamp-2 text-base-content/60">{c.buy_box || <span className="text-base-content/30">—</span>}</span>
                    </td>
                    <td className="text-center"><span className="badge badge-ghost badge-sm">{c.note_count}</span></td>
                    <td className="hidden sm:table-cell text-xs whitespace-nowrap">
                      <span className={isOnline ? 'text-green-600 font-medium' : 'text-base-content/50'}>
                        {isOnline ? '● Online' : fmtLastLogin(lastLogin)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell text-center text-xs text-base-content/50 whitespace-nowrap">
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
        const fAdmin = filteredContacts.filter(c => c.role === 'admin')
        const fUser = filteredContacts.filter(c => c.role === 'user')
        const fOther = filteredContacts.filter(c => c.role !== 'admin' && c.role !== 'user')
        return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[['Admin', fAdmin, 'badge-error'], ['User', fUser, 'badge-primary'], ['Archived', fOther, 'badge-ghost']].map(([col, items, badgeCls]) => (
            <div key={col} className="bg-base-200 rounded-box p-4 flex flex-col gap-3 min-h-[200px]">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm uppercase tracking-widest">{col}</h3>
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
                {filteredContacts.length}{filteredContacts.length !== contacts.length ? `/${contacts.length}` : ''} Contacts
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.map(c => {
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
                    <span className={`badge badge-xs flex-shrink-0 ${c.role === 'admin' ? 'badge-error' : 'badge-primary'}`}>{c.role}</span>
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

  // Show/hide reCAPTCHA badge based on whether user is identified
  useEffect(() => {
    if (currentUser || loginPreview) {
      document.body.classList.remove('recaptcha-hidden')
    } else {
      document.body.classList.add('recaptcha-hidden')
    }
  }, [currentUser, loginPreview])

  function navigateTo(p) {
    if ((p === 'users' || p === 'audit') && currentUser?.role !== 'admin') return
    if (p === 'contacts') setContactsKey(k => k + 1) // reset ContactsPage state
    setPage(p); localStorage.setItem('rep_page', p)
  }

  // Restore session on page load/refresh
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setCurrentUser(data.user)
          const saved = localStorage.getItem('rep_page')
          const adminPages = ['users', 'audit']
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
    ...(currentUser.role === 'admin' ? [{ id: 'users', label: 'Users' }, { id: 'contacts', label: 'Contacts' }, { id: 'audit', label: 'Audit Logs' }] : []),
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
          <ContactsPage key={contactsKey} />
        )}

        {page === 'audit' && currentUser.role === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Audit Logs</h2>
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
