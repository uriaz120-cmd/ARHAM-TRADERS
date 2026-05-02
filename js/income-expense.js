/* =============================================
   ARHAM TRADERS — INCOME & EXPENSE MODULE
   js/income-expense.js
   ============================================= */

/* ---- State ---- */
let _ieMonth      = '';      /* 'YYYY-MM' */
let _ieSearch     = '';
let _ieMobileTab  = 'income'; /* 'income' | 'expense' */

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  _ieMonth = _currentYearMonth();
  _renderMonthLabel();
  _bindControls();
  renderIE();
});

/* =============================================
   HELPERS
   ============================================= */
function _currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1, 1).toLocaleString('en-PK', { month: 'long', year: 'numeric' });
}

function _prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _isMonthClosed(ym) {
  return DB.get('monthly_closings').some(c => c.month === ym);
}

function _getClosing(ym) {
  return DB.get('monthly_closings').find(c => c.month === ym) || null;
}

function _getOpeningBalance(ym) {
  /* Check if previous month has a closing — use that as opening */
  const prev    = _prevMonth(ym);
  const closing = _getClosing(prev);
  if (closing) return Number(closing.closingBalance) || 0;
  return 0;
}

/* =============================================
   BIND CONTROLS
   ============================================= */
function _bindControls() {
  document.getElementById('iePrevMonth')?.addEventListener('click', () => {
    _ieMonth = _prevMonth(_ieMonth); _renderMonthLabel(); renderIE();
  });
  document.getElementById('ieNextMonth')?.addEventListener('click', () => {
    _ieMonth = _nextMonth(_ieMonth); _renderMonthLabel(); renderIE();
  });
  document.getElementById('ieSearch')?.addEventListener('input', e => {
    _ieSearch = e.target.value.toLowerCase(); renderIE();
  });

  /* Income form submit */
  document.getElementById('incomeForm')?.addEventListener('submit', e => {
    e.preventDefault(); addEntry('income');
  });
  /* Expense form submit */
  document.getElementById('expenseForm')?.addEventListener('submit', e => {
    e.preventDefault(); addEntry('expense');
  });
}

function _renderMonthLabel() {
  const el = document.getElementById('ieMonthLabel');
  if (el) el.textContent = _monthLabel(_ieMonth);
}

/* =============================================
   MOBILE TAB SWITCH
   ============================================= */
function switchMobileTab(tab) {
  _ieMobileTab = tab;
  const incomeTab  = document.getElementById('mobTabIncome');
  const expenseTab = document.getElementById('mobTabExpense');
  const incomePanel  = document.getElementById('incomePanel');
  const expensePanel = document.getElementById('expensePanel');

  if (incomeTab)  incomeTab.className  = `ie-mob-tab${tab === 'income'  ? ' active-income'  : ''}`;
  if (expenseTab) expenseTab.className = `ie-mob-tab${tab === 'expense' ? ' active-expense' : ''}`;
  if (incomePanel)  incomePanel.classList.toggle('hidden-mobile',  tab !== 'income');
  if (expensePanel) expensePanel.classList.toggle('hidden-mobile', tab !== 'expense');
}

/* =============================================
   ADD ENTRY
   ============================================= */
function addEntry(type) {
  if (_isMonthClosed(_ieMonth)) {
    showToast('This month is closed. You cannot add entries.', 'warning'); return;
  }

  const prefix = type === 'income' ? 'inc' : 'exp';
  const date   = sanitizeInput(document.getElementById(`${prefix}Date`)?.value    || '');
  const desc   = sanitizeInput(document.getElementById(`${prefix}Desc`)?.value    || '');
  const ref    = sanitizeInput(document.getElementById(`${prefix}Ref`)?.value     || '');
  const amount = parseFloat(document.getElementById(`${prefix}Amount`)?.value)    || 0;

  if (!date)         { showToast('Please select a date.',       'error'); return; }
  if (!desc)         { showToast('Description is required.',    'error'); return; }
  if (amount <= 0)   { showToast('Enter a valid amount.',       'error'); return; }

  DB.add(type === 'income' ? 'income' : 'expenses', {
    month: _ieMonth, date, description: desc, reference: ref, amount
  });

  /* Reset only the quick form */
  document.getElementById(`${prefix}Desc`).value   = '';
  document.getElementById(`${prefix}Ref`).value    = '';
  document.getElementById(`${prefix}Amount`).value = '';

  showToast(`${type === 'income' ? 'Income' : 'Expense'} of PKR ${formatCurrency(amount)} added.`, 'success');
  renderIE();
}

/* =============================================
   DELETE ENTRY
   ============================================= */
function deleteEntry(type, id, desc) {
  if (_isMonthClosed(_ieMonth)) {
    showToast('This month is closed. Cannot delete.', 'warning'); return;
  }
  showConfirm(`Delete "${desc}"?`, () => {
    DB.remove(type === 'income' ? 'income' : 'expenses', id);
    showToast('Entry deleted.', 'success');
    renderIE();
  }, 'Delete');
}

/* =============================================
   PDF DOWNLOAD — ENTRY SLIP
   ============================================= */
function downloadEntryPdf(type, id) {
  const entry = DB.findById(type === 'income' ? 'income' : 'expenses', id);
  if (!entry) { showToast('Entry not found.', 'error'); return; }
  const label  = type === 'income' ? 'INCOME' : 'EXPENSE';
  const color  = type === 'income' ? '#2a9d8f' : '#e07b39';
  const slipHtml = `
    <div style="font-family:Arial,sans-serif;padding:20px;max-width:320px;border:1px solid #ddd;border-radius:8px;">
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:700;color:#181c2a;">ARHAM TRADERS</div>
        <div style="font-size:11px;color:#888;">Mineral Processing &amp; Trading</div>
        <div style="display:inline-block;margin-top:6px;padding:3px 14px;background:${color};color:#fff;border-radius:20px;font-size:12px;font-weight:700;">${label} SLIP</div>
      </div>
      <hr style="border:none;border-top:1px solid #eee;margin:10px 0;"/>
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="color:#888;padding:4px 0;">Date</td><td style="font-weight:600;text-align:right;">${formatDate(entry.date)}</td></tr>
        <tr><td style="color:#888;padding:4px 0;">Description</td><td style="font-weight:600;text-align:right;">${escapeHtml(entry.description)}</td></tr>
        ${entry.reference ? `<tr><td style="color:#888;padding:4px 0;">Reference</td><td style="font-weight:600;text-align:right;">${escapeHtml(entry.reference)}</td></tr>` : ''}
        <tr><td style="color:#888;padding:4px 0;">Month</td><td style="font-weight:600;text-align:right;">${_monthLabel(entry.month || _ieMonth)}</td></tr>
      </table>
      <div style="margin-top:12px;padding:12px;background:${color}18;border-radius:6px;text-align:center;">
        <div style="font-size:11px;color:#888;margin-bottom:2px;">AMOUNT</div>
        <div style="font-size:22px;font-weight:800;color:${color};">PKR ${formatCurrency(entry.amount)}</div>
      </div>
      <div style="text-align:center;margin-top:12px;font-size:10px;color:#aaa;">Arham Traders Management System</div>
    </div>`;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = slipHtml;
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;background:#fff;';
  document.body.appendChild(wrapper);
  const opt = {
    margin: 6,
    filename: `${label}-${escapeHtml(entry.id)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a6', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(wrapper.firstElementChild).save().then(() => {
    document.body.removeChild(wrapper);
    showToast('PDF downloaded.', 'success');
  });
}


function renderIE() {
  const isClosed      = _isMonthClosed(_ieMonth);
  const openingBal    = _getOpeningBalance(_ieMonth);

  /* Fetch all entries for this month */
  let incomeEntries  = DB.filter('income',   e => e.month === _ieMonth);
  let expenseEntries = DB.filter('expenses', e => e.month === _ieMonth);

  /* Sort by date ascending */
  incomeEntries  = incomeEntries .sort((a, b) => a.date.localeCompare(b.date));
  expenseEntries = expenseEntries.sort((a, b) => a.date.localeCompare(b.date));

  /* Totals */
  const totalIncome  = incomeEntries .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalExpense = expenseEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netBalance   = openingBal + totalIncome - totalExpense;

  /* Balance cards */
  _setText('ieOpeningBal', `PKR ${formatCurrency(openingBal)}`);
  _setText('ieTotalIncome',  `PKR ${formatCurrency(totalIncome)}`);
  _setText('ieTotalExpense', `PKR ${formatCurrency(totalExpense)}`);
  _setText('ieNetBalance',   `PKR ${formatCurrency(netBalance)}`);

  const netCard = document.getElementById('ieNetCard');
  if (netCard) netCard.classList.toggle('negative', netBalance < 0);

  /* Month status badge */
  const badge = document.getElementById('ieMonthStatus');
  if (badge) {
    badge.className  = `month-status-badge ${isClosed ? 'msb-closed' : 'msb-open'}`;
    badge.innerHTML  = isClosed
      ? '<i class="fas fa-lock"></i> Closed'
      : '<i class="fas fa-lock-open"></i> Open';
  }

  /* Apply search filter */
  if (_ieSearch) {
    incomeEntries  = incomeEntries .filter(e => _matchSearch(e));
    expenseEntries = expenseEntries.filter(e => _matchSearch(e));
  }

  /* Render lists */
  _renderEntryList('incomeList',  incomeEntries,  'income');
  _renderEntryList('expenseList', expenseEntries, 'expense');

  /* Panel totals */
  _setText('incomePanelTotal',  `PKR ${formatCurrency(totalIncome)}`);
  _setText('expensePanelTotal', `PKR ${formatCurrency(totalExpense)}`);

  /* Closing section */
  _renderClosingSection(isClosed, openingBal, totalIncome, totalExpense, netBalance);

  /* Disable add forms if closed */
  ['incDate','incDesc','incRef','incAmount','expDate','expDesc','expRef','expAmount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = isClosed;
  });
  document.querySelectorAll('.ie-add-btn').forEach(btn => btn.disabled = isClosed);
}

/* ---- Search match ---- */
function _matchSearch(e) {
  return (e.description || '').toLowerCase().includes(_ieSearch) ||
         (e.reference   || '').toLowerCase().includes(_ieSearch) ||
         (e.date        || '').includes(_ieSearch);
}

/* ---- setText helper ---- */
function _setText(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}

/* ---- Render single entry list ---- */
function _renderEntryList(containerId, entries, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `
      <div class="ie-empty-panel">
        <i class="fas ${type === 'income' ? 'fa-arrow-down-to-line' : 'fa-arrow-up-from-line'}"></i>
        ${_ieSearch ? 'No entries match your search.' : `No ${type} entries for this month.`}
      </div>`;
    return;
  }

  container.innerHTML = entries.map(e => `
    <div class="ie-entry">
      <div class="ie-entry-dot ${type}-dot"></div>
      <div class="ie-entry-info">
        <div class="ie-entry-desc">${escapeHtml(e.description)}</div>
        <div class="ie-entry-meta">
          ${formatDate(e.date)}
          ${e.reference ? ` &nbsp;·&nbsp; Ref: ${escapeHtml(e.reference)}` : ''}
        </div>
      </div>
      <div class="ie-entry-amount ${type}-amount">PKR ${formatCurrency(e.amount)}</div>
      <button class="ie-entry-del" title="Download PDF" style="background:var(--mineral-blue);"
        onclick="downloadEntryPdf('${type}','${escapeHtml(e.id)}')">
        <i class="fas fa-file-pdf"></i>
      </button>
      ${!_isMonthClosed(_ieMonth)
        ? `<button class="ie-entry-del" title="Delete"
             onclick="deleteEntry('${type}','${escapeHtml(e.id)}','${escapeHtml(e.description)}')">
             <i class="fas fa-times"></i>
           </button>`
        : ''}
    </div>`).join('');
}

/* =============================================
   MONTHLY CLOSING SECTION
   ============================================= */
function _renderClosingSection(isClosed, opening, income, expense, net) {
  const section = document.getElementById('ieClosingSection');
  if (!section) return;

  const closingData = _getClosing(_ieMonth);

  if (isClosed && closingData) {
    section.innerHTML = `
      <div class="ie-closing-info">
        <h4><i class="fas fa-lock" style="color:var(--stone);margin-right:6px;"></i>${_monthLabel(_ieMonth)} — Closed</h4>
        <p>This month has been closed on ${formatDate(closingData.closedAt || closingData.month)}. Balance carried to next month.</p>
      </div>
      <div class="ie-closing-summary">
        <div class="ics-item"><div class="ics-value" style="color:var(--emerald);">PKR ${formatCurrency(closingData.totalIncome)}</div><div class="ics-label">Total Income</div></div>
        <div class="ics-item"><div class="ics-value" style="color:var(--copper);">PKR ${formatCurrency(closingData.totalExpense)}</div><div class="ics-label">Total Expense</div></div>
        <div class="ics-item"><div class="ics-value" style="color:var(--teal);">PKR ${formatCurrency(closingData.closingBalance)}</div><div class="ics-label">Closing Balance</div></div>
      </div>
      <button class="ie-close-btn" style="background:var(--stone);" onclick="reopenMonth()">
        <i class="fas fa-lock-open"></i> Reopen Month
      </button>`;
  } else {
    section.innerHTML = `
      <div class="ie-closing-info">
        <h4><i class="fas fa-calendar-check" style="color:var(--teal);margin-right:6px;"></i>Monthly Closing — ${_monthLabel(_ieMonth)}</h4>
        <p>Close this month to lock entries. Closing balance becomes next month's opening balance.</p>
      </div>
      <div class="ie-closing-summary">
        <div class="ics-item"><div class="ics-value" style="color:var(--mineral-blue);">PKR ${formatCurrency(opening)}</div><div class="ics-label">Opening Balance</div></div>
        <div class="ics-item"><div class="ics-value" style="color:var(--emerald);">PKR ${formatCurrency(income)}</div><div class="ics-label">Income</div></div>
        <div class="ics-item"><div class="ics-value" style="color:var(--copper);">PKR ${formatCurrency(expense)}</div><div class="ics-label">Expense</div></div>
        <div class="ics-item"><div class="ics-value" style="color:var(--teal);font-size:18px;">PKR ${formatCurrency(net)}</div><div class="ics-label">Closing Balance</div></div>
      </div>
      <button class="ie-close-btn" onclick="closeMonth()">
        <i class="fas fa-lock"></i> Close Month
      </button>`;
  }
}

/* =============================================
   CLOSE / REOPEN MONTH
   ============================================= */
function closeMonth() {
  const incomeEntries  = DB.filter('income',   e => e.month === _ieMonth);
  const expenseEntries = DB.filter('expenses', e => e.month === _ieMonth);
  const opening        = _getOpeningBalance(_ieMonth);
  const totalIncome    = incomeEntries .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalExpense   = expenseEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const closingBalance = opening + totalIncome - totalExpense;

  showConfirm(
    `Close ${_monthLabel(_ieMonth)}?\n\nClosing Balance: PKR ${formatCurrency(closingBalance)}\n\nThis will become next month's Opening Balance. Entries will be locked.`,
    () => {
      DB.add('monthly_closings', {
        month: _ieMonth,
        openingBalance: opening,
        totalIncome,
        totalExpense,
        closingBalance,
        closedAt: new Date().toISOString()
      });
      showToast(`${_monthLabel(_ieMonth)} closed. Closing balance: PKR ${formatCurrency(closingBalance)}`, 'success');
      renderIE();
    },
    'Close Month'
  );
}

function reopenMonth() {
  showConfirm(
    `Reopen ${_monthLabel(_ieMonth)}?\n\nThis will remove the closing record and allow editing entries again.`,
    () => {
      const closing = _getClosing(_ieMonth);
      if (closing) DB.remove('monthly_closings', closing.id);
      showToast(`${_monthLabel(_ieMonth)} reopened.`, 'success');
      renderIE();
    },
    'Reopen'
  );
}
