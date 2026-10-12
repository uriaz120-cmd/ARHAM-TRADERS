/* =============================================
   ARHAM TRADERS — EXPORT SALES MODULE
   js/export-sales.js
   ============================================= */

/* ---- State ---- */
let _selectedBatchId = null;
let _salesSearch = '';
let _salesFilterBuyer = '';
let _salesFilterDateFrom = '';
let _salesFilterDateTo = '';
let _currentSaleInvoice = null;

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  initSaleFormDefaults();
  populateDropdowns();
  bindSaleFormEvents();
  bindFilterEvents();
  renderReadyStock();
  renderSalesTable();
  updateSalesStats();
});

/* =============================================
   FORM DEFAULTS
   ============================================= */
function initSaleFormDefaults() {
  const dateEl = document.getElementById('fSaleDate');
  if (dateEl) dateEl.value = today();

  const noEl = document.getElementById('fSaleNo');
  if (noEl) noEl.value = generateExportSaleNo();

  document.getElementById('regenSaleNo')?.addEventListener('click', () => {
    if (noEl) noEl.value = generateExportSaleNo();
  });
}

/* =============================================
   POPULATE DROPDOWNS
   ============================================= */
function populateDropdowns() {
  /* 1. Export Buyers */
  const buyers = DB.get('exp_buyers');
  const buyerSel = document.getElementById('fSaleBuyer');
  const filterBuyerSel = document.getElementById('filterSalesBuyer');

  if (buyerSel) {
    buyerSel.innerHTML = '<option value="">— Select Buyer —</option>' +
      buyers.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} ${b.company ? '(' + escapeHtml(b.company) + ')' : ''} ${b.country ? '[' + escapeHtml(b.country) + ']' : ''}</option>`).join('');
  }

  if (filterBuyerSel) {
    filterBuyerSel.innerHTML = '<option value="">All Buyers</option>' +
      buyers.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join('');
  }

  /* 2. Finished Goods Ready Stock Batches */
  populateFgBatchDropdown();
}

function populateFgBatchDropdown() {
  const fgBatches = DB.get('exp_finished_goods').filter(i => (Number(i.remainingWeight) || 0) > 0);
  const fgSel = document.getElementById('fSaleFgBatch');
  if (!fgSel) return;

  fgSel.innerHTML = '<option value="">— Select Ready Stock Batch —</option>' +
    fgBatches.map(b => {
      const rem = Number(b.remainingWeight) || 0;
      const label = `${b.bookingNo || 'Batch'} | ${b.supplierName || 'Supplier'} — Avail: ${formatKG(rem)} TON`;
      return `<option value="${escapeHtml(b.id)}" data-rem="${rem}">${escapeHtml(label)}</option>`;
    }).join('');

  if (_selectedBatchId) {
    fgSel.value = _selectedBatchId;
    onBatchSelected();
  }
}

/* =============================================
   FORM EVENTS & CALCULATIONS
   ============================================= */
function bindSaleFormEvents() {
  const fgSel = document.getElementById('fSaleFgBatch');
  if (fgSel) fgSel.addEventListener('change', onBatchSelected);

  const weightInput = document.getElementById('fSaleWeight');
  const rateInput = document.getElementById('fSaleRate');

  if (weightInput) weightInput.addEventListener('input', calculateSaleTotal);
  if (rateInput) rateInput.addEventListener('input', calculateSaleTotal);

  /* Fill Max TON button */
  document.getElementById('fillMaxWeightBtn')?.addEventListener('click', () => {
    const batch = getSelectedBatch();
    if (batch && weightInput) {
      const avail = Number(batch.remainingWeight) || 0;
      weightInput.value = avail > 0 ? avail.toFixed(2) : '0';
      calculateSaleTotal();
    }
  });

  /* Submit Form */
  document.getElementById('saleForm')?.addEventListener('submit', e => {
    e.preventDefault();
    submitSaleOrder();
  });
}

function getSelectedBatch() {
  const batchId = document.getElementById('fSaleFgBatch')?.value || _selectedBatchId;
  if (!batchId) return null;
  return DB.findById('exp_finished_goods', batchId);
}

function onBatchSelected() {
  const batch = getSelectedBatch();
  const noteEl = document.getElementById('availWeightNote');
  const weightInput = document.getElementById('fSaleWeight');

  if (batch) {
    _selectedBatchId = batch.id;
    const avail = Number(batch.remainingWeight) || 0;
    if (noteEl) noteEl.textContent = `(Max Available: ${formatKG(avail)} TON)`;
    if (weightInput) weightInput.max = avail;
  } else {
    _selectedBatchId = null;
    if (noteEl) noteEl.textContent = '';
    if (weightInput) weightInput.removeAttribute('max');
  }

  highlightStockCard(_selectedBatchId);
  calculateSaleTotal();
}

function calculateSaleTotal() {
  const weight = Number(document.getElementById('fSaleWeight')?.value) || 0;
  const rate = Number(document.getElementById('fSaleRate')?.value) || 0;
  const total = weight * rate;

  const dispEl = document.getElementById('dispTotalSaleAmount');
  if (dispEl) {
    dispEl.textContent = `PKR ${formatCurrency(total)}`;
  }
}

function resetSaleForm() {
  document.getElementById('saleForm')?.reset();
  _selectedBatchId = null;
  initSaleFormDefaults();
  populateDropdowns();
  onBatchSelected();
  highlightStockCard(null);
}

function scrollToSaleForm() {
  const el = document.getElementById('saleFormCard');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* =============================================
   READY STOCK CARDS RENDER
   ============================================= */
function renderReadyStock() {
  const fgBatches = DB.get('exp_finished_goods').filter(i => (Number(i.remainingWeight) || 0) > 0);
  const container = document.getElementById('readyStockCards');
  const countEl = document.getElementById('readyStockBatchCount');

  if (countEl) {
    countEl.textContent = `${fgBatches.length} batch${fgBatches.length !== 1 ? 'es' : ''} available`;
  }

  if (!container) return;

  if (!fgBatches.length) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; background:var(--color-surface);border:1px dashed var(--color-border);padding:24px;border-radius:10px;text-align:center;color:var(--text-muted);">
        <i class="fas fa-layer-group" style="font-size:24px;margin-bottom:8px;display:block;"></i>
        No finished goods ready stock currently available. Complete a production batch first.
        <div style="margin-top:10px;">
          <a href="export-production.html" class="btn btn-sm btn-primary"><i class="fas fa-industry"></i> Go to Production</a>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = fgBatches.map(b => {
    const rem = Number(b.remainingWeight) || 0;
    const isSelected = _selectedBatchId === b.id;

    return `
      <div class="stock-batch-card ${isSelected ? 'selected' : ''}" id="stockCard_${b.id}">
        <div class="stock-batch-top">
          <span class="stock-batch-no"><i class="fas fa-barcode"></i> ${escapeHtml(b.bookingNo || 'Batch')}</span>
          <span class="stock-avail-badge">${formatKG(rem)} TON</span>
        </div>
        <div class="stock-meta">
          <div><strong>Supplier:</strong> ${escapeHtml(b.supplierName || '—')}</div>
          ${b.mineralType || b.description ? `<div><strong>Mineral:</strong> ${escapeHtml(b.mineralType || b.description)}</div>` : ''}
          <div><strong>Date:</strong> ${formatDate(b.date)}</div>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}" onclick="selectStockBatch('${escapeHtml(b.id)}')">
            <i class="fas fa-check"></i> ${isSelected ? 'Selected' : 'Sell This Batch'}
          </button>
        </div>
      </div>`;
  }).join('');
}

function selectStockBatch(batchId) {
  _selectedBatchId = batchId;
  const fgSel = document.getElementById('fSaleFgBatch');
  if (fgSel) fgSel.value = batchId;
  onBatchSelected();
  scrollToSaleForm();
}

function highlightStockCard(batchId) {
  document.querySelectorAll('.stock-batch-card').forEach(c => {
    c.classList.remove('selected');
  });
  if (batchId) {
    const card = document.getElementById(`stockCard_${batchId}`);
    if (card) card.classList.add('selected');
  }
}

/* =============================================
   SUBMIT SALE ORDER
   ============================================= */
function submitSaleOrder() {
  const saleNo = (document.getElementById('fSaleNo')?.value || '').trim();
  const date = document.getElementById('fSaleDate')?.value;
  const buyerId = document.getElementById('fSaleBuyer')?.value;
  const fgId = document.getElementById('fSaleFgBatch')?.value;
  const weight = Number(document.getElementById('fSaleWeight')?.value);
  const rate = Number(document.getElementById('fSaleRate')?.value);
  const containerNo = (document.getElementById('fSaleContainer')?.value || '').trim();
  const destination = (document.getElementById('fSaleDestination')?.value || '').trim();
  const notes = (document.getElementById('fSaleNotes')?.value || '').trim();

  if (!saleNo) {
    showToast('Sale Voucher No is missing.', 'error');
    return;
  }
  if (!date) {
    showToast('Please select sale date.', 'warning');
    return;
  }
  if (!buyerId) {
    showToast('Please select an export buyer.', 'warning');
    return;
  }
  if (!fgId) {
    showToast('Please select a finished goods ready stock batch.', 'warning');
    return;
  }

  const batch = DB.findById('exp_finished_goods', fgId);
  if (!batch) {
    showToast('Selected finished goods batch not found.', 'error');
    return;
  }

  const availWeight = Number(batch.remainingWeight) || 0;
  if (!weight || weight <= 0) {
    showToast('Please enter a valid weight in TON.', 'warning');
    return;
  }
  if (weight > availWeight) {
    showToast(`Weight exceeds available stock! Maximum available is ${formatKG(availWeight)} TON.`, 'warning');
    return;
  }
  if (!rate || rate <= 0) {
    showToast('Please enter a valid sale rate per TON.', 'warning');
    return;
  }

  const buyer = DB.findById('exp_buyers', buyerId);
  if (!buyer) {
    showToast('Buyer not found.', 'error');
    return;
  }

  const totalAmount = Math.round(weight * rate);

  /* Create Sale Record */
  const saleRecord = {
    id: generateId(),
    saleNo,
    date,
    buyerId: buyer.id,
    buyerName: buyer.name,
    buyerCompany: buyer.company || '',
    buyerCountry: buyer.country || '',
    fgId: batch.id,
    bookingNo: batch.bookingNo || '',
    supplierName: batch.supplierName || '',
    mineralDescription: batch.description || batch.mineralType || 'Processed Mineral',
    weight,
    rate,
    totalAmount,
    containerNo,
    destination,
    notes,
    createdAt: new Date().toISOString()
  };

  /* 1. Save Sale */
  DB.add('exp_sales', saleRecord);

  /* 2. Deduct Weight from Finished Goods */
  const newRemaining = Math.max(0, availWeight - weight);
  DB.update('exp_finished_goods', batch.id, { remainingWeight: newRemaining });

  showToast(`Sale order ${saleNo} recorded! Stock deducted & buyer ledger updated.`, 'success');

  /* Show Invoice Modal */
  _currentSaleInvoice = saleRecord;
  showSaleInvoiceModal(saleRecord);

  /* Reset form and reload view */
  resetSaleForm();
  renderReadyStock();
  renderSalesTable();
  updateSalesStats();
}

/* =============================================
   SALES HISTORY TABLE & FILTERS
   ============================================= */
function bindFilterEvents() {
  document.getElementById('salesSearchInput')?.addEventListener('input', e => {
    _salesSearch = (e.target.value || '').toLowerCase().trim();
    renderSalesTable();
  });

  document.getElementById('filterSalesBuyer')?.addEventListener('change', e => {
    _salesFilterBuyer = e.target.value;
    renderSalesTable();
  });

  document.getElementById('filterSalesDateFrom')?.addEventListener('change', e => {
    _salesFilterDateFrom = e.target.value;
    renderSalesTable();
  });

  document.getElementById('filterSalesDateTo')?.addEventListener('change', e => {
    _salesFilterDateTo = e.target.value;
    renderSalesTable();
  });
}

function renderSalesTable() {
  const allSales = DB.get('exp_sales').slice().reverse();
  const tbody = document.getElementById('salesTableBody');
  const tfoot = document.getElementById('salesTableFoot');
  const mobileContainer = document.getElementById('salesMobileCards');
  const countEl = document.getElementById('salesResultCount');

  let filtered = allSales.filter(s => {
    if (_salesFilterBuyer && s.buyerId !== _salesFilterBuyer) return false;
    if (_salesFilterDateFrom && s.date < _salesFilterDateFrom) return false;
    if (_salesFilterDateTo && s.date > _salesFilterDateTo) return false;
    if (_salesSearch) {
      const q = _salesSearch;
      if (!(s.saleNo || '').toLowerCase().includes(q) &&
          !(s.buyerName || '').toLowerCase().includes(q) &&
          !(s.buyerCompany || '').toLowerCase().includes(q) &&
          !(s.bookingNo || '').toLowerCase().includes(q) &&
          !(s.mineralDescription || '').toLowerCase().includes(q) &&
          !(s.destination || '').toLowerCase().includes(q) &&
          !(s.containerNo || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} of ${allSales.length} sale${allSales.length !== 1 ? 's' : ''}`;
  }

  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">
        <i class="fas fa-shopping-cart" style="font-size:28px;margin-bottom:8px;display:block;"></i>
        ${_salesSearch || _salesFilterBuyer || _salesFilterDateFrom || _salesFilterDateTo
          ? 'No sales records match your filters.'
          : 'No export sales recorded yet. Use the form above to record a sale.'}
      </td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';
    return;
  }

  /* Desktop Table */
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td><strong style="color:var(--teal);">${escapeHtml(s.saleNo || '—')}</strong></td>
      <td>${formatDate(s.date)}</td>
      <td>
        <strong>${escapeHtml(s.buyerName || '—')}</strong>
        ${s.buyerCompany ? `<div style="font-size:11px;color:var(--text-muted);">${escapeHtml(s.buyerCompany)}</div>` : ''}
      </td>
      <td>
        <div>${escapeHtml(s.mineralDescription || 'Mineral')}</div>
        ${s.bookingNo ? `<small style="color:var(--text-muted);">Ref: ${escapeHtml(s.bookingNo)}</small>` : ''}
      </td>
      <td style="text-align:right;font-weight:700;">${formatKG(s.weight)} TON</td>
      <td style="text-align:right;">PKR ${formatCurrency(s.rate)}</td>
      <td style="text-align:right;font-weight:800;color:var(--color-text);">PKR ${formatCurrency(s.totalAmount)}</td>
      <td>${escapeHtml(s.destination || s.containerNo || '—')}</td>
      <td style="text-align:center;">
        <div style="display:inline-flex;gap:4px;">
          <button class="btn btn-secondary btn-sm btn-icon" title="View Commercial Invoice" onclick="viewSaleInvoice('${escapeHtml(s.id)}')">
            <i class="fas fa-file-invoice"></i>
          </button>
          <button class="btn btn-secondary btn-sm btn-icon" title="Delete Sale (Restores Stock)" onclick="deleteSaleOrder('${escapeHtml(s.id)}')">
            <i class="fas fa-trash" style="color:var(--crimson);"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  /* Table Footer Totals */
  if (tfoot) {
    const totalTons = filtered.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
    const totalRevenue = filtered.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    tfoot.innerHTML = `
      <tr style="background:var(--color-surface-2);">
        <td colspan="4" style="font-weight:700;font-size:12px;color:var(--text-muted);">TOTAL (${filtered.length} Sales)</td>
        <td style="text-align:right;font-weight:800;color:var(--teal);">${formatKG(totalTons)} TON</td>
        <td></td>
        <td style="text-align:right;font-weight:800;color:var(--color-text);">PKR ${formatCurrency(totalRevenue)}</td>
        <td colspan="2"></td>
      </tr>`;
  }

  /* Mobile Cards */
  if (mobileContainer) {
    mobileContainer.innerHTML = filtered.map(s => `
      <div class="sf-sup-card" style="margin-bottom:12px;">
        <div class="sf-sup-card-top">
          <div>
            <span style="font-weight:800;color:var(--teal);font-size:13px;">${escapeHtml(s.saleNo)}</span>
            <div style="font-weight:700;font-size:14px;margin-top:2px;">${escapeHtml(s.buyerName)}</div>
            <div style="font-size:11px;color:var(--text-muted);">${formatDate(s.date)}</div>
          </div>
          <span class="badge" style="background:#ecfdf5;color:#059669;font-weight:800;">${formatKG(s.weight)} TON</span>
        </div>
        <div class="sf-sup-card-body">
          <div style="font-size:12px;margin-bottom:8px;">
            <strong>Mineral:</strong> ${escapeHtml(s.mineralDescription || '—')} (${escapeHtml(s.bookingNo || '')})
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--color-border);padding-top:8px;">
            <div>
              <div style="font-size:11px;color:var(--text-muted);">Total Sale Amount</div>
              <div style="font-size:14px;font-weight:800;color:var(--color-text);">PKR ${formatCurrency(s.totalAmount)}</div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-secondary btn-sm" onclick="viewSaleInvoice('${escapeHtml(s.id)}')"><i class="fas fa-file-invoice"></i></button>
              <button class="btn btn-secondary btn-sm" onclick="deleteSaleOrder('${escapeHtml(s.id)}')"><i class="fas fa-trash" style="color:var(--crimson);"></i></button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }
}

/* =============================================
   STATS UPDATE
   ============================================= */
function updateSalesStats() {
  const readyStock = DB.get('exp_finished_goods').reduce((sum, i) => sum + (Number(i.remainingWeight) || 0), 0);
  const allSales = DB.get('exp_sales');
  const totalSalesCount = allSales.length;
  const totalTonsSold = allSales.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);
  const totalSalesValue = allSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setT('statReadyStock', `${formatKG(readyStock)} TON`);
  setT('statTotalSalesCount', totalSalesCount);
  setT('statTotalTonsSold', `${formatKG(totalTonsSold)} TON`);
  setT('statTotalSalesValue', `PKR ${formatCurrency(totalSalesValue)}`);
}

/* =============================================
   DELETE SALE (Restores FG stock)
   ============================================= */
function deleteSaleOrder(saleId) {
  const sale = DB.findById('exp_sales', saleId);
  if (!sale) return;

  showConfirm(`Are you sure you want to delete Sale Voucher ${sale.saleNo}? This will restore ${formatKG(sale.weight)} TON back into Finished Goods ready stock.`, () => {
    /* 1. Restore finished goods weight if batch exists */
    if (sale.fgId) {
      const batch = DB.findById('exp_finished_goods', sale.fgId);
      if (batch) {
        const restoredWeight = (Number(batch.remainingWeight) || 0) + (Number(sale.weight) || 0);
        DB.update('exp_finished_goods', batch.id, { remainingWeight: restoredWeight });
      }
    }

    /* 2. Remove sale */
    DB.remove('exp_sales', saleId);
    showToast('Sale deleted and stock restored!', 'info');

    /* Refresh */
    renderReadyStock();
    populateFgBatchDropdown();
    renderSalesTable();
    updateSalesStats();
  });
}

/* =============================================
   COMMERCIAL INVOICE MODAL & PRINT
   ============================================= */
function viewSaleInvoice(saleId) {
  const sale = DB.findById('exp_sales', saleId);
  if (!sale) return;
  _currentSaleInvoice = sale;
  showSaleInvoiceModal(sale);
}

function showSaleInvoiceModal(s) {
  const container = document.getElementById('saleInvoiceContainer');
  if (!container) return;

  container.innerHTML = `
    <div id="printableSaleInvoice" style="font-family:sans-serif;padding:16px;background:#fff;color:#1e293b;border-radius:6px;">
      <div style="text-align:center;border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:16px;">
        <h2 style="margin:0;font-size:22px;color:#0d9488;">Arham Traders</h2>
        <div style="font-size:12px;color:#64748b;">Mineral Processing &amp; International Export</div>
        <div style="display:inline-block;margin-top:6px;background:#e6fffa;color:#0d9488;font-weight:700;font-size:11px;padding:3px 10px;border-radius:12px;letter-spacing:0.5px;">
          EXPORT COMMERCIAL SALE INVOICE
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px;margin-bottom:16px;">
        <div>
          <span style="color:#64748b;">Invoice / Sale No:</span><br/>
          <strong style="font-size:13px;color:#0d9488;">${escapeHtml(s.saleNo)}</strong><br/><br/>
          <span style="color:#64748b;">Date:</span><br/>
          <strong>${formatDate(s.date)}</strong>
        </div>
        <div>
          <span style="color:#64748b;">Billed To (Buyer):</span><br/>
          <strong style="font-size:13px;">${escapeHtml(s.buyerName)}</strong><br/>
          ${s.buyerCompany ? `<span>${escapeHtml(s.buyerCompany)}</span><br/>` : ''}
          ${s.buyerCountry ? `<span>${escapeHtml(s.buyerCountry)}</span><br/>` : ''}
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:8px;border:1px solid #cbd5e1;">Description</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Weight (TON)</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Rate / TON</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Total (PKR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:8px;border:1px solid #cbd5e1;">
              <strong>${escapeHtml(s.mineralDescription || 'Processed Mineral')}</strong>
              ${s.bookingNo ? `<div style="font-size:11px;color:#64748b;">Batch: ${escapeHtml(s.bookingNo)}</div>` : ''}
              ${s.containerNo ? `<div style="font-size:11px;color:#64748b;">Container: ${escapeHtml(s.containerNo)}</div>` : ''}
              ${s.destination ? `<div style="font-size:11px;color:#64748b;">Port: ${escapeHtml(s.destination)}</div>` : ''}
            </td>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${formatKG(s.weight)}</td>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(s.rate)}</td>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:800;color:#0d9488;">${formatCurrency(s.totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div style="background:#f8fafc;border:1px dashed #cbd5e1;padding:12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:16px;">
        <strong>Total Amount Payable:</strong>
        <strong style="font-size:16px;color:#0d9488;">PKR ${formatCurrency(s.totalAmount)}</strong>
      </div>

      ${s.notes ? `<div style="font-size:11px;color:#64748b;margin-bottom:16px;"><strong>Notes:</strong> ${escapeHtml(s.notes)}</div>` : ''}

      <div style="text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:8px;">
        Thank you for your business &bull; Arham Traders Management System
      </div>
    </div>
  `;

  openModal('saleInvoiceModal');
}

function printCurrentSaleInvoice() {
  printElement('printableSaleInvoice');
}
