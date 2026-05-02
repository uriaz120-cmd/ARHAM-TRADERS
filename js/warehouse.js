/* =============================================
   ARHAM TRADERS — WAREHOUSE INVENTORY
   js/warehouse.js  |  Phase 4
   ============================================= */

/* ---- State ---- */
let _filterText      = '';
let _filterSupplier  = '';
let _filterStatus    = '';
let _filterDateFrom  = '';
let _filterDateTo    = '';

/* Selected item for production modal */
let _selectedWarehouseId = null;

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  populateFilterDropdowns();
  bindFilters();
  renderWarehouseTable();
  updateWarehouseStats();
  bindProductionModal();
});

/* =============================================
   POPULATE FILTER DROPDOWNS
   ============================================= */
function populateFilterDropdowns() {
  const suppliers = DB.get('suppliers');
  const sel = document.getElementById('filterSupplier');
  if (sel) {
    sel.innerHTML = '<option value="">All Suppliers</option>' +
      suppliers.map(s =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
      ).join('');
  }
}

/* =============================================
   FILTERS
   ============================================= */
function bindFilters() {
  document.getElementById('searchInput')?.addEventListener('input', e => {
    _filterText = e.target.value; renderWarehouseTable();
  });
  document.getElementById('filterSupplier')?.addEventListener('change', e => {
    _filterSupplier = e.target.value; renderWarehouseTable();
  });
  document.getElementById('filterStatus')?.addEventListener('change', e => {
    _filterStatus = e.target.value; renderWarehouseTable();
  });
  document.getElementById('filterDateFrom')?.addEventListener('change', e => {
    _filterDateFrom = e.target.value; renderWarehouseTable();
  });
  document.getElementById('filterDateTo')?.addEventListener('change', e => {
    _filterDateTo = e.target.value; renderWarehouseTable();
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    _filterText = _filterSupplier = _filterStatus = _filterDateFrom = _filterDateTo = '';
    ['searchInput','filterSupplier','filterStatus','filterDateFrom','filterDateTo']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderWarehouseTable();
  });
}

function applyFilters(items) {
  return items.filter(w => {
    if (_filterSupplier && w.supplierId !== _filterSupplier) return false;
    if (_filterStatus   && w.status     !== _filterStatus)   return false;
    if (_filterDateFrom && w.date < _filterDateFrom)         return false;
    if (_filterDateTo   && w.date.slice(0,10) > _filterDateTo) return false;
    if (_filterText) {
      const q = _filterText.toLowerCase();
      if (!(w.bookingNo    || '').toLowerCase().includes(q) &&
          !(w.supplierName || '').toLowerCase().includes(q) &&
          !(w.description  || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* =============================================
   RENDER TABLE
   ============================================= */
function renderWarehouseTable() {
  const all      = DB.get('warehouse').reverse(); /* newest first */
  const filtered = applyFilters(all);
  const tbody    = document.getElementById('warehouseTableBody');
  const countEl  = document.getElementById('warehouseCount');

  if (countEl) countEl.textContent = `${filtered.length} entr${filtered.length !== 1 ? 'ies' : 'y'}`;
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state" style="padding:40px;">
          <i class="fas fa-warehouse"></i>
          <p>${_filterText || _filterSupplier || _filterStatus
              ? 'No items match your filters.'
              : 'Warehouse is empty. Add bookings first.'}</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(w => {
    const total    = Number(w.totalWeight)     || 0;
    const remain   = Number(w.remainingWeight) || 0;
    const used     = total - remain;
    const pct      = total > 0 ? Math.round((remain / total) * 100) : 0;
    const statusInfo = getStatusInfo(w.status, pct);
    const barColor   = pct >= 70 ? 'var(--emerald)' : pct >= 30 ? '#b8960a' : 'var(--copper)';

    return `
      <tr>
        <td>
          <span style="font-weight:700;color:var(--teal);font-size:12.5px;">
            ${escapeHtml(w.bookingNo || '—')}
          </span>
        </td>
        <td>${escapeHtml(w.supplierName || '—')}</td>
        <td>${formatDate(w.date)}</td>
        <td style="font-weight:700;">${formatKG(total)} <small style="color:var(--text-muted);font-weight:400;">KG</small></td>
        <td>
          <span style="font-weight:700;color:var(--emerald);">${formatKG(remain)}</span>
          <small style="color:var(--text-muted);font-weight:400;"> KG</small>
        </td>
        <td style="color:var(--copper);font-weight:600;">${formatKG(used)} <small style="color:var(--text-muted);font-weight:400;">KG</small></td>
        <td>
          <div class="stock-progress-wrap">
            <div class="stock-progress-bar">
              <div class="stock-progress-fill" style="width:${pct}%;background:${barColor};"></div>
            </div>
            <span class="stock-progress-pct" style="color:${barColor};">${pct}%</span>
          </div>
        </td>
        <td>
          <span class="stock-status ${statusInfo.cls}">
            <span class="stock-status-dot"></span>
            ${statusInfo.label}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:5px;">
            ${remain > 0 ? `
            <button class="btn btn-primary btn-sm" title="Send to Production"
              onclick="openSendToProduction('${escapeHtml(w.id)}')">
              <i class="fas fa-industry"></i> Send
            </button>` : `
            <span class="badge badge-stone" style="font-size:11px;">Used Up</span>
            `}
            <button class="btn btn-secondary btn-sm btn-icon" title="View Booking"
              onclick="window.location.href='booking.html'">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  /* Footer totals */
  const tfoot = document.getElementById('warehouseTfoot');
  if (tfoot) {
    const totTotal  = filtered.reduce((s, w) => s + (Number(w.totalWeight)     || 0), 0);
    const totRemain = filtered.reduce((s, w) => s + (Number(w.remainingWeight) || 0), 0);
    const totUsed   = totTotal - totRemain;
    tfoot.innerHTML = `
      <tr style="background:var(--color-surface-2);">
        <td colspan="3" style="font-weight:700;font-size:12px;color:var(--text-muted);">
          TOTAL (${filtered.length} entries)
        </td>
        <td style="font-weight:800;">${formatKG(totTotal)} <small style="color:var(--text-muted);font-weight:400;">KG</small></td>
        <td style="font-weight:800;color:var(--emerald);">${formatKG(totRemain)} <small style="color:var(--text-muted);">KG</small></td>
        <td style="font-weight:700;color:var(--copper);">${formatKG(totUsed)} <small style="color:var(--text-muted);">KG</small></td>
        <td colspan="3"></td>
      </tr>`;
  }
}

/* =============================================
   STATUS INFO HELPER
   ============================================= */
function getStatusInfo(status, pct) {
  if (status === 'empty' || pct === 0)  return { cls: 'status-empty',    label: 'Empty' };
  if (status === 'partial' || pct < 100) return { cls: 'status-partial',  label: 'Partial' };
  return                                        { cls: 'status-in_stock', label: 'In Stock' };
}

/* =============================================
   WAREHOUSE STATS
   ============================================= */
function updateWarehouseStats() {
  const items    = DB.get('warehouse');
  const total    = items.reduce((s, w) => s + (Number(w.totalWeight)     || 0), 0);
  const remaining= items.reduce((s, w) => s + (Number(w.remainingWeight) || 0), 0);
  const used     = total - remaining;
  const entries  = items.length;

  const s = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  s('whTotalStock',     `${formatKG(total)} <small>KG</small>`);
  s('whRemainingStock', `${formatKG(remaining)} <small>KG</small>`);
  s('whUsedStock',      `${formatKG(used)} <small>KG</small>`);
  s('whEntries',        entries);
}

/* =============================================
   SEND TO PRODUCTION MODAL
   ============================================= */
function openSendToProduction(warehouseId) {
  const w = DB.findById('warehouse', warehouseId);
  if (!w) return;
  _selectedWarehouseId = warehouseId;

  const remaining = Number(w.remainingWeight) || 0;

  /* Fill modal info */
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('prodBookingNo',   w.bookingNo    || '—');
  setEl('prodSupplier',    w.supplierName || '—');
  setEl('prodTotalWeight', formatKG(w.totalWeight) + ' KG');
  setEl('prodAvailable',   formatKG(remaining) + ' KG');

  /* Slider */
  const slider = document.getElementById('prodWeightSlider');
  const input  = document.getElementById('prodWeightInput');
  if (slider) {
    slider.min   = 1;
    slider.max   = Math.floor(remaining);
    slider.value = Math.floor(remaining);
    slider.step  = 1;
  }
  if (input) {
    input.min   = 0.01;
    input.max   = remaining;
    input.value = remaining.toFixed(2);
    input.step  = 0.01;
  }

  updateProductionPreview(remaining, remaining);
  openModal('sendToProductionModal');
}

function bindProductionModal() {
  const slider = document.getElementById('prodWeightSlider');
  const input  = document.getElementById('prodWeightInput');
  if (!slider || !input) return;

  const sync = (fromSlider) => {
    const w = DB.findById('warehouse', _selectedWarehouseId);
    if (!w) return;
    const avail = Number(w.remainingWeight) || 0;

    if (fromSlider) {
      input.value = slider.value;
    } else {
      let val = Math.min(parseFloat(input.value) || 0, avail);
      val = Math.max(val, 0.01);
      input.value  = val.toFixed(2);
      slider.value = Math.round(val);
    }
    updateProductionPreview(parseFloat(input.value) || 0, avail);
  };

  slider.addEventListener('input', () => sync(true));
  input.addEventListener('input',  () => sync(false));
}

function updateProductionPreview(toProd, total) {
  const stays = total - toProd;
  const el1   = document.getElementById('prevToProd');
  const el2   = document.getElementById('prevStays');
  if (el1) el1.textContent = formatKG(Math.max(toProd, 0)) + ' KG';
  if (el2) el2.textContent = formatKG(Math.max(stays,  0)) + ' KG';
}

function confirmSendToProduction() {
  const w = DB.findById('warehouse', _selectedWarehouseId);
  if (!w) return;

  const input  = document.getElementById('prodWeightInput');
  const weight = parseFloat(input?.value) || 0;
  const avail  = Number(w.remainingWeight) || 0;

  if (weight <= 0)       { showToast('Weight must be greater than 0.', 'error'); return; }
  if (weight > avail)    { showToast(`Cannot exceed available: ${formatKG(avail)} KG`, 'error'); return; }

  const desc = sanitizeInput(document.getElementById('prodDescription')?.value || '');

  /* Create production record */
  DB.add('production', {
    warehouseId:   w.id,
    bookingNo:     w.bookingNo,
    supplierId:    w.supplierId,
    supplierName:  w.supplierName,
    weight,
    description:   desc || w.description || '',
    status:        'pending',
    date:          new Date().toISOString()
  });

  /* Update warehouse remaining */
  const newRemaining = avail - weight;
  const newStatus    = newRemaining <= 0 ? 'empty' : newRemaining < avail ? 'partial' : 'in_stock';
  DB.update('warehouse', w.id, {
    remainingWeight: newRemaining,
    status:          newStatus
  });

  closeModal('sendToProductionModal');
  showToast(`${formatKG(weight)} KG sent to Production for ${w.supplierName}!`, 'success');
  renderWarehouseTable();
  updateWarehouseStats();

  /* Ask to go to production page */
  setTimeout(() => {
    if (confirm('Sent to production! Go to Production Module now?')) {
      window.location.href = 'production.html';
    }
  }, 300);
}
