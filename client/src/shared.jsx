import { useCallback, useEffect, useMemo, useRef, useState, Component } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix default Leaflet marker icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('React error boundary caught:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-base-200">
          <div className="card bg-base-100 shadow-xl max-w-md w-full">
            <div className="card-body items-center text-center gap-4">
              <h2 className="card-title text-error">Something went wrong</h2>
              <p className="text-base-content/60 text-sm">{this.state.error.message}</p>
              <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.reload() }}>
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}


export function MapRecenter({ lat, lon }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lon], 14) }, [lat, lon])
  return null
}

export function PropertyMap({ address }) {
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(false)
  const prevAddress = useRef(null)

  useEffect(() => {
    if (!address || address === prevAddress.current) return
    prevAddress.current = address
    setCoords(null); setError(false)
    const encoded = encodeURIComponent(address)
    fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'CREPortal/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) {
          setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
        } else {
          setError(true)
        }
      })
      .catch(() => setError(true))
  }, [address])

  if (!address) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200 text-base-content/30 text-sm">
      Enter an address to see the map
    </div>
  )
  if (error) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200 text-base-content/30 text-sm">
      Location not found
    </div>
  )
  if (!coords) return (
    <div className="w-full h-full flex items-center justify-center bg-base-200">
      <span className="loading loading-spinner loading-md" />
    </div>
  )

  return (
    <MapContainer center={[coords.lat, coords.lon]} zoom={14}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom={true}
      zoomControl={true}
      attributionControl={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapRecenter lat={coords.lat} lon={coords.lon} />
      <Marker position={[coords.lat, coords.lon]}>
        <Popup>{address}</Popup>
      </Marker>
    </MapContainer>
  )
}

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status })
  }
  return res.json()
}

export const FIELD_HELP = {
  // Property
  price: 'Total purchase price of the property.',
  sqft: 'Rentable or gross building square footage.',
  lot: 'Total land area in acres.',
  yearBuilt: 'Year the building was originally constructed.',
  // Investment Metrics
  grm: 'Gross Rent Multiplier: Price ÷ Gross Scheduled Rent. Lower = cheaper relative to income.',
  capRate: 'Cap Rate: NOI ÷ Price. The unlevered yield on the asset. Higher = more income per dollar paid.',
  cashOnCash: 'Cash-on-Cash: (NOI − Debt Service) ÷ Equity invested. Your actual annual cash yield after debt.',
  leveredIrr: 'Levered IRR: Internal rate of return on equity invested, including debt. Accounts for financing.',
  unleveredIrr: 'Unlevered IRR: IRR on the full acquisition cost, ignoring debt. Measures pure asset performance.',
  leveredEmx: 'Equity Multiple (levered): Total cash returned to equity ÷ equity invested. 2x = you doubled your money.',
  unleveredEmx: 'Equity Multiple (unlevered): Total cash returned ÷ total cost. Ignores financing.',
  leveredNpv: 'Net Present Value of levered cash flows at the discount rate. Positive = deal exceeds your hurdle.',
  unleveredNpv: 'Net Present Value of unlevered cash flows at the discount rate.',
  discountRate: 'Your target/hurdle rate used to compute NPV. Usually your cost of capital or required return.',
  pricePerUnit: 'Price divided by number of units. Common multifamily benchmark.',
  pricePerSqft: 'Price divided by total square footage. Measures relative value across comparable assets.',
  rentToSales: 'Tenant rent as a percentage of their gross sales. Retail health check — above ~12% is a warning sign.',
  numSkus: 'Number of SKUs (retail product lines) the tenant carries. Operational detail.',
  pricePerAcre: 'Price divided by lot size in acres. Used for land-heavy or industrial deals.',
  // Operating
  managementFeePct: 'Property management fee as % of Effective Gross Income. Typically 4–10% for commercial.',
  managementFeeDollar: 'Computed annual management fee in dollars (read-only).',
  insurance: 'Annual property and liability insurance cost.',
  propertyTaxes: 'Annual real estate tax bill. Verify against most recent tax bill.',
  adjustedNoi: 'Net Operating Income after all operating expenses but before debt service. The core valuation metric.',
  // Income
  grossScheduledRent: 'Maximum potential rent if 100% occupied and all tenants pay full face rent.',
  vacancyRate: 'Estimated vacancy and credit loss as % of GSR. Reflects expected downtime between leases.',
  egi: 'Effective Gross Income: GSR − Vacancy + Other Income. What you actually collect.',
  otherIncome: 'Non-rent income: parking, signage, antenna rent, etc.',
  operatingExpenses: 'Total controllable operating costs excluding taxes, insurance, and reserves.',
  reservesCapex: 'Annual reserves set aside for capital expenditures and future deferred maintenance.',
  rentGrowth: 'Annual rent escalation rate applied to market rents and lease bumps.',
  expenseGrowth: 'Annual growth rate applied to operating expenses.',
  // Hold & Timing
  holdPeriod: 'Number of years you plan to own the asset before selling.',
  closingCosts: 'Acquisition costs beyond purchase price: title, legal, due diligence, etc.',
  exitCapRate: 'Cap rate applied to exit-year NOI to determine sale price. Higher = lower sale price.',
  costOfSale: 'Brokerage and closing costs on the sale, as % of gross sale price.',
  unitCount: 'Number of rentable units (apartments, suites, or bays).',
  tenantGrossSales: 'Tenant\'s annual gross sales volume. Used for percentage rent calculations.',
  tenantBaseRent: 'Tenant\'s contractual base rent, separate from percentage rent.',
  // Debt
  loanAmount: 'Total senior loan amount. LTV = Loan ÷ Price.',
  interestRate: 'Annual interest rate on the senior loan.',
  amortTerm: 'Number of years over which the loan amortizes (principal pays down).',
  ioPeriod: 'Interest-only period in months. During I/O, no principal is paid, maximizing early cash flow.',
  loanTerm: 'Total loan term before the balloon payment or maturity.',
  floatingRate: 'Toggle for floating-rate debt. Rate = SOFR + spread.',
  sofrRate: 'Current SOFR rate (base index for floating-rate loans).',
  indexSpread: 'Spread above SOFR charged by the lender.',
  interestReserve: 'Months of interest held in reserve at closing, often required during lease-up.',
  loanFee: 'Origination or placement fee as % of loan amount.',
  refiYear: 'Year in the hold period when you refinance.',
  refiMonth: 'Month within the refi year when the refinance closes.',
  refiLtv: 'Loan-to-Value at refinance. Determines how much new debt you can pull out.',
  refiRate: 'Interest rate on the refinance loan.',
  debtYield: 'Debt Yield: NOI ÷ Loan Balance. Lenders typically require 8–10%.',
  dscr: 'Debt Service Coverage Ratio: NOI ÷ Annual Debt Service. Lenders typically require ≥1.20x.',
  // Tax
  landValuePct: 'Portion of purchase price allocated to land (not depreciable). Reduces depreciation benefit.',
  costSegBonus: 'Bonus depreciation % from cost segregation study. Accelerates early deductions.',
  effectiveTaxRate: 'Your effective combined federal + state income tax rate.',
  deprecRecapture: 'Tax rate on depreciation recapture at sale. Typically 25% federal.',
  startingLoss: 'Existing suspended passive losses carried into this investment.',
  // Lease Economics
  leaseType: 'Lease structure: NNN (tenant pays all expenses), Modified Gross, or Gross (landlord pays).',
  expenseStopPerSf: 'Base year expense stop: landlord pays expenses up to this amount per SF; tenant pays overage.',
  grossUpPct: 'For expense recovery calculations, grosses up expenses as if building is X% occupied.',
  newLeaseSpread: 'Mark-to-market spread for new leases vs. in-place rents.',
  renewalSpread: 'Mark-to-market spread for lease renewals vs. in-place rents.',
  tiPerSf: 'Tenant Improvement allowance per square foot for new leases.',
  lcPct: 'Leasing commission as % of total lease value.',
  percentageRentBreakpoint: 'Type of breakpoint for percentage rent: Natural (base rent ÷ pct rent rate) or Artificial (fixed).',
  camAdminFee: 'Administrative fee added to CAM recoveries, as % of gross CAM pool.',
  controllableExpensePct: 'Share of operating expenses classified as controllable (subject to annual cap).',
  controllableCapPct: 'Maximum annual increase in controllable expenses billed to tenants.',
  nonRecoverablePct: 'Share of expenses that cannot be recovered from tenants.',
  recoveryMethod: 'How CAM pool is grossed up when building is not 100% occupied.',
  reconciliationMonth: 'Month of year when annual CAM reconciliation is performed.',
  // Waterfall
  prefRate: 'Preferred return rate: investors receive this annual return before any promote is paid.',
  catchUpRate: 'GP catch-up rate after LP pref is paid, before tiered splits kick in.',
  promoteRate: 'GP promote (carried interest) on profits above the pref hurdle.',
  lpShare: 'LP share of distributions after the pref and promote hurdles.',
  gpShare: 'GP/Sponsor share of distributions (co-invest, not promote).',
  // Governance
  inputsLocked: 'Prevents any input changes — use to freeze assumptions for board or lender review.',
  formulasLocked: 'Locks formula overrides — computed values cannot be manually changed.',
  overridesEnabled: 'Allow manual overrides to formula-computed values.',
  overrideNote: 'Memo explaining why overrides were applied.',
  diagnosticLevel: 'How aggressively the model checks for broken or unusual assumptions.',
  // Equity / Returns
  equity: 'Total equity invested: Purchase Price + Closing Costs − Loan Amount.',
  yieldOnCost: 'Year 1 NOI ÷ Total Acquisition Cost (including closing costs). Unlevered cash yield on your basis.',
  ltv: 'Loan-to-Value ratio: Loan Amount ÷ Price. Most commercial lenders cap at 65–75%.',
  rateCap: 'Maximum interest rate on a floating-rate loan. Purchased as a hedge to cap exposure.',
  rateFloor: 'Minimum interest rate floor on a floating instrument.',
  refiLoanTerm: 'Term of the refinance loan in years before its balloon maturity.',
  annualDebtService: 'Total annual principal + interest payments on the loan (read-only).',
  depreciableBasis: 'Building value eligible for depreciation: Price × (1 − Land Value %). Land is not depreciable.',
  bonusDepreciation: 'Accelerated first-year depreciation from a cost segregation study (bonus depreciation election).',
  standardDepreciation: 'Annual straight-line depreciation: Depreciable Basis ÷ 39 years.',
  totalDepreciation: 'Sum of bonus + standard depreciation claimed in year one.',
  capitalGainsTaxRate: 'Long-term capital gains tax rate applied to profit on sale above your adjusted basis.',
  ordinaryIncomeTaxRate: 'Ordinary income tax rate — applied to depreciation recapture on sale.',
  passiveLossLimit: 'Annual limit on passive loss usage against active income (100% = fully usable).',
  initialTaxBasis: 'Your starting tax basis: typically your purchase price plus improvements.',
  taxShield: 'Estimated tax savings from year-one depreciation deductions (Depreciation × Tax Rate).',
  installmentSale: 'Defers capital gains by receiving sale proceeds over time instead of all at once.',
  entityType: 'Legal entity holding the property. Affects depreciation, pass-through treatment, and tax rates.',
  recaptureTax: 'Tax on depreciation recaptured at sale. Federal rate is typically 25% on recaptured amounts.',
  capitalGainsTax: 'Tax on the capital gain above your adjusted basis at sale.',
  refiCost: 'Refinance closing costs as % of new loan amount (points, fees, title).',
  exitValue: 'Gross sale price at end of hold period: Exit-Year NOI ÷ Exit Cap Rate.',
  netSaleProceeds: 'Gross sale price minus cost of sale and full loan payoff.',
  loanBalanceAtExit: 'Remaining outstanding loan balance at the time of sale.',
  netEquityOnExit: 'Cash returned to equity after paying off the loan and all sale costs.',
  saleMonth: 'Month within the exit year when the property sale closes.',
  marketRentGrowth: 'Annual growth rate for market rents used in lease rollover / re-leasing analysis.',
  camPoolRecoverable: 'Share of the CAM operating expense pool that is recoverable from tenants.',
  taxPoolRecoverable: 'Share of real estate taxes that are recoverable from tenants via NNN or modified gross leases.',
  insurancePoolRecoverable: 'Share of insurance costs recoverable from tenants.',
  voltage: 'Electrical voltage available at the service panel. Industrial tenants often require 480V/3-phase.',
  amperage: 'Electrical service capacity in amps. Heavy users (cold storage, manufacturing) need 1,000A+.',
  rentToSalesRatio: 'Tenant rent as % of tenant gross sales. Retail health check — above ~12% is a warning sign.',
  tenantName: 'Legal or trade name of the tenant occupying this space.',
  suite: 'Suite, unit, or bay identifier for this tenant space.',
  annualRent: 'Contractual annual base rent for this tenant.',
  annualSales: "Tenant's reported gross annual sales — used to compute percentage rent.",
  leaseStartYear: 'Year the lease term begins.',
  leaseStartMonth: 'Month the lease term begins.',
  leaseEndYear: 'Year the lease term expires.',
  leaseEndMonth: 'Month the lease term expires.',
  annualRentBumps: 'Scheduled annual rent escalation (step-up) rate for this specific tenant.',
  marketRentPerSf: "Estimated current market rent per square foot for this tenant's space. Used for rollover underwriting.",
  renewalProbability: 'Estimated probability this tenant renews at lease expiration. Affects vacancy and TI/LC costs.',
  downtime: 'Estimated months of vacancy between leases if the tenant does not renew.',
  extensionOption: 'Length of any contractual extension option this tenant holds, in months.',
  expansionSf: 'Square footage the tenant has the contractual right to expand into.',
  contractionSf: 'Square footage the tenant has the contractual right to give back (reduce).',
  terminationMonth: 'Month index at which the tenant can exercise an early termination right.',
  purchaseOption: 'Fixed price at which the tenant can purchase the property under a purchase option.',
  percentRentBreakpoint: 'Annual sales volume above which percentage rent is owed.',
  percentRentRate: 'Additional rent owed as % of sales above the breakpoint.',
  coTenancyGroup: 'Group name for co-tenancy clause tracking (e.g., "anchor"). If the anchor vacates, other tenants may get rent relief.',
  camPoolShare: "This tenant's allocated percentage share of the common area maintenance expense pool.",
  adminFeeOverride: 'CAM admin fee override for this specific tenant (overrides the lease-level default).',
  activeScenario: 'Which underwriting scenario (Base, Upside, Downside) is currently active for the main DCF.',
  scenarioRentGrowth: 'Rent growth override for this scenario.',
  scenarioExpenseGrowth: 'Expense growth override for this scenario.',
  scenarioExitCapRate: 'Exit cap rate override for this scenario.',
  scenarioVacancyRate: 'Vacancy rate override for this scenario.',
  scenarioLoanAmount: 'Loan amount override for this scenario.',
  scenarioHoldPeriod: 'Hold period override for this scenario.',
}

export function Field({ label, required, help, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-base-content/60 flex items-center gap-1">
        {label}{required && <span className="text-base-content ml-0.5">*</span>}
        {help && (
          <span className="tooltip tooltip-right normal-case font-normal tracking-normal" data-tip={help}>
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-base-300 text-base-content/50 text-[9px] cursor-help select-none leading-none">?</span>
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

export function NumericInput({ value, onChange, placeholder, className, disabled, allowDecimal, style }) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    if (value === '' || value === null || value === undefined) { setDisplay(''); return }
    const num = allowDecimal ? parseFloat(value) : parseInt(value, 10)
    if (!isNaN(num)) setDisplay(num.toLocaleString('en-US', allowDecimal ? { maximumFractionDigits: 4 } : {}))
    else setDisplay(String(value))
  }, [value])

  function handleChange(e) {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || raw === '-') { setDisplay(raw); onChange(''); return }
    const num = allowDecimal ? parseFloat(raw) : parseInt(raw, 10)
    if (!isNaN(num)) {
      setDisplay(raw) // keep raw while typing so cursor stays natural
      onChange(raw)
    } else if (/^[\d.]*$/.test(raw)) {
      setDisplay(raw); onChange(raw)
    }
  }

  function handleBlur() {
    if (value === '' || value === null || value === undefined) { setDisplay(''); return }
    const num = allowDecimal ? parseFloat(value) : parseInt(value, 10)
    if (!isNaN(num)) setDisplay(num.toLocaleString('en-US', allowDecimal ? { maximumFractionDigits: 4 } : {}))
  }

  function handleFocus() {
    // Show plain number while editing
    setDisplay(value !== '' && value !== null && value !== undefined ? String(value) : '')
  }

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      placeholder={placeholder}
      className={className}
      style={style}
      disabled={disabled}
    />
  )
}

export function playSaveSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // Short soft chime: two sine tones fading out
    const notes = [523.25, 659.25] // C5, E5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07)
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.07)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.07 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.35)
      osc.start(ctx.currentTime + i * 0.07)
      osc.stop(ctx.currentTime + i * 0.07 + 0.35)
    })
    setTimeout(() => ctx.close(), 800)
  } catch {}
}

export function SaveButton({ onClick, disabled, loading, label = 'Save Changes', loadingLabel = 'Saving…', className = 'w-full', type = 'button', savedSignal = 0 }) {
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (savedSignal === 0) return
    setSaved(true)
    playSaveSound()
    const t = setTimeout(() => setSaved(false), 1800)
    return () => clearTimeout(t)
  }, [savedSignal])

  return (
    <button
      type={type}
      className={`btn ${saved ? 'btn-save-success' : 'btn-primary'} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? loadingLabel : saved ? '✓ Saved' : label}
    </button>
  )
}

export function PropertyCardCarousel({ propertyId, onClick }) {
  const [media, setMedia] = useState([])
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/properties/${propertyId}/media`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setMedia(d.media || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [propertyId])

  if (!loaded) return (
    <div className="w-full h-48 bg-base-200 animate-pulse" />
  )

  if (media.length === 0) return (
    <div className="w-full h-48 bg-base-200 flex items-center justify-center" onClick={onClick}>
      <span className="text-xs text-base-content/30 uppercase tracking-widest">No images</span>
    </div>
  )

  const current = media[idx]
  const isVideo = current.media_type?.startsWith('video')

  function prev(e) {
    e.stopPropagation()
    setIdx(i => (i - 1 + media.length) % media.length)
  }
  function next(e) {
    e.stopPropagation()
    setIdx(i => (i + 1) % media.length)
  }

  return (
    <div className="relative w-full h-48 overflow-hidden bg-black group" onClick={onClick}>
      {isVideo
        ? <video
            key={current.id}
            src={`/api/properties/${propertyId}/media/${current.id}`}
            className="w-full h-full object-cover"
            muted autoPlay={false}
          />
        : <img
            key={current.id}
            src={`/api/properties/${propertyId}/media/${current.id}`}
            alt={current.filename}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
      }

      {media.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-black/50 border-0 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={prev}
          >‹</button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-xs btn-circle bg-black/50 border-0 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={next}
          >›</button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {media.map((_, i) => (
              <button
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
                onClick={e => { e.stopPropagation(); setIdx(i) }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function PropertyModalCarousel({ propertyId }) {
  const [media, setMedia] = useState([])
  const [idx, setIdx] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/properties/${propertyId}/media`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setMedia(d.media || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [propertyId])

  if (!propertyId) return null
  if (!loaded) return <div className="w-full h-64 bg-base-200 animate-pulse rounded-lg mb-4" />
  if (media.length === 0) return (
    <div className="w-full h-40 bg-base-200 rounded-lg flex items-center justify-center mb-4">
      <span className="text-xs text-base-content/30 uppercase tracking-widest">No media uploaded</span>
    </div>
  )

  const current = media[idx]
  const isVideo = current.media_type?.startsWith('video')
  const prev = () => setIdx(i => (i - 1 + media.length) % media.length)
  const next = () => setIdx(i => (i + 1) % media.length)

  return (
    <>
      {/* Main image */}
      <div className="relative w-full h-64 md:h-80 bg-black rounded-lg overflow-hidden mb-3 group">
        {isVideo
          ? <video key={current.id}
              src={`/api/properties/${propertyId}/media/${current.id}`}
              className="w-full h-full object-contain"
              controls
            />
          : <img key={current.id}
              src={`/api/properties/${propertyId}/media/${current.id}`}
              alt={current.filename}
              className="w-full h-full object-contain transition-opacity duration-200"
            />
        }

        {/* Nav arrows */}
        {media.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 btn btn-sm btn-circle bg-black/60 border-0 text-white"
              onClick={prev}
            >‹</button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-circle bg-black/60 border-0 text-white"
              onClick={next}
            >›</button>
          </>
        )}

        {/* Counter */}
        <div className="absolute bottom-2 right-3 text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-full">
          {idx + 1} / {media.length}
        </div>
      </div>

      {/* Thumbnail strip */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {media.map((m, i) => {
            const isVid = m.media_type?.startsWith('video')
            return (
              <button
                key={m.id}
                onClick={() => setIdx(i)}
                className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors ${i === idx ? 'border-primary' : 'border-transparent'}`}
              >
                {isVid
                  ? <div className="w-full h-full bg-base-300 flex items-center justify-center text-xl">▶</div>
                  : <img src={`/api/properties/${propertyId}/media/${m.id}`} alt="" className="w-full h-full object-cover" />
                }
              </button>
            )
          })}
        </div>
      )}

    </>
  )
}

export function RecaptchaShield({ status }) {
  // status: null | 'verifying' | 'success' | 'denied'
  const r = 22, circ = 2 * Math.PI * r
  const ringColor = status === 'success' ? '#22c55e' : status === 'denied' ? '#ef4444' : '#9ca3af'
  const iconColor = status === 'success' ? '#22c55e' : status === 'denied' ? '#ef4444' : '#9ca3af'
  const label = status === 'verifying' ? 'Verifying…' : status === 'success' ? 'Verified' : status === 'denied' ? 'Denied' : 'Protected by reCAPTCHA'

  return (
    <div className="flex flex-col items-center gap-1 select-none" aria-live="polite">
      <div className="relative w-14 h-14 flex items-center justify-center">
        {/* Spinning progress ring */}
        <svg className="absolute inset-0 w-14 h-14" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="28" cy="28" r={r} fill="none" stroke={status ? ringColor + '33' : '#0001'} strokeWidth="3" />
          {status === 'verifying' && (
            <circle cx="28" cy="28" r={r} fill="none" stroke={ringColor} strokeWidth="3"
              strokeDasharray={circ} strokeDashoffset={circ * 0.7}
              strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 28 28" to="360 28 28" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
          {(status === 'success' || status === 'denied') && (
            <circle cx="28" cy="28" r={r} fill="none" stroke={ringColor} strokeWidth="3"
              strokeDasharray={circ} strokeDashoffset="0" strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          )}
          {!status && (
            <circle cx="28" cy="28" r={r} fill="none" stroke="#9ca3af55" strokeWidth="2"
              strokeDasharray="3 4" />
          )}
        </svg>

        {/* Shield icon */}
        <svg viewBox="0 0 24 24" className="w-7 h-7 relative z-10" fill={iconColor}
          style={{ transition: 'fill 0.3s ease' }}>
          {status === 'success' ? (
            // Shield with checkmark
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 13l-3-3 1.41-1.41L10 11.17l5.59-5.58L17 7l-7 7z" />
          ) : status === 'denied' ? (
            // Shield with X
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm3 13l-1.41 1.41L12 14l-1.59 1.41L9 14l1.41-1.41L9 11l1.41-1.41L12 11l1.59-1.41L15 11l-1.41 1.41L15 14z" />
          ) : (
            // Plain shield
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          )}
        </svg>
      </div>
      <span className="text-xs" style={{ color: ringColor, transition: 'color 0.3s ease' }}>
        {label}
      </span>
    </div>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-sm flex items-center justify-center">
        <img src="/apple-touch-icon.png" alt="Logo" className="w-9 h-9 object-contain" />
      </div>
      <div className="flex flex-col leading-none gap-0.5">
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 800,
          fontSize: '1.1rem',
          letterSpacing: '0.08em',
          color: '#111111',
        }}>
          ROSPOPA
        </span>
        <span style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600,
          fontSize: '0.7rem',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          opacity: 0.45,
        }}>
          PAVLO
        </span>
      </div>
    </div>
  )
}

export function Modal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-base-content/70 leading-relaxed">{message}</p>
        <div className="modal-action mt-6">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onCancel}><button>close</button></form>
    </div>
  )
}

export function Avatar({ src, name, size = 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-10 h-10 text-sm'
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return src
    ? <img src={src} alt={name} className={`${dim} rounded-full object-cover border border-base-300 flex-shrink-0`} />
    : <div className={`${dim} rounded-full bg-base-300 flex items-center justify-center font-semibold text-base-content/60 flex-shrink-0`}>{initials}</div>
}

export function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  // Strip leading 1
  const local = digits.startsWith('1') ? digits.slice(1) : digits
  const d = local.slice(0, 10)
  if (d.length <= 3) return `+1 (${d}`
  if (d.length <= 6) return `+1 (${d.slice(0,3)}) ${d.slice(3)}`
  return `+1 (${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
}

export function PhotoCropper({ src, onSave, onCancel }) {
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imgRef = useRef(new Image())
  const SIZE = 300

  useEffect(() => {
    const img = imgRef.current
    img.onload = () => {
      // Auto-fit: scale to fill the square
      const fit = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight)
      setScale(fit)
      setOffsetX(0); setOffsetY(0)
      draw(img, fit, 0, 0)
    }
    img.src = src
  }, [src])

  function draw(img, s, ox, oy) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    const w = img.naturalWidth * s
    const h = img.naturalHeight * s
    const x = (SIZE - w) / 2 + ox
    const y = (SIZE - h) / 2 + oy
    ctx.drawImage(img, x, y, w, h)
    // Darken outside circle
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE/2, SIZE/2 - 4, 0, Math.PI*2)
    ctx.fill()
    ctx.restore()
    // Circle border
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE/2, SIZE/2 - 4, 0, Math.PI*2); ctx.stroke()
  }

  useEffect(() => { draw(imgRef.current, scale, offsetX, offsetY) }, [scale, offsetX, offsetY])

  function onMouseDown(e) {
    setDragging(true)
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY })
  }
  function onMouseMove(e) {
    if (!dragging) return
    setOffsetX(e.clientX - dragStart.x)
    setOffsetY(e.clientY - dragStart.y)
  }
  function onMouseUp() { setDragging(false) }

  // Touch support
  function onTouchStart(e) {
    const t = e.touches[0]
    setDragging(true); setDragStart({ x: t.clientX - offsetX, y: t.clientY - offsetY })
  }
  function onTouchMove(e) {
    if (!dragging) return
    const t = e.touches[0]
    setOffsetX(t.clientX - dragStart.x); setOffsetY(t.clientY - dragStart.y)
  }

  function handleSave() {
    const canvas = canvasRef.current
    // Draw final clean circle crop
    const out = document.createElement('canvas')
    out.width = SIZE; out.height = SIZE
    const ctx = out.getContext('2d')
    ctx.beginPath(); ctx.arc(SIZE/2, SIZE/2, SIZE/2, 0, Math.PI*2); ctx.clip()
    const img = imgRef.current
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const x = (SIZE - w) / 2 + offsetX
    const y = (SIZE - h) / 2 + offsetY
    ctx.drawImage(img, x, y, w, h)
    onSave(out.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-2xl p-6 space-y-4 w-full max-w-sm shadow-2xl">
        <h3 className="font-bold text-lg text-center">Adjust Profile Photo</h3>
        <p className="text-xs text-base-content/50 text-center">Drag to reposition · Scroll or slider to zoom</p>

        <div className="flex justify-center">
          <canvas ref={canvasRef} width={SIZE} height={SIZE}
            className="rounded-full cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
            onWheel={e => { e.preventDefault(); setScale(s => Math.max(0.5, Math.min(5, s - e.deltaY * 0.001))) }}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-base-content/40">Zoom</span>
          <input type="range" min="0.5" max="5" step="0.01" value={scale}
            onChange={e => setScale(Number(e.target.value))}
            className="range range-xs flex-1" />
        </div>

        <div className="flex gap-3">
          <button className="btn btn-outline flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={handleSave}>Use Photo</button>
        </div>
      </div>
    </div>
  )
}

export async function getRecaptchaToken(action) {
  try {
    await new Promise((resolve, reject) => {
      if (window.grecaptcha?.enterprise) return resolve()
      let attempts = 0
      const interval = setInterval(() => {
        if (window.grecaptcha?.enterprise) { clearInterval(interval); resolve() }
        else if (++attempts > 30) { clearInterval(interval); reject(new Error('timeout')) }
      }, 100)
    })
    return await window.grecaptcha.enterprise.execute('6LerA3ctAAAAAKpS3caYCY9pDLR26TQY060EFpYv', { action })
  } catch { return null }
}

export function ForgotPasswordModal({ onClose, prefillEmail }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState(prefillEmail || '')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [success, setSuccess] = useState(false)
  const [captchaStatus, setCaptchaStatus] = useState(null) // null | 'verifying' | 'success' | 'denied'

  useEffect(() => {
    if (!document.getElementById('recaptcha-script')) {
      const s = document.createElement('script')
      s.id = 'recaptcha-script'
      s.src = 'https://www.google.com/recaptcha/enterprise.js?render=6LerA3ctAAAAAKpS3caYCY9pDLR26TQY060EFpYv'
      s.async = true; s.defer = true
      document.head.appendChild(s)
    }
  }, [])

  async function sendCode(e) {
    e.preventDefault()
    setMsg(''); setLoading(true); setCaptchaStatus('verifying')
    try {
      const recaptchaToken = await getRecaptchaToken('FORGOT_PASSWORD')
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken })
      })
      const data = await res.json()
      if (!res.ok) {
        setCaptchaStatus('denied')
        setTimeout(() => setCaptchaStatus(null), 2500)
        return setMsg(data.error || 'Failed to send code.')
      }
      setCaptchaStatus('success')
      await new Promise(r => setTimeout(r, 700))
      setCaptchaStatus(null)
      setStep('code')
    } catch {
      setCaptchaStatus('denied')
      setTimeout(() => setCaptchaStatus(null), 2500)
      setMsg('Network error. Please try again.')
    }
    finally { setLoading(false) }
  }

  async function resetPassword(e) {
    e.preventDefault()
    setMsg('')
    if (newPassword !== confirmPassword) return setMsg('Passwords do not match')
    if (newPassword.length < 8) return setMsg('Password must be at least 8 characters')
    setLoading(true)
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      })
      const data = await res.json()
      if (!res.ok) return setMsg(data.error || 'Reset failed')
      setSuccess(true)
    } catch { setMsg('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">
            {success ? 'Password Reset' : step === 'email' ? 'Forgot Password' : 'Enter Code'}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <p className="font-medium">Your password has been reset.</p>
            <p className="text-sm text-base-content/50">You can now sign in with your new password.</p>
            <button className="btn btn-primary w-full" onClick={onClose}>Sign In</button>
          </div>
        ) : step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <p className="text-sm text-base-content/50">Enter your email and we'll send you a 6-digit code.</p>
            <Field label="Email" required>
              <input type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)} className="input input-bordered w-full" required />
            </Field>
            {msg && <div className="alert alert-error text-sm">{msg}</div>}
            {captchaStatus && (
              <div className="flex justify-center">
                <RecaptchaShield status={captchaStatus} />
              </div>
            )}
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Verifying…' : 'Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <p className="text-sm text-base-content/50">
              A 6-digit code was sent to <strong>{email}</strong>. It expires in 15 minutes.
            </p>
            <Field label="Code" required>
              <input type="text" placeholder="000000" value={code} maxLength={6}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="input input-bordered w-full text-center tracking-[0.5em] text-xl font-bold" required />
            </Field>
            <Field label="New Password" required>
              <input type="password" placeholder="Min. 8 characters" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} className="input input-bordered w-full" required />
            </Field>
            <Field label="Confirm Password" required>
              <input type="password" placeholder="Repeat password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} className="input input-bordered w-full" required />
            </Field>
            {msg && <div className="alert alert-error text-sm">{msg}</div>}
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm w-full"
              onClick={() => { setStep('email'); setMsg('') }}>
              ← Back
            </button>
          </form>
        )}
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>
    </div>
  )
}

export async function downloadAttachment(userId, noteId, attachId, filename) {
  const res = await fetch(`/api/contacts/${userId}/notes/${noteId}/attachments/${attachId}`, { credentials: 'include' })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function fmtLastLogin(ts) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

export function OnlineDot({ online }) {
  return (
    <span
      title={online ? 'Online' : 'Offline'}
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-green-500' : 'bg-red-400'}`}
    />
  )
}

export function fmtLastNote(ts) {
  if (!ts) return null
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffH   = Math.floor(diffMs / 3600000)
  const diffD   = Math.floor(diffMs / 86400000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffH < 24)   return `${diffH}h ago`
  if (diffD < 7)    return `${diffD}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffD > 365 ? 'numeric' : undefined })
}

// Birthday helpers — birthdays are stored/transported as plain 'YYYY-MM-DD' strings
export function fmtBirthday(value, { withYear = true } = {}) {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
}

// Whole years old on the next/most recent birthday boundary
export function birthdayAge(value) {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const now = new Date()
  let age = now.getFullYear() - y
  const beforeBirthday = now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)
  if (beforeBirthday) age -= 1
  return age >= 0 ? age : null
}

// Days until the next occurrence of the birthday (0 = today)
export function daysUntilBirthday(value) {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m) return null
  const mo = Number(m[2]), d = Number(m[3])
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  let next = Date.UTC(now.getFullYear(), mo - 1, d)
  if (next < today) next = Date.UTC(now.getFullYear() + 1, mo - 1, d)
  return Math.round((next - today) / 86400000)
}

// Debounce utility for search and filter inputs
export function useDebounce(value, delay = 200) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// Simple prefetch cache for modal data
const prefetchCache = new Map()
export function prefetchPropertyDetail(propId) {
  if (prefetchCache.has(propId)) return
  prefetchCache.set(propId, 'loading')
  apiFetch(`/api/properties/${propId}`).then(data => {
    prefetchCache.set(propId, data)
  }).catch(() => {
    prefetchCache.delete(propId)
  })
}

export function getPrefetchedProperty(propId) {
  const cached = prefetchCache.get(propId)
  return cached !== 'loading' ? cached : null
}

// Shared online-status polling hook for all components
let sharedOnlineStatus = { online: [], lastLogin: {} }
let sharedOnlineStatusSubscribers = new Set()
let sharedOnlineStatusInterval = null

function startSharedOnlineStatusPolling() {
 if (sharedOnlineStatusInterval) return
 const fetchStatus = async () => {
   try {
     const data = await apiFetch('/api/online-status')
     sharedOnlineStatus = data
     sharedOnlineStatusSubscribers.forEach(callback => callback(data))
   } catch (e) {}
 }
 fetchStatus()
 sharedOnlineStatusInterval = setInterval(fetchStatus, 30000)
}

export function useSharedOnlineStatus() {
 const [status, setStatus] = useState(sharedOnlineStatus)

 useEffect(() => {
   startSharedOnlineStatusPolling()
   sharedOnlineStatusSubscribers.add(setStatus)
   return () => {
     sharedOnlineStatusSubscribers.delete(setStatus)
   }
 }, [])

 return status
}
