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

function PropertyDetailModal({ property, isOpen, onClose, isAdmin, onMediaUploaded, onMediaDeleted }) {
  const [media, setMedia] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fileInput, setFileInput] = useState(null);

  useEffect(() => {
    if (isOpen && property) fetchMedia();
  }, [isOpen, property]);

  async function fetchMedia() {
    try {
      const res = await fetch(`/api/properties/${property.id}/media`);
      if (!res.ok) throw new Error('Failed to load media');
      const data = await res.json();
      setMedia(data.media || []);
      setCurrentMediaIndex(0);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result;
        const res = await fetch(`/api/properties/${property.id}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mediaType: file.type,
            base64Data
          })
        });
        if (!res.ok) throw new Error('Upload failed');
        await fetchMedia();
        if (onMediaUploaded) onMediaUploaded();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteMedia(mediaId) {
    if (!window.confirm('Delete this media?')) return;
    try {
      const res = await fetch(`/api/properties/${property.id}/media/${mediaId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await fetchMedia();
      if (onMediaDeleted) onMediaDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isOpen || !property) return null;

  const currentMedia = media[currentMediaIndex];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="property-detail-modal">
        {/* Carousel Section */}
        <div className="carousel-section">
          {media.length > 0 ? (
            <>
              <div className="carousel">
                <img 
                  src={`/api/properties/${property.id}/media/${currentMedia.id}`} 
                  alt={currentMedia.filename}
                  style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                />
              </div>
              <div className="carousel-controls">
                <button onClick={() => setCurrentMediaIndex((i) => (i - 1 + media.length) % media.length)} disabled={media.length <= 1}>◀</button>
                <span>{currentMediaIndex + 1} / {media.length}</span>
                <button onClick={() => setCurrentMediaIndex((i) => (i + 1) % media.length)} disabled={media.length <= 1}>▶</button>
              </div>
            </>
          ) : (
            <div className="carousel no-media">No images or videos yet</div>
          )}
        </div>

        {/* Property Details Sections */}
        <div className="property-detail-section pin-section">{property.pin}</div>
        <div className="property-detail-section address-section">{property.address}</div>
        <div className="property-detail-section county-section">{property.county}</div>

        {/* Media Management (Admin only) */}
        {isAdmin && (
          <div className="media-management">
            <button className="btn primary" onClick={() => fileInput?.click()} disabled={uploading}>
              {uploading ? 'Uploading...' : '+ Add Media'}
            </button>
            <input
              ref={setFileInput}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {media.length > 0 && (
              <div className="media-list">
                <h4>Media Files</h4>
                {media.map((m) => (
                  <div key={m.id} className="media-item">
                    <span>{m.filename}</span>
                    <button className="btn" onClick={() => handleDeleteMedia(m.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function PropertiesPage({ currentUser, isAdmin }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ pin: '', address: '', county: '' });
  const [assignModal, setAssignModal] = useState({ open: false, propertyId: null, users: [] });
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  async function fetchProperties() {
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const res = await fetch('/api/properties?limit=100');
        if (!res.ok) throw new Error('Failed to load properties');
        const data = await res.json();
        setProperties(data.properties || []);
      } else {
        const res = await fetch('/api/me/properties');
        if (!res.ok) throw new Error('Failed to load properties');
        const data = await res.json();
        setProperties(data.properties || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProperties();
  }, [isAdmin]);

  async function handleSaveProperty(e) {
    e.preventDefault();
    if (!formData.pin.trim() || !formData.address.trim() || !formData.county.trim()) {
      setError('All fields required');
      return;
    }
    
    setLoading(true);
    try {
      const url = editingId ? `/api/properties/${editingId}` : '/api/properties';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ pin: '', address: '', county: '' });
      await fetchProperties();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProperty(id) {
    if (!window.confirm('Delete this property?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await fetchProperties();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEditClick(prop) {
    setFormData({ pin: prop.pin, address: prop.address, county: prop.county });
    setEditingId(prop.id);
    setShowForm(true);
  }

  async function handleAssignClick(propId) {
    setAssignLoading(true);
    try {
      const res = await fetch(`/api/properties/${propId}/users`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setAssignModal({ open: true, propertyId: propId, users: data.users || [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleToggleAssign(userId, currentAssigned) {
    setAssignLoading(true);
    try {
      if (currentAssigned) {
        const res = await fetch(`/api/properties/${assignModal.propertyId}/assign/${userId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Unassign failed');
      } else {
        const res = await fetch(`/api/properties/${assignModal.propertyId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: [userId] })
        });
        if (!res.ok) throw new Error('Assign failed');
      }
      // Update local state
      setAssignModal(m => ({
        ...m,
        users: m.users.map(u => u.id === userId ? { ...u, assigned: currentAssigned ? 0 : 1 } : u)
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setAssignLoading(false);
    }
  }

  if (!isAdmin) {
    return (
      <div>
        {error && <div className="error">{error}</div>}
        {loading ? <div>Loading properties...</div> : (
          properties.length === 0 ? (
            <div className="muted small" style={{ marginTop: 12 }}>No properties assigned yet.</div>
          ) : (
            <div className="properties-grid" style={{ marginTop: 12 }}>
              {properties.map(p => (
                <div 
                  key={p.id} 
                  className="property-card clickable"
                  onClick={() => { setSelectedProperty(p); setDetailModalOpen(true); }}
                >
                  <div className="property-pin">{p.pin}</div>
                  <div className="property-address">{p.address}</div>
                  <div className="property-county">{p.county}</div>
                </div>
              ))}
            </div>
          )
        )}
        <PropertyDetailModal
          property={selectedProperty}
          isOpen={detailModalOpen}
          onClose={() => { setDetailModalOpen(false); setSelectedProperty(null); }}
          isAdmin={false}
        />
      </div>
    );
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button className="btn primary" onClick={() => { setShowForm(true); setEditingId(null); setFormData({ pin: '', address: '', county: '' }); }} disabled={loading}>
        {loading ? '...' : '+ New Property'}
      </button>

      {showForm && (
        <form onSubmit={handleSaveProperty} style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 4 }}>
          <h4>{editingId ? 'Edit Property' : 'New Property'}</h4>
          <div style={{ marginBottom: 8 }}>
            <label>PIN<br /></label>
            <input value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} placeholder="Property Identification Number" required />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Address<br /></label>
            <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Street address" required />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>County<br /></label>
            <input value={formData.county} onChange={e => setFormData({...formData, county: e.target.value})} placeholder="County" required />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
            <button className="btn" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <div style={{ marginTop: 12 }}>Loading...</div> : (
        <div className="properties-grid" style={{ marginTop: 12 }}>
          {properties.map(p => (
            <div key={p.id} className="property-card">
              <div 
                onClick={() => { setSelectedProperty(p); setDetailModalOpen(true); }}
                style={{ cursor: 'pointer', marginBottom: '8px' }}
              >
                <div className="property-pin">{p.pin}</div>
                <div className="property-address">{p.address}</div>
                <div className="property-county">{p.county}</div>
              </div>
              <div className="property-card-actions" style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button className="btn btn-sm" onClick={() => handleEditClick(p)}>Edit</button>
                <button className="btn btn-sm" onClick={() => handleAssignClick(p.id)}>Users</button>
                <button className="btn btn-sm" onClick={() => handleDeleteProperty(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {assignModal.open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3>Assign Property to Users</h3>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {assignModal.users.map(u => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={u.assigned}
                    onChange={() => handleToggleAssign(u.id, !!u.assigned)}
                    disabled={assignLoading}
                    style={{ marginRight: 8 }}
                  />
                  {u.email}
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setAssignModal({...assignModal, open: false})}>Done</button>
            </div>
          </div>
        </div>
      )}

      <PropertyDetailModal
        property={selectedProperty}
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedProperty(null); }}
        isAdmin={isAdmin}
        onMediaUploaded={fetchProperties}
        onMediaDeleted={fetchProperties}
      />
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

  // Global fetch wrapper for simple error handling for client-side calls
  async function apiFetch(url, opts) {
    try {
      const res = await fetch(url, opts);
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      let payload;
      if (isJson) payload = await res.json().catch(()=>({}));
      if (!res.ok) {
        const err = new Error(payload && payload.error ? payload.error : 'Request failed');
        err.status = res.status;
        err.payload = payload;
        throw err;
      }
      return payload;
    } catch (err) {
      // Normalize network errors
      if (err instanceof TypeError) throw new Error('Network error');
      throw err;
    }
  }

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
      setUser({ id: data.id, email: data.email, role: data.role || 'user' })
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
          <button className="mobile-toggle" onClick={() => setMobileNavOpen(o => !o)} aria-expanded={mobileNavOpen} aria-label="Toggle menu">☰</button>
          <nav className={`nav ${mobileNavOpen ? 'mobile-open' : 'mobile-hidden'}`}>
            {menu.map(item => (
              <button key={item} className={`nav-item ${page === item ? 'active' : ''}`} onClick={() => { handleNav(item); setMobileNavOpen(false); }}>{item}</button>
            ))}
          </nav>
        </div>

        <div className="content-area">
          <div className="card center">
            <h2>{page}</h2>
            <div className="muted small">Signed in as {user.email} ({user.role})</div>

                    {/* Pages */}
            {page === 'Dashboard' && <div style={{marginTop:18}}>Welcome to the dashboard. Replace with real widgets.</div>}
            {page === 'Properties' && <PropertiesPage currentUser={user} isAdmin={isAdmin} />}

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
