// Monthly DCF engine ported from the former workspace Financials tab.
// Rows use whole dollars; compounding and loan calculations retain full precision.
const DCF_ROW_DEFS = [
  { key: 'grossRevenue', label: 'Gross Revenue', type: 'currency', category: 'income', group: 'revenue' },
  { key: 'vacancyCreditLoss', label: 'Vacancy / Credit Loss', type: 'currency', category: 'income', group: 'revenue' },
  { key: 'percentageRentDcf', label: 'Percentage Rent', type: 'currency', category: 'income', group: 'revenue' },
  { key: 'otherIncomeDcf', label: 'Other Income', type: 'currency', category: 'income', group: 'revenue' },
  { key: 'effectiveGrossIncome', label: 'Effective Gross Income', type: 'currency', category: 'formula', group: 'revenue', readOnly: true, subtotal: true, help: 'Gross Revenue - Vacancy / Credit Loss + Percentage Rent + Other Income.' },
  { key: 'operatingExpensesDcf', label: 'Operating Expenses', type: 'currency', category: 'expense', group: 'expenses' },
  { key: 'managementFeesDcf', label: 'Management Fees', type: 'currency', category: 'expense', group: 'expenses' },
  { key: 'propertyTaxesDcf', label: 'Property Taxes', type: 'currency', category: 'expense', group: 'expenses' },
  { key: 'insuranceDcf', label: 'Insurance', type: 'currency', category: 'expense', group: 'expenses' },
  { key: 'reservesCapexDcf', label: 'Reserves / Replacement Reserve', type: 'currency', category: 'expense', group: 'expenses' },
  { key: 'netOperatingIncomeDcf', label: 'Net Operating Income', type: 'currency', category: 'formula', group: 'expenses', readOnly: true, subtotal: true, help: 'EGI - Operating Expenses - Management Fees - Property Taxes - Insurance - Reserves.' },
  { key: 'tenantImprovements', label: 'Tenant Improvements (TI)', type: 'currency', category: 'capital', group: 'capital' },
  { key: 'leasingCommissions', label: 'Leasing Commissions (LC)', type: 'currency', category: 'capital', group: 'capital' },
  { key: 'capitalExpenditures', label: 'Additional Capex', type: 'currency', category: 'capital', group: 'capital' },
  { key: 'refinanceProceeds', label: 'Refinance Proceeds', type: 'currency', category: 'capital', group: 'capital' },
  { key: 'refinanceCostsDcf', label: 'Refinance Costs', type: 'currency', category: 'capital', group: 'capital' },
  { key: 'loanPayoffAtRefi', label: 'Loan Payoff at Refi', type: 'currency', category: 'capital', group: 'capital', readOnly: true },
  { key: 'interestReserveDraw', label: 'Interest Reserve Draw', type: 'currency', category: 'capital', group: 'capital', readOnly: true },
  { key: 'debtServiceDcf', label: 'Debt Service', type: 'currency', category: 'debt', group: 'debt' },
  { key: 'loanBalanceDcf', label: 'Loan Balance', type: 'currency', category: 'debt', group: 'debt', readOnly: true },
  { key: 'taxesDcf', label: 'Operating Tax', type: 'currency', category: 'tax', group: 'tax' },
  { key: 'capitalGainsTaxDcf', label: 'Capital Gains Tax', type: 'currency', category: 'tax', group: 'tax', readOnly: true },
  { key: 'cashFlowBeforeSale', label: 'Cash Flow Before Sale', type: 'currency', category: 'formula', group: 'tax', readOnly: true, subtotal: true, help: 'Reserve-adjusted NOI - TI - LC - Capex - Debt Service + Reserve Draw + Gross Refi Proceeds - Refi Payoff - Refi Costs - Operating Tax.' },
  { key: 'grossSaleProceedsDcf', label: 'Gross Sale Proceeds', type: 'currency', category: 'exit', group: 'exit', readOnly: true },
  { key: 'saleCostsDcf', label: 'Sale Costs', type: 'currency', category: 'exit', group: 'exit', readOnly: true },
  { key: 'loanPayoffAtSale', label: 'Loan Payoff at Sale', type: 'currency', category: 'exit', group: 'exit', readOnly: true },
  { key: 'recaptureTaxDcf', label: 'Recapture Tax', type: 'currency', category: 'exit', group: 'exit', readOnly: true },
  { key: 'saleProceedsDcf', label: 'Sale Proceeds', type: 'currency', category: 'exit', group: 'exit', subtotal: true, help: 'Gross Sale Proceeds - Sale Costs - Loan Payoff at Sale - Exit Taxes.' },
  { key: 'cashFlowAfterSale', label: 'Total Equity Cash Flow', type: 'currency', category: 'formula', group: 'exit', readOnly: true, subtotal: true, help: 'Cash Flow Before Sale + Net Sale Proceeds. LP and sponsor distributions allocate this cash; they are not deducted again from total equity returns.' },
  { key: 'waterfallSponsor', label: 'Sponsor Waterfall', type: 'currency', category: 'waterfall', group: 'waterfall' },
  { key: 'waterfallInvestor', label: 'Investor Waterfall', type: 'currency', category: 'waterfall', group: 'waterfall' },
]
const DCF_GROUPS = [
  { key: 'revenue', label: 'Revenue', tone: 'text-primary border-primary bg-primary/10' },
  { key: 'expenses', label: 'Expenses / NOI', tone: 'text-warning border-warning bg-warning/10' },
  { key: 'capital', label: 'Capital Events', tone: 'text-info border-info bg-info/10' },
  { key: 'debt', label: 'Debt', tone: 'text-info border-info bg-info/10' },
  { key: 'tax', label: 'Taxes / Cash Flow', tone: 'text-error border-error bg-error/10' },
  { key: 'exit', label: 'Exit / Sale', tone: 'text-success border-success bg-success/10' },
  { key: 'waterfall', label: 'Waterfall', tone: 'text-info border-info bg-info/10' },
]
const DCF_MAX_YEARS = 10
const defaultDcfModel = () => ({
  months: [],
  years: Array.from({ length: DCF_MAX_YEARS }, (_, index) => {
    const year = index + 1
    return {
      year,
      grossRevenue: '',
      vacancyCreditLoss: '',
      percentageRentDcf: '',
      otherIncomeDcf: '',
      operatingExpensesDcf: '',
      managementFeesDcf: '',
      propertyTaxesDcf: '',
      insuranceDcf: '',
      reservesCapexDcf: '',
      tenantImprovements: '',
      leasingCommissions: '',
      capitalExpenditures: '',
      debtServiceDcf: '',
      loanBalanceDcf: '',
      refinanceProceeds: '',
      refinanceCostsDcf: '',
      loanPayoffAtRefi: '',
      taxesDcf: '',
      capitalGainsTaxDcf: '',
      grossSaleProceedsDcf: '',
      saleCostsDcf: '',
      loanPayoffAtSale: '',
      recaptureTaxDcf: '',
      saleProceedsDcf: '',
      waterfallSponsor: '',
      waterfallInvestor: '',
    }
  }),
  scenarioName: 'Base',
  scenarios: {
    base: { label: 'Base', rentGrowthDelta: 0, expenseGrowthDelta: 0, exitCapRateDelta: 0, vacancyDelta: 0 },
    upside: { label: 'Upside', rentGrowthDelta: 1, expenseGrowthDelta: -0.5, exitCapRateDelta: -0.25, vacancyDelta: -1 },
    downside: { label: 'Downside', rentGrowthDelta: -1, expenseGrowthDelta: 1, exitCapRateDelta: 0.5, vacancyDelta: 1 }
  },
  debtTerms: {
    initialLoanTermYears: '',
    refinanceLoanTermYears: '',
    refinanceCostPct: '1',
    floatingRate: false,
    sofrRatePct: '0',
    indexSpreadPct: '0',
    rateCapPct: '',
    rateFloorPct: '',
    interestReserveMonths: '0'
  },
  waterfall: {
    prefRate: '8',
    catchUpRate: '100',
    promoteRate: '20',
    lpSharePct: '95',
    gpSharePct: '5'
  },
  timing: {
    granularity: 'monthly',
    viewMode: 'yearly'
  },
  taxModel: {
    capitalGainsRatePct: '20',
    ordinaryIncomeTaxRatePct: '',
    passiveLossLimitPct: '100',
    initialTaxBasis: '',
    assessedValue: '',
    appraisedValue: '',
    landAssessment: '',
    improvementAssessment: '',
    personalPropertyAssessment: '',
    suspendedLossCarryforward: '0',
    entityType: 'Direct',
    enable1031: false,
    installmentSalePct: '0'
  },
  governance: {
    inputsLocked: false,
    formulasLocked: true,
    overridesEnabled: true,
    overrideNote: '',
    diagnosticLevel: 'strict'
  },
  leaseEconomics: {
    freeRentMonths: '0',
    marketRentGrowthPct: '',
    downtimeMonthsDefault: '0',
    expenseRecoveryPct: '0',
    newLeaseSpreadPct: '0',
    renewalSpreadPct: '-5',
    tenantImprovementPerSf: '0',
    leasingCommissionPct: '0',
    expenseStopPerSf: '0',
    grossUpPct: '95',
    percentageRentBreakpointType: 'natural',
    camAdminFeePct: '0',
    controllableExpensePct: '60',
    controllableCapPct: '5',
    nonRecoverableExpensePct: '0',
    taxPoolRecoverablePct: '100',
    insurancePoolRecoverablePct: '100',
    camPoolRecoverablePct: '100',
    grossUpMethod: 'category',
    reconciliationMonth: '12',
    occupiedSqft: '',
    vacantSqft: '',
    parkingIncome: '',
    laundryIncome: '',
    storageIncome: '',
    otherIncomeMisc: '',
    personalPropertyTaxes: '',
    payroll: '',
    payrollBenefits: '',
    workersComp: '',
    repairsMaintenance: '',
    janitorial: '',
    utilitiesFuel: '',
    utilitiesWaterSewer: '',
    utilitiesElectric: '',
    utilitiesPhoneInternet: '',
    accountingLegal: '',
    advertisingLicensesPermits: '',
    supplies: '',
    contractLawnSnow: '',
    contractRefuse: '',
    contractPest: '',
    contractSweeping: '',
    contractSecurity: '',
    associationDues: '',
    miscellaneousExpense: ''
  },
  lenderConstraints: {
    minDscr: '1.25',
    minDebtYield: '8.00',
    maxLtv: '75.00'
  },
  rentRoll: [
    { tenantName: '', suite: '', annualRent: '', monthlyRent: '', annualRecoveries: '', monthlyRecoveries: '', grossAnnualRent: '', grossMonthlyRent: '', securityDeposit: '', annualSales: '', leasedSf: '', annualRentPsf: '', recoveryPsf: '', leaseType: 'NNN', reimbursementsPct: '0', freeRentMonths: '0', leaseStartYear: '1', leaseStartMonth: '1', leaseEndYear: '10', leaseEndMonth: '12', rentBumpsPct: '', renewalProbabilityPct: '50', downtimeMonths: '0', marketRentPsf: '', newLeaseSpreadPct: '', renewalSpreadPct: '', tenantImprovementPerSf: '', leasingCommissionPct: '', expenseStopPerSf: '', grossUpPct: '', breakpointSales: '', percentageRentPct: '', anchorTenant: false, coTenancyGroup: '', extensionOptionMonths: '0', expansionSf: '0', contractionSf: '0', terminationMonth: '', purchaseOptionPrice: '', renewalTiPerSf: '', newLeaseTiPerSf: '', renewalLcPct: '', newLeaseLcPct: '', camPoolSharePct: '100', adminFeePct: '', controllableCapPct: '', nonRecoverableExpensePct: '' }
  ]
})
function toTextNumber(value) {
  return value === null || value === undefined ? '' : String(value)
}
function normalizeYearDraft(year = {}, yearNumber) {
  return {
    year: yearNumber,
    grossRevenue: toTextNumber(year.grossRevenue),
    vacancyCreditLoss: toTextNumber(year.vacancyCreditLoss),
    percentageRentDcf: toTextNumber(year.percentageRentDcf),
    otherIncomeDcf: toTextNumber(year.otherIncomeDcf),
    operatingExpensesDcf: toTextNumber(year.operatingExpensesDcf),
    managementFeesDcf: toTextNumber(year.managementFeesDcf),
    propertyTaxesDcf: toTextNumber(year.propertyTaxesDcf),
    insuranceDcf: toTextNumber(year.insuranceDcf),
    reservesCapexDcf: toTextNumber(year.reservesCapexDcf),
    tenantImprovements: toTextNumber(year.tenantImprovements),
    leasingCommissions: toTextNumber(year.leasingCommissions),
    capitalExpenditures: toTextNumber(year.capitalExpenditures),
    debtServiceDcf: toTextNumber(year.debtServiceDcf),
    loanBalanceDcf: toTextNumber(year.loanBalanceDcf),
    refinanceProceeds: toTextNumber(year.refinanceProceeds),
    refinanceCostsDcf: toTextNumber(year.refinanceCostsDcf),
    loanPayoffAtRefi: toTextNumber(year.loanPayoffAtRefi),
    taxesDcf: toTextNumber(year.taxesDcf),
    capitalGainsTaxDcf: toTextNumber(year.capitalGainsTaxDcf),
    grossSaleProceedsDcf: toTextNumber(year.grossSaleProceedsDcf),
    saleCostsDcf: toTextNumber(year.saleCostsDcf),
    loanPayoffAtSale: toTextNumber(year.loanPayoffAtSale),
    recaptureTaxDcf: toTextNumber(year.recaptureTaxDcf),
    saleProceedsDcf: toTextNumber(year.saleProceedsDcf),
    waterfallSponsor: toTextNumber(year.waterfallSponsor),
    waterfallInvestor: toTextNumber(year.waterfallInvestor),
  }
}
function normalizeRentRollRow(row = {}) {
  return {
    tenantName: row.tenantName || '',
    suite: row.suite || '',
    annualRent: toTextNumber(row.annualRent),
    monthlyRent: toTextNumber(row.monthlyRent),
    annualRecoveries: toTextNumber(row.annualRecoveries),
    monthlyRecoveries: toTextNumber(row.monthlyRecoveries),
    grossAnnualRent: toTextNumber(row.grossAnnualRent),
    grossMonthlyRent: toTextNumber(row.grossMonthlyRent),
    securityDeposit: toTextNumber(row.securityDeposit),
    annualSales: toTextNumber(row.annualSales),
    leasedSf: toTextNumber(row.leasedSf),
    annualRentPsf: toTextNumber(row.annualRentPsf),
    recoveryPsf: toTextNumber(row.recoveryPsf),
    leaseType: row.leaseType || 'NNN',
    reimbursementsPct: toTextNumber(row.reimbursementsPct || 0),
    freeRentMonths: toTextNumber(row.freeRentMonths || 0),
    leaseStartYear: toTextNumber(row.leaseStartYear || 1),
    leaseStartMonth: toTextNumber(row.leaseStartMonth || 1),
    leaseEndYear: toTextNumber(row.leaseEndYear || DCF_MAX_YEARS),
    leaseEndMonth: toTextNumber(row.leaseEndMonth || 12),
    rentBumpsPct: toTextNumber(row.rentBumpsPct),
    renewalProbabilityPct: toTextNumber(row.renewalProbabilityPct || 50),
    downtimeMonths: toTextNumber(row.downtimeMonths || 0),
    marketRentPsf: toTextNumber(row.marketRentPsf),
    newLeaseSpreadPct: toTextNumber(row.newLeaseSpreadPct),
    renewalSpreadPct: toTextNumber(row.renewalSpreadPct),
    tenantImprovementPerSf: toTextNumber(row.tenantImprovementPerSf),
    leasingCommissionPct: toTextNumber(row.leasingCommissionPct),
    expenseStopPerSf: toTextNumber(row.expenseStopPerSf),
    grossUpPct: toTextNumber(row.grossUpPct),
    breakpointSales: toTextNumber(row.breakpointSales),
    percentageRentPct: toTextNumber(row.percentageRentPct),
    anchorTenant: !!row.anchorTenant,
    coTenancyGroup: row.coTenancyGroup || '',
    extensionOptionMonths: toTextNumber(row.extensionOptionMonths || 0),
    expansionSf: toTextNumber(row.expansionSf || 0),
    contractionSf: toTextNumber(row.contractionSf || 0),
    terminationMonth: toTextNumber(row.terminationMonth),
    purchaseOptionPrice: toTextNumber(row.purchaseOptionPrice),
    renewalTiPerSf: toTextNumber(row.renewalTiPerSf),
    newLeaseTiPerSf: toTextNumber(row.newLeaseTiPerSf),
    renewalLcPct: toTextNumber(row.renewalLcPct),
    newLeaseLcPct: toTextNumber(row.newLeaseLcPct),
    camPoolSharePct: toTextNumber(row.camPoolSharePct || 100),
    adminFeePct: toTextNumber(row.adminFeePct),
    controllableCapPct: toTextNumber(row.controllableCapPct),
    nonRecoverableExpensePct: toTextNumber(row.nonRecoverableExpensePct)
  }
}
function parseNum(value) {
  if (value === '' || value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}
function calculateIrr(cashFlows) {
  if (!Array.isArray(cashFlows) || cashFlows.length < 2 || cashFlows.some(value => !Number.isFinite(value))) return null
  const hasPositive = cashFlows.some(value => value > 0)
  const hasNegative = cashFlows.some(value => value < 0)
  if (!hasPositive || !hasNegative) return null
  let rate = 0.1
  for (let iteration = 0; iteration < 100; iteration += 1) {
    let npv = 0
    let derivative = 0
    for (let year = 0; year < cashFlows.length; year += 1) {
      const denom = Math.pow(1 + rate, year)
      npv += cashFlows[year] / denom
      if (year > 0) derivative -= year * cashFlows[year] / Math.pow(1 + rate, year + 1)
    }
    if (Math.abs(npv) < 0.0001) return rate
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 0.0000001) break
    const nextRate = rate - (npv / derivative)
    if (!Number.isFinite(nextRate) || nextRate <= -0.9999 || nextRate > 1000) break
    if (Math.abs(nextRate - rate) < 0.0000001) return nextRate
    rate = nextRate
  }

  let low = -0.9999
  let high = 10
  const npvAt = (discountRate) => cashFlows.reduce((sum, value, year) => sum + (value / Math.pow(1 + discountRate, year)), 0)
  let lowNpv = npvAt(low)
  let highNpv = npvAt(high)
  if (!Number.isFinite(lowNpv) || !Number.isFinite(highNpv) || lowNpv * highNpv > 0) return null
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const mid = (low + high) / 2
    const midNpv = npvAt(mid)
    if (!Number.isFinite(midNpv)) return null
    if (Math.abs(midNpv) < 0.0001) return mid
    if (lowNpv * midNpv <= 0) {
      high = mid
      highNpv = midNpv
    } else {
      low = mid
      lowNpv = midNpv
    }
  }
  return (low + high) / 2
}
function paymentForLoan(principal, annualRate, amortYears) {
  if (!principal || principal <= 0) return 0
  const rate = annualRate / 100 / 12
  const months = amortYears * 12
  if (!months) return 0
  if (rate === 0) return principal / months
  return principal * rate / (1 - Math.pow(1 + rate, -months))
}
function endingLoanBalance(principal, annualRate, amortYears, monthsElapsed) {
  if (!principal || principal <= 0) return 0
  const months = Math.max(0, Math.round(monthsElapsed))
  const totalMonths = amortYears * 12
  if (!totalMonths) return 0
  const rate = annualRate / 100 / 12
  if (rate === 0) return Math.max(0, principal - (principal / totalMonths) * months)
  if (months <= 0) return principal
  return Math.max(0, principal * (Math.pow(1 + rate, totalMonths) - Math.pow(1 + rate, months)) / (Math.pow(1 + rate, totalMonths) - 1))
}
function annualToMonthlyGrowth(rate) {
  return Math.pow(1 + rate, 1 / 12) - 1
}
function clampMonth(value, fallback) {
  const month = Number(value || fallback)
  return Math.min(12, Math.max(1, Number.isFinite(month) ? month : fallback))
}
function toMonthIndex(yearValue, monthValue) {
  const year = Math.max(1, Number(yearValue || 1))
  const month = clampMonth(monthValue, 1)
  return ((year - 1) * 12) + (month - 1)
}
function buildDefaultDcfModelFromProperty(prop = {}) {
  const model = defaultDcfModel()
  const source = prop.dcf_model && typeof prop.dcf_model === 'object' && !Array.isArray(prop.dcf_model) ? prop.dcf_model : {}
  const selectedScenarioKey = ['base', 'upside', 'downside'].includes(source.scenarioName?.toLowerCase()) ? source.scenarioName.toLowerCase() : 'base'
  const scenario = source.scenarios && source.scenarios[selectedScenarioKey] ? source.scenarios[selectedScenarioKey] : null
  const hold = Math.min(DCF_MAX_YEARS, Math.max(1, Math.floor(Number(prop.hold_period || 1))))
  const annualOverride = (key, yearIndex, fallback) => {
    const value = source.annualOverrides?.[yearIndex]?.[key]
    return value === '' || value === null || value === undefined ? fallback : Number(value) / 12
  }
  const rentGrowthPct = (Number(prop.rent_growth || 0) + Number(scenario?.rentGrowthDelta || 0)) / 100
  const expenseGrowthPct = (Number(prop.expense_growth || 0) + Number(scenario?.expenseGrowthDelta || 0)) / 100
  const grossRentBase = Number(prop.gross_scheduled_rent || 0)
  const vacancyPct = Math.max(0, (Number(prop.vacancy_rate || 0) + Number(scenario?.vacancyDelta || 0))) / 100
  const otherIncomeBase = Number(prop.other_income || 0)
  const operatingExpensesBase = Number(prop.operating_expenses || 0)
  const reservesBase = Number(prop.reserves_capex || 0)
  const propertyTaxesBase = Number(prop.property_taxes || 0)
  const insuranceBase = Number(prop.insurance || 0)
  const managementFeePct = Number(prop.management_fee_pct || 0) / 100
  const capitalGainsRatePct = Number(source.taxModel?.capitalGainsRatePct || 20) / 100
  const ordinaryIncomeTaxRatePct = Number(source.taxModel?.ordinaryIncomeTaxRatePct || prop.effective_tax_rate || 0) / 100
  const passiveLossLimitPct = Math.max(0, Math.min(100, Number(source.taxModel?.passiveLossLimitPct || 100))) / 100
  const initialTaxBasis = Number(source.taxModel?.initialTaxBasis || prop.price || 0)
  const startingSuspendedLossCarryforward = Math.max(0, Number(source.taxModel?.suspendedLossCarryforward || 0))
  const installmentSalePct = Math.max(0, Math.min(100, Number(source.taxModel?.installmentSalePct || 0))) / 100
  const enable1031 = !!source.taxModel?.enable1031
  const loanAmt = Number(prop.loan_amount || 0)
  const interestRatePct = Number(prop.interest_rate || 0)
  const amortYears = Number(prop.amortization_term || 0)
  const ioYears = Math.max(0, Number(prop.interest_only_period || 0))
  const exitCapPct = (Number(prop.exit_cap_rate || 0) + Number(scenario?.exitCapRateDelta || 0)) / 100
  const costOfSalePct = Number(prop.cost_of_sale || 0) / 100
  const refiYearValue = Number(prop.refi_year || 0)
  const refiMonthValue = clampMonth(source.timing?.refiMonth || 1, 1)
  const refiLtvPct = Number(prop.refi_ltv || 0) / 100
  const refiRatePct = Number(prop.refi_rate || 0)
  const recaptureRatePct = Number(prop.depreciation_recapture_rate || 0) / 100
  const rentToSalesPct = Number(prop.rent_to_sales_ratio || 0) / 100
  const tenantSalesBase = Number(prop.tenant_gross_sales || 0)
  const tenantBaseRentBase = Number(prop.tenant_base_rent || 0)
  const depBasis = Number(prop.price || 0) * (1 - Number(prop.land_value_pct || 0) / 100)
  const rentRoll = Array.isArray(source.rentRoll) ? source.rentRoll.filter(row => Number(row.annualRent || 0) > 0 || Number(row.leasedSf || 0) > 0) : []
  const initialLoanTermYears = Number(source.debtTerms?.initialLoanTermYears || hold)
  const refinanceLoanTermYears = Number(source.debtTerms?.refinanceLoanTermYears || initialLoanTermYears || hold)
  const refinanceCostPct = Number(source.debtTerms?.refinanceCostPct || 1) / 100
  const floatingRate = !!source.debtTerms?.floatingRate
  const sofrRatePct = Number(source.debtTerms?.sofrRatePct || 0)
  const indexSpreadPct = Number(source.debtTerms?.indexSpreadPct || 0)
  const rateCapPct = source.debtTerms?.rateCapPct !== '' && source.debtTerms?.rateCapPct !== null && source.debtTerms?.rateCapPct !== undefined
    ? Number(source.debtTerms.rateCapPct)
    : null
  const rateFloorPct = source.debtTerms?.rateFloorPct !== '' && source.debtTerms?.rateFloorPct !== null && source.debtTerms?.rateFloorPct !== undefined
    ? Number(source.debtTerms.rateFloorPct)
    : null
  const interestReserveMonths = Math.max(0, Number(source.debtTerms?.interestReserveMonths || 0))
  const freeRentMonthsDefault = Math.max(0, Number(source.leaseEconomics?.freeRentMonths || 0))
  const marketRentGrowthPct = Number(source.leaseEconomics?.marketRentGrowthPct || prop.rent_growth || 0) / 100
  const monthlyRentGrowthPct = annualToMonthlyGrowth(rentGrowthPct)
  const monthlyExpenseGrowthPct = annualToMonthlyGrowth(expenseGrowthPct)
  const monthlyMarketRentGrowthPct = annualToMonthlyGrowth(marketRentGrowthPct)
  const downtimeMonthsDefault = Math.max(0, Number(source.leaseEconomics?.downtimeMonthsDefault || 0))
  const expenseRecoveryPct = Math.max(0, Number(source.leaseEconomics?.expenseRecoveryPct || 0)) / 100
  const breakpointType = source.leaseEconomics?.percentageRentBreakpointType || 'natural'
  const camAdminFeePct = Math.max(0, Number(source.leaseEconomics?.camAdminFeePct || 0)) / 100
  const controllableExpensePct = Math.max(0, Number(source.leaseEconomics?.controllableExpensePct || 60)) / 100
  const controllableCapPct = Math.max(0, Number(source.leaseEconomics?.controllableCapPct || 5)) / 100
  const nonRecoverableExpensePct = Math.max(0, Number(source.leaseEconomics?.nonRecoverableExpensePct || 0)) / 100
  const taxPoolRecoverablePct = Math.max(0, Number(source.leaseEconomics?.taxPoolRecoverablePct || 100)) / 100
  const insurancePoolRecoverablePct = Math.max(0, Number(source.leaseEconomics?.insurancePoolRecoverablePct || 100)) / 100
  const camPoolRecoverablePct = Math.max(0, Number(source.leaseEconomics?.camPoolRecoverablePct || 100)) / 100
  const grossUpMethod = source.leaseEconomics?.grossUpMethod || 'category'
  const minDscr = Number(source.lenderConstraints?.minDscr || 0)
  const minDebtYield = Number(source.lenderConstraints?.minDebtYield || 0) / 100
  const maxLtvConstraint = Number(source.lenderConstraints?.maxLtv || 0) / 100
  const prefRate = Number(source.waterfall?.prefRate || 0) / 100
  const catchUpRate = Number(source.waterfall?.catchUpRate || 0) / 100
  const promoteRate = Number(source.waterfall?.promoteRate || 0) / 100
  const lpSharePct = Math.max(0, Number(source.waterfall?.lpSharePct || 95)) / 100
  let unpaidPrefBalance = 0
  let lpUnreturnedCapital = Math.max(0, ((Number(prop.price || 0) + Number(prop.closing_costs || 0) - loanAmt) || 0) * lpSharePct)
  let currentLoanPrincipal = loanAmt
  let currentLoanRate = interestRatePct
  let currentLoanAmortYears = amortYears
  let currentLoanStartMonth = 0
  let currentLoanTermYears = initialLoanTermYears
  let interestReserveBalance = loanAmt > 0 && interestReserveMonths > 0
    ? paymentForLoan(loanAmt, floatingRate ? (sofrRatePct + indexSpreadPct) : interestRatePct, amortYears || initialLoanTermYears || hold) * interestReserveMonths
    : 0
  let suspendedLossCarryforward = startingSuspendedLossCarryforward
  let accumulatedDepreciation = 0
  const saleMonthValue = clampMonth(source.timing?.saleMonth || 12, 12)
  const totalMonths = (hold - 1) * 12 + saleMonthValue
  const refiMonthIndex = refiYearValue > 0 ? toMonthIndex(refiYearValue, refiMonthValue) : -1
  const saleMonthIndex = totalMonths - 1
  const yearlyBuckets = Array.from({ length: DCF_MAX_YEARS }, (_, index) => ({
    year: index + 1,
    grossRevenue: 0,
    vacancyCreditLoss: 0,
    percentageRentDcf: 0,
    otherIncomeDcf: 0,
    operatingExpensesDcf: 0,
    managementFeesDcf: 0,
    propertyTaxesDcf: 0,
    insuranceDcf: 0,
    reservesCapexDcf: 0,
    tenantImprovements: 0,
    leasingCommissions: 0,
    capitalExpenditures: 0,
    debtServiceDcf: 0,
    loanBalanceDcf: 0,
    refinanceProceeds: 0,
    refinanceCostsDcf: 0,
    loanPayoffAtRefi: 0,
    interestReserveDraw: 0,
    taxesDcf: 0,
    grossSaleProceedsDcf: 0,
    saleCostsDcf: 0,
    loanPayoffAtSale: 0,
    recaptureTaxDcf: 0,
    capitalGainsTaxDcf: 0,
    saleProceedsDcf: 0,
    waterfallSponsor: 0,
    waterfallInvestor: 0,
  }))
  const monthlyRows = []

  const monthlyOperatingExpenseBase = operatingExpensesBase / 12
  let priorControllableMonthly = monthlyOperatingExpenseBase * controllableExpensePct
  const monthlyOtherIncomeBase = otherIncomeBase / 12
  const monthlyPropertyTaxesBase = propertyTaxesBase / 12
  const monthlyInsuranceBase = insuranceBase / 12
  const monthlyReservesBase = reservesBase / 12
  const monthlyTenantSalesBase = tenantSalesBase / 12
  const monthlyTenantBaseRentBase = tenantBaseRentBase / 12

  for (let monthIndex = 0; monthIndex < totalMonths; monthIndex += 1) {
    const yearIndex = Math.floor(monthIndex / 12)
    const monthNumber = (monthIndex % 12) + 1
    const rentGrowthFactor = Math.pow(1 + monthlyRentGrowthPct, monthIndex)
    const expenseGrowthFactor = Math.pow(1 + monthlyExpenseGrowthPct, monthIndex)
    const rentRollRevenue = rentRoll.reduce((sum, tenant) => {
      const leaseStartIndex = toMonthIndex(tenant.leaseStartYear, tenant.leaseStartMonth)
      const leaseEndIndex = toMonthIndex(tenant.leaseEndYear, tenant.leaseEndMonth)
      const leasedSf = Number(tenant.leasedSf || 0)
      const annualRentPsf = Number(tenant.annualRentPsf || 0)
      const baseAnnualRent = Number(tenant.annualRent || 0) || (leasedSf > 0 && annualRentPsf > 0 ? leasedSf * annualRentPsf : 0)
      const baseMonthlyRent = baseAnnualRent / 12
      const renewalProb = Math.max(0, Math.min(100, Number(tenant.renewalProbabilityPct || 0))) / 100
      const downtimeMonths = Math.max(0, Number(tenant.downtimeMonths || downtimeMonthsDefault))
      const freeRentMonths = Math.max(0, Number(tenant.freeRentMonths || freeRentMonthsDefault))
      const rentBumpsPct = Number(tenant.rentBumpsPct || 0) / 100
      const monthlyRentBumpPct = annualToMonthlyGrowth(rentBumpsPct)
      const marketRentPsf = Number(tenant.marketRentPsf || 0)
      const renewalSpreadPct = Number(tenant.renewalSpreadPct || source.leaseEconomics?.renewalSpreadPct || 0) / 100
      const extensionOptionMonths = Math.max(0, Number(tenant.extensionOptionMonths || 0))
      const expansionSf = Math.max(0, Number(tenant.expansionSf || 0))
      const contractionSf = Math.max(0, Number(tenant.contractionSf || 0))
      const terminationMonth = tenant.terminationMonth !== '' && tenant.terminationMonth !== null && tenant.terminationMonth !== undefined
        ? Math.max(0, Number(tenant.terminationMonth))
        : null
      const purchaseOptionPrice = Math.max(0, Number(tenant.purchaseOptionPrice || 0))
      if (monthIndex < leaseStartIndex) return sum
      const monthsActive = Math.max(0, monthIndex - leaseStartIndex)
      const extensionEndIndex = leaseEndIndex + extensionOptionMonths
      const effectiveLeaseEndIndex = extensionOptionMonths > 0 ? extensionEndIndex : leaseEndIndex
      if (terminationMonth !== null && monthIndex >= terminationMonth) return sum
      const effectiveLeasedSf = Math.max(0, leasedSf + expansionSf - contractionSf)
      const baseMonthlyRentAdjusted = effectiveLeasedSf > 0 && annualRentPsf > 0 ? (effectiveLeasedSf * annualRentPsf) / 12 : baseMonthlyRent
      const inInitialTerm = monthIndex <= effectiveLeaseEndIndex
      const bumpedMonthlyRent = baseMonthlyRentAdjusted * Math.pow(1 + monthlyRentBumpPct, monthsActive)
      const recoveredMonthlyRent = bumpedMonthlyRent
      if (inInitialTerm) {
        const freeRentEnds = leaseStartIndex + freeRentMonths
        return sum + (monthIndex < freeRentEnds ? 0 : recoveredMonthlyRent)
      }
      const renewalStart = effectiveLeaseEndIndex + downtimeMonths + 1
      if (monthIndex < renewalStart) return sum
      const monthsSinceRenewal = Math.max(0, monthIndex - renewalStart)
      const marketAnnualRent = marketRentPsf > 0 && effectiveLeasedSf > 0
        ? marketRentPsf * effectiveLeasedSf
        : (baseAnnualRent + (purchaseOptionPrice > 0 ? 0 : 0)) * Math.pow(1 + monthlyMarketRentGrowthPct, monthIndex)
      const renewalAnnualRent = marketAnnualRent * (1 + renewalSpreadPct)
      const renewalMonthlyRent = (renewalAnnualRent / 12)
        * renewalProb
        * Math.pow(1 + monthlyRentBumpPct, monthsSinceRenewal)
      return sum + renewalMonthlyRent
    }, 0)
    const grossRevenue = annualOverride('grossRevenue', yearIndex, rentRoll.length ? rentRollRevenue : (grossRentBase / 12) * rentGrowthFactor)
    const vacancyLoss = annualOverride('vacancyCreditLoss', yearIndex, grossRevenue * vacancyPct)
    const tenantSalesMonth = rentRoll.reduce((sum, tenant) => {
      const leaseStartIndex = toMonthIndex(tenant.leaseStartYear, tenant.leaseStartMonth)
      if (monthIndex < leaseStartIndex) return sum
      return sum + ((Number(tenant.annualSales || 0) / 12) * Math.pow(1 + monthlyRentGrowthPct, Math.max(0, monthIndex - leaseStartIndex)))
    }, 0) || (monthlyTenantSalesBase * rentGrowthFactor)
    const baseRentMonth = rentRollRevenue > 0 ? grossRevenue : monthlyTenantBaseRentBase * rentGrowthFactor
    const percentageRent = annualOverride('percentageRentDcf', yearIndex, rentRoll.reduce((sum, tenant) => {
      if (monthIndex < toMonthIndex(tenant.leaseStartYear, tenant.leaseStartMonth) || monthIndex > toMonthIndex(tenant.leaseEndYear, tenant.leaseEndMonth)) return sum
      const tenantSales = Number(tenant.annualSales || 0) / 12
      if (tenantSales <= 0) return sum
      const tenantPctRent = Number(tenant.percentageRentPct || 0) / 100 || rentToSalesPct
      if (tenantPctRent <= 0) return sum
      const tenantBaseMonthlyRent = (Number(tenant.annualRent || 0) || ((Number(tenant.marketRentPsf || 0) || Number(tenant.annualRentPsf || 0)) * Number(tenant.leasedSf || 0))) / 12
      const naturalBreakpoint = tenantPctRent > 0 ? tenantBaseMonthlyRent / tenantPctRent : 0
      const statedBreakpoint = Number(tenant.breakpointSales || 0) / 12
      const breakpointSales = breakpointType === 'stated' && statedBreakpoint > 0 ? statedBreakpoint : naturalBreakpoint
      return sum + Math.max(0, (tenantSales * Math.pow(1 + monthlyRentGrowthPct, monthIndex)) - breakpointSales) * tenantPctRent
    }, 0) || (rentRoll.length ? 0 : Math.max(0, tenantSalesMonth * rentToSalesPct - baseRentMonth)))
    const otherIncome = monthlyOtherIncomeBase * rentGrowthFactor
    const operatingExpensesMonth = monthlyOperatingExpenseBase * expenseGrowthFactor
    const controllableExpenseRaw = operatingExpensesMonth * controllableExpensePct
    const controllableExpenseCapped = monthIndex === 0
      ? controllableExpenseRaw
      : Math.min(controllableExpenseRaw, priorControllableMonthly * (1 + controllableCapPct / 12))
    priorControllableMonthly = controllableExpenseCapped
    const nonControllableExpense = operatingExpensesMonth - controllableExpenseRaw
    const excludedExpenseAmount = operatingExpensesMonth * nonRecoverableExpensePct
    const camPoolNet = Math.max(0, controllableExpenseCapped + nonControllableExpense - excludedExpenseAmount)
    const camAdminFee = camPoolNet * camAdminFeePct
    const totalCamPool = camPoolNet + camAdminFee
    const recoveries = rentRoll.reduce((sum, tenant) => {
      const start = toMonthIndex(tenant.leaseStartYear, tenant.leaseStartMonth)
      const end = toMonthIndex(tenant.leaseEndYear, tenant.leaseEndMonth) + Number(tenant.extensionOptionMonths || 0)
      const downtime = Number(tenant.downtimeMonths || downtimeMonthsDefault)
      if (monthIndex < start || (monthIndex > end && monthIndex <= end + downtime)) return sum
      if (tenant.terminationMonth !== '' && tenant.terminationMonth !== undefined && tenant.terminationMonth !== null && monthIndex >= Number(tenant.terminationMonth)) return sum
      const occupancyWeight = monthIndex > end ? Number(tenant.renewalProbabilityPct || 0) / 100 : 1
      const leasedSf = Number(tenant.leasedSf || 0)
      const reimbursementsPct = Math.max(0, Number(tenant.reimbursementsPct || 0)) / 100
      const expenseStopPerSf = Number(tenant.expenseStopPerSf || source.leaseEconomics?.expenseStopPerSf || 0)
      const grossUpPct = Math.max(0, Number(tenant.grossUpPct || source.leaseEconomics?.grossUpPct || 95)) / 100
      const leaseType = tenant.leaseType || 'NNN'
      const tenantCamPoolSharePct = Math.max(0, Number(tenant.camPoolSharePct || 100)) / 100
      const tenantAdminFeePct = Math.max(0, Number(tenant.adminFeePct || source.leaseEconomics?.camAdminFeePct || 0)) / 100
      const tenantControllableCapPct = Math.max(0, Number(tenant.controllableCapPct || source.leaseEconomics?.controllableCapPct || 0)) / 100
      const tenantNonRecoverableExpensePct = Math.max(0, Number(tenant.nonRecoverableExpensePct || source.leaseEconomics?.nonRecoverableExpensePct || 0)) / 100
      const tenantGrossUpBase = grossUpMethod === 'category' ? Math.max(0.0001, grossUpPct) : Math.max(0.0001, 1 - vacancyPct)
      const tenantExcludedAmount = totalCamPool * tenantNonRecoverableExpensePct
      const tenantRecoverableCam = Math.max(0, (((totalCamPool / tenantGrossUpBase) * camPoolRecoverablePct) - tenantExcludedAmount) * tenantCamPoolSharePct)
      const tenantRecoverableTax = (monthlyPropertyTaxesBase * expenseGrowthFactor / tenantGrossUpBase) * taxPoolRecoverablePct * tenantCamPoolSharePct
      const tenantRecoverableInsurance = (monthlyInsuranceBase * expenseGrowthFactor / tenantGrossUpBase) * insurancePoolRecoverablePct * tenantCamPoolSharePct
      const recoverableExpenses = tenantRecoverableCam + tenantRecoverableTax + tenantRecoverableInsurance
      const controllableCapCredit = monthIndex > 0 ? (controllableExpenseRaw - controllableExpenseCapped) * tenantControllableCapPct : 0
      const adminFeeRecovery = tenantAdminFeePct > 0 ? camPoolNet * tenantAdminFeePct * tenantCamPoolSharePct : 0
      if (leaseType === 'NNN') return sum + occupancyWeight * ((recoverableExpenses + adminFeeRecovery - controllableCapCredit) * reimbursementsPct)
      if (leaseType === 'Base Year') return sum + occupancyWeight * Math.max(0, (recoverableExpenses + adminFeeRecovery - controllableCapCredit) - ((expenseStopPerSf * leasedSf) / 12)) * reimbursementsPct
      if (leaseType === 'Gross') return sum
      return sum + ((operatingExpensesMonth * expenseRecoveryPct * reimbursementsPct) + adminFeeRecovery - controllableCapCredit)
    }, 0) || (rentRoll.length ? 0 : operatingExpensesMonth * expenseRecoveryPct)
    // The forward model has no actual billed-versus-paid ledger to reconcile.
    const totalRecoveries = recoveries
    const leaseEconomicsOtherIncome = [
      source.leaseEconomics?.parkingIncome,
      source.leaseEconomics?.laundryIncome,
      source.leaseEconomics?.storageIncome,
      source.leaseEconomics?.otherIncomeMisc,
    ].reduce((sum, value) => sum + (Number(value || 0) / 12), 0) * expenseGrowthFactor
    const leaseEconomicsExpenseAdders = [
      source.leaseEconomics?.personalPropertyTaxes,
      source.leaseEconomics?.payroll,
      source.leaseEconomics?.payrollBenefits,
      source.leaseEconomics?.workersComp,
      source.leaseEconomics?.repairsMaintenance,
      source.leaseEconomics?.janitorial,
      source.leaseEconomics?.utilitiesFuel,
      source.leaseEconomics?.utilitiesWaterSewer,
      source.leaseEconomics?.utilitiesElectric,
      source.leaseEconomics?.utilitiesPhoneInternet,
      source.leaseEconomics?.accountingLegal,
      source.leaseEconomics?.advertisingLicensesPermits,
      source.leaseEconomics?.supplies,
      source.leaseEconomics?.contractLawnSnow,
      source.leaseEconomics?.contractRefuse,
      source.leaseEconomics?.contractPest,
      source.leaseEconomics?.contractSweeping,
      source.leaseEconomics?.contractSecurity,
      source.leaseEconomics?.associationDues,
      source.leaseEconomics?.miscellaneousExpense,
    ].reduce((sum, value) => sum + (Number(value || 0) / 12), 0) * expenseGrowthFactor
    const otherIncomeWithRecoveries = annualOverride('otherIncomeDcf', yearIndex, otherIncome + totalRecoveries + leaseEconomicsOtherIncome)
    const effectiveGrossIncomeWithRollups = grossRevenue - vacancyLoss + percentageRent + otherIncomeWithRecoveries
    const managementFees = annualOverride('managementFeesDcf', yearIndex, effectiveGrossIncomeWithRollups * managementFeePct)
    const propertyTaxesMonth = annualOverride('propertyTaxesDcf', yearIndex, monthlyPropertyTaxesBase * expenseGrowthFactor)
    const insuranceMonth = annualOverride('insuranceDcf', yearIndex, monthlyInsuranceBase * expenseGrowthFactor)
    const reservesMonth = annualOverride('reservesCapexDcf', yearIndex, monthlyReservesBase * expenseGrowthFactor)
    const operatingExpensesMonthWithRollups = annualOverride('operatingExpensesDcf', yearIndex, operatingExpensesMonth + leaseEconomicsExpenseAdders)
    const noi = effectiveGrossIncomeWithRollups - operatingExpensesMonthWithRollups - managementFees - propertyTaxesMonth - insuranceMonth - reservesMonth
    const tenantImprovementsMonth = annualOverride('tenantImprovements', yearIndex, rentRoll.reduce((sum, tenant) => {
      const leaseEndIndex = toMonthIndex(tenant.leaseEndYear, tenant.leaseEndMonth)
      const extensionOptionMonths = Math.max(0, Number(tenant.extensionOptionMonths || 0))
      const downtimeMonths = Math.max(0, Number(tenant.downtimeMonths || downtimeMonthsDefault))
      const renewalStart = leaseEndIndex + extensionOptionMonths + downtimeMonths + 1
      if (monthIndex !== renewalStart) return sum
      const leasedSf = Number(tenant.leasedSf || 0)
      const tiPerSf = Math.max(0, Number(tenant.renewalTiPerSf || tenant.tenantImprovementPerSf || source.leaseEconomics?.tenantImprovementPerSf || 0))
      return sum + (leasedSf * tiPerSf)
    }, 0))
    const leasingCommissionsMonth = annualOverride('leasingCommissions', yearIndex, rentRoll.reduce((sum, tenant) => {
      const leaseEndIndex = toMonthIndex(tenant.leaseEndYear, tenant.leaseEndMonth)
      const extensionOptionMonths = Math.max(0, Number(tenant.extensionOptionMonths || 0))
      const downtimeMonths = Math.max(0, Number(tenant.downtimeMonths || downtimeMonthsDefault))
      const renewalStart = leaseEndIndex + extensionOptionMonths + downtimeMonths + 1
      if (monthIndex !== renewalStart) return sum
      const leasedSf = Number(tenant.leasedSf || 0)
      const marketRentPsf = Number(tenant.marketRentPsf || 0) || Number(tenant.annualRentPsf || 0)
      const marketAnnualRent = marketRentPsf > 0 ? marketRentPsf * leasedSf : Number(tenant.annualRent || 0)
      const renewalSpreadPct = Number(tenant.renewalSpreadPct || source.leaseEconomics?.renewalSpreadPct || 0) / 100
      const lcPct = Math.max(0, Number(tenant.renewalLcPct || tenant.leasingCommissionPct || source.leaseEconomics?.leasingCommissionPct || 0)) / 100
      return sum + (marketAnnualRent * (1 + renewalSpreadPct) * lcPct)
    }, 0))
    const additionalCapex = annualOverride('capitalExpenditures', yearIndex, 0)
    const monthsSinceLoanStart = monthIndex + 1 - currentLoanStartMonth
    const loanIoMonths = currentLoanStartMonth === 0 ? ioYears * 12 : 0
    const inIoPeriod = monthsSinceLoanStart > 0 && monthsSinceLoanStart <= loanIoMonths && currentLoanPrincipal > 0
    const balloonMonth = currentLoanTermYears > 0 ? currentLoanTermYears * 12 : null
    const hitsBalloon = balloonMonth !== null && monthsSinceLoanStart >= balloonMonth && currentLoanPrincipal > 0
    const floatingAllInRate = floatingRate ? (sofrRatePct + indexSpreadPct) : currentLoanRate
    const boundedRate = Math.max(
      rateFloorPct !== null ? rateFloorPct : 0,
      Math.min(rateCapPct !== null ? rateCapPct : Infinity, floatingAllInRate)
    )
    const priorLoanBalance = currentLoanPrincipal > 0
      ? inIoPeriod ? currentLoanPrincipal : endingLoanBalance(currentLoanPrincipal, floatingRate ? boundedRate : currentLoanRate, currentLoanAmortYears, Math.max(0, monthsSinceLoanStart - loanIoMonths - 1))
      : 0
    const monthlyInterest = priorLoanBalance * (floatingRate ? boundedRate : currentLoanRate) / 100 / 12
    const monthlyDebtService = currentLoanPrincipal > 0
      ? inIoPeriod ? monthlyInterest
        : Math.min(priorLoanBalance + monthlyInterest, paymentForLoan(currentLoanPrincipal, floatingRate ? boundedRate : currentLoanRate, currentLoanAmortYears))
      : 0
    const reserveDraw = interestReserveBalance > 0 ? Math.min(interestReserveBalance, monthlyDebtService) : 0
    interestReserveBalance = Math.max(0, interestReserveBalance - reserveDraw)
    const annualDepreciation = depBasis > 0 ? (depBasis * (1 - Number(prop.cost_seg_bonus_pct || 0) / 100) / 39) : 0
    const monthlyDepreciation = annualDepreciation / 12
    const bonusDepreciation = monthIndex === 0 ? depBasis * (Number(prop.cost_seg_bonus_pct || 0) / 100) : 0
    const taxableIncome = noi + reservesMonth - monthlyInterest - monthlyDepreciation - bonusDepreciation
    const currentPeriodLoss = taxableIncome < 0 ? Math.abs(taxableIncome) : 0
    suspendedLossCarryforward += currentPeriodLoss
    const usableSuspendedLoss = taxableIncome > 0 ? Math.min(suspendedLossCarryforward, taxableIncome * passiveLossLimitPct) : 0
    const ordinaryTaxableIncome = Math.max(0, taxableIncome - usableSuspendedLoss)
    suspendedLossCarryforward = Math.max(0, suspendedLossCarryforward - usableSuspendedLoss)
    const taxesMonth = annualOverride('taxesDcf', yearIndex, ordinaryTaxableIncome * ordinaryIncomeTaxRatePct)
    accumulatedDepreciation += monthlyDepreciation + bonusDepreciation
    const loanBalance = currentLoanPrincipal > 0
      ? (inIoPeriod
        ? currentLoanPrincipal
        : endingLoanBalance(currentLoanPrincipal, floatingRate ? boundedRate : currentLoanRate, currentLoanAmortYears, Math.max(0, monthsSinceLoanStart - loanIoMonths)))
      : 0
    const annualizedNoi = noi * 12
    const stabilizedValue = exitCapPct > 0 ? Math.max(0, annualizedNoi) / exitCapPct : 0
    const dscrConstrainedLoan = minDscr > 0 && currentLoanRate > 0 && currentLoanAmortYears > 0
      ? paymentForLoan(1, currentLoanRate, currentLoanAmortYears) > 0
        ? (Math.max(0, annualizedNoi) / minDscr) / (paymentForLoan(1, currentLoanRate, currentLoanAmortYears) * 12)
        : 0
      : Infinity
    const debtYieldConstrainedLoan = minDebtYield > 0 ? Math.max(0, annualizedNoi) / minDebtYield : Infinity
    const ltvConstrainedLoan = maxLtvConstraint > 0 ? stabilizedValue * maxLtvConstraint : Infinity
    const maxDebtByConstraints = Math.min(
      Number.isFinite(dscrConstrainedLoan) ? dscrConstrainedLoan : Infinity,
      Number.isFinite(debtYieldConstrainedLoan) ? debtYieldConstrainedLoan : Infinity,
      Number.isFinite(ltvConstrainedLoan) ? ltvConstrainedLoan : Infinity
    )
    const refiGrossProceeds = monthIndex === refiMonthIndex && refiLtvPct > 0 ? stabilizedValue * refiLtvPct : 0
    const refinanceLoanAmount = refiGrossProceeds > 0 ? Math.min(refiGrossProceeds, maxDebtByConstraints) : 0
    const refinanceCosts = refinanceLoanAmount > 0 ? refinanceLoanAmount * refinanceCostPct : 0
    const isSaleMonth = monthIndex === saleMonthIndex
    const loanPayoffAtRefi = refiGrossProceeds > 0 || (hitsBalloon && !isSaleMonth) ? loanBalance : 0
    const refinanceProceeds = refinanceLoanAmount
    if (refiGrossProceeds > 0) {
      currentLoanPrincipal = refinanceLoanAmount
      currentLoanRate = refiRatePct > 0 ? refiRatePct : currentLoanRate
      currentLoanAmortYears = amortYears || currentLoanAmortYears
      currentLoanStartMonth = monthIndex + 1
      currentLoanTermYears = refinanceLoanTermYears || currentLoanTermYears
    } else if (hitsBalloon && !isSaleMonth) {
      currentLoanPrincipal = 0
    }
    const grossSaleProceeds = isSaleMonth ? stabilizedValue : 0
    const saleCosts = grossSaleProceeds > 0 ? grossSaleProceeds * costOfSalePct : 0
    const loanPayoffAtSale = isSaleMonth && exitCapPct > 0
      ? refiGrossProceeds > 0 ? currentLoanPrincipal : currentLoanPrincipal > 0 ? loanBalance : 0
      : 0
    const taxBasisAtSale = Math.max(0, initialTaxBasis - accumulatedDepreciation)
    const gainBeforeTaxes = Math.max(0, grossSaleProceeds - saleCosts - taxBasisAtSale)
    const recaptureAmount = Math.min(Math.max(0, accumulatedDepreciation), gainBeforeTaxes)
    const recaptureTax = grossSaleProceeds > 0 && !enable1031 ? recaptureAmount * recaptureRatePct : 0
    const capitalGainAmount = Math.max(0, grossSaleProceeds - saleCosts - taxBasisAtSale - recaptureAmount)
    const capitalGainsTax = grossSaleProceeds > 0 && !enable1031
      ? capitalGainAmount * capitalGainsRatePct * (1 - installmentSalePct)
      : 0
    const releasedSuspendedLoss = grossSaleProceeds > 0 ? suspendedLossCarryforward : 0
    const suspendedLossBenefit = releasedSuspendedLoss * ordinaryIncomeTaxRatePct
    suspendedLossCarryforward = grossSaleProceeds > 0 ? 0 : suspendedLossCarryforward
    const afterTaxSaleBridge = recaptureTax + capitalGainsTax - suspendedLossBenefit
    const saleProceeds = grossSaleProceeds - saleCosts - loanPayoffAtSale - afterTaxSaleBridge
    const cashAvailableForDistribution = Math.max(0, noi - tenantImprovementsMonth - leasingCommissionsMonth - additionalCapex - (monthlyDebtService - reserveDraw) - taxesMonth + refinanceProceeds - refinanceCosts - loanPayoffAtRefi + saleProceeds)
    const prefAccrual = lpUnreturnedCapital * (prefRate / 12)
    unpaidPrefBalance += prefAccrual
    let remainingCash = cashAvailableForDistribution
    const lpReturnOfCapital = Math.min(remainingCash, lpUnreturnedCapital)
    remainingCash -= lpReturnOfCapital
    lpUnreturnedCapital -= lpReturnOfCapital
    const lpPrefDistribution = Math.min(remainingCash, unpaidPrefBalance)
    remainingCash -= lpPrefDistribution
    unpaidPrefBalance -= lpPrefDistribution
    const gpCatchUp = Math.min(remainingCash, lpPrefDistribution > 0 ? lpPrefDistribution * catchUpRate * promoteRate : 0)
    remainingCash -= gpCatchUp
    const sponsorDistribution = gpCatchUp + (remainingCash * promoteRate)
    const investorDistribution = lpReturnOfCapital + lpPrefDistribution + (remainingCash * (1 - promoteRate))
    monthlyRows.push({
      month: monthIndex + 1,
      year: yearIndex + 1,
      monthInYear: monthNumber,
      grossRevenue: Math.round(grossRevenue),
      vacancyCreditLoss: Math.round(vacancyLoss),
      percentageRentDcf: Math.round(percentageRent),
      otherIncomeDcf: Math.round(otherIncomeWithRecoveries),
      operatingExpensesDcf: Math.round(operatingExpensesMonthWithRollups),
      managementFeesDcf: Math.round(managementFees),
      propertyTaxesDcf: Math.round(propertyTaxesMonth),
      insuranceDcf: Math.round(insuranceMonth),
      reservesCapexDcf: Math.round(reservesMonth),
      tenantImprovements: Math.round(tenantImprovementsMonth),
      leasingCommissions: Math.round(leasingCommissionsMonth),
      capitalExpenditures: Math.round(additionalCapex),
      debtServiceDcf: Math.round(monthlyDebtService),
      loanBalanceDcf: Math.round(loanBalance),
      refinanceProceeds: Math.round(refinanceProceeds),
      refinanceCostsDcf: Math.round(refinanceCosts),
      loanPayoffAtRefi: Math.round(loanPayoffAtRefi),
      interestReserveDraw: Math.round(reserveDraw),
      taxesDcf: Math.round(taxesMonth),
      capitalGainsTaxDcf: Math.round(capitalGainsTax),
      grossSaleProceedsDcf: Math.round(grossSaleProceeds),
      saleCostsDcf: Math.round(saleCosts),
      loanPayoffAtSale: Math.round(loanPayoffAtSale),
      recaptureTaxDcf: Math.round(recaptureTax),
      saleProceedsDcf: Math.round(saleProceeds),
      waterfallSponsor: Math.round(sponsorDistribution),
      waterfallInvestor: Math.round(investorDistribution),
    })

    yearlyBuckets[yearIndex].grossRevenue += grossRevenue
    yearlyBuckets[yearIndex].vacancyCreditLoss += vacancyLoss
    yearlyBuckets[yearIndex].percentageRentDcf += percentageRent
    yearlyBuckets[yearIndex].otherIncomeDcf += otherIncomeWithRecoveries
    yearlyBuckets[yearIndex].operatingExpensesDcf += operatingExpensesMonthWithRollups
    yearlyBuckets[yearIndex].managementFeesDcf += managementFees
    yearlyBuckets[yearIndex].propertyTaxesDcf += propertyTaxesMonth
    yearlyBuckets[yearIndex].insuranceDcf += insuranceMonth
    yearlyBuckets[yearIndex].reservesCapexDcf += reservesMonth
    yearlyBuckets[yearIndex].tenantImprovements += tenantImprovementsMonth
    yearlyBuckets[yearIndex].leasingCommissions += leasingCommissionsMonth
    yearlyBuckets[yearIndex].capitalExpenditures += additionalCapex
    yearlyBuckets[yearIndex].debtServiceDcf += monthlyDebtService
    yearlyBuckets[yearIndex].loanBalanceDcf = loanBalance
    yearlyBuckets[yearIndex].refinanceProceeds += refinanceProceeds
    yearlyBuckets[yearIndex].refinanceCostsDcf += refinanceCosts
    yearlyBuckets[yearIndex].loanPayoffAtRefi += loanPayoffAtRefi
    yearlyBuckets[yearIndex].interestReserveDraw += reserveDraw
    yearlyBuckets[yearIndex].taxesDcf += taxesMonth
    yearlyBuckets[yearIndex].grossSaleProceedsDcf += grossSaleProceeds
    yearlyBuckets[yearIndex].saleCostsDcf += saleCosts
    yearlyBuckets[yearIndex].loanPayoffAtSale += loanPayoffAtSale
    yearlyBuckets[yearIndex].recaptureTaxDcf += recaptureTax
    yearlyBuckets[yearIndex].capitalGainsTaxDcf += capitalGainsTax
    yearlyBuckets[yearIndex].saleProceedsDcf += saleProceeds
    yearlyBuckets[yearIndex].waterfallSponsor += sponsorDistribution
    yearlyBuckets[yearIndex].waterfallInvestor += investorDistribution
  }

  model.months = monthlyRows
  for (let index = 0; index < DCF_MAX_YEARS; index += 1) {
    const bucket = yearlyBuckets[index]
    model.years[index] = {
      ...normalizeYearDraft({
      year: index + 1,
      grossRevenue: Math.round(bucket.grossRevenue),
      vacancyCreditLoss: Math.round(bucket.vacancyCreditLoss),
      percentageRentDcf: Math.round(bucket.percentageRentDcf),
      otherIncomeDcf: Math.round(bucket.otherIncomeDcf),
      operatingExpensesDcf: Math.round(bucket.operatingExpensesDcf),
      managementFeesDcf: Math.round(bucket.managementFeesDcf),
      propertyTaxesDcf: Math.round(bucket.propertyTaxesDcf),
      insuranceDcf: Math.round(bucket.insuranceDcf),
      reservesCapexDcf: Math.round(bucket.reservesCapexDcf),
      tenantImprovements: Math.round(bucket.tenantImprovements),
      leasingCommissions: Math.round(bucket.leasingCommissions),
      capitalExpenditures: Math.round(bucket.capitalExpenditures),
      debtServiceDcf: Math.round(bucket.debtServiceDcf),
      loanBalanceDcf: Math.round(bucket.loanBalanceDcf),
      refinanceProceeds: Math.round(bucket.refinanceProceeds),
      refinanceCostsDcf: Math.round(bucket.refinanceCostsDcf),
      loanPayoffAtRefi: Math.round(bucket.loanPayoffAtRefi),
      taxesDcf: Math.round(bucket.taxesDcf),
      capitalGainsTaxDcf: Math.round(bucket.capitalGainsTaxDcf),
      grossSaleProceedsDcf: Math.round(bucket.grossSaleProceedsDcf),
      saleCostsDcf: Math.round(bucket.saleCostsDcf),
      loanPayoffAtSale: Math.round(bucket.loanPayoffAtSale),
      recaptureTaxDcf: Math.round(bucket.recaptureTaxDcf),
      saleProceedsDcf: Math.round(bucket.saleProceedsDcf),
      waterfallSponsor: Math.round(bucket.waterfallSponsor),
      waterfallInvestor: Math.round(bucket.waterfallInvestor),
      }, index + 1),
      interestReserveDraw: String(Math.round(bucket.interestReserveDraw)),
    }
  }
  return model
}
function getComputedDcfValue(yearRow, rowKey) {
  const grossRevenueVal = parseNum(yearRow.grossRevenue) || 0
  const vacancyLossVal = parseNum(yearRow.vacancyCreditLoss) || 0
  const percentageRentVal = parseNum(yearRow.percentageRentDcf) || 0
  const otherIncomeVal = parseNum(yearRow.otherIncomeDcf) || 0
  const operatingExpensesVal = parseNum(yearRow.operatingExpensesDcf) || 0
  const managementFeesVal = parseNum(yearRow.managementFeesDcf) || 0
  const propertyTaxesVal = parseNum(yearRow.propertyTaxesDcf) || 0
  const insuranceVal = parseNum(yearRow.insuranceDcf) || 0
  const reservesVal = parseNum(yearRow.reservesCapexDcf) || 0
  const tenantImprovementsVal = parseNum(yearRow.tenantImprovements) || 0
  const leasingCommissionsVal = parseNum(yearRow.leasingCommissions) || 0
  const capitalExpendituresVal = parseNum(yearRow.capitalExpenditures) || 0
  const debtServiceVal = parseNum(yearRow.debtServiceDcf) || 0
  const refinanceVal = parseNum(yearRow.refinanceProceeds) || 0
  const refinanceCostsVal = parseNum(yearRow.refinanceCostsDcf) || 0
  const taxesVal = parseNum(yearRow.taxesDcf) || 0
  const saleProceedsVal = parseNum(yearRow.saleProceedsDcf) || 0
  const reserveDraw = parseNum(yearRow.interestReserveDraw) || 0
  const refiPayoff = parseNum(yearRow.loanPayoffAtRefi) || 0
  const effectiveGrossIncome = grossRevenueVal - vacancyLossVal + percentageRentVal + otherIncomeVal
  const netOperatingIncome = effectiveGrossIncome - operatingExpensesVal - managementFeesVal - propertyTaxesVal - insuranceVal - reservesVal
  const belowTheLineCapital = tenantImprovementsVal + leasingCommissionsVal + capitalExpendituresVal
  const cashFlowBeforeSale = netOperatingIncome - belowTheLineCapital - debtServiceVal + reserveDraw + refinanceVal - refiPayoff - refinanceCostsVal - taxesVal
  const cashFlowAfterSale = cashFlowBeforeSale + saleProceedsVal
  if (rowKey === 'effectiveGrossIncome') return effectiveGrossIncome
  if (rowKey === 'netOperatingIncomeDcf') return netOperatingIncome
  if (rowKey === 'cashFlowBeforeSale') return cashFlowBeforeSale
  if (rowKey === 'cashFlowAfterSale') return cashFlowAfterSale
  return null
}

export { DCF_ROW_DEFS, DCF_GROUPS, DCF_MAX_YEARS, defaultDcfModel, normalizeYearDraft, normalizeRentRollRow, parseNum, calculateIrr, paymentForLoan, endingLoanBalance, buildDefaultDcfModelFromProperty, getComputedDcfValue };
