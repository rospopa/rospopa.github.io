import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaultDcfModel, buildDefaultDcfModelFromProperty as project, calculateIrr, paymentForLoan, endingLoanBalance, getComputedDcfValue as value } from '../resources/dcf-engine.mjs';
import { summarize, scenarioProperty } from '../resources/dcf-metrics.mjs';
const fixtures = JSON.parse(await readFile(new URL('dcf-original-fixtures.json',import.meta.url),'utf8'));
const near = (actual,expected,tolerance=1e-7) => assert(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const base = overrides => {
  const property = { price:'1000000',closing_costs:'20000',hold_period:'3',gross_scheduled_rent:'150000',vacancy_rate:'5',operating_expenses:'25000',property_taxes:'15000',insurance:'5000',management_fee_pct:'3',reserves_capex:'5000',loan_amount:'600000',interest_rate:'6',amortization_term:'25',exit_cap_rate:'8',cost_of_sale:'2',irr:'10',...overrides };
  property.dcf_model ??= defaultDcfModel();
  property.dcf_model.taxModel.capitalGainsRatePct='0';
  property.dcf_model.taxModel.ordinaryIncomeTaxRatePct='0';
  return property;
};
for (const fixture of fixtures.projections) test(`original engine parity: ${fixture.name}`,()=>{
  const rows=project(fixture.property).years;
  for(const [i,expected] of fixture.years.entries()) for(const key of fixture.keys) assert.equal(rows[i][key],expected[key],`${fixture.name} Year ${i+1} ${key}`);
});
for (const {flows,result} of fixtures.irr) test(`original IRR parity: ${flows.join(',')}`,()=>{
  const actual=calculateIrr(flows);
  if(result===null)assert.equal(actual,null);else {
    near(actual,result);
    near(flows.reduce((sum,cash,i)=>sum+cash/(1+actual)**i,0),0,.0002);
  }
});
for(const fixture of fixtures.loans) test(`original loan parity: ${fixture.args.join(',')}`,()=>{
  near(paymentForLoan(...fixture.args),fixture.payment);
  for(const {month,result} of fixture.balances)near(endingLoanBalance(...fixture.args,month),result);
});
test('IRR rejects missing signs and non-finite inputs',()=>{
  for(const flows of [[],[0],[0,0],[-1,-2],[1,2],[-100,NaN],[-100,Infinity]])assert.equal(calculateIrr(flows),null);
});
test('EGI, standard NOI and reserve adjustment reconcile',()=>{
  const p=base(),row=project(p).years[0];
  near(value(row,'effectiveGrossIncome'),142500);
  near(value(row,'netOperatingIncomeDcf'),88225);
  const metrics=summarize(p);
  near(metrics.grm,1000000/150000);
  near(metrics.capRate,.088225);
  near(metrics.dscr,88225/Number(row.debtServiceDcf));
  near(metrics.cashOnCash,(88225-Number(row.debtServiceDcf))/420000);
});
test('total-equity cash flow does not deduct distributions or exit tax twice',()=>{
  const row={grossRevenue:100,operatingExpensesDcf:20,debtServiceDcf:10,capitalGainsTaxDcf:9,saleProceedsDcf:200,waterfallSponsor:20,waterfallInvestor:250};
  assert.equal(value(row,'cashFlowAfterSale'),270);
  assert.equal(value({...row,capitalGainsTaxDcf:0,waterfallSponsor:0,waterfallInvestor:0},'cashFlowAfterSale'),270);
});
test('unlevered returns come from a separate debt-free run',()=>{
  const p=base(),m=summarize(p),debtFree=summarize({...p,loan_amount:'0'});
  assert.deepEqual(m.unleveredCashFlows,debtFree.leveredCashFlows);
  near(m.unleveredIrr,debtFree.leveredIrr);
  assert(m.leveredCashFlows.slice(1).some(n=>n>0));
  assert.notEqual(m.leveredIrr,m.unleveredIrr);
});
test('interest-only period preserves principal and starts amortization afterward',()=>{
  const p=base({interest_only_period:'1',hold_period:'2'}),model=project(p);
  assert.equal(Number(model.years[0].debtServiceDcf),36000);
  assert.equal(Number(model.years[0].loanBalanceDcf),600000);
  near(Number(model.years[1].loanBalanceDcf),Math.round(endingLoanBalance(600000,6,25,12)),0);
});
test('fully amortized loan stops charging payments',()=>{
  const model=project(base({interest_rate:'0',amortization_term:'1',hold_period:'2'}));
  assert.equal(Number(model.years[0].debtServiceDcf),600000);
  assert.equal(Number(model.years[1].debtServiceDcf),0);
  assert.equal(Number(model.years[1].loanPayoffAtSale),0);
});
test('balloon loan is paid once, and negative equity shortfalls remain negative',()=>{
  const p=base({hold_period:'3'});
  p.dcf_model.debtTerms.initialLoanTermYears='1';
  const model=project(p);
  assert(Number(model.years[0].loanPayoffAtRefi)>0);
  assert.equal(Number(model.years[2].loanPayoffAtSale),0);
  const underwater=project(base({gross_scheduled_rent:'10000',operating_expenses:'0',insurance:'0',property_taxes:'0',management_fee_pct:'0',reserves_capex:'0',vacancy_rate:'0'})).years[2];
  assert(Number(underwater.saleProceedsDcf)<0);
});
test('refinance bridge uses gross debt, payoff and costs exactly once',()=>{
  const p=base({refi_year:'2',refi_ltv:'70',refi_rate:'5'});
  const row=project(p).years[1];
  assert(Number(row.refinanceProceeds)>0);
  near(Number(row.refinanceCostsDcf),Math.round(Number(row.refinanceProceeds)*.01),1);
  near(value(row,'cashFlowBeforeSale'),value(row,'netOperatingIncomeDcf')-Number(row.debtServiceDcf)+Number(row.refinanceProceeds)-Number(row.loanPayoffAtRefi)-Number(row.refinanceCostsDcf),0);
});
test('operating tax deducts interest, not principal or reserve deposits',()=>{
  const p=base({interest_rate:'0',land_value_pct:'100'});
  p.dcf_model.taxModel.ordinaryIncomeTaxRatePct='20';
  const row=project(p).years[0];
  near(Number(row.taxesDcf),Math.round((88225+5000)*.20),0);
});
test('annual overrides affect the grid, engine and metrics; capital costs reduce return',()=>{
  const p=base();p.dcf_model.annualOverrides={0:{grossRevenue:'200000',capitalExpenditures:'12000'}};
  const row=project(p).years[0],metrics=summarize(p);
  assert.equal(Number(row.grossRevenue),200000);
  assert.equal(Number(row.capitalExpenditures),12000);
  assert.equal(metrics.noi,value(row,'netOperatingIncomeDcf'));
  assert(metrics.leveredCashFlows[1]<value({...row,capitalExpenditures:0},'cashFlowAfterSale'));
});
test('early sale stops operating cash flows and keeps annual end-year IRR convention',()=>{
  const p=base();p.dcf_model.timing.saleMonth='6';
  assert.equal(project(p).months.length,30);
  assert.equal(summarize(p).leveredCashFlows.length,4);
});
test('rent-roll downtime never falls back to scheduled rent; recoveries are included once',()=>{
  const p=base({gross_scheduled_rent:'900000',hold_period:'2'});
  Object.assign(p.dcf_model.rentRoll[0],{annualRent:'120000',leasedSf:'10000',leaseStartYear:'2',leaseEndYear:'2',reimbursementsPct:'100',grossUpPct:'100',camPoolSharePct:'100'});
  p.dcf_model.leaseEconomics.grossUpPct='100';
  p.dcf_model.leaseEconomics.controllableExpensePct='0';
  const model=project(p);
  assert.equal(Number(model.years[0].grossRevenue),0);
  assert.equal(Number(model.years[0].otherIncomeDcf),0);
  assert.equal(Number(model.years[1].grossRevenue),120000);
  assert.equal(Number(model.years[1].otherIncomeDcf),45000);
});
test('scenarios retain main values when an override is blank',()=>{
  const p=base();p.dcf_model.scenarios.upside.rentGrowth='';p.dcf_model.scenarios.upside.holdPeriod='2';
  const resolved=scenarioProperty(p,'upside');
  assert.equal(resolved.gross_scheduled_rent,p.gross_scheduled_rent);
  assert.equal(resolved.hold_period,'2');
  assert.equal(resolved.dcf_model.scenarioName,'upside');
  assert.equal(project(resolved).months.length,24);
});
test('floating-rate cap controls payments and balances consistently',()=>{
  const p=base();Object.assign(p.dcf_model.debtTerms,{floatingRate:true,sofrRatePct:'8',indexSpreadPct:'2',rateCapPct:'5'});
  const model=project(p);
  near(Number(model.years[0].debtServiceDcf),Math.round(paymentForLoan(600000,5,25)*12),0);
  near(Number(model.years[0].loanBalanceDcf),Math.round(endingLoanBalance(600000,5,25,12)),0);
});
test('reserve is funded at acquisition and draws support cash flow without tax deductions',()=>{
  const p=base();p.dcf_model.debtTerms.interestReserveMonths='3';
  const row=project(p).years[0],metrics=summarize(p);
  near(metrics.equity,420000+paymentForLoan(600000,6,25)*3);
  assert(Number(row.interestReserveDraw)>0);
  assert.equal(value(row,'cashFlowBeforeSale'),value({...row,interestReserveDraw:0},'cashFlowBeforeSale')+Number(row.interestReserveDraw));
});
test('secure Details save preserves stored finance fields without Financials UI',async()=>{
  const source=await readFile(new URL('../client/src/PropertyDetailModal.jsx',import.meta.url),'utf8');
  assert(!source.includes("'financials'")&&!source.includes('dcf_model:'));
  assert(source.includes('...property, pin, address, county'));
  assert(source.includes("['details', 'media', 'documents'"));
  const stored={id:1,dcf_model:{privateStoredValue:'preserved'},loan_amount:123};
  const save={...stored,pin:'test',address:'test',county:'test'};
  assert.deepEqual(save.dcf_model,stored.dcf_model);
  assert.equal(save.loan_amount,123);
});
