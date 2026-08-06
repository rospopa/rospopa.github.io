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

/* ─── FOMC Calendar Widget ────────────────────────────────────── */
// Displays upcoming Federal Reserve FOMC meeting dates.
// Data sourced from FRED API (official St. Louis Fed) or hardcoded fallback.

function CalendarWidget() {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [meetings, setMeetings]   = useState([]) // { decision_date, start_date, end_date, source }
  const [indicators, setIndicators] = useState([]) // { date, label, category }
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState(null) // { day, meetings, indicators }

  useEffect(() => {
    setLoading(true)
    setSelected(null)
    Promise.all([
      fetch(`/api/fomc-meetings?year=${year}&month=${month}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/econ-indicators?year=${year}&month=${month}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([fomcData, econData]) => {
      setMeetings(fomcData.meetings || [])
      setIndicators(econData.indicators || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [year, month])

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow    = new Date(year, month - 1, 1).getDay()

  // Index meetings by each day they span (start..end or just decision day)
  // Slice to YYYY-MM-DD first — Postgres may return full ISO timestamp strings
  const byDay = {}
  for (const m of meetings) {
    const dec   = String(m.decision_date).slice(0, 10)
    const start = m.start_date ? String(m.start_date).slice(0, 10) : dec
    const end   = m.end_date   ? String(m.end_date).slice(0, 10)   : dec
    const decDay   = parseInt(dec.slice(8), 10)
    const startDay = parseInt(start.slice(8), 10)
    const endDay   = parseInt(end.slice(8), 10)
    for (let d = startDay; d <= endDay; d++) {
      const isDecision = d === decDay
      if (!byDay[d]) byDay[d] = []
      byDay[d].push({ ...m, isDecision, day: d })
    }
  }

  // Index economic indicators by day number
  const indicByDay = {}
  for (const ind of indicators) {
    const day = parseInt(String(ind.date).slice(8), 10)
    if (!indicByDay[day]) indicByDay[day] = []
    indicByDay[day].push(ind)
  }

  // Color map for indicator categories
  const INDIC_COLORS = {
    ism:     'bg-blue-500',
    retail:  'bg-purple-500',
    trade:   'bg-teal-500',
    gscpi:   'bg-green-600',
    ip:      'bg-orange-500',
    default: 'bg-indigo-400',
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const todayKey = today.getFullYear() === year && today.getMonth() + 1 === month
    ? today.getDate() : -1

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const isPast = (day) => {
    const cellDate = new Date(year, month - 1, day)
    return cellDate < today
  }

  return (
    <div className="card bg-base-100 border border-base-300 w-full">
      <div className="card-body p-4 sm:p-6 md:p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-base-content/50">Federal Reserve</h3>
            <p className="text-xs text-base-content/40 mt-0.5">FOMC Meeting Schedule</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn btn-sm btn-ghost px-3" onClick={prevMonth} aria-label="Previous month">‹</button>
            <span className="text-base sm:text-lg font-semibold min-w-[160px] text-center">
              {MONTHS[month-1]} {year}
            </span>
            <button className="btn btn-sm btn-ghost px-3" onClick={nextMonth} aria-label="Next month">›</button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-xs sm:text-sm">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400 flex-shrink-0"/><span className="text-base-content/70">FOMC Meeting</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-red-500 flex-shrink-0"/><span className="text-base-content/70">Rate Decision</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-blue-500 flex-shrink-0"/><span className="text-base-content/70">ISM</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-purple-500 flex-shrink-0"/><span className="text-base-content/70">Retail Sales</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-teal-500 flex-shrink-0"/><span className="text-base-content/70">Trade</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-green-600 flex-shrink-0"/><span className="text-base-content/70">GSCPI</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-orange-500 flex-shrink-0"/><span className="text-base-content/70">Ind. Production</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-primary flex-shrink-0"/><span className="text-base-content/70">Today</span></span>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1 border-b border-base-300 pb-2">
          {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
            <div key={d} className="text-center font-semibold text-base-content/40 py-1
              text-[10px] sm:text-xs md:text-sm">
              <span className="hidden md:inline">{d}</span>
              <span className="hidden sm:inline md:hidden">{d.slice(0,3)}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-base-content/40 text-sm">Loading…</div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return (
                <div key={`e${i}`} className="border-b border-r border-base-200 min-h-[56px] sm:min-h-[80px] md:min-h-[100px]
                  [&:nth-child(7n+1)]:border-l bg-base-200/30" />
              )
              const dayMeetings  = byDay[day] || []
              const dayIndicators = indicByDay[day] || []
              const isToday      = day === todayKey
              const isSelected   = selected?.day === day
              const hasMeeting   = dayMeetings.length > 0
              const hasDecision  = dayMeetings.some(m => m.isDecision)
              const hasIndicator = dayIndicators.length > 0
              const hasAny       = hasMeeting || hasIndicator
              const past         = isPast(day)

              // Cell background — FOMC takes precedence
              let cellBg = ''
              if (hasDecision) cellBg = past ? 'bg-red-100 dark:bg-red-900/20' : 'bg-red-50 dark:bg-red-900/30'
              else if (hasMeeting) cellBg = past ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-amber-50/80 dark:bg-amber-900/20'
              if (isSelected) cellBg = 'bg-primary/10'

              return (
                <button
                  key={day}
                  onClick={() => hasAny && setSelected(isSelected ? null : { day, meetings: dayMeetings, indicators: dayIndicators })}
                  className={`border-b border-r border-base-200 [&:nth-child(7n+1)]:border-l
                    min-h-[56px] sm:min-h-[80px] md:min-h-[100px]
                    flex flex-col items-start p-1 sm:p-2 transition-colors text-left w-full
                    ${cellBg || 'hover:bg-base-100'}
                    ${hasAny ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {/* Day number */}
                  <span className={`text-xs sm:text-sm font-medium rounded-full
                    w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center flex-shrink-0
                    ${isToday ? 'bg-primary text-primary-content font-bold' : past ? 'text-base-content/40' : 'text-base-content'}`}>
                    {day}
                  </span>

                  {/* Mobile: colored dots row */}
                  {hasAny && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5 sm:hidden">
                      {hasMeeting && <span className={`w-1.5 h-1.5 rounded-full ${hasDecision ? 'bg-red-500' : 'bg-amber-400'}`}/>}
                      {dayIndicators.map((ind, j) => (
                        <span key={j} className={`w-1.5 h-1.5 rounded-full ${INDIC_COLORS[ind.category] || INDIC_COLORS.default}`}/>
                      ))}
                    </div>
                  )}

                  {/* Tablet+: pill labels */}
                  {hasAny && (
                    <div className="hidden sm:flex flex-col gap-0.5 mt-1 w-full overflow-hidden">
                      {hasMeeting && (
                        <span className={`text-[10px] md:text-xs font-medium rounded px-1.5 py-0.5 truncate leading-tight
                          ${hasDecision ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>
                          {hasDecision ? '📊 Rate Decision' : '🏛 FOMC Meeting'}
                        </span>
                      )}
                      {dayIndicators.map((ind, j) => (
                        <span key={j} className={`text-[10px] md:text-xs font-medium rounded px-1.5 py-0.5 truncate leading-tight text-white ${INDIC_COLORS[ind.category] || INDIC_COLORS.default}`}>
                          {ind.short_label || ind.label}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Selected day detail panel */}
        {selected && (
          <div className="mt-4 border-t border-base-300 pt-4">
            {selected.meetings.map((m, i) => {
              const toDate = (s) => s ? new Date(String(s).slice(0,10) + 'T12:00:00') : null
              const decDate   = toDate(m.decision_date)
              const startDate = toDate(m.start_date) || decDate
              const endDate   = toDate(m.end_date)   || decDate
              const isTwoDay  = m.start_date !== m.end_date
              const future    = decDate >= today
              const source    = m.source || 'fallback'
              return (
                <div key={i} className="flex gap-3 items-start">
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.isDecision ? 'bg-red-500' : 'bg-amber-400'}`}/>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">
                      {m.isDecision ? 'Rate Decision Day' : 'FOMC Meeting Day'}
                    </p>
                    <p className="text-sm text-base-content/60">
                      {isTwoDay
                        ? `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                        : decDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    {m.isDecision && (
                      <p className="text-xs text-base-content/40">
                        {future ? '⏳ Upcoming' : '✅ Completed'} · Statement released ~2:00 PM ET
                      </p>
                    )}
                    <p className="text-[10px] text-base-content/30 mt-1">
                      Source: {source === 'fred' || source === 'fred+fallback' ? 'FRED / Federal Reserve (St. Louis Fed)' : 'Published FOMC schedule'}
                    </p>
                  </div>
                </div>
              )
            })}
            {/* Economic indicators for selected day */}
            {(selected.indicators || []).map((ind, i) => (
              <div key={`ind-${i}`} className="flex gap-3 items-start mt-2">
                <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${INDIC_COLORS[ind.category] || INDIC_COLORS.default}`}/>
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm">{ind.label}</p>
                  {ind.description && <p className="text-xs text-base-content/50">{ind.description}</p>}
                  <p className="text-[10px] text-base-content/30">Economic Release · {new Date(String(ind.date).slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer: months with no events */}
        {!loading && meetings.length === 0 && indicators.length === 0 && (
          <p className="mt-4 text-sm text-base-content/40 text-center">No scheduled events this month</p>
        )}

        {/* Upcoming meetings summary strip */}
        {!loading && meetings.length > 0 && !selected && (
          <div className="mt-4 border-t border-base-300 pt-3">
            <p className="text-xs text-base-content/40 mb-2 font-semibold uppercase tracking-widest">This month</p>
            <div className="flex flex-wrap gap-2">
              {[...new Map(meetings.map(m => [m.decision_date, m])).values()].map((m, i) => {
                const decDate = new Date(String(m.decision_date).slice(0,10) + 'T12:00:00')
                const future  = decDate >= today
                return (
                  <span key={i} className={`badge badge-sm gap-1 ${future ? 'badge-outline' : 'badge-ghost opacity-60'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>
                    {decDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {future ? ' ↑' : ' ✓'}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


/** Text input that displays numbers with comma formatting; stores raw digits in state */
function NumericInput({ value, onChange, placeholder, className, disabled, allowDecimal }) {
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
          Capitalization Rate
        </span>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600,
          fontSize: '0.7rem',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          opacity: 0.45,
        }}>
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
      {msg && <div className={`alert ${msgType === 'error' ? 'alert-error' : 'alert-success'} text-sm`}>{msg}</div>}
      <button className="btn btn-primary w-full" type="submit" disabled={loading || !photo}>
        {loading ? 'Creating…' : 'Create User'}
      </button>
    </form>
  )
}

/* ─── Audit Logs ──────────────────────────────────────────────── */

const ACTION_LABELS = {
  register:         (d, t) => `New account registered (${t || d?.email || ''})`,
  login:            (d)    => `Signed in`,
  login_failed:     (d, t) => `Failed sign-in attempt for ${t || d?.email || 'unknown email'}`,
  recaptcha_failed: (d)    => `Security check failed (score: ${d?.score ?? '?'}, reason: ${d?.reason || '?'})`,
  logout:           ()     => `Signed out`,
  create_user:      (d, t) => `Created user ${t || ''} with role "${d?.role || 'user'}"`,
  edit_user:        (d, t) => `Updated profile of ${t || 'user'}${d?.changed_fields?.length ? ` — fields: ${d.changed_fields.join(', ')}` : ''}`,
  delete_user:      (d, t) => `Deleted user ${t || ''}`,
  role_change:      (d, t) => `Changed role of ${t || 'user'} from "${d?.from}" to "${d?.to}"`,
  create_property:  (d)    => `Added property — ${d?.address || ''} (PIN: ${d?.pin || ''}, ${d?.county || ''})`,
  edit_property:    (d)    => `Edited property — ${d?.address || `ID ${d?.property_id || ''}`}${d?.changed_fields?.length ? ` — ${d.changed_fields.length} field(s) changed` : ''}`,
  delete_property:  (d)    => `Deleted property ID ${d?.property_id || ''}`,
  assign_property:  (d)    => `Assigned property ID ${d?.property_id || ''} to ${d?.user_count || 0} user(s)`,
  unassign_property:(d)    => `Removed access to property ID ${d?.property_id || ''} from user ID ${d?.user_id || ''}`,
  upload_document:  (d)    => `Uploaded document "${d?.filename || ''}" to property ID ${d?.property_id || ''}`,
  delete_document:  (d)    => `Deleted document ID ${d?.doc_id || ''} from property ID ${d?.property_id || ''}`,
  delete_media:     (d)    => `Deleted media ID ${d?.media_id || ''} from property ID ${d?.property_id || ''}`,
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

                const FIELD_LABELS = {
                  pin: 'PIN', address: 'Address', county: 'County',
                  price: 'Price ($)', square_feet: 'Square Feet', lot_size: 'Lot Size (ac)',
                  year_built: 'Year Built', on_major_road: 'On Major Road', traffic_vpd: 'Traffic VPD',
                  on_corner_lot: 'Corner Lot', direct_water_access: 'Direct Water Access',
                  next_to_public_land: 'Next to Public Land', major_interstates: 'Major Interstates',
                  household_income_min: 'Income Min ($)', household_income_max: 'Income Max ($)',
                  population_density: 'Population Density', logistics_hubs: 'Logistics Hubs',
                  landmarks: 'Landmarks', water_sources: 'Water Sources', military_bases: 'Military Bases',
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
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0
              ? <tr><td colSpan={7} className="text-center py-8 text-base-content/40">No users found</td></tr>
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
                  <td className="py-3 px-4 text-right">
                    <button className="btn btn-xs btn-ghost" onClick={() => onEdit?.(u)}>Edit</button>
                  </td>
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
      setTab('details')
    }
  }, [property, open])

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
    ? ['details', 'media', 'documents', ...(isAdmin ? ['assign'] : [])]
    : ['details']

  const tabLabel = { details: 'Details', media: 'Media', documents: 'Documents', assign: 'Assign Users' }

  return (
    <div className="modal modal-open">
      {/* Wide container: left form + right map */}
      <div className="modal-box p-0 w-screen h-screen max-w-none max-h-none rounded-none flex flex-col md:flex-row overflow-hidden">

        {/* ── Left panel: form ── */}
        <div className="flex flex-col w-full md:w-[480px] md:flex-shrink-0 overflow-y-auto max-h-screen">
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-base-300">
            <h3 className="font-bold text-xl">
              {property?.id ? property.address : 'New Property'}
            </h3>
            <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
          </div>

          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="tabs tabs-bordered px-6 pt-2">
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

            {/* Financials */}
            <div className="divider text-xs text-base-content/40 my-1">Financials</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Price ($)">
                <NumericInput placeholder="0" value={price}
                  onChange={setPrice} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Square Feet">
                <NumericInput placeholder="0" value={sqft}
                  onChange={setSqft} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Lot Size (acres)">
                <input type="number" placeholder="0.00" step="0.01" value={lot}
                  onChange={e => setLot(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Year Built">
                <input type="number" placeholder="e.g. 1998" value={yearBuilt}
                  onChange={e => setYearBuilt(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            </div>

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

          </div>{/* end tab content */}
        </div>{/* end left panel */}

        {/* ── Right panel: map (only when Details tab active and property has address) ── */}
        {tab === 'details' && (
          <div className="hidden md:flex flex-1 border-l border-base-300" style={{ minHeight: '500px' }}>
            <PropertyMap address={address} />
          </div>
        )}

      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>
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
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list' | 'kanban'
  const isAdmin = user.role === 'admin'

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
        {user.role === 'admin' && (
          <button className="btn btn-primary btn-sm" onClick={() => { setSelectedProperty(null); setShowPropertyModal(true) }}>
            + New Property
          </button>
        )}
        {user.role !== 'admin' && <div />}

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
      />

      {loading && <p className="text-base-content/40 text-sm">Loading…</p>}

      {!loading && properties.length === 0 && (
        <div className="py-16 text-center text-base-content/30">
          <p className="text-lg">No properties yet</p>
          {user.role === 'admin' && <p className="text-sm mt-1">Click &quot;+ New Property&quot; to add one</p>}
          {user.role !== 'admin' && <p className="text-sm mt-1">Properties assigned to you will appear here</p>}
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {effectiveView === 'grid' && !loading && properties.length > 0 && (
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
      {effectiveView === 'list' && !loading && properties.length > 0 && (
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
              {properties.map((prop, i) => (
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
      {effectiveView === 'kanban' && !loading && properties.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map(col => {
            const colProps = properties.filter(p => (p.status || 'New') === col.status)
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

function ContactDetailPage({ contactId, onBack, splitMode = false }) {
  const [data, setData] = useState(null)
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [notesLoading, setNotesLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

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
                <div key={p.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-base-200/60 hover:bg-base-200 transition-colors">
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
                  </div>
                </div>
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
    </div>
  )
}

function ContactsPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(() => localStorage.getItem('contacts_view') || 'split')
  const [selectedContact, setSelectedContact] = useState(null) // notes drawer
  const [detailId, setDetailId] = useState(null)              // full-page detail
  const [splitDetailId, setSplitDetailId] = useState(() => {
    const saved = localStorage.getItem('contacts_split_id')
    return saved ? Number(saved) : null
  })
  const [refreshKey, setRefreshKey] = useState(0)

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
      />
    )
  }

  const adminContacts = contacts.filter(c => c.role === 'admin')
  const userContacts = contacts.filter(c => c.role === 'user')
  const otherContacts = contacts.filter(c => c.role !== 'admin' && c.role !== 'user')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Contacts</h2>
          <p className="text-xs text-base-content/40 mt-0.5">
            {view === 'split' ? 'Click a contact to view details' : 'Double-click any contact to open full profile'}
          </p>
        </div>
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

      {loading && <div className="text-center py-12 text-base-content/50">Loading contacts…</div>}

      {!loading && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map(c => (
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
                <th className="hidden md:table-cell text-center w-20">Last Note</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => {
                const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email
                return (
                  <tr key={c.id} className="hover cursor-pointer" onDoubleClick={() => openDetail(c)}>
                    <td><ContactAvatar contact={c} size="sm" /></td>
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

      {!loading && view === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[['Admin', adminContacts, 'badge-error'], ['User', userContacts, 'badge-primary'], ['Archived', otherContacts, 'badge-ghost']].map(([col, items, badgeCls]) => (
            <div key={col} className="bg-base-200 rounded-box p-4 flex flex-col gap-3 min-h-[200px]">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm uppercase tracking-widest">{col}</h3>
                <span className={`badge badge-sm ${badgeCls}`}>{items.length}</span>
              </div>
              {items.length === 0 && <div className="text-sm text-base-content/40 text-center py-6">Empty</div>}
              <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-0.5">
                {items.map(c => {
                  const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email
                  return (
                    <div key={c.id} className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer select-none"
                      onDoubleClick={() => openDetail(c)}>
                      <div className="card-body p-3 gap-2">
                       <div className="flex items-center gap-2">
                         <ContactAvatar contact={c} size="sm" />
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
                         {c.last_note_at && (
                           <span className="text-[10px] text-base-content/40">last: {fmtLastNote(c.last_note_at)}</span>
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
      )}

      {!loading && view === 'split' && (
        <div className="flex gap-0 border border-base-200 rounded-box overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}>
          {/* Left: contact list */}
          <div className="w-72 flex-shrink-0 border-r border-base-200 flex flex-col bg-base-100 overflow-hidden">
            <div className="px-3 py-2 border-b border-base-200 bg-base-200/40">
              <span className="text-xs font-semibold uppercase tracking-widest text-base-content/50">{contacts.length} Contacts</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {contacts.map(c => {
                const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email
                const isActive = splitDetailId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => selectSplit(c.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-base-200/60 transition-colors
                      ${isActive ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-base-200/60'}`}
                  >
                    <ContactAvatar contact={c} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isActive ? 'text-primary' : ''}`}>{fullName}</div>
                      <div className="text-xs text-base-content/50 truncate">{c.organization || c.email}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-base-content/40">{c.note_count} {c.note_count === 1 ? 'note' : 'notes'}</span>
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
                      <p className="text-sm text-base-content/50">Welcome back</p>
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
              <span className="text-xs text-base-content/50 font-normal">Welcome back,</span>
              <span className="text-sm font-semibold truncate max-w-[160px]">{currentUser.first_name || currentUser.email.split('@')[0]}</span>
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
        <div className="md:hidden bg-base-100 border-b border-base-300 px-4 py-3 flex flex-col gap-1 sticky top-[64px] z-40 shadow-md">
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
              Welcome back, {currentUser.first_name || currentUser.email.split('@')[0]}
            </h1>
            <CalendarWidget />
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
