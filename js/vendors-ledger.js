/* =============================================
   ARHAM TRADERS — VENDORS LEDGER MODULE
   js/vendors-ledger.js
   ============================================= */

/* ---- State ---- */
let _vlDashMonth   = '';          // YYYY-MM  (dashboard)
let _vlDashSearch  = '';
let _vlActiveVendorId = null;
let _vlDetMonth    = '';          // YYYY-MM  (detail view)
let _vlDetSearch   = '';
let _vlDetMobTab   = 'expense';   // 'expense' | 'payment'

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  _vlDashMonth = _vlCurrentYM();
  _vlDetMonth  = _vlCurrentYM();

  _bindDashboardControls();
  _setDateDefaults();
  renderVLDashboard();
});

/* =============================================
   HELPERS
   ============================================= */
function _vlCurrentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function _vlMonthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(y, m - 1, 1).toLocaleString('en-PK', { month: 'long', year: 'numeric' });
}
function _vlPrevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function _vlNextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function _vlIsMonthClosed(vendorId, ym) {
  return DB.get('vendor_monthly_closings').some(c => c.vendorId === vendorId && c.month === ym);
}
function _vlGetClosing(vendorId, ym) {
  return DB.get('vendor_monthly_closings').find(c => c.vendorId === vendorId && c.month === ym) || null;
}
function _vlGetOpeningBalance(vendorId, ym) {
  const prev    = _vlPrevMonth(ym);
  const closing = _vlGetClosing(vendorId, prev);
  return closing ? (Number(closing.closingBalance) || 0) : 0;
}
function _vlGetMonthTotals(vendorId, ym) {
  const expenses = DB.filter('vendor_expenses', e => e.vendorId === vendorId && e.month === ym);
  const payments = DB.filter('vendor_payments', p => p.vendorId === vendorId && p.month === ym);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalPayments = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return { totalExpenses, totalPayments };
}
function _vlSetText(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}
function _setDateDefaults() {
  const today = new Date().toISOString().split('T')[0];
  ['vlExpDate','vlPayDate'].forEach(id => {
    const el = document.getElementById(id); if (el && !el.value) el.value = today;
  });
}

/* =============================================
   BIND DASHBOARD CONTROLS
   ============================================= */
function _bindDashboardControls() {
  document.getElementById('vlDashPrev')?.addEventListener('click', () => {
    _vlDashMonth = _vlPrevMonth(_vlDashMonth);
    _vlSetText('vlDashMonthLabel', _vlMonthLabel(_vlDashMonth));
    _renderMonthlyTable();
  });
  document.getElementById('vlDashNext')?.addEventListener('click', () => {
    _vlDashMonth = _vlNextMonth(_vlDashMonth);
    _vlSetText('vlDashMonthLabel', _vlMonthLabel(_vlDashMonth));
    _renderMonthlyTable();
  });
  document.getElementById('vlDashSearch')?.addEventListener('input', e => {
    _vlDashSearch = e.target.value.toLowerCase();
    _renderVendorCards();
  });
}

/* =============================================
   SHOW / HIDE VIEWS
   ============================================= */
function _showListView() {
  document.getElementById('vlRoot')?.classList.remove('vl-show-detail');
  _vlActiveVendorId = null;
}
function _showDetailView(vendorId) {
  _vlActiveVendorId = vendorId;
  _vlDetMonth       = _vlCurrentYM();
  _vlDetSearch      = '';
  const si = document.getElementById('vlDetSearch'); if (si) si.value = '';
  document.getElementById('vlRoot')?.classList.add('vl-show-detail');
  _renderVendorDetail(vendorId);
}

/* =============================================
   DASHBOARD RENDER
   ============================================= */
function renderVLDashboard() {
  _vlSetText('vlDashMonthLabel', _vlMonthLabel(_vlDashMonth));
  _renderSummaryCards();
  _renderMonthlyTable();
  _renderVendorCards();
}

function _renderSummaryCards() {
  const vendors = DB.get('vendors');
  let totalExp = 0, totalPay = 0;
  vendors.forEach(v => {
    const { totalExpenses, totalPayments } = _vlGetMonthTotals(v.id, _vlDashMonth);
    totalExp += totalExpenses;
    totalPay += totalPayments;
  });
  const netBal = vendors.reduce((sum, v) => {
    const opening = _vlGetOpeningBalance(v.id, _vlDashMonth);
    const { totalExpenses, totalPayments } = _vlGetMonthTotals(v.id, _vlDashMonth);
    return sum + opening + totalExpenses - totalPayments;
  }, 0);

  _vlSetText('vlSumVendors',  vendors.length);
  _vlSetText('vlSumExpense',  `PKR ${formatCurrency(totalExp)}`);
  _vlSetText('vlSumPayment',  `PKR ${formatCurrency(totalPay)}`);
  _vlSetText('vlSumBalance',  `PKR ${formatCurrency(netBal)}`);
}

function _renderMonthlyTable() {
  const tbody  = document.getElementById('vlMonthlyTbody');
  if (!tbody) return;
  const vendors = DB.get('vendors');
  if (!vendors.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">No vendors added yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = vendors.map(v => {
    const opening = _vlGetOpeningBalance(v.id, _vlDashMonth);
    const { totalExpenses, totalPayments } = _vlGetMonthTotals(v.id, _vlDashMonth);
    const balance   = opening + totalExpenses - totalPayments;
    const isClosed  = _vlIsMonthClosed(v.id, _vlDashMonth);
    const balClass  = balance > 0 ? 'balance-col owed' : 'balance-col';
    return `
      <tr>
        <td><strong>${escapeHtml(v.name)}</strong></td>
        <td>${escapeHtml(v.phone || '—')}</td>
        <td class="amount-col expense-col">PKR ${formatCurrency(totalExpenses)}</td>
        <td class="amount-col payment-col">PKR ${formatCurrency(totalPayments)}</td>
        <td class="amount-col ${balClass}">PKR ${formatCurrency(balance)}</td>
        <td><span class="vl-status-badge ${isClosed ? 'vsb-closed' : 'vsb-open'}">${isClosed ? 'Closed' : 'Open'}</span></td>
      </tr>`;
  }).join('');
}

function _renderVendorCards() {
  const container = document.getElementById('vlVendorCards');
  if (!container) return;
  let vendors = DB.get('vendors');
  if (_vlDashSearch) {
    vendors = vendors.filter(v =>
      (v.name  || '').toLowerCase().includes(_vlDashSearch) ||
      (v.phone || '').toLowerCase().includes(_vlDashSearch) ||
      (v.cnic  || '').toLowerCase().includes(_vlDashSearch)
    );
  }
  if (!vendors.length) {
    container.innerHTML = `
      <div class="vl-empty-vendors">
        <i class="fas fa-store-slash"></i>
        ${_vlDashSearch ? 'No vendors match your search.' : 'No vendors yet. Click "Add Vendor" to get started.'}
      </div>`;
    return;
  }
  container.innerHTML = vendors.map(v => {
    const opening = _vlGetOpeningBalance(v.id, _vlDashMonth);
    const { totalExpenses, totalPayments } = _vlGetMonthTotals(v.id, _vlDashMonth);
    const balance  = opening + totalExpenses - totalPayments;
    const balClass = balance <= 0 ? 'paid-up' : '';
    const initials = (v.name || '?').charAt(0).toUpperCase();
    return `
      <div class="vl-vendor-card" onclick="openVendor('${escapeHtml(v.id)}')">
        <div class="vl-vendor-card-top">
          <div class="vl-vendor-avatar">${initials}</div>
          <div>
            <div class="vl-vendor-name">${escapeHtml(v.name)}</div>
            <div class="vl-vendor-phone">${escapeHtml(v.phone || '—')}</div>
          </div>
        </div>
        <div class="vl-vendor-card-body">
          <div class="vl-vendor-meta">
            ${v.cnic    ? `<span><i class="fas fa-id-card"></i>${escapeHtml(v.cnic)}</span>` : ''}
            ${v.address ? `<span><i class="fas fa-location-dot"></i>${escapeHtml(v.address)}</span>` : ''}
          </div>
          <div class="vl-vendor-bal-row">
            <div>
              <div class="vl-vendor-bal-label">Balance (${_vlMonthLabel(_vlDashMonth)})</div>
              <div class="vl-vendor-bal-value ${balClass}">PKR ${formatCurrency(balance)}</div>
            </div>
            <span class="vl-open-btn"><i class="fas fa-arrow-right"></i> Open</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* =============================================
   OPEN / BACK
   ============================================= */
function openVendor(vendorId) {
  _showDetailView(vendorId);
}
function vlGoBack() {
  _showListView();
  renderVLDashboard();
}

/* =============================================
   VENDOR DETAIL RENDER
   ============================================= */
function _renderVendorDetail(vendorId) {
  const vendor = DB.findById('vendors', vendorId);
  if (!vendor) { _showListView(); return; }

  /* Vendor info */
  _vlSetText('vlDetVendorName', vendor.name);
  const metaEl = document.getElementById('vlDetVendorMeta');
  if (metaEl) {
    metaEl.innerHTML = `
      ${vendor.phone   ? `<span><i class="fas fa-phone"></i>${escapeHtml(vendor.phone)}</span>`   : ''}
      ${vendor.cnic    ? `<span><i class="fas fa-id-card"></i>${escapeHtml(vendor.cnic)}</span>`   : ''}
      ${vendor.address ? `<span><i class="fas fa-location-dot"></i>${escapeHtml(vendor.address)}</span>` : ''}`;
  }

  /* Month label + badge */
  _vlSetText('vlDetMonthLabel', _vlMonthLabel(_vlDetMonth));
  const badge = document.getElementById('vlDetMonthBadge');
  const isClosed = _vlIsMonthClosed(vendorId, _vlDetMonth);
  if (badge) {
    badge.className = `vl-month-badge ${isClosed ? 'vmb-closed' : 'vmb-open'}`;
    badge.innerHTML = isClosed ? '<i class="fas fa-lock"></i> Closed' : '<i class="fas fa-lock-open"></i> Open';
  }

  /* Balance cards */
  const opening  = _vlGetOpeningBalance(vendorId, _vlDetMonth);
  const { totalExpenses, totalPayments } = _vlGetMonthTotals(vendorId, _vlDetMonth);
  const netBal   = opening + totalExpenses - totalPayments;
  _vlSetText('vlDetOpeningBal', `PKR ${formatCurrency(opening)}`);
  _vlSetText('vlDetTotalExp',   `PKR ${formatCurrency(totalExpenses)}`);
  _vlSetText('vlDetTotalPay',   `PKR ${formatCurrency(totalPayments)}`);
  _vlSetText('vlDetNetBal',     `PKR ${formatCurrency(netBal)}`);
  const netCard = document.getElementById('vlDetNetCard');
  if (netCard) netCard.classList.toggle('clear-net', netBal <= 0);

  /* Lists */
  _renderExpenseList(vendorId);
  _renderPaymentList(vendorId);

  /* Panel totals */
  _vlSetText('vlExpPanelTotal', `PKR ${formatCurrency(totalExpenses)}`);
  _vlSetText('vlPayPanelTotal', `PKR ${formatCurrency(totalPayments)}`);

  /* Closing section */
  _renderClosingSection(vendorId, isClosed, opening, totalExpenses, totalPayments, netBal);

  /* Disable forms if closed */
  ['vlExpDate','vlExpDesc','vlExpRef','vlExpAmount','vlPayDate','vlPayDesc','vlPayRef','vlPayAmount'].forEach(id => {
    const el = document.getElementById(id); if (el) el.disabled = isClosed;
  });
  document.querySelectorAll('.vl-det-add-btn').forEach(btn => btn.disabled = isClosed);

  /* Bind detail controls (re-bind each time) */
  _bindDetailControls(vendorId);
}

/* =============================================
   BIND DETAIL CONTROLS
   ============================================= */
function _bindDetailControls(vendorId) {
  const prevBtn = document.getElementById('vlDetPrev');
  const nextBtn = document.getElementById('vlDetNext');
  const srch    = document.getElementById('vlDetSearch');
  const expForm = document.getElementById('vlExpForm');
  const payForm = document.getElementById('vlPayForm');

  /* Remove old listeners by cloning */
  if (prevBtn) { const c = prevBtn.cloneNode(true); prevBtn.parentNode.replaceChild(c, prevBtn); c.addEventListener('click', () => { _vlDetMonth = _vlPrevMonth(_vlDetMonth); _renderVendorDetail(vendorId); }); }
  if (nextBtn) { const c = nextBtn.cloneNode(true); nextBtn.parentNode.replaceChild(c, nextBtn); c.addEventListener('click', () => { _vlDetMonth = _vlNextMonth(_vlDetMonth); _renderVendorDetail(vendorId); }); }
  if (srch)    { const c = srch.cloneNode(true);    srch.parentNode.replaceChild(c, srch);    c.value = _vlDetSearch; c.addEventListener('input', e => { _vlDetSearch = e.target.value.toLowerCase(); _renderExpenseList(vendorId); _renderPaymentList(vendorId); }); }
  if (expForm) { const c = expForm.cloneNode(true);  expForm.parentNode.replaceChild(c, expForm); c.addEventListener('submit', e => { e.preventDefault(); _addVendorEntry('expense', vendorId); }); }
  if (payForm) { const c = payForm.cloneNode(true);  payForm.parentNode.replaceChild(c, payForm); c.addEventListener('submit', e => { e.preventDefault(); _addVendorEntry('payment', vendorId); }); }
}

/* =============================================
   ENTRY LISTS
   ============================================= */
function _renderExpenseList(vendorId) {
  const container = document.getElementById('vlExpList');
  if (!container) return;
  let entries = DB.filter('vendor_expenses', e => e.vendorId === vendorId && e.month === _vlDetMonth)
                  .sort((a, b) => a.date.localeCompare(b.date));
  if (_vlDetSearch) entries = entries.filter(e => _vlMatchSearch(e));
  if (!entries.length) {
    container.innerHTML = `<div class="vl-empty-panel"><i class="fas fa-receipt"></i>${_vlDetSearch ? 'No entries match.' : 'No expenses this month.'}</div>`;
    return;
  }
  const closed = _vlIsMonthClosed(vendorId, _vlDetMonth);
  container.innerHTML = entries.map(e => `
    <div class="vl-entry">
      <div class="vl-entry-dot exp-dot"></div>
      <div class="vl-entry-info">
        <div class="vl-entry-desc">${escapeHtml(e.description)}</div>
        <div class="vl-entry-meta">${formatDate(e.date)}${e.reference ? ` &nbsp;·&nbsp; ${escapeHtml(e.reference)}` : ''}</div>
      </div>
      <div class="vl-entry-amount vl-exp-amount">PKR ${formatCurrency(e.amount)}</div>
      ${!closed ? `<button class="vl-entry-del" title="Delete" onclick="vlDeleteEntry('expense','${escapeHtml(e.id)}','${escapeHtml(e.description)}','${escapeHtml(vendorId)}')"><i class="fas fa-times"></i></button>` : ''}
    </div>`).join('');
}

function _renderPaymentList(vendorId) {
  const container = document.getElementById('vlPayList');
  if (!container) return;
  let entries = DB.filter('vendor_payments', p => p.vendorId === vendorId && p.month === _vlDetMonth)
                  .sort((a, b) => a.date.localeCompare(b.date));
  if (_vlDetSearch) entries = entries.filter(e => _vlMatchSearch(e));
  if (!entries.length) {
    container.innerHTML = `<div class="vl-empty-panel"><i class="fas fa-money-bill-wave"></i>${_vlDetSearch ? 'No entries match.' : 'No payments this month.'}</div>`;
    return;
  }
  const closed = _vlIsMonthClosed(vendorId, _vlDetMonth);
  container.innerHTML = entries.map(p => `
    <div class="vl-entry">
      <div class="vl-entry-dot pay-dot"></div>
      <div class="vl-entry-info">
        <div class="vl-entry-desc">${escapeHtml(p.description)}</div>
        <div class="vl-entry-meta">${formatDate(p.date)}${p.reference ? ` &nbsp;·&nbsp; ${escapeHtml(p.reference)}` : ''}</div>
      </div>
      <div class="vl-entry-amount vl-pay-amount">PKR ${formatCurrency(p.amount)}</div>
      ${!closed ? `<button class="vl-entry-del" title="Delete" onclick="vlDeleteEntry('payment','${escapeHtml(p.id)}','${escapeHtml(p.description)}','${escapeHtml(vendorId)}')"><i class="fas fa-times"></i></button>` : ''}
    </div>`).join('');
}

function _vlMatchSearch(e) {
  return (e.description || '').toLowerCase().includes(_vlDetSearch) ||
         (e.reference   || '').toLowerCase().includes(_vlDetSearch) ||
         (e.date        || '').includes(_vlDetSearch);
}

/* =============================================
   ADD ENTRY
   ============================================= */
function _addVendorEntry(type, vendorId) {
  if (_vlIsMonthClosed(vendorId, _vlDetMonth)) {
    showToast('This month is closed.', 'warning'); return;
  }
  const prefix  = type === 'expense' ? 'vlExp' : 'vlPay';
  const date    = sanitizeInput(document.getElementById(`${prefix}Date`)?.value   || '');
  const desc    = sanitizeInput(document.getElementById(`${prefix}Desc`)?.value   || '');
  const ref     = sanitizeInput(document.getElementById(`${prefix}Ref`)?.value    || '');
  const amount  = parseFloat(document.getElementById(`${prefix}Amount`)?.value)   || 0;

  if (!date)       { showToast('Please select a date.',    'error'); return; }
  if (!desc)       { showToast('Description is required.', 'error'); return; }
  if (amount <= 0) { showToast('Enter a valid amount.',    'error'); return; }

  const key = type === 'expense' ? 'vendor_expenses' : 'vendor_payments';
  DB.add(key, { vendorId, month: _vlDetMonth, date, description: desc, reference: ref, amount });

  if (type === 'payment') {
    const vendor = DB.findById('vendors', vendorId);
    const vendorName = vendor ? vendor.name : 'Vendor';
    DB.add('expenses', {
      month: date.substring(0, 7),
      date,
      description: `Payment to ${vendorName} — ${desc}`,
      reference: ref || vendorName,
      amount
    });
  }

  document.getElementById(`${prefix}Desc`).value   = '';
  document.getElementById(`${prefix}Ref`).value    = '';
  document.getElementById(`${prefix}Amount`).value = '';

  showToast(`${type === 'expense' ? 'Expense' : 'Payment'} of PKR ${formatCurrency(amount)} added.`, 'success');
  _renderVendorDetail(vendorId);
}

/* =============================================
   DELETE ENTRY
   ============================================= */
function vlDeleteEntry(type, id, desc, vendorId) {
  if (_vlIsMonthClosed(vendorId, _vlDetMonth)) {
    showToast('Month is closed. Cannot delete.', 'warning'); return;
  }
  showConfirm(`Delete "${desc}"?`, () => {
    const key = type === 'expense' ? 'vendor_expenses' : 'vendor_payments';
    DB.remove(key, id);
    showToast('Entry deleted.', 'success');
    _renderVendorDetail(vendorId);
  }, 'Delete');
}

/* =============================================
   MONTHLY CLOSING SECTION
   ============================================= */
function _renderClosingSection(vendorId, isClosed, opening, totalExpenses, totalPayments, netBal) {
  const section = document.getElementById('vlClosingSection');
  if (!section) return;
  const closingData = _vlGetClosing(vendorId, _vlDetMonth);

  if (isClosed && closingData) {
    section.innerHTML = `
      <div class="vl-closing-info">
        <h4><i class="fas fa-lock" style="color:var(--stone);margin-right:6px;"></i>${_vlMonthLabel(_vlDetMonth)} — Closed</h4>
        <p>This month is locked. Closing balance carries to next month as Opening Balance.</p>
      </div>
      <div class="vl-closing-summary">
        <div class="vl-cs-item"><div class="vl-cs-value" style="color:var(--copper);">PKR ${formatCurrency(closingData.totalExpenses)}</div><div class="vl-cs-label">Expenses</div></div>
        <div class="vl-cs-item"><div class="vl-cs-value" style="color:var(--emerald);">PKR ${formatCurrency(closingData.totalPayments)}</div><div class="vl-cs-label">Payments</div></div>
        <div class="vl-cs-item"><div class="vl-cs-value" style="color:var(--teal);">PKR ${formatCurrency(closingData.closingBalance)}</div><div class="vl-cs-label">Closing Balance</div></div>
      </div>
      <button class="vl-close-btn" style="background:var(--stone);" onclick="vlReopenMonth('${escapeHtml(vendorId)}')">
        <i class="fas fa-lock-open"></i> Reopen Month
      </button>`;
  } else {
    section.innerHTML = `
      <div class="vl-closing-info">
        <h4><i class="fas fa-calendar-check" style="color:var(--teal);margin-right:6px;"></i>Monthly Closing — ${_vlMonthLabel(_vlDetMonth)}</h4>
        <p>Close this month to lock all entries. The closing balance becomes the next month's opening balance.</p>
      </div>
      <div class="vl-closing-summary">
        <div class="vl-cs-item"><div class="vl-cs-value" style="color:var(--mineral-blue);">PKR ${formatCurrency(opening)}</div><div class="vl-cs-label">Opening</div></div>
        <div class="vl-cs-item"><div class="vl-cs-value" style="color:var(--copper);">PKR ${formatCurrency(totalExpenses)}</div><div class="vl-cs-label">Expenses</div></div>
        <div class="vl-cs-item"><div class="vl-cs-value" style="color:var(--emerald);">PKR ${formatCurrency(totalPayments)}</div><div class="vl-cs-label">Payments</div></div>
        <div class="vl-cs-item"><div class="vl-cs-value" style="color:var(--teal);font-size:17px;">PKR ${formatCurrency(netBal)}</div><div class="vl-cs-label">Closing Balance</div></div>
      </div>
      <button class="vl-close-btn" onclick="vlCloseMonth('${escapeHtml(vendorId)}')">
        <i class="fas fa-lock"></i> Close Month
      </button>`;
  }
}

/* =============================================
   CLOSE / REOPEN MONTH
   ============================================= */
function vlCloseMonth(vendorId) {
  const opening  = _vlGetOpeningBalance(vendorId, _vlDetMonth);
  const { totalExpenses, totalPayments } = _vlGetMonthTotals(vendorId, _vlDetMonth);
  const closingBalance = opening + totalExpenses - totalPayments;
  const vendor = DB.findById('vendors', vendorId);
  showConfirm(
    `Close ${_vlMonthLabel(_vlDetMonth)} for "${vendor?.name}"?\n\nClosing Balance: PKR ${formatCurrency(closingBalance)}\n\nEntries will be locked and balance carries forward.`,
    () => {
      DB.add('vendor_monthly_closings', {
        vendorId, month: _vlDetMonth, openingBalance: opening,
        totalExpenses, totalPayments, closingBalance,
        closedAt: new Date().toISOString()
      });
      showToast(`Month closed. Closing balance: PKR ${formatCurrency(closingBalance)}`, 'success');
      _renderVendorDetail(vendorId);
    }, 'Close Month');
}

function vlReopenMonth(vendorId) {
  showConfirm(`Reopen ${_vlMonthLabel(_vlDetMonth)} for this vendor?`, () => {
    const closing = _vlGetClosing(vendorId, _vlDetMonth);
    if (closing) DB.remove('vendor_monthly_closings', closing.id);
    showToast('Month reopened.', 'success');
    _renderVendorDetail(vendorId);
  }, 'Reopen');
}

/* =============================================
   MOBILE TAB SWITCH (DETAIL)
   ============================================= */
function vlSwitchMobTab(tab) {
  _vlDetMobTab = tab;
  const expTab = document.getElementById('vlMobExpTab');
  const payTab = document.getElementById('vlMobPayTab');
  const expPanel = document.getElementById('vlExpPanel');
  const payPanel = document.getElementById('vlPayPanel');
  if (expTab) expTab.className = `vl-mob-tab${tab === 'expense' ? ' mob-expense' : ''}`;
  if (payTab) payTab.className = `vl-mob-tab${tab === 'payment' ? ' mob-payment' : ''}`;
  if (expPanel) expPanel.classList.toggle('hidden-mob', tab !== 'expense');
  if (payPanel) payPanel.classList.toggle('hidden-mob', tab !== 'payment');
}

/* =============================================
   ADD / EDIT VENDOR MODAL
   ============================================= */
function openAddVendorModal() {
  document.getElementById('vlVendorModalTitle').textContent = 'Add Vendor';
  document.getElementById('vlVendorIdField').value  = '';
  document.getElementById('vlVendorName').value     = '';
  document.getElementById('vlVendorCnic').value     = '';
  document.getElementById('vlVendorPhone').value    = '';
  document.getElementById('vlVendorAddress').value  = '';
  openModal('vlVendorModal');
}

function openEditVendorModal() {
  if (!_vlActiveVendorId) return;
  const vendor = DB.findById('vendors', _vlActiveVendorId);
  if (!vendor) return;
  document.getElementById('vlVendorModalTitle').textContent = 'Edit Vendor';
  document.getElementById('vlVendorIdField').value  = vendor.id;
  document.getElementById('vlVendorName').value     = vendor.name     || '';
  document.getElementById('vlVendorCnic').value     = vendor.cnic     || '';
  document.getElementById('vlVendorPhone').value    = vendor.phone    || '';
  document.getElementById('vlVendorAddress').value  = vendor.address  || '';
  openModal('vlVendorModal');
}

function vlSaveVendor() {
  const name    = sanitizeInput(document.getElementById('vlVendorName')?.value    || '');
  const cnic    = sanitizeInput(document.getElementById('vlVendorCnic')?.value    || '');
  const phone   = sanitizeInput(document.getElementById('vlVendorPhone')?.value   || '');
  const address = sanitizeInput(document.getElementById('vlVendorAddress')?.value || '');
  const existId = document.getElementById('vlVendorIdField')?.value;

  if (!name) { showToast('Vendor name is required.', 'error'); return; }

  if (existId) {
    DB.update('vendors', existId, { name, cnic, phone, address });
    showToast('Vendor updated.', 'success');
    closeModal('vlVendorModal');
    _renderVendorDetail(existId);
  } else {
    const newId = DB.add('vendors', { name, cnic, phone, address });
    showToast(`Vendor "${name}" added.`, 'success');
    closeModal('vlVendorModal');
    renderVLDashboard();
  }
}

function vlDeleteVendor() {
  if (!_vlActiveVendorId) return;
  const vendor = DB.findById('vendors', _vlActiveVendorId);
  showConfirm(
    `Delete vendor "${vendor?.name}"?\n\nAll related expenses, payments, and monthly closings will also be deleted.`,
    () => {
      DB.remove('vendors', _vlActiveVendorId);
      /* Remove all related data */
      const expenses = DB.filter('vendor_expenses',         e => e.vendorId === _vlActiveVendorId);
      const payments = DB.filter('vendor_payments',         p => p.vendorId === _vlActiveVendorId);
      const closings = DB.filter('vendor_monthly_closings', c => c.vendorId === _vlActiveVendorId);
      expenses.forEach(e => DB.remove('vendor_expenses',         e.id));
      payments.forEach(p => DB.remove('vendor_payments',         p.id));
      closings.forEach(c => DB.remove('vendor_monthly_closings', c.id));
      showToast('Vendor deleted.', 'success');
      _showListView();
      renderVLDashboard();
    }, 'Delete Vendor');
}
