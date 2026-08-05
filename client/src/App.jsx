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

function Modal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function AddUserForm({ onCreated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function createUser(e) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, role }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        setMsg(data.error || 'Create failed');
        return;
      }
      setEmail(''); setPassword(''); setRole('user');
      setMsg('User created');
      if (onCreated) onCreated();
    } catch (e) {
      setMsg('Network error');
    } finally { setLoading(false); setTimeout(()=>setMsg(''),3000); }
  }

  return (
    <form onSubmit={createUser} style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} required />
      <input placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} type="password" required />
      <select value={role} onChange={e=>setRole(e.target.value)}>
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <button className="btn" type="submit" disabled={loading}>{loading? 'Creating...':'Create user'}</button>
      {msg && <div className="small muted" style={{marginLeft:8}}>{msg}</div>}
    </form>
  );
}

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function fetchLogs() {
    setLoading(true);
    try {
      const offset = (page-1)*perPage;
      const res = await fetch(`/api/audit-logs?q=${encodeURIComponent(q)}&limit=${perPage}&offset=${offset}`);
      if (!res.ok) {
        setLogs([]); setTotal(0); return;
      }
      const data = await res.json();
      setLogs(data.logs||[]); setTotal(data.total||0);
    } catch (e) {
      setLogs([]); setTotal(0);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ fetchLogs(); }, [page, perPage]);

  return (
    <div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input placeholder="Search email or action" value={q} onChange={e=>setQ(e.target.value)} />
        <button className="btn" onClick={()=>{ setPage(1); fetchLogs(); }}>Search</button>
      </div>
      {loading ? <div style={{marginTop:12}}>Loading logs...</div> : (
        <>
        <table className="users-table" style={{width:'100%', marginTop:12}}>
          <thead><tr><th>When</th><th>Admin ID</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}><td>{l.created_at}</td><td>{l.admin_id}</td><td>{l.action}</td><td>{l.target_email} ({l.target_user_id})</td><td style={{maxWidth:360,overflow:'hidden',textOverflow:'ellipsis'}}>{l.details}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
          <div className="small muted">Total: {total}</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button className="btn" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>Prev</button>
            <div className="small">Page {page} / {Math.max(1, Math.ceil(total/perPage))}</div>
            <button className="btn" onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(total/perPage)), p+1))} disabled={page>=Math.max(1, Math.ceil(total/perPage))}>Next</button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function UsersTable({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [toast, setToast] = useState({ text: '', type: '' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  async function fetchUsers() {
    if (!currentUser || currentUser.role !== 'admin') {
      setError('forbidden');
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    setError('');
    try {
      const offset = (page - 1) * perPage;
      const res = await fetch(`/api/users?q=${encodeURIComponent(query)}&limit=${perPage}&offset=${offset}`);
      if (!res.ok) {
        const data = await res.json().catch(()=>({}));
        setError(data.error || 'Failed to load users');
        setUsers([]);
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError('Network error');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => { fetchUsers(); }, [page, perPage]);

  function showToast(text, type='success') {
    setToast({ text, type });
    setTimeout(() => setToast({ text: '', type: '' }), 4000);
  }

  function confirmAction(title, message, fn) {
    setModal({ open: true, title, message, onConfirm: async () => { setModal(m => ({ ...m, open: false })); await fn(); } });
  }

  async function doChangeRole(id, role) {
    try {
      const res = await fetch(`/api/users/${id}/role`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) return showToast(data.error || 'Role change failed', 'error');
      showToast('Role updated');
      await fetchUsers();
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  async function doDeleteUser(id) {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) return showToast(data.error || 'Delete failed', 'error');
      showToast('User deleted');
      // If deleting last user on page, step back a page
      const remaining = users.length - 1;
      const totalPages = Math.max(1, Math.ceil((total - 1) / perPage));
      if (page > totalPages) setPage(totalPages);
      await fetchUsers();
    } catch (e) {
      showToast('Network error', 'error');
    }
  }

  function onSearch(e) {
    setQuery(e.target.value);
    setPage(1);
  }

  return (
    <div>
      {toast.text && <div className={`toast ${toast.type}`}>{toast.text}</div>}
      {error && <div className="error">{error}</div>}

      <div style={{display:'flex', gap:8, alignItems:'center', marginTop:8}}>
        <input placeholder="Search email" value={query} onChange={onSearch} />
        <button className="btn" onClick={() => fetchUsers()}>Search</button>
        <div style={{marginLeft:'auto', display:'flex', gap:8, alignItems:'center'}}>
          <label className="small muted">Per page</label>
          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
          </select>
        </div>
      </div>

      {loadingUsers ? <div style={{marginTop:12}}>Loading users...</div> : (
        <>
        <table className="users-table" style={{width:'100%', marginTop:12}}>
          <thead>
            <tr><th>Email</th><th>Role</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  {u.role !== 'admin' && <button className="btn" onClick={() => confirmAction('Promote user', `Promote ${u.email} to admin?`, () => doChangeRole(u.id, 'admin'))}>Promote</button>}
                  {u.role === 'admin' && currentUser && currentUser.id !== u.id && <button className="btn" onClick={() => confirmAction('Demote user', `Demote ${u.email} to regular user?`, () => doChangeRole(u.id, 'user'))}>Demote</button>}
                  {currentUser && currentUser.id !== u.id && <button className="btn" onClick={() => confirmAction('Delete user', `Delete user ${u.email}? This cannot be undone.`, () => doDeleteUser(u.id))}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12}}>
          <div className="small muted">Total: {total}</div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <div className="small">Page {page} / {Math.max(1, Math.ceil(total / perPage))}</div>
            <button className="btn" onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(total / perPage)), p + 1))} disabled={page >= Math.max(1, Math.ceil(total / perPage))}>Next</button>
          </div>
        </div>
        </>
      )}

      <Modal open={modal.open} title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onCancel={() => setModal(m => ({ ...m, open: false }))} />
    </div>
  );
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

                    {/* Pages */}
            {page === 'Dashboard' && <div style={{marginTop:18}}>Welcome to the dashboard. Replace with real widgets.</div>}
            {page === 'Properties' && <div style={{marginTop:18}}>Properties list placeholder.</div>}

            {page === 'Users' && isAdmin && (
              <div style={{marginTop:18, width:'100%'}}>
                <AddUserForm onCreated={() => { /* reload users via UsersTable effect by toggling key */ }} />
                <UsersTable currentUser={user} key={String(Math.random())} />
                <div style={{marginTop:12}}>
                  <button className="btn" onClick={() => setPage('Audit Logs')}>View Audit Logs</button>
                </div>
              </div>
            )}

            {page === 'Account' && <div style={{marginTop:18}}>Account settings placeholder.</div>}

            {page === 'Audit Logs' && isAdmin && (
              <div style={{marginTop:18, width:'100%'}}>
                <AuditLogs />
              </div>
            )}

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
