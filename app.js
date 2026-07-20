// ── HTML escape helper ──────────────────────────
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Brute-force login protection ────────────────
const _BF_MAX = 5, _BF_MS = 15 * 60 * 1000;
function _bfGet(){ try{ return JSON.parse(sessionStorage.getItem('_lka')||'{}'); }catch{ return {}; } }
function _bfFail(){ const d=_bfGet(); d.n=(d.n||0)+1; if(d.n>=_BF_MAX) d.u=Date.now()+_BF_MS; sessionStorage.setItem('_lka',JSON.stringify(d)); }
function _bfReset(){ sessionStorage.removeItem('_lka'); }
function _bfMinsLeft(){ const d=_bfGet(); return (d.u&&Date.now()<d.u)?Math.ceil((d.u-Date.now())/60000):0; }

// Sidebar init: ensure nav-groups have explicit display state on load
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.nav-group').forEach(function(g){ g.style.display = ''; });
});

// ===================== SUPABASE CONFIG =====================
// TODO: Replace these with your actual Supabase project values
// Auto-reset if ?cleardata=1 in URL
(function(){
  const p = new URLSearchParams(location.search);
  if(p.get('cleardata')==='1'){
    localStorage.removeItem('ibg_accounts_v2');
    location.href = location.origin + location.pathname;
  }
})();

const SUPABASE_URL  = 'https://zkklsfpqbbzsyrmrghib.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpra2xzZnBxYmJ6c3lybXJnaGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTI2ODQsImV4cCI6MjA5NzQyODY4NH0.ccaFZWFs_p8Vxc4QAWD3ptmXvbb7V7mx874HWReyhbk';
const DB_ROW_ID     = 'ibg_main';

let _sb   = null;   // Supabase client
let _user = null;
let _isAdmin = false;   // signed-in user

function _initSupabase(){
  if(SUPABASE_URL && SUPABASE_ANON){
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false }
    });
    return true;
  }
  return false;
}

async function _syncUp(){
  if(!_sb || !_user) return;
  const {error} = await _sb.from('app_data')
    .upsert({id:DB_ROW_ID, data:DB, updated_at:new Date().toISOString()});
  if(error) console.warn('[Fintiv] cloud sync error:', error.message);
}

async function _pullDown(){
  if(!_sb) return false;
  try{
    const {data,error} = await _sb.from('app_data')
      .select('data').eq('id',DB_ROW_ID).single();
    if(data?.data){
      DB = Object.assign(defaultDB(), data.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
      return true;
    }
  }catch(e){ console.warn('[Fintiv] cloud pull error:',e); }
  return false;
}

// ===================== DATA STORE =====================
const STORAGE_KEY = 'ibg_accounts_v2';
let DB = defaultDB();

function loadDB(){
  try{
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(s) DB = Object.assign(defaultDB(), s);
  }catch(e){}
  return DB;
}
function saveDB(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  _syncUp(); // fire-and-forget
}
function defaultDB(){
  const today = new Date().toISOString().slice(0,10);
  const y = new Date().getFullYear();
  return {
    settings:{ company:'IBG Corporate & Training Asia', reg:'', country:'Singapore',
      tax:'', email:'', phone:'',
      address:'', invPrefix:'IBG-INV-',
      terms:30, taxRate:9, fy:'Jan' },
    invoices:[],
    payments:[],
    expenses:[],
    bills:[],
    clients:[],
    journal:[],
    chartOfAccounts:[
      {code:'1000',name:'Cash & Cash Equivalents',type:'Asset',category:'Current Assets',desc:'Cash in bank and cash equivalents',active:true},
      {code:'1010',name:'Petty Cash',type:'Asset',category:'Current Assets',desc:'Petty cash fund',active:true},
      {code:'1100',name:'Accounts Receivable',type:'Asset',category:'Current Assets',desc:'Amounts owed by customers',active:true},
      {code:'1110',name:'Other Receivables',type:'Asset',category:'Current Assets',desc:'Other amounts receivable',active:true},
      {code:'1200',name:'Prepaid Expenses',type:'Asset',category:'Current Assets',desc:'Expenses paid in advance',active:true},
      {code:'1300',name:'Inventory',type:'Asset',category:'Current Assets',desc:'Stock on hand',active:true},
      {code:'1500',name:'Property, Plant & Equipment',type:'Asset',category:'Non-current Assets',desc:'Fixed assets at cost',active:true},
      {code:'1510',name:'Accumulated Depreciation',type:'Asset',category:'Non-current Assets',desc:'Accumulated depreciation on fixed assets',active:true},
      {code:'2000',name:'Accounts Payable',type:'Liability',category:'Current Liabilities',desc:'Amounts owed to suppliers',active:true},
      {code:'2100',name:'Accrued Liabilities',type:'Liability',category:'Current Liabilities',desc:'Expenses incurred but not yet paid',active:true},
      {code:'2200',name:'GST / VAT Payable',type:'Liability',category:'Current Liabilities',desc:'Tax collected from customers',active:true},
      {code:'2210',name:'GST / VAT Receivable',type:'Asset',category:'Current Assets',desc:'Tax paid to suppliers',active:true},
      {code:'2300',name:'Short-term Loans',type:'Liability',category:'Current Liabilities',desc:'Loans due within 12 months',active:true},
      {code:'2500',name:'Long-term Loans',type:'Liability',category:'Non-current Liabilities',desc:'Loans due after 12 months',active:true},
      {code:'3000',name:'Share Capital',type:'Equity',category:'Equity',desc:'Paid-up share capital',active:true},
      {code:'3100',name:'Retained Earnings',type:'Equity',category:'Equity',desc:'Accumulated profits / losses',active:true},
      {code:'3200',name:'Opening Balance Equity',type:'Equity',category:'Equity',desc:'Opening balance adjustments',active:true},
      {code:'3300',name:"Owner's Drawings",type:'Equity',category:'Equity',desc:'Withdrawals by owner',active:true},
      {code:'4000',name:'Consulting Revenue',type:'Revenue',category:'Revenue',desc:'Income from consulting services',active:true},
      {code:'4100',name:'Service Revenue',type:'Revenue',category:'Revenue',desc:'Income from services rendered',active:true},
      {code:'4200',name:'Product Sales',type:'Revenue',category:'Revenue',desc:'Income from product sales',active:true},
      {code:'4300',name:'Interest Income',type:'Revenue',category:'Other Income',desc:'Interest earned on deposits',active:true},
      {code:'4400',name:'Other Income',type:'Revenue',category:'Other Income',desc:'Miscellaneous income',active:true},
      {code:'5000',name:'Cost of Goods Sold',type:'Expense',category:'Cost of Sales',desc:'Direct cost of products sold',active:true},
      {code:'5100',name:'Direct Labor',type:'Expense',category:'Cost of Sales',desc:'Labor directly tied to revenue',active:true},
      {code:'5200',name:'Subcontractor Costs',type:'Expense',category:'Cost of Sales',desc:'Outsourced delivery costs',active:true},
      {code:'6000',name:'Salaries & Wages',type:'Expense',category:'Operating Expenses',desc:'Staff salaries and wages',active:true},
      {code:'6010',name:'Employee Benefits',type:'Expense',category:'Operating Expenses',desc:'CPF, insurance, medical',active:true},
      {code:'6100',name:'Rent & Utilities',type:'Expense',category:'Operating Expenses',desc:'Office rent and utilities',active:true},
      {code:'6110',name:'Office Supplies',type:'Expense',category:'Operating Expenses',desc:'Stationery and office consumables',active:true},
      {code:'6200',name:'Travel & Entertainment',type:'Expense',category:'Operating Expenses',desc:'Travel, meals, and entertainment',active:true},
      {code:'6300',name:'Marketing & Advertising',type:'Expense',category:'Operating Expenses',desc:'Promotions and advertising spend',active:true},
      {code:'6400',name:'Professional Fees',type:'Expense',category:'Operating Expenses',desc:'General professional services',active:true},
      {code:'6410',name:'Legal Fees',type:'Expense',category:'Operating Expenses',desc:'Legal and secretarial services',active:true},
      {code:'6420',name:'Audit & Accounting Fees',type:'Expense',category:'Operating Expenses',desc:'Audit, tax, and accounting',active:true},
      {code:'6500',name:'Technology & Software',type:'Expense',category:'Operating Expenses',desc:'IT subscriptions and software',active:true},
      {code:'6600',name:'Depreciation & Amortization',type:'Expense',category:'Operating Expenses',desc:'Asset depreciation charges',active:true},
      {code:'6700',name:'Insurance',type:'Expense',category:'Operating Expenses',desc:'Business insurance premiums',active:true},
      {code:'6800',name:'Bank Charges & Interest',type:'Expense',category:'Operating Expenses',desc:'Bank fees and interest paid',active:true},
      {code:'6900',name:'Miscellaneous Expenses',type:'Expense',category:'Operating Expenses',desc:'Other operating expenses',active:true},
      {code:'7000',name:'Foreign Exchange Gain/(Loss)',type:'Expense',category:'Other',desc:'FX gains or losses',active:true},
      {code:'7100',name:'Interest Expense',type:'Expense',category:'Other',desc:'Interest on borrowings',active:true},
    ],
    nextCOACode: 9000,
    quotes: [],
    purchaseOrders: [],
    budgets: [],
    auditLog: [],
    bankStatements: [],
    nextQuoteNum: 1,
    nextPONum: 1,
    nextInvNum: 1,
    nextPayNum: 1,
    nextExpNum: 1,
    nextBillNum: 1,
    nextJrnNum: 1,
    nextStmtNum: 1,
  };
}


// ===================== CHART OF ACCOUNTS =====================

function coaOptions(filterType){
  const accounts = (DB.chartOfAccounts||[]).filter(a=>a.active && (!filterType||a.type===filterType));
  return accounts.map(a=>`<option value="${a.code}">${a.code} – ${a.name}</option>`).join('');
}

function populateCOASelects(){
  // Expense: expense accounts (type Expense + all)
  const expSel = document.getElementById('exp-account');
  if(expSel){ expSel.innerHTML='<option value="">— Select account —</option>'+coaOptions('Expense'); }
  // Bill: expense/liability
  const billSel = document.getElementById('bill-account');
  if(billSel){ billSel.innerHTML='<option value="">— Select account —</option>'+coaOptions('Expense')+'<option disabled>──────────</option>'+coaOptions('Liability'); }
  // Journal: all
  const jdSel = document.getElementById('jrn-debit-acc');
  const jcSel = document.getElementById('jrn-credit-acc');
  const allOpts = '<option value="">— Select account —</option>'+coaOptions('');
  if(jdSel) jdSel.innerHTML=allOpts;
  if(jcSel) jcSel.innerHTML=allOpts;
}

function renderCOA(){
  const q = (document.getElementById('coa-search')||{value:''}).value.toLowerCase();
  const tf = (document.getElementById('coa-type-filter')||{value:''}).value;
  const list = (DB.chartOfAccounts||[]).filter(a=>{
    const matchQ = !q || a.code.includes(q) || a.name.toLowerCase().includes(q) || (a.category||'').toLowerCase().includes(q);
    const matchT = !tf || a.type===tf;
    return matchQ && matchT;
  });
  const cnt = document.getElementById('coa-count');
  if(cnt) cnt.textContent = list.length + ' account' + (list.length!==1?'s':'');

  const typeColors = {Asset:'#5F9E82',Liability:'#C9956C',Equity:'#8B3A5A',Revenue:'#3B7DD8',Expense:'#888'};

  const tbody = list.map(a=>`
    <tr>
      <td style="font-family:monospace;font-weight:600">${a.code}</td>
      <td>${a.name}${a.active?'':' <span style="font-size:.65rem;opacity:.5">(inactive)</span>'}</td>
      <td><span style="background:${typeColors[a.type]||'#aaa'}22;color:${typeColors[a.type]||'#444'};padding:2px 8px;border-radius:10px;font-size:.75rem">${a.type}</span></td>
      <td style="opacity:.65;font-size:.85rem">${a.category||''}</td>
      <td style="opacity:.55;font-size:.8rem">${a.desc||''}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openCOAModal('${a.code}')">Edit</button>
        <button class="btn btn-outline btn-sm" style="color:#c0392b" onclick="toggleCOA('${a.code}')">${a.active?'Deactivate':'Activate'}</button>
      </td>
    </tr>`).join('');

  document.getElementById('coa-table').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th>Category</th><th>Description</th><th>Actions</th></tr></thead>
      <tbody>${tbody||'<tr><td colspan="6" style="text-align:center;padding:32px;opacity:.4">No accounts found</td></tr>'}</tbody>
    </table>`;
}

function openCOAModal(code=null){
  populateCOASelects(); // keep selects fresh
  const modal = document.getElementById('modal-coa');
  const title = document.getElementById('coa-modal-title');
  if(code){
    const a = (DB.chartOfAccounts||[]).find(x=>x.code===code);
    if(!a) return;
    title.textContent = 'Edit Account';
    document.getElementById('coa-code').value = a.code;
    document.getElementById('coa-code').disabled = true;
    document.getElementById('coa-name').value = a.name;
    document.getElementById('coa-type').value = a.type;
    document.getElementById('coa-category').value = a.category||'';
    document.getElementById('coa-desc').value = a.desc||'';
    document.getElementById('coa-active').checked = a.active;
    modal._editCode = code;
  } else {
    title.textContent = 'Add Account';
    document.getElementById('coa-code').value = '';
    document.getElementById('coa-code').disabled = false;
    document.getElementById('coa-name').value = '';
    document.getElementById('coa-type').value = 'Expense';
    document.getElementById('coa-category').value = 'Operating Expenses';
    document.getElementById('coa-desc').value = '';
    document.getElementById('coa-active').checked = true;
    modal._editCode = null;
  }
  modal.style.display = 'flex';
}

function saveCOA(){
  const code = document.getElementById('coa-code').value.trim();
  const name = document.getElementById('coa-name').value.trim();
  if(!code || !name){ alert('Account code and name are required.'); return; }
  const modal = document.getElementById('modal-coa');
  if(!DB.chartOfAccounts) DB.chartOfAccounts=[];
  if(modal._editCode){
    const idx = DB.chartOfAccounts.findIndex(a=>a.code===modal._editCode);
    if(idx>-1){
      DB.chartOfAccounts[idx] = {
        code: modal._editCode, // code cannot change
        name, type:document.getElementById('coa-type').value,
        category:document.getElementById('coa-category').value,
        desc:document.getElementById('coa-desc').value,
        active:document.getElementById('coa-active').checked
      };
    }
  } else {
    if(DB.chartOfAccounts.find(a=>a.code===code)){ alert('Account code '+code+' already exists.'); return; }
    DB.chartOfAccounts.push({
      code, name, type:document.getElementById('coa-type').value,
      category:document.getElementById('coa-category').value,
      desc:document.getElementById('coa-desc').value,
      active:document.getElementById('coa-active').checked
    });
    DB.chartOfAccounts.sort((a,b)=>a.code.localeCompare(b.code));
  }
  saveDB(); closeModal('modal-coa'); renderCOA();
}

function toggleCOA(code){
  const a = (DB.chartOfAccounts||[]).find(x=>x.code===code);
  if(!a) return;
  a.active = !a.active;
  saveDB(); renderCOA();
}

// COA selects are populated directly inside each modal function (see below)

// ===================== BANK STATEMENTS =====================
// Store-only — no parsing/reconciliation. Files live in the Supabase
// Storage bucket "bank-statements" (private); DB.bankStatements only holds
// metadata (filename, storage path, date, note). Requires the "Bank
// Statements" section to have been signed in via cloud mode — there is no
// local-only fallback, since a file needs somewhere durable to live.

function openBankStatementModal(){
  document.getElementById('stmt-file').value = '';
  document.getElementById('stmt-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('stmt-note').value = '';
  document.getElementById('modal-bankstatement').classList.add('open');
}

async function saveBankStatement(){
  if(!useCloud || !currentUser || !_sb){
    alert('Sign in to upload bank statements — files are stored in cloud storage, not locally.');
    return;
  }
  const fileInput = document.getElementById('stmt-file');
  const file = fileInput.files[0];
  if(!file){ alert('Choose a file to upload.'); return; }

  const btn = document.getElementById('btn-save-stmt');
  const originalLabel = btn.textContent;
  btn.disabled = true; btn.textContent = 'Uploading...';

  try{
    const id = `STMT-${String(DB.nextStmtNum).padStart(4,'0')}`;
    const ext = (file.name.split('.').pop()||'dat').toLowerCase();
    const path = `${currentUser.id}/${id}.${ext}`;
    const { error: upErr } = await _sb.storage.from('bank-statements').upload(path, file, { upsert:false });
    if(upErr) throw upErr;

    DB.bankStatements.push({
      id,
      filename: file.name,
      storagePath: path,
      date: document.getElementById('stmt-date').value || new Date().toISOString().slice(0,10),
      note: document.getElementById('stmt-note').value.trim(),
      uploadedAt: new Date().toISOString(),
    });
    DB.nextStmtNum++;
    saveDB();
    closeModal('modal-bankstatement');
    renderBankStatements();
  }catch(e){
    alert('Upload failed: ' + (e.message || 'Unknown error. Check that the "bank-statements" bucket exists in Supabase Storage.'));
  }finally{
    btn.disabled = false; btn.textContent = originalLabel;
  }
}

async function downloadBankStatement(id){
  const stmt = (DB.bankStatements||[]).find(s=>s.id===id);
  if(!stmt || !_sb) return;
  const { data, error } = await _sb.storage.from('bank-statements').createSignedUrl(stmt.storagePath, 60);
  if(error){ alert('Could not generate a download link: ' + error.message); return; }
  window.open(data.signedUrl, '_blank');
}

async function deleteBankStatement(id){
  if(!confirm('Delete this bank statement? This removes the file permanently.')) return;
  const stmt = (DB.bankStatements||[]).find(s=>s.id===id);
  if(stmt && _sb){
    const { error } = await _sb.storage.from('bank-statements').remove([stmt.storagePath]);
    if(error){ alert('Could not delete the file from storage: ' + error.message); return; }
  }
  DB.bankStatements = (DB.bankStatements||[]).filter(s=>s.id!==id);
  saveDB();
  renderBankStatements();
}

function renderBankStatements(){
  const q = (document.getElementById('stmt-search')||{value:''}).value.toLowerCase();
  const list = (DB.bankStatements||[]).filter(s =>
    !q || s.filename.toLowerCase().includes(q) || (s.note||'').toLowerCase().includes(q)
  );
  const countEl = document.getElementById('stmt-total');
  if(countEl) countEl.textContent = list.length + ' statement' + (list.length!==1?'s':'');

  const rows = list.slice().reverse().map(s => `
    <tr>
      <td>${esc(s.filename)}</td>
      <td>${esc(s.date||'')}</td>
      <td>${esc(s.note||'')}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="downloadBankStatement('${s.id}')">Download</button>
        <button class="btn btn-outline btn-sm" style="color:#c0392b" onclick="deleteBankStatement('${s.id}')">Delete</button>
      </td>
    </tr>`).join('');

  const tableEl = document.getElementById('bankstatements-table');
  if(tableEl) tableEl.innerHTML = `
    <table class="data-table">
      <thead><tr><th>File</th><th>Date</th><th>Note</th><th>Actions</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="text-align:center;padding:32px;opacity:.4">No bank statements uploaded yet</td></tr>'}</tbody>
    </table>`;
}

// ===================== CURRENCY =====================
const SYMBOLS = {SGD:'S$',PHP:'₱',USD:'$',MYR:'RM',KRW:'₩'};
const FX = {SGD:1,PHP:42,USD:0.74,MYR:3.28,KRW:985}; // approx to SGD

function fmt(amount, currency){
  const sym = SYMBOLS[currency] || currency+' ';
  if(currency==='KRW') return sym + Math.round(amount).toLocaleString();
  return sym + parseFloat(amount||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function toBase(amount, fromCur){
  const base = document.getElementById('baseCurrency').value;
  const inSGD = amount / (FX[fromCur]||1);
  return inSGD * (FX[base]||1);
}

function updateCurrency(){ renderDashboard(); }

// ===================== NAVIGATION =====================
const PAGE_TITLES = {
  dashboard:'Dashboard',invoices:'Invoices',payments:'Payments Received',
  expenses:'Expense Register',bills:'Bills & Payables',clients:'Clients & Accounts',
  coa:'Chart of Accounts',bankstatements:'Bank Statements',
  journal:'General Journal',pnl:'P&L Statement',balance:'Balance Sheet',
  cashflow:'Cash Flow Statement',quotes:'Quotes & Estimates',purchaseorders:'Purchase Orders',budgets:'Budget vs Actual',settings:'Company Settings'
};

function confirmResetAllData(){
  if(!confirm('This will permanently delete ALL local data (invoices, clients, payments, expenses, etc.) and cannot be undone.\n\nAre you sure?')) return;
  if(!confirm('FINAL WARNING: All data will be erased. Proceed?')) return;
  localStorage.removeItem('ibg_accounts_v2');
  // Also reset Supabase cloud if connected
  if(_sb){
    _sb.from('app_data').update({data: {}}).eq('id', DB_ROW_ID).then(()=>{
      alert('All data cleared. The app will now reload.');
      location.reload();
    }).catch(()=>{ alert('Local data cleared. The app will now reload.'); location.reload(); });
  } else {
    alert('All data cleared. The app will now reload.');
    location.reload();
  }
}

function toggleNavGroup(sectionEl){
  const group = sectionEl.nextElementSibling;
  if(!group || !group.classList.contains('nav-group')) return;
  if(group.style.display === 'none'){
    group.style.display = '';
    sectionEl.classList.remove('collapsed');
  } else {
    group.style.display = 'none';
    sectionEl.classList.add('collapsed');
  }
}

function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a=>a.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('nav a').forEach(a=>{
    if(a.getAttribute('onclick')&&a.getAttribute('onclick').includes(`'${name}'`)) a.classList.add('active');
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[name]||name;
  if(name==='dashboard') renderDashboard();
  if(name==='invoices') renderInvoices();
  if(name==='payments') renderPayments();
  if(name==='expenses') renderExpenses();
  if(name==='bills') renderBills();
  if(name==='clients') renderClients();
  if(name==='coa') renderCOA();
  if(name==='bankstatements') renderBankStatements();
  if(name==='journal') renderJournal();
  if(name==='pnl') renderPnL();
  if(name==='balance') renderBalance();
  if(name==='cashflow') renderCashflow();
  if(name==='quotes') renderQuotes();
  if(name==='purchaseorders') renderPurchaseOrders();
  if(name==='budgets') renderBudgets();
  if(name==='settings' && _sb) loadMFAStatus();
}

// ===================== HELPERS =====================
function getInvoiceTotal(inv){
  return inv.lines.reduce((s,l)=>{
    const sub=l.qty*l.price;
    return s+sub+(sub*(l.tax||0)/100);
  },0);
}
function getInvoiceSubtotal(inv){ return inv.lines.reduce((s,l)=>s+l.qty*l.price,0); }
function getInvoiceTax(inv){ return inv.lines.reduce((s,l)=>s+(l.qty*l.price*(l.tax||0)/100),0); }
function getClientName(id){ const c=DB.clients.find(x=>x.id===id); return c?c.name:'Unknown'; }
function getInvoiceBalance(inv){ return getInvoiceTotal(inv)-(inv.paid||0); }

function statusBadge(s){
  return `<span class="status ${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</span>`;
}

// ===================== DASHBOARD =====================
let charts = {};
function renderDashboard(){
  const base = document.getElementById('baseCurrency').value;
  const sym = SYMBOLS[base];

  // KPIs
  const totalRevenue = DB.invoices.filter(i=>i.status==='paid'||i.status==='partial')
    .reduce((s,i)=>s+toBase(i.paid||0,i.currency),0);
  const totalOutstanding = DB.invoices.filter(i=>i.status!=='paid'&&i.status!=='draft')
    .reduce((s,i)=>s+toBase(getInvoiceBalance(i),i.currency),0);
  const totalExpenses = DB.expenses.reduce((s,e)=>s+toBase(e.amount,e.currency),0);
  const totalBillsDue = DB.bills.filter(b=>b.status!=='paid').reduce((s,b)=>s+toBase(b.amount,b.currency),0);
  const netProfit = totalRevenue - totalExpenses;
  const overdueCount = DB.invoices.filter(i=>i.status==='overdue').length;

  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-card blue">
      <div class="kpi-label">Total Revenue Collected</div>
      <div class="kpi-value">${sym}${Math.round(totalRevenue).toLocaleString()}</div>
      <div class="kpi-sub up">↑ Paid invoices</div>
    </div>
    <div class="kpi-card orange">
      <div class="kpi-label">Outstanding Receivables</div>
      <div class="kpi-value">${sym}${Math.round(totalOutstanding).toLocaleString()}</div>
      <div class="kpi-sub ${overdueCount>0?'down':'up'}">${overdueCount} overdue invoice${overdueCount!==1?'s':''}</div>
    </div>
    <div class="kpi-card red">
      <div class="kpi-label">Total Expenses</div>
      <div class="kpi-value">${sym}${Math.round(totalExpenses).toLocaleString()}</div>
      <div class="kpi-sub">YTD expenses recorded</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">Net Profit</div>
      <div class="kpi-value">${sym}${Math.round(netProfit).toLocaleString()}</div>
      <div class="kpi-sub ${netProfit>=0?'up':'down'}">${netProfit>=0?'↑ Profitable':'↓ Loss position'}</div>
    </div>
    <div class="kpi-card blue">
      <div class="kpi-label">Bills Due</div>
      <div class="kpi-value">${sym}${Math.round(totalBillsDue).toLocaleString()}</div>
      <div class="kpi-sub down">${DB.bills.filter(b=>b.status==='overdue').length} overdue bills</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">Active Clients</div>
      <div class="kpi-value">${DB.clients.length}</div>
      <div class="kpi-sub">across ${[...new Set(DB.clients.map(c=>c.country))].length} countries</div>
    </div>
  `;

  // Charts
  renderCharts();

  // Recent invoices
  const ri = DB.invoices.slice(-5).reverse();
  document.getElementById('recent-invoices-table').innerHTML = `
    <table><thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${ri.map(i=>`<tr>
      <td class="fw-bold">${esc(i.id)}</td>
      <td>${esc(getClientName(i.clientId))}</td>
      <td>${fmt(getInvoiceTotal(i),i.currency)}</td>
      <td>${statusBadge(i.status)}</td>
    </tr>`).join('')}</tbody></table>`;

  // Recent bills
  const rb = DB.bills.filter(b=>b.status!=='paid').slice(0,5);
  document.getElementById('recent-bills-table').innerHTML = `
    <table><thead><tr><th>Bill</th><th>Vendor</th><th>Due</th><th>Amount</th></tr></thead>
    <tbody>${rb.map(b=>`<tr>
      <td class="fw-bold">${esc(b.ref)}</td><td>${esc(b.vendor)}</td>
      <td style="color:${b.status==='overdue'?'var(--danger)':'inherit'}">${esc(b.due)}</td>
      <td>${fmt(b.amount,b.currency)}</td>
    </tr>`).join('')}</tbody></table>`;
  renderActivityLog();
}

function renderCharts(){
  const months = ['Jan','Feb','Mar','Apr','May','Jun'];
  const revData = months.map((_,i)=>{
    const mo = String(i+1).padStart(2,'0');
    const yr = new Date().getFullYear();
    return DB.payments.filter(p=>p.date.startsWith(`${yr}-${mo}`))
      .reduce((s,p)=>s+toBase(p.amount,p.currency),0);
  });
  const expData = months.map((_,i)=>{
    const mo = String(i+1).padStart(2,'0');
    const yr = new Date().getFullYear();
    return DB.expenses.filter(e=>e.date.startsWith(`${yr}-${mo}`))
      .reduce((s,e)=>s+toBase(e.amount,e.currency),0);
  });

  const base = document.getElementById('baseCurrency').value;
  const sym = SYMBOLS[base];

  // Rev vs Exp
  if(charts.revExp) charts.revExp.destroy();
  charts.revExp = new Chart(document.getElementById('revExpChart'),{
    type:'bar',
    data:{labels:months,datasets:[
      {label:'Revenue',data:revData,backgroundColor:'rgba(95,158,130,.75)',borderRadius:5},
      {label:'Expenses',data:expData,backgroundColor:'rgba(192,57,43,.55)',borderRadius:5}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},
      scales:{y:{ticks:{callback:v=>sym+Math.round(v).toLocaleString()}}}}
  });

  // Invoice status
  const statusCounts = {paid:0,sent:0,overdue:0,draft:0,partial:0};
  DB.invoices.forEach(i=>statusCounts[i.status]=(statusCounts[i.status]||0)+1);
  if(charts.invStatus) charts.invStatus.destroy();
  charts.invStatus = new Chart(document.getElementById('invStatusChart'),{
    type:'doughnut',
    data:{labels:Object.keys(statusCounts),
      datasets:[{data:Object.values(statusCounts),
        backgroundColor:['#5F9E82','#8B3A5A','#c0392b','#9B7B70','#C9956C'],borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}
  });

  // Expense cats
  const cats = {};
  DB.expenses.forEach(e=>cats[e.cat]=(cats[e.cat]||0)+toBase(e.amount,e.currency));
  if(charts.expCat) charts.expCat.destroy();
  charts.expCat = new Chart(document.getElementById('expCatChart'),{
    type:'doughnut',
    data:{labels:Object.keys(cats),
      datasets:[{data:Object.values(cats),
        backgroundColor:['#8B3A5A','#C9956C','#5F9E82','#c0392b','#3B1F2B','#e67e22','#9B7B70'],
        borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}
  });

  // Cash flow
  const cfData = revData.map((r,i)=>r-expData[i]);
  const cumCF = cfData.reduce((acc,v)=>{acc.push((acc[acc.length-1]||0)+v);return acc;},[]);
  const cfAllZero = cumCF.every(v=>v===0);
  if(charts.cf) charts.cf.destroy();
  charts.cf = new Chart(document.getElementById('cashflowChart'),{
    type:'line',
    data:{labels:months,datasets:[{
      label:'Cumulative Cash Flow',data:cumCF,
      borderColor:'#8B3A5A',backgroundColor:'rgba(139,58,90,.1)',fill:true,tension:.4,pointRadius:4
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},
      scales:{y:{
        beginAtZero:true,
        suggestedMin: 0,
        suggestedMax: cfAllZero ? 100 : undefined,
        ticks:{callback:v=>sym+Math.round(v).toLocaleString()}
      }}}
  });
}

// ===================== INVOICES =====================
function renderInvoices(){
  const q=(document.getElementById('inv-search').value||'').toLowerCase();
  const f=document.getElementById('inv-filter').value;
  let list=DB.invoices.filter(i=>{
    const match=(i.id+getClientName(i.clientId)+i.status).toLowerCase().includes(q);
    const fs=!f||i.status===f;
    return match&&fs;
  });
  document.getElementById('inv-count').textContent=`${list.length} records`;
  document.getElementById('invoices-table').innerHTML=list.length?`
    <table><thead><tr><th>Invoice #</th><th>Client</th><th>Date</th><th>Due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${list.map(i=>`<tr>
      <td class="fw-bold">${esc(i.id)}</td>
      <td>${esc(getClientName(i.clientId))}</td>
      <td>${esc(i.date)}</td>
      <td style="color:${i.status==='overdue'?'var(--danger)':'inherit'}">${esc(i.due)}</td>
      <td>${fmt(getInvoiceTotal(i),i.currency)}</td>
      <td style="color:var(--accent2)">${fmt(i.paid||0,i.currency)}</td>
      <td style="color:${getInvoiceBalance(i)>0?'var(--warning)':'var(--accent2)'}">${fmt(getInvoiceBalance(i),i.currency)}</td>
      <td>${statusBadge(i.status)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editInvoice('${i.id}')">Edit</button>
        <button class="btn btn-success btn-sm" onclick="markPaid('${i.id}')">✓ Pay</button>
        <button class="btn btn-danger btn-sm" onclick="deleteInvoice('${i.id}')">✕</button>
      </td>
    </tr>`).join('')}</tbody></table>`
  :'<div class="empty-state"><p>No invoices found.</p></div>';
}

function openInvoiceModal(editId=null){
  const modal=document.getElementById('modal-invoice');
  const today=new Date().toISOString().slice(0,10);
  const dueDate=new Date(Date.now()+DB.settings.terms*86400000).toISOString().slice(0,10);
  document.getElementById('inv-modal-title').textContent=editId?'Edit Invoice':'New Invoice';
  // Populate client dropdown
  const csel=document.getElementById('inv-client');
  csel.innerHTML='<option value="">Select client...</option>'+DB.clients.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  if(editId){
    const inv=DB.invoices.find(i=>i.id===editId);
    if(!inv) return;
    document.getElementById('inv-number').value=inv.id;
    csel.value=inv.clientId;
    document.getElementById('inv-date').value=inv.date;
    document.getElementById('inv-due').value=inv.due;
    document.getElementById('inv-currency').value=inv.currency;
    document.getElementById('inv-status').value=inv.status;
    document.getElementById('inv-notes').value=inv.notes||'';
    document.getElementById('inv-lines-body').innerHTML='';
    inv.lines.forEach(l=>addInvoiceLine(l));
    modal._editId=editId;
  } else {
    const num=String(DB.nextInvNum).padStart(3,'0');
    document.getElementById('inv-number').value=DB.settings.invPrefix+num;
    csel.value='';
    document.getElementById('inv-date').value=today;
    document.getElementById('inv-due').value=dueDate;
    document.getElementById('inv-currency').value='SGD';
    document.getElementById('inv-status').value='draft';
    document.getElementById('inv-notes').value='';
    document.getElementById('inv-lines-body').innerHTML='';
    addInvoiceLine();
    modal._editId=null;
  }
  calcInvoiceTotals();
  modal.classList.add('open');
}

function addInvoiceLine(line=null){
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input class="inv-line" type="text" placeholder="Service / product description" value="${esc(line?line.desc:'')}" style="width:100%;padding:5px;border:1px solid var(--border);border-radius:5px;font-size:.82rem"></td>
    <td><input class="inv-qty" type="number" value="${line?line.qty:1}" min="0" step="0.01" style="width:70px;padding:5px;border:1px solid var(--border);border-radius:5px;font-size:.82rem" oninput="calcInvoiceTotals()"></td>
    <td><input class="inv-price" type="number" value="${line?line.price:0}" min="0" step="0.01" style="width:110px;padding:5px;border:1px solid var(--border);border-radius:5px;font-size:.82rem" oninput="calcInvoiceTotals()"></td>
    <td><input class="inv-tax" type="number" value="${line?line.tax:DB.settings.taxRate}" min="0" max="100" step=".5" style="width:60px;padding:5px;border:1px solid var(--border);border-radius:5px;font-size:.82rem" oninput="calcInvoiceTotals()"></td>
    <td class="inv-line-total fw-bold" style="white-space:nowrap">0.00</td>
    <td><button onclick="this.closest('tr').remove();calcInvoiceTotals()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:1.1rem">&times;</button></td>`;
  document.getElementById('inv-lines-body').appendChild(tr);
  calcInvoiceTotals();
}

function calcInvoiceTotals(){
  const cur=document.getElementById('inv-currency').value;
  const sym=SYMBOLS[cur]||cur+' ';
  let sub=0,tax=0;
  document.querySelectorAll('#inv-lines-body tr').forEach(tr=>{
    const qty=parseFloat(tr.querySelector('.inv-qty')?.value||0);
    const price=parseFloat(tr.querySelector('.inv-price')?.value||0);
    const t=parseFloat(tr.querySelector('.inv-tax')?.value||0);
    const lineTotal=qty*price;
    const lineTax=lineTotal*t/100;
    tr.querySelector('.inv-line-total').textContent=sym+(lineTotal+lineTax).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
    sub+=lineTotal; tax+=lineTax;
  });
  document.getElementById('inv-subtotal').textContent=sym+sub.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
  document.getElementById('inv-tax-total').textContent=sym+tax.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
  document.getElementById('inv-grand-total').textContent=sym+(sub+tax).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function saveInvoice(){
  const modal=document.getElementById('modal-invoice');
  const lines=[];
  document.querySelectorAll('#inv-lines-body tr').forEach(tr=>{
    lines.push({
      desc:tr.querySelector('.inv-line').value,
      qty:parseFloat(tr.querySelector('.inv-qty').value)||0,
      price:parseFloat(tr.querySelector('.inv-price').value)||0,
      tax:parseFloat(tr.querySelector('.inv-tax').value)||0,
    });
  });
  const inv={
    id:document.getElementById('inv-number').value,
    clientId:document.getElementById('inv-client').value,
    date:document.getElementById('inv-date').value,
    due:document.getElementById('inv-due').value,
    currency:document.getElementById('inv-currency').value,
    status:document.getElementById('inv-status').value,
    lines,
    notes:document.getElementById('inv-notes').value,
    paid:0,
  };
  if(!inv.clientId){alert('Please select a client.');return;}
  if(!inv.date||!inv.due){alert('Please fill in dates.');return;}
  if(modal._editId){
    const idx=DB.invoices.findIndex(i=>i.id===modal._editId);
    inv.paid=DB.invoices[idx].paid||0;
    DB.invoices[idx]=inv;
  } else {
    DB.invoices.push(inv);
    DB.nextInvNum++;
  }
  saveDB(); closeModal('modal-invoice'); renderInvoices();
}

function editInvoice(id){ openInvoiceModal(id); }

function deleteInvoice(id){
  if(!confirm('Delete this invoice?')) return;
  DB.invoices=DB.invoices.filter(i=>i.id!==id);
  saveDB(); renderInvoices();
}

function markPaid(id){
  const inv=DB.invoices.find(i=>i.id===id);
  if(!inv) return;
  inv.paid=getInvoiceTotal(inv);
  inv.status='paid';
  saveDB(); renderInvoices();
}

// ===================== PAYMENTS =====================
function renderPayments(){
  const q=(document.getElementById('pay-search').value||'').toLowerCase();
  const list=DB.payments.filter(p=>(p.id+p.ref+getClientName(p.clientId)).toLowerCase().includes(q));
  document.getElementById('payments-table').innerHTML=list.length?`
    <table><thead><tr><th>Ref</th><th>Invoice</th><th>Client</th><th>Date</th><th>Amount</th><th>Method</th><th>TXN Ref</th></tr></thead>
    <tbody>${list.map(p=>`<tr>
      <td class="fw-bold">${esc(p.id)}</td>
      <td>${esc(p.invoiceId)}</td>
      <td>${esc(getClientName(p.clientId))}</td>
      <td>${esc(p.date)}</td>
      <td style="color:var(--accent2);font-weight:700">${fmt(p.amount,p.currency)}</td>
      <td>${esc(p.method)}</td>
      <td class="text-muted">${esc(p.ref||'—')}</td>
    </tr>`).join('')}</tbody></table>`
  :'<div class="empty-state"><p>No payments recorded.</p></div>';
}

function openPaymentModal(){
  const modal=document.getElementById('modal-payment');
  document.getElementById('pay-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('pay-amount').value='';
  document.getElementById('pay-ref').value='';
  document.getElementById('pay-notes').value='';
  document.getElementById('pay-inv-total').value='';
  document.getElementById('pay-balance').value='';
  document.getElementById('pay-client').value='';
  // Fill invoice dropdown with unpaid invoices
  const sel=document.getElementById('pay-invoice');
  sel.innerHTML='<option value="">Select invoice...</option>'+
    DB.invoices.filter(i=>i.status!=='paid'&&i.status!=='draft').map(i=>
      `<option value="${esc(i.id)}">${esc(i.id)} - ${esc(getClientName(i.clientId))} - ${fmt(getInvoiceBalance(i),i.currency)}</option>`
    ).join('');
  sel.onchange=function(){
    const inv=DB.invoices.find(i=>i.id===this.value);
    if(inv){
      document.getElementById('pay-client').value=getClientName(inv.clientId);
      document.getElementById('pay-inv-total').value=fmt(getInvoiceTotal(inv),inv.currency);
      document.getElementById('pay-currency').value=inv.currency;
      document.getElementById('pay-amount').value=getInvoiceBalance(inv).toFixed(2);
      updatePaymentBalance();
    }
  };
  modal.classList.add('open');
}

function updatePaymentBalance(){
  const inv=DB.invoices.find(i=>i.id===document.getElementById('pay-invoice').value);
  if(!inv) return;
  const paid=parseFloat(document.getElementById('pay-amount').value)||0;
  const balance=getInvoiceBalance(inv)-paid;
  document.getElementById('pay-balance').value=fmt(balance,inv.currency);
}

function savePayment(){
  const invId=document.getElementById('pay-invoice').value;
  const inv=DB.invoices.find(i=>i.id===invId);
  if(!inv){alert('Select an invoice.');return;}
  const amount=parseFloat(document.getElementById('pay-amount').value)||0;
  if(amount<=0){alert('Enter a valid amount.');return;}
  const pay={
    id:`PAY-${String(DB.nextPayNum).padStart(3,'0')}`,
    invoiceId:invId,
    clientId:inv.clientId,
    amount,
    currency:document.getElementById('pay-currency').value,
    date:document.getElementById('pay-date').value,
    method:document.getElementById('pay-method').value,
    ref:document.getElementById('pay-ref').value,
    notes:document.getElementById('pay-notes').value,
  };
  DB.payments.push(pay);
  DB.nextPayNum++;
  inv.paid=(inv.paid||0)+amount;
  const balance=getInvoiceBalance(inv);
  if(balance<=0) inv.status='paid';
  else if(inv.paid>0) inv.status='partial';
  saveDB(); closeModal('modal-payment'); renderPayments();
}

// ===================== EXPENSES =====================
function renderExpenses(){
  const q=(document.getElementById('exp-search').value||'').toLowerCase();
  const f=document.getElementById('exp-filter').value;
  const list=DB.expenses.filter(e=>{
    const m=(e.desc+e.vendor+e.cat).toLowerCase().includes(q);
    const fs=!f||e.cat===f;
    return m&&fs;
  });
  const total=list.reduce((s,e)=>s+toBase(e.amount,e.currency),0);
  const base=document.getElementById('baseCurrency').value;
  document.getElementById('exp-total').textContent=`Total: ${SYMBOLS[base]}${Math.round(total).toLocaleString()} | ${list.length} records`;
  document.getElementById('expenses-table').innerHTML=list.length?`
    <table><thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Vendor</th><th>Amount</th><th>Tax</th><th>Method</th><th>Project</th><th></th></tr></thead>
    <tbody>${list.map(e=>`<tr>
      <td class="fw-bold">${esc(e.desc)}</td>
      <td><span class="pill">${esc(e.cat)}</span></td>
      <td>${esc(e.date)}</td>
      <td>${esc(e.vendor||'—')}</td>
      <td style="color:var(--danger);font-weight:600">${fmt(e.amount,e.currency)}</td>
      <td>${e.tax?fmt(e.tax,e.currency):'—'}</td>
      <td>${esc(e.method)}</td>
      <td class="text-muted">${esc(e.project||'—')}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editExpense('${e.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteExpense('${e.id}')">✕</button>
      </td>
    </tr>`).join('')}</tbody></table>`
  :'<div class="empty-state"><p>No expenses found.</p></div>';
}

function openExpenseModal(editId=null){
  document.getElementById('exp-modal-title').textContent=editId?'Edit Expense':'Add Expense';
  const modal=document.getElementById('modal-expense');
  populateCOASelects();
  if(editId){
    const e=DB.expenses.find(x=>x.id===editId);
    if(!e) return;
    document.getElementById('exp-desc').value=e.desc;
    document.getElementById('exp-cat').value=e.cat;
    document.getElementById('exp-amount').value=e.amount;
    document.getElementById('exp-currency').value=e.currency;
    document.getElementById('exp-date').value=e.date;
    document.getElementById('exp-vendor').value=e.vendor||'';
    document.getElementById('exp-method').value=e.method||'Bank Transfer';
    document.getElementById('exp-receipt').value=e.receipt||'';
    document.getElementById('exp-tax').value=e.tax||0;
    document.getElementById('exp-project').value=e.project||'';
    document.getElementById('exp-notes').value=e.notes||'';
    const expAccSel=document.getElementById('exp-account');
    if(expAccSel && e.accountCode) expAccSel.value=e.accountCode;
    modal._editId=editId;
  } else {
    ['exp-desc','exp-vendor','exp-receipt','exp-project','exp-notes'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('exp-amount').value='';
    document.getElementById('exp-tax').value='0';
    document.getElementById('exp-date').value=new Date().toISOString().slice(0,10);
    document.getElementById('exp-currency').value='SGD';
    modal._editId=null;
  }
  modal.classList.add('open');
}

function saveExpense(){
  const exp={
    id:document.getElementById('modal-expense')._editId||`EXP-${String(DB.nextExpNum).padStart(3,'0')}`,
    desc:document.getElementById('exp-desc').value,
    cat:document.getElementById('exp-cat').value,
    amount:parseFloat(document.getElementById('exp-amount').value)||0,
    currency:document.getElementById('exp-currency').value,
    date:document.getElementById('exp-date').value,
    vendor:document.getElementById('exp-vendor').value,
    method:document.getElementById('exp-method').value,
    receipt:document.getElementById('exp-receipt').value,
    tax:parseFloat(document.getElementById('exp-tax').value)||0,
    project:document.getElementById('exp-project').value,
    accountCode:document.getElementById('exp-account').value,
    notes:document.getElementById('exp-notes').value,
  };
  if(!exp.desc){alert('Description required.');return;}
  if(exp.amount<=0){alert('Enter a valid amount.');return;}
  if(document.getElementById('modal-expense')._editId){
    const idx=DB.expenses.findIndex(e=>e.id===exp.id);
    DB.expenses[idx]=exp;
  } else {
    DB.expenses.push(exp);
    DB.nextExpNum++;
  }
  saveDB(); closeModal('modal-expense'); renderExpenses();
}

function editExpense(id){ openExpenseModal(id); }
function deleteExpense(id){
  if(!confirm('Delete this expense?')) return;
  DB.expenses=DB.expenses.filter(e=>e.id!==id);
  saveDB(); renderExpenses();
}

// ===================== BILLS =====================
function renderBills(){
  const q=(document.getElementById('bill-search').value||'').toLowerCase();
  const f=document.getElementById('bill-filter').value;
  const list=DB.bills.filter(b=>{
    const m=(b.ref+b.vendor+b.desc).toLowerCase().includes(q);
    const fs=!f||b.status===f;
    return m&&fs;
  });
  const total=list.filter(b=>b.status!=='paid').reduce((s,b)=>s+toBase(b.amount,b.currency),0);
  const base=document.getElementById('baseCurrency').value;
  document.getElementById('bill-total').textContent=`Outstanding: ${SYMBOLS[base]}${Math.round(total).toLocaleString()}`;
  document.getElementById('bills-table').innerHTML=list.length?`
    <table><thead><tr><th>Bill Ref</th><th>Vendor</th><th>Category</th><th>Bill Date</th><th>Due Date</th><th>Amount</th><th>Status</th><th>Approval</th><th></th></tr></thead>
    <tbody>${list.map(b=>{
      const appr=b.approvalStatus||'pending';
      const apprBadge=appr==='approved'?'<span class="status paid">Approved</span>':appr==='rejected'?'<span class="status overdue">Rejected</span>':'<span class="status sent">Needs Approval</span>';
      return `<tr>
      <td class="fw-bold">${b.ref}</td>
      <td>${b.vendor}</td>
      <td><span class="pill">${b.cat}</span></td>
      <td>${b.date}</td>
      <td style="color:${b.status==='overdue'?'var(--danger)':'inherit'}">${b.due}</td>
      <td>${fmt(b.amount,b.currency)}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${apprBadge}</td>
      <td>
        ${appr==='pending'?`<button class="btn btn-success btn-sm" onclick="approveBill('${b.id}','approved')" title="Approve">✔</button><button class="btn btn-danger btn-sm" onclick="approveBill('${b.id}','rejected')" title="Reject">✗</button>`:''}
        <button class="btn btn-success btn-sm" onclick="markBillPaid('${b.id}')">$ Paid</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBill('${b.id}')">✕</button>
      </td>
    </tr>`;}).join('')}</tbody></table>`
  :'<div class="empty-state"><p>No bills found.</p></div>';
}

function openBillModal(){
  const modal=document.getElementById('modal-bill');
  populateCOASelects();
  document.getElementById('bill-date').value=new Date().toISOString().slice(0,10);
  const due=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  document.getElementById('bill-due').value=due;
  ['bill-ref','bill-vendor','bill-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('bill-amount').value='';
  document.getElementById('bill-currency').value='SGD';
  document.getElementById('bill-status').value='pending';
  modal.classList.add('open');
}

function saveBill(){
  const bill={
    id:`BILL-${String(DB.nextBillNum).padStart(3,'0')}`,
    ref:document.getElementById('bill-ref').value||`BILL-${String(DB.nextBillNum).padStart(3,'0')}`,
    vendor:document.getElementById('bill-vendor').value,
    amount:parseFloat(document.getElementById('bill-amount').value)||0,
    currency:document.getElementById('bill-currency').value,
    date:document.getElementById('bill-date').value,
    due:document.getElementById('bill-due').value,
    cat:document.getElementById('bill-cat').value,
    accountCode:document.getElementById('bill-account').value,
    status:document.getElementById('bill-status').value,
    desc:document.getElementById('bill-desc').value,
  };
  if(!bill.vendor){alert('Vendor required.');return;}
  DB.bills.push(bill); DB.nextBillNum++;
  saveDB(); closeModal('modal-bill'); renderBills();
}

function markBillPaid(id){
  const b=DB.bills.find(x=>x.id===id);
  if(b){b.status='paid';saveDB();renderBills();}
}
function deleteBill(id){
  if(!confirm('Delete this bill?')) return;
  DB.bills=DB.bills.filter(b=>b.id!==id);
  saveDB(); renderBills();
}

// ===================== CLIENTS =====================
function renderClients(){
  const q=(document.getElementById('cli-search').value||'').toLowerCase();
  const list=DB.clients.filter(c=>(c.name+c.contact+c.country+c.industry).toLowerCase().includes(q));
  document.getElementById('cli-count').textContent=`${list.length} clients`;
  document.getElementById('clients-table').innerHTML=list.length?`
    <table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Country</th><th>Industry</th><th>Currency</th><th>Invoices</th><th>Outstanding</th><th></th></tr></thead>
    <tbody>${list.map(c=>{
      const cinv=DB.invoices.filter(i=>i.clientId===c.id);
      const outstanding=cinv.filter(i=>i.status!=='paid'&&i.status!=='draft').reduce((s,i)=>s+getInvoiceBalance(i),0);
      return `<tr>
        <td class="fw-bold">${esc(c.name)}</td>
        <td>${c.contact||'—'}</td>
        <td><a href="mailto:${c.email}" style="color:var(--primary-light)">${c.email||'—'}</a></td>
        <td>${c.country}</td>
        <td><span class="pill">${c.industry}</span></td>
        <td>${c.currency}</td>
        <td>${cinv.length}</td>
        <td style="color:${outstanding>0?'var(--warning)':'var(--accent2)'};font-weight:600">${outstanding>0?fmt(outstanding,c.currency):'Nil'}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="editClient('${c.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteClient('${c.id}')">✕</button>
        </td>
      </tr>`;
    }).join('')}</tbody></table>`
  :'<div class="empty-state"><p>No clients found.</p></div>';
}

function openClientModal(editId=null){
  document.getElementById('cli-modal-title').textContent=editId?'Edit Client':'Add Client';
  const modal=document.getElementById('modal-client');
  if(editId){
    const c=DB.clients.find(x=>x.id===editId);
    if(!c) return;
    document.getElementById('cli-name').value=c.name;
    document.getElementById('cli-contact').value=c.contact||'';
    document.getElementById('cli-email').value=c.email||'';
    document.getElementById('cli-phone').value=c.phone||'';
    document.getElementById('cli-country').value=c.country;
    document.getElementById('cli-industry').value=c.industry;
    document.getElementById('cli-currency').value=c.currency;
    document.getElementById('cli-credit').value=c.credit||0;
    document.getElementById('cli-addr').value=c.addr||'';
    document.getElementById('cli-reg').value=c.reg||'';
    document.getElementById('cli-taxno').value=c.taxno||'';
    document.getElementById('cli-notes').value=c.notes||'';
    modal._editId=editId;
  } else {
    ['cli-name','cli-contact','cli-email','cli-phone','cli-addr','cli-reg','cli-taxno','cli-notes'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('cli-credit').value='0';
    document.getElementById('cli-currency').value='SGD';
    modal._editId=null;
  }
  modal.classList.add('open');
}

function saveClient(){
  const client={
    id:document.getElementById('modal-client')._editId||'c'+Date.now(),
    name:document.getElementById('cli-name').value,
    contact:document.getElementById('cli-contact').value,
    email:document.getElementById('cli-email').value,
    phone:document.getElementById('cli-phone').value,
    country:document.getElementById('cli-country').value,
    industry:document.getElementById('cli-industry').value,
    currency:document.getElementById('cli-currency').value,
    credit:parseFloat(document.getElementById('cli-credit').value)||0,
    addr:document.getElementById('cli-addr').value,
    reg:document.getElementById('cli-reg').value,
    taxno:document.getElementById('cli-taxno').value,
    notes:document.getElementById('cli-notes').value,
  };
  if(!client.name){alert('Client name required.');return;}
  if(document.getElementById('modal-client')._editId){
    const idx=DB.clients.findIndex(c=>c.id===client.id);
    DB.clients[idx]=client;
  } else {
    DB.clients.push(client);
  }
  saveDB(); closeModal('modal-client'); renderClients();
}

function editClient(id){ openClientModal(id); }
function deleteClient(id){
  if(!confirm('Delete this client?')) return;
  DB.clients=DB.clients.filter(c=>c.id!==id);
  saveDB(); renderClients();
}

// ===================== JOURNAL =====================
function renderJournal(){
  const q=(document.getElementById('jrn-search').value||'').toLowerCase();
  const list=DB.journal.filter(j=>(j.desc+j.debitAcc+j.creditAcc+j.ref).toLowerCase().includes(q));
  document.getElementById('journal-table').innerHTML=list.length?`
    <table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Debit Account</th><th>Debit</th><th>Credit Account</th><th>Credit</th><th>Ref</th><th></th></tr></thead>
    <tbody>${list.map(j=>`<tr>
      <td>${esc(j.date)}</td>
      <td><span class="pill">${esc(j.type)}</span></td>
      <td>${esc(j.desc)}</td>
      <td>${esc(j.debitAcc)}</td>
      <td style="color:var(--primary-light);font-weight:600">${fmt(j.debitAmt,j.currency)}</td>
      <td>${esc(j.creditAcc)}</td>
      <td style="color:var(--danger);font-weight:600">${fmt(j.creditAmt,j.currency)}</td>
      <td class="text-muted">${esc(j.ref||'—')}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteJournal('${j.id}')">✕</button></td>
    </tr>`).join('')}</tbody></table>`
  :'<div class="empty-state"><p>No journal entries.</p></div>';
}

function openJournalModal(){
  populateCOASelects();
  document.getElementById('jrn-date').value=new Date().toISOString().slice(0,10);
  ['jrn-desc','jrn-debit-acc','jrn-credit-acc','jrn-ref'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('jrn-debit-amt').value='';
  document.getElementById('jrn-credit-amt').value='';
  document.getElementById('modal-journal').classList.add('open');
}

function saveJournalEntry(){
  const j={
    id:`JRN-${String(DB.nextJrnNum).padStart(3,'0')}`,
    date:document.getElementById('jrn-date').value,
    type:document.getElementById('jrn-type').value,
    desc:document.getElementById('jrn-desc').value,
    debitAcc:document.getElementById('jrn-debit-acc').value,
    debitAmt:parseFloat(document.getElementById('jrn-debit-amt').value)||0,
    creditAcc:document.getElementById('jrn-credit-acc').value,
    creditAmt:parseFloat(document.getElementById('jrn-credit-amt').value)||0,
    currency:document.getElementById('jrn-currency').value,
    ref:document.getElementById('jrn-ref').value,
  };
  if(!j.desc){alert('Description required.');return;}
  DB.journal.push(j); DB.nextJrnNum++;
  saveDB(); closeModal('modal-journal'); renderJournal();
}

function deleteJournal(id){
  if(!confirm('Delete this journal entry?')) return;
  DB.journal=DB.journal.filter(j=>j.id!==id);
  saveDB(); renderJournal();
}

// ===================== P&L =====================
function renderPnL(){
  const base=document.getElementById('baseCurrency').value;
  const sym=SYMBOLS[base];
  const revenue=DB.payments.reduce((s,p)=>s+toBase(p.amount,p.currency),0);
  const outstandingRev=DB.invoices.filter(i=>i.status==='sent'||i.status==='partial'||i.status==='overdue')
    .reduce((s,i)=>s+toBase(getInvoiceBalance(i),i.currency),0);
  const totalRevenue=revenue+outstandingRev;
  const expByCat={};
  DB.expenses.forEach(e=>expByCat[e.cat]=(expByCat[e.cat]||0)+toBase(e.amount,e.currency));
  const totalExpenses=Object.values(expByCat).reduce((a,b)=>a+b,0);
  const grossProfit=totalRevenue-totalExpenses;
  const tax=grossProfit>0?grossProfit*0.17:0;
  const net=grossProfit-tax;

  document.getElementById('pnl-content').innerHTML=`
    <div class="report-section">
      <h4>Revenue</h4>
      <div class="report-row"><span>Cash Collected (Payments)</span><span>${sym}${Math.round(revenue).toLocaleString()}</span></div>
      <div class="report-row sub"><span>— Outstanding Receivables</span><span>${sym}${Math.round(outstandingRev).toLocaleString()}</span></div>
      <div class="report-row total"><span>Total Revenue</span><span>${sym}${Math.round(totalRevenue).toLocaleString()}</span></div>
    </div>
    <div class="report-section">
      <h4>Expenses</h4>
      ${Object.entries(expByCat).map(([k,v])=>`
        <div class="report-row sub"><span>${k}</span><span>(${sym}${Math.round(v).toLocaleString()})</span></div>
      `).join('')}
      <div class="report-row total"><span>Total Expenses</span><span>(${sym}${Math.round(totalExpenses).toLocaleString()})</span></div>
    </div>
    <hr class="divider">
    <div class="report-row total" style="font-size:1.05rem"><span>Gross Profit / (Loss)</span>
      <span style="color:${grossProfit>=0?'var(--accent2)':'var(--danger)'}">${sym}${Math.round(grossProfit).toLocaleString()}</span>
    </div>
    <div class="report-row sub"><span>— Estimated Tax (17%)</span><span>(${sym}${Math.round(tax).toLocaleString()})</span></div>
    <div class="report-row total" style="font-size:1.15rem;margin-top:8px;padding:12px;background:var(--surface2);border-radius:8px">
      <span>Net Profit After Tax</span>
      <span style="color:${net>=0?'var(--accent2)':'var(--danger)'}">${sym}${Math.round(net).toLocaleString()}</span>
    </div>
  `;
}

// ===================== BALANCE SHEET =====================
function renderBalance(){
  const base=document.getElementById('baseCurrency').value;
  const sym=SYMBOLS[base];
  document.getElementById('bs-date').textContent=new Date().toLocaleDateString('en-SG',{year:'numeric',month:'long',day:'numeric'});
  const cash=DB.payments.reduce((s,p)=>s+toBase(p.amount,p.currency),0)-DB.expenses.reduce((s,e)=>s+toBase(e.amount,e.currency),0);
  const ar=DB.invoices.filter(i=>i.status!=='paid'&&i.status!=='draft').reduce((s,i)=>s+toBase(getInvoiceBalance(i),i.currency),0);
  const totalAssets=cash+ar;
  const ap=DB.bills.filter(b=>b.status!=='paid').reduce((s,b)=>s+toBase(b.amount,b.currency),0);
  const equity=totalAssets-ap;

  document.getElementById('balance-content').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <div>
        <div class="report-section">
          <h4>Assets</h4>
          <div class="report-row fw-bold" style="font-size:.8rem;color:var(--primary)"><span>CURRENT ASSETS</span><span></span></div>
          <div class="report-row sub"><span>Cash & Bank</span><span>${sym}${Math.round(Math.max(0,cash)).toLocaleString()}</span></div>
          <div class="report-row sub"><span>Accounts Receivable</span><span>${sym}${Math.round(ar).toLocaleString()}</span></div>

          <div class="report-row total"><span>TOTAL ASSETS</span><span>${sym}${Math.round(totalAssets).toLocaleString()}</span></div>
        </div>
      </div>
      <div>
        <div class="report-section">
          <h4>Liabilities &amp; Equity</h4>
          <div class="report-row fw-bold" style="font-size:.8rem;color:var(--primary)"><span>CURRENT LIABILITIES</span><span></span></div>
          <div class="report-row sub"><span>Accounts Payable</span><span>${sym}${Math.round(ap).toLocaleString()}</span></div>
          <div class="report-row total"><span>TOTAL LIABILITIES</span><span>${sym}${Math.round(ap).toLocaleString()}</span></div>
          <div class="report-row fw-bold" style="font-size:.8rem;color:var(--primary);margin-top:12px"><span>EQUITY</span><span></span></div>
          <div class="report-row sub"><span>Owners' Equity</span><span>${sym}${Math.round(equity).toLocaleString()}</span></div>
          <div class="report-row total"><span>TOTAL LIABILITIES + EQUITY</span><span>${sym}${Math.round(totalAssets).toLocaleString()}</span></div>
        </div>
        <div class="alert alert-${Math.abs(totalAssets-(ap+equity))<1?'success':'info'} mt-3">
          ${Math.abs(totalAssets-(ap+equity))<1?'✓ Balance sheet is balanced.':'⚠ Verify entries — balance sheet may need adjustments.'}
        </div>
      </div>
    </div>
  `;
}

// ===================== CASH FLOW =====================
function renderCashflow(){
  const base=document.getElementById('baseCurrency').value;
  const sym=SYMBOLS[base];
  const operatingIn=DB.payments.reduce((s,p)=>s+toBase(p.amount,p.currency),0);
  const operatingOut=DB.expenses.reduce((s,e)=>s+toBase(e.amount,e.currency),0);
  const billsPaid=DB.bills.filter(b=>b.status==='paid').reduce((s,b)=>s+toBase(b.amount,b.currency),0);
  const netOp=operatingIn-operatingOut-billsPaid;
  const netInvest=0;
  const netFin=0;
  const netCF=netOp+netInvest+netFin;

  document.getElementById('cashflow-content').innerHTML=`
    <div class="report-section">
      <h4>Operating Activities</h4>
      <div class="report-row sub"><span>Cash received from customers</span><span>${sym}${Math.round(operatingIn).toLocaleString()}</span></div>
      <div class="report-row sub"><span>Cash paid for expenses</span><span>(${sym}${Math.round(operatingOut).toLocaleString()})</span></div>
      <div class="report-row sub"><span>Bills & payables paid</span><span>(${sym}${Math.round(billsPaid).toLocaleString()})</span></div>
      <div class="report-row total"><span>Net Cash from Operations</span><span style="color:${netOp>=0?'var(--accent2)':'var(--danger)'}">${sym}${Math.round(netOp).toLocaleString()}</span></div>
    </div>
    <div class="report-section">
      <h4>Investing Activities</h4>
      <div class="report-row sub"><span>Purchase of equipment & assets</span><span>${sym}0</span></div>
      <div class="report-row total"><span>Net Cash from Investing</span><span>${sym}0</span></div>
    </div>
    <div class="report-section">
      <h4>Financing Activities</h4>
      <div class="report-row sub"><span>Opening capital / shareholder funds</span><span>${sym}${(0).toLocaleString()}</span></div>
      <div class="report-row total"><span>Net Cash from Financing</span><span style="color:var(--accent2)">${sym}${(0).toLocaleString()}</span></div>
    </div>
    <hr class="divider">
    <div class="report-row total" style="font-size:1.1rem;padding:14px;background:var(--surface2);border-radius:8px">
      <span>Net Change in Cash</span>
      <span style="color:${netCF>=0?'var(--accent2)':'var(--danger)'}">${sym}${Math.round(netCF).toLocaleString()}</span>
    </div>
  `;
}

// ===================== SETTINGS =====================
function saveSettings(){
  DB.settings={
    company:document.getElementById('s-name').value,
    reg:document.getElementById('s-reg').value,
    country:document.getElementById('s-country').value,
    tax:document.getElementById('s-tax').value,
    email:document.getElementById('s-email').value,
    phone:document.getElementById('s-phone').value,
    address:document.getElementById('s-addr').value,
    invPrefix:document.getElementById('s-inv-prefix').value,
    terms:parseInt(document.getElementById('s-terms').value)||30,
    taxRate:parseFloat(document.getElementById('s-taxrate').value)||9,
    fy:document.getElementById('s-fy').value,
  };
  saveDB();
  alert('Settings saved successfully!');
}

function exportData(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='Fintiv_Data_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}

function importData(){
  const input=document.createElement('input');
  input.type='file'; input.accept='.json';
  input.onchange=e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=r=>{
      try{
        DB=JSON.parse(r.result);
        saveDB();
        alert('Data imported successfully!');
        showPage('dashboard');
      } catch(err){ alert('Invalid file format.'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearData(){
  if(!confirm('⚠ This will permanently delete ALL data. Are you sure?')) return;
  if(!confirm('Are you absolutely sure? This cannot be undone.')) return;
  DB=defaultDB();
  saveDB();
  alert('All data cleared. Starting fresh.');
  showPage('dashboard');
}

function exportReport(type){
  let content='Fintiv — '+type.toUpperCase()+' Report\n';
  content+='Generated: '+new Date().toLocaleString()+'\n\n';
  const el=document.getElementById(type+'-content')||document.getElementById('pnl-content');
  if(el) content+=el.innerText;
  const blob=new Blob([content],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='Fintiv_'+type+'_'+new Date().toISOString().slice(0,10)+'.txt';
  a.click();
}

// ===================== MODAL UTILS =====================
function closeModal(id){ const el=document.getElementById(id); el.classList.remove('open'); el.style.display=''; }
document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('open'); });
});

// ===================== RECEIPT SCANNER =====================

let ocrWorker = null;
let scannedParsed = null;

function openReceiptScanner(){
  resetScanner();
  document.getElementById('modal-receipt').classList.add('open');
}

function closeReceiptScanner(){
  document.getElementById('modal-receipt').classList.remove('open');
  if(ocrWorker){ ocrWorker.terminate(); ocrWorker=null; }
}

function resetScanner(){
  document.getElementById('receipt-drop-zone').style.display='';
  document.getElementById('scan-preview').style.display='none';
  document.getElementById('ocr-progress').style.display='none';
  document.getElementById('scan-results').style.display='none';
  document.getElementById('use-receipt-btn').style.display='none';
  document.getElementById('scan-img').src='';
  scannedParsed=null;
}

// Drop-zone interactions
function dzDragOver(e){ e.preventDefault(); document.getElementById('receipt-drop-zone').classList.add('dz-hover'); }
function dzDragLeave(e){ document.getElementById('receipt-drop-zone').classList.remove('dz-hover'); }
function dzDrop(e){
  e.preventDefault();
  document.getElementById('receipt-drop-zone').classList.remove('dz-hover');
  const file = e.dataTransfer.files[0];
  if(file) handleReceiptFile(file);
}

// The hidden file input covers the drop-zone — clicks propagate naturally.
// No extra listener needed; the input's onchange handles the file.

function handleReceiptFile(file){
  if(!file) return;
  if(!file.type.startsWith('image/')){ alert('Please upload an image file (JPG, PNG, WEBP, HEIC).'); return; }
  if(file.size > 10*1024*1024){ alert('File too large. Please use an image under 10MB.'); return; }

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('scan-img').src = e.target.result;
    document.getElementById('receipt-drop-zone').style.display='none';
    document.getElementById('scan-preview').style.display='block';
  };
  reader.readAsDataURL(file);
}

async function runOCR(){
  const imgEl = document.getElementById('scan-img');
  if(!imgEl.src || imgEl.src === window.location.href) return;

  document.getElementById('scan-preview').style.display='none';
  document.getElementById('ocr-progress').style.display='block';
  document.getElementById('scan-results').style.display='none';
  document.getElementById('use-receipt-btn').style.display='none';

  setOCRStatus('Initialising OCR engine…', 0);

  try {
    // Terminate old worker
    if(ocrWorker){ await ocrWorker.terminate(); ocrWorker=null; }

    ocrWorker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if(m.status === 'recognizing text'){
          const pct = Math.round(m.progress * 100);
          setOCRStatus(`Reading receipt text… ${pct}%`, pct);
        } else if(m.status === 'loading language traineddata'){
          setOCRStatus('Loading language data…', 15);
        } else if(m.status === 'initializing api'){
          setOCRStatus('Initialising engine…', 5);
        } else if(m.status === 'initialized api'){
          setOCRStatus('Engine ready, processing image…', 30);
        }
      }
    });

    setOCRStatus('Analysing receipt…', 50);
    const { data: { text } } = await ocrWorker.recognize(imgEl.src);
    await ocrWorker.terminate();
    ocrWorker = null;

    setOCRStatus('Extracting data…', 95);
    const parsed = parseReceiptText(text);
    scannedParsed = parsed;

    populateScanResults(parsed, text);

    document.getElementById('ocr-progress').style.display='none';
    document.getElementById('scan-results').style.display='block';
    document.getElementById('use-receipt-btn').style.display='inline-flex';
    setOCRStatus('Done', 100);

  } catch(err){
    console.error('OCR error:', err);
    document.getElementById('ocr-progress').style.display='none';
    document.getElementById('scan-preview').style.display='block';
    alert('Could not read the receipt. Please try a clearer image.');
  }
}

function setOCRStatus(msg, pct){
  document.getElementById('ocr-status-text').textContent = msg;
  document.getElementById('ocr-bar').style.width = pct + '%';
  document.getElementById('ocr-pct').textContent = pct + '%';
}

/* ---- Smart Parsing ---- */
function parseReceiptText(raw){
  const text = raw;
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);

  // --- AMOUNT ---
  // Look for TOTAL, GRAND TOTAL, AMOUNT DUE, NET AMOUNT lines first
  let amount = null;
  const totalPatterns = [
    /(?:grand\s+)?total(?:\s+(?:due|amount|payable))?[\s:$S₱RM¥]*([0-9,]+\.[0-9]{2})/i,
    /amount\s+(?:due|payable|paid)[\s:$S₱RM¥]*([0-9,]+\.[0-9]{2})/i,
    /(?:net\s+)?total[\s:$S₱RM¥]*([0-9,]+\.[0-9]{2})/i,
    /(?:sub[\s-]?total)[\s:$S₱RM¥]*([0-9,]+\.[0-9]{2})/i,
  ];
  for(const line of lines){
    for(const pat of totalPatterns){
      const m = line.match(pat);
      if(m){ amount = parseFloat(m[1].replace(/,/g,'')); break; }
    }
    if(amount) break;
  }
  // Fallback: largest number in text
  if(!amount){
    const allNums = [...text.matchAll(/([0-9]{1,6}\.[0-9]{2})/g)].map(m=>parseFloat(m[1]));
    if(allNums.length) amount = Math.max(...allNums);
  }

  // --- TAX / GST ---
  let tax = null;
  const taxPat = /(?:gst|vat|tax|service\s+charge)[\s:$S₱RM¥]*([0-9,]+\.[0-9]{2})/i;
  for(const line of lines){
    const m = line.match(taxPat);
    if(m){ tax = parseFloat(m[1].replace(/,/g,'')); break; }
  }

  // --- CURRENCY ---
  let currency = DB.settings?.baseCurrency || 'SGD';
  if(/\$S|SGD|S\$/i.test(text)) currency='SGD';
  else if(/PHP|₱/i.test(text)) currency='PHP';
  else if(/USD|\$(?!S)/i.test(text)) currency='USD';
  else if(/MYR|RM/i.test(text)) currency='MYR';
  else if(/KRW|₩/i.test(text)) currency='KRW';

  // --- DATE ---
  let date = new Date().toISOString().slice(0,10);
  const datePats = [
    { re: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, fn: m => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
    { re: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, fn: m => `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` },
    { re: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\.,]?\s+(\d{4})/i,
      fn: m => { const mo={'jan':'01','feb':'02','mar':'03','apr':'04','may':'05','jun':'06','jul':'07','aug':'08','sep':'09','oct':'10','nov':'11','dec':'12'}; return `${m[3]}-${mo[m[2].toLowerCase().slice(0,3)]}-${m[1].padStart(2,'0')}`; }},
    { re: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+(\d{1,2})[\s,]+(\d{4})/i,
      fn: m => { const mo={'jan':'01','feb':'02','mar':'03','apr':'04','may':'05','jun':'06','jul':'07','aug':'08','sep':'09','oct':'10','nov':'11','dec':'12'}; return `${m[3]}-${mo[m[1].toLowerCase().slice(0,3)]}-${m[2].padStart(2,'0')}`; }},
  ];
  for(const {re, fn} of datePats){
    const m = text.match(re);
    if(m){ try{ const d=fn(m); if(!isNaN(new Date(d))) date=d; } catch(e){} break; }
  }

  // --- RECEIPT / INVOICE REF ---
  let ref = '';
  const refPat = /(?:receipt|invoice|inv|txn|transaction|order|ref|no\.?)[\s#:]*([A-Z0-9\-\/]{4,20})/i;
  const rm = text.match(refPat);
  if(rm) ref = rm[1].trim();

  // --- VENDOR ---
  let vendor = '';
  // Heuristic: first non-empty line that isn't a date/number is likely the merchant name
  const skipWords = /^(receipt|invoice|tax|tel|phone|address|email|fax|date|time|cashier|table|order|item|qty|price|amount|total|gst|vat|thank|subtotal)/i;
  const pureNum = /^[\d\s\.\,\-\+\*\/\(\)]+$/;
  for(const line of lines.slice(0, 8)){
    if(line.length > 3 && line.length < 50 && !skipWords.test(line) && !pureNum.test(line)){
      // Good candidate
      vendor = toTitleCase(line.replace(/[^a-zA-Z0-9&'\- ]/g,' ').trim());
      if(vendor.split(' ').length >= 1 && vendor.length > 2) break;
    }
  }

  // --- DESCRIPTION ---
  let description = vendor ? `Receipt from ${vendor}` : 'Receipt';

  // --- CONFIDENCE ---
  let hits = 0;
  if(amount) hits++;
  if(tax) hits++;
  if(ref) hits++;
  if(vendor) hits++;
  if(date !== new Date().toISOString().slice(0,10)) hits++;
  const confidence = hits >= 4 ? 'high' : hits >= 2 ? 'medium' : 'low';

  return { vendor, amount, tax, currency, date, ref, description, confidence, raw };
}

function toTitleCase(s){
  return s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function populateScanResults(p, rawText){
  document.getElementById('sr-vendor').value = p.vendor || '';
  document.getElementById('sr-date').value = p.date || '';
  document.getElementById('sr-amount').value = p.amount != null ? p.amount.toFixed(2) : '';
  document.getElementById('sr-tax').value = p.tax != null ? p.tax.toFixed(2) : '';
  document.getElementById('sr-currency').value = p.currency || 'SGD';
  document.getElementById('sr-ref').value = p.ref || '';
  document.getElementById('sr-desc').value = p.description || '';
  document.getElementById('ocr-raw-text').textContent = rawText || '';

  const badge = document.getElementById('conf-badge');
  badge.className = 'confidence-badge conf-' + p.confidence;
  badge.textContent = p.confidence.charAt(0).toUpperCase() + p.confidence.slice(1) + ' Confidence';

  // Highlight auto-detected fields
  ['sr-vendor','sr-date','sr-amount','sr-tax','sr-ref'].forEach(id=>{
    const el=document.getElementById(id);
    el.style.borderColor = el.value ? 'var(--accent2)' : 'var(--border)';
    el.style.background = el.value ? '#f0fdf4' : '';
  });
}

function useReceiptData(){
  // Read possibly-edited values from result fields
  const vendor = document.getElementById('sr-vendor').value.trim();
  const date   = document.getElementById('sr-date').value;
  const amount = parseFloat(document.getElementById('sr-amount').value) || 0;
  const tax    = parseFloat(document.getElementById('sr-tax').value) || 0;
  const currency = document.getElementById('sr-currency').value;
  const ref    = document.getElementById('sr-ref').value.trim();
  const description = document.getElementById('sr-desc').value.trim() || (vendor ? `Receipt from ${vendor}` : 'Expense');

  closeReceiptScanner();

  // Open the expense modal pre-filled
  // We need a short delay so the receipt modal finishes closing
  setTimeout(() => {
    openExpenseModal();
    // Populate the expense form
    document.getElementById('exp-date').value = date;
    document.getElementById('exp-amount').value = amount.toFixed(2);
    document.getElementById('exp-currency').value = currency;
    document.getElementById('exp-desc').value = description;
    document.getElementById('exp-vendor').value = vendor;
    // Build notes string with ref and tax
    let notes = '';
    if(ref) notes += `Receipt ref: ${ref}`;
    if(tax > 0) notes += (notes ? '\n' : '') + `GST/Tax: ${currency} ${tax.toFixed(2)}`;
    const notesEl = document.getElementById('exp-notes');
    if(notesEl && notes) notesEl.value = notes;
  }, 200);
}

// ===================== AUTH HELPERS =====================
function _showLoginScreen(){
  const ls = document.getElementById('login-screen');
  ls.style.display = 'flex';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('main').style.display   = 'none';
  // copy logo into login modal (avoids duplicating the giant base64 string)
  const li = document.getElementById('login-logo');
  if(li) li.src = document.querySelector('.logo-img').src;
}
function _showApp(email){
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('sidebar').style.display = 'flex';
  document.getElementById('main').style.display   = 'flex';
  const lb = document.getElementById('logout-btn');
  if(lb) lb.style.display = 'inline-flex';
  const sf = document.querySelector('.sidebar-footer');
  const adminBadge = _isAdmin ? ' <span style="background:var(--accent);color:#fff;font-size:.55rem;padding:1px 5px;border-radius:3px;vertical-align:middle;font-family:Raleway,sans-serif;letter-spacing:.5px">ADMIN</span>' : '';
  if(sf) sf.innerHTML = (email||'Local Mode') + adminBadge + '<br><span style="opacity:.38;font-size:.62rem">Fintiv v2.0</span>';
  // Show/hide Settings nav based on admin role
  const settingsNav = Array.from(document.querySelectorAll('nav a')).find(a=>(a.getAttribute('onclick')||'').includes("'settings'"));
  const settingsSection = settingsNav ? settingsNav.previousElementSibling : null;
  if(settingsNav) settingsNav.style.display = _isAdmin ? '' : 'none';
  if(settingsSection && settingsSection.classList.contains('nav-section')) settingsSection.style.display = _isAdmin ? '' : 'none';
}
async function doLogin(){
  const email = (document.getElementById('login-email').value||'').trim();
  const pw    = document.getElementById('login-password').value||'';
  const err   = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  err.style.display='none';
  const locked = _bfMinsLeft();
  if(locked>0){ err.textContent=`Too many failed attempts. Try again in ${locked} minute${locked>1?'s':''}.`; err.style.display='block'; return; }
  if(!email||!pw){ err.textContent='Please enter email and password.'; err.style.display='block'; return; }
  btn.textContent='Signing in…'; btn.disabled=true;
  const {error} = await _sb.auth.signInWithPassword({email,password:pw});
  if(error){ _bfFail(); const m=_bfMinsLeft(); err.textContent=m>0?`Too many failed attempts. Try again in ${m} minute${m>1?'s':''}.`:error.message; err.style.display='block'; btn.textContent='Sign In'; btn.disabled=false; return; }
  _bfReset();
  // Check if MFA is required
  const {data:aalData} = await _sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aalData && aalData.nextLevel==='aal2' && aalData.nextLevel!==aalData.currentLevel){
    // MFA required — show 2FA screen
    btn.textContent='Sign In'; btn.disabled=false;
    document.getElementById('login-screen').style.display='none';
    const mfaScr = document.getElementById('mfa-screen');
    mfaScr.style.display='flex';
    document.getElementById('mfa-code').value='';
    document.getElementById('mfa-error').style.display='none';
    document.getElementById('mfa-code').focus();
  }
  // else: onAuthStateChange fires → _showApp
}
async function doLogout(){
  if(_sb){ await _sb.auth.signOut(); }
  else { _user=null; _showLoginScreen(); }
}
function showForgotPw(e){
  e.preventDefault();
  const email = (document.getElementById('login-email').value||'').trim();
  if(!email){ alert('Enter your email address first.'); return; }
  if(_sb) _sb.auth.resetPasswordForEmail(email,{redirectTo:location.href})
    .then(()=>alert('Password reset email sent — check your inbox.'));
}
function startLocalMode(e){
  e.preventDefault();
  loadDB();
  _showApp(null);
  renderDashboard();
}


// ===================== 2FA / MFA =====================
let _mfaFactorId = null;
let _mfaEnrollId = null;
let _mfaChallengeId = null;

async function verifyMFACode(){
  const code = document.getElementById('mfa-code').value.trim();
  const err  = document.getElementById('mfa-error');
  const btn  = document.getElementById('mfa-btn');
  if(code.length!==6){ err.textContent='Please enter a 6-digit code.'; err.style.display='block'; return; }
  btn.textContent='Verifying…'; btn.disabled=true;
  err.style.display='none';
  try{
    const {data:factors} = await _sb.auth.mfa.listFactors();
    const totp = factors.totp && factors.totp[0];
    if(!totp) throw new Error('No 2FA factor found.');
    const {data:ch, error:chErr} = await _sb.auth.mfa.challenge({factorId:totp.id});
    if(chErr) throw chErr;
    const {error:vErr} = await _sb.auth.mfa.verify({factorId:totp.id, challengeId:ch.id, code});
    if(vErr) throw vErr;
    // MFA verified — manually show app (onAuthStateChange was blocked waiting for aal2)
    document.getElementById('mfa-screen').style.display='none';
    const {data:{session:mfaSess}} = await _sb.auth.getSession();
    if(mfaSess){
      _user = mfaSess.user;
      _isAdmin = (_user.app_metadata && _user.app_metadata.role === 'admin');
      loadDB();
      await _pullDown();
      _showApp(_user.email);
      renderDashboard();
    }
  }catch(e){
    err.textContent = e.message||'Invalid code. Try again.';
    err.style.display='block';
    btn.textContent='Verify'; btn.disabled=false;
    document.getElementById('mfa-code').value='';
    document.getElementById('mfa-code').focus();
  }
}

function cancelMFA(e){
  e.preventDefault();
  document.getElementById('mfa-screen').style.display='none';
  _showLoginScreen();
  if(_sb) _sb.auth.signOut();
}

async function loadMFAStatus(){
  if(!_sb) return;
  const badge = document.getElementById('mfa-status-badge');
  const enableBtn = document.getElementById('mfa-enable-btn');
  const disableBtn = document.getElementById('mfa-disable-btn');
  try{
    const {data:factors} = await _sb.auth.mfa.listFactors();
    const verified = factors.totp && factors.totp.filter(f=>f.status==='verified');
    if(verified && verified.length>0){
      _mfaFactorId = verified[0].id;
      badge.textContent='Enabled ✓'; badge.style.background='#dcfce7'; badge.style.color='#166534';
      enableBtn.style.display='none'; disableBtn.style.display='';
    } else {
      _mfaFactorId = null;
      badge.textContent='Not Enabled'; badge.style.background='#fef9c3'; badge.style.color='#854d0e';
      enableBtn.style.display=''; disableBtn.style.display='none';
    }
  }catch(e){ badge.textContent='Unknown'; }
}

async function startMFAEnroll(){
  if(!_sb) return;
  const {data, error} = await _sb.auth.mfa.enroll({factorType:'totp', issuer:'Fintiv', friendlyName:'Fintiv Authenticator'});
  if(error){ alert('Error starting 2FA setup: '+error.message); return; }
  _mfaEnrollId = data.id;
  document.getElementById('mfa-qr-img').src = data.totp.qr_code;
  document.getElementById('mfa-secret-key').textContent = data.totp.secret;
  document.getElementById('mfa-enroll-section').style.display='block';
  document.getElementById('mfa-action-btns').style.display='none';
  document.getElementById('mfa-confirm-code').value='';
  document.getElementById('mfa-confirm-code').focus();
}

async function confirmMFAEnroll(){
  const code = document.getElementById('mfa-confirm-code').value.trim();
  const errEl = document.getElementById('mfa-enroll-error');
  const btn = document.getElementById('mfa-confirm-btn');
  if(code.length!==6){ errEl.textContent='Enter the 6-digit code from your app.'; errEl.style.display='block'; return; }
  btn.textContent='Activating…'; btn.disabled=true; errEl.style.display='none';
  try{
    const {data:ch, error:chErr} = await _sb.auth.mfa.challenge({factorId:_mfaEnrollId});
    if(chErr) throw chErr;
    const {error:vErr} = await _sb.auth.mfa.verify({factorId:_mfaEnrollId, challengeId:ch.id, code});
    if(vErr) throw vErr;
    alert('✅ 2FA is now active! You will be asked for a code on every login.');
    document.getElementById('mfa-enroll-section').style.display='none';
    document.getElementById('mfa-action-btns').style.display='';
    await loadMFAStatus();
  }catch(e){
    errEl.textContent = e.message||'Invalid code. Try again.';
    errEl.style.display='block';
    btn.textContent='Activate 2FA'; btn.disabled=false;
  }
}

function cancelMFAEnroll(){
  if(_mfaEnrollId && _sb) _sb.auth.mfa.unenroll({factorId:_mfaEnrollId}).catch(()=>{});
  _mfaEnrollId = null;
  document.getElementById('mfa-enroll-section').style.display='none';
  document.getElementById('mfa-action-btns').style.display='';
}

async function disableMFA(){
  if(!_mfaFactorId){ alert('No 2FA factor found.'); return; }
  if(!confirm('Remove 2FA from your account? You will no longer be asked for a code on login.')) return;
  const {error} = await _sb.auth.mfa.unenroll({factorId:_mfaFactorId});
  if(error){ alert('Error removing 2FA: '+error.message); return; }
  alert('2FA has been removed from your account.');
  _mfaFactorId = null;
  await loadMFAStatus();
}


// ===================== PASSWORD RESET HANDLER =====================
async function doPasswordReset(){
  const pw1 = document.getElementById('reset-pw1').value;
  const pw2 = document.getElementById('reset-pw2').value;
  const err = document.getElementById('reset-error');
  const ok  = document.getElementById('reset-success');
  const btn = document.getElementById('reset-btn');
  err.style.display='none'; ok.style.display='none';
  if(pw1.length < 8){ err.textContent='Password must be at least 8 characters.'; err.style.display='block'; return; }
  if(pw1 !== pw2){ err.textContent='Passwords do not match.'; err.style.display='block'; return; }
  btn.textContent='Saving…'; btn.disabled=true;
  const {error} = await _sb.auth.updateUser({password: pw1});
  if(error){
    err.textContent = error.message; err.style.display='block';
    btn.textContent='Set Password'; btn.disabled=false;
  } else {
    ok.textContent='✅ Password set successfully! Redirecting to login…';
    ok.style.display='block'; btn.style.display='none';
    // Clear the hash and redirect to login after 2s
    setTimeout(()=>{
      window.location.hash='';
      document.getElementById('reset-screen').style.display='none';
      _showLoginScreen();
    }, 2000);
  }
}

function _checkRecoveryToken(){
  const hash = window.location.hash;
  if(hash.includes('type=recovery') && hash.includes('access_token=')){
    // Supabase will auto-pick up the token via onAuthStateChange PASSWORD_RECOVERY event
    document.getElementById('reset-screen').style.display='flex';
    return true;
  }
  return false;
}

// ===================== INIT =====================
// ===================== ACTIVITY LOG =====================
function logActivity(action, entity, detail){
  if(!DB.auditLog) DB.auditLog=[];
  DB.auditLog.unshift({ts:new Date().toISOString(),action,entity,detail,user:_user?_user.email:'local'});
  if(DB.auditLog.length>300) DB.auditLog=DB.auditLog.slice(0,300);
}

function renderActivityLog(){
  const el=document.getElementById('activity-log-list');
  if(!el) return;
  const log=(DB.auditLog||[]).slice(0,12);
  const cnt=document.getElementById('activity-log-count');
  if(cnt) cnt.textContent=(DB.auditLog||[]).length+' events';
  if(!log.length){
    el.innerHTML='<p style="color:var(--text-muted);padding:14px 16px;font-size:.85rem">No activity yet — changes will appear here.</p>';
    return;
  }
  const icons={Created:'✅',Updated:'✏️',Deleted:'🗑️',Approved:'✔️',Rejected:'✕',Converted:'↗',Paid:'💰'};
  el.innerHTML=log.map(e=>{
    const t=new Date(e.ts);
    const when=t.toLocaleDateString()+' · '+t.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 16px;border-bottom:1px solid var(--border);font-size:.83rem">
      <span style="font-size:1.05rem;margin-top:1px">${icons[e.action]||'📌'}</span>
      <div style="flex:1">
        <span style="font-weight:600;color:var(--primary)">${e.action}</span>
        <span style="color:var(--text-muted)"> · ${e.entity}</span>
        <span> — ${e.detail}</span>
        <div style="color:var(--text-muted);font-size:.75rem;margin-top:2px">${when} · <em>${e.user}</em></div>
      </div>
    </div>`;
  }).join('');
}

// ===================== QUOTES / ESTIMATES =====================
function qAutoTotal(){
  const sub=parseFloat(document.getElementById('q-subtotal').value)||0;
  const tax=parseFloat(document.getElementById('q-tax').value)||0;
  const dis=parseFloat(document.getElementById('q-discount').value)||0;
  document.getElementById('q-total').value=(sub+tax-dis).toFixed(2);
}

function renderQuotes(){
  const q=(document.getElementById('quote-search')?.value||'').toLowerCase();
  const f=document.getElementById('quote-filter')?.value||'';
  const rows=(DB.quotes||[]).filter(x=>(!f||x.status===f)&&(!q||[x.num,getClientName(x.clientId),x.desc].join(' ').toLowerCase().includes(q)));
  document.getElementById('quote-count').textContent=`${rows.length} record${rows.length!==1?'s':''}`;
  const sc={draft:'draft',sent:'sent',accepted:'paid',declined:'overdue',expired:'overdue'};
  document.getElementById('quotes-table').innerHTML=rows.length?`
    <table>
      <thead><tr><th>Quote #</th><th>Client</th><th>Date</th><th>Valid Until</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map(q=>`<tr>
        <td class="fw-bold">${esc(q.num||'—')}</td>
        <td>${esc(getClientName(q.clientId))}</td>
        <td>${esc(q.date||'—')}</td>
        <td>${esc(q.valid||'—')}</td>
        <td>${fmt(q.total||0,q.currency||'SGD')}</td>
        <td><span class="status ${sc[q.status]||'draft'}">${esc(q.status)}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openQuoteModal('${q.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteQuote('${q.id}')">✕</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`
  :'<div class="empty-state"><p>No quotes yet. Click + New Quote to start.</p></div>';
}

function openQuoteModal(id){
  const today=new Date().toISOString().slice(0,10);
  const valid30=new Date(Date.now()+30*864e5).toISOString().slice(0,10);
  const q=id?DB.quotes.find(x=>x.id===id):null;
  document.getElementById('q-client').innerHTML='<option value="">Select client...</option>'+
    DB.clients.map(c=>`<option value="${esc(c.id)}"${q?.clientId===c.id?' selected':''}>${esc(c.name)}</option>`).join('');
  document.getElementById('q-id').value=id||'';
  const pfx=DB.settings.invPrefix.replace(/INV/i,'QTE');
  document.getElementById('q-num').value=q?.num||(pfx+String(DB.nextQuoteNum||1).padStart(3,'0'));
  document.getElementById('q-date').value=q?.date||today;
  document.getElementById('q-valid').value=q?.valid||valid30;
  document.getElementById('q-currency').value=q?.currency||'SGD';
  document.getElementById('q-status').value=q?.status||'draft';
  document.getElementById('q-desc').value=q?.desc||'';
  document.getElementById('q-subtotal').value=q?.subtotal||'';
  document.getElementById('q-tax').value=q?.tax||'';
  document.getElementById('q-discount').value=q?.discount||'';
  document.getElementById('q-total').value=q?.total||'';
  document.getElementById('q-notes').value=q?.notes||'';
  document.getElementById('quote-modal-title').textContent=id?'Edit Quote':'New Quote';
  document.getElementById('q-convert-btn').style.display=(id&&q?.status==='accepted')?'inline-flex':'none';
  document.getElementById('modal-quote').style.display='flex';
}

function saveQuote(){
  const id=document.getElementById('q-id').value;
  const clientId=document.getElementById('q-client').value;
  const date=document.getElementById('q-date').value;
  const valid=document.getElementById('q-valid').value;
  if(!clientId||!date||!valid){alert('Please fill all required fields.');return;}
  const entry={
    id:id||('QTE-'+Date.now()),
    num:document.getElementById('q-num').value.trim(),
    clientId,date,valid,
    currency:document.getElementById('q-currency').value,
    status:document.getElementById('q-status').value,
    desc:document.getElementById('q-desc').value.trim(),
    subtotal:parseFloat(document.getElementById('q-subtotal').value)||0,
    tax:parseFloat(document.getElementById('q-tax').value)||0,
    discount:parseFloat(document.getElementById('q-discount').value)||0,
    total:parseFloat(document.getElementById('q-total').value)||0,
    notes:document.getElementById('q-notes').value.trim(),
    createdAt:id?DB.quotes.find(x=>x.id===id)?.createdAt:new Date().toISOString()
  };
  if(!id){
    if(!DB.quotes)DB.quotes=[];
    DB.quotes.push(entry);
    DB.nextQuoteNum=(DB.nextQuoteNum||1)+1;
    logActivity('Created','Quote',`${entry.num} for ${getClientName(entry.clientId)} — ${fmt(entry.total,entry.currency)}`);
  }else{
    const i=DB.quotes.findIndex(x=>x.id===id);
    DB.quotes[i]=entry;
    logActivity('Updated','Quote',`${entry.num} → ${entry.status}`);
  }
  saveDB();closeModal('modal-quote');renderQuotes();
}

function deleteQuote(id){
  if(!confirm('Delete this quote?'))return;
  const q=DB.quotes.find(x=>x.id===id);
  DB.quotes=DB.quotes.filter(x=>x.id!==id);
  logActivity('Deleted','Quote',q?.num||id);
  saveDB();renderQuotes();
}

function convertQuoteToInvoice(id){
  const q=DB.quotes.find(x=>x.id===id);
  if(!q){alert('Quote not found.');return;}
  if(!confirm('Convert quote '+q.num+' to a draft invoice?'))return;
  const invNum=DB.settings.invPrefix+String(DB.nextInvNum).padStart(3,'0');
  const today=new Date().toISOString().slice(0,10);
  const due=new Date(Date.now()+DB.settings.terms*864e5).toISOString().slice(0,10);
  const taxPct=q.subtotal>0&&q.tax>0?Math.round((q.tax/q.subtotal)*100):0;
  if(!DB.invoices)DB.invoices=[];
  DB.invoices.push({
    id:invNum,clientId:q.clientId,date:today,due,currency:q.currency,status:'draft',
    lines:[{desc:q.desc||('Services — Ref '+q.num),qty:1,price:q.subtotal||q.total,tax:taxPct}],
    notes:'Converted from Quote '+q.num+(q.notes?'\n'+q.notes:''),
    paid:0,quoteRef:q.id
  });
  DB.nextInvNum++;
  const qi=DB.quotes.findIndex(x=>x.id===id);
  if(qi>=0)DB.quotes[qi].status='accepted';
  logActivity('Converted','Quote',q.num+' → Invoice '+invNum);
  saveDB();closeModal('modal-quote');renderQuotes();
  showPage('invoices');
  alert('Invoice '+invNum+' created from Quote '+q.num+'. Review and send when ready.');
}

// ===================== PURCHASE ORDERS =====================
function poAutoTotal(){
  const sub=parseFloat(document.getElementById('po-subtotal').value)||0;
  const tax=parseFloat(document.getElementById('po-tax').value)||0;
  const shp=parseFloat(document.getElementById('po-shipping').value)||0;
  document.getElementById('po-total').value=(sub+tax+shp).toFixed(2);
}

function renderPurchaseOrders(){
  const q=(document.getElementById('po-search')?.value||'').toLowerCase();
  const f=document.getElementById('po-filter')?.value||'';
  const rows=(DB.purchaseOrders||[]).filter(x=>(!f||x.status===f)&&(!q||[x.num,x.vendor,x.desc].join(' ').toLowerCase().includes(q)));
  document.getElementById('po-count').textContent=`${rows.length} record${rows.length!==1?'s':''}`;
  const sc={draft:'draft',sent:'sent',approved:'paid',received:'paid',cancelled:'overdue'};
  document.getElementById('po-table').innerHTML=rows.length?`
    <table>
      <thead><tr><th>PO #</th><th>Vendor</th><th>Date</th><th>Delivery</th><th>Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows.map(p=>`<tr>
        <td class="fw-bold">${esc(p.num||'—')}</td>
        <td>${esc(p.vendor||'—')}</td>
        <td>${esc(p.date||'—')}</td>
        <td>${esc(p.delivery||'—')}</td>
        <td>${fmt(p.total||0,p.currency||'SGD')}</td>
        <td><span class="status ${sc[p.status]||'draft'}">${esc(p.status)}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openPOModal('${p.id}')">Edit</button>
          ${p.status==='sent'?`<button class="btn btn-success btn-sm" onclick="approvePO('${p.id}')">✔ Approve</button>`:''}
          <button class="btn btn-danger btn-sm" onclick="deletePO('${p.id}')">✕</button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`
  :'<div class="empty-state"><p>No purchase orders yet. Click + New PO to create one.</p></div>';
}

function openPOModal(id){
  const today=new Date().toISOString().slice(0,10);
  const p=id?DB.purchaseOrders.find(x=>x.id===id):null;
  document.getElementById('po-id').value=id||'';
  document.getElementById('po-num').value=p?.num||('PO-'+String(DB.nextPONum||1).padStart(4,'0'));
  document.getElementById('po-vendor').value=p?.vendor||'';
  document.getElementById('po-date').value=p?.date||today;
  document.getElementById('po-delivery').value=p?.delivery||'';
  document.getElementById('po-currency').value=p?.currency||'SGD';
  document.getElementById('po-status').value=p?.status||'draft';
  document.getElementById('po-desc').value=p?.desc||'';
  document.getElementById('po-subtotal').value=p?.subtotal||'';
  document.getElementById('po-tax').value=p?.tax||'';
  document.getElementById('po-shipping').value=p?.shipping||'';
  document.getElementById('po-total').value=p?.total||'';
  document.getElementById('po-cat').value=p?.cat||'Technology';
  document.getElementById('po-ref').value=p?.ref||'';
  document.getElementById('po-notes').value=p?.notes||'';
  document.getElementById('po-modal-title').textContent=id?'Edit Purchase Order':'New Purchase Order';
  document.getElementById('modal-po').style.display='flex';
}

function savePO(){
  const id=document.getElementById('po-id').value;
  const vendor=document.getElementById('po-vendor').value.trim();
  const date=document.getElementById('po-date').value;
  if(!vendor||!date){alert('Vendor and date are required.');return;}
  const entry={
    id:id||('PO-'+Date.now()),
    num:document.getElementById('po-num').value.trim(),
    vendor,date,
    delivery:document.getElementById('po-delivery').value,
    currency:document.getElementById('po-currency').value,
    status:document.getElementById('po-status').value,
    desc:document.getElementById('po-desc').value.trim(),
    subtotal:parseFloat(document.getElementById('po-subtotal').value)||0,
    tax:parseFloat(document.getElementById('po-tax').value)||0,
    shipping:parseFloat(document.getElementById('po-shipping').value)||0,
    total:parseFloat(document.getElementById('po-total').value)||0,
    cat:document.getElementById('po-cat').value,
    ref:document.getElementById('po-ref').value.trim(),
    notes:document.getElementById('po-notes').value.trim()
  };
  if(!id){
    if(!DB.purchaseOrders)DB.purchaseOrders=[];
    DB.purchaseOrders.push(entry);
    DB.nextPONum=(DB.nextPONum||1)+1;
    logActivity('Created','Purchase Order',entry.num+' from '+entry.vendor+' — '+fmt(entry.total,entry.currency));
  }else{
    const i=DB.purchaseOrders.findIndex(x=>x.id===id);
    DB.purchaseOrders[i]=entry;
    logActivity('Updated','Purchase Order',entry.num+' → '+entry.status);
  }
  saveDB();closeModal('modal-po');renderPurchaseOrders();
}

function approvePO(id){
  const p=DB.purchaseOrders.find(x=>x.id===id);
  if(!p)return;
  p.status='approved';p.approvedAt=new Date().toISOString();p.approvedBy=_user?_user.email:'local';
  logActivity('Approved','Purchase Order',p.num);
  saveDB();renderPurchaseOrders();
}

function deletePO(id){
  if(!confirm('Delete this purchase order?'))return;
  const p=DB.purchaseOrders.find(x=>x.id===id);
  DB.purchaseOrders=DB.purchaseOrders.filter(x=>x.id!==id);
  logActivity('Deleted','Purchase Order',p?.num||id);
  saveDB();renderPurchaseOrders();
}

// ===================== BILL APPROVAL =====================
function approveBill(id,decision){
  const b=DB.bills.find(x=>x.id===id);
  if(!b)return;
  b.approvalStatus=decision;b.approvedBy=_user?_user.email:'local';b.approvedAt=new Date().toISOString();
  logActivity(decision==='approved'?'Approved':'Rejected','Bill',b.ref+' — '+b.vendor+' ('+fmt(b.amount,b.currency)+')');
  saveDB();renderBills();
}

// ===================== BUDGETS =====================
function renderBudgets(){
  const yr=parseInt(document.getElementById('budget-year')?.value||new Date().getFullYear());
  const actualsByCat={};
  DB.expenses.forEach(e=>{if(new Date(e.date).getFullYear()===yr) actualsByCat[e.cat]=(actualsByCat[e.cat]||0)+toBase(e.amount,e.currency);});
  const budgets=(DB.budgets||[]).filter(b=>b.year===yr);
  const allCats=[...new Set([...budgets.map(b=>b.cat),...Object.keys(actualsByCat)])].sort();
  if(!allCats.length){document.getElementById('budgets-table').innerHTML='<div class="empty-state"><p>No data for '+yr+'. Set budgets or record expenses to get started.</p></div>';return;}
  const base=document.getElementById('baseCurrency').value;
  const sym=SYMBOLS[base]||'S$';
  const rows=allCats.map(cat=>{
    const b=budgets.find(x=>x.cat===cat);
    const bAmt=b?toBase(b.amount,b.currency):0;
    const actual=actualsByCat[cat]||0;
    const variance=bAmt-actual;
    const pct=bAmt>0?(actual/bAmt*100).toFixed(0):'—';
    const barW=bAmt>0?Math.min(100,actual/bAmt*100):0;
    const varColor=variance<0?'var(--danger)':'var(--accent2)';
    return `<tr>
      <td><strong>${esc(cat)}</strong></td>
      <td>${bAmt>0?sym+Math.round(bAmt).toLocaleString():'<span style="color:var(--text-muted)">Not set</span>'}</td>
      <td>${sym}${Math.round(actual).toLocaleString()}</td>
      <td style="color:${varColor};font-weight:600">${bAmt>0?(variance>0?'+ '+sym+Math.round(variance).toLocaleString()+' under':variance<0?'− '+sym+Math.round(-variance).toLocaleString()+' over':'On budget'):'—'}</td>
      <td style="min-width:120px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:var(--border);border-radius:4px;height:8px;overflow:hidden">
            <div style="width:${barW}%;background:${barW>100?'var(--danger)':'var(--accent2)'};height:8px;transition:width .3s"></div>
          </div>
          <span style="font-size:.78rem;color:var(--text-muted);white-space:nowrap">${pct}%</span>
        </div>
      </td>
      <td><button class="btn btn-outline btn-sm" onclick="editBudgetCat('${cat}',${yr})">Edit</button></td>
    </tr>`;
  });
  document.getElementById('budgets-table').innerHTML=`
    <table>
      <thead><tr><th>Category</th><th>Budget (FY${yr})</th><th>Actual (YTD)</th><th>Variance</th><th>Usage</th><th></th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
}

function openBudgetModal(){
  document.getElementById('bgt-year').value=document.getElementById('budget-year')?.value||new Date().getFullYear();
  document.getElementById('bgt-amount').value='';
  document.getElementById('modal-budget').style.display='flex';
}

function editBudgetCat(cat,yr){
  const b=(DB.budgets||[]).find(x=>x.cat===cat&&x.year===yr);
  document.getElementById('bgt-year').value=yr;
  document.getElementById('bgt-cat').value=cat;
  document.getElementById('bgt-amount').value=b?.amount||'';
  document.getElementById('bgt-currency').value=b?.currency||'SGD';
  document.getElementById('modal-budget').style.display='flex';
}

function saveBudgetEntry(){
  const yr=parseInt(document.getElementById('bgt-year').value);
  const cat=document.getElementById('bgt-cat').value;
  const amount=parseFloat(document.getElementById('bgt-amount').value)||0;
  const currency=document.getElementById('bgt-currency').value;
  if(!yr||!cat){alert('Year and category required.');return;}
  if(!DB.budgets)DB.budgets=[];
  const i=DB.budgets.findIndex(x=>x.cat===cat&&x.year===yr);
  if(i>=0)DB.budgets[i]={cat,year:yr,amount,currency};
  else DB.budgets.push({cat,year:yr,amount,currency});
  logActivity('Updated','Budget',cat+' FY'+yr+' → '+fmt(amount,currency));
  saveDB();closeModal('modal-budget');renderBudgets();
}

// ===================== CASHFLOW FORECAST TOGGLE =====================
let _cfForecastMode=false;
function toggleCashflowForecast(){
  _cfForecastMode=!_cfForecastMode;
  const btn=document.getElementById('cf-forecast-btn');
  const title=document.getElementById('cf-title');
  const content=document.getElementById('cashflow-content');
  const forecast=document.getElementById('cashflow-forecast');
  if(_cfForecastMode){
    if(btn)btn.textContent='📋 Statement View';
    if(title)title.textContent='90-Day Cash Flow Forecast';
    if(content)content.style.display='none';
    if(forecast){forecast.style.display='block';renderCashflowForecast();}
  }else{
    if(btn)btn.textContent='📈 90-Day Forecast';
    if(title)title.textContent='Cash Flow Statement';
    if(content)content.style.display='';
    if(forecast)forecast.style.display='none';
  }
}

function renderCashflowForecast(){
  const el=document.getElementById('cashflow-forecast');
  if(!el)return;
  const base=document.getElementById('baseCurrency').value;
  const sym=SYMBOLS[base]||'S$';
  const now=new Date();
  const scenarios=[{label:'30-Day Outlook',days:30,color:'var(--accent2)'},{label:'60-Day Outlook',days:60,color:'#f39c12'},{label:'90-Day Outlook',days:90,color:'var(--primary)'}];
  const cards=scenarios.map(s=>{
    const cutoff=new Date(now.getTime()+s.days*864e5);
    const expectedIn=DB.invoices.filter(i=>i.status!=='paid'&&i.status!=='draft'&&new Date(i.due)<=cutoff).reduce((sum,i)=>sum+toBase(getInvoiceBalance(i),i.currency),0);
    const billsOut=DB.bills.filter(b=>b.status!=='paid'&&new Date(b.due)<=cutoff).reduce((sum,b)=>sum+toBase(b.amount,b.currency),0);
    const months=new Set(DB.expenses.map(e=>e.date.slice(0,7))).size||1;
    const avgMoExp=DB.expenses.reduce((sum,e)=>sum+toBase(e.amount,e.currency),0)/months;
    const projExp=avgMoExp*(s.days/30);
    const net=expectedIn-billsOut-projExp;
    return `<div style="background:var(--surface2);border-radius:12px;padding:18px 20px;border-top:4px solid ${s.color}">
      <div style="font-weight:700;color:var(--primary);font-size:1rem;margin-bottom:12px">${s.label}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.85rem">
        <div style="color:var(--text-muted)">Receivables due</div>
        <div style="text-align:right;color:var(--accent2);font-weight:600">${sym}${Math.round(expectedIn).toLocaleString()}</div>
        <div style="color:var(--text-muted)">Bills due</div>
        <div style="text-align:right;color:var(--danger)">(${sym}${Math.round(billsOut).toLocaleString()})</div>
        <div style="color:var(--text-muted)">Est. expenses</div>
        <div style="text-align:right;color:var(--danger)">(${sym}${Math.round(projExp).toLocaleString()})</div>
        <div style="border-top:1px solid var(--border);padding-top:8px;font-weight:700;color:var(--primary)">Net Forecast</div>
        <div style="border-top:1px solid var(--border);padding-top:8px;text-align:right;font-weight:700;font-size:1.05rem;color:${net>=0?'var(--accent2)':'var(--danger)'}">${net>=0?'+':''}${sym}${Math.round(net).toLocaleString()}</div>
      </div>
    </div>`;
  });
  el.innerHTML=`<h4 style="margin:0 0 14px;color:var(--primary)">📈 90-Day Cash Flow Forecast</h4>
    <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">Based on outstanding invoices due, pending bills, and projected monthly expenses. <em>Estimates only.</em></p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${cards.join('')}</div>`;
}


(async function initApp(){
  const sbReady = _initSupabase();
  if(_checkRecoveryToken()) return; // handled by onAuthStateChange PASSWORD_RECOVERY

  // STIV SSO bridge — reached with an access/refresh token pair in the URL
  // fragment (never sent to any server) when opened from the STIV Systems
  // panel, which mints the session server-side using credentials it holds.
  // onAuthStateChange's SIGNED_IN handler below does the rest.
  if(sbReady){
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/,''));
    const ssoAccess = hashParams.get('access_token'), ssoRefresh = hashParams.get('refresh_token');
    if(ssoAccess && ssoRefresh && !window.location.hash.includes('type=recovery')){
      history.replaceState({}, '', window.location.pathname + window.location.search);
      await _sb.auth.setSession({access_token: ssoAccess, refresh_token: ssoRefresh});
    }
  }

  if(sbReady){
    // Check existing session
    const {data:{session}} = await _sb.auth.getSession();
    if(session){
      // If MFA is enrolled but not yet verified at aal2, force re-login
      const {data:aal} = await _sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if(aal && aal.nextLevel==='aal2' && aal.nextLevel!==aal.currentLevel){
        await _sb.auth.signOut();
        _showLoginScreen();
      } else {
        _user = session.user;
        _isAdmin = (_user.app_metadata && _user.app_metadata.role === 'admin');
        loadDB();
        await _pullDown();
        _showApp(_user.email);
        renderDashboard();
      }
    } else {
      _showLoginScreen();
    }
    // Listen for auth state changes
    _sb.auth.onAuthStateChange(async (event, session)=>{
      if(event==='SIGNED_IN' && session){
        // Guard: if MFA is required but not yet verified, don't open the app
        const {data:aal} = await _sb.auth.mfa.getAuthenticatorAssuranceLevel();
        if(aal && aal.nextLevel==='aal2' && aal.nextLevel!==aal.currentLevel) return;
        _user = session.user;
        _isAdmin = (_user.app_metadata && _user.app_metadata.role === 'admin');
        loadDB();
        await _pullDown();
        _showApp(_user.email);
        renderDashboard();
      } else if(event==='PASSWORD_RECOVERY'){
        // Show password reset form
        document.getElementById('reset-screen').style.display='flex';
        document.getElementById('login-screen').style.display='none';
      } else if(event==='SIGNED_OUT'){
        _user = null;
        _isAdmin = false;
        _showLoginScreen();
      }
    });
  } else {
    _showLoginScreen();
  }
})();

// ── Event bindings (extracted from inline HTML handlers) ──
(function() {
  document.addEventListener("DOMContentLoaded", function() {
    document.getElementById('login-password').addEventListener("keydown", (event) => { if(event.key==='Enter')doLogin() });
    document.getElementById('login-btn').addEventListener("click", (e) => { doLogin() });
    document.getElementById('_ev_1').addEventListener("click", (e) => { showForgotPw(event) });
    document.getElementById('mfa-code').addEventListener("input", function(e){ this.value=this.value.replace(/\D/g,'') });
    document.getElementById('mfa-code').addEventListener("keydown", (event) => { if(event.key==='Enter')verifyMFACode() });
    document.getElementById('mfa-btn').addEventListener("click", (e) => { verifyMFACode() });
    document.getElementById('_ev_2').addEventListener("click", (e) => { cancelMFA(event) });
    document.getElementById('reset-pw1').addEventListener("keydown", (event) => { if(event.key==='Enter')doPasswordReset() });
    document.getElementById('reset-pw2').addEventListener("keydown", (event) => { if(event.key==='Enter')doPasswordReset() });
    document.getElementById('reset-btn').addEventListener("click", (e) => { doPasswordReset() });
    document.getElementById('_ev_3').addEventListener("click", (e) => { showPage('dashboard') });
    document.getElementById('_ev_4').addEventListener("click", function(e){ toggleNavGroup(this) });
    document.getElementById('_ev_5').addEventListener("click", (e) => { showPage('invoices') });
    document.getElementById('_ev_6').addEventListener("click", (e) => { showPage('payments') });
    document.getElementById('_ev_7').addEventListener("click", (e) => { showPage('quotes') });
    document.getElementById('_ev_8').addEventListener("click", function(e){ toggleNavGroup(this) });
    document.getElementById('_ev_9').addEventListener("click", (e) => { showPage('expenses') });
    document.getElementById('_ev_10').addEventListener("click", (e) => { showPage('bills') });
    document.getElementById('_ev_11').addEventListener("click", (e) => { showPage('purchaseorders') });
    document.getElementById('_ev_12').addEventListener("click", function(e){ toggleNavGroup(this) });
    document.getElementById('_ev_13').addEventListener("click", (e) => { showPage('clients') });
    document.getElementById('_ev_14').addEventListener("click", (e) => { showPage('journal') });
    document.getElementById('_ev_15').addEventListener("click", (e) => { showPage('coa') });
    document.getElementById('nav-bankstatements').addEventListener("click", (e) => { showPage('bankstatements') });
    document.getElementById('btn-upload-statement').addEventListener("click", (e) => { openBankStatementModal() });
    document.getElementById('btn-close-stmt-modal').addEventListener("click", (e) => { closeModal('modal-bankstatement') });
    document.getElementById('btn-cancel-stmt').addEventListener("click", (e) => { closeModal('modal-bankstatement') });
    document.getElementById('btn-save-stmt').addEventListener("click", (e) => { saveBankStatement() });
    document.getElementById('_ev_16').addEventListener("click", function(e){ toggleNavGroup(this) });
    document.getElementById('_ev_17').addEventListener("click", (e) => { showPage('pnl') });
    document.getElementById('_ev_18').addEventListener("click", (e) => { showPage('balance') });
    document.getElementById('_ev_19').addEventListener("click", (e) => { showPage('cashflow') });
    document.getElementById('_ev_20').addEventListener("click", (e) => { showPage('budgets') });
    document.getElementById('_ev_21').addEventListener("click", function(e){ toggleNavGroup(this) });
    document.getElementById('_ev_22').addEventListener("click", (e) => { showPage('settings') });
    document.getElementById('logout-btn').addEventListener("click", (e) => { doLogout() });
    document.getElementById('baseCurrency').addEventListener("change", (e) => { updateCurrency() });
    document.getElementById('_ev_23').addEventListener("click", (e) => { showPage('invoices') });
    document.getElementById('_ev_24').addEventListener("click", (e) => { showPage('bills') });
    document.getElementById('inv-search').addEventListener("input", (e) => { renderInvoices() });
    document.getElementById('inv-filter').addEventListener("change", (e) => { renderInvoices() });
    document.getElementById('_ev_25').addEventListener("click", (e) => { openInvoiceModal() });
    document.getElementById('pay-search').addEventListener("input", (e) => { renderPayments() });
    document.getElementById('_ev_26').addEventListener("click", (e) => { openPaymentModal() });
    document.getElementById('exp-search').addEventListener("input", (e) => { renderExpenses() });
    document.getElementById('exp-filter').addEventListener("change", (e) => { renderExpenses() });
    document.getElementById('_ev_27').addEventListener("click", (e) => { openExpenseModal() });
    document.getElementById('_ev_28').addEventListener("click", (e) => { openReceiptScanner() });
    document.getElementById('bill-search').addEventListener("input", (e) => { renderBills() });
    document.getElementById('bill-filter').addEventListener("change", (e) => { renderBills() });
    document.getElementById('_ev_29').addEventListener("click", (e) => { openBillModal() });
    document.getElementById('cli-search').addEventListener("input", (e) => { renderClients() });
    document.getElementById('_ev_30').addEventListener("click", (e) => { openClientModal() });
    document.getElementById('coa-search').addEventListener("input", (e) => { renderCOA() });
    document.getElementById('coa-type-filter').addEventListener("change", (e) => { renderCOA() });
    document.getElementById('_ev_31').addEventListener("click", (e) => { openCOAModal() });
    document.getElementById('jrn-search').addEventListener("input", (e) => { renderJournal() });
    document.getElementById('_ev_32').addEventListener("click", (e) => { openJournalModal() });
    document.getElementById('pnl-period').addEventListener("change", (e) => { renderPnL() });
    document.getElementById('_ev_33').addEventListener("click", (e) => { exportReport('pnl') });
    document.getElementById('_ev_34').addEventListener("click", (e) => { exportReport('balance') });
    document.getElementById('_ev_35').addEventListener("click", (e) => { exportReport('cashflow') });
    document.getElementById('cf-forecast-btn').addEventListener("click", (e) => { toggleCashflowForecast() });
    document.getElementById('quote-search').addEventListener("input", (e) => { renderQuotes() });
    document.getElementById('quote-filter').addEventListener("change", (e) => { renderQuotes() });
    document.getElementById('_ev_36').addEventListener("click", (e) => { openQuoteModal(null) });
    document.getElementById('_ev_37').addEventListener("click", (e) => { closeModal('modal-quote') });
    document.getElementById('q-subtotal').addEventListener("input", (e) => { qAutoTotal() });
    document.getElementById('q-tax').addEventListener("input", (e) => { qAutoTotal() });
    document.getElementById('q-discount').addEventListener("input", (e) => { qAutoTotal() });
    document.getElementById('_ev_38').addEventListener("click", (e) => { closeModal('modal-quote') });
    document.getElementById('q-convert-btn').addEventListener("click", (e) => { convertQuoteToInvoice(document.getElementById('q-id').value) });
    document.getElementById('_ev_39').addEventListener("click", (e) => { saveQuote() });
    document.getElementById('po-search').addEventListener("input", (e) => { renderPurchaseOrders() });
    document.getElementById('po-filter').addEventListener("change", (e) => { renderPurchaseOrders() });
    document.getElementById('_ev_40').addEventListener("click", (e) => { openPOModal(null) });
    document.getElementById('_ev_41').addEventListener("click", (e) => { closeModal('modal-po') });
    document.getElementById('po-subtotal').addEventListener("input", (e) => { poAutoTotal() });
    document.getElementById('po-tax').addEventListener("input", (e) => { poAutoTotal() });
    document.getElementById('po-shipping').addEventListener("input", (e) => { poAutoTotal() });
    document.getElementById('_ev_42').addEventListener("click", (e) => { closeModal('modal-po') });
    document.getElementById('_ev_43').addEventListener("click", (e) => { savePO() });
    document.getElementById('budget-year').addEventListener("change", (e) => { renderBudgets() });
    document.getElementById('_ev_44').addEventListener("click", (e) => { openBudgetModal() });
    document.getElementById('_ev_45').addEventListener("click", (e) => { closeModal('modal-budget') });
    document.getElementById('_ev_46').addEventListener("click", (e) => { closeModal('modal-budget') });
    document.getElementById('_ev_47').addEventListener("click", (e) => { saveBudgetEntry() });
    document.getElementById('_ev_48').addEventListener("click", (e) => { saveSettings() });
    document.getElementById('_ev_49').addEventListener("click", (e) => { confirmResetAllData() });
    document.getElementById('mfa-confirm-code').addEventListener("input", function(e){ this.value=this.value.replace(/\D/g,'') });
    document.getElementById('mfa-confirm-code').addEventListener("keydown", (event) => { if(event.key==='Enter')confirmMFAEnroll() });
    document.getElementById('mfa-confirm-btn').addEventListener("click", (e) => { confirmMFAEnroll() });
    document.getElementById('_ev_50').addEventListener("click", (e) => { cancelMFAEnroll() });
    document.getElementById('mfa-enable-btn').addEventListener("click", (e) => { startMFAEnroll() });
    document.getElementById('mfa-disable-btn').addEventListener("click", (e) => { disableMFA() });
    document.getElementById('_ev_51').addEventListener("click", (e) => { exportData() });
    document.getElementById('_ev_52').addEventListener("click", (e) => { importData() });
    document.getElementById('_ev_53').addEventListener("click", (e) => { clearData() });
    document.getElementById('_ev_54').addEventListener("click", (e) => { closeModal('modal-invoice') });
    document.getElementById('_ev_55').addEventListener("click", (e) => { addInvoiceLine() });
    document.getElementById('_ev_56').addEventListener("click", (e) => { closeModal('modal-invoice') });
    document.getElementById('_ev_57').addEventListener("click", (e) => { saveInvoice() });
    document.getElementById('_ev_58').addEventListener("click", (e) => { closeModal('modal-payment') });
    document.getElementById('pay-amount').addEventListener("input", (e) => { updatePaymentBalance() });
    document.getElementById('_ev_59').addEventListener("click", (e) => { closeModal('modal-payment') });
    document.getElementById('_ev_60').addEventListener("click", (e) => { savePayment() });
    document.getElementById('_ev_61').addEventListener("click", (e) => { closeModal('modal-expense') });
    document.getElementById('_ev_62').addEventListener("click", (e) => { closeModal('modal-expense') });
    document.getElementById('_ev_63').addEventListener("click", (e) => { saveExpense() });
    document.getElementById('_ev_64').addEventListener("click", (e) => { closeModal('modal-bill') });
    document.getElementById('_ev_65').addEventListener("click", (e) => { closeModal('modal-bill') });
    document.getElementById('_ev_66').addEventListener("click", (e) => { saveBill() });
    document.getElementById('_ev_67').addEventListener("click", (e) => { closeModal('modal-client') });
    document.getElementById('_ev_68').addEventListener("click", (e) => { closeModal('modal-client') });
    document.getElementById('_ev_69').addEventListener("click", (e) => { saveClient() });
    document.getElementById('_ev_70').addEventListener("click", (e) => { closeModal('modal-coa') });
    document.getElementById('_ev_71').addEventListener("click", (e) => { closeModal('modal-coa') });
    document.getElementById('_ev_72').addEventListener("click", (e) => { saveCOA() });
    document.getElementById('_ev_73').addEventListener("click", (e) => { closeModal('modal-journal') });
    document.getElementById('_ev_74').addEventListener("click", (e) => { closeModal('modal-journal') });
    document.getElementById('_ev_75').addEventListener("click", (e) => { saveJournalEntry() });
    document.getElementById('_ev_76').addEventListener("click", (e) => { closeReceiptScanner() });
    document.getElementById('receipt-drop-zone').addEventListener("dragover", (e) => { dzDragOver(event) });
    document.getElementById('receipt-drop-zone').addEventListener("drop", (e) => { dzDrop(event) });
    document.getElementById('receipt-file-input').addEventListener("change", function(e){ handleReceiptFile(this.files[0]) });
    document.getElementById('_ev_77').addEventListener("click", (e) => { document.getElementById('receipt-camera-input').click() });
    document.getElementById('receipt-camera-input').addEventListener("change", function(e){ handleReceiptFile(this.files[0]) });
    document.getElementById('_ev_78').addEventListener("click", (e) => { resetScanner() });
    document.getElementById('scan-btn').addEventListener("click", (e) => { runOCR() });
    document.getElementById('_ev_79').addEventListener("click", (e) => { closeReceiptScanner() });
    document.getElementById('use-receipt-btn').addEventListener("click", (e) => { useReceiptData() });
  });
})();
