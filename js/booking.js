/* =============================================
   ARHAM TRADERS — BOOKING MODULE
   js/booking.js  |  Phase 3
   ============================================= */

/* ---- State ---- */
let _currentReceiptId = null;
let _filterText       = '';
let _filterSupplier   = '';
let _filterDateFrom   = '';
let _filterDateTo     = '';

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  setBookingDefaults();
  populateSupplierDropdowns();
  bindFormCalculation();
  bindFormEvents();
  bindFilters();
  renderBookingsTable();
  updateBookingStats();
});

/* =============================================
   SET DEFAULTS ON FORM LOAD
   ============================================= */
function setBookingDefaults() {
  /* Booking number */
  const bkNo = document.getElementById('fBookingNo');
  if (bkNo && !bkNo.value) bkNo.value = generateBookingNo();

  /* Date/time */
  const dtEl = document.getElementById('fDate');
  if (dtEl) {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                    .toISOString().slice(0, 16);
    dtEl.value = local;
  }
}

/* =============================================
   SUPPLIER DROPDOWNS (form + filter)
   ============================================= */
function populateSupplierDropdowns() {
  const suppliers = DB.get('suppliers');

  /* Main form dropdown */
  const sel = document.getElementById('fSupplier');
  if (sel) {
    sel.innerHTML = '<option value="">— Select Supplier —</option>' +
      suppliers.map(s =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
      ).join('');
  }

  /* Filter dropdown */
  const fSel = document.getElementById('filterSupplier');
  if (fSel) {
    fSel.innerHTML = '<option value="">All Suppliers</option>' +
      suppliers.map(s =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
      ).join('');
  }
}

/* =============================================
   AUTO-CALCULATE TOTAL
   ============================================= */
function bindFormCalculation() {
  const wt   = document.getElementById('fWeight');
  const rate = document.getElementById('fRate');
  if (!wt || !rate) return;

  const calc = () => {
    const w = parseFloat(wt.value)   || 0;
    const r = parseFloat(rate.value) || 0;
    const total = w * r;

    const totalEl  = document.getElementById('fTotal');
    const displayEl = document.getElementById('calcTotal');
    const dispW    = document.getElementById('calcWeight');
    const dispR    = document.getElementById('calcRate');

    if (totalEl)  totalEl.value    = total.toFixed(2);
    if (displayEl) displayEl.textContent = 'PKR ' + formatCurrency(total);
    if (dispW)    dispW.textContent    = formatTON(w) + ' TON';
    if (dispR)    dispR.textContent    = 'PKR ' + formatCurrency(r) + '/TON';

    /* Update sidebar summary */
    const sbW     = document.getElementById('sbWeight');
    const sbR     = document.getElementById('sbRate');
    const sbTotal = document.getElementById('sbTotal');
    if (sbW)     sbW.textContent     = w     ? formatTON(w) + ' TON'              : '—';
    if (sbR)     sbR.textContent     = r     ? 'PKR ' + formatCurrency(r) + '/TON' : '—';
    if (sbTotal) sbTotal.textContent = total ? 'PKR ' + formatCurrency(total)    : '—';
  };

  wt.addEventListener('input',   calc);
  rate.addEventListener('input', calc);
}

/* =============================================
   FORM EVENTS
   ============================================= */
function bindFormEvents() {
  /* Supplier select → update summary */
  const supSel = document.getElementById('fSupplier');
  if (supSel) {
    supSel.addEventListener('change', () => {
      const el = document.getElementById('sbSupplier');
      if (el) {
        const opt = supSel.options[supSel.selectedIndex];
        el.textContent = opt.value ? opt.text : '—';
      }
    });
  }

  /* Regenerate booking number button */
  const regenBtn = document.getElementById('regenBookingNo');
  if (regenBtn) {
    regenBtn.addEventListener('click', () => {
      const bkNo = document.getElementById('fBookingNo');
      if (bkNo) bkNo.value = generateBookingNo();
    });
  }

  /* Form submit */
  const form = document.getElementById('bookingForm');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); saveBooking(); });
}

/* =============================================
   SAVE BOOKING
   ============================================= */
function saveBooking() {
  const bookingNo    = sanitizeInput(document.getElementById('fBookingNo')?.value  || '');
  const supplierId   = document.getElementById('fSupplier')?.value || '';
  const dateVal      = document.getElementById('fDate')?.value     || '';
  const weight       = parseFloat(document.getElementById('fWeight')?.value)       || 0;
  const rate         = parseFloat(document.getElementById('fRate')?.value)         || 0;
  const description  = sanitizeInput(document.getElementById('fDescription')?.value || '');
  const total        = weight * rate;

  /* Validation */
  if (!bookingNo.trim()) { showToast('Booking number is required.', 'error'); return; }
  if (!supplierId)       { showToast('Please select a supplier.', 'error'); return; }
  if (!dateVal)          { showToast('Date is required.', 'error'); return; }
  if (weight <= 0)       { showToast('Weight must be greater than 0.', 'error'); return; }
  if (rate < 0)          { showToast('Rate cannot be negative.', 'error'); return; }

  /* Duplicate booking number check */
  const dupBk = DB.filter('bookings', b => b.bookingNo === bookingNo.trim());
  if (dupBk.length) { showToast('Booking number already exists. Regenerate it.', 'warning'); return; }

  /* Get supplier name */
  const supplier = DB.findById('suppliers', supplierId);
  if (!supplier)  { showToast('Selected supplier not found.', 'error'); return; }

  /* Save booking */
  const booking = DB.add('bookings', {
    bookingNo:    bookingNo.trim(),
    supplierId,
    supplierName: supplier.name,
    date:         dateVal,
    weight,
    rate,
    total,
    description,
    status: 'received'
  });

  /* Auto-save to Warehouse */
  DB.add('warehouse', {
    bookingId:       booking.id,
    bookingNo:       booking.bookingNo,
    supplierId,
    supplierName:    supplier.name,
    date:            dateVal,
    totalWeight:     weight,
    remainingWeight: weight,
    rate,
    total,
    description,
    status: 'in_stock'
  });

  showToast(`Booking ${bookingNo} saved & added to Warehouse!`, 'success');

  /* Show receipt */
  _currentReceiptId = booking.id;
  showReceiptModal(booking);

  /* Reset form */
  resetBookingForm();
  renderBookingsTable();
  updateBookingStats();
  updateSidebarBadge();
}

/* =============================================
   RESET FORM
   ============================================= */
function resetBookingForm() {
  document.getElementById('bookingForm')?.reset();
  setBookingDefaults();

  /* Clear summary */
  const ids = ['sbSupplier','sbWeight','sbRate','sbTotal'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  const calcTotal = document.getElementById('calcTotal');
  if (calcTotal) calcTotal.textContent = 'PKR 0';
}

/* =============================================
   RECEIPT MODAL
   ============================================= */
function showReceiptModal(booking) {
  if (!booking) return;

  const html = buildReceiptHtml(booking);
  const container = document.getElementById('receiptContainer');
  if (container) container.innerHTML = html;

  openModal('receiptModal');
}

function viewReceipt(id) {
  const booking = DB.findById('bookings', id);
  if (!booking) { showToast('Booking not found.', 'error'); return; }
  _currentReceiptId = id;
  showReceiptModal(booking);
}

function buildReceiptHtml(b) {
  return `
    <div class="receipt-paper" id="receiptPrint">
      <div class="receipt-header">
        <div class="receipt-company">ARHAM TRADERS</div>
        <div class="receipt-subtitle">Mineral Processing &amp; Trading</div>
        <div class="receipt-title">BOOKING RECEIPT</div>
      </div>
      <hr class="receipt-divider" />
      <div class="receipt-grid">
        <div class="receipt-row">
          <span class="receipt-row-label">Booking No</span>
          <span class="receipt-row-value">${escapeHtml(b.bookingNo)}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-row-label">Date &amp; Time</span>
          <span class="receipt-row-value">${formatDateTime(b.date)}</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-row-label">Supplier</span>
          <span class="receipt-row-value">${escapeHtml(b.supplierName)}</span>
        </div>
        ${b.description ? `
        <div class="receipt-row">
          <span class="receipt-row-label">Description</span>
          <span class="receipt-row-value">${escapeHtml(b.description)}</span>
        </div>` : ''}
      </div>
      <hr class="receipt-divider" />
      <div class="receipt-grid">
        <div class="receipt-row">
          <span class="receipt-row-label">Weight Received</span>
          <span class="receipt-row-value">${formatTON(b.weight)} TON</span>
        </div>
        <div class="receipt-row">
          <span class="receipt-row-label">Rate per TON</span>
          <span class="receipt-row-value">PKR ${formatCurrency(b.rate)}</span>
        </div>
      </div>
      <div class="receipt-total-box">
        <span class="label">TOTAL AMOUNT</span>
        <span class="amount">PKR ${formatCurrency(b.total)}</span>
      </div>
      <div class="receipt-footer-note">
        Material received in warehouse and recorded.<br />
        <span class="receipt-stamp">Arham Traders — Official Receipt</span>
      </div>
    </div>`;
}

/* =============================================
   PRINT
   ============================================= */
function printCurrentReceipt() {
  printElement('receiptPrint');
}

/* =============================================
   PDF DOWNLOAD
   ============================================= */
function downloadBookingPdf(id) {
  const b = DB.findById('bookings', id);
  if (!b) { showToast('Booking not found.', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const w = doc.internal.pageSize.getWidth();

  /* Header bar */
  doc.setFillColor(24, 28, 42);
  doc.rect(0, 0, w, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17); doc.setFont('helvetica', 'bold');
  doc.text('ARHAM TRADERS', w / 2, 13, { align: 'center' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Mineral Processing & Trading', w / 2, 20, { align: 'center' });
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('BOOKING RECEIPT', w / 2, 28, { align: 'center' });

  /* Detail rows */
  let y = 44;
  const row = (label, value) => {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
    doc.text(label, 14, y);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text(String(value || '—'), w - 14, y, { align: 'right' });
    y += 9;
  };

  row('Booking No', b.bookingNo);
  row('Date & Time', formatDateTime(b.date));
  row('Supplier', b.supplierName);
  if (b.description) row('Description', b.description);

  /* Divider */
  y += 2;
  doc.setDrawColor(220, 220, 220); doc.line(14, y, w - 14, y); y += 9;

  row('Weight Received', formatTON(b.weight) + ' TON');
  row('Rate per TON', 'PKR ' + formatCurrency(b.rate));

  /* Total box */
  y += 4;
  doc.setFillColor(42, 157, 143);
  doc.roundedRect(14, y, w - 28, 22, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('TOTAL AMOUNT', w / 2, y + 8, { align: 'center' });
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('PKR ' + formatCurrency(b.total), w / 2, y + 17, { align: 'center' });

  /* Footer */
  y += 30;
  doc.setTextColor(160, 160, 160); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Material received in warehouse and recorded.', w / 2, y, { align: 'center' });
  doc.text('Arham Traders — Official Receipt', w / 2, y + 6, { align: 'center' });

  doc.save('Booking-' + b.bookingNo + '.pdf');
  showToast('PDF downloaded.', 'success');
}

function whatsappReceipt() {
  const b = DB.findById('bookings', _currentReceiptId);
  if (!b) return;
  const text =
`*ARHAM TRADERS — BOOKING RECEIPT*
━━━━━━━━━━━━━━━━━━━━
📋 Booking No : ${b.bookingNo}
📅 Date       : ${formatDateTime(b.date)}
👤 Supplier   : ${b.supplierName}
${b.description ? `📝 Description: ${b.description}\n` : ''}━━━━━━━━━━━━━━━━━━━━
⚖️  Weight     : ${formatTON(b.weight)} TON
💰 Rate       : PKR ${formatCurrency(b.rate)}/TON
━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL: PKR ${formatCurrency(b.total)}*
━━━━━━━━━━━━━━━━━━━━
_Arham Traders — Mineral Processing_`;

  shareWhatsApp(text);
}

/* =============================================
   DELETE BOOKING
   ============================================= */
function deleteBooking(id, bookingNo) {
  showConfirm(
    `Delete booking "${bookingNo}"?\n\nThis will also remove it from warehouse inventory.`,
    () => {
      DB.remove('bookings', id);
      /* Remove matching warehouse entry */
      const wItems = DB.filter('warehouse', w => w.bookingId === id);
      wItems.forEach(w => DB.remove('warehouse', w.id));

      showToast(`Booking ${bookingNo} deleted.`, 'success');
      renderBookingsTable();
      updateBookingStats();
      updateSidebarBadge();
    },
    'Delete Booking'
  );
}

/* =============================================
   FILTERS
   ============================================= */
function bindFilters() {
  document.getElementById('searchInput')?.addEventListener('input', e => {
    _filterText = e.target.value;
    renderBookingsTable();
  });
  document.getElementById('filterSupplier')?.addEventListener('change', e => {
    _filterSupplier = e.target.value;
    renderBookingsTable();
  });
  document.getElementById('filterDateFrom')?.addEventListener('change', e => {
    _filterDateFrom = e.target.value;
    renderBookingsTable();
  });
  document.getElementById('filterDateTo')?.addEventListener('change', e => {
    _filterDateTo = e.target.value;
    renderBookingsTable();
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    _filterText = _filterSupplier = _filterDateFrom = _filterDateTo = '';
    document.getElementById('searchInput').value     = '';
    document.getElementById('filterSupplier').value  = '';
    document.getElementById('filterDateFrom').value  = '';
    document.getElementById('filterDateTo').value    = '';
    renderBookingsTable();
  });
}

function applyFilters(bookings) {
  return bookings.filter(b => {
    if (_filterSupplier && b.supplierId !== _filterSupplier) return false;
    if (_filterDateFrom && b.date < _filterDateFrom) return false;
    if (_filterDateTo   && b.date.slice(0,10) > _filterDateTo) return false;
    if (_filterText) {
      const q = _filterText.toLowerCase();
      if (!(b.bookingNo    || '').toLowerCase().includes(q) &&
          !(b.supplierName || '').toLowerCase().includes(q) &&
          !(b.description  || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* =============================================
   RENDER BOOKINGS TABLE
   ============================================= */
function renderBookingsTable() {
  const all      = DB.get('bookings').reverse(); /* newest first */
  const filtered = applyFilters(all);
  const tbody    = document.getElementById('bookingTableBody');
  const countEl  = document.getElementById('bookingCount');

  if (countEl) countEl.textContent = `${filtered.length} booking${filtered.length !== 1 ? 's' : ''}`;

  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state" style="padding:40px;">
          <i class="fas fa-clipboard-list"></i>
          <p>${_filterText || _filterSupplier ? 'No bookings match your filters.' : 'No bookings yet. Fill the form above to add one.'}</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td>
        <span style="font-weight:700;color:var(--teal);font-size:12.5px;">
          ${escapeHtml(b.bookingNo)}
        </span>
      </td>
      <td>${escapeHtml(b.supplierName || '—')}</td>
      <td>${formatDateTime(b.date)}</td>
      <td style="font-weight:700;">${formatTON(b.weight)} <small style="color:var(--text-muted);font-weight:400;">TON</small></td>
      <td>PKR ${formatCurrency(b.rate)}</td>
      <td style="font-weight:700;color:var(--mineral-blue);">PKR ${formatCurrency(b.total)}</td>
      <td>${escapeHtml(b.description || '—')}</td>
      <td>
        <div style="display:flex;gap:5px;align-items:center;">
          <button class="btn btn-secondary btn-sm btn-icon" title="View Receipt"
            onclick="viewReceipt('${escapeHtml(b.id)}')">
            <i class="fas fa-file-alt"></i>
          </button>
          <button class="btn btn-secondary btn-sm btn-icon" title="Print"
            onclick="viewReceipt('${escapeHtml(b.id)}');setTimeout(printCurrentReceipt,400);">
            <i class="fas fa-print"></i>
          </button>
          <button class="btn btn-secondary btn-sm btn-icon" title="Download PDF"
            onclick="downloadBookingPdf('${escapeHtml(b.id)}')">
            <i class="fas fa-file-pdf"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" title="Delete"
            onclick="deleteBooking('${escapeHtml(b.id)}','${escapeHtml(b.bookingNo)}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  /* Footer totals */
  const totalKg  = filtered.reduce((s, b) => s + (Number(b.weight) || 0), 0);
  const totalAmt = filtered.reduce((s, b) => s + (Number(b.total)  || 0), 0);
  const tfoot = document.getElementById('bookingTfoot');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr style="background:var(--color-surface-2);">
        <td colspan="3" style="font-weight:700;font-size:12px;color:var(--text-muted);">
          TOTAL (${filtered.length} entries)
        </td>
        <td style="font-weight:800;color:var(--text-primary);">
          ${formatTON(totalKg)} <small style="color:var(--text-muted);font-weight:400;">TON</small>
        </td>
        <td></td>
        <td style="font-weight:800;color:var(--mineral-blue);">PKR ${formatCurrency(totalAmt)}</td>
        <td colspan="2"></td>
      </tr>`;
  }
}

/* =============================================
   STATS BAR
   ============================================= */
function updateBookingStats() {
  const all = DB.get('bookings');
  const todayBookings = all.filter(b => b.date && b.date.startsWith(today()));

  const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  s('bsTotalBookings', all.length);
  s('bsTodayBookings', todayBookings.length);
  s('bsTotalWeight',   formatTON(all.reduce((t, b) => t + (Number(b.weight) || 0), 0)) + ' TON');
  s('bsTotalAmount',   'PKR ' + formatCurrency(all.reduce((t, b) => t + (Number(b.total) || 0), 0)));
}

/* =============================================
   SIDEBAR BADGE
   ============================================= */
function updateSidebarBadge() {
  const badge = document.getElementById('todayBookingBadge');
  if (!badge) return;
  const count = Stats.getTodayBookings();
  badge.textContent  = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}
