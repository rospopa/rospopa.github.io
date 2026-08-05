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
          {/* Static clouds (no filters, gradients, or animation) */}
          <path fill="#ffffff" opacity="0.9" d="M30 80c40-40 120-40 180-10s90 60 170 40 160-60 260-20 160 40 220 10v60H30z" />
          <path fill="#f8f8f8" opacity="0.88" d="M480 40c50-24 110-12 160 12s70 44 140 24 160-36 220-6 110 34 170 14v48H480z" />
          <path fill="#f2f2f2" opacity="0.82" d="M880 90c-60-36-140-60-220-34s-140 68-220 48-160-28-220 2-160 24-220-6v44h1000z" />
          <path fill="#ffffff" opacity="0.75" d="M240 20c30-10 80-8 120 6s40 24 100 12 120-24 180-2 100 28 160 10v36H240z" />
        </svg>

        <svg className="bg-buildings" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          {/* Scroller that contains two copies of the skyline to create an infinite loop */}
          <g className="bg-buildings-scroller">
            <g className="bg-set">
              {/* Distant skyline: more varied silhouettes */}
              <g className="layer layer-3" fill="#f3f3f3">
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
              <g className="layer layer-2" fill="#e8e8e8">
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
              <g className="layer layer-1" fill="#dedede">
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
            </g>

            {/* duplicate copy positioned to the right for seamless looping */}
            <g className="bg-set" transform="translate(1200,0)">
              <g className="layer layer-3" fill="#f3f3f3">
                <path d="M10 240 L10 170 Q80 140 140 160 L140 240 Z" />
                <path d="M180 240 L180 150 Q260 120 320 150 L320 240 Z" />
                <path d="M360 240 L360 130 Q460 100 520 130 L520 240 Z" />
                <path d="M560 240 L560 140 Q640 110 700 140 L700 240 Z" />
                <path d="M780 240 L780 160 Q860 130 920 160 L920 240 Z" />
                <path d="M960 240 L960 150 Q1040 120 1100 150 L1100 240 Z" />
                <g fill="#fff">
                  {Array.from({length:6}).map((_,i)=> (
                    <rect key={'dw2-'+i} x={30 + i*120} y="172" width="22" height="14" rx="2" />
                  ))}
                </g>
              </g>

              <g className="layer layer-2" fill="#e8e8e8">
                <rect x="0" y="180" width="180" height="64" rx="6" />
                <rect x="200" y="174" width="240" height="76" rx="6" />
                <rect x="460" y="182" width="200" height="64" rx="6" />
                <rect x="680" y="168" width="260" height="84" rx="6" />
                <rect x="960" y="176" width="220" height="68" rx="6" />
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

              <g className="layer layer-1" fill="#dedede">
                <rect x="40" y="210" width="120" height="46" rx="4" />
                <rect x="180" y="206" width="160" height="50" rx="4" />
                <rect x="360" y="214" width="240" height="42" rx="4" />
                <rect x="620" y="210" width="180" height="46" rx="4" />
                <rect x="820" y="216" width="260" height="38" rx="4" />
                <g fill="#e0e0e0">
                  <rect x="520" y="160" width="36" height="100" rx="6" />
                  <rect x="568" y="150" width="44" height="110" rx="8" />
                  <rect x="644" y="150" width="28" height="110" rx="6" />
                </g>
                <g fill="#cfcfcf">
                  <rect x="52" y="218" width="28" height="30" rx="3" />
                  <rect x="88" y="218" width="36" height="30" rx="3" />
                  <rect x="196" y="216" width="30" height="32" rx="3" />
                  <rect x="234" y="216" width="30" height="32" rx="3" />
                  {Array.from({length:6}).map((_,i)=> (
                    <rect key={'pf2-'+i} x={372 + i*36} y="222" width={18 + (i%2)*6} height="24" rx="3" />
                  ))}
                </g>
                <rect x="0" y="256" width="1200" height="6" fill="#cfcfcf" />
              </g>
            </g>
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
