import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from './shared'

const CATEGORIES = [
  ['general', 'General'],
  ['buying', 'Buying and investing'],
  ['leasing', 'Leasing and tenants'],
  ['building', 'Building and operations'],
  ['taxes', 'Illinois taxes and incentives'],
  ['financing', 'Financing'],
  ['selling', 'Selling and exit'],
]

const jsonPost = (url, body, method = 'POST') =>
  apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

const fmtDate = ts => ts ? new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''

function Paragraphs({ text }) {
  return String(text || '').split(/\n{2,}/).map((p, i) => (
    <p key={i} className="whitespace-pre-line leading-relaxed">{p}</p>
  ))
}

function StatusBadge({ status }) {
  if (status === 'visible') return null
  return <span className="badge badge-warning badge-sm">{status}</span>
}

function AskForm({ onPosted }) {
  const [category, setCategory] = useState('general')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await jsonPost('/api/community/threads', { category, title, body })
      setTitle(''); setBody('')
      onPosted(r.id)
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body gap-3">
        <h3 className="card-title text-lg">Ask the community</h3>
        <p className="text-sm opacity-70">Your question is visible to signed-in members and shows your first name and last initial. Please leave out confidential deal details.</p>
        <label className="form-control">
          <span className="label-text mb-1">Topic</span>
          <select className="select select-bordered" value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-1">Question</span>
          <input className="input input-bordered" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} minLength={8} required placeholder="e.g. How long does a Cook County 6b application take?" />
        </label>
        <label className="form-control">
          <span className="label-text mb-1">Details</span>
          <textarea className="textarea textarea-bordered min-h-28" value={body} onChange={e => setBody(e.target.value)} maxLength={5000} minLength={10} required />
        </label>
        {err && <div className="alert alert-error text-sm">{err}</div>}
        <div className="card-actions justify-end">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post question'}</button>
        </div>
      </div>
    </form>
  )
}

function ThreadView({ id, user, onBack }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiFetch(`/api/community/threads/${id}`).then(setData).catch(e => setErr(e.message))
  }, [id])
  useEffect(load, [load])

  async function act(fn) {
    setErr('')
    try { await fn(); load() } catch (e) { setErr(e.message) }
  }

  async function submitReply(e) {
    e.preventDefault()
    setBusy(true)
    await act(async () => { await jsonPost(`/api/community/threads/${id}/replies`, { body: reply }); setReply('') })
    setBusy(false)
  }

  if (err && !data) return <div className="alert alert-error">{err}</div>
  if (!data) return <div className="flex justify-center py-10"><span className="loading loading-spinner loading-lg" /></div>
  const { thread, replies } = data
  const admin = user.role === 'admin'
  const canAccept = admin || thread.mine

  return (
    <div className="space-y-4">
      <button className="btn btn-ghost btn-sm" onClick={onBack}>← All questions</button>
      <article className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-2">
          <div className="text-xs uppercase tracking-wide opacity-60">{thread.categoryTitle}</div>
          <h3 className="text-xl font-bold">{thread.title} <StatusBadge status={thread.status} /></h3>
          <div className="text-sm opacity-70">Asked by {thread.author}{thread.authorIsAdmin ? ' (Pavlo)' : ''} · {fmtDate(thread.createdAt)}</div>
          <Paragraphs text={thread.body} />
          <div className="flex flex-wrap gap-2 pt-2">
            {admin && thread.status !== 'visible' && <button className="btn btn-xs" onClick={() => act(() => jsonPost(`/api/community/threads/${id}`, { status: 'visible' }, 'PATCH'))}>Restore</button>}
            {admin && thread.status === 'visible' && <button className="btn btn-xs btn-warning" onClick={() => act(() => jsonPost(`/api/community/threads/${id}`, { status: 'hidden' }, 'PATCH'))}>Hide</button>}
            {(thread.mine || admin) && thread.status !== 'deleted' && <button className="btn btn-xs btn-ghost text-error" onClick={() => { if (confirm('Delete this question?')) act(() => jsonPost(`/api/community/threads/${id}`, { status: 'deleted' }, 'PATCH')) }}>Delete</button>}
          </div>
        </div>
      </article>

      <h4 className="font-semibold">{replies.length} {replies.length === 1 ? 'answer' : 'answers'}</h4>
      {replies.map(r => (
        <div key={r.id} className={`card bg-base-100 border shadow-sm ${r.accepted ? 'border-success border-2' : 'border-base-300'}`}>
          <div className="card-body gap-2 py-4">
            <div className="text-sm opacity-70 flex flex-wrap gap-2 items-center">
              <strong className="opacity-100">{r.author}</strong>{r.authorIsAdmin && <span className="badge badge-neutral badge-sm">Pavlo · site author</span>}
              <span>· {fmtDate(r.createdAt)}</span>
              {r.accepted && <span className="badge badge-success badge-sm">Accepted answer</span>}
              <StatusBadge status={r.status} />
            </div>
            <Paragraphs text={r.body} />
            <div className="flex flex-wrap gap-2">
              {canAccept && r.status === 'visible' && <button className="btn btn-xs" onClick={() => act(() => jsonPost(`/api/community/replies/${r.id}`, { accepted: !r.accepted }, 'PATCH'))}>{r.accepted ? 'Unmark answer' : 'Mark as answer'}</button>}
              {admin && r.status === 'visible' && <button className="btn btn-xs btn-warning" onClick={() => act(() => jsonPost(`/api/community/replies/${r.id}`, { status: 'hidden' }, 'PATCH'))}>Hide</button>}
              {admin && r.status !== 'visible' && <button className="btn btn-xs" onClick={() => act(() => jsonPost(`/api/community/replies/${r.id}`, { status: 'visible' }, 'PATCH'))}>Restore</button>}
              {(r.mine || admin) && r.status !== 'deleted' && <button className="btn btn-xs btn-ghost text-error" onClick={() => { if (confirm('Delete this answer?')) act(() => jsonPost(`/api/community/replies/${r.id}`, { status: 'deleted' }, 'PATCH')) }}>Delete</button>}
            </div>
          </div>
        </div>
      ))}

      {thread.status === 'visible' && (
        <form onSubmit={submitReply} className="card bg-base-100 border border-base-300">
          <div className="card-body gap-3">
            <label className="form-control">
              <span className="label-text mb-1">Your answer</span>
              <textarea className="textarea textarea-bordered min-h-28" value={reply} onChange={e => setReply(e.target.value)} maxLength={5000} minLength={2} required />
            </label>
            {err && <div className="alert alert-error text-sm">{err}</div>}
            <div className="card-actions justify-end"><button className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Post answer'}</button></div>
          </div>
        </form>
      )}
    </div>
  )
}

export default function CommunityPage({ user }) {
  const [threads, setThreads] = useState(null)
  const [category, setCategory] = useState('')
  const [openId, setOpenId] = useState(null)
  const [asking, setAsking] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setErr('')
    apiFetch(`/api/community/threads?limit=50${category ? `&category=${category}` : ''}`)
      .then(d => setThreads(d.threads))
      .catch(e => setErr(e.message))
  }, [category])
  useEffect(() => { if (!openId) load() }, [load, openId])

  if (openId) return <ThreadView id={openId} user={user} onBack={() => setOpenId(null)} />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Community Q&amp;A</h2>
          <p className="text-sm opacity-70">Questions and answers from members. Only signed-in members can see this board.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAsking(a => !a)}>{asking ? 'Cancel' : 'Ask a question'}</button>
      </div>
      {asking && <AskForm onPosted={id => { setAsking(false); setOpenId(id) }} />}
      <div className="flex flex-wrap gap-2">
        <button className={`btn btn-sm ${category === '' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCategory('')}>All</button>
        {CATEGORIES.map(([id, label]) => (
          <button key={id} className={`btn btn-sm ${category === id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCategory(id)}>{label}</button>
        ))}
      </div>
      {err && <div className="alert alert-error">{err}</div>}
      {!threads && !err && <div className="flex justify-center py-10"><span className="loading loading-spinner loading-lg" /></div>}
      {threads && threads.length === 0 && <div className="text-center opacity-70 py-10">No questions yet. Be the first to ask.</div>}
      <div className="grid gap-3">
        {threads && threads.map(t => (
          <button key={t.id} className="card bg-base-100 border border-base-300 shadow-sm text-left hover:border-primary transition-colors" onClick={() => setOpenId(t.id)}>
            <div className="card-body gap-1 py-4">
              <div className="text-xs uppercase tracking-wide opacity-60">{t.categoryTitle}</div>
              <div className="font-semibold text-lg">{t.title} <StatusBadge status={t.status} /></div>
              <div className="text-sm opacity-70">{t.author} · {fmtDate(t.createdAt)} · {t.replyCount} {t.replyCount === 1 ? 'answer' : 'answers'}{t.answered ? ' · ✓ answered' : ''}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
