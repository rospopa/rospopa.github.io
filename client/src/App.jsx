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

  const [page, setPage] = useState('Dashboard');

  if (user) {
    const isAdmin = user.role === 'admin';
    const menu = isAdmin ? ['Dashboard', 'Properties', 'Users', 'Account', 'Logout'] : ['Dashboard', 'Properties', 'Account', 'Logout'];

    function handleNav(item) {
      if (item === 'Logout') return logout();
      setPage(item);
    }

    return (
      <div className="app-root">
        <div className="top-nav card">
          <div className="logo" aria-hidden="true"><Logo /></div>
          <nav className="nav">
            {menu.map(item => (
              <button key={item} className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => handleNav(item)}>{item}</button>
            ))}
          </nav>
        </div>

        <div className="content-area">
          <div className="card center">
            <h2>{page}</h2>
            <div className="muted small">Signed in as {user.email} ({user.role})</div>

            {/* Placeholder content for pages */}
            {page === 'Dashboard' && <div style={{marginTop:18}}>Welcome to the dashboard. Replace with real widgets.</div>}
            {page === 'Properties' && <div style={{marginTop:18}}>Properties list placeholder.</div>}
            {page === 'Users' && isAdmin && <div style={{marginTop:18}}>User management placeholder (admin only).</div>}
            {page === 'Account' && <div style={{marginTop:18}}>Account settings placeholder.</div>}

            <div style={{marginTop:20}}>
              <button className="btn primary" onClick={logout}>Logout</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-root">
      <div className="dynamic-bg" aria-hidden="true" style={{ backgroundImage: "url('/assets/background-login.jpg')" }}>
        {/* Static background image (background-architect.jpg) */}
      </div>
      <div className="auth-column">
        <div className="card auth-card center">
          <h2>{mode === 'login' ? 'Login' : 'Create an account'}</h2>
          <div className="small muted">Commercial Real Estate Investor Portal</div>

          <form onSubmit={submit} className="form">
          <label className="field">
            <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required autoComplete="email" />
          </label>

          <label className="field">
            <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required autoComplete={mode==='login'? 'current-password' : 'new-password'} />
          </label>

          {msg && <div className="error">{msg}</div>}

          <div className="actions">
            <button className={"btn primary"} type="submit" disabled={loading} aria-pressed={false}>
              {loading ? 'Working...' : (
                <>
                  {mode === 'login' ? (
                    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 17v-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 11a4 4 0 1 0-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 15v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 17h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  {mode === 'login' ? 'Login' : 'Create account'}
                </>
              )}
            </button>

            <div className="toggle">
              {mode === 'login' ? (
                <button type="button" className="link-btn" onClick={() => setMode('register')}>Don't have an account? Create one</button>
              ) : (
                <button type="button" className="link-btn" onClick={() => setMode('login')}>Already have an account? Login</button>
              )}
            </div>
          </div>
          </form>
        </div>
      </div>
    </div>
  )
}
