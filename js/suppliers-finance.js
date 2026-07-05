/* =============================================
   ARHAM TRADERS — SUPPLIERS FINANCE MODULE
   js/suppliers-finance.js
   ============================================= */

/* ---- State ---- */
let _sfActiveSupId  = null;
let _sfListSearch   = '';
let _sfListMonth    = '';    /* '' = all months */
let _sfDetSearch    = '';
let _sfDetMonth     = '';    /* '' = all months */
let _sfDetMobTab    = 'bookings';  /* 'bookings' | 'received' */

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  _sfListMonth = _sfCurrentYM();
  _sfDetMonth  = _sfCurrentYM();

  _populateMonthFilters();
  _bindListControls();
  renderSFDashboard();
});

/* =============================================
   HELPERS
   ============================================= */
function _sfCurrentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function _sfMonthLabel(ym) {
  if (!ym) return 'All Time';
  const [y, m] = ym.split('-');
  return new Date(y, m - 1, 1).toLocaleString('en-PK', { month: 'long', year: 'numeric' });
}
function _sfDateToYM(dateStr) {
  if (!dateStr) return '';
  /* dateStr may be 'YYYY-MM-DDTHH:mm' or 'YYYY-MM-DD' */
  return dateStr.substring(0, 7);
}
function _sfSetText(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}

/* =============================================
   POPULATE MONTH DROPDOWNS
   ============================================= */
function _populateMonthFilters() {
  /* Collect all unique months from bookings */
  const bookings = DB.get('bookings');
  const months   = [...new Set(bookings.map(b => _sfDateToYM(b.date)).filter(Boolean))].sort().reverse();

  const opts = `<option value="">All Time</option>` +
    months.map(ym => `<option value="${ym}" ${ym === _sfListMonth ? 'selected' : ''}>${_sfMonthLabel(ym)}</option>`).join('');

  const listSel = document.getElementById('sfListMonthFilter');
  const detSel  = document.getElementById('sfDetMonthFilter');
  if (listSel) listSel.innerHTML = opts;
  if (detSel)  detSel.innerHTML  = opts.replace(`value="${_sfListMonth}" selected`, `value="${_sfListMonth}"`);

  /* Set current month as default selected */
  if (listSel) listSel.value = _sfListMonth;
  if (detSel)  detSel.value  = _sfDetMonth;
}

/* =============================================
   BIND LIST CONTROLS
   ============================================= */
function _bindListControls() {
  document.getElementById('sfListSearch')?.addEventListener('input', e => {
    _sfListSearch = e.target.value.toLowerCase(); renderSFDashboard();
  });
  document.getElementById('sfListMonthFilter')?.addEventListener('change', e => {
    _sfListMonth = e.target.value; renderSFDashboard();
  });
}

/* =============================================
   GET ALL SUPPLIERS WHO HAVE BOOKINGS
   ============================================= */
function _sfGetActiveSuppliers() {
  const suppliers = DB.get('suppliers');
  const bookings  = DB.get('bookings');
  /* Only suppliers that have at least one booking */
  const supWithBookings = new Set(bookings.map(b => b.supplierId));
  return suppliers.filter(s => supWithBookings.has(s.id));
}

/* =============================================
   GET BOOKINGS FOR SUPPLIER (+ optional month filter)
   ============================================= */
function _sfGetBookings(supplierId, monthFilter) {
  return DB.filter('bookings', b => {
    if (b.supplierId !== supplierId) return false;
    if (monthFilter && _sfDateToYM(b.date) !== monthFilter) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/* =============================================
   GET PAYMENTS FOR SUPPLIER (+ optional month filter)
   ============================================= */
function _sfGetPayments(supplierId, monthFilter) {
  return DB.filter('sf_payments', p => {
    if (p.supplierId !== supplierId) return false;
    if (monthFilter && _sfDateToYM(p.date) !== monthFilter) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/* =============================================
   DASHBOARD RENDER
   ============================================= */
function renderSFDashboard() {
  const suppliers = _sfGetActiveSuppliers();

  /* Summary cards — use current list month filter */
  let totalBk = 0, totalRcv = 0;
  suppliers.forEach(s => {
    const bookings = _sfGetBookings(s.id, _sfListMonth);
    const payments = _sfGetPayments(s.id, _sfListMonth);
    totalBk  += bookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
    totalRcv += payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  });
  const totalBal = totalBk - totalRcv;

  _sfSetText('sfSumSuppliers', suppliers.length);
  _sfSetText('sfSumBookings',  `PKR ${formatCurrency(totalBk)}`);
  _sfSetText('sfSumReceived',  `PKR ${formatCurrency(totalRcv)}`);
  _sfSetText('sfSumBalance',   `PKR ${formatCurrency(totalBal)}`);
  const balCard = document.getElementById('sfSumBalCard');
  if (balCard) balCard.classList.toggle('all-clear', totalBal <= 0);

  /* Filter suppliers for cards */
  let filteredSups = suppliers;
  if (_sfListSearch) {
    filteredSups = filteredSups.filter(s =>
      (s.name  || '').toLowerCase().includes(_sfListSearch) ||
      (s.phone || '').toLowerCase().includes(_sfListSearch)
    );
  }

  _renderSupplierCards(filteredSups);
}

function _renderSupplierCards(suppliers) {
  const container = document.getElementById('sfSupplierCards');
  if (!container) return;

  if (!suppliers.length) {
    container.innerHTML = `
      <div class="sf-empty-state">
        <i class="fas fa-users-slash"></i>
        ${_sfListSearch ? 'No suppliers match your search.' : 'No supplier bookings found. Add bookings in the Booking module.'}
      </div>`;
    return;
  }

  container.innerHTML = suppliers.map(s => {
    const bookings = _sfGetBookings(s.id, _sfListMonth);
    const payments = _sfGetPayments(s.id, _sfListMonth);
    const totalBk  = bookings.reduce((sum, b) => sum + (Number(b.total)  || 0), 0);
    const totalRcv = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const balance  = totalBk - totalRcv;
    const initials = (s.name || '?').charAt(0).toUpperCase();
    const balClass = balance <= 0 ? 'settled' : '';

    return `
      <div class="sf-sup-card" onclick="sfOpenSupplier('${escapeHtml(s.id)}')">
        <div class="sf-sup-card-top">
          <div class="sf-sup-avatar">${initials}</div>
          <div>
            <div class="sf-sup-name">${escapeHtml(s.name)}</div>
            <div class="sf-sup-phone">${escapeHtml(s.phone || s.contact || '—')}</div>
          </div>
        </div>
        <div class="sf-sup-card-body">
          <div class="sf-sup-stats">
            <div class="sf-sup-stat">
              <div class="sf-sup-stat-val sf-bk-count">${bookings.length}</div>
              <div class="sf-sup-stat-lbl">Bookings</div>
            </div>
            <div class="sf-sup-stat">
              <div class="sf-sup-stat-val sf-bk-amount">PKR ${formatCurrency(totalBk)}</div>
              <div class="sf-sup-stat-lbl">Booking Amt</div>
            </div>
            <div class="sf-sup-stat">
              <div class="sf-sup-stat-val sf-bk-rcvd">PKR ${formatCurrency(totalRcv)}</div>
              <div class="sf-sup-stat-lbl">Received</div>
            </div>
          </div>
          <div class="sf-sup-bal-row">
            <div>
              <div class="sf-sup-bal-label">Balance Due</div>
              <div class="sf-sup-bal-value ${balClass}">PKR ${formatCurrency(balance)}</div>
            </div>
            <span class="sf-open-btn"><i class="fas fa-arrow-right"></i> Open</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* =============================================
   OPEN / BACK
   ============================================= */
function sfOpenSupplier(supId) {
  _sfActiveSupId = supId;
  _sfDetMonth    = _sfCurrentYM();
  _sfDetSearch   = '';
  const si = document.getElementById('sfDetSearch'); if (si) si.value = '';
  const mf = document.getElementById('sfDetMonthFilter');
  if (mf) { _populateMonthFilters(); mf.value = _sfDetMonth; }
  document.getElementById('sfRoot')?.classList.add('sf-show-detail');
  renderSFDetail(supId);
  _bindDetailControls(supId);
}

function sfGoBack() {
  document.getElementById('sfRoot')?.classList.remove('sf-show-detail');
  _sfActiveSupId = null;
  renderSFDashboard();
}

/* =============================================
   DETAIL RENDER
   ============================================= */
function renderSFDetail(supId) {
  const supplier = DB.findById('suppliers', supId);
  if (!supplier) { sfGoBack(); return; }

  /* Supplier info */
  _sfSetText('sfDetSupName', supplier.name);
  const metaEl = document.getElementById('sfDetSupMeta');
  if (metaEl) {
    metaEl.innerHTML = `
      ${supplier.phone   || supplier.contact ? `<span><i class="fas fa-phone"></i>${escapeHtml(supplier.phone || supplier.contact)}</span>` : ''}
      ${supplier.address ? `<span><i class="fas fa-location-dot"></i>${escapeHtml(supplier.address)}</span>` : ''}`;
  }

  /* Filtered data */
  const bookings = _sfGetBookings(supId, _sfDetMonth);
  const payments = _sfGetPayments(supId, _sfDetMonth);
  const totalBk  = bookings.reduce((sum, b) => sum + (Number(b.total)  || 0), 0);
  const totalRcv = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balance  = totalBk - totalRcv;

  /* Apply search filter to both lists */
  const searchedBk  = _sfDetSearch ? bookings.filter(b  => _sfMatchBk(b))  : bookings;
  const searchedRcv = _sfDetSearch ? payments.filter(p  => _sfMatchPay(p)) : payments;

  /* Balance cards */
  _sfSetText('sfDetTotalBk',  `PKR ${formatCurrency(totalBk)}`);
  _sfSetText('sfDetTotalRcv', `PKR ${formatCurrency(totalRcv)}`);
  _sfSetText('sfDetBalance',  `PKR ${formatCurrency(balance)}`);
  const balCard = document.getElementById('sfDetBalCard');
  if (balCard) balCard.classList.toggle('settled', balance <= 0);

  /* Panel totals */
  _sfSetText('sfBkPanelTotal',  `PKR ${formatCurrency(totalBk)}`);
  _sfSetText('sfRcvPanelTotal', `PKR ${formatCurrency(totalRcv)}`);

  /* Render booking table */
  _renderBookingTable(searchedBk);

  /* Render received list */
  _renderReceivedList(searchedRcv, supId);

  /* Balance summary bar */
  _renderBalanceBar(totalBk, totalRcv, balance);
}

function _sfMatchBk(b) {
  const q = _sfDetSearch;
  return (b.bookingNo   || '').toLowerCase().includes(q) ||
         (b.description || '').toLowerCase().includes(q) ||
         (b.date        || '').includes(q);
}
function _sfMatchPay(p) {
  const q = _sfDetSearch;
  return (p.description || '').toLowerCase().includes(q) ||
         (p.reference   || '').toLowerCase().includes(q) ||
         (p.bankCash    || '').toLowerCase().includes(q) ||
         (p.date        || '').includes(q);
}

/* ---- Booking table ---- */
function _renderBookingTable(bookings) {
  const wrap = document.getElementById('sfBkTableWrap');
  if (!wrap) return;

  if (!bookings.length) {
    wrap.innerHTML = `<div class="sf-bk-empty"><i class="fas fa-clipboard-list"></i>${_sfDetSearch || _sfDetMonth ? 'No bookings match your filter.' : 'No bookings found for this supplier.'}</div>`;
    return;
  }

  let rowsHtml = bookings.map((b, i) => `
    <tr>
      <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
      <td>${formatDate(b.date)}</td>
      <td>${escapeHtml(b.description || '—')}</td>
      <td class="sf-bk-no">${escapeHtml(b.bookingNo)}</td>
      <td>${formatKG(b.weight)} TON</td>
      <td>PKR ${formatCurrency(b.rate)}</td>
      <td class="sf-bk-total">PKR ${formatCurrency(b.total)}</td>
    </tr>`).join('');

  wrap.innerHTML = `
    <table class="sf-bk-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Description</th>
          <th>Booking No</th>
          <th>Weight</th>
          <th>Rate/TON</th>
          <th>Total Amount</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

/* ---- Received payments list ---- */
function _renderReceivedList(payments, supId) {
  const container = document.getElementById('sfRcvList');
  if (!container) return;

  if (!payments.length) {
    container.innerHTML = `<div class="sf-rcv-empty"><i class="fas fa-hand-holding-dollar"></i>${_sfDetSearch || _sfDetMonth ? 'No payments match your filter.' : 'No payments recorded yet.'}</div>`;
    return;
  }

  container.innerHTML = payments.map(p => `
    <div class="sf-rcv-entry">
      <div class="sf-rcv-dot"></div>
      <div class="sf-rcv-info">
        <div class="sf-rcv-desc">${escapeHtml(p.description)}</div>
        <div class="sf-rcv-meta">
          ${formatDate(p.date)}
          ${p.bankCash  ? ` &nbsp;·&nbsp; <i class="fas fa-${p.bankCash === 'bank' ? 'building-columns' : 'money-bill-wave'}"></i> ${p.bankCash === 'bank' ? 'Bank' : 'Cash'}` : ''}
          ${p.reference ? ` &nbsp;·&nbsp; Ref: ${escapeHtml(p.reference)}` : ''}
        </div>
      </div>
      <div class="sf-rcv-amount">PKR ${formatCurrency(p.amount)}</div>
      <button class="sf-rcv-del" title="Delete" onclick="sfDeletePayment('${escapeHtml(p.id)}','${escapeHtml(p.description)}','${escapeHtml(supId)}')">
        <i class="fas fa-times"></i>
      </button>
    </div>`).join('');
}

/* ---- Balance bar ---- */
function _renderBalanceBar(totalBk, totalRcv, balance) {
  const bar = document.getElementById('sfBalanceBar');
  if (!bar) return;
  const settled = balance <= 0;
  bar.innerHTML = `
    <div class="sf-balance-bar-info">
      <h4><i class="fas fa-scale-balanced" style="color:var(--teal);margin-right:6px;"></i>Balance Summary</h4>
      <p>${settled ? 'All payments cleared for this period.' : 'Remaining balance due to supplier.'}</p>
    </div>
    <div class="sf-balance-nums">
      <div class="sf-bn-item">
        <div class="sf-bn-value" style="color:var(--copper);">PKR ${formatCurrency(totalBk)}</div>
        <div class="sf-bn-label">Total Bookings</div>
      </div>
      <div style="font-size:18px;color:var(--text-muted);">−</div>
      <div class="sf-bn-item">
        <div class="sf-bn-value" style="color:var(--emerald);">PKR ${formatCurrency(totalRcv)}</div>
        <div class="sf-bn-label">Total Received</div>
      </div>
      <div style="font-size:18px;color:var(--text-muted);">=</div>
    </div>
    <div>
      <div class="sf-final-balance ${settled ? 'settled' : ''}">PKR ${formatCurrency(balance)}</div>
      <div class="sf-final-balance-label">${settled ? 'Fully Settled' : 'Balance Due'}</div>
    </div>`;
}

/* =============================================
   BIND DETAIL CONTROLS
   ============================================= */
function _bindDetailControls(supId) {
  /* Search */
  const srchEl = document.getElementById('sfDetSearch');
  if (srchEl) {
    const clone = srchEl.cloneNode(true);
    srchEl.parentNode.replaceChild(clone, srchEl);
    clone.addEventListener('input', e => { _sfDetSearch = e.target.value.toLowerCase(); renderSFDetail(supId); });
  }
  /* Month filter */
  const mfEl = document.getElementById('sfDetMonthFilter');
  if (mfEl) {
    const clone = mfEl.cloneNode(true);
    mfEl.parentNode.replaceChild(clone, mfEl);
    clone.addEventListener('change', e => { _sfDetMonth = e.target.value; renderSFDetail(supId); });
  }
  /* Add payment form */
  const formEl = document.getElementById('sfRcvForm');
  if (formEl) {
    const clone = formEl.cloneNode(true);
    formEl.parentNode.replaceChild(clone, formEl);
    clone.addEventListener('submit', e => { e.preventDefault(); sfAddPayment(supId); });
    /* Set today's date default */
    const dateInput = clone.querySelector('#sfPayDate');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
  }
}

/* =============================================
   ADD PAYMENT
   ============================================= */
function sfAddPayment(supId) {
  const date     = sanitizeInput(document.getElementById('sfPayDate')?.value    || '');
  const desc     = sanitizeInput(document.getElementById('sfPayDesc')?.value    || '');
  const bankCash = document.getElementById('sfPayBankCash')?.value              || '';
  const ref      = sanitizeInput(document.getElementById('sfPayRef')?.value     || '');
  const amount   = parseFloat(document.getElementById('sfPayAmount')?.value)    || 0;

  if (!date)       { showToast('Please select a date.',    'error'); return; }
  if (!desc)       { showToast('Description is required.', 'error'); return; }
  if (amount <= 0) { showToast('Enter a valid amount.',    'error'); return; }

  DB.add('sf_payments', { supplierId: supId, date, description: desc, bankCash, reference: ref, amount });

  const supplier = DB.findById('suppliers', supId);
  const partyName = supplier ? supplier.name : 'Supplier';
  const incomeDescription = desc
    ? `${desc} (${partyName})`
    : `Payment received from ${partyName}`;

  DB.add('income', {
    month: date.substring(0, 7),
    date,
    description: incomeDescription,
    reference: ref || partyName,
    amount
  });

  /* Reset form fields */
  document.getElementById('sfPayDesc').value   = '';
  document.getElementById('sfPayRef').value    = '';
  document.getElementById('sfPayAmount').value = '';

  showToast(`Payment of PKR ${formatCurrency(amount)} recorded.`, 'success');
  renderSFDetail(supId);
}

/* =============================================
   DELETE PAYMENT
   ============================================= */
function sfDeletePayment(id, desc, supId) {
  showConfirm(`Delete payment "${desc}"?`, () => {
    DB.remove('sf_payments', id);
    showToast('Payment deleted.', 'success');
    renderSFDetail(supId);
  }, 'Delete');
}

/* =============================================
   MOBILE TAB SWITCH
   ============================================= */
function sfSwitchMobTab(tab) {
  _sfDetMobTab = tab;
  const bkTab  = document.getElementById('sfMobBkTab');
  const rcvTab = document.getElementById('sfMobRcvTab');
  const bkPanel  = document.getElementById('sfBkPanel');
  const rcvPanel = document.getElementById('sfRcvPanel');

  if (bkTab)  bkTab.className  = `sf-mob-tab${tab === 'bookings'  ? ' mob-bk'  : ''}`;
  if (rcvTab) rcvTab.className = `sf-mob-tab${tab === 'received' ? ' mob-rcv' : ''}`;
  if (bkPanel)  bkPanel.classList.toggle('hidden-mob',  tab !== 'bookings');
  if (rcvPanel) rcvPanel.classList.toggle('hidden-mob', tab !== 'received');
}

function sfDownloadSupplierPdf() {
  const supId = _sfActiveSupId;
  if (!supId) return;
  const supplier = DB.findById('suppliers', supId);
  if (!supplier) { showToast('Supplier record not found.', 'error'); return; }

  const bookings = _sfGetBookings(supId, _sfDetMonth);
  const payments = _sfGetPayments(supId, _sfDetMonth);
  const totalBk  = bookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
  const totalRcv = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balance  = totalBk - totalRcv;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const w = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Supplier Finance Record', 14, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Supplier: ${supplier.name}`, 14, y);
  y += 6;
  if (supplier.phone || supplier.contact) doc.text(`Phone: ${supplier.phone || supplier.contact}`, 14, y), y += 6;
  if (supplier.address) doc.text(`Address: ${supplier.address}`, 14, y), y += 6;
  y += 4;
  doc.text(`Period: ${_sfMonthLabel(_sfDetMonth)}`, 14, y);
  doc.text(`Date: ${new Date().toLocaleDateString('en-PK')}`, w - 14, y, { align: 'right' });

  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Booking Amount: PKR ${formatCurrency(totalBk)}`, 14, y);
  y += 6;
  doc.text(`Total Received: PKR ${formatCurrency(totalRcv)}`, 14, y);
  y += 6;
  doc.text(`Balance Due: PKR ${formatCurrency(balance)}`, 14, y);

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Bookings', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (!bookings.length) {
    doc.text('No bookings found for this supplier.', 14, y);
    y += 8;
  } else {
    doc.text('Date', 14, y);
    doc.text('Booking No', 55, y);
    doc.text('Weight', 100, y);
    doc.text('Total', 150, y);
    y += 5;
    doc.setDrawColor(180);
    doc.line(14, y, w - 14, y);
    y += 6;
    bookings.forEach(b => {
      if (y > 275) { doc.addPage(); y = 14; }
      doc.text(formatDate(b.date), 14, y);
      doc.text(b.bookingNo || '—', 55, y);
      doc.text(`${formatKG(b.weight)} TON`, 100, y);
      doc.text(`PKR ${formatCurrency(b.total)}`, 150, y);
      y += 6;
    });
  }

  y += 10;
  if (y > 250) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Payments', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (!payments.length) {
    doc.text('No payments recorded for this supplier.', 14, y);
    y += 8;
  } else {
    doc.text('Date', 14, y);
    doc.text('Description', 50, y);
    doc.text('Amount', 150, y);
    y += 5;
    doc.setDrawColor(180);
    doc.line(14, y, w - 14, y);
    y += 6;
    payments.forEach(p => {
      if (y > 275) { doc.addPage(); y = 14; }
      const desc = p.description || '—';
      doc.text(formatDate(p.date), 14, y);
      doc.text(desc.length > 30 ? desc.substring(0, 27) + '...' : desc, 50, y);
      doc.text(`PKR ${formatCurrency(p.amount)}`, 150, y);
      y += 6;
    });
  }

  doc.save(`Supplier-${supplier.name.replace(/\W+/g, '_')}-${_sfMonthLabel(_sfDetMonth).replace(/\W+/g, '_')}.pdf`);
  showToast('Supplier PDF downloaded.', 'success');
}
