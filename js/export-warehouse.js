/* =============================================
   ARHAM TRADERS — EXPORT WAREHOUSE INVENTORY
   js/export-warehouse.js  |  Phase 4
   ============================================= */

/* ---- State ---- */
let _filterText      = '';
let _filterSupplier  = '';
let _filterStatus    = '';
let _filterDateFrom  = '';
let _filterDateTo    = '';

/* Selected item for production modal */
let _selectedWarehouseId = null;
let _whExpActiveId       = null;

/* =============================================
   COST & EXPENSE CALCULATOR
   ============================================= */
function getWarehouseCostDetails(w) {
  /* 1. Base booking amount */
  let baseAmount = Number(w.total) || 0;
  if (!baseAmount && w.bookingNo) {
    const bk = DB.filter('exp_bookings', b => b.bookingNo === w.bookingNo)[0];
    if (bk && bk.total) {
      baseAmount = Number(bk.total) || 0;
    }
  }

  /* 2. Additional warehouse expenses */
  const expenses = Array.isArray(w.expenses) ? w.expenses : [];
  const extraExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netAmount = baseAmount + extraExpenses;

  return { baseAmount, extraExpenses, netAmount, expenses };
}

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
  const suppliers = DB.get('exp_suppliers');
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
  const all      = DB.get('exp_warehouse').reverse(); /* newest first */
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

    /* Cost & Expenses */
    const cost = getWarehouseCostDetails(w);

    return `
      <tr>
        <td>
          <span style="font-weight:700;color:var(--teal);font-size:12.5px;">
            ${escapeHtml(w.bookingNo || '—')}
          </span>
        </td>
        <td>${escapeHtml(w.supplierName || '—')}</td>
        <td>${formatDate(w.date)}</td>
        <td style="font-weight:700;">${formatKG(total)} <small style="color:var(--text-muted);font-weight:400;">TON</small></td>
        <td>
          <span style="font-weight:700;color:var(--emerald);">${formatKG(remain)}</span>
          <small style="color:var(--text-muted);font-weight:400;"> TON</small>
        </td>
        <td style="color:var(--copper);font-weight:600;">${formatKG(used)} <small style="color:var(--text-muted);font-weight:400;">TON</small></td>
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
          <div style="display:flex;align-items:center;gap:6px;">
            <div>
              <div style="font-weight:800;font-size:13px;color:var(--color-text);">
                PKR ${formatCurrency(cost.netAmount)}
              </div>
              ${cost.extraExpenses > 0 ? `
                <div style="font-size:10.5px;color:var(--copper, #d97706);font-weight:600;">
                  Base: ${formatCurrency(cost.baseAmount)} + Exp: ${formatCurrency(cost.extraExpenses)}
                </div>` : ''}
            </div>
            <button class="btn btn-secondary btn-sm btn-icon" title="Add / View Expenses"
              style="color:var(--teal);border-color:var(--color-border);width:30px;height:30px;"
              onclick="openWhExpenseModal('${escapeHtml(w.id)}')">
              <i class="fas fa-coins"></i>
            </button>
          </div>
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
              onclick="window.location.href='export-booking.html'">
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
        <td style="font-weight:800;">${formatKG(totTotal)} <small style="color:var(--text-muted);font-weight:400;">TON</small></td>
        <td style="font-weight:800;color:var(--emerald);">${formatKG(totRemain)} <small style="color:var(--text-muted);">TON</small></td>
        <td style="font-weight:700;color:var(--copper);">${formatKG(totUsed)} <small style="color:var(--text-muted);">TON</small></td>
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
  const items    = DB.get('exp_warehouse');
  const total    = items.reduce((s, w) => s + (Number(w.totalWeight)     || 0), 0);
  const remaining= items.reduce((s, w) => s + (Number(w.remainingWeight) || 0), 0);
  const used     = total - remaining;
  const entries  = items.length;

  const s = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  s('whTotalStock',     `${formatKG(total)} <small>TON</small>`);
  s('whRemainingStock', `${formatKG(remaining)} <small>TON</small>`);
  s('whUsedStock',      `${formatKG(used)} <small>TON</small>`);
  s('whEntries',        entries);
}

/* =============================================
   SEND TO PRODUCTION MODAL
   ============================================= */
function openSendToProduction(warehouseId) {
  const w = DB.findById('exp_warehouse', warehouseId);
  if (!w) return;
  _selectedWarehouseId = warehouseId;

  const remaining = Number(w.remainingWeight) || 0;

  /* Fill modal info */
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('prodBookingNo',   w.bookingNo    || '—');
  setEl('prodSupplier',    w.supplierName || '—');
  setEl('prodTotalWeight', formatKG(w.totalWeight) + ' TON');
  setEl('prodAvailable',   formatKG(remaining) + ' TON');

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
    const w = DB.findById('exp_warehouse', _selectedWarehouseId);
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
  if (el1) el1.textContent = formatKG(Math.max(toProd, 0)) + ' TON';
  if (el2) el2.textContent = formatKG(Math.max(stays,  0)) + ' TON';
}

function confirmSendToProduction() {
  const w = DB.findById('exp_warehouse', _selectedWarehouseId);
  if (!w) return;

  const input  = document.getElementById('prodWeightInput');
  const weight = parseFloat(input?.value) || 0;
  const avail  = Number(w.remainingWeight) || 0;

  if (weight <= 0)       { showToast('Weight must be greater than 0.', 'error'); return; }
  if (weight > avail)    { showToast(`Cannot exceed available: ${formatKG(avail)} TON`, 'error'); return; }

  const desc = sanitizeInput(document.getElementById('prodDescription')?.value || '');

  /* Create production record */
  DB.add('exp_production', {
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
  DB.update('exp_warehouse', w.id, {
    remainingWeight: newRemaining,
    status:          newStatus
  });

  closeModal('sendToProductionModal');
  showToast(`${formatKG(weight)} TON sent to Production for ${w.supplierName}!`, 'success');
  renderWarehouseTable();
  updateWarehouseStats();

  /* Ask to go to production page */
  setTimeout(() => {
    if (confirm('Sent to production! Go to Export Production Module now?')) {
      window.location.href = 'export-production.html';
    }
  }, 300);
}


/* =============================================
   WAREHOUSE EXPENSE MANAGEMENT MODAL
   ============================================= */
function openWhExpenseModal(id) {
  const item = DB.findById('exp_warehouse', id);
  if (!item) return;

  _whExpActiveId = id;
  cancelWhExpenseEdit();

  const setEl = (eid, val) => { const el = document.getElementById(eid); if (el) el.textContent = val; };
  setEl('whExpModalBookingNo', item.bookingNo || '—');
  setEl('whExpModalSupplier',  item.supplierName || '—');

  refreshWhExpenseModalUI();
  openModal('whExpenseModal');
}

function refreshWhExpenseModalUI() {
  const item = _whExpActiveId ? DB.findById('exp_warehouse', _whExpActiveId) : null;
  if (!item) return;

  const cost = getWarehouseCostDetails(item);

  const setEl = (eid, val) => { const el = document.getElementById(eid); if (el) el.textContent = val; };
  setEl('whExpModalBaseCost',  `PKR ${formatCurrency(cost.baseAmount)}`);
  setEl('whExpModalExtraCost', `+ PKR ${formatCurrency(cost.extraExpenses)}`);
  setEl('whExpModalNetCost',   `PKR ${formatCurrency(cost.netAmount)}`);

  const tbody = document.getElementById('whExpListTbody');
  if (!tbody) return;

  if (!cost.expenses.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted);">
          No additional warehouse expenses added yet.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = cost.expenses.map((exp, idx) => `
    <tr>
      <td>
        <div style="font-weight:700;">${escapeHtml(exp.title || 'Expense')}</div>
        ${exp.notes ? `<div style="font-size:11px;color:var(--text-muted);">${escapeHtml(exp.notes)}</div>` : ''}
      </td>
      <td style="font-weight:700;color:var(--copper, #d97706);">
        PKR ${formatCurrency(exp.amount)}
      </td>
      <td style="font-size:11.5px;color:var(--text-muted);">
        ${formatDate(exp.date)}
      </td>
      <td style="text-align:center;">
        <div style="display:flex;gap:4px;justify-content:center;">
          <button class="btn btn-secondary btn-sm btn-icon" title="Edit"
            onclick="editWhBatchExpense('${escapeHtml(exp.id || idx)}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" title="Delete"
            onclick="deleteWhBatchExpense('${escapeHtml(exp.id || idx)}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function saveWhBatchExpense(e) {
  if (e) e.preventDefault();
  const item = _whExpActiveId ? DB.findById('exp_warehouse', _whExpActiveId) : null;
  if (!item) return;

  const title    = sanitizeInput(document.getElementById('whExpTitle')?.value  || '');
  const amount   = parseFloat(document.getElementById('whExpAmount')?.value)   || 0;
  const notes    = sanitizeInput(document.getElementById('whExpNotes')?.value  || '');
  const editId   = document.getElementById('whExpEditingId')?.value            || '';

  if (!title) {
    showToast('Expense title is required.', 'error');
    return;
  }
  if (amount <= 0) {
    showToast('Amount must be greater than 0.', 'error');
    return;
  }

  const expenses = Array.isArray(item.expenses) ? [...item.expenses] : [];

  if (editId) {
    const idx = expenses.findIndex(x => (x.id || '') === editId);
    if (idx !== -1) {
      expenses[idx] = {
        ...expenses[idx],
        title,
        amount,
        notes,
        updatedAt: new Date().toISOString()
      };
      showToast('Warehouse expense updated successfully.', 'success');
    }
  } else {
    expenses.push({
      id: generateId(),
      title,
      amount,
      notes,
      date: new Date().toISOString()
    });
    showToast('Warehouse expense added successfully.', 'success');
  }

  DB.update('exp_warehouse', _whExpActiveId, { expenses });

  cancelWhExpenseEdit();
  refreshWhExpenseModalUI();
  renderWarehouseTable();
}

function editWhBatchExpense(expId) {
  const item = _whExpActiveId ? DB.findById('exp_warehouse', _whExpActiveId) : null;
  if (!item) return;

  const expenses = Array.isArray(item.expenses) ? item.expenses : [];
  const exp = expenses.find(x => (x.id || '') === expId) || expenses[parseInt(expId)];
  if (!exp) return;

  document.getElementById('whExpEditingId').value = exp.id || expId;
  document.getElementById('whExpTitle').value     = exp.title || '';
  document.getElementById('whExpAmount').value    = exp.amount || '';
  document.getElementById('whExpNotes').value     = exp.notes || '';

  const titleEl = document.getElementById('whExpFormTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Edit Expense';

  const subBtn = document.getElementById('whExpSubmitBtn');
  if (subBtn) subBtn.innerHTML = '<i class="fas fa-save"></i> Update Expense';

  const cancelBtn = document.getElementById('whExpCancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';
}

function cancelWhExpenseEdit() {
  document.getElementById('whExpenseForm')?.reset();
  const editIdEl = document.getElementById('whExpEditingId');
  if (editIdEl) editIdEl.value = '';

  const titleEl = document.getElementById('whExpFormTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Expense';

  const subBtn = document.getElementById('whExpSubmitBtn');
  if (subBtn) subBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';

  const cancelBtn = document.getElementById('whExpCancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function deleteWhBatchExpense(expId) {
  const item = _whExpActiveId ? DB.findById('exp_warehouse', _whExpActiveId) : null;
  if (!item) return;

  showConfirm(
    'Are you sure you want to delete this warehouse expense?',
    () => {
      let expenses = Array.isArray(item.expenses) ? [...item.expenses] : [];
      expenses = expenses.filter((x, idx) => (x.id || String(idx)) !== String(expId));

      DB.update('exp_warehouse', _whExpActiveId, { expenses });
      showToast('Warehouse expense removed.', 'success');

      cancelWhExpenseEdit();
      refreshWhExpenseModalUI();
      renderWarehouseTable();
    },
    'Delete Expense'
  );
}
