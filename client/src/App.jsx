import { useEffect, useState } from 'react'

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="avatar placeholder">
        <div className="bg-primary text-white rounded-full w-8">
          <span className="text-sm">RE</span>
        </div>
      </div>
      <span className="font-bold text-lg">RealEstate Portal</span>
    </div>
  )
}

function Modal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4">{message}</p>
        <div className="modal-action">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onCancel}>
        <button>close</button>
      </form>
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
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Create failed');
        return;
      }
      setEmail('');
      setPassword('');
      setRole('user');
      setMsg('User created');
      if (onCreated) onCreated();
    } catch (e) {
      setMsg('Network error');
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(''), 3000);
    }
  }

  return (
    <form onSubmit={createUser} className="flex flex-col gap-3 mb-4">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="input input-bordered"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="input input-bordered"
        required
      />
      <select value={role} onChange={e => setRole(e.target.value)} className="select select-bordered">
        <option value="user">user</option>
        <option value="admin">admin</option>
      </select>
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create user'}
      </button>
      {msg && <div className="text-sm text-gray-500">{msg}</div>}
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
      const res = await fetch(`/api/audit-logs?q=${encodeURIComponent(q)}&page=${page}&perPage=${perPage}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error('Fetch logs failed:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogs(); }, [page, perPage]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search email or action"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="input input-bordered flex-1"
        />
        <button className="btn btn-primary" onClick={() => { setPage(1); fetchLogs(); }}>
          Search
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Email</th>
              <th>Action</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i}>
                <td>{log.email}</td>
                <td>{log.action}</td>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-center gap-2">
        <button
          className="btn btn-sm"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
        >
          Prev
        </button>
        <span className="flex items-center px-4">Page {page}/{Math.max(1, Math.ceil(total / perPage))}</span>
        <button
          className="btn btn-sm"
          onClick={() => setPage(p => Math.min(Math.max(1, Math.ceil(total / perPage)), p + 1))}
          disabled={page >= Math.max(1, Math.ceil(total / perPage)) || loading}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function UsersTable({ users, onEdit, onDelete, onReload }) {
  const [query, setQuery] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(query)}&perPage=${perPage}&page=${page}`);
      const data = await res.json();
      if (data.users) onReload(data.users);
    } catch (e) {
      console.error('Fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, [page, perPage]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="Search email"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="input input-bordered flex-1"
        />
        <button className="btn btn-primary" onClick={() => { setPage(1); fetchUsers(); }}>
          Search
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Organization</th>
              <th>Phone</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i}>
                <td>{u.email}</td>
                <td><div className="badge badge-primary">{u.role}</div></td>
                <td>{u.first_name || '-'}</td>
                <td>{u.last_name || '-'}</td>
                <td>{u.organization || '-'}</td>
                <td>{u.phone_number || '-'}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-xs btn-ghost" onClick={() => onEdit(u)}>Edit</button>
                    <button className="btn btn-xs btn-error" onClick={() => onDelete(u.id, u.email)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="select select-bordered select-sm">
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
          <button className="btn btn-sm" onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

function PropertyDetailModal({ open, property, onClose, onSave }) {
  const [pin, setPin] = useState(property?.pin || '');
  const [address, setAddress] = useState(property?.address || '');
  const [county, setCounty] = useState(property?.county || '');

  useEffect(() => {
    if (property) {
      setPin(property.pin || '');
      setAddress(property.address || '');
      setCounty(property.county || '');
    }
  }, [property]);

  if (!open) return null;

  async function handleSave() {
    if (!pin.trim() || !address.trim() || !county.trim()) {
      alert('All fields required');
      return;
    }
    await onSave({ ...property, pin, address, county });
    onClose();
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">{property?.id ? 'Edit Property' : 'New Property'}</h3>
        <div className="space-y-3">
          <div className="form-control">
            <label className="label"><span className="label-text">PIN(s)</span></label>
            <input
              type="text"
              placeholder="Property ID numbers"
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="input input-bordered"
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Address</span></label>
            <input
              type="text"
              placeholder="Property address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="input input-bordered"
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">County</span></label>
            <input
              type="text"
              placeholder="County"
              value={county}
              onChange={e => setCounty(e.target.value)}
              className="input input-bordered"
            />
          </div>
        </div>
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </form>
    </div>
  );
}

function PropertiesPage({ user }) {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [loading, setLoading] = useState(false);

  async function fetchProperties() {
    setLoading(true);
    try {
      const res = await fetch(`/api/properties?${user.role === 'admin' ? 'allProps=true' : ''}`);
      const data = await res.json();
      setProperties(data.properties || []);
    } catch (e) {
      console.error('Failed to fetch properties:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProperties(); }, [user.role]);

  async function saveProperty(prop) {
    try {
      const method = prop.id ? 'PUT' : 'POST';
      const endpoint = prop.id ? `/api/properties/${prop.id}` : '/api/properties';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prop)
      });
      if (res.ok) {
        await fetchProperties();
      }
    } catch (e) {
      console.error('Failed to save property:', e);
    }
  }

  async function deleteProperty(id) {
    try {
      await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      await fetchProperties();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  }

  return (
    <div className="space-y-6">
      {user.role === 'admin' && (
        <button className="btn btn-primary" onClick={() => { setSelectedProperty(null); setShowPropertyModal(true); }}>
          + New Property
        </button>
      )}
      <PropertyDetailModal
        open={showPropertyModal}
        property={selectedProperty}
        onClose={() => setShowPropertyModal(false)}
        onSave={async (p) => { await saveProperty(p); }}
      />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((prop, i) => (
          <div key={i} className="card bg-base-100 shadow-md hover:shadow-lg cursor-pointer" onClick={() => {
            setSelectedProperty(prop);
            if (user.role === 'admin') setShowPropertyModal(true);
          }}>
            <div className="card-body">
              <h2 className="card-title text-lg">{prop.address}</h2>
              <p className="text-sm text-gray-600">{prop.county}</p>
              <p className="text-xs text-gray-500">PIN: {prop.pin}</p>
              {user.role === 'admin' && (
                <div className="card-actions">
                  <button className="btn btn-xs btn-primary" onClick={(e) => { e.stopPropagation(); setSelectedProperty(prop); setShowPropertyModal(true); }}>
                    Edit
                  </button>
                  <button className="btn btn-xs btn-error" onClick={(e) => { e.stopPropagation(); deleteProperty(prop.id); }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null });

  async function login(e) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Login failed');
        return;
      }
      setCurrentUser(data.user);
      setPage('dashboard');
      setEmail('');
      setPassword('');
    } catch (e) {
      setMsg('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function register(e) {
    e.preventDefault();
    setMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || 'Register failed');
        return;
      }
      setCurrentUser(data.user);
      setPage('dashboard');
      setEmail('');
      setPassword('');
    } catch (e) {
      setMsg('Network error');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setCurrentUser(null);
    setPage('login');
    setEmail('');
    setPassword('');
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundImage: "url('/assets/background-login.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10 w-full flex items-center justify-center">
        <div className="card w-96 bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-6 justify-center">
              <Logo />
            </h2>
            <form onSubmit={isRegister ? register : login} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">Email</span></label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input input-bordered"
                  required
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Password</span></label>
                <input
                  type="password"
                  placeholder="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input input-bordered"
                  required
                />
              </div>
              {msg && <div className="alert alert-error">{msg}</div>}
              <button className="btn btn-primary w-full" disabled={loading}>
                {loading ? 'Processing...' : (isRegister ? 'Register' : 'Login')}
              </button>
            </form>
            <div className="divider"></div>
            <button className="btn btn-outline" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Already have account? Login' : 'Need account? Register'}
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <nav className="navbar bg-base-100 shadow-md sticky top-0 z-50 gap-2">
        <div className="flex-none">
          <Logo />
        </div>
        <div className="flex-1 flex gap-1">
          <button className={`btn btn-sm ${page === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('dashboard')}>Dashboard</button>
          <button className={`btn btn-sm ${page === 'properties' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('properties')}>Properties</button>
          {currentUser.role === 'admin' && <button className={`btn btn-sm ${page === 'users' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('users')}>Users</button>}
          {currentUser.role === 'admin' && <button className={`btn btn-sm ${page === 'audit' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('audit')}>Audit Logs</button>}
        </div>
        <div className="flex-none flex items-center gap-2">
          <button className={`btn btn-sm ${page === 'profile' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage('profile')}>{currentUser.email}</button>
          <button className="btn btn-sm btn-outline btn-error" onClick={logout}>Logout</button>
        </div>
      </nav>
      <main className="container mx-auto p-4 py-8">
        {page === 'dashboard' && (
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Welcome, {currentUser.email}</h1>
            <p className="text-lg mb-8">You are logged in as a <span className="badge badge-primary">{currentUser.role}</span></p>
            {currentUser.role === 'admin' && <button className="btn btn-primary" onClick={() => setPage('users')}>Manage Users</button>}
          </div>
        )}
        {page === 'users' && currentUser.role === 'admin' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Manage Users</h2>
            <div className="card bg-base-100 shadow-md mb-4">
              <div className="card-body">
                <h3 className="card-title">Create New User</h3>
                <AddUserForm onCreated={() => alert('User created')} />
              </div>
            </div>
            <UsersTable users={users} onEdit={() => {}} onDelete={() => {}} onReload={setUsers} />
          </div>
        )}
        {page === 'properties' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">{currentUser.role === 'admin' ? 'Manage' : 'My'} Properties</h2>
            <PropertiesPage user={currentUser} />
          </div>
        )}
        {page === 'audit' && currentUser.role === 'admin' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Audit Logs</h2>
            <AuditLogs />
          </div>
        )}
        {page === 'profile' && (
          <div className="card bg-base-100 shadow-md max-w-2xl mx-auto">
            <div className="card-body">
              <h2 className="card-title">My Profile</h2>
              <div className="form-control">
                <label className="label"><span className="label-text">Email</span></label>
                <input type="text" value={currentUser.email} disabled className="input input-bordered" />
              </div>
            </div>
          </div>
        )}
      </main>
      <Modal {...modal} />
    </div>
  );
}
