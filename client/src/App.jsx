import { useEffect, useState } from 'react'
import './App.css'

function Logo() {
  return (
    <div className="logo">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="6" fill="#000" />
      <path d="M7 13l3 3 7-8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>rospopa</span>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '' })
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
      setUser({ id: data.id, username: data.username })
      setForm({ username: '', password: '' })
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
        <div className="card welcome">
          <Logo />
          <h2>Welcome back</h2>
          <p className="muted">Signed in as <strong>{user.username}</strong></p>
          <div className="row">
            <button className="btn primary" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-root">
      <div className="hero-panel">
        <div className="hero-content">
          <h1>rospopa Investments</h1>
          <p className="muted">A platform for Commercial Real Estate Investments — discover curated deals, analyze portfolio performance, and manage investor relations.</p>

          <div className="features">
            <div className="feature">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="7" width="18" height="12" rx="2" stroke="#000" strokeWidth="1.2" fill="none" />
                <path d="M7 11h4M7 14h6" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <div>
                <strong>Deal Marketplace</strong>
                <div className="small muted">Browse vetted CRE opportunities with key metrics and docs.</div>
              </div>
            </div>

            <div className="feature">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="#000" strokeWidth="1.2" fill="none" />
                <path d="M8 12h8M12 8v8" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <div>
                <strong>Portfolio Analytics</strong>
                <div className="small muted">Real-time cashflow, IRR, and exposure analytics for investments.</div>
              </div>
            </div>

            <div className="feature">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="16" height="16" rx="2" stroke="#000" strokeWidth="1.2" fill="none" />
                <path d="M8 8h8M8 12h8M8 16h5" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <div>
                <strong>Investor Dashboard</strong>
                <div className="small muted">Secure investor profiles, docs, and distribution history.</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="card auth-card">
        <Logo />
        <h2>{mode === 'login' ? 'Sign in' : 'Create account'}</h2>

        <form onSubmit={submit} className="form">
          <label className="field">
            <span className="label">Username</span>
            <input name="username" value={form.username} onChange={handleChange} required autoComplete="username" />
          </label>

          <label className="field">
            <span className="label">Password</span>
            <input name="password" type="password" value={form.password} onChange={handleChange} required autoComplete={mode==='login'? 'current-password' : 'new-password'} />
          </label>

          {msg && <div className="error">{msg}</div>}

          <div className="actions">
            <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Working...' : (mode === 'login' ? 'Sign in' : 'Create account')}</button>
            <button type="button" className="btn ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create account' : 'Have an account? Sign in'}</button>
          </div>
        </form>

        <p className="small muted">By continuing you agree to the terms of service.</p>
      </div>
    </div>
  )
}
