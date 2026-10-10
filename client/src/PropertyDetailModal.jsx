import { lazy, Suspense, useEffect, useState } from 'react'
import { Field, NumericInput, SaveButton, PropertyModalCarousel, PropertyMap, apiFetch, FIELD_HELP } from './shared'

const LazyContactDetailPage = lazy(() => import('./ContactsPage').then(m => ({ default: m.ContactDetailPage })))

function AssignUsersTab({ allUsers, assignLoading, toggleAssign, onViewContact }) {
  const [assignSearch, setAssignSearch] = useState('')
  const aq = assignSearch.trim().toLowerCase()
  const visibleUsers = allUsers.filter(u =>
    !aq || [u.first_name, u.last_name, u.email, u.organization]
      .filter(Boolean).some(v => v.toLowerCase().includes(aq))
  )
  const assigned = visibleUsers.filter(u => !!u.assigned)
  const unassigned = visibleUsers.filter(u => !u.assigned)

  function UserRow({ u }) {
    const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email
    const initials = [u.first_name?.[0], u.last_name?.[0]].filter(Boolean).join('').toUpperCase() || u.email[0].toUpperCase()
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="w-8 h-8 rounded-full bg-base-300 flex-shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold">
          {u.profile_photo
            ? <img src={u.profile_photo} alt={displayName} className="w-full h-full object-cover" />
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <button
            className="text-sm font-medium text-left hover:underline hover:text-primary truncate block w-full"
            onClick={() => onViewContact(u.id)}
          >
            {displayName}
          </button>
          {u.organization && <p className="text-xs text-muted truncate">{u.organization}</p>}
        </div>
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm flex-shrink-0"
          checked={!!u.assigned}
          disabled={assignLoading}
          onChange={() => toggleAssign(u.id, !!u.assigned)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search users…"
          value={assignSearch}
          onChange={e => setAssignSearch(e.target.value)}
          className="input input-bordered input-sm pl-8 w-full"
        />
        {assignSearch && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-base-content" onClick={() => setAssignSearch('')}>✕</button>
        )}
      </div>
      {allUsers.length === 0
        ? <p className="text-center text-muted py-8">No users found</p>
        : visibleUsers.length === 0
          ? <p className="text-center text-muted py-4">No users match &ldquo;{assignSearch}&rdquo;</p>
          : (
            <div>
              {assigned.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted pb-1 border-b border-base-200 mb-1">
                    Assigned ({assigned.length})
                  </p>
                  <div className="divide-y divide-base-200">
                    {assigned.map(u => <UserRow key={u.id} u={u} />)}
                  </div>
                </>
              )}
              {unassigned.length > 0 && (
                <>
                  <p className={`text-xs font-semibold uppercase tracking-wide text-muted pb-1 border-b border-base-200 mb-1 ${assigned.length > 0 ? 'mt-4' : ''}`}>
                    All Users ({unassigned.length})
                  </p>
                  <div className="divide-y divide-base-200">
                    {unassigned.map(u => <UserRow key={u.id} u={u} />)}
                  </div>
                </>
              )}
            </div>
          )
      }
    </div>
  )
}

export default function PropertyDetailModal({ open, property, isAdmin, onClose, onSave, topOffset = 0 }) {
  const [tab, setTab] = useState('details')
  const [pin, setPin] = useState('')
  const [address, setAddress] = useState('')
  const [county, setCounty] = useState('')
  const [price, setPrice] = useState('')
  const [sqft, setSqft] = useState('')
  const [lot, setLot] = useState('')
  const [yearBuilt, setYearBuilt] = useState('')
  const [onMajorRoad, setOnMajorRoad] = useState(false)
  const [trafficVpd, setTrafficVpd] = useState('')
  const [onCornerLot, setOnCornerLot] = useState(false)
  const [waterAccess, setWaterAccess] = useState(false)
  const [nextToPublicLand, setNextToPublicLand] = useState(false)
  const [interstates, setInterstates] = useState([]) // [{name, distance}]
  const [logisticsHubs, setLogisticsHubs] = useState([]) // [{type, name, distance}]
  const [landmarksList, setLandmarksList] = useState([]) // [{type, name, distance}]
  const [waterSources, setWaterSources] = useState([]) // [{name, distance}]
  const [militaryBases, setMilitaryBases] = useState([]) // [{name, distance}]
  const [incomeMin, setIncomeMin] = useState('')
  const [incomeMax, setIncomeMax] = useState('')
  const [popDensity, setPopDensity] = useState('')
  const [propStatus, setPropStatus] = useState('New')
  const [elecVoltage, setElecVoltage] = useState('')
  const [elecAmperage, setElecAmperage] = useState('')
  const [assetType, setAssetType] = useState('')
  const [unitCount, setUnitCount] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedSignal, setSavedSignal] = useState(0)
  const [media, setMedia] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Documents state
  const [docs, setDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docUploadError, setDocUploadError] = useState('')

  // Assignment state
  const [allUsers, setAllUsers] = useState([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [assignError, setAssignError] = useState('')
  const [viewContactId, setViewContactId] = useState(null)

  function loadProperty(p) {
    setPin(p.pin || '')
    setAddress(p.address || '')
    setCounty(p.county || '')
    setPrice(p.price ?? '')
    setSqft(p.square_feet ?? '')
    setLot(p.lot_size ?? '')
    setYearBuilt(p.year_built ?? '')
    setOnMajorRoad(p.on_major_road || false)
    setTrafficVpd(p.traffic_vpd ?? '')
    setOnCornerLot(p.on_corner_lot || false)
    setWaterAccess(p.direct_water_access || false)
    setNextToPublicLand(p.next_to_public_land || false)
    setInterstates(Array.isArray(p.major_interstates) ? p.major_interstates : [])
    setLogisticsHubs(Array.isArray(p.logistics_hubs) ? p.logistics_hubs : [])
    setLandmarksList(Array.isArray(p.landmarks) ? p.landmarks : [])
    setWaterSources(Array.isArray(p.water_sources) ? p.water_sources : [])
    setMilitaryBases(Array.isArray(p.military_bases) ? p.military_bases : [])
    setIncomeMin(p.household_income_min ?? '')
    setIncomeMax(p.household_income_max ?? '')
    setPopDensity(p.population_density ?? '')
    setPropStatus(p.status || 'New')

    setElecVoltage(p.electrical_voltage ?? '')
    setElecAmperage(p.electrical_amperage ?? '')
    setAssetType(p.asset_type || '')

    setUnitCount(p.unit_count ?? '')

  }

  useEffect(() => {
    if (open) {
      setSaveError('')
      setUploadError('')
      setDocUploadError('')
      setAssignError('')
    }
    if (open && property) {
      loadProperty(property)
      setTab('details')
    } else if (open && !property) {
      setPin(''); setAddress(''); setCounty(''); setPrice(''); setSqft(''); setLot('')
      setYearBuilt(''); setOnMajorRoad(false); setTrafficVpd(''); setOnCornerLot(false)
      setWaterAccess(false); setNextToPublicLand(false); setInterstates([])
      setLogisticsHubs([]); setLandmarksList([]); setWaterSources([]); setMilitaryBases([])
      setIncomeMin(''); setIncomeMax(''); setPopDensity(''); setPropStatus('New')

      setElecVoltage(''); setElecAmperage(''); setAssetType('')

      setUnitCount('');

      setTab('details')
    }
  }, [property, open])

  useEffect(() => {
    if (open && property?.id) {
      setMedia([])
      setDocs([])
      setAllUsers([])
      fetchMedia()
      fetchDocs()
      if (isAdmin) fetchUsers()
    }
  }, [open, property?.id])

  async function fetchMedia() {
    setMediaLoading(true)
    try {
      const data = await apiFetch(`/api/properties/${property.id}/media`)
      setMedia(data.media || [])
    } catch (e) { setUploadError(e.message || 'Could not load media') }
    finally { setMediaLoading(false) }
  }

  async function fetchDocs() {
    setDocsLoading(true)
    try {
      const data = await apiFetch(`/api/properties/${property.id}/documents`)
      setDocs(data.documents || [])
    } catch (e) { setDocUploadError(e.message || 'Could not load documents') }
    finally { setDocsLoading(false) }
  }

  async function handleDocUpload(e) {
    const files = Array.from(e.target.files)
    setDocUploadError('')
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv']
    for (const file of files) {
      if (!allowed.includes(file.type)) { setDocUploadError(`${file.name}: unsupported type`); continue }
      if (file.size > 25 * 1024 * 1024) { setDocUploadError(`${file.name} exceeds 25MB limit`); continue }
      try {
        const fileData = await toBase64(file)
        await apiFetch(`/api/properties/${property.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, fileType: file.type, fileData })
        })
      } catch (err) { setDocUploadError(err.message || 'Upload failed') }
    }
    e.target.value = ''
    fetchDocs()
  }

  async function deleteDoc(docId) {
    if (!confirm('Delete this document?')) return
    setDocUploadError('')
    try {
      await apiFetch(`/api/properties/${property.id}/documents/${docId}`, { method: 'DELETE' })
      await fetchDocs()
    } catch (e) {
      setDocUploadError(e.message || 'Could not delete document')
    }
  }

  async function fetchUsers() {
    try {
      const data = await apiFetch(`/api/properties/${property.id}/users`)
      setAllUsers(data.users || [])
    } catch (e) { setAssignError(e.message || 'Could not load assignments') }
  }

  async function handleSave() {
    if (saving) return
    if (!pin.trim() || !address.trim() || !county.trim()) { alert('PIN, Address and County are required'); return }
    setSaving(true)
    setSaveError('')
    const draft = {
      ...property, pin, address, county,
      price: price !== '' ? Number(price) : null,
      square_feet: sqft !== '' ? Number(sqft) : null,
      lot_size: lot !== '' ? Number(lot) : null,
      year_built: yearBuilt !== '' ? Number(yearBuilt) : null,
      on_major_road: onMajorRoad,
      traffic_vpd: trafficVpd !== '' ? Number(trafficVpd) : null,
      on_corner_lot: onCornerLot,
      direct_water_access: waterAccess,
      next_to_public_land: nextToPublicLand,
      major_interstates: interstates,
      logistics_hubs: logisticsHubs,
      landmarks: landmarksList,
      water_sources: waterSources,
      military_bases: militaryBases,
      household_income_min: incomeMin !== '' ? Number(incomeMin) : null,
      household_income_max: incomeMax !== '' ? Number(incomeMax) : null,
      population_density: popDensity !== '' ? Number(popDensity) : null,
      status: propStatus,
      electrical_voltage: elecVoltage !== '' ? Number(elecVoltage) : null,
      electrical_amperage: elecAmperage !== '' ? Number(elecAmperage) : null,
      asset_type: assetType || null,
      unit_count: unitCount !== '' ? Number(unitCount) : null,

    }
    try {
      await onSave(draft)
      setSavedSignal(s => s + 1)
      if (!property?.id) onClose()
    } catch (e) {
      setSaveError(e.message || 'Could not save property')
    } finally {
      setSaving(false)
    }
  }

  function addInterstate() { setInterstates(prev => [...prev, { name: '', distance: '' }]) }
  function updateInterstate(i, field, val) {
    setInterstates(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeInterstate(i) { setInterstates(prev => prev.filter((_, idx) => idx !== i)) }

  function addHub() { setLogisticsHubs(prev => [...prev, { type: 'Airport', name: '', distance: '' }]) }
  function updateHub(i, field, val) {
    setLogisticsHubs(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeHub(i) { setLogisticsHubs(prev => prev.filter((_, idx) => idx !== i)) }

  function addLandmark() { setLandmarksList(prev => [...prev, { type: 'Major Metro', name: '', distance: '' }]) }
  function updateLandmark(i, field, val) {
    setLandmarksList(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeLandmark(i) { setLandmarksList(prev => prev.filter((_, idx) => idx !== i)) }

  function addWaterSource() { setWaterSources(prev => [...prev, { name: '', distance: '' }]) }
  function updateWaterSource(i, field, val) {
    setWaterSources(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeWaterSource(i) { setWaterSources(prev => prev.filter((_, idx) => idx !== i)) }

  function addMilitaryBase() { setMilitaryBases(prev => [...prev, { name: '', distance: '' }]) }
  function updateMilitaryBase(i, field, val) {
    setMilitaryBases(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }
  function removeMilitaryBase(i) { setMilitaryBases(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files)
    setUploadError('')
    for (const file of files) {
      const maxMB = file.type.startsWith('video/') ? 50 : 10
      if (file.size > maxMB * 1024 * 1024) { setUploadError(`${file.name} exceeds ${maxMB}MB limit`); continue }
      try {
        const base64Data = await toBase64(file)
        await apiFetch(`/api/properties/${property.id}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, mediaType: file.type, base64Data })
        })
      } catch (e) { setUploadError(e.message || 'Upload failed') }
    }
    e.target.value = ''
    fetchMedia()
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function deleteMedia(mediaId) {
    setUploadError('')
    try {
      await apiFetch(`/api/properties/${property.id}/media/${mediaId}`, { method: 'DELETE' })
      await fetchMedia()
    } catch (e) {
      setUploadError(e.message || 'Could not delete media')
    }
  }

  async function toggleAssign(userId, currentlyAssigned) {
    if (assignLoading) return
    setAssignLoading(true)
    setAssignError('')
    try {
      if (currentlyAssigned) {
        await apiFetch(`/api/properties/${property.id}/assign/${userId}`, { method: 'DELETE' })
      } else {
        await apiFetch(`/api/properties/${property.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: [userId] })
        })
      }
      await fetchUsers()
    } catch (e) { setAssignError(e.message || 'Could not update assignment') }
    finally { setAssignLoading(false) }
  }

  if (!open) return null

  const tabs = property?.id
    ? ['details', 'media', 'documents', ...(isAdmin ? ['assign'] : [])]
    : ['details']

  const tabLabel = { details: 'Details', media: 'Media', documents: 'Documents', assign: 'Assign Users' }

  return (
    <div className="modal modal-open" style={{ zIndex: 30, paddingTop: `${topOffset}px` }}>
      {/* Wide container: left form + right map */}
      <div className="property-modal-box modal-box p-0 w-full min-w-0 max-w-none max-h-none rounded-none flex flex-col overflow-hidden" style={{ '--property-top-offset': `${topOffset}px` }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-base-300 md:hidden">
          <h3 className="min-w-0 [overflow-wrap:anywhere] font-bold text-xl">
            {property?.id ? property.address : 'New Property'}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={saving}>✕</button>
        </div>

        {tabs.length > 1 && (
          <div className="tabs tabs-bordered px-6 pt-2 md:hidden">
            {tabs.map(t => (
              <button key={t} className={`tab ${tab === t ? 'tab-active font-semibold' : ''}`} onClick={() => setTab(t)}>
                {tabLabel[t]}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-w-0 flex-col md:flex-row overflow-hidden min-h-0 flex-1 md:pt-0">
        {/* ── Left panel: form ── */}
        <div className="flex min-w-0 min-h-0 flex-col w-full md:w-[480px] md:flex-shrink-0">
          <div className="hidden md:flex items-center justify-between px-6 py-2 border-b border-base-300 sticky top-0 bg-base-100 z-[2]">
            <h3 className="min-w-0 [overflow-wrap:anywhere] font-bold text-xl">
              {property?.id ? property.address : 'New Property'}
            </h3>
            <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={saving}>✕</button>
          </div>

          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="hidden md:flex tabs tabs-bordered px-6 md:pt-0 sticky top-[53px] bg-base-100 z-[2]">
              {tabs.map(t => (
                <button key={t} className={`tab ${tab === t ? 'tab-active font-semibold' : ''}`} onClick={() => setTab(t)}>
                  {tabLabel[t]}
                </button>
              ))}
            </div>
          )}

          <div className="min-w-0 min-h-0 flex-1 px-4 sm:px-6 py-5 overflow-y-auto">
          {saveError && <div role="alert" className="alert alert-error text-sm mb-4">{saveError}</div>}
          {assignError && <div role="alert" className="alert alert-error text-sm mb-4">{assignError}</div>}

        {/* Details tab */}
        {tab === 'details' && (
          <div className="space-y-5">
            {/* Media carousel — shown inline for existing properties */}
            {property?.id && <PropertyModalCarousel propertyId={property.id} />}
            {/* Core */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="PIN(s)" required>
                <input type="text" placeholder="e.g. 12-34-567-890" value={pin}
                  onChange={e => setPin(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="County" required>
                <input type="text" placeholder="e.g. Cook" value={county}
                  onChange={e => setCounty(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            </div>
            <Field label="Address" required>
              <input type="text" placeholder="123 Main St, Chicago, IL" value={address}
                onChange={e => setAddress(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
            </Field>

            {/* Status */}
            <Field label="Status">
              <select value={propStatus} onChange={e => setPropStatus(e.target.value)}
                className="select select-bordered w-full" disabled={!isAdmin}>
                {['New','Under Review','Active','Other'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <div className="divider text-xs text-muted my-1">Property Specs</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Price ($)" help={FIELD_HELP.price}>
                <NumericInput placeholder="0" value={price} onChange={setPrice}
                  className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Square Feet" help={FIELD_HELP.sqft}>
                <NumericInput placeholder="0" value={sqft} onChange={setSqft}
                  className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Lot Size (acres)" help={FIELD_HELP.lot}>
                <input type="number" placeholder="0.00" step="0.01" value={lot}
                  onChange={e => setLot(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Year Built" help={FIELD_HELP.yearBuilt}>
                <input type="number" placeholder="e.g. 1998" value={yearBuilt}
                  onChange={e => setYearBuilt(e.target.value)} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Unit / Bay / Suite Count" help={FIELD_HELP.unitCount}>
                <NumericInput placeholder="e.g. 24" value={unitCount} onChange={setUnitCount}
                  className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Voltage (V)" help={FIELD_HELP.voltage}>
                <NumericInput placeholder="e.g. 480" value={elecVoltage} onChange={setElecVoltage}
                  className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Amperage (A)" help={FIELD_HELP.amperage}>
                <NumericInput placeholder="e.g. 400" value={elecAmperage} onChange={setElecAmperage}
                  className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            </div>

            {/* Asset Type */}
            <Field label="Asset Type">
              <select value={assetType} onChange={e => setAssetType(e.target.value)}
                className="select select-bordered w-full" disabled={!isAdmin}>
                <option value="">— Select —</option>
                {['Multifamily','Retail','Net Lease','Office','Industrial',
                  'Hospitality / Golf','Student Housing','Seniors Housing','Self-Storage',
                  'Medical Office','Affordable Housing','Manufactured Housing','Land & Redevelopment','Mixed-Use'
                ].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            {/* Location attributes */}
            <div className="divider text-xs text-muted my-1">Location Attributes</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'On Major Road', val: onMajorRoad, set: setOnMajorRoad },
                { label: 'Corner Lot', val: onCornerLot, set: setOnCornerLot },
                { label: 'Direct Water Access', val: waterAccess, set: setWaterAccess },
                { label: 'Next to Public Land', val: nextToPublicLand, set: setNextToPublicLand },
              ].map(({ label, val, set }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="checkbox checkbox-sm" checked={val}
                    onChange={e => set(e.target.checked)} disabled={!isAdmin} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            {onMajorRoad && (
              <Field label="Traffic (VPD — vehicles per day)">
                <NumericInput placeholder="e.g. 25,000" value={trafficVpd}
                  onChange={setTrafficVpd} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            )}

            {/* Interstates */}
            <div className="divider text-xs text-muted my-1">Major Interstates</div>
            <div className="space-y-2">
              {interstates.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" placeholder="e.g. I-80" value={item.name}
                    onChange={e => updateInterstate(i, 'name', e.target.value)}
                    className="input input-bordered input-sm w-32" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles away" value={item.distance}
                    onChange={e => updateInterstate(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-32" disabled={!isAdmin} />
                  <span className="text-sm text-muted">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeInterstate(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && (
                <button className="btn btn-xs btn-outline" onClick={addInterstate}>+ Add Interstate</button>
              )}
              {interstates.length === 0 && <p className="text-sm text-muted">No interstates added</p>}
            </div>

            {/* Demographics */}
            <div className="divider text-xs text-muted my-1">Logistics Hubs</div>
            <div className="space-y-2">
              {logisticsHubs.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <select value={item.type} onChange={e => updateHub(i, 'type', e.target.value)}
                    className="select select-bordered select-sm w-36" disabled={!isAdmin}>
                    <option>Airport</option>
                    <option>Railyard</option>
                  </select>
                  <input type="text" placeholder="e.g. O'Hare International Airport" value={item.name}
                    onChange={e => updateHub(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[160px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateHub(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-muted">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeHub(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addHub}>+ Add Hub</button>}
              {logisticsHubs.length === 0 && <p className="text-sm text-muted">No logistics hubs added</p>}
            </div>

            <div className="divider text-xs text-muted my-1">Landmarks</div>
            <div className="space-y-2">
              {landmarksList.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <select value={item.type} onChange={e => updateLandmark(i, 'type', e.target.value)}
                    className="select select-bordered select-sm w-44" disabled={!isAdmin}>
                    <option>Major Metro</option>
                    <option>National Park</option>
                    <option>Nature Preserve</option>
                  </select>
                  <input type="text" placeholder="e.g. Chicago" value={item.name}
                    onChange={e => updateLandmark(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[140px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateLandmark(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-muted">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeLandmark(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addLandmark}>+ Add Landmark</button>}
              {landmarksList.length === 0 && <p className="text-sm text-muted">No landmarks added</p>}
            </div>

            <div className="divider text-xs text-muted my-1">Water Sources</div>
            <div className="space-y-2">
              {waterSources.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <input type="text" placeholder="e.g. Lake Michigan" value={item.name}
                    onChange={e => updateWaterSource(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[180px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateWaterSource(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-muted">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeWaterSource(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addWaterSource}>+ Add Water Source</button>}
              {waterSources.length === 0 && <p className="text-sm text-muted">No water sources added</p>}
            </div>

            <div className="divider text-xs text-muted my-1">Military Bases</div>
            <div className="space-y-2">
              {militaryBases.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <input type="text" placeholder="e.g. Naval Station Great Lakes" value={item.name}
                    onChange={e => updateMilitaryBase(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[200px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateMilitaryBase(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-muted">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeMilitaryBase(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addMilitaryBase}>+ Add Military Base</button>}
              {militaryBases.length === 0 && <p className="text-sm text-muted">No military bases added</p>}
            </div>

            {/* Demographics */}
            <div className="divider text-xs text-muted my-1">Demographics</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Household Income Min ($)">
                <NumericInput placeholder="e.g. 45,000" value={incomeMin}
                  onChange={setIncomeMin} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Household Income Max ($)">
                <NumericInput placeholder="e.g. 120,000" value={incomeMax}
                  onChange={setIncomeMax} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
              <Field label="Population Density (per sq mi)">
                <NumericInput placeholder="e.g. 3,500" value={popDensity}
                  onChange={setPopDensity} className="input input-bordered w-full" disabled={!isAdmin} />
              </Field>
            </div>

            {isAdmin && (
              <div className="pt-2 hidden md:block">
                <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal}
                  label={property?.id ? 'Save Changes' : 'Create Property'} />
              </div>
            )}

            {isAdmin && (
              <div className="pt-2 md:hidden">
                <SaveButton onClick={handleSave} loading={saving} savedSignal={savedSignal}
                  label={property?.id ? 'Save Changes' : 'Create Property'} />
              </div>
            )}
          </div>
        )}

                {/* Media tab */}
        {tab === 'media' && (
          <div className="space-y-5">
            {isAdmin && (
              <div className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center">
                <p className="text-sm text-muted mb-3">Upload images (JPG, PNG, GIF — max 10MB) or videos (MP4, MOV — max 50MB)</p>
                <label className="btn btn-primary btn-sm cursor-pointer">
                  Choose Files
                  <input type="file" className="hidden" multiple accept="image/*,video/*" onChange={handleFileUpload} />
                </label>
              </div>
            )}
            {uploadError && <p role="alert" className="text-error text-sm">{uploadError}</p>}
            {mediaLoading
              ? <p className="text-center text-muted py-6">Loading…</p>
              : media.length === 0
                ? <p className="text-center text-muted py-8">No media uploaded yet</p>
                : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {media.map(m => (
                      <div key={m.id} className="relative group rounded border border-base-300 overflow-hidden bg-base-200">
                        {m.media_type?.startsWith('video/')
                          ? <video src={`/api/properties/${property.id}/media/${m.id}`} className="w-full h-28 object-cover" controls />
                          : <img src={`/api/properties/${property.id}/media/${m.id}`} alt={m.filename} className="w-full h-28 object-cover" />
                        }
                        <div className="px-2 py-1 flex items-center justify-between">
                          <span className="text-xs text-muted truncate">{m.filename}</span>
                          {isAdmin && (
                            <button className="btn btn-xs btn-ghost text-error" onClick={() => deleteMedia(m.id)}>✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
            }
          </div>
        )}

        {/* Documents tab */}
        {tab === 'documents' && (
          <div className="space-y-5">
            {isAdmin && (
              <div className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center">
                <p className="text-sm text-muted mb-1">PDF, Word, Excel, CSV, images — max 25MB each</p>
                <p className="text-xs text-muted mb-3">These are property documents, not visual media</p>
                <label className="btn btn-primary btn-sm cursor-pointer">
                  Upload Documents
                  <input type="file" className="hidden" multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
                    onChange={handleDocUpload} />
                </label>
              </div>
            )}
            {docUploadError && <p role="alert" className="text-error text-sm">{docUploadError}</p>}
            {docsLoading
              ? <p className="text-center text-muted py-6">Loading…</p>
              : docs.length === 0
                ? <p className="text-center text-muted py-8">No documents uploaded yet</p>
                : (
                  <div className="space-y-2">
                    {docs.map(doc => {
                      const isPdf = doc.file_type === 'application/pdf'
                      const isImg = doc.file_type?.startsWith('image/')
                      const icon = isPdf ? '📄' : isImg ? '🖼️' : doc.file_type?.includes('word') ? '📝' : doc.file_type?.includes('excel') || doc.file_type?.includes('sheet') ? '📊' : '📎'
                      return (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-base-300 hover:bg-base-100">
                          <span className="text-2xl flex-shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <a
                              href={`/api/properties/${property.id}/documents/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium hover:underline truncate block"
                            >
                              {doc.filename}
                            </a>
                            <p className="text-xs text-muted">
                              {new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              {doc.uploaded_by_email && ` · ${doc.uploaded_by_email}`}
                            </p>
                          </div>
                          <a
                            href={`/api/properties/${property.id}/documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-xs btn-ghost"
                            title="Open"
                          >↗</a>
                          {isAdmin && (
                            <button className="btn btn-xs btn-ghost text-error" onClick={() => deleteDoc(doc.id)} title="Delete">✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
            }
          </div>
        )}

        {/* Assign Users tab (admin only) */}
        {tab === 'assign' && isAdmin && (
          <AssignUsersTab
            allUsers={allUsers}
            assignLoading={assignLoading}
            toggleAssign={toggleAssign}
            onViewContact={setViewContactId}
          />
        )}

          </div>{/* end tab content */}
        </div>{/* end left panel */}

        {/* ── Right panel: map ── */}
          <div className="hidden md:flex min-w-0 flex-1 border-l border-base-300 bg-base-100 min-h-0 flex-col">
            <div className="flex-1 min-h-0">
              <PropertyMap address={address} />
            </div>
          </div>

      </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={() => { if (!saving) onClose() }}><button disabled={saving}>close</button></form>

      {/* Contact detail overlay ? opened from Assign Users tab */}
      {viewContactId && (
        <div className="modal modal-open" style={{ zIndex: 60 }}>
          <div className="modal-box p-0 w-full min-w-0 h-screen supports-[height:100dvh]:h-dvh max-w-none max-h-none rounded-none overflow-y-auto">
            <Suspense fallback={<div />}>
              <LazyContactDetailPage
                contactId={viewContactId}
                onBack={() => setViewContactId(null)}
                isAdmin={isAdmin}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}
