import { useState, useEffect } from 'react'
import { apiFetch } from './shared'

const ACTION_LABELS = {
  register:           (d, t) => `New account registered (${t || d?.email || ''})`,
  login:              ()     => `Signed in`,
  login_failed:       (d, t) => `Failed sign-in attempt for ${t || d?.email || 'unknown email'}`,
  recaptcha_failed:   (d)    => `Security check failed (score: ${d?.score ?? '?'}, reason: ${d?.reason || '?'})`,
  logout:             ()     => `Signed out`,
  forgot_password:    (d, t) => `Password reset requested for ${t || d?.email || ''}`,
  password_reset:     (d, t) => `Password successfully reset for ${t || d?.email || ''}`,
  create_user:        (d, t) => `Created user ${t || ''} with role "${d?.role || 'user'}"`,
  edit_user:          (d, t) => {
    const fields = d?.changed_fields
    if (!fields?.length) return `Updated profile of ${t || 'user'}`
    const USER_FIELD_LABELS = { first_name: 'First Name', last_name: 'Last Name', organization: 'Organization', phone_number: 'Phone', buy_box: 'Buy Box', birthday: 'Birthday', role: 'Role' }
    return `Updated profile of ${t || 'user'} — ${fields.map(f => USER_FIELD_LABELS[f] || f).join(', ')}`
  },
  delete_user:        (d, t) => `Deleted user ${t || ''}`,
  role_change:        (d, t) => `Changed role of ${t || 'user'} from "${d?.from}" to "${d?.to}"`,
  create_property:    (d)    => `Added property — ${d?.address || ''} (PIN: ${d?.pin || ''}, ${d?.county || ''})`,
  edit_property:      (d)    => `Edited property — ${d?.address || `ID ${d?.property_id || ''}`}${d?.changed_fields?.length ? ` — ${d.changed_fields.length} field(s) changed` : ''}`,
  delete_property:    (d)    => `Deleted property — ${d?.address || ''} (PIN: ${d?.pin || ''}, ID ${d?.property_id || ''})`,
  assign_property:    (d)    => `Assigned property ID ${d?.property_id || ''} to ${d?.user_count || 0} user(s)`,
  unassign_property:  (d)    => `Removed access to property ID ${d?.property_id || ''} from user ID ${d?.user_id || ''}`,
  upload_media:       (d)    => `Uploaded photo "${d?.filename || ''}" to property ID ${d?.property_id || ''}`,
  delete_media:       (d)    => `Deleted photo "${d?.media_id || ''}" from property ID ${d?.property_id || ''}`,
  upload_document:    (d)    => `Uploaded document "${d?.filename || ''}" to property ID ${d?.property_id || ''}`,
  delete_document:    (d)    => `Deleted document from property ID ${d?.property_id || ''}`,
  add_contact_note:   (d, t) => `Added note on contact ${d?.contact_name || t || `#${d?.user_id || ''}`}${d?.attachment_count ? ` + ${d.attachment_count} attachment(s)` : ''}`,
  delete_contact_note:(d, t) => `Deleted note on contact ${d?.contact_name || t || ''}`,
  edit_user_buybox:   (d, t) => `Updated Buy Box for ${t || `user #${d?.user_id || ''}`}`,
}

function formatLog(log) {
  let details = {}
  try { details = JSON.parse(log.details || '{}') } catch {}
  const fn = ACTION_LABELS[log.action]
  const text = fn ? fn(details, log.target_email) : log.action
  return text
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [perPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const seededQuery = localStorage.getItem('rep_global_audit_query')
    if (!seededQuery) return
    setQ(seededQuery)
    setPage(1)
    localStorage.removeItem('rep_global_audit_query')
  }, [])

  useEffect(() => {
    fetchLogs(1)
  }, [q])

  async function fetchLogs(pg = page) {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/audit-logs?q=${encodeURIComponent(q)}&limit=${perPage}&offset=${(pg - 1) * perPage}`)
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (e) { console.error('Fetch logs failed:', e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs() }, [page])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <input type="text" placeholder="Search by email or action…" value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), fetchLogs(1))}
          className="input input-bordered flex-1 min-w-0" />
        <button className="btn btn-primary" onClick={() => { setPage(1); fetchLogs(1) }}>Search</button>
      </div>

      {loading && <div className="flex justify-center py-6"><span className="loading loading-spinner" /></div>}

      {!loading && (
        <div className="space-y-1">
          {logs.length === 0
            ? <p className="text-center py-8 text-base-content/40">No activity found</p>
            : logs.map((log) => {
                let details = {}
                try { details = JSON.parse(log.details || '{}') } catch {}
                const actor = log.acted_by_email || log.target_email || '(system)'
                const text = formatLog(log)
                const ts = new Date(log.created_at).toLocaleString()
                const ip = log.ip_address
                let logDetails = {}
                try { logDetails = JSON.parse(log.details || '{}') } catch {}
                const changes = logDetails.changes || null
                const notePreview = logDetails.note_preview || null
                const filenames = logDetails.filenames || []

                const FIELD_LABELS = {
                  pin: 'PIN', address: 'Address', county: 'County',
                  price: 'Price ($)', square_feet: 'Square Feet', lot_size: 'Lot Size (ac)',
                  year_built: 'Year Built', on_major_road: 'On Major Road', traffic_vpd: 'Traffic VPD',
                  on_corner_lot: 'Corner Lot', direct_water_access: 'Direct Water Access',
                  next_to_public_land: 'Next to Public Land', major_interstates: 'Major Interstates',
                  household_income_min: 'Income Min ($)', household_income_max: 'Income Max ($)',
                  population_density: 'Population Density', logistics_hubs: 'Logistics Hubs',
                  landmarks: 'Landmarks', water_sources: 'Water Sources', military_bases: 'Military Bases',
                  first_name: 'First Name', last_name: 'Last Name', organization: 'Organization',
                  phone_number: 'Phone', buy_box: 'Buy Box', birthday: 'Birthday', role: 'Role',
                  asset_type: 'Asset Type', grm: 'GRM', cap_rate: 'Cap Rate (%)', cash_on_cash: 'Cash-on-Cash (%)',
                  irr: 'IRR (%)', price_per_unit: 'Price/Unit ($)', price_per_sqft: 'Price/SqFt ($)',
                  rent_to_sales_ratio: 'Rent-to-Sales Ratio (%)', num_skus: '# SKUs',
                  price_per_acre: 'Price/Acre ($)', electrical_voltage: 'Voltage (V)', electrical_amperage: 'Amperage (A)',
                  gross_scheduled_rent: 'Gross Scheduled Rent ($)', vacancy_rate: 'Vacancy/Credit Loss (%)',
                  other_income: 'Other Income ($)', operating_expenses: 'Operating Expenses ($)',
                  reserves_capex: 'Reserves/Capex ($)',
                  loan_amount: 'Loan Amount ($)', ltv: 'LTV (%)', interest_rate: 'Interest Rate (%)',
                  amortization_term: 'Amortization Term (yrs)', interest_only_period: 'Interest-Only Period (yrs)',
                  unit_count: 'Unit / Bay / Suite Count', closing_costs: 'Closing Costs ($)',
                  hold_period: 'Hold Period (yrs)', rent_growth: 'Rent Growth (%)',
                  expense_growth: 'Expense Growth (%)', exit_cap_rate: 'Exit Cap Rate (%)',
                  cost_of_sale: 'Cost of Sale (%)',
                  tenant_gross_sales: 'Tenant Annual Gross Sales ($)', tenant_base_rent: 'Tenant Base Rent ($)',
                  management_fee_pct: 'Management Fee (%)', insurance: 'Insurance ($/yr)',
                  property_taxes: 'Property Taxes ($/yr)', land_value_pct: 'Land Value (%)',
                  cost_seg_bonus_pct: 'Cost Seg Bonus (%)', effective_tax_rate: 'Effective Tax Rate (%)',
                  depreciation_recapture_rate: 'Depreciation Recapture Rate (%)',
                  refi_ltv: 'Refi LTV (%)', refi_rate: 'Refi Interest Rate (%)', refi_year: 'Refi Year',
                }
                function fmtVal(v) {
                  if (v === null || v === undefined || v === '') return null
                  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
                  if (Array.isArray(v)) {
                    if (v.length === 0) return null
                    return v.map(item => item.name ? `${item.name}${item.distance ? ` (${item.distance}mi)` : ''}` : JSON.stringify(item)).join(', ')
                  }
                  const n = Number(v)
                  if (!isNaN(n) && v !== '' && ['price','square_feet','traffic_vpd','household_income_min','household_income_max','population_density'].some(f => changes && changes[Object.keys(changes).find(k => k === f)] !== undefined))
                    return n.toLocaleString()
                  return String(v)
                }

                return (
                  <div key={log.id} className="flex gap-3 items-start py-2.5 px-4 rounded-lg hover:bg-base-200 border-b border-base-300/50">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${log.action === 'login_failed' ? 'bg-error' : log.action === 'login' || log.action === 'logout' ? 'bg-success' : 'bg-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm break-all">{actor}</span>
                      <span className="text-base-content/70 text-sm"> — {text}</span>
                      {ip && <span className="text-xs text-base-content/30 ml-1">· {ip}</span>}
                      <div className="text-xs text-base-content/40 mt-0.5 md:hidden">{ts}</div>
                      {/* Note preview */}
                      {notePreview && (
                        <div className="mt-1 text-xs bg-base-300/50 rounded px-2 py-1 text-base-content/70 italic">
                          "{notePreview}"
                        </div>
                      )}
                      {/* Attachment filenames */}
                      {filenames.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {filenames.map((f, i) => (
                            <span key={i} className="text-[10px] bg-base-300/60 rounded px-1.5 py-0.5 font-mono">{f}</span>
                          ))}
                        </div>
                      )}
                      {/* Field diff (properties + user fields) */}
                      {changes && Object.keys(changes).length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {Object.entries(changes).map(([field, { from, to }]) => {
                            const fromStr = fmtVal(from)
                            const toStr = fmtVal(to)
                            return (
                              <div key={field} className="text-xs font-mono bg-base-300/50 rounded px-2 py-0.5 flex flex-wrap gap-x-2 items-center">
                                <span className="font-semibold text-base-content/70 not-italic font-sans">{FIELD_LABELS[field] || field}:</span>
                                {fromStr ? <span className="text-error/80 line-through">{fromStr}</span> : <em className="text-base-content/30">empty</em>}
                                <span className="text-base-content/40">→</span>
                                {toStr ? <span className="text-success/80">{toStr}</span> : <em className="text-base-content/30">empty</em>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <span className="hidden md:block text-xs text-base-content/40 flex-shrink-0 mt-0.5 whitespace-nowrap">{ts}</span>
                  </div>
                )
              })
          }
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-2 pt-2">
        <span className="text-xs text-base-content/40">{total} total events</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-xs btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}>← Prev</button>
          <span className="text-xs text-base-content/60">Page {page} of {totalPages}</span>
          <button className="btn btn-xs btn-ghost" onClick={() => setPage(p => { const np = Math.min(totalPages, p + 1); fetchLogs(np); return np })} disabled={page >= totalPages || loading}>Next →</button>
        </div>
      </div>
    </div>
  )
}
