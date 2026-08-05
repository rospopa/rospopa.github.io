import { useEffect, useState } from 'react'
import './App.css'

function Logo() {
  return (
    <div className="logo" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" role="img">
      <circle cx="12" cy="12" r="10" fill="#000" />
      <circle cx="12" cy="12" r="6" fill="#fff" />
      <circle cx="12" cy="12" r="2" fill="#000" />
      </svg>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '' })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => setUser(data.user || null))
      .catch(() => setUser(null))
  }, [])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    setLoading(true)
    const url = mode === 'login' ? '/api/login' : '/api/register'
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Request failed')
        setLoading(false)
        return
      }
      setUser({ id: data.id, email: data.email })
      setForm({ email: '', password: '' })
    } catch (err) {
      setMsg('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    setUser(null)
  }

  if (user) {
    return (
      <div className="app-root">
        <div className="card welcome center">
          <Logo />
          <h2>Welcome</h2>
          <div className="row">
            <button className="btn primary" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-root">
      <div className="dynamic-bg" aria-hidden="true">
        <svg className="bg-clouds" viewBox="0 0 1200 180" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="cloudGrad1" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="cloudGrad2" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="cloudGrad3" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.6" />
            </linearGradient>
            <filter id="cloudBlur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feMerge><feMergeNode in="b" /></feMerge>
            </filter>
          </defs>

          {/* varied rounded clouds: different sizes, opacities and morph timings */}
          <path fill="url(#cloudGrad1)" filter="url(#cloudBlur)" opacity="0.95" d="M30 80c40-40 120-40 180-10s90 60 170 40 160-60 260-20 160 40 220 10v60H30z">
            <animate attributeName="d" dur="16s" repeatCount="indefinite" values="M30 80c40-40 120-40 180-10s90 60 170 40 160-60 260-20 160 40 220 10v60H30z;
                                                                                             M10 90c60-10 120-10 200 10s80 40 160 20 200-40 280-10 140 30 220-10v60H10z;
                                                                                             M50 70c30-50 140-30 200-6s100 48 180 28 140-48 240-8 180 34 240 6v60H50z;
                                                                                             M30 80c40-40 120-40 180-10s90 60 170 40 160-60 260-20 160 40 220 10v60H30z" />
            <animate attributeName="opacity" dur="16s" repeatCount="indefinite" values="0.95;0.6;0.85;0.95" />
          </path>

          <path fill="url(#cloudGrad2)" filter="url(#cloudBlur)" opacity="0.9" d="M480 40c50-24 110-12 160 12s70 44 140 24 160-36 220-6 110 34 170 14v48H480z">
            <animate attributeName="d" dur="20s" repeatCount="indefinite" values="M480 40c50-24 110-12 160 12s70 44 140 24 160-36 220-6 110 34 170 14v48H480z;
                                                                                              M460 50c40-30 120-8 170 12s80 36 150 16 140-28 200-4 120 30 180 10v48H460z;
                                                                                              M500 30c30-8 100-28 170-4s60 44 130 26 130-18 190 6 140 26 200 6v48H500z;
                                                                                              M480 40c50-24 110-12 160 12s70 44 140 24 160-36 220-6 110 34 170 14v48H480z" />
            <animate attributeName="opacity" dur="20s" repeatCount="indefinite" values="0.9;0.58;0.78;0.9" />
          </path>

          <path fill="url(#cloudGrad3)" filter="url(#cloudBlur)" opacity="0.82" d="M880 90c-60-36-140-60-220-34s-140 68-220 48-160-28-220 2-160 24-220-6v44h1000z">
            <animate attributeName="d" dur="18s" repeatCount="indefinite" values="M880 90c-60-36-140-60-220-34s-140 68-220 48-160-28-220 2-160 24-220-6v44h1000z;
                                                                                              M860 80c-40-14-120-40-200-14s-130 52-210 36-180-10-240 14-140 28-200 6v44h980z;
                                                                                              M900 100c-70-40-150-66-230-40s-150 72-230 56-120-2-180 22-160 16-220-12v44h1020z;
                                                                                              M880 90c-60-36-140-60-220-34s-140 68-220 48-160-28-220 2-160 24-220-6v44h1000z" />
            <animate attributeName="opacity" dur="18s" repeatCount="indefinite" values="0.82;0.5;0.72;0.82" />
          </path>

          <path fill="#fff" filter="url(#cloudBlur)" opacity="0.7" d="M240 20c30-10 80-8 120 6s40 24 100 12 120-24 180-2 100 28 160 10v36H240z">
            <animate attributeName="d" dur="12s" repeatCount="indefinite" values="M240 20c30-10 80-8 120 6s40 24 100 12 120-24 180-2 100 28 160 10v36H240z;
                                                                                             M220 30c20-20 90-6 130 8s70 28 130 16 120-20 180 0 80 30 140 8v36H220z;
                                                                                             M260 10c10-6 70-26 120-6s50 36 110 20 140-18 200 4 120 24 180 4v36H260z;
                                                                                             M240 20c30-10 80-8 120 6s40 24 100 12 120-24 180-2 100 28 160 10v36H240z" />
          </path>
        </svg>

        <svg className="bg-buildings" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Distant skyline: more varied silhouettes */}
          <g className="layer layer-3" fill="#f3f3f3" filter="url(#softShadow)">
            <path d="M10 240 L10 170 Q80 140 140 160 L140 240 Z" />
            <path d="M180 240 L180 150 Q260 120 320 150 L320 240 Z" />
            <path d="M360 240 L360 130 Q460 100 520 130 L520 240 Z" />
            <path d="M560 240 L560 140 Q640 110 700 140 L700 240 Z" />
            <path d="M780 240 L780 160 Q860 130 920 160 L920 240 Z" />
            <path d="M960 240 L960 150 Q1040 120 1100 150 L1100 240 Z" />

            {/* windows grids */}
            <g fill="#fff">
              {Array.from({length:6}).map((_,i)=> (
                <rect key={'dw-'+i} x={30 + i*120} y="172" width="22" height="14" rx="2" />
              ))}
            </g>
          </g>

          {/* Midground warehouses: added more blocks and detail */}
          <g className="layer layer-2" fill="#e8e8e8" filter="url(#softShadow)">
            <rect x="0" y="180" width="180" height="64" rx="6" />
            <rect x="200" y="174" width="240" height="76" rx="6" />
            <rect x="460" y="182" width="200" height="64" rx="6" />
            <rect x="680" y="168" width="260" height="84" rx="6" />
            <rect x="960" y="176" width="220" height="68" rx="6" />

            {/* additional docks and doors */}
            <g fill="#d6d6d6">
              <rect x="12" y="194" width="34" height="44" rx="3" />
              <rect x="52" y="194" width="48" height="44" rx="3" />
              <rect x="108" y="194" width="34" height="44" rx="3" />

              <rect x="220" y="196" width="46" height="48" rx="3" />
              <rect x="272" y="196" width="56" height="48" rx="3" />
              <rect x="336" y="196" width="70" height="48" rx="3" />

              <rect x="480" y="196" width="58" height="44" rx="3" />
              <rect x="756" y="200" width="40" height="48" rx="3" />
              <rect x="804" y="200" width="56" height="48" rx="3" />
            </g>
          </g>

          {/* Foreground industrial: more varied blocks, silos and loading ramps */}
          <g className="layer layer-1" fill="#dedede" filter="url(#softShadow)">
            <rect x="40" y="210" width="120" height="46" rx="4" />
            <rect x="180" y="206" width="160" height="50" rx="4" />
            <rect x="360" y="214" width="240" height="42" rx="4" />
            <rect x="620" y="210" width="180" height="46" rx="4" />
            <rect x="820" y="216" width="260" height="38" rx="4" />

            {/* silos / taller elements */}
            <g fill="#e0e0e0">
              <rect x="520" y="160" width="36" height="100" rx="6" />
              <rect x="568" y="150" width="44" height="110" rx="8" />
              <rect x="644" y="150" width="28" height="110" rx="6" />
            </g>

            {/* foreground doors/windows */}
            <g fill="#cfcfcf">
              <rect x="52" y="218" width="28" height="30" rx="3" />
              <rect x="88" y="218" width="36" height="30" rx="3" />
              <rect x="196" y="216" width="30" height="32" rx="3" />
              <rect x="234" y="216" width="30" height="32" rx="3" />
              {Array.from({length:6}).map((_,i)=> (
                <rect key={'pf-'+i} x={372 + i*36} y="222" width={18 + (i%2)*6} height="24" rx="3" />
              ))}
            </g>

            {/* rail line */}
            <rect x="0" y="256" width="1200" height="6" fill="#cfcfcf" />
          </g>
        </svg>
      </div>
      <div className="auth-column">
        <div className="card auth-card center">
          <h2>{mode === 'login' ? 'Commercial Real Estate Investor Portal' : 'Create account'}</h2>

          <form onSubmit={submit} className="form">
          <label className="field">
            <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required autoComplete="email" />
          </label>

          <label className="field">
            <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required autoComplete={mode==='login'? 'current-password' : 'new-password'} />
          </label>

          {msg && <div className="error">{msg}</div>}

          <div className="actions">
            <button className={"btn primary" + (mode==='login' ? ' active' : '')} type="submit" disabled={loading} aria-pressed={mode === 'login'}>
              {loading ? 'Working...' : (
                <>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Login
                </>
              )}
            </button>

            <button type="button" className={"btn ghost" + (mode!=='login' ? ' active' : '')} onClick={() => setMode(mode === 'login' ? 'register' : 'login')} aria-pressed={mode !== 'login'}>
              {mode === 'login' ? (
                <>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Create an account
                </>
              ) : (
                <>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v12" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 9h-14" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Login
                </>
              )}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  )
}
