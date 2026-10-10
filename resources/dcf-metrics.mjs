import { buildDefaultDcfModelFromProperty, calculateIrr, getComputedDcfValue, paymentForLoan } from './dcf-engine.mjs?v=7f0f0621d6';

export function summarize(property, model = buildDefaultDcfModelFromProperty(property)) {
  const hold = Math.max(1, Math.min(10, Math.floor(Number(property.hold_period || 1))));
  const years = model.years.slice(0, hold);
  const basis = Number(property.price || 0) + Number(property.closing_costs || 0);
  const loan = Number(property.loan_amount || 0);
  const reserve = loan > 0 ? paymentForLoan(loan, property.dcf_model?.debtTerms?.floatingRate
    ? Number(property.dcf_model.debtTerms.sofrRatePct || 0) + Number(property.dcf_model.debtTerms.indexSpreadPct || 0)
    : Number(property.interest_rate || 0), Number(property.amortization_term || hold))
    * Number(property.dcf_model?.debtTerms?.interestReserveMonths || 0) : 0;
  const equity = basis - loan + reserve;
  const debtFreeProperty = structuredClone(property);
  debtFreeProperty.loan_amount = '0';
  debtFreeProperty.refi_ltv = '0';
  debtFreeProperty.refi_year = '0';
  if (debtFreeProperty.dcf_model?.debtTerms) debtFreeProperty.dcf_model.debtTerms.interestReserveMonths = '0';
  const debtFreeYears = buildDefaultDcfModelFromProperty(debtFreeProperty).years.slice(0, hold);
  const levered = equity > 0 ? [-equity, ...years.map(row => getComputedDcfValue(row, 'cashFlowAfterSale'))] : null;
  const unlevered = basis > 0 ? [-basis, ...debtFreeYears.map(row => getComputedDcfValue(row, 'cashFlowAfterSale'))] : null;
  const discount = Number(property.irr || 0) / 100;
  const npv = flows => flows && discount > -1 ? flows.reduce((sum, value, year) => sum + value / (1 + discount) ** year, 0) : null;
  const multiple = (flows, initial) => flows && initial > 0 ? flows.slice(1).reduce((sum, value) => sum + value, 0) / initial : null;
  const first = years[0], last = years.at(-1);
  const noi = getComputedDcfValue(first, 'netOperatingIncomeDcf');
  const service = Number(first.debtServiceDcf || 0);
  const price = Number(property.price || 0);
  const rate = (numerator, denominator) => denominator > 0 ? numerator / denominator : null;
  return {
    grm: rate(price, Number(property.gross_scheduled_rent || 0)),
    capRate: rate(noi, price), cashOnCash: rate(noi - service, equity),
    leveredIrr: levered ? calculateIrr(levered) : null, unleveredIrr: unlevered ? calculateIrr(unlevered) : null,
    leveredEmx: multiple(levered, equity), unleveredEmx: multiple(unlevered, basis),
    leveredNpv: npv(levered), unleveredNpv: npv(unlevered),
    dscr: rate(noi, service), debtYield: rate(noi, loan), yieldOnCost: rate(noi, basis), ltv: rate(loan, price),
    pricePerUnit: rate(price, Number(property.unit_count || 0)),
    pricePerSqft: rate(price, Number(property.square_feet || 0)),
    pricePerAcre: rate(price, Number(property.lot_size || 0)),
    rentToSales: rate(Number(property.tenant_base_rent || 0), Number(property.tenant_gross_sales || 0)),
    equity, acquisitionBasis: basis, reserveFunding: reserve, noi, egi: getComputedDcfValue(first, 'effectiveGrossIncome'),
    annualDebtService: service, exitValue: Number(last.grossSaleProceedsDcf || 0),
    netSale: Number(last.saleProceedsDcf || 0), exitLoan: Number(last.loanPayoffAtSale || 0),
    leveredCashFlows: levered, unleveredCashFlows: unlevered,
  };
}

export const METRICS = [
  ['grm','GRM','multiple','Purchase price / annual scheduled rent. Does not consider expenses.'],
  ['capRate','Cap Rate','percent','Year-one reserve-adjusted NOI / purchase price.'],
  ['cashOnCash','Cash-on-Cash','percent','(Year-one reserve-adjusted NOI - debt service) / initial equity, before income tax and one-time capital events.'],
  ['leveredIrr','Levered IRR','percent','Annual discount rate making the total-equity cash-flow NPV zero. Includes financing, capital costs and modeled taxes.'],
  ['unleveredIrr','Unlevered IRR','percent','IRR of a separate debt-free run with no refinancing or loan payoff. Includes modeled capital costs and taxes.'],
  ['leveredEmx','Levered EMx','multiple','Sum of total-equity cash flows / initial equity. A negative cash flow reduces this net-cash multiple.'],
  ['unleveredEmx','Unlevered EMx','multiple','Sum of debt-free cash flows / acquisition cost. A negative cash flow reduces this net-cash multiple.'],
  ['leveredNpv','Levered NPV','money','Sum of equity cash flows / (1 + discount rate)^year, including the initial negative equity payment.'],
  ['unleveredNpv','Unlevered NPV','money','Present value of the debt-free series, including initial acquisition cost.'],
  ['dscr','DSCR','multiple','Year-one reserve-adjusted NOI / debt service. Lender conventions may differ.'],
  ['debtYield','Debt Yield','percent','Year-one reserve-adjusted NOI / initial loan amount.'],
  ['yieldOnCost','Yield on Cost','percent','Year-one reserve-adjusted NOI / (purchase price + closing costs).'],
  ['ltv','LTV','percent','Initial loan / purchase price.'],
  ['pricePerUnit','Price / Unit','money','Purchase price / unit, suite or bay count.'],
  ['pricePerSqft','Price / SF','money','Purchase price / building area.'],
  ['pricePerAcre','Price / Acre','money','Purchase price / land area in acres.'],
  ['rentToSales','Rent / Sales','percent','Tenant base rent / tenant annual sales; not a universal underwriting benchmark.'],
  ['acquisitionBasis','Acquisition Cost','money','Purchase price + acquisition closing costs.'],
  ['equity','Initial Equity','money','Acquisition cost - initial loan + cash funding for the interest reserve.'],
  ['reserveFunding','Interest Reserve Funding','money','Monthly debt payment times selected reserve months; a simplified upfront cash reserve.'],
  ['noi','Reserve-adjusted NOI','money','EGI - operating expenses - management fees - property taxes - insurance - reserves. Standard NOI normally excludes capital reserves.'],
  ['egi','Effective Gross Income','money','Rent - vacancy/credit loss + percentage rent + other income and recoveries.'],
  ['annualDebtService','Annual Debt Service','money','Year-one monthly principal and interest payments, excluding balloon payoff.'],
  ['exitValue','Gross Exit Value','money','Annualized NOI in the sale month / exit cap rate; not forward-year NOI.'],
  ['netSale','Net Sale Proceeds','money','Sale value - selling costs - loan payoff - modeled exit tax, with modeled loss benefit. Can be negative.'],
  ['exitLoan','Loan Payoff at Sale','money','Outstanding principal at sale, after the final regular payment.'],
];

export function scenarioProperty(property, key) {
  const resolved = structuredClone(property);
  resolved.dcf_model.scenarioName = key;
  const scenario = resolved.dcf_model.scenarios[key];
  const fields = { rentGrowth:'rent_growth', expenseGrowth:'expense_growth', exitCapRate:'exit_cap_rate', vacancyRate:'vacancy_rate', loanAmount:'loan_amount', holdPeriod:'hold_period' };
  for (const [field, scalar] of Object.entries(fields)) if (scenario?.[field] !== undefined && scenario[field] !== '') resolved[scalar] = scenario[field];
  return resolved;
}
