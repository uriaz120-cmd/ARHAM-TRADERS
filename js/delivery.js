/* =============================================
   ARHAM TRADERS — DELIVERY MODULE
   js/delivery.js  |  Phase 7
   ============================================= */

/* ---- State ---- */
let _delFilterText     = '';
let _delFilterSupplier = '';
let _delFilterDateFrom = '';
let _delFilterDateTo   = '';
let _currentReceiptId  = null;
let _availableStock    = 0;   /* max KG for currently selected supplier */

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  setDeliveryDefaults();
  populateDeliveryDropdowns();
  bindDeliveryForm();
  bindDeliveryFilters();
  renderDeliveryTable();
  updateDeliveryStats();
});

/* =============================================
   DEFAULTS
   ============================================= */
function setDeliveryDefaults() {
  const dateEl = document.getElementById('fDeliveryDate');
  if (dateEl) dateEl.value = today();

  const noEl = document.getElementById('fDeliveryNo');
  if (noEl) noEl.value = generateDeliveryNo();
}

/* =============================================
   POPULATE DROPDOWNS
   ============================================= */
function populateDeliveryDropdowns() {
  const suppliers = DB.get('suppliers');

  /* Form supplier select */
  const formSel = document.getElementById('fSupplier');
  if (formSel) {
    formSel.innerHTML = '<option value="">— Select Supplier —</option>' +
      suppliers.map(s =>
        `<option value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}">
           ${escapeHtml(s.name)}
         </option>`
      ).join('');
  }

  /* Filter supplier select */
  const filtSel = document.getElementById('filterDelSupplier');
  if (filtSel) {
    filtSel.innerHTML = '<option value="">All Suppliers</option>' +
      suppliers.map(s =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
      ).join('');
  }
}

/* =============================================
   FORM BINDING
   ============================================= */
function bindDeliveryForm() {
  /* Supplier change → update available stock display */
  document.getElementById('fSupplier')?.addEventListener('change', onSupplierChange);

  /* Weight input → update summary */
  document.getElementById('fWeight')?.addEventListener('input', updateDeliverySummary);

  /* Form submit */
  document.getElementById('deliveryForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveDelivery();
  });

  /* Regen delivery no */
  document.getElementById('regenDelNo')?.addEventListener('click', () => {
    const el = document.getElementById('fDeliveryNo');
    if (el) el.value = generateDeliveryNo();
  });

  /* Set max weight button */
  document.getElementById('setMaxWeight')?.addEventListener('click', () => {
    const weightEl = document.getElementById('fWeight');
    if (weightEl && _availableStock > 0) {
      weightEl.value = _availableStock.toFixed(2);
      updateDeliverySummary();
    }
  });
}

/* ---- Supplier change handler ---- */
function onSupplierChange() {
  const supplierId = document.getElementById('fSupplier')?.value || '';
  if (!supplierId) {
    _availableStock = 0;
    updateAvailStockUI(null);
    updateDeliverySummary();
    return;
  }

  /* Sum remainingWeight across all finished_goods for this supplier */
  const fgItems = DB.filter('finished_goods', i => i.supplierId === supplierId && (Number(i.remainingWeight) || 0) > 0);
  _availableStock = fgItems.reduce((s, i) => s + (Number(i.remainingWeight) || 0), 0);

  updateAvailStockUI({ supplierId, stock: _availableStock });
  updateDeliverySummary();

  /* Set weight input max */
  const weightEl = document.getElementById('fWeight');
  if (weightEl) weightEl.max = _availableStock;
}

function updateAvailStockUI(data) {
  const box    = document.getElementById('availStockBox');
  const icon   = document.getElementById('availStockIcon');
  const text   = document.getElementById('availStockText');
  const maxBtn = document.getElementById('setMaxWeight');
  if (!box) return;

  if (!data) {
    box.className = 'avail-stock-info empty-state-inline';
    if (icon) icon.className = 'avail-stock-icon fas fa-boxes-stacked';
    if (text) text.innerHTML = 'Select a supplier to see available stock.';
    if (maxBtn) maxBtn.style.display = 'none';
    return;
  }

  if (data.stock <= 0) {
    box.className = 'avail-stock-info no-stock';
    if (icon) icon.className = 'avail-stock-icon fas fa-exclamation-circle';
    if (text) text.innerHTML = `<strong style="color:var(--copper);">No stock available</strong> for this supplier.`;
    if (maxBtn) maxBtn.style.display = 'none';
  } else {
    box.className = 'avail-stock-info has-stock';
    if (icon) icon.className = 'avail-stock-icon fas fa-check-circle';
    if (text) text.innerHTML = `Available: <strong style="color:var(--teal);">${formatKG(data.stock)} KG</strong> ready for delivery.`;
    if (maxBtn) maxBtn.style.display = '';
  }
}

/* ---- Summary sidebar update ---- */
function updateDeliverySummary() {
  const suppSel = document.getElementById('fSupplier');
  const suppName = suppSel?.options[suppSel?.selectedIndex]?.dataset?.name || '—';
  const weight   = parseFloat(document.getElementById('fWeight')?.value) || 0;
  const delNo    = document.getElementById('fDeliveryNo')?.value || '—';
  const date     = document.getElementById('fDeliveryDate')?.value || today();

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('sbDelNo',      delNo);
  s('sbDelSupplier', suppName);
  s('sbDelDate',    date);
  s('sbDelWeight',  weight > 0 ? `${formatKG(weight)} KG` : '—');
  s('sbDelAvail',   _availableStock > 0 ? `${formatKG(_availableStock)} KG` : '—');
}

/* =============================================
   SAVE DELIVERY
   ============================================= */
function saveDelivery() {
  const supplierId  = sanitizeInput(document.getElementById('fSupplier')?.value    || '');
  const suppSel     = document.getElementById('fSupplier');
  const supplierName= suppSel?.options[suppSel?.selectedIndex]?.dataset?.name || '';
  const weight      = parseFloat(document.getElementById('fWeight')?.value)         || 0;
  const deliveryNo  = sanitizeInput(document.getElementById('fDeliveryNo')?.value   || '');
  const date        = sanitizeInput(document.getElementById('fDeliveryDate')?.value || today());
  const refNo       = sanitizeInput(document.getElementById('fRefNo')?.value        || '');
  const description = sanitizeInput(document.getElementById('fDescription')?.value  || '');

  /* Validation */
  if (!supplierId)   { showToast('Please select a supplier.',           'error'); return; }
  if (weight <= 0)   { showToast('Enter a valid delivery weight.',       'error'); return; }
  if (weight > _availableStock + 0.01) {
    showToast(`Only ${formatKG(_availableStock)} KG available for this supplier.`, 'error');
    return;
  }
  if (!deliveryNo)   { showToast('Delivery number is required.',         'error'); return; }

  /* Deduct FIFO from finished_goods */
  deductFinishedGoods(supplierId, weight);

  /* Save delivery record */
  const record = {
    deliveryNo,
    supplierId,
    supplierName,
    weight,
    refNo,
    description,
    date: new Date(date + 'T' + new Date().toTimeString().slice(0, 8)).toISOString()
  };
  const saved = DB.add('deliveries', record);

  /* Show receipt */
  _currentReceiptId = saved.id;
  showReceiptModal(saved);

  /* Reset form */
  resetDeliveryForm();
  renderDeliveryTable();
  updateDeliveryStats();
  updateAvailStockUI(null);
  _availableStock = 0;
}

/* ---- FIFO deduction from finished_goods ---- */
function deductFinishedGoods(supplierId, totalToDeduct) {
  /* Get all FG records for supplier with remaining stock, oldest first */
  const fgItems = DB
    .filter('finished_goods', i => i.supplierId === supplierId && (Number(i.remainingWeight) || 0) > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let remaining = totalToDeduct;
  for (const item of fgItems) {
    if (remaining <= 0) break;
    const avail   = Number(item.remainingWeight) || 0;
    const deduct  = Math.min(avail, remaining);
    const newRem  = avail - deduct;
    DB.update('finished_goods', item.id, { remainingWeight: newRem });
    remaining -= deduct;
  }
}

/* =============================================
   RECEIPT
   ============================================= */
function showReceiptModal(delivery) {
  const html = buildReceiptHtml(delivery);
  const container = document.getElementById('receiptContainer');
  if (container) container.innerHTML = html;
  openModal('receiptModal');
}

function buildReceiptHtml(d) {
  return `
    <div class="receipt-paper" id="receiptPaper">
      <div class="receipt-company">
        <h3>Arham Traders</h3>
        <p>Mineral Processing &amp; Supply</p>
        <p>Contact: +92-XXX-XXXXXXX</p>
        <span class="receipt-type">DELIVERY RECEIPT</span>
      </div>
      <div class="receipt-row"><span class="rr-label">Delivery No:</span><span class="rr-value">${escapeHtml(d.deliveryNo)}</span></div>
      <div class="receipt-row"><span class="rr-label">Date:</span><span class="rr-value">${formatDate(d.date)}</span></div>
      <div class="receipt-row"><span class="rr-label">Supplier:</span><span class="rr-value">${escapeHtml(d.supplierName)}</span></div>
      ${d.refNo ? `<div class="receipt-row"><span class="rr-label">Ref No:</span><span class="rr-value">${escapeHtml(d.refNo)}</span></div>` : ''}
      ${d.description ? `<div class="receipt-row"><span class="rr-label">Description:</span><span class="rr-value">${escapeHtml(d.description)}</span></div>` : ''}
      <div class="receipt-total-box">
        <div class="rt-label">Total Delivered Weight</div>
        <div class="rt-value">${formatKG(d.weight)} KG</div>
      </div>
      <div class="receipt-footer">
        <p>Thank you for your business</p>
        <p style="margin-top:4px;">Arham Traders Management System</p>
      </div>
    </div>`;
}

function viewReceipt(id) {
  const d = DB.findById('deliveries', id);
  if (!d) return;
  _currentReceiptId = id;
  showReceiptModal(d);
}

function printCurrentReceipt() {
  printElement('receiptPaper');
}

function whatsappDeliveryReceipt() {
  const d = _currentReceiptId ? DB.findById('deliveries', _currentReceiptId) : null;
  if (!d) return;
  const text = [
    '*DELIVERY RECEIPT — Arham Traders*',
    `Delivery No: ${d.deliveryNo}`,
    `Date: ${formatDate(d.date)}`,
    `Supplier: ${d.supplierName}`,
    d.refNo       ? `Ref No: ${d.refNo}` : '',
    d.description ? `Description: ${d.description}` : '',
    `*Weight Delivered: ${formatKG(d.weight)} KG*`,
    '',
    'Arham Traders Management System'
  ].filter(Boolean).join('\n');
  shareWhatsApp(text);
}

/* =============================================
   RESET FORM
   ============================================= */
function resetDeliveryForm() {
  document.getElementById('deliveryForm')?.reset();
  setDeliveryDefaults();
  updateDeliverySummary();
}

/* =============================================
   DELETE DELIVERY
   ============================================= */
function deleteDelivery(id, deliveryNo) {
  showConfirm(
    `Delete delivery "${deliveryNo}"?\n\nThis will restore the finished goods stock for the supplier.`,
    () => {
      const d = DB.findById('deliveries', id);
      if (!d) return;

      /* Restore finished goods — add back to newest FG record with room (or last exhausted) */
      restoreFinishedGoods(d.supplierId, d.weight);

      DB.remove('deliveries', id);
      showToast('Delivery deleted. Finished goods stock restored.', 'success');
      renderDeliveryTable();
      updateDeliveryStats();
    },
    'Delete Delivery'
  );
}

function restoreFinishedGoods(supplierId, weightToRestore) {
  /* Add back to most-recently-used FG record first (reverse FIFO) */
  const fgItems = DB
    .filter('finished_goods', i => i.supplierId === supplierId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let remaining = weightToRestore;
  for (const item of fgItems) {
    if (remaining <= 0) break;
    const canRestore = (Number(item.finishedWeight) || 0) - (Number(item.remainingWeight) || 0);
    if (canRestore <= 0) continue;
    const restore = Math.min(canRestore, remaining);
    DB.update('finished_goods', item.id, { remainingWeight: (Number(item.remainingWeight) || 0) + restore });
    remaining -= restore;
  }
}

/* =============================================
   RENDER TABLE
   ============================================= */
function renderDeliveryTable() {
  const all      = DB.get('deliveries').slice().reverse();
  const filtered = applyDeliveryFilters(all);
  const tbody    = document.getElementById('deliveryTableBody');
  const countEl  = document.getElementById('deliveryCount');

  if (countEl) countEl.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state" style="padding:40px;">
          <i class="fas fa-truck"></i>
          <p>${_delFilterText || _delFilterSupplier || _delFilterDateFrom || _delFilterDateTo
              ? 'No deliveries match your filters.'
              : 'No deliveries recorded yet. Create your first delivery above.'}</p>
        </div>
      </td></tr>`;
    const tfoot = document.getElementById('deliveryTfoot');
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = filtered.map(d => `
    <tr>
      <td><span style="font-weight:700;color:var(--teal);font-size:12.5px;">${escapeHtml(d.deliveryNo)}</span></td>
      <td>${escapeHtml(d.supplierName || '—')}</td>
      <td style="font-weight:800;color:var(--copper);">${formatKG(d.weight)} <small style="color:var(--text-muted);">KG</small></td>
      <td>${escapeHtml(d.refNo || '—')}</td>
      <td>${escapeHtml(d.description || '—')}</td>
      <td>${formatDateTime(d.date)}</td>
      <td>
        <div class="status-btn-group">
          <button class="btn btn-secondary btn-sm btn-icon" title="View Receipt"
            onclick="viewReceipt('${escapeHtml(d.id)}')">
            <i class="fas fa-receipt"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" title="Delete"
            onclick="deleteDelivery('${escapeHtml(d.id)}','${escapeHtml(d.deliveryNo)}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  /* Footer */
  const tfoot = document.getElementById('deliveryTfoot');
  if (tfoot) {
    const totalWeight = filtered.reduce((s, d) => s + (Number(d.weight) || 0), 0);
    tfoot.innerHTML = `
      <tr style="background:var(--color-surface-2);">
        <td colspan="2" style="font-weight:700;font-size:12px;color:var(--text-muted);">TOTAL (${filtered.length})</td>
        <td style="font-weight:800;color:var(--copper);">${formatKG(totalWeight)} <small style="color:var(--text-muted);">KG</small></td>
        <td colspan="4"></td>
      </tr>`;
  }
}

/* =============================================
   FILTERS
   ============================================= */
function bindDeliveryFilters() {
  document.getElementById('delSearchInput')?.addEventListener('input', e => {
    _delFilterText = e.target.value; renderDeliveryTable();
  });
  document.getElementById('filterDelSupplier')?.addEventListener('change', e => {
    _delFilterSupplier = e.target.value; renderDeliveryTable();
  });
  document.getElementById('filterDelDateFrom')?.addEventListener('change', e => {
    _delFilterDateFrom = e.target.value; renderDeliveryTable();
  });
  document.getElementById('filterDelDateTo')?.addEventListener('change', e => {
    _delFilterDateTo = e.target.value; renderDeliveryTable();
  });
  document.getElementById('clearDelFilters')?.addEventListener('click', () => {
    _delFilterText = _delFilterSupplier = _delFilterDateFrom = _delFilterDateTo = '';
    ['delSearchInput','filterDelSupplier','filterDelDateFrom','filterDelDateTo']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderDeliveryTable();
  });
}

function applyDeliveryFilters(items) {
  return items.filter(d => {
    if (_delFilterSupplier && d.supplierId !== _delFilterSupplier) return false;
    if (_delFilterDateFrom) {
      const dt = d.date ? d.date.slice(0, 10) : '';
      if (dt < _delFilterDateFrom) return false;
    }
    if (_delFilterDateTo) {
      const dt = d.date ? d.date.slice(0, 10) : '';
      if (dt > _delFilterDateTo) return false;
    }
    if (_delFilterText) {
      const q = _delFilterText.toLowerCase();
      if (!(d.deliveryNo    || '').toLowerCase().includes(q) &&
          !(d.supplierName  || '').toLowerCase().includes(q) &&
          !(d.refNo         || '').toLowerCase().includes(q) &&
          !(d.description   || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* =============================================
   MINI STATS
   ============================================= */
function updateDeliveryStats() {
  const all      = DB.get('deliveries');
  const todayStr = today();
  const todayDels = all.filter(d => (d.date || '').slice(0, 10) === todayStr);
  const totalWeight = all.reduce((s, d) => s + (Number(d.weight) || 0), 0);

  /* Available stock across all suppliers */
  const totalAvail = DB.get('finished_goods')
    .reduce((s, i) => s + (Number(i.remainingWeight) || 0), 0);

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('delStatTotal',     all.length);
  s('delStatToday',     todayDels.length);
  s('delStatWeight',    formatKG(totalWeight) + ' KG');
  s('delStatAvailable', formatKG(totalAvail)  + ' KG');
}
