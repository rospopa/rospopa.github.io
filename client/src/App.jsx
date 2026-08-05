import { useEffect, useState } from 'react'
import './App.css'

function Logo() {
  return (
    <div className="logo">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="6" fill="#0ea5a4" />
        <path d="M7 13l3 3 7-8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
          <h1>Welcome to rospopa</h1>
          <p className="muted">Secure access to your account. Fast, simple, and safe.</p>
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
