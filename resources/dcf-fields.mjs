// Input inventory ported from the former Financials form; reference-only fields are explicit.
export const SCALAR_FIELDS = [
  {
    "path": "closing_costs",
    "label": "Closing Costs ($)",
    "help": "Acquisition costs beyond purchase price: title, legal, due diligence, etc."
  },
  {
    "path": "hold_period",
    "label": "Hold Period (yrs)",
    "help": "Number of years you plan to own the asset before selling."
  },
  {
    "path": "gross_scheduled_rent",
    "label": "Gross Scheduled Rent ($/yr)",
    "help": "Maximum potential rent if 100% occupied and all tenants pay full face rent."
  },
  {
    "path": "vacancy_rate",
    "label": "Vacancy / Credit Loss (%)",
    "help": "Estimated vacancy and credit loss as % of GSR. Reflects expected downtime between leases."
  },
  {
    "path": "other_income",
    "label": "Other Income ($/yr)",
    "help": "Non-rent income: parking, signage, antenna rent, etc."
  },
  {
    "path": "operating_expenses",
    "label": "Operating Expenses ($/yr)",
    "help": "Total controllable operating costs excluding taxes, insurance, and reserves."
  },
  {
    "path": "reserves_capex",
    "label": "Reserves / Replacement Capex ($/yr)",
    "help": "Annual reserves set aside for capital expenditures and future deferred maintenance."
  },
  {
    "path": "loan_amount",
    "label": "Loan Amount ($)",
    "help": "Total senior loan amount. LTV = Loan ÷ Price."
  },
  {
    "path": "interest_rate",
    "label": "Interest Rate (%)",
    "help": "Annual interest rate on the senior loan."
  },
  {
    "path": "amortization_term",
    "label": "Amortization Term (yrs)",
    "help": "Number of years over which the loan amortizes (principal pays down)."
  },
  {
    "path": "interest_only_period",
    "label": "Interest-Only Period (yrs)",
    "help": "Interest-only period in years. Initial-loan principal stays unchanged during this period; amortization starts afterward."
  },
  {
    "path": "rent_growth",
    "label": "Rent Growth (% / yr)",
    "help": "Annual rent escalation rate applied to market rents and lease bumps."
  },
  {
    "path": "expense_growth",
    "label": "Expense Growth (% / yr)",
    "help": "Annual growth rate applied to operating expenses."
  },
  {
    "path": "exit_cap_rate",
    "label": "Exit Cap Rate (%)",
    "help": "Cap rate applied to exit-year NOI to determine sale price. Higher = lower sale price."
  },
  {
    "path": "cost_of_sale",
    "label": "Cost of Sale (%)",
    "help": "Brokerage and closing costs on the sale, as % of gross sale price."
  },
  {
    "path": "tenant_gross_sales",
    "label": "Tenant Annual Gross Sales ($)",
    "help": "Tenant's annual gross sales volume. Used for percentage rent calculations."
  },
  {
    "path": "tenant_base_rent",
    "label": "Tenant Base Rent ($/yr)",
    "help": "Tenant's contractual base rent, separate from percentage rent."
  },
  {
    "path": "management_fee_pct",
    "label": "Management Fee (%)",
    "help": "Management fee as a percentage of effective gross income. Enter your agreement; no market fee is assumed."
  },
  {
    "path": "property_taxes",
    "label": "Property Taxes ($/yr)",
    "help": "Annual real estate tax bill. Verify against most recent tax bill."
  },
  {
    "path": "land_value_pct",
    "label": "Land Value (%)",
    "help": "Portion of purchase price allocated to land (not depreciable). Reduces depreciation benefit."
  },
  {
    "path": "cost_seg_bonus_pct",
    "label": "Cost Seg Bonus (%)",
    "help": "Bonus depreciation % from cost segregation study. Accelerates early deductions."
  },
  {
    "path": "effective_tax_rate",
    "label": "Effective Tax Rate (%)",
    "help": "Your effective combined federal + state income tax rate."
  },
  {
    "path": "depreciation_recapture_rate",
    "label": "Depreciation Recapture Rate (%)",
    "help": "User-assumed tax rate on modeled depreciation recapture. Ask a CPA about your actual tax treatment."
  },
  {
    "path": "refi_ltv",
    "label": "Refi LTV (%)",
    "help": "Loan-to-Value at refinance. Determines how much new debt you can pull out."
  },
  {
    "path": "refi_rate",
    "label": "Refi Interest Rate (%)",
    "help": "Interest rate on the refinance loan."
  },
  {
    "path": "refi_year",
    "label": "Refi Year",
    "help": "Year in the hold period when you refinance."
  },
  {
    "path": "price",
    "label": "Purchase price ($)",
    "help": "Total purchase price of the property."
  },
  {
    "path": "square_feet",
    "label": "Building area (SF)",
    "help": "Rentable or gross building square footage."
  },
  {
    "path": "lot_size",
    "label": "Land area (acres)",
    "help": "Land area (acres)"
  },
  {
    "path": "unit_count",
    "label": "Unit / bay / suite count",
    "help": "Number of rentable units (apartments, suites, or bays)."
  },
  {
    "path": "irr",
    "label": "NPV discount rate (%)",
    "help": "Your target/hurdle rate used to compute NPV. Usually your cost of capital or required return."
  },
  {
    "path": "rent_to_sales_ratio",
    "label": "Percentage-rent rate (%)",
    "help": "Percentage-rent rate used with tenant sales and base rent; a contractual assumption, not a health benchmark."
  },
  {
    "path": "insurance",
    "label": "Insurance ($/yr)",
    "help": "Annual commercial property insurance expense."
  },
  {
    "path": "num_skus",
    "label": "SKU count (reference)",
    "help": "Reference only; not used in cash flow or valuation."
  }
];
export const MODEL_FIELDS = {
  "debtTerms": [
    {
      "key": "initialLoanTermYears",
      "label": "Initial Loan Term (yrs)",
      "help": "Total loan term before the balloon payment or maturity.",
      "type": "number",
      "reference": false
    },
    {
      "key": "refinanceLoanTermYears",
      "label": "Refi Loan Term (yrs)",
      "help": "Term of the refinance loan in years before its balloon maturity.",
      "type": "number",
      "reference": false
    },
    {
      "key": "refinanceCostPct",
      "label": "Refi Cost (%)",
      "help": "Refinance closing costs as % of new loan amount (points, fees, title).",
      "type": "number",
      "reference": false
    },
    {
      "key": "floatingRate",
      "label": "Floating Rate",
      "help": "Floating Rate",
      "type": "checkbox",
      "reference": false
    },
    {
      "key": "sofrRatePct",
      "label": "SOFR / Index Rate (%)",
      "help": "Current SOFR rate (base index for floating-rate loans).",
      "type": "number",
      "reference": false
    },
    {
      "key": "indexSpreadPct",
      "label": "Index Spread (%)",
      "help": "Spread above SOFR charged by the lender.",
      "type": "number",
      "reference": false
    },
    {
      "key": "rateCapPct",
      "label": "Rate Cap (%)",
      "help": "Maximum interest rate on a floating-rate loan. Purchased as a hedge to cap exposure.",
      "type": "number",
      "reference": false
    },
    {
      "key": "rateFloorPct",
      "label": "Rate Floor (%)",
      "help": "Minimum interest rate floor on a floating instrument.",
      "type": "number",
      "reference": false
    },
    {
      "key": "interestReserveMonths",
      "label": "Interest Reserve (months)",
      "help": "Months of interest held in reserve at closing, often required during lease-up.",
      "type": "number",
      "reference": false
    }
  ],
  "waterfall": [
    {
      "key": "prefRate",
      "label": "Preferred Return (%)",
      "help": "Preferred return rate: investors receive this annual return before any promote is paid.",
      "type": "number",
      "reference": false
    },
    {
      "key": "catchUpRate",
      "label": "Catch-Up Share (%)",
      "help": "GP catch-up rate after LP pref is paid, before tiered splits kick in.",
      "type": "number",
      "reference": false
    },
    {
      "key": "promoteRate",
      "label": "Promote / Sponsor Share (%)",
      "help": "GP promote (carried interest) on profits above the pref hurdle.",
      "type": "number",
      "reference": false
    },
    {
      "key": "lpSharePct",
      "label": "LP Equity Share (%)",
      "help": "LP share of distributions after the pref and promote hurdles.",
      "type": "number",
      "reference": false
    },
    {
      "key": "gpSharePct",
      "label": "GP Equity Share (%)",
      "help": "GP/Sponsor share of distributions (co-invest, not promote). Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    }
  ],
  "timing": [
    {
      "key": "granularity",
      "label": "Granularity",
      "help": "Granularity Reference only: this field does not independently change the modeled cash flows.",
      "type": "select",
      "options": [
        "monthly"
      ],
      "reference": true
    },
    {
      "key": "viewMode",
      "label": "View Mode",
      "help": "View Mode",
      "type": "select",
      "options": [
        "yearly",
        "monthly"
      ],
      "reference": false
    }
  ],
  "taxModel": [
    {
      "key": "capitalGainsRatePct",
      "label": "Capital Gains Tax Rate (%)",
      "help": "Long-term capital gains tax rate applied to profit on sale above your adjusted basis.",
      "type": "number",
      "reference": false
    },
    {
      "key": "ordinaryIncomeTaxRatePct",
      "label": "Ordinary Income Tax Rate (%)",
      "help": "User-assumed ordinary income rate applied to modeled taxable operating income after interest, depreciation and eligible modeled losses.",
      "type": "number",
      "reference": false
    },
    {
      "key": "passiveLossLimitPct",
      "label": "Passive Loss Usage Limit (%)",
      "help": "Percentage of modeled positive taxable operating income that can be offset by modeled suspended losses. This does not determine eligibility to offset actual income.",
      "type": "number",
      "reference": false
    },
    {
      "key": "initialTaxBasis",
      "label": "Initial Tax Basis ($)",
      "help": "Your starting tax basis: typically your purchase price plus improvements.",
      "type": "number",
      "reference": false
    },
    {
      "key": "assessedValue",
      "label": "Assessed Value ($)",
      "help": "Assessed Value ($) Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "appraisedValue",
      "label": "Appraised Value ($)",
      "help": "Appraised Value ($) Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "landAssessment",
      "label": "Land Assessment ($)",
      "help": "Land Assessment ($) Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "improvementAssessment",
      "label": "Improvement Assessment ($)",
      "help": "Improvement Assessment ($) Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "personalPropertyAssessment",
      "label": "Personal Property Assessment ($)",
      "help": "Personal Property Assessment ($) Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "suspendedLossCarryforward",
      "label": "Suspended Loss Carryforward ($)",
      "help": "Existing suspended passive losses carried into this investment.",
      "type": "number",
      "reference": false
    },
    {
      "key": "entityType",
      "label": "Entity Type",
      "help": "Entity Type Reference only: this field does not independently change the modeled cash flows.",
      "type": "select",
      "options": [
        "Direct",
        "Partnership",
        "Corporate"
      ],
      "reference": true
    },
    {
      "key": "enable1031",
      "label": "Enable1031",
      "help": "Enable1031",
      "type": "checkbox",
      "reference": false
    },
    {
      "key": "installmentSalePct",
      "label": "Installment Sale Deferral (%)",
      "help": "Defers capital gains by receiving sale proceeds over time instead of all at once.",
      "type": "number",
      "reference": false
    }
  ],
  "leaseEconomics": [
    {
      "key": "freeRentMonths",
      "label": "Free Rent Months",
      "help": "Free Rent Months",
      "type": "number",
      "reference": false
    },
    {
      "key": "marketRentGrowthPct",
      "label": "Market Rent Growth (% / yr)",
      "help": "Annual growth rate for market rents used in lease rollover / re-leasing analysis.",
      "type": "number",
      "reference": false
    },
    {
      "key": "downtimeMonthsDefault",
      "label": "Downtime Months Default",
      "help": "Downtime Months Default",
      "type": "number",
      "reference": false
    },
    {
      "key": "expenseRecoveryPct",
      "label": "Expense Recovery (%)",
      "help": "Expense Recovery (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "newLeaseSpreadPct",
      "label": "New Lease Spread (%)",
      "help": "Mark-to-market spread for new leases vs. in-place rents. Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "renewalSpreadPct",
      "label": "Renewal Spread (%)",
      "help": "Mark-to-market spread for lease renewals vs. in-place rents.",
      "type": "number",
      "reference": false
    },
    {
      "key": "tenantImprovementPerSf",
      "label": "TI per SF ($)",
      "help": "Tenant Improvement allowance per square foot for new leases.",
      "type": "number",
      "reference": false
    },
    {
      "key": "leasingCommissionPct",
      "label": "LC (% of Rent)",
      "help": "Leasing commission as % of total lease value.",
      "type": "number",
      "reference": false
    },
    {
      "key": "expenseStopPerSf",
      "label": "Expense Stop ($/SF)",
      "help": "Base year expense stop: landlord pays expenses up to this amount per SF; tenant pays overage.",
      "type": "number",
      "reference": false
    },
    {
      "key": "grossUpPct",
      "label": "Gross-Up Occupancy (%)",
      "help": "Occupancy assumption used for simplified tenant recoveries. It does not decide whether a lease allows gross-up.",
      "type": "number",
      "reference": false
    },
    {
      "key": "percentageRentBreakpointType",
      "label": "Percentage Rent Breakpoint Type",
      "help": "Percentage Rent Breakpoint Type",
      "type": "select",
      "options": [
        "natural",
        "stated"
      ],
      "reference": false
    },
    {
      "key": "camAdminFeePct",
      "label": "CAM Admin Fee (%)",
      "help": "Administrative fee added to CAM recoveries, as % of gross CAM pool.",
      "type": "number",
      "reference": false
    },
    {
      "key": "controllableExpensePct",
      "label": "Controllable Expense Share (%)",
      "help": "Share of operating expenses classified as controllable (subject to annual cap).",
      "type": "number",
      "reference": false
    },
    {
      "key": "controllableCapPct",
      "label": "Controllable Cap (%)",
      "help": "Maximum annual increase in controllable expenses billed to tenants.",
      "type": "number",
      "reference": false
    },
    {
      "key": "nonRecoverableExpensePct",
      "label": "Non-Recoverable Expense (%)",
      "help": "Share of expenses that cannot be recovered from tenants.",
      "type": "number",
      "reference": false
    },
    {
      "key": "taxPoolRecoverablePct",
      "label": "Tax Pool Recoverable (%)",
      "help": "Share of real estate taxes that are recoverable from tenants via NNN or modified gross leases.",
      "type": "number",
      "reference": false
    },
    {
      "key": "insurancePoolRecoverablePct",
      "label": "Insurance Pool Recoverable (%)",
      "help": "Share of insurance costs recoverable from tenants.",
      "type": "number",
      "reference": false
    },
    {
      "key": "camPoolRecoverablePct",
      "label": "CAM Pool Recoverable (%)",
      "help": "Share of the CAM operating expense pool that is recoverable from tenants.",
      "type": "number",
      "reference": false
    },
    {
      "key": "grossUpMethod",
      "label": "Gross Up Method",
      "help": "Category uses the Gross Up occupancy assumption; occupancy uses one minus vacancy. These are simplified recovery assumptions, not lease interpretation.",
      "type": "select",
      "options": [
        "category",
        "occupancy"
      ],
      "reference": false
    },
    {
      "key": "reconciliationMonth",
      "label": "Reconciliation Month",
      "help": "Reference only. This forward model has no actual billed-versus-paid ledger and does not add a second reconciliation charge.",
      "type": "number",
      "reference": true
    },
    {
      "key": "occupiedSqft",
      "label": "Occupied SF",
      "help": "Occupied SF Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "vacantSqft",
      "label": "Vacant SF",
      "help": "Vacant SF Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "parkingIncome",
      "label": "Parking Income ($/yr)",
      "help": "Parking Income ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "laundryIncome",
      "label": "Laundry Income ($/yr)",
      "help": "Laundry Income ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "storageIncome",
      "label": "Storage Income ($/yr)",
      "help": "Storage Income ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "otherIncomeMisc",
      "label": "Other Misc Income ($/yr)",
      "help": "Other Misc Income ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "personalPropertyTaxes",
      "label": "Personal Property Taxes ($/yr)",
      "help": "Personal Property Taxes ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "payroll",
      "label": "Payroll ($/yr)",
      "help": "Payroll ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "payrollBenefits",
      "label": "Payroll Benefits ($/yr)",
      "help": "Payroll Benefits ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "workersComp",
      "label": "Workers Comp ($/yr)",
      "help": "Workers Comp ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "repairsMaintenance",
      "label": "Repairs & Maintenance ($/yr)",
      "help": "Repairs & Maintenance ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "janitorial",
      "label": "Janitorial ($/yr)",
      "help": "Janitorial ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "utilitiesFuel",
      "label": "Utilities — Fuel ($/yr)",
      "help": "Utilities — Fuel ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "utilitiesWaterSewer",
      "label": "Utilities — Water/Sewer ($/yr)",
      "help": "Utilities — Water/Sewer ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "utilitiesElectric",
      "label": "Utilities — Electric ($/yr)",
      "help": "Utilities — Electric ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "utilitiesPhoneInternet",
      "label": "Utilities — Phone/Internet ($/yr)",
      "help": "Utilities — Phone/Internet ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "accountingLegal",
      "label": "Accounting & Legal ($/yr)",
      "help": "Accounting & Legal ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "advertisingLicensesPermits",
      "label": "Advertising / Licenses / Permits ($/yr)",
      "help": "Advertising / Licenses / Permits ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "supplies",
      "label": "Supplies ($/yr)",
      "help": "Supplies ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "contractLawnSnow",
      "label": "Contract — Lawn/Snow ($/yr)",
      "help": "Contract — Lawn/Snow ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "contractRefuse",
      "label": "Contract — Refuse ($/yr)",
      "help": "Contract — Refuse ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "contractPest",
      "label": "Contract — Pest Control ($/yr)",
      "help": "Contract — Pest Control ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "contractSweeping",
      "label": "Contract — Lot Sweeping ($/yr)",
      "help": "Contract — Lot Sweeping ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "contractSecurity",
      "label": "Contract — Security ($/yr)",
      "help": "Contract — Security ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "associationDues",
      "label": "Association Dues ($/yr)",
      "help": "Association Dues ($/yr)",
      "type": "number",
      "reference": false
    },
    {
      "key": "miscellaneousExpense",
      "label": "Miscellaneous Expense ($/yr)",
      "help": "Miscellaneous Expense ($/yr)",
      "type": "number",
      "reference": false
    }
  ],
  "lenderConstraints": [
    {
      "key": "minDscr",
      "label": "Min Dscr",
      "help": "Min Dscr",
      "type": "number",
      "reference": false
    },
    {
      "key": "minDebtYield",
      "label": "Min Debt Yield",
      "help": "Min Debt Yield",
      "type": "number",
      "reference": false
    },
    {
      "key": "maxLtv",
      "label": "Max Ltv",
      "help": "Max Ltv",
      "type": "number",
      "reference": false
    }
  ],
  "governance": [
    {
      "key": "inputsLocked",
      "label": "Inputs Locked",
      "help": "Inputs Locked",
      "type": "checkbox",
      "reference": false
    },
    {
      "key": "formulasLocked",
      "label": "Formulas Locked",
      "help": "Formulas Locked Reference only: this field does not independently change the modeled cash flows.",
      "type": "checkbox",
      "reference": true
    },
    {
      "key": "overridesEnabled",
      "label": "Overrides Enabled",
      "help": "Overrides Enabled Reference only: this field does not independently change the modeled cash flows.",
      "type": "checkbox",
      "reference": true
    },
    {
      "key": "overrideNote",
      "label": "Override Note",
      "help": "Override Note Reference only: this field does not independently change the modeled cash flows.",
      "type": "text",
      "reference": true
    },
    {
      "key": "diagnosticLevel",
      "label": "Diagnostic Level",
      "help": "Diagnostic Level Reference only: this field does not independently change the modeled cash flows.",
      "type": "select",
      "options": [
        "strict",
        "standard"
      ],
      "reference": true
    }
  ],
  "rentRoll": [
    {
      "key": "tenantName",
      "label": "Tenant Name",
      "help": "Tenant Name Reference only: this field does not independently change the modeled cash flows.",
      "type": "text",
      "reference": true
    },
    {
      "key": "suite",
      "label": "Suite",
      "help": "Suite Reference only: this field does not independently change the modeled cash flows.",
      "type": "text",
      "reference": true
    },
    {
      "key": "annualRent",
      "label": "Annual Rent",
      "help": "Annual Rent",
      "type": "number",
      "reference": false
    },
    {
      "key": "monthlyRent",
      "label": "Monthly Rent",
      "help": "Monthly Rent Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "annualRecoveries",
      "label": "Annual Recoveries",
      "help": "Annual Recoveries Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "monthlyRecoveries",
      "label": "Monthly Recoveries",
      "help": "Monthly Recoveries Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "grossAnnualRent",
      "label": "Gross Annual Rent",
      "help": "Gross Annual Rent Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "grossMonthlyRent",
      "label": "Gross Monthly Rent",
      "help": "Gross Monthly Rent Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "securityDeposit",
      "label": "Security Deposit",
      "help": "Security Deposit Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "annualSales",
      "label": "Annual Sales",
      "help": "Annual Sales",
      "type": "number",
      "reference": false
    },
    {
      "key": "leasedSf",
      "label": "Leased SF",
      "help": "Leased SF",
      "type": "number",
      "reference": false
    },
    {
      "key": "annualRentPsf",
      "label": "Annual Rent / SF",
      "help": "Annual Rent / SF",
      "type": "number",
      "reference": false
    },
    {
      "key": "recoveryPsf",
      "label": "Recovery / SF",
      "help": "Recovery / SF Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "leaseType",
      "label": "Lease Type",
      "help": "Lease Type",
      "type": "select",
      "options": [
        "NNN",
        "Base Year",
        "Gross",
        "Modified Gross"
      ],
      "reference": false
    },
    {
      "key": "reimbursementsPct",
      "label": "Reimbursements (%)",
      "help": "Reimbursements (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "freeRentMonths",
      "label": "Free Rent Months",
      "help": "Free Rent Months",
      "type": "number",
      "reference": false
    },
    {
      "key": "leaseStartYear",
      "label": "Lease Start Year",
      "help": "Lease Start Year",
      "type": "number",
      "reference": false
    },
    {
      "key": "leaseStartMonth",
      "label": "Lease Start Month",
      "help": "Lease Start Month",
      "type": "number",
      "reference": false
    },
    {
      "key": "leaseEndYear",
      "label": "Lease End Year",
      "help": "Lease End Year",
      "type": "number",
      "reference": false
    },
    {
      "key": "leaseEndMonth",
      "label": "Lease End Month",
      "help": "Lease End Month",
      "type": "number",
      "reference": false
    },
    {
      "key": "rentBumpsPct",
      "label": "Rent Bumps (%)",
      "help": "Rent Bumps (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "renewalProbabilityPct",
      "label": "Renewal Probability (%)",
      "help": "Renewal Probability (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "downtimeMonths",
      "label": "Downtime Months",
      "help": "Downtime Months",
      "type": "number",
      "reference": false
    },
    {
      "key": "marketRentPsf",
      "label": "Market Rent / SF",
      "help": "Market Rent / SF",
      "type": "number",
      "reference": false
    },
    {
      "key": "newLeaseSpreadPct",
      "label": "New Lease Spread (%)",
      "help": "New Lease Spread (%) Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "renewalSpreadPct",
      "label": "Renewal Spread (%)",
      "help": "Renewal Spread (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "tenantImprovementPerSf",
      "label": "Tenant Improvement Per SF",
      "help": "Tenant Improvement Per SF",
      "type": "number",
      "reference": false
    },
    {
      "key": "leasingCommissionPct",
      "label": "Leasing Commission (%)",
      "help": "Leasing Commission (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "expenseStopPerSf",
      "label": "Expense Stop Per SF",
      "help": "Expense Stop Per SF",
      "type": "number",
      "reference": false
    },
    {
      "key": "grossUpPct",
      "label": "Gross Up (%)",
      "help": "Occupancy assumption used for simplified tenant recoveries. It does not decide whether a lease allows gross-up.",
      "type": "number",
      "reference": false
    },
    {
      "key": "breakpointSales",
      "label": "Breakpoint Sales",
      "help": "Breakpoint Sales",
      "type": "number",
      "reference": false
    },
    {
      "key": "percentageRentPct",
      "label": "Percentage Rent (%)",
      "help": "Percentage Rent (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "anchorTenant",
      "label": "Anchor Tenant",
      "help": "Anchor Tenant Reference only: this field does not independently change the modeled cash flows.",
      "type": "checkbox",
      "reference": true
    },
    {
      "key": "coTenancyGroup",
      "label": "Co Tenancy Group",
      "help": "Co Tenancy Group Reference only: this field does not independently change the modeled cash flows.",
      "type": "text",
      "reference": true
    },
    {
      "key": "extensionOptionMonths",
      "label": "Extension Option Months",
      "help": "Extension Option Months",
      "type": "number",
      "reference": false
    },
    {
      "key": "expansionSf",
      "label": "Expansion SF",
      "help": "Expansion SF",
      "type": "number",
      "reference": false
    },
    {
      "key": "contractionSf",
      "label": "Contraction SF",
      "help": "Contraction SF",
      "type": "number",
      "reference": false
    },
    {
      "key": "terminationMonth",
      "label": "Termination Month",
      "help": "Termination Month",
      "type": "number",
      "reference": false
    },
    {
      "key": "purchaseOptionPrice",
      "label": "Purchase Option Price",
      "help": "Purchase Option Price Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "renewalTiPerSf",
      "label": "Renewal Ti Per SF",
      "help": "Renewal Ti Per SF",
      "type": "number",
      "reference": false
    },
    {
      "key": "newLeaseTiPerSf",
      "label": "New Lease Ti Per SF",
      "help": "New Lease Ti Per SF Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "renewalLcPct",
      "label": "Renewal Lc (%)",
      "help": "Renewal Lc (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "newLeaseLcPct",
      "label": "New Lease Lc (%)",
      "help": "New Lease Lc (%) Reference only: this field does not independently change the modeled cash flows.",
      "type": "number",
      "reference": true
    },
    {
      "key": "camPoolSharePct",
      "label": "Cam Pool Share (%)",
      "help": "Cam Pool Share (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "adminFeePct",
      "label": "Admin Fee (%)",
      "help": "Admin Fee (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "controllableCapPct",
      "label": "Controllable Cap (%)",
      "help": "Controllable Cap (%)",
      "type": "number",
      "reference": false
    },
    {
      "key": "nonRecoverableExpensePct",
      "label": "Non Recoverable Expense (%)",
      "help": "Non Recoverable Expense (%)",
      "type": "number",
      "reference": false
    }
  ]
};
