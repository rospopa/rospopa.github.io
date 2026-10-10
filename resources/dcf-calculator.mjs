import { DCF_ROW_DEFS, DCF_GROUPS, defaultDcfModel, normalizeRentRollRow, buildDefaultDcfModelFromProperty, getComputedDcfValue } from './dcf-engine.mjs?v=7f0f0621d6';
import { SCALAR_FIELDS, MODEL_FIELDS } from './dcf-fields.mjs?v=e59325ac47';
import { summarize, scenarioProperty, METRICS } from './dcf-metrics.mjs?v=9323ccff8b';

const root = document.querySelector('[data-dcf-calculator]');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const scalarGroups = [
  ['Acquisition and hold', ['price','closing_costs','hold_period','irr','exit_cap_rate','cost_of_sale','square_feet','lot_size','unit_count']],
  ['Income and operating costs', ['gross_scheduled_rent','vacancy_rate','other_income','operating_expenses','management_fee_pct','property_taxes','insurance','reserves_capex','rent_growth','expense_growth']],
  ['Debt and refinancing', ['loan_amount','interest_rate','amortization_term','interest_only_period','refi_year','refi_ltv','refi_rate']],
  ['Tenant sales and tax assumptions', ['tenant_gross_sales','tenant_base_rent','rent_to_sales_ratio','land_value_pct','cost_seg_bonus_pct','effective_tax_rate','depreciation_recapture_rate','num_skus']],
];
const groupNames = {
  debtTerms: 'Advanced debt terms', waterfall: 'LP / sponsor allocation', timing: 'Timing',
  taxModel: 'Simplified tax model', leaseEconomics: 'Lease recoveries and expense detail',
  lenderConstraints: 'Refinance lender constraints', governance: 'Input controls and notes',
};
const editableRows = new Set(['grossRevenue','vacancyCreditLoss','percentageRentDcf','otherIncomeDcf','operatingExpensesDcf','managementFeesDcf','propertyTaxesDcf','insuranceDcf','reservesCapexDcf','tenantImprovements','leasingCommissions','capitalExpenditures','taxesDcf']);
let state, columnStart = 0, currentModel, currentMetrics;

function blankState() {
  const model = defaultDcfModel();
  model.taxModel.capitalGainsRatePct = '0';
  model.taxModel.ordinaryIncomeTaxRatePct = '0';
  model.waterfall.prefRate = '0';
  model.waterfall.promoteRate = '0';
  model.timing.refiMonth = '1';
  model.timing.saleMonth = '12';
  model.annualOverrides = {};
  model.scenarioName = 'base';
  for (const scenario of Object.values(model.scenarios)) for (const key of ['rentGrowth','expenseGrowth','exitCapRate','vacancyRate','loanAmount','holdPeriod']) scenario[key] = '';
  return { ...Object.fromEntries(SCALAR_FIELDS.map(f => [f.path, ''])), hold_period: '10', dcf_model: model };
}
function get(path) { return path.split('.').reduce((value, key) => value?.[key], state); }
function set(path, value) {
  const keys = path.split('.');
  let node = state;
  for (const key of keys.slice(0,-1)) node = node[key] ??= {};
  node[keys.at(-1)] = value;
}
function constraints(path) {
  const leaf = path.split('.').at(-1);
  if (path === 'hold_period' || leaf === 'holdPeriod' || leaf === 'leaseStartYear' || leaf === 'leaseEndYear') return ' min="1" max="10" step="1"';
  if (leaf.endsWith('Month') && !['terminationMonth','viewMode'].includes(leaf)) return ' min="1" max="12" step="1"';
  if (path === 'amortization_term') return ' min="1" max="100" step="1"';
  if (path === 'refi_year' || path === 'interest_only_period' || leaf.endsWith('LoanTermYears')) return ' min="0" max="100" step="1"';
  if (/growth|Growth|Delta|SpreadPct|irr/.test(path) && !/indexSpreadPct/.test(path)) return ' min="-99" max="1000" step="any"';
  if (/Pct$|_pct$|vacancy_rate|cost_of_sale|land_value_pct|effective_tax_rate|depreciation_recapture_rate|rent_to_sales_ratio|refi_ltv/.test(path)) return ' min="0" max="100" step="any"';
  return ' min="0" max="1000000000000" step="any"';
}
function field(def, path) {
  const id = 'dcf-' + path.replace(/\./g,'-');
  const value = get(path);
  const type = def.type || 'number';
  const input = type === 'select'
    ? `<select id="${id}" data-path="${path}">${def.options.map(option => `<option value="${escape(option)}"${value === option ? ' selected' : ''}>${escape(option)}</option>`).join('')}</select>`
    : type === 'checkbox'
      ? `<input id="${id}" type="checkbox" data-path="${path}"${value ? ' checked' : ''}>`
      : `<input id="${id}" type="${type}" data-path="${path}" value="${escape(value ?? '')}"${type === 'number' ? constraints(path) : ' maxlength="200"'}${type === 'number' ? ' inputmode="decimal"' : ''}>`;
  return `<div class="dcf-field${def.reference ? ' dcf-reference' : ''}"><label for="${id}">${escape(def.label)}</label>${input}<details class="dcf-help"><summary>Help: ${escape(def.label)}</summary><p>${escape(def.help)}</p></details></div>`;
}
function renderInputs() {
  root.querySelector('[data-dcf-inputs]').innerHTML = scalarGroups.map(([label, paths], i) => `<details${i === 0 ? ' open' : ''}><summary>${label}</summary><div class="dcf-fields">${paths.map(path => {
    const def = SCALAR_FIELDS.find(f => f.path === path);
    if (!def) throw new Error('Missing input definition: ' + path);
    return field(def, path);
  }).join('')}</div></details>`).join('') + Object.entries(groupNames).map(([key, label]) => `<details><summary>${label}</summary><div class="dcf-fields">${MODEL_FIELDS[key].map(def => field(def, `dcf_model.${key}.${def.key}`)).join('')}</div></details>`).join('');
  root.querySelector('[data-dcf-tenants]').innerHTML = state.dcf_model.rentRoll.map((row, i) => `<details><summary>Lease ${i + 1} (optional)</summary>
    <p>Use hypothetical labels, not confidential tenant data. A row with rent or area activates the rent-roll engine; scheduled rent is then not used as a vacancy fallback.</p>
    <div class="dcf-fields">${MODEL_FIELDS.rentRoll.map(def => field(def, `dcf_model.rentRoll.${i}.${def.key}`)).join('')}</div>
    <button type="button" class="btn btn-outline btn-small" data-remove-tenant="${i}"${state.dcf_model.rentRoll.length === 1 ? ' disabled' : ''}>Remove lease ${i + 1}</button></details>`).join('');
  root.querySelector('[data-dcf-scenario-inputs]').innerHTML = field({label:'Active scenario',help:'The selected scenario applies to the cash-flow grid and investment metrics. Blank overrides use the main assumptions; deltas are percentage points, not market forecasts.',type:'select',options:['base','upside','downside']},'dcf_model.scenarioName')
    + ['base','upside','downside'].map(key=>`<details><summary>${key[0].toUpperCase()+key.slice(1)} scenario</summary><div class="dcf-fields">${Object.entries({
      rentGrowth:'Rent growth override (%)',expenseGrowth:'Expense growth override (%)',exitCapRate:'Exit cap override (%)',vacancyRate:'Vacancy override (%)',loanAmount:'Loan override ($)',holdPeriod:'Hold override (whole years)',
      rentGrowthDelta:'Rent growth delta (percentage points)',expenseGrowthDelta:'Expense growth delta (percentage points)',exitCapRateDelta:'Exit cap delta (percentage points)',vacancyDelta:'Vacancy delta (percentage points)',
    }).map(([fieldName,label])=>field({label,help:'Hypothetical scenario assumption. Blank absolute overrides use the corresponding main input; percentage-point deltas then apply.'},`dcf_model.scenarios.${key}.${fieldName}`)).join('')}</div></details>`).join('');
  applyLock();
}
function applyLock() {
  const locked = state.dcf_model.governance.inputsLocked;
  for (const input of root.querySelectorAll('[data-path]')) input.disabled = locked && input.dataset.path !== 'dcf_model.governance.inputsLocked';
  root.querySelector('[data-add-tenant]').disabled = locked;
}
function validate() {
  const issues = [];
  for (const input of root.querySelectorAll('input[type="number"]')) if (!input.validity.valid) {
    const label = root.querySelector(`label[for="${input.id}"]`)?.textContent || input.getAttribute('aria-label');
    issues.push(`${label}: enter a number within the shown input limits.`);
  }
  const n = key => Number(state[key] || 0);
  if (n('price') <= 0) issues.push('Enter a positive purchase price to calculate investment returns.');
  if (!Number.isInteger(n('hold_period')) || n('hold_period') < 1 || n('hold_period') > 10) issues.push('Hold period must be a whole number from 1 to 10.');
  if (n('exit_cap_rate') <= 0) issues.push('Enter a positive exit cap rate to model a sale.');
  if (n('loan_amount') >= n('price') + n('closing_costs') && n('loan_amount') > 0) issues.push('Initial loan must be below the acquisition cost for equity returns.');
  if (n('loan_amount') > 0 && n('amortization_term') <= 0) issues.push('A loan requires a positive amortization term, including after an interest-only period.');
  if (n('refi_year') > n('hold_period')) issues.push('Refinance year cannot be after the hold period.');
  for (const [i, row] of state.dcf_model.rentRoll.entries()) {
    const start = (Number(row.leaseStartYear)-1)*12+Number(row.leaseStartMonth);
    const end = (Number(row.leaseEndYear)-1)*12+Number(row.leaseEndMonth);
    if (end < start) issues.push(`Lease ${i+1}: expiration cannot precede commencement.`);
    if (Number(row.contractionSf || 0) > Number(row.leasedSf || 0) + Number(row.expansionSf || 0)) issues.push(`Lease ${i+1}: contraction cannot exceed area.`);
  }
  if (state.dcf_model.debtTerms.rateFloorPct !== '' && state.dcf_model.debtTerms.rateCapPct !== '' && Number(state.dcf_model.debtTerms.rateFloorPct) > Number(state.dcf_model.debtTerms.rateCapPct)) issues.push('Floating-rate floor cannot exceed the cap.');
  const active = scenarioProperty(state,state.dcf_model.scenarioName);
  if (!scenarioValid(active)) issues.push('The active scenario must have a positive exit cap, growth above -100%, vacancy from 0 to 100%, a whole-number hold from 1 to 10, and a loan below acquisition cost.');
  const status = root.querySelector('[data-dcf-errors]');
  status.hidden = !issues.length;
  status.textContent = issues.join(' ');
  return !issues.length;
}
function format(value, type) {
  if (value === null || !Number.isFinite(value)) return 'Not defined';
  return type === 'money' ? money.format(value) : type === 'percent' ? (value * 100).toFixed(2) + '%' : value.toFixed(2) + 'x';
}
function tone(key, value) {
  if (value === null) return '';
  const thresholds = { dscr:[1.25,1], capRate:[.07,.05], cashOnCash:[.08,.04], leveredIrr:[.15,.08], debtYield:[.10,.08], yieldOnCost:[.08,.06] };
  const cut = thresholds[key];
  return cut ? value >= cut[0] ? 'Healthy' : value >= cut[1] ? 'Watch' : 'Risk' : '';
}
function renderMetrics() {
  root.querySelector('[data-dcf-metrics]').innerHTML = METRICS.map(([key,label,type,help]) => {
    const value = currentMetrics?.[key] ?? null, category = tone(key,value);
    return `<div class="dcf-metric"><dt>${label}<details class="dcf-help"><summary>Help: ${label}</summary><p>${escape(help)}</p></details></dt><dd><output data-metric="${key}">${format(value,type)}</output>${category ? `<span class="dcf-signal dcf-${category.toLowerCase()}">${category}</span>` : ''}</dd></div>`;
  }).join('');
}
function renderGrid() {
  const monthly = state.dcf_model.timing.viewMode === 'monthly';
  const hold = Math.min(10,Math.max(1,Math.floor(Number(scenarioProperty(state,state.dcf_model.scenarioName).hold_period || 1))));
  const periods = currentModel ? monthly ? currentModel.months : currentModel.years.slice(0,hold) : [];
  const size = monthly ? 4 : 3;
  columnStart = Math.max(0,Math.min(columnStart,Math.max(0,periods.length-size)));
  const visible = periods.slice(columnStart,columnStart+size);
  root.querySelector('[data-dcf-periods]').textContent = `Showing ${periods.length ? columnStart+1 : 0} to ${columnStart+visible.length} of ${periods.length} ${monthly ? 'months' : 'years'}`;
  root.querySelector('[data-dcf-prev]').disabled = columnStart === 0;
  root.querySelector('[data-dcf-next]').disabled = columnStart+size >= periods.length;
  root.querySelector('[data-dcf-view]').value = monthly ? 'monthly' : 'yearly';
  const header = `<thead><tr><th scope="col">Line item (USD)</th>${visible.map(p=>`<th scope="col">${monthly ? 'Month '+p.month : 'Year '+p.year}</th>`).join('')}</tr></thead>`;
  const body = DCF_GROUPS.map(group => `<tr class="dcf-group"><th colspan="${visible.length+1}" scope="colgroup">${group.label}</th></tr>` + DCF_ROW_DEFS.filter(row=>row.group===group.key).map(row => {
    const writable = editableRows.has(row.key) && !monthly;
    return `<tr${row.subtotal ? ' class="dcf-subtotal"' : ''}><th scope="row">${row.label}${row.help ? `<details class="dcf-help"><summary>Formula</summary><p>${escape(row.help)}</p></details>` : ''}<small>${writable ? 'Annual assumption override' : 'Computed'}</small></th>${visible.map(p => {
      const formula = getComputedDcfValue(p,row.key);
      const value = formula ?? Number(p[row.key] || 0);
      return `<td>${writable ? `<input type="number" min="0" max="1000000000000" step="any" inputmode="decimal" data-annual-year="${p.year-1}" data-annual-key="${row.key}" aria-label="${row.label}, Year ${p.year}" value="${escape(state.dcf_model.annualOverrides[p.year-1]?.[row.key] ?? '')}" placeholder="${escape(String(value))}"${state.dcf_model.governance.inputsLocked ? ' disabled' : ''}><small>${money.format(value)} modeled</small>` : `<output>${money.format(value)}</output>`}</td>`;
    }).join('')}</tr>`;
  }).join('')).join('');
  root.querySelector('[data-dcf-grid]').innerHTML = `<caption>Discounted cash flow: ${monthly ? 'monthly computed values' : 'annual values with optional overrides'}</caption>${header}<tbody>${body}</tbody>`;
}
function calculate() {
  const valid = validate();
  const active = scenarioProperty(state,state.dcf_model.scenarioName);
  currentModel = valid ? buildDefaultDcfModelFromProperty(active) : null;
  currentMetrics = valid ? summarize(active,currentModel) : null;
  if (currentMetrics && Object.values(currentMetrics).some(v => typeof v === 'number' && !Number.isFinite(v))) throw new Error('Calculation produced a non-finite result.');
  renderMetrics();
  renderGrid();
  renderComparisons(valid);
  root.querySelector('[data-dcf-export]').disabled = !valid;
}
function renderComparisons(valid) {
  const run = property => scenarioValid(property) ? summarize(property) : {};
  const rows = valid ? ['base','upside','downside'].map(key=>[key,run(scenarioProperty(state,key))]) : [];
  const active = scenarioProperty(state,state.dcf_model.scenarioName);
  const sensitivity = [
    ['Exit cap +50 bps',{exit_cap_rate:Number(active.exit_cap_rate)+.5}],
    ['Rent growth -100 bps',{rent_growth:Number(active.rent_growth)-1}],
    ['Vacancy +100 bps',{vacancy_rate:Number(active.vacancy_rate)+1}],
    ['Loan +5% of price',{loan_amount:Number(active.loan_amount)+Number(active.price)*.05}],
    ['Hold -1 year',{hold_period:Math.max(1,Number(active.hold_period)-1)}],
  ];
  const table = items => `<thead><tr><th scope="col">Case</th><th scope="col">Levered IRR</th><th scope="col">EMx</th><th scope="col">DSCR</th><th scope="col">Exit value</th></tr></thead><tbody>${items.map(([label,m])=>`<tr><th scope="row">${escape(label)}</th><td>${format(m.leveredIrr,'percent')}</td><td>${format(m.leveredEmx,'multiple')}</td><td>${format(m.dscr,'multiple')}</td><td>${format(m.exitValue,'money')}</td></tr>`).join('')}</tbody>`;
  root.querySelector('[data-dcf-comparison]').innerHTML = '<caption>Hypothetical scenario comparison</caption>' + table(rows);
  root.querySelector('[data-dcf-sensitivity]').innerHTML = '<caption>One-variable sensitivity from the active scenario (Not defined = invalid assumptions)</caption>' + table(valid ? sensitivity.map(([label,overrides])=>[label,run({...active,...overrides})]) : []);
}
function scenarioValid(property) {
  const scenario = property.dcf_model.scenarios[property.dcf_model.scenarioName] || {};
  const hold = Number(property.hold_period);
  const vacancy = Number(property.vacancy_rate || 0) + Number(scenario.vacancyDelta || 0);
  return Number(property.exit_cap_rate || 0) + Number(scenario.exitCapRateDelta || 0) > 0
    && Number(property.rent_growth || 0) + Number(scenario.rentGrowthDelta || 0) > -100
    && Number(property.expense_growth || 0) + Number(scenario.expenseGrowthDelta || 0) > -100
    && vacancy >= 0 && vacancy <= 100 && Number.isInteger(hold) && hold >= 1 && hold <= 10
    && Number(property.loan_amount || 0) < Number(property.price || 0) + Number(property.closing_costs || 0);
}
function refresh() { renderInputs();calculate(); }
function loadIllustration() {
  state = blankState();
  Object.assign(state,{price:'1000000',closing_costs:'20000',gross_scheduled_rent:'150000',vacancy_rate:'5',operating_expenses:'25000',property_taxes:'15000',insurance:'5000',management_fee_pct:'3',reserves_capex:'5000',loan_amount:'600000',interest_rate:'6',amortization_term:'25',hold_period:'10',exit_cap_rate:'8',cost_of_sale:'2',irr:'10',square_feet:'20000'});
  columnStart = 0;
  root.querySelector('[data-dcf-mode]').textContent = 'Illustration loaded: hypothetical amounts, not market data or a real property.';
  refresh();
}
if (root) {
  state = blankState();
  root.querySelector('[data-dcf-body]').hidden = false;
  root.querySelector('[data-dcf-unavailable]').hidden = true;
  root.addEventListener('input',event => {
    const input = event.target;
    if (!input.dataset.path) return;
    set(input.dataset.path,input.type === 'checkbox' ? input.checked : input.value);
    if (input.dataset.path === 'dcf_model.timing.viewMode') columnStart = 0;
    applyLock();
    calculate();
  });
  root.addEventListener('change',event => {
    const input = event.target;
    if (!input.dataset.annualKey) return;
    if (!input.validity.valid) { calculate(); return; }
    set(`dcf_model.annualOverrides.${input.dataset.annualYear}.${input.dataset.annualKey}`,input.value);
    calculate();
  });
  root.addEventListener('click',event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-dcf-example')) loadIllustration();
    if (button.hasAttribute('data-dcf-reset')) {
      state = blankState();columnStart = 0;
      root.querySelector('[data-dcf-mode]').textContent = 'Blank model. Entries stay only in this page’s memory and disappear on reload.';
      refresh();
    }
    if (button.hasAttribute('data-dcf-prev') || button.hasAttribute('data-dcf-next')) {
      columnStart += (button.hasAttribute('data-dcf-prev') ? -1 : 1) * (state.dcf_model.timing.viewMode === 'monthly' ? 4 : 3);
      renderGrid();
    }
    if (button.hasAttribute('data-add-tenant')) {
      state.dcf_model.rentRoll.push(normalizeRentRollRow({}));
      refresh();
    }
    if (button.dataset.removeTenant !== undefined) { state.dcf_model.rentRoll.splice(Number(button.dataset.removeTenant),1);refresh(); }
    if (button.hasAttribute('data-dcf-export')) {
      const years = currentModel.years.slice(0,Number(scenarioProperty(state,state.dcf_model.scenarioName).hold_period));
      const rows = [['Illustrative model, not advice',...years.map(p=>'Year '+p.year)],...DCF_ROW_DEFS.map(row=>[row.label,...years.map(p=>getComputedDcfValue(p,row.key) ?? Number(p[row.key] || 0))])];
      const csv = rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link = document.createElement('a');link.href = url;link.download = 'commercial-property-dcf.csv';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  });
  root.querySelector('[data-dcf-view]').addEventListener('change',event=>{state.dcf_model.timing.viewMode=event.target.value;columnStart=0;renderInputs();calculate();});
  refresh();
}
