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
        <svg className="bg-buildings" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Morphing clouds (top of background) */}
          <g className="clouds" aria-hidden="true">
            <path fill="#ffffff" opacity="0.9" d="M50 60c20-20 80-20 120 0s60 40 120 20 140-40 220 0 140 40 200 20 100-60 160-40v40H50z">
              <animate attributeName="d" dur="14s" repeatCount="indefinite" values="M50 60c20-20 80-20 120 0s60 40 120 20 140-40 220 0 140 40 200 20 100-60 160-40v40H50z;
                                                                                               M30 70c30-30 90-10 140 10s40 30 110 10 160-30 200 10 120 40 180 0 120-80 180-40v40H30z;
                                                                                               M60 50c10-10 70-30 130-10s70 50 140 30 120-30 200 0 160 60 220 20 100-60 160-40v40H60z;
                                                                                               M50 60c20-20 80-20 120 0s60 40 120 20 140-40 220 0 140 40 200 20 100-60 160-40v40H50z" />
            </path>

            <path fill="#ffffff" opacity="0.85" d="M600 40c30-12 80-8 120 6s50 30 110 18 100-28 160-4 90 40 150 20v30H600z">
              <animate attributeName="d" dur="18s" repeatCount="indefinite" values="M600 40c30-12 80-8 120 6s50 30 110 18 100-28 160-4 90 40 150 20v30H600z;
                                                                                                 M580 50c20-20 70-10 110 4s60 34 120 22 90-20 150 0 120 40 160 10v30H580z;
                                                                                                 M620 30c10-6 60-22 110-6s40 36 100 22 120-18 180 6 100 34 140 6v30H620z;
                                                                                                 M600 40c30-12 80-8 120 6s50 30 110 18 100-28 160-4 90 40 150 20v30H600z" />
            </path>

            <path fill="#ffffff" opacity="0.8" d="M1000 80c-30-20-80-40-140-20s-80 50-140 40-120-20-180 0-120 10-180-10v30h740z">
              <animate attributeName="d" dur="16s" repeatCount="indefinite" values="M1000 80c-30-20-80-40-140-20s-80 50-140 40-120-20-180 0-120 10-180-10v30h740z;
                                                                                                   M980 70c-20-10-70-30-120-14s-70 44-130 34-140-16-200 6-100 30-160 10v30h820z;
                                                                                                   M1020 90c-40-30-90-50-150-30s-90 60-150 50-100-10-160 10-140 14-200-6v30h840z;
                                                                                                   M1000 80c-30-20-80-40-140-20s-80 50-140 40-120-20-180 0-120 10-180-10v30h740z" />
            </path>
          </g>

          {/* Layer 3: distant skyline (path-based silhouettes + windows) */}
          <g className="layer layer-3" fill="#f3f3f3" filter="url(#softShadow)">
            {/* path silhouette for a more organic rooftop */}
            <path d="M40 240 L40 160 Q110 140 160 160 L160 240 Z" />
            {/* windows grid */}
            <g fill="#fff">
              {Array.from({length:4}).map((_,i)=> (
                <rect key={i} x={48 + i*30} y="172" width="18" height="14" rx="2" />
              ))}
            </g>

            <path d="M220 240 L220 140 Q310 120 380 140 L380 240 Z" />
            <g fill="#fff">
              {Array.from({length:5}).map((_,i)=> (
                <rect key={'w2-'+i} x={228 + i*34} y="152" width={18 + (i%2)*6} height="14" rx="2" />
              ))}
            </g>

            <rect x="460" y="150" width="120" height="90" rx="4" />
            <g fill="#fff">
              <rect x="468" y="162" width="18" height="14" rx="2" />
              <rect x="492" y="162" width="18" height="14" rx="2" />
            </g>

            <path d="M620 240 L620 130 Q720 110 820 130 L820 240 Z" />
            <g fill="#fff">
              {Array.from({length:6}).map((_,i)=> (
                <rect key={'w4-'+i} x={628 + i*34} y="142" width="20" height="16" rx="2" />
              ))}
            </g>

            <rect x="940" y="155" width="160" height="85" rx="4" />
          </g>

          {/* Layer 2: midground warehouses with varied door widths and subtle shadows */}
          <g className="layer layer-2" fill="#e8e8e8" filter="url(#softShadow)">
            <rect x="0" y="180" width="200" height="60" rx="4" />
            {/* docking doors (variable widths) */}
            <g fill="#d6d6d6">
              <rect x="16" y="190" width="30" height="36" rx="2" />
              <rect x="54" y="190" width="46" height="36" rx="2" />
              <rect x="106" y="190" width="54" height="36" rx="2" />
            </g>
            {/* bay shadows */}
            <rect x="0" y="232" width="200" height="6" fill="#e0e0e0" />

            <rect x="220" y="170" width="260" height="70" rx="4" />
            {/* long loading doors (mixed widths) */}
            <g fill="#dcdcdc">
              <rect x="236" y="190" width="40" height="40" rx="2" />
              <rect x="284" y="190" width="56" height="40" rx="2" />
              <rect x="344" y="190" width="72" height="40" rx="2" />
            </g>
            <rect x="520" y="178" width="220" height="62" rx="4" />
            <g fill="#dcdcdc">
              <rect x="536" y="190" width="44" height="36" rx="2" />
            </g>
            <rect x="760" y="168" width="280" height="72" rx="4" />
            <g fill="#d6d6d6">
              <rect x="776" y="184" width="40" height="40" rx="2" />
              <rect x="824" y="184" width="56" height="40" rx="2" />
              <rect x="884" y="184" width="36" height="40" rx="2" />
            </g>
          </g>

          {/* Layer 1: foreground industrial elements with facade lines and smaller shadow */}
          <g className="layer layer-1" fill="#dedede" filter="url(#softShadow)">
            <rect x="60" y="210" width="100" height="40" rx="3" />
            {/* dock door lines */}
            <g fill="#cfcfcf">
              <rect x="68" y="218" width="24" height="28" rx="2" />
              <rect x="96" y="218" width="20" height="28" rx="2" />
            </g>

            <rect x="180" y="205" width="140" height="45" rx="3" />
            <g fill="#cfcfcf">
              <rect x="188" y="213" width="30" height="30" rx="2" />
              <rect x="222" y="213" width="26" height="30" rx="2" />
              <rect x="256" y="213" width="34" height="30" rx="2" />
            </g>

            <rect x="360" y="212" width="220" height="38" rx="3" />
            <g fill="#cfcfcf">
              {Array.from({length:5}).map((_,i)=> (
                <rect key={'f1-'+i} x={372 + i*40} y="220" width={22 + (i%2)*8} height="22" rx="2" />
              ))}
            </g>

            <rect x="620" y="208" width="160" height="42" rx="3" />
            <g fill="#cfcfcf">
              <rect x="628" y="216" width="36" height="28" rx="2" />
              <rect x="668" y="216" width="44" height="28" rx="2" />
            </g>

            <rect x="820" y="214" width="240" height="36" rx="3" />
            <g fill="#cfcfcf">
              {Array.from({length:6}).map((_,i)=> (
                <rect key={'f2-'+i} x={832 + i*36} y="222" width={20 + (i%3)*8} height="22" rx="2" />
              ))}
            </g>

            {/* subtle rail line */}
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
