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
        <svg className="bg-buildings" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          {/* Layer 3: distant skyline */}
          <g className="layer layer-3" fill="#f3f3f3">
            <rect x="40" y="160" width="140" height="80" rx="4" />
            <rect x="220" y="140" width="180" height="100" rx="4" />
            <rect x="460" y="150" width="120" height="90" rx="4" />
            <rect x="620" y="130" width="220" height="110" rx="4" />
            <rect x="940" y="155" width="160" height="85" rx="4" />
          </g>

          {/* Layer 2: midground warehouses */}
          <g className="layer layer-2" fill="#e8e8e8">
            <rect x="0" y="180" width="200" height="60" rx="4" />
            <rect x="220" y="170" width="260" height="70" rx="4" />
            <rect x="520" y="178" width="220" height="62" rx="4" />
            <rect x="760" y="168" width="280" height="72" rx="4" />
          </g>

          {/* Layer 1: foreground industrial elements (loading docks, rail) */}
          <g className="layer layer-1" fill="#dedede">
            <rect x="60" y="210" width="100" height="40" rx="3" />
            <rect x="180" y="205" width="140" height="45" rx="3" />
            <rect x="360" y="212" width="220" height="38" rx="3" />
            <rect x="620" y="208" width="160" height="42" rx="3" />
            <rect x="820" y="214" width="240" height="36" rx="3" />
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
            <button className="btn primary" type="submit" disabled={loading} aria-pressed={mode === 'login'}>
              {loading ? 'Working...' : (
                mode === 'login' ? (
                  <>
                    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Commercial Real Estate Investor Portal
                  </>
                ) : (
                  <>
                    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 9h-14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Create account
                  </>
                )
              )}
            </button>

            <button type="button" className="btn ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} aria-pressed={mode !== 'login'}>
              {mode === 'login' ? (
                <>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5v14M5 12h14" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Create account
                </>
              ) : (
                <>
                  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17l-5-5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Sign in
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
