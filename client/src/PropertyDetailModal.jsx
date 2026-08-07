import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Field, NumericInput, SaveButton, Avatar, Modal, PropertyModalCarousel, PropertyMap, apiFetch, playSaveSound, FIELD_HELP } from './shared'

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
          {u.organization && <p className="text-xs text-base-content/50 truncate">{u.organization}</p>}
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
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content" onClick={() => setAssignSearch('')}>✕</button>
        )}
      </div>
      {allUsers.length === 0
        ? <p className="text-center text-base-content/30 py-8">No users found</p>
        : visibleUsers.length === 0
          ? <p className="text-center text-base-content/30 py-4">No users match &ldquo;{assignSearch}&rdquo;</p>
          : (
            <div>
              {assigned.length > 0 && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-content/40 pb-1 border-b border-base-200 mb-1">
                    Assigned ({assigned.length})
                  </p>
                  <div className="divide-y divide-base-200">
                    {assigned.map(u => <UserRow key={u.id} u={u} />)}
                  </div>
                </>
              )}
              {unassigned.length > 0 && (
                <>
                  <p className={`text-xs font-semibold uppercase tracking-wide text-base-content/40 pb-1 border-b border-base-200 mb-1 ${assigned.length > 0 ? 'mt-4' : ''}`}>
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
  const DCF_ROW_DEFS = [
    { key: 'grossRevenue', label: 'Gross Revenue', type: 'currency', category: 'income' },
    { key: 'vacancyCreditLoss', label: 'Vacancy / Credit Loss', type: 'currency', category: 'income' },
    { key: 'percentageRentDcf', label: 'Percentage Rent', type: 'currency', category: 'income' },
    { key: 'otherIncomeDcf', label: 'Other Income', type: 'currency', category: 'income' },
    { key: 'effectiveGrossIncome', label: 'Effective Gross Income', type: 'currency', category: 'formula', readOnly: true },
    { key: 'operatingExpensesDcf', label: 'Operating Expenses', type: 'currency', category: 'expense' },
    { key: 'managementFeesDcf', label: 'Management Fees', type: 'currency', category: 'expense' },
    { key: 'propertyTaxesDcf', label: 'Property Taxes', type: 'currency', category: 'expense' },
    { key: 'insuranceDcf', label: 'Insurance', type: 'currency', category: 'expense' },
    { key: 'reservesCapexDcf', label: 'Reserves / Replacement Reserve', type: 'currency', category: 'expense' },
    { key: 'netOperatingIncomeDcf', label: 'Net Operating Income', type: 'currency', category: 'formula', readOnly: true },
    { key: 'tenantImprovements', label: 'Tenant Improvements (TI)', type: 'currency', category: 'capital' },
    { key: 'leasingCommissions', label: 'Leasing Commissions (LC)', type: 'currency', category: 'capital' },
    { key: 'capitalExpenditures', label: 'Additional Capex', type: 'currency', category: 'capital' },
    { key: 'debtServiceDcf', label: 'Debt Service', type: 'currency', category: 'debt' },
    { key: 'loanBalanceDcf', label: 'Loan Balance', type: 'currency', category: 'debt', readOnly: true },
    { key: 'refinanceProceeds', label: 'Refinance Proceeds', type: 'currency', category: 'capital' },
    { key: 'refinanceCostsDcf', label: 'Refinance Costs', type: 'currency', category: 'capital' },
    { key: 'loanPayoffAtRefi', label: 'Loan Payoff at Refi', type: 'currency', category: 'capital', readOnly: true },
    { key: 'taxesDcf', label: 'Operating Tax', type: 'currency', category: 'tax' },
    { key: 'capitalGainsTaxDcf', label: 'Capital Gains Tax', type: 'currency', category: 'tax', readOnly: true },
    { key: 'cashFlowBeforeSale', label: 'Cash Flow Before Sale', type: 'currency', category: 'formula', readOnly: true },
    { key: 'grossSaleProceedsDcf', label: 'Gross Sale Proceeds', type: 'currency', category: 'exit', readOnly: true },
    { key: 'saleCostsDcf', label: 'Sale Costs', type: 'currency', category: 'exit', readOnly: true },
    { key: 'loanPayoffAtSale', label: 'Loan Payoff at Sale', type: 'currency', category: 'exit', readOnly: true },
    { key: 'recaptureTaxDcf', label: 'Recapture Tax', type: 'currency', category: 'exit', readOnly: true },
    { key: 'saleProceedsDcf', label: 'Sale Proceeds', type: 'currency', category: 'exit' },
    { key: 'cashFlowAfterSale', label: 'Cash Flow After Sale', type: 'currency', category: 'formula', readOnly: true },
    { key: 'waterfallSponsor', label: 'Sponsor Waterfall', type: 'currency', category: 'waterfall' },
    { key: 'waterfallInvestor', label: 'Investor Waterfall', type: 'currency', category: 'waterfall' },
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
      reconciliationMonth: '12'
    },
    lenderConstraints: {
      minDscr: '1.25',
      minDebtYield: '8.00',
      maxLtv: '75.00'
    },
    rentRoll: [
      { tenantName: '', suite: '', annualRent: '', annualSales: '', leasedSf: '', annualRentPsf: '', leaseType: 'NNN', reimbursementsPct: '0', freeRentMonths: '0', leaseStartYear: '1', leaseStartMonth: '1', leaseEndYear: '10', leaseEndMonth: '12', rentBumpsPct: '', renewalProbabilityPct: '50', downtimeMonths: '0', marketRentPsf: '', newLeaseSpreadPct: '', renewalSpreadPct: '', tenantImprovementPerSf: '', leasingCommissionPct: '', expenseStopPerSf: '', grossUpPct: '', breakpointSales: '', percentageRentPct: '', anchorTenant: false, coTenancyGroup: '', extensionOptionMonths: '0', expansionSf: '0', contractionSf: '0', terminationMonth: '', purchaseOptionPrice: '', renewalTiPerSf: '', newLeaseTiPerSf: '', renewalLcPct: '', newLeaseLcPct: '', camPoolSharePct: '100', adminFeePct: '', controllableCapPct: '', nonRecoverableExpensePct: '' }
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
  function normalizeScenarioDraft(scenario = {}, fallbackLabel, fallbackValues = {}) {
    return {
      label: scenario.label || fallbackLabel,
      rentGrowth: toTextNumber(scenario.rentGrowth ?? fallbackValues.rentGrowth),
      expenseGrowth: toTextNumber(scenario.expenseGrowth ?? fallbackValues.expenseGrowth),
      exitCapRate: toTextNumber(scenario.exitCapRate ?? fallbackValues.exitCapRate),
      vacancyRate: toTextNumber(scenario.vacancyRate ?? fallbackValues.vacancyRate),
      loanAmount: toTextNumber(scenario.loanAmount ?? fallbackValues.loanAmount),
      holdPeriod: toTextNumber(scenario.holdPeriod ?? fallbackValues.holdPeriod ?? 10)
    }
  }
  function normalizeRentRollRow(row = {}) {
    return {
      tenantName: row.tenantName || '',
      suite: row.suite || '',
      annualRent: toTextNumber(row.annualRent),
      annualSales: toTextNumber(row.annualSales),
      leasedSf: toTextNumber(row.leasedSf),
      annualRentPsf: toTextNumber(row.annualRentPsf),
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
  function normalizeDcfModel(rawModel, prop = {}) {
    const hydrated = hydrateDcfModel(rawModel, prop)
    const baseModel = defaultDcfModel()
    const source = rawModel && typeof rawModel === 'object' && !Array.isArray(rawModel) ? rawModel : {}
    return {
      ...hydrated,
      scenarioName: source.scenarioName || baseModel.scenarioName,
      scenarios: {
        base: normalizeScenarioDraft(source.scenarios?.base, 'Base', {
          rentGrowth: prop.rent_growth,
          expenseGrowth: prop.expense_growth,
          exitCapRate: prop.exit_cap_rate,
          vacancyRate: prop.vacancy_rate,
          loanAmount: prop.loan_amount,
          holdPeriod: prop.hold_period,
        }),
        upside: normalizeScenarioDraft(source.scenarios?.upside, 'Upside', {
          rentGrowth: prop.rent_growth,
          expenseGrowth: prop.expense_growth,
          exitCapRate: prop.exit_cap_rate,
          vacancyRate: prop.vacancy_rate,
          loanAmount: prop.loan_amount,
          holdPeriod: prop.hold_period,
        }),
        downside: normalizeScenarioDraft(source.scenarios?.downside, 'Downside', {
          rentGrowth: prop.rent_growth,
          expenseGrowth: prop.expense_growth,
          exitCapRate: prop.exit_cap_rate,
          vacancyRate: prop.vacancy_rate,
          loanAmount: prop.loan_amount,
          holdPeriod: prop.hold_period,
        })
      },
      debtTerms: {
        initialLoanTermYears: toTextNumber(source.debtTerms?.initialLoanTermYears),
        refinanceLoanTermYears: toTextNumber(source.debtTerms?.refinanceLoanTermYears),
        refinanceCostPct: toTextNumber(source.debtTerms?.refinanceCostPct ?? baseModel.debtTerms.refinanceCostPct),
        floatingRate: !!source.debtTerms?.floatingRate,
        sofrRatePct: toTextNumber(source.debtTerms?.sofrRatePct ?? baseModel.debtTerms.sofrRatePct),
        indexSpreadPct: toTextNumber(source.debtTerms?.indexSpreadPct ?? baseModel.debtTerms.indexSpreadPct),
        rateCapPct: toTextNumber(source.debtTerms?.rateCapPct),
        rateFloorPct: toTextNumber(source.debtTerms?.rateFloorPct),
        interestReserveMonths: toTextNumber(source.debtTerms?.interestReserveMonths ?? baseModel.debtTerms.interestReserveMonths)
      },
      waterfall: {
        prefRate: toTextNumber(source.waterfall?.prefRate ?? baseModel.waterfall.prefRate),
        catchUpRate: toTextNumber(source.waterfall?.catchUpRate ?? baseModel.waterfall.catchUpRate),
        promoteRate: toTextNumber(source.waterfall?.promoteRate ?? baseModel.waterfall.promoteRate),
        lpSharePct: toTextNumber(source.waterfall?.lpSharePct ?? baseModel.waterfall.lpSharePct),
        gpSharePct: toTextNumber(source.waterfall?.gpSharePct ?? baseModel.waterfall.gpSharePct)
      },
      timing: {
        granularity: source.timing?.granularity || baseModel.timing.granularity,
        viewMode: source.timing?.viewMode || baseModel.timing.viewMode,
        refiMonth: toTextNumber(source.timing?.refiMonth || 1),
        saleMonth: toTextNumber(source.timing?.saleMonth || 12)
      },
      taxModel: {
        capitalGainsRatePct: toTextNumber(source.taxModel?.capitalGainsRatePct ?? baseModel.taxModel.capitalGainsRatePct),
        ordinaryIncomeTaxRatePct: toTextNumber(source.taxModel?.ordinaryIncomeTaxRatePct ?? source.effectiveTaxRate ?? baseModel.taxModel.ordinaryIncomeTaxRatePct),
        passiveLossLimitPct: toTextNumber(source.taxModel?.passiveLossLimitPct ?? baseModel.taxModel.passiveLossLimitPct),
        initialTaxBasis: toTextNumber(source.taxModel?.initialTaxBasis),
        suspendedLossCarryforward: toTextNumber(source.taxModel?.suspendedLossCarryforward ?? baseModel.taxModel.suspendedLossCarryforward),
        entityType: source.taxModel?.entityType || baseModel.taxModel.entityType,
        enable1031: !!source.taxModel?.enable1031,
        installmentSalePct: toTextNumber(source.taxModel?.installmentSalePct ?? baseModel.taxModel.installmentSalePct)
      },
        governance: {
          inputsLocked: !!source.governance?.inputsLocked,
          formulasLocked: source.governance?.formulasLocked !== undefined ? !!source.governance.formulasLocked : baseModel.governance.formulasLocked,
          overridesEnabled: source.governance?.overridesEnabled !== undefined ? !!source.governance.overridesEnabled : baseModel.governance.overridesEnabled,
          overrideNote: source.governance?.overrideNote || baseModel.governance.overrideNote,
          diagnosticLevel: source.governance?.diagnosticLevel || baseModel.governance.diagnosticLevel
        },
        leaseEconomics: {
        freeRentMonths: toTextNumber(source.leaseEconomics?.freeRentMonths ?? baseModel.leaseEconomics.freeRentMonths),
        marketRentGrowthPct: toTextNumber(source.leaseEconomics?.marketRentGrowthPct),
        downtimeMonthsDefault: toTextNumber(source.leaseEconomics?.downtimeMonthsDefault ?? baseModel.leaseEconomics.downtimeMonthsDefault),
        expenseRecoveryPct: toTextNumber(source.leaseEconomics?.expenseRecoveryPct ?? baseModel.leaseEconomics.expenseRecoveryPct),
        newLeaseSpreadPct: toTextNumber(source.leaseEconomics?.newLeaseSpreadPct ?? baseModel.leaseEconomics.newLeaseSpreadPct),
        renewalSpreadPct: toTextNumber(source.leaseEconomics?.renewalSpreadPct ?? baseModel.leaseEconomics.renewalSpreadPct),
        tenantImprovementPerSf: toTextNumber(source.leaseEconomics?.tenantImprovementPerSf ?? baseModel.leaseEconomics.tenantImprovementPerSf),
        leasingCommissionPct: toTextNumber(source.leaseEconomics?.leasingCommissionPct ?? baseModel.leaseEconomics.leasingCommissionPct),
        expenseStopPerSf: toTextNumber(source.leaseEconomics?.expenseStopPerSf ?? baseModel.leaseEconomics.expenseStopPerSf),
        grossUpPct: toTextNumber(source.leaseEconomics?.grossUpPct ?? baseModel.leaseEconomics.grossUpPct),
        percentageRentBreakpointType: source.leaseEconomics?.percentageRentBreakpointType || baseModel.leaseEconomics.percentageRentBreakpointType,
        camAdminFeePct: toTextNumber(source.leaseEconomics?.camAdminFeePct ?? baseModel.leaseEconomics.camAdminFeePct),
        controllableExpensePct: toTextNumber(source.leaseEconomics?.controllableExpensePct ?? baseModel.leaseEconomics.controllableExpensePct),
        controllableCapPct: toTextNumber(source.leaseEconomics?.controllableCapPct ?? baseModel.leaseEconomics.controllableCapPct),
        nonRecoverableExpensePct: toTextNumber(source.leaseEconomics?.nonRecoverableExpensePct ?? baseModel.leaseEconomics.nonRecoverableExpensePct),
        taxPoolRecoverablePct: toTextNumber(source.leaseEconomics?.taxPoolRecoverablePct ?? baseModel.leaseEconomics.taxPoolRecoverablePct),
        insurancePoolRecoverablePct: toTextNumber(source.leaseEconomics?.insurancePoolRecoverablePct ?? baseModel.leaseEconomics.insurancePoolRecoverablePct),
        camPoolRecoverablePct: toTextNumber(source.leaseEconomics?.camPoolRecoverablePct ?? baseModel.leaseEconomics.camPoolRecoverablePct),
        grossUpMethod: source.leaseEconomics?.grossUpMethod || baseModel.leaseEconomics.grossUpMethod,
        reconciliationMonth: toTextNumber(source.leaseEconomics?.reconciliationMonth ?? baseModel.leaseEconomics.reconciliationMonth)
      },
      lenderConstraints: {
        minDscr: toTextNumber(source.lenderConstraints?.minDscr ?? baseModel.lenderConstraints.minDscr),
        minDebtYield: toTextNumber(source.lenderConstraints?.minDebtYield ?? baseModel.lenderConstraints.minDebtYield),
        maxLtv: toTextNumber(source.lenderConstraints?.maxLtv ?? baseModel.lenderConstraints.maxLtv)
      },
      rentRoll: Array.isArray(source.rentRoll) && source.rentRoll.length > 0
        ? source.rentRoll.map(normalizeRentRollRow)
        : baseModel.rentRoll.map(normalizeRentRollRow)
    }
  }
  function formatMoneyCell(value) {
    if (value === null || value === undefined || value === '') return '—'
    const num = Number(value)
    if (!Number.isFinite(num)) return '—'
    return '$' + num.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }
  function parseNum(value) {
    if (value === '' || value === null || value === undefined) return null
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  function calculateIrr(cashFlows) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) return null
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
    const hold = Math.min(DCF_MAX_YEARS, Math.max(1, Number(prop.hold_period || 1)))
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
    const effectiveTaxRatePct = Number(prop.effective_tax_rate || 0) / 100
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
    const rentRoll = Array.isArray(source.rentRoll) ? source.rentRoll : []
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
    const defaultNewLeaseSpreadPct = Number(source.leaseEconomics?.newLeaseSpreadPct || 0) / 100
    const defaultRenewalSpreadPct = Number(source.leaseEconomics?.renewalSpreadPct || 0) / 100
    const defaultTiPerSf = Math.max(0, Number(source.leaseEconomics?.tenantImprovementPerSf || 0))
    const defaultLcPct = Math.max(0, Number(source.leaseEconomics?.leasingCommissionPct || 0)) / 100
    const defaultExpenseStopPerSf = Math.max(0, Number(source.leaseEconomics?.expenseStopPerSf || 0))
    const defaultGrossUpPct = Math.max(0, Number(source.leaseEconomics?.grossUpPct || 95)) / 100
    const breakpointType = source.leaseEconomics?.percentageRentBreakpointType || 'natural'
    const camAdminFeePct = Math.max(0, Number(source.leaseEconomics?.camAdminFeePct || 0)) / 100
    const controllableExpensePct = Math.max(0, Number(source.leaseEconomics?.controllableExpensePct || 60)) / 100
    const controllableCapPct = Math.max(0, Number(source.leaseEconomics?.controllableCapPct || 5)) / 100
    const nonRecoverableExpensePct = Math.max(0, Number(source.leaseEconomics?.nonRecoverableExpensePct || 0)) / 100
    const taxPoolRecoverablePct = Math.max(0, Number(source.leaseEconomics?.taxPoolRecoverablePct || 100)) / 100
    const insurancePoolRecoverablePct = Math.max(0, Number(source.leaseEconomics?.insurancePoolRecoverablePct || 100)) / 100
    const camPoolRecoverablePct = Math.max(0, Number(source.leaseEconomics?.camPoolRecoverablePct || 100)) / 100
    const grossUpMethod = source.leaseEconomics?.grossUpMethod || 'category'
    const reconciliationMonth = clampMonth(source.leaseEconomics?.reconciliationMonth || 12, 12)
    const minDscr = Number(source.lenderConstraints?.minDscr || 0)
    const minDebtYield = Number(source.lenderConstraints?.minDebtYield || 0) / 100
    const maxLtvConstraint = Number(source.lenderConstraints?.maxLtv || 0) / 100
    const prefRate = Number(source.waterfall?.prefRate || 0) / 100
    const catchUpRate = Number(source.waterfall?.catchUpRate || 0) / 100
    const promoteRate = Number(source.waterfall?.promoteRate || 0) / 100
    const lpSharePct = Math.max(0, Number(source.waterfall?.lpSharePct || 95)) / 100
    const gpSharePct = Math.max(0, Number(source.waterfall?.gpSharePct || 5)) / 100
    let unpaidPrefBalance = 0
    let lpUnreturnedCapital = Math.max(0, ((Number(prop.price || 0) + Number(prop.closing_costs || 0) - loanAmt) || 0) * lpSharePct)
    let gpUnreturnedCapital = Math.max(0, ((Number(prop.price || 0) + Number(prop.closing_costs || 0) - loanAmt) || 0) * gpSharePct)
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
    const timingMode = source.timing?.granularity || 'monthly'
    const saleMonthValue = clampMonth(source.timing?.saleMonth || 12, 12)
    const totalMonths = hold * 12
    const refiMonthIndex = refiYearValue > 0 ? toMonthIndex(refiYearValue, refiMonthValue) : -1
    const saleMonthIndex = Math.max(0, totalMonths - (12 - saleMonthValue) - 1)
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
        const reimbursementsPct = Math.max(0, Number(tenant.reimbursementsPct || 0)) / 100
        const marketRentPsf = Number(tenant.marketRentPsf || 0)
        const newLeaseSpreadPct = Number(tenant.newLeaseSpreadPct || source.leaseEconomics?.newLeaseSpreadPct || 0) / 100
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
        const recoveredMonthlyRent = bumpedMonthlyRent * (1 + reimbursementsPct)
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
          * (1 + reimbursementsPct)
          * Math.pow(1 + monthlyRentBumpPct, monthsSinceRenewal)
        return sum + renewalMonthlyRent
      }, 0)
      const grossRevenue = rentRollRevenue > 0 ? rentRollRevenue : (grossRentBase / 12) * rentGrowthFactor
      const vacancyLoss = grossRevenue * vacancyPct
      const tenantSalesMonth = rentRoll.reduce((sum, tenant) => {
        const leaseStartIndex = toMonthIndex(tenant.leaseStartYear, tenant.leaseStartMonth)
        if (monthIndex < leaseStartIndex) return sum
        return sum + ((Number(tenant.annualSales || 0) / 12) * Math.pow(1 + monthlyRentGrowthPct, Math.max(0, monthIndex - leaseStartIndex)))
      }, 0) || (monthlyTenantSalesBase * rentGrowthFactor)
      const baseRentMonth = rentRollRevenue > 0 ? grossRevenue : monthlyTenantBaseRentBase * rentGrowthFactor
      const percentageRent = rentRoll.reduce((sum, tenant) => {
        const tenantSales = Number(tenant.annualSales || 0) / 12
        if (tenantSales <= 0) return sum
        const tenantPctRent = Number(tenant.percentageRentPct || 0) / 100 || rentToSalesPct
        if (tenantPctRent <= 0) return sum
        const tenantBaseMonthlyRent = (Number(tenant.annualRent || 0) || ((Number(tenant.marketRentPsf || 0) || Number(tenant.annualRentPsf || 0)) * Number(tenant.leasedSf || 0))) / 12
        const naturalBreakpoint = tenantPctRent > 0 ? tenantBaseMonthlyRent / tenantPctRent : 0
        const statedBreakpoint = Number(tenant.breakpointSales || 0) / 12
        const breakpointSales = breakpointType === 'stated' && statedBreakpoint > 0 ? statedBreakpoint : naturalBreakpoint
        return sum + Math.max(0, (tenantSales * Math.pow(1 + monthlyRentGrowthPct, monthIndex)) - breakpointSales) * tenantPctRent
      }, 0) || Math.max(0, tenantSalesMonth * rentToSalesPct - baseRentMonth)
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
      const grossUpBase = grossUpMethod === 'category'
        ? Math.max(0.0001, defaultGrossUpPct)
        : Math.max(0.0001, 1 - vacancyPct)
      const grossedUpCamPool = totalCamPool / grossUpBase
      const grossedUpTaxPool = (monthlyPropertyTaxesBase * expenseGrowthFactor) / grossUpBase
      const grossedUpInsurancePool = (monthlyInsuranceBase * expenseGrowthFactor) / grossUpBase
      const recoveries = rentRoll.reduce((sum, tenant) => {
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
        const tenantRecoverableCam = Math.max(0, ((grossedUpCamPool * camPoolRecoverablePct) - tenantExcludedAmount) * tenantCamPoolSharePct)
        const tenantRecoverableTax = grossedUpTaxPool * taxPoolRecoverablePct * reimbursementsPct
        const tenantRecoverableInsurance = grossedUpInsurancePool * insurancePoolRecoverablePct * reimbursementsPct
        const recoverableExpenses = (tenantRecoverableCam + tenantRecoverableTax + tenantRecoverableInsurance) / tenantGrossUpBase
        const controllableCapCredit = monthIndex > 0 ? (controllableExpenseRaw - controllableExpenseCapped) * tenantControllableCapPct : 0
        const adminFeeRecovery = totalCamPool * tenantAdminFeePct * tenantCamPoolSharePct
        if (leaseType === 'NNN') return sum + ((recoverableExpenses + adminFeeRecovery - controllableCapCredit) * reimbursementsPct)
        if (leaseType === 'Base Year') return sum + Math.max(0, (recoverableExpenses + adminFeeRecovery - controllableCapCredit) - ((expenseStopPerSf * leasedSf) / 12)) * reimbursementsPct
        if (leaseType === 'Gross') return sum
        return sum + ((operatingExpensesMonth * expenseRecoveryPct * reimbursementsPct) + adminFeeRecovery - controllableCapCredit)
      }, 0) || (operatingExpensesMonth * expenseRecoveryPct)
      const reconciliationAdjustment = monthNumber === reconciliationMonth
        ? rentRoll.reduce((sum, tenant) => {
          const tenantCamPoolSharePct = Math.max(0, Number(tenant.camPoolSharePct || 100)) / 100
          const tenantExcludedPct = Math.max(0, Number(tenant.nonRecoverableExpensePct || source.leaseEconomics?.nonRecoverableExpensePct || 0)) / 100
          const tenantReconciliation = (totalCamPool * tenantCamPoolSharePct) - (totalCamPool * expenseRecoveryPct * (1 - tenantExcludedPct) * tenantCamPoolSharePct)
          return sum + tenantReconciliation
        }, 0)
        : 0
      const totalRecoveries = recoveries + reconciliationAdjustment
      const effectiveGrossIncome = grossRevenue - vacancyLoss + percentageRent + otherIncome + totalRecoveries
      const managementFees = effectiveGrossIncome * managementFeePct
      const propertyTaxesMonth = monthlyPropertyTaxesBase * expenseGrowthFactor
      const insuranceMonth = monthlyInsuranceBase * expenseGrowthFactor
      const reservesMonth = monthlyReservesBase * expenseGrowthFactor
      const noi = effectiveGrossIncome - operatingExpensesMonth - managementFees - propertyTaxesMonth - insuranceMonth - reservesMonth
      const tenantImprovementsMonth = rentRoll.reduce((sum, tenant) => {
        const leaseEndIndex = toMonthIndex(tenant.leaseEndYear, tenant.leaseEndMonth)
        const extensionOptionMonths = Math.max(0, Number(tenant.extensionOptionMonths || 0))
        const downtimeMonths = Math.max(0, Number(tenant.downtimeMonths || downtimeMonthsDefault))
        const renewalStart = leaseEndIndex + extensionOptionMonths + downtimeMonths + 1
        if (monthIndex !== renewalStart) return sum
        const leasedSf = Number(tenant.leasedSf || 0)
        const tiPerSf = Math.max(0, Number(tenant.renewalTiPerSf || tenant.tenantImprovementPerSf || source.leaseEconomics?.tenantImprovementPerSf || 0))
        return sum + (leasedSf * tiPerSf)
      }, 0)
      const leasingCommissionsMonth = rentRoll.reduce((sum, tenant) => {
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
      }, 0)
      const monthsSinceLoanStart = monthIndex + 1 - currentLoanStartMonth
      const inIoPeriod = monthsSinceLoanStart > 0 && monthsSinceLoanStart <= ioYears * 12 && currentLoanPrincipal > 0
      const balloonMonth = currentLoanTermYears > 0 ? currentLoanTermYears * 12 : null
      const hitsBalloon = balloonMonth !== null && monthsSinceLoanStart >= balloonMonth && currentLoanPrincipal > 0
      const floatingAllInRate = floatingRate ? (sofrRatePct + indexSpreadPct) : currentLoanRate
      const boundedRate = Math.max(
        rateFloorPct !== null ? rateFloorPct : floatingAllInRate,
        Math.min(rateCapPct !== null ? rateCapPct : floatingAllInRate, floatingAllInRate)
      )
      const monthlyDebtService = currentLoanPrincipal > 0
        ? (inIoPeriod
          ? currentLoanPrincipal * ((floatingRate ? boundedRate : currentLoanRate) / 100 / 12)
          : paymentForLoan(currentLoanPrincipal, floatingRate ? boundedRate : currentLoanRate, currentLoanAmortYears))
        : 0
      const reserveDraw = interestReserveBalance > 0 ? Math.min(interestReserveBalance, monthlyDebtService) : 0
      interestReserveBalance = Math.max(0, interestReserveBalance - reserveDraw)
      const annualDepreciation = depBasis > 0 ? (depBasis * (1 - Number(prop.cost_seg_bonus_pct || 0) / 100) / 39) : 0
      const monthlyDepreciation = annualDepreciation / 12
      const bonusDepreciation = monthIndex === 0 ? depBasis * (Number(prop.cost_seg_bonus_pct || 0) / 100) : 0
      const taxableIncome = noi - (monthlyDebtService - reserveDraw) - monthlyDepreciation - bonusDepreciation
      const currentPeriodLoss = taxableIncome < 0 ? Math.abs(taxableIncome) : 0
      suspendedLossCarryforward += currentPeriodLoss
      const usableSuspendedLoss = taxableIncome > 0 ? Math.min(suspendedLossCarryforward, taxableIncome * passiveLossLimitPct) : 0
      const ordinaryTaxableIncome = Math.max(0, taxableIncome - usableSuspendedLoss)
      suspendedLossCarryforward = Math.max(0, suspendedLossCarryforward - usableSuspendedLoss)
      const taxesMonth = ordinaryTaxableIncome * ordinaryIncomeTaxRatePct
      accumulatedDepreciation += monthlyDepreciation + bonusDepreciation
      const loanBalance = currentLoanPrincipal > 0
        ? (inIoPeriod
          ? currentLoanPrincipal
          : endingLoanBalance(currentLoanPrincipal, currentLoanRate, currentLoanAmortYears, monthsSinceLoanStart))
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
      const refinanceCosts = refiGrossProceeds > 0 ? refiGrossProceeds * refinanceCostPct : 0
      const loanPayoffAtRefi = refiGrossProceeds > 0 || hitsBalloon ? loanBalance : 0
      const refinanceLoanAmount = refiGrossProceeds > 0 ? Math.min(refiGrossProceeds, maxDebtByConstraints) : 0
      const refinanceProceeds = Math.max(0, refinanceLoanAmount - refinanceCosts - loanPayoffAtRefi)
      if (refiGrossProceeds > 0) {
        currentLoanPrincipal = refinanceLoanAmount
        currentLoanRate = refiRatePct > 0 ? refiRatePct : currentLoanRate
        currentLoanAmortYears = amortYears || currentLoanAmortYears
        currentLoanStartMonth = monthIndex + 1
        currentLoanTermYears = refinanceLoanTermYears || currentLoanTermYears
      } else if (hitsBalloon) {
        currentLoanPrincipal = 0
      }
      const grossSaleProceeds = monthIndex === saleMonthIndex ? stabilizedValue : 0
      const saleCosts = grossSaleProceeds > 0 ? grossSaleProceeds * costOfSalePct : 0
      const loanPayoffAtSale = grossSaleProceeds > 0
        ? endingLoanBalance(currentLoanPrincipal, currentLoanRate, currentLoanAmortYears, monthIndex + 1 - currentLoanStartMonth)
        : 0
      const taxBasisAtSale = Math.max(0, initialTaxBasis - accumulatedDepreciation)
      const gainBeforeTaxes = Math.max(0, grossSaleProceeds - saleCosts - initialTaxBasis)
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
      const saleProceeds = Math.max(0, grossSaleProceeds - saleCosts - loanPayoffAtSale - afterTaxSaleBridge)
      const cashAvailableForDistribution = Math.max(0, noi - (monthlyDebtService - reserveDraw) - taxesMonth + refinanceProceeds + saleProceeds)
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
        otherIncomeDcf: Math.round(otherIncome),
        operatingExpensesDcf: Math.round(operatingExpensesMonth),
        managementFeesDcf: Math.round(managementFees),
        propertyTaxesDcf: Math.round(propertyTaxesMonth),
        insuranceDcf: Math.round(insuranceMonth),
        reservesCapexDcf: Math.round(reservesMonth),
        tenantImprovements: Math.round(tenantImprovementsMonth),
        leasingCommissions: Math.round(leasingCommissionsMonth),
        capitalExpenditures: 0,
        debtServiceDcf: Math.round(monthlyDebtService),
        loanBalanceDcf: Math.round(loanBalance),
        refinanceProceeds: Math.round(refinanceProceeds),
        refinanceCostsDcf: Math.round(refinanceCosts),
        loanPayoffAtRefi: Math.round(loanPayoffAtRefi),
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
      yearlyBuckets[yearIndex].otherIncomeDcf += otherIncome
      yearlyBuckets[yearIndex].operatingExpensesDcf += operatingExpensesMonth
      yearlyBuckets[yearIndex].managementFeesDcf += managementFees
      yearlyBuckets[yearIndex].propertyTaxesDcf += propertyTaxesMonth
      yearlyBuckets[yearIndex].insuranceDcf += insuranceMonth
      yearlyBuckets[yearIndex].reservesCapexDcf += reservesMonth
      yearlyBuckets[yearIndex].tenantImprovements += tenantImprovementsMonth
      yearlyBuckets[yearIndex].leasingCommissions += leasingCommissionsMonth
      yearlyBuckets[yearIndex].debtServiceDcf += monthlyDebtService
      yearlyBuckets[yearIndex].loanBalanceDcf = loanBalance
      yearlyBuckets[yearIndex].refinanceProceeds += refinanceProceeds
      yearlyBuckets[yearIndex].refinanceCostsDcf += refinanceCosts
      yearlyBuckets[yearIndex].loanPayoffAtRefi += loanPayoffAtRefi
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
      model.years[index] = normalizeYearDraft({
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
      }, index + 1)
    }
    return model
  }
  function hydrateDcfModel(rawModel, prop = {}) {
    const base = rawModel && typeof rawModel === 'object' && !Array.isArray(rawModel) ? rawModel : {}
    const incomingYears = Array.isArray(base.years) ? base.years : []
    const fallback = buildDefaultDcfModelFromProperty(prop)
    return {
      months: Array.isArray(base.months) ? base.months : fallback.months || [],
      years: Array.from({ length: DCF_MAX_YEARS }, (_, index) => {
        const yearNumber = index + 1
        const source = incomingYears[index] || fallback.years[index] || {}
        return normalizeYearDraft(source, yearNumber)
      })
    }
  }
  function buildPropertyFromDraft(overrides = {}, propertyOverrides = {}) {
    const derivedLtv = parseNum(price) > 0 && parseNum(loanAmount) >= 0
      ? ((parseNum(loanAmount) / parseNum(price)) * 100).toFixed(2)
      : ltv
    const derivedRentToSales = parseNum(tenantGrossSales) > 0 && parseNum(tenantBaseRent) >= 0
      ? ((parseNum(tenantBaseRent) / parseNum(tenantGrossSales)) * 100).toFixed(2)
      : rentToSales
    return {
      ...property,
      ...propertyOverrides,
      price,
      closing_costs: closingCosts,
      hold_period: holdPeriod,
      gross_scheduled_rent: grossScheduledRent,
      vacancy_rate: vacancyRate,
      other_income: otherIncome,
      operating_expenses: operatingExpenses,
      reserves_capex: reservesCapex,
      loan_amount: loanAmount,
      interest_rate: interestRate,
      amortization_term: amortizationTerm,
      interest_only_period: interestOnlyPeriod,
      rent_growth: rentGrowth,
      expense_growth: expenseGrowth,
      exit_cap_rate: exitCapRate,
      cost_of_sale: costOfSale,
      tenant_gross_sales: tenantGrossSales,
      tenant_base_rent: tenantBaseRent,
      management_fee_pct: managementFeePct,
      insurance,
      property_taxes: propertyTaxes,
      land_value_pct: landValuePct,
      cost_seg_bonus_pct: costSegBonusPct,
      effective_tax_rate: effectiveTaxRate,
      depreciation_recapture_rate: depreciationRecaptureRate,
      refi_ltv: refiLtv,
      refi_rate: refiRate,
      refi_year: refiYear,
      ltv: derivedLtv,
      rent_to_sales_ratio: derivedRentToSales,
      dcf_model: {
        ...dcfModel,
        taxModel: {
          ...dcfModel.taxModel,
          capitalGainsRatePct: dcfModel.taxModel.capitalGainsRatePct !== '' ? dcfModel.taxModel.capitalGainsRatePct : effectiveTaxRate,
          ordinaryIncomeTaxRatePct: dcfModel.taxModel.ordinaryIncomeTaxRatePct !== '' ? dcfModel.taxModel.ordinaryIncomeTaxRatePct : effectiveTaxRate,
        },
        ...overrides
      }
    }
  }
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
  const [grm, setGrm] = useState('')
  const [capRate, setCapRate] = useState('')
  const [cashOnCash, setCashOnCash] = useState('')
  const [irr, setIrr] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [pricePerSqft, setPricePerSqft] = useState('')
  const [rentToSales, setRentToSales] = useState('')
  const [numSkus, setNumSkus] = useState('')
  const [pricePerAcre, setPricePerAcre] = useState('')
  const [elecVoltage, setElecVoltage] = useState('')
  const [elecAmperage, setElecAmperage] = useState('')
  const [assetType, setAssetType] = useState('')
  // Income block
  const [grossScheduledRent, setGrossScheduledRent] = useState('')
  const [vacancyRate, setVacancyRate] = useState('')
  const [otherIncome, setOtherIncome] = useState('')
  const [operatingExpenses, setOperatingExpenses] = useState('')
  const [reservesCapex, setReservesCapex] = useState('')
  // Debt block
  const [loanAmount, setLoanAmount] = useState('')
  const [ltv, setLtv] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [amortizationTerm, setAmortizationTerm] = useState('')
  const [interestOnlyPeriod, setInterestOnlyPeriod] = useState('')
  // Deal block
  const [unitCount, setUnitCount] = useState('')
  const [closingCosts, setClosingCosts] = useState('')
  const [holdPeriod, setHoldPeriod] = useState('10')
  const [rentGrowth, setRentGrowth] = useState('')
  const [expenseGrowth, setExpenseGrowth] = useState('')
  const [exitCapRate, setExitCapRate] = useState('')
  const [costOfSale, setCostOfSale] = useState('')
  // Tenant block
  const [tenantGrossSales, setTenantGrossSales] = useState('')
  const [tenantBaseRent, setTenantBaseRent] = useState('')
  // Operating block
  const [managementFeePct, setManagementFeePct] = useState('')
  const [insurance, setInsurance] = useState('')
  const [propertyTaxes, setPropertyTaxes] = useState('')
  // Tax / Cost Seg block
  const [landValuePct, setLandValuePct] = useState('')
  const [costSegBonusPct, setCostSegBonusPct] = useState('')
  const [effectiveTaxRate, setEffectiveTaxRate] = useState('')
  const [depreciationRecaptureRate, setDepreciationRecaptureRate] = useState('')
  // Refi block
  const [refiLtv, setRefiLtv] = useState('')
  const [refiRate, setRefiRate] = useState('')
  const [refiYear, setRefiYear] = useState('')
  const [dcfModel, setDcfModel] = useState(defaultDcfModel())
  const [saving, setSaving] = useState(false)
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
    setGrm(p.grm ?? '')
    setCapRate(p.cap_rate ?? '')
    setCashOnCash(p.cash_on_cash ?? '')
    setIrr(p.irr ?? '')
    setPricePerUnit(p.price_per_unit ?? '')
    setPricePerSqft(p.price_per_sqft ?? '')
    setRentToSales(p.rent_to_sales_ratio ?? '')
    setNumSkus(p.num_skus ?? '')
    setPricePerAcre(p.price_per_acre ?? '')
    setElecVoltage(p.electrical_voltage ?? '')
    setElecAmperage(p.electrical_amperage ?? '')
    setAssetType(p.asset_type || '')
    setGrossScheduledRent(p.gross_scheduled_rent ?? '')
    setVacancyRate(p.vacancy_rate ?? '')
    setOtherIncome(p.other_income ?? '')
    setOperatingExpenses(p.operating_expenses ?? '')
    setReservesCapex(p.reserves_capex ?? '')
    setLoanAmount(p.loan_amount ?? '')
    setLtv(p.ltv ?? '')
    setInterestRate(p.interest_rate ?? '')
    setAmortizationTerm(p.amortization_term ?? '')
    setInterestOnlyPeriod(p.interest_only_period ?? '')
    setUnitCount(p.unit_count ?? '')
    setClosingCosts(p.closing_costs ?? '')
    setHoldPeriod(p.hold_period ?? '10')
    setRentGrowth(p.rent_growth ?? '')
    setExpenseGrowth(p.expense_growth ?? '')
    setExitCapRate(p.exit_cap_rate ?? '')
    setCostOfSale(p.cost_of_sale ?? '')
    setTenantGrossSales(p.tenant_gross_sales ?? '')
    setTenantBaseRent(p.tenant_base_rent ?? '')
    setManagementFeePct(p.management_fee_pct ?? '')
    setInsurance(p.insurance ?? '')
    setPropertyTaxes(p.property_taxes ?? '')
    setLandValuePct(p.land_value_pct ?? '')
    setCostSegBonusPct(p.cost_seg_bonus_pct ?? '')
    setEffectiveTaxRate(p.effective_tax_rate ?? '')
    setDepreciationRecaptureRate(p.depreciation_recapture_rate ?? '')
    setRefiLtv(p.refi_ltv ?? '')
    setRefiRate(p.refi_rate ?? '')
    setRefiYear(p.refi_year ?? '')
    setDcfModel(normalizeDcfModel(p.dcf_model, p))
  }

  useEffect(() => {
    if (open && property) {
      loadProperty(property)
      setTab('details')
    } else if (open && !property) {
      setPin(''); setAddress(''); setCounty(''); setPrice(''); setSqft(''); setLot('')
      setYearBuilt(''); setOnMajorRoad(false); setTrafficVpd(''); setOnCornerLot(false)
      setWaterAccess(false); setNextToPublicLand(false); setInterstates([])
      setLogisticsHubs([]); setLandmarksList([]); setWaterSources([]); setMilitaryBases([])
      setIncomeMin(''); setIncomeMax(''); setPopDensity(''); setPropStatus('New')
      setGrm(''); setCapRate(''); setCashOnCash(''); setIrr('')
      setPricePerUnit(''); setPricePerSqft(''); setRentToSales(''); setNumSkus('')
      setPricePerAcre(''); setElecVoltage(''); setElecAmperage(''); setAssetType('')
      setGrossScheduledRent(''); setVacancyRate(''); setOtherIncome(''); setOperatingExpenses(''); setReservesCapex('')
      setLoanAmount(''); setLtv(''); setInterestRate(''); setAmortizationTerm(''); setInterestOnlyPeriod('')
      setUnitCount(''); setClosingCosts(''); setHoldPeriod('10'); setRentGrowth(''); setExpenseGrowth('')
      setExitCapRate(''); setCostOfSale(''); setTenantGrossSales(''); setTenantBaseRent('')
      setManagementFeePct(''); setInsurance(''); setPropertyTaxes('')
      setLandValuePct(''); setCostSegBonusPct(''); setEffectiveTaxRate(''); setDepreciationRecaptureRate('')
      setRefiLtv(''); setRefiRate(''); setRefiYear('')
      setDcfModel(defaultDcfModel())
      setTab('details')
    }
  }, [property, open])

  const activeHoldPeriod = Math.min(DCF_MAX_YEARS, Math.max(1, Number(holdPeriod || 1)))
  const visibleDcfYears = dcfModel.years.slice(0, activeHoldPeriod)
  const acquisitionBasis = (parseNum(price) || 0) + (parseNum(closingCosts) || 0)
  const initialEquity = acquisitionBasis - (parseNum(loanAmount) || 0)
  const discountRateDecimal = (parseNum(irr) || 0) / 100
  function updateDcfCell(yearIndex, field, value) {
    setDcfModel(prev => ({
      years: prev.years.map((row, index) => index === yearIndex ? { ...row, [field]: value } : row)
    }))
  }
  function updateScenarioField(scenarioKey, field, value) {
    setDcfModel(prev => ({
      ...prev,
      scenarios: {
        ...prev.scenarios,
        [scenarioKey]: { ...prev.scenarios[scenarioKey], [field]: value }
      }
    }))
  }
  function updateDebtTermField(field, value) {
    setDcfModel(prev => ({ ...prev, debtTerms: { ...prev.debtTerms, [field]: value } }))
  }
  function updateWaterfallField(field, value) {
    setDcfModel(prev => ({ ...prev, waterfall: { ...prev.waterfall, [field]: value } }))
  }
  function updateLeaseEconomicsField(field, value) {
    setDcfModel(prev => ({ ...prev, leaseEconomics: { ...prev.leaseEconomics, [field]: value } }))
  }
  function updateLenderConstraintField(field, value) {
    setDcfModel(prev => ({ ...prev, lenderConstraints: { ...prev.lenderConstraints, [field]: value } }))
  }
  function updateTimingField(field, value) {
    setDcfModel(prev => ({ ...prev, timing: { ...prev.timing, [field]: value } }))
  }
  function updateTaxModelField(field, value) {
    setDcfModel(prev => ({ ...prev, taxModel: { ...prev.taxModel, [field]: value } }))
  }
  function updateGovernanceField(field, value) {
    setDcfModel(prev => ({ ...prev, governance: { ...prev.governance, [field]: value } }))
  }
  function buildScenarioProperty(scenarioKey, overrides = {}) {
    const scenario = dcfModel.scenarios[scenarioKey] || {}
    return buildPropertyFromDraft({
      ...overrides,
      scenarioName: scenarioKey,
      scenarios: dcfModel.scenarios,
    }, {
      rent_growth: scenario.rentGrowth !== '' ? scenario.rentGrowth : rentGrowth,
      expense_growth: scenario.expenseGrowth !== '' ? scenario.expenseGrowth : expenseGrowth,
      exit_cap_rate: scenario.exitCapRate !== '' ? scenario.exitCapRate : exitCapRate,
      vacancy_rate: scenario.vacancyRate !== '' ? scenario.vacancyRate : vacancyRate,
      loan_amount: scenario.loanAmount !== '' ? scenario.loanAmount : loanAmount,
      hold_period: scenario.holdPeriod !== '' ? scenario.holdPeriod : holdPeriod,
    })
  }
  function updateRentRollRow(index, field, value) {
    setDcfModel(prev => ({
      ...prev,
      rentRoll: prev.rentRoll.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)
    }))
  }
  function addRentRollRow() {
    setDcfModel(prev => ({
      ...prev,
      rentRoll: [...prev.rentRoll, normalizeRentRollRow({})]
    }))
  }
  function removeRentRollRow(index) {
    setDcfModel(prev => ({
      ...prev,
      rentRoll: prev.rentRoll.length <= 1 ? prev.rentRoll : prev.rentRoll.filter((_, rowIndex) => rowIndex !== index)
    }))
  }
  const liveDerivedDcfModel = useMemo(
    () => normalizeDcfModel(buildPropertyFromDraft().dcf_model, buildPropertyFromDraft()),
    [
      property,
      price,
      closingCosts,
      holdPeriod,
      grossScheduledRent,
      vacancyRate,
      otherIncome,
      operatingExpenses,
      reservesCapex,
      loanAmount,
      interestRate,
      amortizationTerm,
      interestOnlyPeriod,
      rentGrowth,
      expenseGrowth,
      exitCapRate,
      costOfSale,
      tenantGrossSales,
      tenantBaseRent,
      managementFeePct,
      insurance,
      propertyTaxes,
      landValuePct,
      costSegBonusPct,
      effectiveTaxRate,
      depreciationRecaptureRate,
      refiLtv,
      refiRate,
      refiYear,
      rentToSales,
      dcfModel
    ]
  )
  const governanceDiagnostics = useMemo(() => {
    const issues = []
    const overrideEntries = []
    const currentModel = dcfModel || {}
    const governance = currentModel.governance || {}
    const baseLeaseEconomics = defaultDcfModel().leaseEconomics
    const baseDebtTerms = defaultDcfModel().debtTerms
    ;[
      ['leaseEconomics', currentModel.leaseEconomics || {}, baseLeaseEconomics],
      ['debtTerms', currentModel.debtTerms || {}, baseDebtTerms],
      ['timing', currentModel.timing || {}, defaultDcfModel().timing],
      ['taxModel', currentModel.taxModel || {}, defaultDcfModel().taxModel],
    ].forEach(([sectionName, section, defaults]) => {
      Object.keys(section).forEach((key) => {
        if (defaults && Object.prototype.hasOwnProperty.call(defaults, key) && String(section[key] ?? '') !== String(defaults[key] ?? '')) {
          overrideEntries.push({ section: sectionName, field: key, value: section[key] })
        }
      })
    })
    ;(currentModel.rentRoll || []).forEach((tenant, index) => {
      const startYear = Number(tenant.leaseStartYear || 0)
      const startMonth = Number(tenant.leaseStartMonth || 0)
      const endYear = Number(tenant.leaseEndYear || 0)
      const endMonth = Number(tenant.leaseEndMonth || 0)
      const leasedSf = Number(tenant.leasedSf || 0)
      const expansionSf = Number(tenant.expansionSf || 0)
      const contractionSf = Number(tenant.contractionSf || 0)
      const terminationMonth = tenant.terminationMonth === '' || tenant.terminationMonth === null || tenant.terminationMonth === undefined
        ? null
        : Number(tenant.terminationMonth)
      const leaseStartIndex = toMonthIndex(startYear || 1, clampMonth(startMonth || 1, 1))
      const leaseEndIndex = toMonthIndex(endYear || DCF_MAX_YEARS, clampMonth(endMonth || 12, 12))
      if (leaseEndIndex < leaseStartIndex) {
        issues.push({ severity: 'error', scope: `Tenant ${index + 1}`, message: 'Lease end occurs before lease start.' })
      }
      if (terminationMonth !== null && terminationMonth < leaseStartIndex) {
        issues.push({ severity: 'error', scope: `Tenant ${index + 1}`, message: 'Termination month occurs before lease commencement.' })
      }
      if (leasedSf + expansionSf - contractionSf < 0) {
        issues.push({ severity: 'error', scope: `Tenant ${index + 1}`, message: 'Expansion/contraction rights drive leased square footage below zero.' })
      }
      if (Number(tenant.freeRentMonths || 0) > Math.max(0, leaseEndIndex - leaseStartIndex + 1)) {
        issues.push({ severity: 'warning', scope: `Tenant ${index + 1}`, message: 'Free rent exceeds the scheduled lease term.' })
      }
    })
    if ((parseNum(holdPeriod) || 0) <= 0) {
      issues.push({ severity: 'error', scope: 'Timing', message: 'Hold period must be at least one year.' })
    }
    if ((parseNum(loanAmount) || 0) > 0 && (parseNum(interestRate) || 0) <= 0 && !currentModel.debtTerms?.floatingRate) {
      issues.push({ severity: 'warning', scope: 'Debt', message: 'Loan amount is set without a positive fixed interest rate.' })
    }
    return {
      issues,
      overrides: overrideEntries,
      summary: {
        hasErrors: issues.some(issue => issue.severity === 'error'),
        hasWarnings: issues.some(issue => issue.severity === 'warning'),
        overrideCount: overrideEntries.length,
        diagnosticLevel: governance.diagnosticLevel || 'strict'
      }
    }
  }, [dcfModel, holdPeriod, loanAmount, interestRate])
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
    const capitalGainsTaxVal = parseNum(yearRow.capitalGainsTaxDcf) || 0
    const sponsorVal = parseNum(yearRow.waterfallSponsor) || 0
    const investorVal = parseNum(yearRow.waterfallInvestor) || 0
    const effectiveGrossIncome = grossRevenueVal - vacancyLossVal + percentageRentVal + otherIncomeVal
    const netOperatingIncome = effectiveGrossIncome - operatingExpensesVal - managementFeesVal - propertyTaxesVal - insuranceVal - reservesVal
    const belowTheLineCapital = tenantImprovementsVal + leasingCommissionsVal + capitalExpendituresVal
    const cashFlowBeforeSale = netOperatingIncome - belowTheLineCapital - debtServiceVal + refinanceVal - refinanceCostsVal - taxesVal - capitalGainsTaxVal
    const cashFlowAfterSale = cashFlowBeforeSale + saleProceedsVal - sponsorVal - investorVal
    if (rowKey === 'effectiveGrossIncome') return effectiveGrossIncome
    if (rowKey === 'netOperatingIncomeDcf') return netOperatingIncome
    if (rowKey === 'cashFlowBeforeSale') return cashFlowBeforeSale
    if (rowKey === 'cashFlowAfterSale') return cashFlowAfterSale
    return null
  }
  const engineVisibleDcfYears = liveDerivedDcfModel.years.slice(0, activeHoldPeriod)
  const engineVisibleDcfMonths = Array.isArray(liveDerivedDcfModel.months)
    ? liveDerivedDcfModel.months.slice(0, activeHoldPeriod * 12)
    : []
  const dcfYearSummaries = useMemo(() => engineVisibleDcfYears.map((yearRow) => {
    const effectiveGrossIncome = getComputedDcfValue(yearRow, 'effectiveGrossIncome') || 0
    const netOperatingIncome = getComputedDcfValue(yearRow, 'netOperatingIncomeDcf') || 0
    const cashFlowBeforeSale = getComputedDcfValue(yearRow, 'cashFlowBeforeSale') || 0
    const cashFlowAfterSale = getComputedDcfValue(yearRow, 'cashFlowAfterSale') || 0
    const debtService = parseNum(yearRow.debtServiceDcf) || 0
    return { effectiveGrossIncome, netOperatingIncome, cashFlowBeforeSale, cashFlowAfterSale, debtService }
  }), [engineVisibleDcfYears])
  const leveredCashFlows = initialEquity > 0
    ? [-initialEquity, ...dcfYearSummaries.map(row => row.cashFlowAfterSale)]
    : null
  const leveredIrr = leveredCashFlows ? calculateIrr(leveredCashFlows) : null
  const unleveredCashFlowsResolved = acquisitionBasis > 0
    ? [-acquisitionBasis, ...engineVisibleDcfYears.map((yearRow) => {
      const noi = getComputedDcfValue(yearRow, 'netOperatingIncomeDcf') || 0
      const sale = parseNum(yearRow.saleProceedsDcf) || 0
      const taxes = parseNum(yearRow.taxesDcf) || 0
      return noi + sale - taxes
    })]
    : null
  const unleveredIrr = unleveredCashFlowsResolved ? calculateIrr(unleveredCashFlowsResolved) : null
  const leveredEquityMultiple = leveredCashFlows && initialEquity > 0
    ? leveredCashFlows.slice(1).reduce((sum, value) => sum + value, 0) / initialEquity
    : null
  const unleveredEquityMultiple = unleveredCashFlowsResolved && acquisitionBasis > 0
    ? unleveredCashFlowsResolved.slice(1).reduce((sum, value) => sum + value, 0) / acquisitionBasis
    : null
  const leveredNpv = leveredCashFlows && discountRateDecimal > -1
    ? leveredCashFlows.reduce((sum, value, index) => sum + (value / Math.pow(1 + discountRateDecimal, index)), 0)
    : null
  const unleveredNpv = unleveredCashFlowsResolved && discountRateDecimal > -1
    ? unleveredCashFlowsResolved.reduce((sum, value, index) => sum + (value / Math.pow(1 + discountRateDecimal, index)), 0)
    : null
  const debtYield = dcfYearSummaries[0] && parseNum(loanAmount) > 0
    ? dcfYearSummaries[0].netOperatingIncome / parseNum(loanAmount) * 100
    : null
  const yieldOnCost = dcfYearSummaries[0] && acquisitionBasis > 0
    ? dcfYearSummaries[0].netOperatingIncome / acquisitionBasis * 100
    : null
  const derivedLtv = parseNum(price) > 0 && parseNum(loanAmount) >= 0
    ? (parseNum(loanAmount) / parseNum(price) * 100)
    : null
  const derivedRentToSales = parseNum(tenantGrossSales) > 0 && parseNum(tenantBaseRent) >= 0
    ? (parseNum(tenantBaseRent) / parseNum(tenantGrossSales) * 100)
    : null
  const firstYearDcf = engineVisibleDcfYears[0] || null
  const holdYearDcf = engineVisibleDcfYears[engineVisibleDcfYears.length - 1] || null
  const adjustedNoiValue = firstYearDcf ? (getComputedDcfValue(firstYearDcf, 'netOperatingIncomeDcf') || 0) : null
  const exitValueAmount = holdYearDcf ? (parseNum(holdYearDcf.grossSaleProceedsDcf) || 0) : null
  const netSaleProceedsAmount = holdYearDcf ? (parseNum(holdYearDcf.saleProceedsDcf) || 0) : null
  const loanBalanceAtExitAmount = holdYearDcf ? (parseNum(holdYearDcf.loanPayoffAtSale) || 0) : null
  const netEquityOnExitAmount = netSaleProceedsAmount
  const annualDebtServiceAmount = firstYearDcf ? (parseNum(firstYearDcf.debtServiceDcf) || 0) : null
  const grossRevenueAmount = firstYearDcf ? (parseNum(firstYearDcf.grossRevenue) || 0) : null
  const egiAmount = firstYearDcf ? (getComputedDcfValue(firstYearDcf, 'effectiveGrossIncome') || 0) : null
  const capRateFromEngine = adjustedNoiValue !== null && parseNum(price) > 0 ? (adjustedNoiValue / parseNum(price) * 100) : null
  const cashOnCashFromEngine = adjustedNoiValue !== null && annualDebtServiceAmount !== null && initialEquity > 0
    ? ((adjustedNoiValue - annualDebtServiceAmount) / initialEquity * 100)
    : null
  const dscrFromEngine = adjustedNoiValue !== null && annualDebtServiceAmount > 0
    ? (adjustedNoiValue / annualDebtServiceAmount)
    : null
  const financialInputClass = 'input input-bordered input-md w-full md:text-base border-sky-300 bg-sky-50/60 text-sky-900 focus:border-sky-500 focus:outline-none'
  const financialOutputClass = 'input input-bordered input-md w-full md:text-base cursor-default border-slate-300 bg-slate-100 text-slate-900 font-semibold'
  const sectionHeaderClass = 'text-sm font-semibold uppercase tracking-wide pb-2 border-b'
  const metricTone = {
    good: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    caution: 'border-amber-300 bg-amber-50 text-amber-900',
    danger: 'border-rose-300 bg-rose-50 text-rose-900',
    neutral: financialOutputClass,
  }
  const dscrTone = dscrFromEngine !== null
    ? dscrFromEngine >= 1.25 ? metricTone.good : dscrFromEngine >= 1 ? metricTone.caution : metricTone.danger
    : metricTone.neutral
  const irrTone = leveredIrr !== null
    ? leveredIrr >= 0.15 ? metricTone.good : leveredIrr >= 0.08 ? metricTone.caution : metricTone.danger
    : metricTone.neutral
  const cashOnCashTone = cashOnCashFromEngine !== null
    ? cashOnCashFromEngine >= 8 ? metricTone.good : cashOnCashFromEngine >= 4 ? metricTone.caution : metricTone.danger
    : metricTone.neutral
  const summarizeScenarioModel = useCallback((scenarioKey, propertyOverrides = {}) => {
    const scenarioProp = buildScenarioProperty(scenarioKey, {}, propertyOverrides)
    const scenarioModel = normalizeDcfModel(scenarioProp.dcf_model, scenarioProp)
    const scenarioHold = Math.min(DCF_MAX_YEARS, Math.max(1, Number(scenarioProp.hold_period || 1)))
    const years = scenarioModel.years.slice(0, scenarioHold)
    const yearSummaries = years.map((yearRow) => {
      const effectiveGrossIncome = getComputedDcfValue(yearRow, 'effectiveGrossIncome') || 0
      const netOperatingIncome = getComputedDcfValue(yearRow, 'netOperatingIncomeDcf') || 0
      const cashFlowAfterSale = getComputedDcfValue(yearRow, 'cashFlowAfterSale') || 0
      const debtService = parseNum(yearRow.debtServiceDcf) || 0
      return { effectiveGrossIncome, netOperatingIncome, cashFlowAfterSale, debtService, yearRow }
    })
    const acquisitionCost = (parseNum(scenarioProp.price) || 0) + (parseNum(scenarioProp.closing_costs) || 0)
    const scenarioInitialEquity = acquisitionCost - (parseNum(scenarioProp.loan_amount) || 0)
    const leveredCashFlowsResolved = scenarioInitialEquity > 0 ? [-scenarioInitialEquity, ...yearSummaries.map(row => row.cashFlowAfterSale)] : null
    const leveredIrrResolved = leveredCashFlowsResolved ? calculateIrr(leveredCashFlowsResolved) : null
    const leveredEmxResolved = leveredCashFlowsResolved && scenarioInitialEquity > 0
      ? leveredCashFlowsResolved.slice(1).reduce((sum, value) => sum + value, 0) / scenarioInitialEquity
      : null
    const firstYear = yearSummaries[0] || null
    const holdYear = yearSummaries[yearSummaries.length - 1] || null
    const dscr = firstYear && firstYear.debtService > 0 ? firstYear.netOperatingIncome / firstYear.debtService : null
    const debtYieldResolved = firstYear && parseNum(scenarioProp.loan_amount) > 0
      ? firstYear.netOperatingIncome / parseNum(scenarioProp.loan_amount)
      : null
    const covenantBreach = (parseNum(dcfModel.lenderConstraints.minDscr) > 0 && dscr !== null && dscr < parseNum(dcfModel.lenderConstraints.minDscr))
      || (parseNum(dcfModel.lenderConstraints.minDebtYield) > 0 && debtYieldResolved !== null && debtYieldResolved * 100 < parseNum(dcfModel.lenderConstraints.minDebtYield))
    return {
      key: scenarioKey,
      label: dcfModel.scenarios[scenarioKey].label,
      irr: leveredIrrResolved,
      emx: leveredEmxResolved,
      noi: holdYear ? holdYear.netOperatingIncome : null,
      exitValue: holdYear ? (parseNum(holdYear.yearRow.grossSaleProceedsDcf) || 0) : null,
      netSale: holdYear ? (parseNum(holdYear.yearRow.saleProceedsDcf) || 0) : null,
      dscr,
      debtYield: debtYieldResolved !== null ? debtYieldResolved * 100 : null,
      covenantBreach,
      cashTrap: firstYear ? firstYear.cashFlowAfterSale < 0 : false,
    }
  }, [dcfModel, buildScenarioProperty, normalizeDcfModel, getComputedDcfValue, parseNum, calculateIrr])
  const scenarioComparison = useMemo(
    () => ['base', 'upside', 'downside'].map((scenarioKey) => summarizeScenarioModel(scenarioKey)),
    [summarizeScenarioModel]
  )
  const sensitivityCases = useMemo(
    () => [
      { key: 'exitCapUp', label: 'Exit Cap +50 bps', overrides: { exit_cap_rate: String((parseNum(exitCapRate) || 0) + 0.5) } },
      { key: 'rentGrowthDown', label: 'Rent Growth -100 bps', overrides: { rent_growth: String((parseNum(rentGrowth) || 0) - 1) } },
      { key: 'vacancyUp', label: 'Vacancy +100 bps', overrides: { vacancy_rate: String((parseNum(vacancyRate) || 0) + 1) } },
      { key: 'leverageUp', label: 'Leverage +5% LTV', overrides: { loan_amount: String((parseNum(loanAmount) || 0) + ((parseNum(price) || 0) * 0.05)) } },
      { key: 'holdShorter', label: 'Hold -1 year', overrides: { hold_period: String(Math.max(1, (parseNum(holdPeriod) || 1) - 1)) } },
    ].map((sensitivity) => ({
      ...sensitivity,
      result: summarizeScenarioModel('base', sensitivity.overrides)
    })),
    [exitCapRate, rentGrowth, vacancyRate, loanAmount, price, holdPeriod, summarizeScenarioModel]
  )

  useEffect(() => {
    if (open && property?.id) {
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
    } catch (e) { console.error('Failed to fetch media', e.message) }
    finally { setMediaLoading(false) }
  }

  async function fetchDocs() {
    setDocsLoading(true)
    try {
      const data = await apiFetch(`/api/properties/${property.id}/documents`)
      setDocs(data.documents || [])
    } catch (e) { console.error('Failed to fetch documents', e.message) }
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
      const fileData = await toBase64(file)
      try {
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
    await apiFetch(`/api/properties/${property.id}/documents/${docId}`, { method: 'DELETE' })
    fetchDocs()
  }

  async function fetchUsers() {
    try {
      const data = await apiFetch(`/api/properties/${property.id}/users`)
      setAllUsers(data.users || [])
    } catch (e) { console.error('Failed to fetch users', e.message) }
  }

  async function handleSave() {
    if (!pin.trim() || !address.trim() || !county.trim()) { alert('PIN, Address and County are required'); return }
    setSaving(true)
    await onSave({
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
      grm: grm !== '' ? Number(grm) : null,
      cap_rate: capRate !== '' ? Number(capRate) : null,
      cash_on_cash: cashOnCash !== '' ? Number(cashOnCash) : null,
      irr: irr !== '' ? Number(irr) : null,
      price_per_unit: pricePerUnit !== '' ? Number(pricePerUnit) : null,
      price_per_sqft: pricePerSqft !== '' ? Number(pricePerSqft) : null,
      rent_to_sales_ratio: rentToSales !== '' ? Number(rentToSales) : null,
      num_skus: numSkus !== '' ? Number(numSkus) : null,
      price_per_acre: pricePerAcre !== '' ? Number(pricePerAcre) : null,
      electrical_voltage: elecVoltage !== '' ? Number(elecVoltage) : null,
      electrical_amperage: elecAmperage !== '' ? Number(elecAmperage) : null,
      asset_type: assetType || null,
      gross_scheduled_rent: grossScheduledRent !== '' ? Number(grossScheduledRent) : null,
      vacancy_rate: vacancyRate !== '' ? Number(vacancyRate) : null,
      other_income: otherIncome !== '' ? Number(otherIncome) : null,
      operating_expenses: operatingExpenses !== '' ? Number(operatingExpenses) : null,
      reserves_capex: reservesCapex !== '' ? Number(reservesCapex) : null,
      loan_amount: loanAmount !== '' ? Number(loanAmount) : null,
      ltv: ltv !== '' ? Number(ltv) : null,
      interest_rate: interestRate !== '' ? Number(interestRate) : null,
      amortization_term: amortizationTerm !== '' ? Number(amortizationTerm) : null,
      interest_only_period: interestOnlyPeriod !== '' ? Number(interestOnlyPeriod) : null,
      unit_count: unitCount !== '' ? Number(unitCount) : null,
      closing_costs: closingCosts !== '' ? Number(closingCosts) : null,
      hold_period: holdPeriod !== '' ? Number(holdPeriod) : null,
      rent_growth: rentGrowth !== '' ? Number(rentGrowth) : null,
      expense_growth: expenseGrowth !== '' ? Number(expenseGrowth) : null,
      exit_cap_rate: exitCapRate !== '' ? Number(exitCapRate) : null,
      cost_of_sale: costOfSale !== '' ? Number(costOfSale) : null,
      tenant_gross_sales: tenantGrossSales !== '' ? Number(tenantGrossSales) : null,
      tenant_base_rent: tenantBaseRent !== '' ? Number(tenantBaseRent) : null,
      management_fee_pct: managementFeePct !== '' ? Number(managementFeePct) : null,
      insurance: insurance !== '' ? Number(insurance) : null,
      property_taxes: propertyTaxes !== '' ? Number(propertyTaxes) : null,
      land_value_pct: landValuePct !== '' ? Number(landValuePct) : null,
      cost_seg_bonus_pct: costSegBonusPct !== '' ? Number(costSegBonusPct) : null,
      effective_tax_rate: effectiveTaxRate !== '' ? Number(effectiveTaxRate) : null,
      depreciation_recapture_rate: depreciationRecaptureRate !== '' ? Number(depreciationRecaptureRate) : null,
      refi_ltv: refiLtv !== '' ? Number(refiLtv) : null,
      refi_rate: refiRate !== '' ? Number(refiRate) : null,
      refi_year: refiYear !== '' ? Number(refiYear) : null,
      dcf_model: {
        years: dcfModel.years.map((year, index) => ({
          year: index + 1,
          grossRevenue: parseNum(year.grossRevenue),
          vacancyCreditLoss: parseNum(year.vacancyCreditLoss),
          percentageRentDcf: parseNum(year.percentageRentDcf),
          otherIncomeDcf: parseNum(year.otherIncomeDcf),
          operatingExpensesDcf: parseNum(year.operatingExpensesDcf),
          managementFeesDcf: parseNum(year.managementFeesDcf),
          propertyTaxesDcf: parseNum(year.propertyTaxesDcf),
          insuranceDcf: parseNum(year.insuranceDcf),
          reservesCapexDcf: parseNum(year.reservesCapexDcf),
          tenantImprovements: parseNum(year.tenantImprovements),
          leasingCommissions: parseNum(year.leasingCommissions),
          capitalExpenditures: parseNum(year.capitalExpenditures),
          debtServiceDcf: parseNum(year.debtServiceDcf),
          loanBalanceDcf: parseNum(year.loanBalanceDcf),
          refinanceProceeds: parseNum(year.refinanceProceeds),
          refinanceCostsDcf: parseNum(year.refinanceCostsDcf),
          loanPayoffAtRefi: parseNum(year.loanPayoffAtRefi),
          taxesDcf: parseNum(year.taxesDcf),
          grossSaleProceedsDcf: parseNum(year.grossSaleProceedsDcf),
          saleCostsDcf: parseNum(year.saleCostsDcf),
          loanPayoffAtSale: parseNum(year.loanPayoffAtSale),
          recaptureTaxDcf: parseNum(year.recaptureTaxDcf),
          saleProceedsDcf: parseNum(year.saleProceedsDcf),
          waterfallSponsor: parseNum(year.waterfallSponsor),
          waterfallInvestor: parseNum(year.waterfallInvestor),
        })),
        scenarioName: dcfModel.scenarioName,
        scenarios: {
          base: {
            label: dcfModel.scenarios.base.label,
            rentGrowth: parseNum(dcfModel.scenarios.base.rentGrowth),
            expenseGrowth: parseNum(dcfModel.scenarios.base.expenseGrowth),
            exitCapRate: parseNum(dcfModel.scenarios.base.exitCapRate),
            vacancyRate: parseNum(dcfModel.scenarios.base.vacancyRate),
            loanAmount: parseNum(dcfModel.scenarios.base.loanAmount),
            holdPeriod: parseNum(dcfModel.scenarios.base.holdPeriod),
          },
          upside: {
            label: dcfModel.scenarios.upside.label,
            rentGrowth: parseNum(dcfModel.scenarios.upside.rentGrowth),
            expenseGrowth: parseNum(dcfModel.scenarios.upside.expenseGrowth),
            exitCapRate: parseNum(dcfModel.scenarios.upside.exitCapRate),
            vacancyRate: parseNum(dcfModel.scenarios.upside.vacancyRate),
            loanAmount: parseNum(dcfModel.scenarios.upside.loanAmount),
            holdPeriod: parseNum(dcfModel.scenarios.upside.holdPeriod),
          },
          downside: {
            label: dcfModel.scenarios.downside.label,
            rentGrowth: parseNum(dcfModel.scenarios.downside.rentGrowth),
            expenseGrowth: parseNum(dcfModel.scenarios.downside.expenseGrowth),
            exitCapRate: parseNum(dcfModel.scenarios.downside.exitCapRate),
            vacancyRate: parseNum(dcfModel.scenarios.downside.vacancyRate),
            loanAmount: parseNum(dcfModel.scenarios.downside.loanAmount),
            holdPeriod: parseNum(dcfModel.scenarios.downside.holdPeriod),
          }
        },
        debtTerms: {
          initialLoanTermYears: parseNum(dcfModel.debtTerms.initialLoanTermYears),
          refinanceLoanTermYears: parseNum(dcfModel.debtTerms.refinanceLoanTermYears),
          refinanceCostPct: parseNum(dcfModel.debtTerms.refinanceCostPct),
          floatingRate: !!dcfModel.debtTerms.floatingRate,
          sofrRatePct: parseNum(dcfModel.debtTerms.sofrRatePct),
          indexSpreadPct: parseNum(dcfModel.debtTerms.indexSpreadPct),
          rateCapPct: parseNum(dcfModel.debtTerms.rateCapPct),
          rateFloorPct: parseNum(dcfModel.debtTerms.rateFloorPct),
          interestReserveMonths: parseNum(dcfModel.debtTerms.interestReserveMonths),
        },
        waterfall: {
          prefRate: parseNum(dcfModel.waterfall.prefRate),
          catchUpRate: parseNum(dcfModel.waterfall.catchUpRate),
          promoteRate: parseNum(dcfModel.waterfall.promoteRate),
          lpSharePct: parseNum(dcfModel.waterfall.lpSharePct),
          gpSharePct: parseNum(dcfModel.waterfall.gpSharePct),
        },
        timing: {
          granularity: dcfModel.timing.granularity,
          viewMode: dcfModel.timing.viewMode,
          refiMonth: parseNum(dcfModel.timing.refiMonth),
          saleMonth: parseNum(dcfModel.timing.saleMonth),
        },
        taxModel: {
          capitalGainsRatePct: parseNum(dcfModel.taxModel.capitalGainsRatePct),
          ordinaryIncomeTaxRatePct: parseNum(dcfModel.taxModel.ordinaryIncomeTaxRatePct),
          passiveLossLimitPct: parseNum(dcfModel.taxModel.passiveLossLimitPct),
          initialTaxBasis: parseNum(dcfModel.taxModel.initialTaxBasis),
          suspendedLossCarryforward: parseNum(dcfModel.taxModel.suspendedLossCarryforward),
          entityType: dcfModel.taxModel.entityType,
          enable1031: !!dcfModel.taxModel.enable1031,
          installmentSalePct: parseNum(dcfModel.taxModel.installmentSalePct),
        },
        governance: {
          inputsLocked: !!dcfModel.governance.inputsLocked,
          formulasLocked: !!dcfModel.governance.formulasLocked,
          overridesEnabled: !!dcfModel.governance.overridesEnabled,
          overrideNote: dcfModel.governance.overrideNote || '',
          diagnosticLevel: dcfModel.governance.diagnosticLevel || 'strict',
          diagnostics: governanceDiagnostics.issues,
          overrides: governanceDiagnostics.overrides,
          summary: governanceDiagnostics.summary,
        },
        leaseEconomics: {
          freeRentMonths: parseNum(dcfModel.leaseEconomics.freeRentMonths),
          marketRentGrowthPct: parseNum(dcfModel.leaseEconomics.marketRentGrowthPct),
          downtimeMonthsDefault: parseNum(dcfModel.leaseEconomics.downtimeMonthsDefault),
          expenseRecoveryPct: parseNum(dcfModel.leaseEconomics.expenseRecoveryPct),
          newLeaseSpreadPct: parseNum(dcfModel.leaseEconomics.newLeaseSpreadPct),
          renewalSpreadPct: parseNum(dcfModel.leaseEconomics.renewalSpreadPct),
          tenantImprovementPerSf: parseNum(dcfModel.leaseEconomics.tenantImprovementPerSf),
          leasingCommissionPct: parseNum(dcfModel.leaseEconomics.leasingCommissionPct),
          expenseStopPerSf: parseNum(dcfModel.leaseEconomics.expenseStopPerSf),
          grossUpPct: parseNum(dcfModel.leaseEconomics.grossUpPct),
          percentageRentBreakpointType: dcfModel.leaseEconomics.percentageRentBreakpointType,
          camAdminFeePct: parseNum(dcfModel.leaseEconomics.camAdminFeePct),
          controllableExpensePct: parseNum(dcfModel.leaseEconomics.controllableExpensePct),
          controllableCapPct: parseNum(dcfModel.leaseEconomics.controllableCapPct),
          nonRecoverableExpensePct: parseNum(dcfModel.leaseEconomics.nonRecoverableExpensePct),
          taxPoolRecoverablePct: parseNum(dcfModel.leaseEconomics.taxPoolRecoverablePct),
          insurancePoolRecoverablePct: parseNum(dcfModel.leaseEconomics.insurancePoolRecoverablePct),
          camPoolRecoverablePct: parseNum(dcfModel.leaseEconomics.camPoolRecoverablePct),
          grossUpMethod: dcfModel.leaseEconomics.grossUpMethod,
          reconciliationMonth: parseNum(dcfModel.leaseEconomics.reconciliationMonth),
        },
        lenderConstraints: {
          minDscr: parseNum(dcfModel.lenderConstraints.minDscr),
          minDebtYield: parseNum(dcfModel.lenderConstraints.minDebtYield),
          maxLtv: parseNum(dcfModel.lenderConstraints.maxLtv),
        },
        rentRoll: dcfModel.rentRoll.map((row) => ({
          tenantName: row.tenantName || '',
          suite: row.suite || '',
          annualRent: parseNum(row.annualRent),
          annualSales: parseNum(row.annualSales),
          leasedSf: parseNum(row.leasedSf),
          annualRentPsf: parseNum(row.annualRentPsf),
          leaseType: row.leaseType || 'NNN',
          reimbursementsPct: parseNum(row.reimbursementsPct),
          freeRentMonths: parseNum(row.freeRentMonths),
          leaseStartYear: parseNum(row.leaseStartYear),
          leaseStartMonth: parseNum(row.leaseStartMonth),
          leaseEndYear: parseNum(row.leaseEndYear),
          leaseEndMonth: parseNum(row.leaseEndMonth),
          rentBumpsPct: parseNum(row.rentBumpsPct),
          renewalProbabilityPct: parseNum(row.renewalProbabilityPct),
          downtimeMonths: parseNum(row.downtimeMonths),
          marketRentPsf: parseNum(row.marketRentPsf),
          newLeaseSpreadPct: parseNum(row.newLeaseSpreadPct),
          renewalSpreadPct: parseNum(row.renewalSpreadPct),
          tenantImprovementPerSf: parseNum(row.tenantImprovementPerSf),
          leasingCommissionPct: parseNum(row.leasingCommissionPct),
          expenseStopPerSf: parseNum(row.expenseStopPerSf),
          grossUpPct: parseNum(row.grossUpPct),
          breakpointSales: parseNum(row.breakpointSales),
          percentageRentPct: parseNum(row.percentageRentPct),
          anchorTenant: !!row.anchorTenant,
          coTenancyGroup: row.coTenancyGroup || '',
          extensionOptionMonths: parseNum(row.extensionOptionMonths),
          expansionSf: parseNum(row.expansionSf),
          contractionSf: parseNum(row.contractionSf),
          terminationMonth: parseNum(row.terminationMonth),
          purchaseOptionPrice: parseNum(row.purchaseOptionPrice),
          renewalTiPerSf: parseNum(row.renewalTiPerSf),
          newLeaseTiPerSf: parseNum(row.newLeaseTiPerSf),
          renewalLcPct: parseNum(row.renewalLcPct),
          newLeaseLcPct: parseNum(row.newLeaseLcPct),
          camPoolSharePct: parseNum(row.camPoolSharePct),
          adminFeePct: parseNum(row.adminFeePct),
          controllableCapPct: parseNum(row.controllableCapPct),
          nonRecoverableExpensePct: parseNum(row.nonRecoverableExpensePct),
        }))
      },
    })
    setSaving(false)
    setSavedSignal(s => s + 1)
    if (!property?.id) onClose()
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
      const base64Data = await toBase64(file)
      try {
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
    await apiFetch(`/api/properties/${property.id}/media/${mediaId}`, { method: 'DELETE' })
    fetchMedia()
  }

  async function toggleAssign(userId, currentlyAssigned) {
    setAssignLoading(true)
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
    } catch { console.error('Assign failed') }
    finally { setAssignLoading(false) }
  }

  if (!open) return null

  const tabs = property?.id
    ? ['details', 'financials', 'media', 'documents', ...(isAdmin ? ['assign'] : [])]
    : ['details', 'financials']

  const tabLabel = { details: 'Details', financials: 'Financials', media: 'Media', documents: 'Documents', assign: 'Assign Users' }

  return (
    <div className="modal modal-open" style={{ zIndex: 30, paddingTop: `${topOffset}px` }}>
      {/* Wide container: left form + right map */}
      <div className="modal-box p-0 w-screen max-w-none max-h-none rounded-none flex flex-col overflow-hidden" style={{ height: `calc(100vh - ${topOffset}px)` }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-base-300 md:hidden">
          <h3 className="font-bold text-xl">
            {property?.id ? property.address : 'New Property'}
          </h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
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

        <div className="flex flex-col md:flex-row overflow-hidden min-h-0 flex-1 md:pt-0">
        {/* ── Left panel: form ── */}
        <div className="flex flex-col w-full md:w-[480px] md:flex-shrink-0 overflow-y-auto max-h-screen">
          <div className="hidden md:flex items-center justify-between px-6 py-2 border-b border-base-300 sticky top-0 bg-base-100 z-[2]">
            <h3 className="font-bold text-xl">
              {property?.id ? property.address : 'New Property'}
            </h3>
            <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
          </div>

          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="tabs tabs-bordered px-6 md:pt-0 sticky top-[53px] bg-base-100 z-[2]">
              {tabs.map(t => (
                <button key={t} className={`tab ${tab === t ? 'tab-active font-semibold' : ''}`} onClick={() => setTab(t)}>
                  {tabLabel[t]}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 px-6 py-5 overflow-y-auto">

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

            <div className="divider text-xs text-base-content/40 my-1">Property Specs</div>
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
            <div className="divider text-xs text-base-content/40 my-1">Location Attributes</div>
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
            <div className="divider text-xs text-base-content/40 my-1">Major Interstates</div>
            <div className="space-y-2">
              {interstates.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="text" placeholder="e.g. I-80" value={item.name}
                    onChange={e => updateInterstate(i, 'name', e.target.value)}
                    className="input input-bordered input-sm w-32" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles away" value={item.distance}
                    onChange={e => updateInterstate(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-32" disabled={!isAdmin} />
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeInterstate(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && (
                <button className="btn btn-xs btn-outline" onClick={addInterstate}>+ Add Interstate</button>
              )}
              {interstates.length === 0 && <p className="text-sm text-base-content/40">No interstates added</p>}
            </div>

            {/* Demographics */}
            <div className="divider text-xs text-base-content/40 my-1">Logistics Hubs</div>
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
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeHub(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addHub}>+ Add Hub</button>}
              {logisticsHubs.length === 0 && <p className="text-sm text-base-content/40">No logistics hubs added</p>}
            </div>

            <div className="divider text-xs text-base-content/40 my-1">Landmarks</div>
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
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeLandmark(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addLandmark}>+ Add Landmark</button>}
              {landmarksList.length === 0 && <p className="text-sm text-base-content/40">No landmarks added</p>}
            </div>

            <div className="divider text-xs text-base-content/40 my-1">Water Sources</div>
            <div className="space-y-2">
              {waterSources.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <input type="text" placeholder="e.g. Lake Michigan" value={item.name}
                    onChange={e => updateWaterSource(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[180px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateWaterSource(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeWaterSource(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addWaterSource}>+ Add Water Source</button>}
              {waterSources.length === 0 && <p className="text-sm text-base-content/40">No water sources added</p>}
            </div>

            <div className="divider text-xs text-base-content/40 my-1">Military Bases</div>
            <div className="space-y-2">
              {militaryBases.map((item, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <input type="text" placeholder="e.g. Naval Station Great Lakes" value={item.name}
                    onChange={e => updateMilitaryBase(i, 'name', e.target.value)}
                    className="input input-bordered input-sm flex-1 min-w-[200px]" disabled={!isAdmin} />
                  <input type="number" placeholder="Miles" value={item.distance}
                    onChange={e => updateMilitaryBase(i, 'distance', e.target.value)}
                    className="input input-bordered input-sm w-24" disabled={!isAdmin} />
                  <span className="text-sm text-base-content/50">miles</span>
                  {isAdmin && <button className="btn btn-xs btn-ghost text-error" onClick={() => removeMilitaryBase(i)}>✕</button>}
                </div>
              ))}
              {isAdmin && <button className="btn btn-xs btn-outline" onClick={addMilitaryBase}>+ Add Military Base</button>}
              {militaryBases.length === 0 && <p className="text-sm text-base-content/40">No military bases added</p>}
            </div>

            {/* Demographics */}
            <div className="divider text-xs text-base-content/40 my-1">Demographics</div>
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


        {/* Financials tab */}
        {tab === 'financials' && (
          <div className="space-y-4">
              {/* Investment metrics */}
              <div className="space-y-3 pt-2">
                <div className={`${sectionHeaderClass} text-emerald-700 border-emerald-200`}>Investment Metrics</div>
                {/* GRM = Price / Gross Scheduled Rent */}
                <Field label="GRM" help={FIELD_HELP.grm}>
                  <input readOnly
                    value={price !== '' && grossScheduledRent !== '' && Number(grossScheduledRent) > 0
                      ? (Number(price) / Number(grossScheduledRent)).toFixed(2) : '—'}
                    className={financialOutputClass} />
                </Field>
                {/* Cap Rate = NOI / Price */}
                <Field label="Cap Rate (%)" help={FIELD_HELP.capRate}>
                  <input readOnly value={capRateFromEngine !== null ? `${capRateFromEngine.toFixed(2)}%` : '—'} className={financialOutputClass} />
                </Field>
                {/* Cash-on-Cash = (NOI - Debt Service) / Equity */}
                <Field label="Cash-on-Cash (%)" help={FIELD_HELP.cashOnCash}>
                  <input readOnly value={cashOnCashFromEngine !== null ? `${cashOnCashFromEngine.toFixed(2)}%` : '—'} className={`input input-bordered input-md w-full md:text-base font-semibold ${cashOnCashTone}`} />
                </Field>
                <Field label="Levered IRR (%)" help={FIELD_HELP.leveredIrr}>
                  <input readOnly
                    value={leveredIrr !== null ? `${(leveredIrr * 100).toFixed(2)}%` : '—'}
                    className={`input input-bordered input-md w-full md:text-base font-semibold ${irrTone}`} />
                </Field>
                <Field label="Unlevered IRR (%)" help={FIELD_HELP.unleveredIrr}>
                  <input readOnly
                    value={unleveredIrr !== null ? `${(unleveredIrr * 100).toFixed(2)}%` : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Levered EMx" help={FIELD_HELP.leveredEmx}>
                  <input readOnly
                    value={leveredEquityMultiple !== null ? `${leveredEquityMultiple.toFixed(2)}x` : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Unlevered EMx" help={FIELD_HELP.unleveredEmx}>
                  <input readOnly
                    value={unleveredEquityMultiple !== null ? `${unleveredEquityMultiple.toFixed(2)}x` : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Levered NPV ($)" help={FIELD_HELP.leveredNpv}>
                  <input readOnly
                    value={leveredNpv !== null ? '$' + leveredNpv.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Unlevered NPV ($)" help={FIELD_HELP.unleveredNpv}>
                  <input readOnly
                    value={unleveredNpv !== null ? '$' + unleveredNpv.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="NPV Discount Rate (%)" help={FIELD_HELP.discountRate}>
                  <NumericInput placeholder="e.g. 10.0" value={irr} onChange={setIrr}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                {/* Price/Unit = Price / Unit Count */}
                <Field label="Price / Unit ($)" help={FIELD_HELP.pricePerUnit}>
                  <input readOnly
                    value={price !== '' && unitCount !== '' && Number(unitCount) > 0
                      ? '$' + (Number(price) / Number(unitCount)).toLocaleString(undefined, {maximumFractionDigits:0}) : '—'}
                    className={financialOutputClass} />
                </Field>
                {/* Price/SqFt = Price / SqFt */}
                <Field label="Price / Sq Ft ($)" help={FIELD_HELP.pricePerSqft}>
                  <input readOnly
                    value={price !== '' && sqft !== '' && Number(sqft) > 0
                      ? '$' + (Number(price) / Number(sqft)).toFixed(2) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Rent-to-Sales (%)" help={FIELD_HELP.rentToSales}>
                  <input readOnly
                    value={derivedRentToSales !== null ? `${derivedRentToSales.toFixed(2)}%` : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="# SKUs" help={FIELD_HELP.numSkus}>
                  <NumericInput placeholder="e.g. 500" value={numSkus} onChange={setNumSkus}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                {/* Price/Acre = Price / Lot Size */}
                <Field label="Price / Acre ($)" help={FIELD_HELP.pricePerAcre}>
                  <input readOnly
                    value={price !== '' && lot !== '' && Number(lot) > 0
                      ? '$' + (Number(price) / Number(lot)).toLocaleString(undefined, {maximumFractionDigits:0}) : '—'}
                    className={financialOutputClass} />
                </Field>
              </div>

              {/* Operating */}
              <div className="space-y-3 pt-2">
                <div className={`${sectionHeaderClass} text-amber-700 border-amber-200`}>Operating</div>
                <Field label="Management Fee (%)" help={FIELD_HELP.managementFeePct}>
                  <NumericInput placeholder="e.g. 8" value={managementFeePct} onChange={setManagementFeePct}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Management Fee ($/yr)" help={FIELD_HELP.managementFeeDollar}>
                  <input readOnly value={firstYearDcf ? '$' + (parseNum(firstYearDcf.managementFeesDcf) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Insurance ($/yr)" help={FIELD_HELP.insurance}>
                  <NumericInput placeholder="e.g. 12000" value={insurance} onChange={setInsurance}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Property Taxes ($/yr)" help={FIELD_HELP.propertyTaxes}>
                  <NumericInput placeholder="e.g. 18000" value={propertyTaxes} onChange={setPropertyTaxes}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Adjusted NOI ($/yr)" help={FIELD_HELP.adjustedNoi}>
                  <input readOnly
                    value={adjustedNoiValue !== null ? '$' + adjustedNoiValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
              </div>

              {/* Income */}
              <div className="space-y-3 pt-2">
                <div className={`${sectionHeaderClass} text-sky-700 border-sky-200`}>Income</div>
                <Field label="Gross Scheduled Rent ($/yr)" help={FIELD_HELP.grossScheduledRent}>
                  <NumericInput placeholder="e.g. 120000" value={grossScheduledRent} onChange={setGrossScheduledRent}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Vacancy / Credit Loss (%)" help={FIELD_HELP.vacancyRate}>
                  <NumericInput placeholder="e.g. 5" value={vacancyRate} onChange={setVacancyRate}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="EGI — Effective Gross Income ($/yr)" help={FIELD_HELP.egi}>
                  <input readOnly
                    value={egiAmount !== null ? '$' + egiAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Other Income ($/yr)" help={FIELD_HELP.otherIncome}>
                  <NumericInput placeholder="parking, RUBS, storage" value={otherIncome} onChange={setOtherIncome}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Operating Expenses ($/yr)" help={FIELD_HELP.operatingExpenses}>
                  <NumericInput placeholder="e.g. 40000" value={operatingExpenses} onChange={setOperatingExpenses}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Reserves / Replacement Capex ($/yr)" help={FIELD_HELP.reservesCapex}>
                  <NumericInput placeholder="e.g. 5000" value={reservesCapex} onChange={setReservesCapex}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="NOI — Net Operating Income ($/yr)" help={FIELD_HELP.adjustedNoi}>
                  <input readOnly
                    value={adjustedNoiValue !== null ? '$' + adjustedNoiValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
              </div>

              {/* Equity / Returns */}
              <div className="space-y-3 pt-2">
                <div className={`${sectionHeaderClass} text-emerald-700 border-emerald-200`}>Equity / Returns</div>
                <Field label="Equity ($)" help={FIELD_HELP.equity}>
                  <input readOnly
                    value={price !== '' && loanAmount !== ''
                      ? '$' + (Number(price) + Number(closingCosts || 0) - Number(loanAmount)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="DSCR" help={FIELD_HELP.dscr}>
                  <input readOnly value={dscrFromEngine !== null ? dscrFromEngine.toFixed(2) : '—'} className={`input input-bordered input-md w-full md:text-base font-semibold ${dscrTone}`} />
                </Field>
                <Field label="Debt Yield (%)" help={FIELD_HELP.debtYield}>
                  <input readOnly
                    value={debtYield !== null ? `${debtYield.toFixed(2)}%` : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Yield on Cost (%)" help={FIELD_HELP.yieldOnCost}>
                  <input readOnly
                    value={yieldOnCost !== null ? `${yieldOnCost.toFixed(2)}%` : '—'}
                    className={financialOutputClass} />
                </Field>
              </div>

              {/* Debt */}
              <div className="space-y-3 pt-2">
                <div className={`${sectionHeaderClass} text-indigo-700 border-indigo-200`}>Debt</div>
                <Field label="Loan Amount ($)" help={FIELD_HELP.loanAmount}>
                  <NumericInput placeholder="e.g. 750000" value={loanAmount} onChange={setLoanAmount}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="LTV (%)" help={FIELD_HELP.ltv}>
                  <input readOnly
                    value={derivedLtv !== null ? `${derivedLtv.toFixed(2)}%` : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Interest Rate (%)" help={FIELD_HELP.interestRate}>
                  <NumericInput placeholder="e.g. 6.5" value={interestRate} onChange={setInterestRate}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Amortization Term (yrs)" help={FIELD_HELP.amortTerm}>
                  <NumericInput placeholder="e.g. 25" value={amortizationTerm} onChange={setAmortizationTerm}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Interest-Only Period (yrs)" help={FIELD_HELP.ioPeriod}>
                  <NumericInput placeholder="e.g. 3" value={interestOnlyPeriod} onChange={setInterestOnlyPeriod}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Initial Loan Term (yrs)" help={FIELD_HELP.loanTerm}>
                  <NumericInput placeholder="e.g. 5" value={dcfModel.debtTerms.initialLoanTermYears} onChange={(value) => updateDebtTermField('initialLoanTermYears', value)}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <label className="label cursor-pointer justify-start gap-3">
                  <input type="checkbox" className="checkbox checkbox-sm"
                    checked={!!dcfModel.debtTerms.floatingRate}
                    onChange={(e) => updateDebtTermField('floatingRate', e.target.checked)}
                    disabled={!isAdmin} />
                  <span className="label-text">Floating-rate loan</span>
                </label>
                <Field label="SOFR / Index Rate (%)" help={FIELD_HELP.sofrRate}>
                  <NumericInput value={dcfModel.debtTerms.sofrRatePct} onChange={(value) => updateDebtTermField('sofrRatePct', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Index Spread (%)" help={FIELD_HELP.indexSpread}>
                  <NumericInput value={dcfModel.debtTerms.indexSpreadPct} onChange={(value) => updateDebtTermField('indexSpreadPct', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Rate Cap (%)" help={FIELD_HELP.rateCap}>
                  <NumericInput value={dcfModel.debtTerms.rateCapPct} onChange={(value) => updateDebtTermField('rateCapPct', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Rate Floor (%)" help={FIELD_HELP.rateFloor}>
                  <NumericInput value={dcfModel.debtTerms.rateFloorPct} onChange={(value) => updateDebtTermField('rateFloorPct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Interest Reserve (months)" help={FIELD_HELP.interestReserve}>
                  <NumericInput value={dcfModel.debtTerms.interestReserveMonths} onChange={(value) => updateDebtTermField('interestReserveMonths', value)}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Refi Loan Term (yrs)" help={FIELD_HELP.refiLoanTerm}>
                  <NumericInput placeholder="e.g. 5" value={dcfModel.debtTerms.refinanceLoanTermYears} onChange={(value) => updateDebtTermField('refinanceLoanTermYears', value)}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Annual Debt Service ($/yr)" help={FIELD_HELP.annualDebtService}>
                  <input readOnly
                    value={annualDebtServiceAmount !== null ? '$' + annualDebtServiceAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
              </div>

              {/* Tax & Cost Segregation */}
              <div className="space-y-3 pt-2">
                <div className={`${sectionHeaderClass} text-rose-700 border-rose-200`}>Tax &amp; Cost Segregation</div>
                <Field label="Land Value (%)" help={FIELD_HELP.landValuePct}>
                  <NumericInput placeholder="e.g. 20" value={landValuePct} onChange={setLandValuePct}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Depreciable Basis ($)" help={FIELD_HELP.depreciableBasis}>
                  <input readOnly
                    value={price !== '' && landValuePct !== ''
                      ? '$' + (Number(price) * (1 - Number(landValuePct) / 100)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Cost Seg Bonus (%)" help={FIELD_HELP.costSegBonus}>
                  <NumericInput placeholder="e.g. 30" value={costSegBonusPct} onChange={setCostSegBonusPct}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Year 1 Bonus Depreciation ($)" help={FIELD_HELP.bonusDepreciation}>
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const val = depBasis !== null && costSegBonusPct !== ''
                      ? '$' + (depBasis * Number(costSegBonusPct) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className={financialOutputClass} />
                  })()}
                </Field>
                <Field label="Standard Depreciation / 39-yr ($)" help={FIELD_HELP.standardDepreciation}>
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const bonus = costSegBonusPct !== '' ? Number(costSegBonusPct) / 100 : 0
                    const val = depBasis !== null ? '$' + (depBasis * (1 - bonus) / 39).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className={financialOutputClass} />
                  })()}
                </Field>
                <Field label="Total Year 1 Depreciation ($)" help={FIELD_HELP.totalDepreciation}>
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const bonus = costSegBonusPct !== '' ? Number(costSegBonusPct) / 100 : 0
                    const totalDepr = depBasis !== null ? depBasis * bonus + depBasis * (1 - bonus) / 39 : null
                    return <input readOnly value={totalDepr !== null ? '$' + totalDepr.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                      className={financialOutputClass} />
                  })()}
                </Field>
                <Field label="Effective Tax Rate (%)" help={FIELD_HELP.effectiveTaxRate}>
                  <NumericInput placeholder="e.g. 37" value={effectiveTaxRate} onChange={setEffectiveTaxRate}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Capital Gains Tax Rate (%)" help={FIELD_HELP.capitalGainsTaxRate}>
                  <NumericInput value={dcfModel.taxModel.capitalGainsRatePct} onChange={(value) => updateTaxModelField('capitalGainsRatePct', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Ordinary Income Tax Rate (%)" help={FIELD_HELP.ordinaryIncomeTaxRate}>
                  <NumericInput value={dcfModel.taxModel.ordinaryIncomeTaxRatePct} onChange={(value) => updateTaxModelField('ordinaryIncomeTaxRatePct', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Passive Loss Usage Limit (%)" help={FIELD_HELP.passiveLossLimit}>
                  <NumericInput value={dcfModel.taxModel.passiveLossLimitPct} onChange={(value) => updateTaxModelField('passiveLossLimitPct', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Initial Tax Basis ($)" help={FIELD_HELP.initialTaxBasis}>
                  <NumericInput value={dcfModel.taxModel.initialTaxBasis} onChange={(value) => updateTaxModelField('initialTaxBasis', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Suspended Loss Carryforward ($)" help={FIELD_HELP.startingLoss}>
                  <NumericInput value={dcfModel.taxModel.suspendedLossCarryforward} onChange={(value) => updateTaxModelField('suspendedLossCarryforward', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Tax Shield Year 1 ($)" help={FIELD_HELP.taxShield}>
                  {(() => {
                    const depBasis = price !== '' && landValuePct !== '' ? Number(price) * (1 - Number(landValuePct) / 100) : null
                    const bonus = costSegBonusPct !== '' ? Number(costSegBonusPct) / 100 : 0
                    const totalDepr = depBasis !== null ? depBasis * bonus + depBasis * (1 - bonus) / 39 : null
                    const val = totalDepr !== null && effectiveTaxRate !== ''
                      ? '$' + (totalDepr * Number(effectiveTaxRate) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className={financialOutputClass} />
                  })()}
                </Field>
                <Field label="Depreciation Recapture Rate (%)" help={FIELD_HELP.deprecRecapture}>
                  <NumericInput placeholder="e.g. 25" value={depreciationRecaptureRate} onChange={setDepreciationRecaptureRate}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Installment Sale Deferral (%)" help={FIELD_HELP.installmentSale}>
                  <NumericInput value={dcfModel.taxModel.installmentSalePct} onChange={(value) => updateTaxModelField('installmentSalePct', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Entity Type" help={FIELD_HELP.entityType}>
                  <select value={dcfModel.taxModel.entityType} onChange={(e) => updateTaxModelField('entityType', e.target.value)}
                    className="select select-bordered input-md w-full md:text-base border-rose-300 bg-rose-50/40 text-rose-900" disabled={!isAdmin}>
                    <option value="Direct">Direct</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </Field>
                <label className="label cursor-pointer justify-start gap-3">
                  <input type="checkbox" className="checkbox checkbox-sm"
                    checked={!!dcfModel.taxModel.enable1031}
                    onChange={(e) => updateTaxModelField('enable1031', e.target.checked)}
                    disabled={!isAdmin} />
                  <span className="label-text">Apply 1031 exchange deferral on sale</span>
                </label>
                <Field label="Recapture Tax on Exit ($)" help={FIELD_HELP.recaptureTax}>
                  {(() => {
                    const val = holdYearDcf ? '$' + (parseNum(holdYearDcf.recaptureTaxDcf) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className={financialOutputClass} />
                  })()}
                </Field>
                <Field label="Capital Gains Tax on Exit ($)" help={FIELD_HELP.capitalGainsTax}>
                  {(() => {
                    const val = holdYearDcf ? '$' + (parseNum(holdYearDcf.capitalGainsTaxDcf) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'
                    return <input readOnly value={val} className={financialOutputClass} />
                  })()}
                </Field>
              </div>

              {/* Exit / Reversion */}
              <div className="space-y-3 pt-2">
                <div className={`${sectionHeaderClass} text-violet-700 border-violet-200`}>Exit / Reversion</div>
                <Field label="Refi LTV (%)" help={FIELD_HELP.refiLtv}>
                  <NumericInput placeholder="e.g. 70" value={refiLtv} onChange={setRefiLtv}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Refi Interest Rate (%)" help={FIELD_HELP.refiRate}>
                  <NumericInput placeholder="e.g. 6.0" value={refiRate} onChange={setRefiRate}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Refi Year" help={FIELD_HELP.refiYear}>
                  <NumericInput placeholder="e.g. 3" value={refiYear} onChange={setRefiYear}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Refi Month" help={FIELD_HELP.refiMonth}>
                  <NumericInput placeholder="1-12" value={dcfModel.timing.refiMonth} onChange={(value) => updateTimingField('refiMonth', value)}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Refi Cost (%)" help={FIELD_HELP.refiCost}>
                  <NumericInput placeholder="e.g. 1.0" value={dcfModel.debtTerms.refinanceCostPct} onChange={(value) => updateDebtTermField('refinanceCostPct', value)}
                    className={financialInputClass} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Exit Value ($)" help={FIELD_HELP.exitValue}>
                  <input readOnly
                    value={exitValueAmount !== null ? '$' + exitValueAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Net Sale Proceeds ($)" help={FIELD_HELP.netSaleProceeds}>
                  <input readOnly
                    value={netSaleProceedsAmount !== null ? '$' + netSaleProceedsAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Loan Balance at Exit ($)" help={FIELD_HELP.loanBalanceAtExit}>
                  <input readOnly
                    value={loanBalanceAtExitAmount !== null ? '$' + loanBalanceAtExitAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
                <Field label="Net Equity on Exit ($)" help={FIELD_HELP.netEquityOnExit}>
                  <input readOnly
                    value={netEquityOnExitAmount !== null ? '$' + netEquityOnExitAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                    className={financialOutputClass} />
                </Field>
              </div>

              {/* Deal */}
              <div className="space-y-3 pt-2">
                <div className={`${sectionHeaderClass} text-violet-700 border-violet-200`}>Deal</div>
                <Field label="Closing Costs ($)" help={FIELD_HELP.closingCosts}>
                  <NumericInput placeholder="e.g. 25000" value={closingCosts} onChange={setClosingCosts}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Hold Period (yrs)" help={FIELD_HELP.holdPeriod}>
                  <NumericInput placeholder="e.g. 7" value={holdPeriod} onChange={setHoldPeriod}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Sale Month" help={FIELD_HELP.saleMonth}>
                  <NumericInput placeholder="1-12" value={dcfModel.timing.saleMonth} onChange={(value) => updateTimingField('saleMonth', value)}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Rent Growth (% / yr)" help={FIELD_HELP.rentGrowth}>
                  <NumericInput placeholder="e.g. 3" value={rentGrowth} onChange={setRentGrowth}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Expense Growth (% / yr)" help={FIELD_HELP.expenseGrowth}>
                  <NumericInput placeholder="e.g. 2" value={expenseGrowth} onChange={setExpenseGrowth}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
                <Field label="Exit Cap Rate (%)" help={FIELD_HELP.exitCapRate}>
                  <NumericInput placeholder="e.g. 6.5" value={exitCapRate} onChange={setExitCapRate}
                    className={`${financialInputClass} border-amber-300 bg-amber-50/70 text-amber-900`} disabled={!isAdmin} />
                </Field>
                <Field label="Cost of Sale (%)" help={FIELD_HELP.costOfSale}>
                  <NumericInput placeholder="e.g. 2" value={costOfSale} onChange={setCostOfSale}
                    className={financialInputClass} disabled={!isAdmin} />
                </Field>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Model Governance</div>
                <label className="label cursor-pointer justify-start gap-3">
                  <input type="checkbox" className="checkbox checkbox-sm" checked={!!dcfModel.governance.inputsLocked}
                    onChange={(e) => updateGovernanceField('inputsLocked', e.target.checked)} disabled={!isAdmin} />
                  <span className="label-text">Lock manual inputs</span>
                </label>
                <label className="label cursor-pointer justify-start gap-3">
                  <input type="checkbox" className="checkbox checkbox-sm" checked={!!dcfModel.governance.formulasLocked}
                    onChange={(e) => updateGovernanceField('formulasLocked', e.target.checked)} disabled={!isAdmin} />
                  <span className="label-text">Lock formulas / engine outputs</span>
                </label>
                <label className="label cursor-pointer justify-start gap-3">
                  <input type="checkbox" className="checkbox checkbox-sm" checked={!!dcfModel.governance.overridesEnabled}
                    onChange={(e) => updateGovernanceField('overridesEnabled', e.target.checked)} disabled={!isAdmin} />
                  <span className="label-text">Allow assumption overrides</span>
                </label>
                <Field label="Diagnostic Mode" help={FIELD_HELP.diagnosticLevel}>
                  <select value={dcfModel.governance.diagnosticLevel} onChange={(e) => updateGovernanceField('diagnosticLevel', e.target.value)}
                    className="select select-bordered input-md w-full md:text-base" disabled={!isAdmin}>
                    <option value="strict">Strict</option>
                    <option value="warning">Warning only</option>
                    <option value="informational">Informational</option>
                  </select>
                </Field>
                <Field label="Override Memo" help={FIELD_HELP.overrideNote}>
                  <textarea value={dcfModel.governance.overrideNote} onChange={(e) => updateGovernanceField('overrideNote', e.target.value)}
                    className="textarea textarea-bordered min-h-24 w-full md:text-base" disabled={!isAdmin}
                    placeholder="Explain why non-default assumptions or manual overrides were used." />
                </Field>
                <div className="rounded-xl border border-base-300 bg-base-100 p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${governanceDiagnostics.summary.hasErrors ? 'badge-error' : governanceDiagnostics.summary.hasWarnings ? 'badge-warning' : 'badge-success'}`}>
                      {governanceDiagnostics.summary.hasErrors ? 'Errors present' : governanceDiagnostics.summary.hasWarnings ? 'Warnings present' : 'No broken states'}
                    </span>
                    <span className="badge badge-outline">{governanceDiagnostics.summary.overrideCount} override{governanceDiagnostics.summary.overrideCount === 1 ? '' : 's'}</span>
                  </div>
                  <div className="space-y-2">
                    {governanceDiagnostics.issues.length === 0 ? (
                      <div className="text-sm text-base-content/60">No lease timing or cash flow state conflicts detected.</div>
                    ) : governanceDiagnostics.issues.map((issue, index) => (
                      <div key={`governance-issue-${index}`} className={`rounded-lg border px-3 py-2 text-sm ${issue.severity === 'error' ? 'border-error/30 bg-error/10 text-error-content' : 'border-warning/30 bg-warning/10 text-warning-content'}`}>
                        <div className="font-semibold">{issue.scope}</div>
                        <div>{issue.message}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">Override Inventory</div>
                    {governanceDiagnostics.overrides.length === 0 ? (
                      <div className="text-sm text-base-content/60">No non-default assumptions detected.</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {governanceDiagnostics.overrides.map((override, index) => (
                          <div key={`override-${index}`} className="rounded-lg border border-base-300 bg-base-200/40 px-3 py-2 text-sm">
                            <span className="font-semibold">{override.section}.{override.field}</span>: {String(override.value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Lease Economics</div>
                <Field label="Market Rent Growth (% / yr)" help={FIELD_HELP.marketRentGrowth}>
                  <NumericInput value={dcfModel.leaseEconomics.marketRentGrowthPct} onChange={(value) => updateLeaseEconomicsField('marketRentGrowthPct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="New Lease Spread (%)" help={FIELD_HELP.newLeaseSpread}>
                  <NumericInput value={dcfModel.leaseEconomics.newLeaseSpreadPct} onChange={(value) => updateLeaseEconomicsField('newLeaseSpreadPct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Renewal Spread (%)" help={FIELD_HELP.renewalSpread}>
                  <NumericInput value={dcfModel.leaseEconomics.renewalSpreadPct} onChange={(value) => updateLeaseEconomicsField('renewalSpreadPct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="TI per SF ($)" help={FIELD_HELP.tiPerSf}>
                  <NumericInput value={dcfModel.leaseEconomics.tenantImprovementPerSf} onChange={(value) => updateLeaseEconomicsField('tenantImprovementPerSf', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="LC (% of Rent)" help={FIELD_HELP.lcPct}>
                  <NumericInput value={dcfModel.leaseEconomics.leasingCommissionPct} onChange={(value) => updateLeaseEconomicsField('leasingCommissionPct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Expense Stop ($/SF)" help={FIELD_HELP.expenseStopPerSf}>
                  <NumericInput value={dcfModel.leaseEconomics.expenseStopPerSf} onChange={(value) => updateLeaseEconomicsField('expenseStopPerSf', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Gross-Up Occupancy (%)" help={FIELD_HELP.grossUpPct}>
                  <NumericInput value={dcfModel.leaseEconomics.grossUpPct} onChange={(value) => updateLeaseEconomicsField('grossUpPct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="CAM Admin Fee (%)" help={FIELD_HELP.camAdminFee}>
                  <NumericInput value={dcfModel.leaseEconomics.camAdminFeePct} onChange={(value) => updateLeaseEconomicsField('camAdminFeePct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Controllable Expense Share (%)" help={FIELD_HELP.controllableExpensePct}>
                  <NumericInput value={dcfModel.leaseEconomics.controllableExpensePct} onChange={(value) => updateLeaseEconomicsField('controllableExpensePct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Controllable Cap (%)" help={FIELD_HELP.controllableCapPct}>
                  <NumericInput value={dcfModel.leaseEconomics.controllableCapPct} onChange={(value) => updateLeaseEconomicsField('controllableCapPct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Non-Recoverable Expense (%)" help={FIELD_HELP.nonRecoverablePct}>
                  <NumericInput value={dcfModel.leaseEconomics.nonRecoverableExpensePct} onChange={(value) => updateLeaseEconomicsField('nonRecoverableExpensePct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="CAM Pool Recoverable (%)" help={FIELD_HELP.camPoolRecoverable}>
                  <NumericInput value={dcfModel.leaseEconomics.camPoolRecoverablePct} onChange={(value) => updateLeaseEconomicsField('camPoolRecoverablePct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Tax Pool Recoverable (%)" help={FIELD_HELP.taxPoolRecoverable}>
                  <NumericInput value={dcfModel.leaseEconomics.taxPoolRecoverablePct} onChange={(value) => updateLeaseEconomicsField('taxPoolRecoverablePct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Insurance Pool Recoverable (%)" help={FIELD_HELP.insurancePoolRecoverable}>
                  <NumericInput value={dcfModel.leaseEconomics.insurancePoolRecoverablePct} onChange={(value) => updateLeaseEconomicsField('insurancePoolRecoverablePct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Gross-Up Method" help={FIELD_HELP.recoveryMethod}>
                  <select value={dcfModel.leaseEconomics.grossUpMethod} onChange={(e) => updateLeaseEconomicsField('grossUpMethod', e.target.value)}
                    className="select select-bordered input-md w-full md:text-base" disabled={!isAdmin}>
                    <option value="category">By category</option>
                    <option value="occupied">Occupied ratio</option>
                  </select>
                </Field>
                <Field label="Reconciliation Month" help={FIELD_HELP.reconciliationMonth}>
                  <NumericInput value={dcfModel.leaseEconomics.reconciliationMonth} onChange={(value) => updateLeaseEconomicsField('reconciliationMonth', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                </Field>
              </div>

              {/* Tenant — retail / percentage-rent only */}
              {(assetType === 'Retail' || assetType === 'Net Lease' || assetType === '') && (
                <div className="space-y-3 pt-2">
                  <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Tenant</div>
                  <Field label="Tenant Annual Gross Sales ($)" help={FIELD_HELP.tenantGrossSales}>
                    <NumericInput placeholder="e.g. 1200000" value={tenantGrossSales} onChange={setTenantGrossSales}
                      className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                  </Field>
                  <Field label="Tenant Base Rent ($/yr)" help={FIELD_HELP.tenantBaseRent}>
                    <NumericInput placeholder="e.g. 60000" value={tenantBaseRent} onChange={setTenantBaseRent}
                      className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                  </Field>
                  <Field label="Rent-to-Sales Ratio (%)" help={FIELD_HELP.rentToSalesRatio}>
                    <input readOnly
                      value={tenantGrossSales !== '' && tenantBaseRent !== '' && Number(tenantGrossSales) > 0 ? (Number(tenantBaseRent) / Number(tenantGrossSales) * 100).toFixed(2) + '%' : '—'}
                      className="input input-bordered input-md w-full md:text-base cursor-default" style={{color:'#000', fontWeight:700}} />
                  </Field>
                  <div className="pt-2">
                    <div className="flex items-center justify-between pb-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">Tenant Rent Roll</div>
                      {isAdmin && <button type="button" className="btn btn-xs btn-outline" onClick={addRentRollRow}>Add Tenant</button>}
                    </div>
                    <div className="space-y-3">
                      {dcfModel.rentRoll.map((tenant, index) => (
                        <div key={`tenant-${index}`} className="rounded-xl border border-base-300 p-3 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">Tenant {index + 1}</div>
                            {isAdmin && dcfModel.rentRoll.length > 1 && (
                              <button type="button" className="btn btn-xs btn-ghost text-error" onClick={() => removeRentRollRow(index)}>Remove</button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="Tenant Name" help={FIELD_HELP.tenantName}>
                              <input value={tenant.tenantName} onChange={(e) => updateRentRollRow(index, 'tenantName', e.target.value)}
                                className="input input-bordered input-md w-full md:text-base" disabled={!isAdmin} />
                            </Field>
                            <Field label="Suite" help={FIELD_HELP.suite}>
                              <input value={tenant.suite} onChange={(e) => updateRentRollRow(index, 'suite', e.target.value)}
                                className="input input-bordered input-md w-full md:text-base" disabled={!isAdmin} />
                            </Field>
                            <Field label="Annual Rent ($)" help={FIELD_HELP.annualRent}>
                              <NumericInput value={tenant.annualRent} onChange={(value) => updateRentRollRow(index, 'annualRent', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Annual Sales ($)" help={FIELD_HELP.annualSales}>
                              <NumericInput value={tenant.annualSales} onChange={(value) => updateRentRollRow(index, 'annualSales', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Lease Start Year" help={FIELD_HELP.leaseStartYear}>
                              <NumericInput value={tenant.leaseStartYear} onChange={(value) => updateRentRollRow(index, 'leaseStartYear', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Lease Start Month" help={FIELD_HELP.leaseStartMonth}>
                              <NumericInput value={tenant.leaseStartMonth} onChange={(value) => updateRentRollRow(index, 'leaseStartMonth', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Lease End Year" help={FIELD_HELP.leaseEndYear}>
                              <NumericInput value={tenant.leaseEndYear} onChange={(value) => updateRentRollRow(index, 'leaseEndYear', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Lease End Month" help={FIELD_HELP.leaseEndMonth}>
                              <NumericInput value={tenant.leaseEndMonth} onChange={(value) => updateRentRollRow(index, 'leaseEndMonth', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Annual Rent Bumps (%)" help={FIELD_HELP.annualRentBumps}>
                              <NumericInput value={tenant.rentBumpsPct} onChange={(value) => updateRentRollRow(index, 'rentBumpsPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Market Rent ($/SF)" help={FIELD_HELP.marketRentPerSf}>
                              <NumericInput value={tenant.marketRentPsf} onChange={(value) => updateRentRollRow(index, 'marketRentPsf', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="New Lease Spread (%)" help={FIELD_HELP.newLeaseSpread}>
                              <NumericInput value={tenant.newLeaseSpreadPct} onChange={(value) => updateRentRollRow(index, 'newLeaseSpreadPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Renewal Spread (%)" help={FIELD_HELP.renewalSpread}>
                              <NumericInput value={tenant.renewalSpreadPct} onChange={(value) => updateRentRollRow(index, 'renewalSpreadPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Renewal Probability (%)" help={FIELD_HELP.renewalProbability}>
                              <NumericInput value={tenant.renewalProbabilityPct} onChange={(value) => updateRentRollRow(index, 'renewalProbabilityPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Downtime (months)" help={FIELD_HELP.downtime}>
                              <NumericInput value={tenant.downtimeMonths} onChange={(value) => updateRentRollRow(index, 'downtimeMonths', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Extension Option (months)" help={FIELD_HELP.extensionOption}>
                              <NumericInput value={tenant.extensionOptionMonths} onChange={(value) => updateRentRollRow(index, 'extensionOptionMonths', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Expansion SF" help={FIELD_HELP.expansionSf}>
                              <NumericInput value={tenant.expansionSf} onChange={(value) => updateRentRollRow(index, 'expansionSf', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Contraction SF" help={FIELD_HELP.contractionSf}>
                              <NumericInput value={tenant.contractionSf} onChange={(value) => updateRentRollRow(index, 'contractionSf', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Termination Month Index" help={FIELD_HELP.terminationMonth}>
                              <NumericInput value={tenant.terminationMonth} onChange={(value) => updateRentRollRow(index, 'terminationMonth', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="Purchase Option Price ($)" help={FIELD_HELP.purchaseOption}>
                              <NumericInput value={tenant.purchaseOptionPrice} onChange={(value) => updateRentRollRow(index, 'purchaseOptionPrice', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                            </Field>
                            <Field label="TI per SF ($)" help={FIELD_HELP.tiPerSf}>
                              <NumericInput value={tenant.tenantImprovementPerSf} onChange={(value) => updateRentRollRow(index, 'tenantImprovementPerSf', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Renewal TI per SF ($)" help={FIELD_HELP.tiPerSf}>
                              <NumericInput value={tenant.renewalTiPerSf} onChange={(value) => updateRentRollRow(index, 'renewalTiPerSf', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="New Lease TI per SF ($)" help={FIELD_HELP.tiPerSf}>
                              <NumericInput value={tenant.newLeaseTiPerSf} onChange={(value) => updateRentRollRow(index, 'newLeaseTiPerSf', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="LC (% of Rent)" help={FIELD_HELP.lcPct}>
                              <NumericInput value={tenant.leasingCommissionPct} onChange={(value) => updateRentRollRow(index, 'leasingCommissionPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Renewal LC (%)" help={FIELD_HELP.lcPct}>
                              <NumericInput value={tenant.renewalLcPct} onChange={(value) => updateRentRollRow(index, 'renewalLcPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="New Lease LC (%)" help={FIELD_HELP.lcPct}>
                              <NumericInput value={tenant.newLeaseLcPct} onChange={(value) => updateRentRollRow(index, 'newLeaseLcPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Expense Stop ($/SF)" help={FIELD_HELP.expenseStopPerSf}>
                              <NumericInput value={tenant.expenseStopPerSf} onChange={(value) => updateRentRollRow(index, 'expenseStopPerSf', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Gross-Up Occupancy (%)" help={FIELD_HELP.grossUpPct}>
                              <NumericInput value={tenant.grossUpPct} onChange={(value) => updateRentRollRow(index, 'grossUpPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="% Rent Breakpoint Sales ($)" help={FIELD_HELP.percentRentBreakpoint}>
                              <NumericInput value={tenant.breakpointSales} onChange={(value) => updateRentRollRow(index, 'breakpointSales', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="% Rent Rate (%)" help={FIELD_HELP.percentRentRate}>
                              <NumericInput value={tenant.percentageRentPct} onChange={(value) => updateRentRollRow(index, 'percentageRentPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Co-Tenancy Group" help={FIELD_HELP.coTenancyGroup}>
                              <input value={tenant.coTenancyGroup} onChange={(e) => updateRentRollRow(index, 'coTenancyGroup', e.target.value)}
                                className="input input-bordered input-md w-full md:text-base" disabled={!isAdmin} />
                            </Field>
                            <Field label="CAM Pool Share (%)" help={FIELD_HELP.camPoolShare}>
                              <NumericInput value={tenant.camPoolSharePct} onChange={(value) => updateRentRollRow(index, 'camPoolSharePct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Admin Fee (%)" help={FIELD_HELP.adminFeeOverride}>
                              <NumericInput value={tenant.adminFeePct} onChange={(value) => updateRentRollRow(index, 'adminFeePct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Controllable Cap (%)" help={FIELD_HELP.controllableCapPct}>
                              <NumericInput value={tenant.controllableCapPct} onChange={(value) => updateRentRollRow(index, 'controllableCapPct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                            <Field label="Non-Recoverable Expense (%)" help={FIELD_HELP.nonRecoverablePct}>
                              <NumericInput value={tenant.nonRecoverableExpensePct} onChange={(value) => updateRentRollRow(index, 'nonRecoverableExpensePct', value)}
                                className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                            </Field>
                          </div>
                          <label className="label cursor-pointer justify-start gap-3">
                            <input type="checkbox" className="checkbox checkbox-sm"
                              checked={!!tenant.anchorTenant}
                              onChange={(e) => updateRentRollRow(index, 'anchorTenant', e.target.checked)}
                              disabled={!isAdmin} />
                            <span className="label-text">Anchor tenant</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Waterfall</div>
                <Field label="Preferred Return (%)" help={FIELD_HELP.prefRate}>
                  <NumericInput value={dcfModel.waterfall.prefRate} onChange={(value) => updateWaterfallField('prefRate', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Catch-Up Share (%)" help={FIELD_HELP.catchUpRate}>
                  <NumericInput value={dcfModel.waterfall.catchUpRate} onChange={(value) => updateWaterfallField('catchUpRate', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="Promote / Sponsor Share (%)" help={FIELD_HELP.promoteRate}>
                  <NumericInput value={dcfModel.waterfall.promoteRate} onChange={(value) => updateWaterfallField('promoteRate', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="LP Equity Share (%)" help={FIELD_HELP.lpShare}>
                  <NumericInput value={dcfModel.waterfall.lpSharePct} onChange={(value) => updateWaterfallField('lpSharePct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
                <Field label="GP Equity Share (%)" help={FIELD_HELP.gpShare}>
                  <NumericInput value={dcfModel.waterfall.gpSharePct} onChange={(value) => updateWaterfallField('gpSharePct', value)}
                    className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                </Field>
              </div>
              <div className="space-y-3 pt-2">
                <div className="text-sm font-semibold uppercase tracking-wide text-base-content/50 pb-1 border-b border-base-200">Scenarios</div>
                <Field label="Active Scenario" help={FIELD_HELP.activeScenario}>
                  <select value={dcfModel.scenarioName} onChange={(e) => setDcfModel(prev => ({ ...prev, scenarioName: e.target.value }))}
                    className="select select-bordered select-md w-full md:text-base" disabled={!isAdmin}>
                    <option value="Base">Base</option>
                    <option value="Upside">Upside</option>
                    <option value="Downside">Downside</option>
                  </select>
                </Field>
                {['base', 'upside', 'downside'].map((scenarioKey) => (
                  <div key={scenarioKey} className="rounded-xl border border-base-300 p-3 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-base-content/40">{dcfModel.scenarios[scenarioKey].label}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Rent Growth (% / yr)" help={FIELD_HELP.scenarioRentGrowth}>
                        <NumericInput value={dcfModel.scenarios[scenarioKey].rentGrowth} onChange={(value) => updateScenarioField(scenarioKey, 'rentGrowth', value)}
                          className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                      </Field>
                      <Field label="Expense Growth (% / yr)" help={FIELD_HELP.scenarioExpenseGrowth}>
                        <NumericInput value={dcfModel.scenarios[scenarioKey].expenseGrowth} onChange={(value) => updateScenarioField(scenarioKey, 'expenseGrowth', value)}
                          className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                      </Field>
                      <Field label="Exit Cap Rate (%)" help={FIELD_HELP.scenarioExitCapRate}>
                        <NumericInput value={dcfModel.scenarios[scenarioKey].exitCapRate} onChange={(value) => updateScenarioField(scenarioKey, 'exitCapRate', value)}
                          className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                      </Field>
                      <Field label="Vacancy Rate (%)" help={FIELD_HELP.scenarioVacancyRate}>
                        <NumericInput value={dcfModel.scenarios[scenarioKey].vacancyRate} onChange={(value) => updateScenarioField(scenarioKey, 'vacancyRate', value)}
                          className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                      </Field>
                      <Field label="Loan Amount ($)" help={FIELD_HELP.scenarioLoanAmount}>
                        <NumericInput value={dcfModel.scenarios[scenarioKey].loanAmount} onChange={(value) => updateScenarioField(scenarioKey, 'loanAmount', value)}
                          className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} />
                      </Field>
                      <Field label="Hold Period (yrs)" help={FIELD_HELP.scenarioHoldPeriod}>
                        <NumericInput value={dcfModel.scenarios[scenarioKey].holdPeriod} onChange={(value) => updateScenarioField(scenarioKey, 'holdPeriod', value)}
                          className="input input-bordered input-md w-full md:text-base" style={{color:'#1d4ed8'}} disabled={!isAdmin} allowDecimal />
                      </Field>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-base-300 overflow-hidden">
                  <div className="px-4 py-3 border-b border-base-300 text-xs font-semibold uppercase tracking-wide text-base-content/40">Scenario Output Comparison</div>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Scenario</th>
                          <th className="text-right">Levered IRR</th>
                          <th className="text-right">Levered EMx</th>
                          <th className="text-right">Exit NOI</th>
                          <th className="text-right">Exit Value</th>
                          <th className="text-right">Net Sale</th>
                          <th className="text-right">DSCR</th>
                          <th className="text-right">Debt Yield</th>
                          <th className="text-right">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scenarioComparison.map((scenario) => (
                          <tr key={scenario.key}>
                            <td className="font-medium">{scenario.label}</td>
                            <td className="text-right">{scenario.irr !== null ? `${(scenario.irr * 100).toFixed(2)}%` : '—'}</td>
                            <td className="text-right">{scenario.emx !== null ? `${scenario.emx.toFixed(2)}x` : '—'}</td>
                            <td className="text-right">{scenario.noi ? '$' + scenario.noi.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                            <td className="text-right">{scenario.exitValue ? '$' + scenario.exitValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                            <td className="text-right">{scenario.netSale ? '$' + scenario.netSale.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                            <td className="text-right">{scenario.dscr !== null ? scenario.dscr.toFixed(2) : '—'}</td>
                            <td className="text-right">{scenario.debtYield !== null ? `${scenario.debtYield.toFixed(2)}%` : '—'}</td>
                            <td className="text-right">
                              {scenario.covenantBreach ? <span className="badge badge-error badge-sm">Covenant breach</span>
                                : scenario.cashTrap ? <span className="badge badge-warning badge-sm">Cash trap</span>
                                  : <span className="badge badge-success badge-sm">OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded-xl border border-base-300 overflow-hidden">
                  <div className="px-4 py-3 border-b border-base-300 text-xs font-semibold uppercase tracking-wide text-base-content/40">Sensitivity Table</div>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Case</th>
                          <th className="text-right">Levered IRR</th>
                          <th className="text-right">Levered EMx</th>
                          <th className="text-right">DSCR</th>
                          <th className="text-right">Exit Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sensitivityCases.map((sensitivity) => (
                          <tr key={sensitivity.key}>
                            <td className="font-medium">{sensitivity.label}</td>
                            <td className="text-right">{sensitivity.result.irr !== null ? `${(sensitivity.result.irr * 100).toFixed(2)}%` : '—'}</td>
                            <td className="text-right">{sensitivity.result.emx !== null ? `${sensitivity.result.emx.toFixed(2)}x` : '—'}</td>
                            <td className="text-right">{sensitivity.result.dscr !== null ? sensitivity.result.dscr.toFixed(2) : '—'}</td>
                            <td className="text-right">{sensitivity.result.exitValue ? '$' + sensitivity.result.exitValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            {isAdmin && (
              <div className="pt-2">
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
                <p className="text-sm text-base-content/50 mb-3">Upload images (JPG, PNG, GIF — max 10MB) or videos (MP4, MOV — max 50MB)</p>
                <label className="btn btn-primary btn-sm cursor-pointer">
                  Choose Files
                  <input type="file" className="hidden" multiple accept="image/*,video/*" onChange={handleFileUpload} />
                </label>
                {uploadError && <p className="text-error text-sm mt-2">{uploadError}</p>}
              </div>
            )}
            {mediaLoading
              ? <p className="text-center text-base-content/40 py-6">Loading…</p>
              : media.length === 0
                ? <p className="text-center text-base-content/30 py-8">No media uploaded yet</p>
                : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {media.map(m => (
                      <div key={m.id} className="relative group rounded border border-base-300 overflow-hidden bg-base-200">
                        {m.media_type?.startsWith('video/')
                          ? <video src={`/api/properties/${property.id}/media/${m.id}`} className="w-full h-28 object-cover" controls />
                          : <img src={`/api/properties/${property.id}/media/${m.id}`} alt={m.filename} className="w-full h-28 object-cover" />
                        }
                        <div className="px-2 py-1 flex items-center justify-between">
                          <span className="text-xs text-base-content/50 truncate">{m.filename}</span>
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
                <p className="text-sm text-base-content/50 mb-1">PDF, Word, Excel, CSV, images — max 25MB each</p>
                <p className="text-xs text-base-content/30 mb-3">These are property documents, not visual media</p>
                <label className="btn btn-primary btn-sm cursor-pointer">
                  Upload Documents
                  <input type="file" className="hidden" multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
                    onChange={handleDocUpload} />
                </label>
                {docUploadError && <p className="text-error text-sm mt-2">{docUploadError}</p>}
              </div>
            )}
            {docsLoading
              ? <p className="text-center text-base-content/40 py-6">Loading…</p>
              : docs.length === 0
                ? <p className="text-center text-base-content/30 py-8">No documents uploaded yet</p>
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
                            <p className="text-xs text-base-content/40">
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


        {/* ── Right panel: map / DCF ── */}
        {tab === 'financials' ? (
          <div className="hidden md:flex flex-1 border-l border-base-300 bg-base-100 min-h-0 flex-col">
            <div className="flex-1 p-6 overflow-auto">
              <div className="rounded-2xl border border-base-300 overflow-hidden bg-base-100 shadow-sm min-h-full">
                <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between gap-3 flex-wrap sticky top-0 bg-base-100 z-[1]">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.22em] text-base-content/50">Discounted Cash Flow</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={dcfModel.timing.viewMode || 'yearly'}
                      onChange={(e) => updateTimingField('viewMode', e.target.value)}
                      className="select select-bordered select-sm"
                      disabled={!isAdmin}
                    >
                      <option value="yearly">Yearly View</option>
                      <option value="monthly">Monthly View</option>
                    </select>
                    <div className="badge badge-outline">{activeHoldPeriod} Year Hold</div>
                  </div>
                </div>
                <div className="overflow-auto h-full">
                  <table className="table table-pin-rows table-pin-cols text-sm min-w-[1200px]">
                    <thead>
                      <tr className="bg-base-200/80">
                        <th className="min-w-[260px] bg-base-200">Line Item</th>
                        {(dcfModel.timing.viewMode === 'monthly' ? engineVisibleDcfMonths : visibleDcfYears).map((period) => (
                          <th key={dcfModel.timing.viewMode === 'monthly' ? `month-${period.month}` : `year-${period.year}`} className="text-center bg-base-200 min-w-[140px]">
                            {dcfModel.timing.viewMode === 'monthly' ? `M${period.month}` : `Year ${period.year}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DCF_ROW_DEFS.map((row) => (
                        <tr key={row.key} className={row.readOnly ? 'bg-base-200/40' : ''}>
                          <th className="font-medium whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>{row.label}</span>
                              <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/35">{row.category}</span>
                            </div>
                          </th>
                          {(dcfModel.timing.viewMode === 'monthly' ? engineVisibleDcfMonths : visibleDcfYears).map((period, yearIndex) => {
                            const computedValue = row.readOnly ? getComputedDcfValue(period, row.key) : null
                            return (
                              <td key={`${row.key}-${dcfModel.timing.viewMode === 'monthly' ? period.month : period.year}`} className="align-middle">
                                {row.readOnly ? (
                                  <div className="input input-bordered input-md w-full md:text-base cursor-default flex items-center justify-end" style={{ color: '#000', fontWeight: 700 }}>
                                    {formatMoneyCell(computedValue)}
                                  </div>
                                ) : (
                                  <NumericInput
                                    placeholder="0"
                                    value={period[row.key]}
                                    onChange={(value) => dcfModel.timing.viewMode === 'monthly' ? null : updateDcfCell(yearIndex, row.key, value)}
                                    className="input input-bordered input-md w-full md:text-base text-right"
                                    style={{ color: '#1d4ed8' }}
                                    disabled={!isAdmin || dcfModel.timing.viewMode === 'monthly'}
                                    allowDecimal={false}
                                  />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 border-l border-base-300 bg-base-100 min-h-0 flex-col">
            <div className="flex-1 min-h-0">
              <PropertyMap address={address} />
            </div>
          </div>
        )}

      </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}><button>close</button></form>

      {/* Contact detail overlay ? opened from Assign Users tab */}
      {viewContactId && (
        <div className="modal modal-open" style={{ zIndex: 60 }}>
          <div className="modal-box p-0 w-screen h-screen max-w-none max-h-none rounded-none overflow-y-auto">
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
