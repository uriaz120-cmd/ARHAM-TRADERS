/* =============================================
   ARHAM TRADERS — EXPORT FINISHED GOODS MODULE
   js/export-finished-goods.js  |  Phase 6
   ============================================= */

/* ---- State ---- */
let _fgTab          = 'finished';   /* 'finished' | 'scrap' */
let _fgFilter       = '';
let _fgFilterSupplier = '';
let _fgFilterDateFrom = '';
let _fgFilterDateTo   = '';
let _viewingId      = null;
let _expActiveFgId  = null;

/* =============================================
   COST & EXPENSE CALCULATOR
   ============================================= */
function getBatchCostDetails(item) {
  /* 1. Base booking cost from exp_bookings */
  let baseAmount = 0;
  if (item.bookingNo) {
    const bk = DB.filter('exp_bookings', b => b.bookingNo === item.bookingNo)[0];
    if (bk && bk.total) {
      baseAmount = Number(bk.total) || 0;
    }
  }

  /* 2. Additional batch expenses */
  const expenses = Array.isArray(item.expenses) ? item.expenses : [];
  const extraExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netAmount = baseAmount + extraExpenses;

  return { baseAmount, extraExpenses, netAmount, expenses };
}

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  populateFgDropdowns();
  bindFgFilters();
  renderFgTable();
  updateFgStats();
});

/* =============================================
   TAB SWITCH
   ============================================= */
function switchTab(tab) {
  _fgTab = tab;

  document.querySelectorAll('.fg-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.fg-panel').forEach(panel => {
    panel.classList.toggle('visible', panel.dataset.panel === tab);
  });

  renderFgTable();
}

/* =============================================
   POPULATE FILTER DROPDOWNS
   ============================================= */
function populateFgDropdowns() {
  const suppliers = DB.get('exp_suppliers');
  ['filterFgSupplier'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">All Suppliers</option>' +
      suppliers.map(s =>
        `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
      ).join('');
  });
}

/* =============================================
   FILTERS
   ============================================= */
function bindFgFilters() {
  document.getElementById('fgSearchInput')?.addEventListener('input', e => {
    _fgFilter = e.target.value; renderFgTable();
  });
  document.getElementById('filterFgSupplier')?.addEventListener('change', e => {
    _fgFilterSupplier = e.target.value; renderFgTable();
  });
  document.getElementById('filterFgDateFrom')?.addEventListener('change', e => {
    _fgFilterDateFrom = e.target.value; renderFgTable();
  });
  document.getElementById('filterFgDateTo')?.addEventListener('change', e => {
    _fgFilterDateTo = e.target.value; renderFgTable();
  });
  document.getElementById('clearFgFilters')?.addEventListener('click', () => {
    _fgFilter = _fgFilterSupplier = _fgFilterDateFrom = _fgFilterDateTo = '';
    ['fgSearchInput','filterFgSupplier','filterFgDateFrom','filterFgDateTo']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderFgTable();
  });
}

function applyFgFilters(items) {
  return items.filter(item => {
    if (_fgFilterSupplier && item.supplierId !== _fgFilterSupplier) return false;
    if (_fgFilterDateFrom) {
      const d = item.date ? item.date.slice(0, 10) : '';
      if (d < _fgFilterDateFrom) return false;
    }
    if (_fgFilterDateTo) {
      const d = item.date ? item.date.slice(0, 10) : '';
      if (d > _fgFilterDateTo) return false;
    }
    if (_fgFilter) {
      const q = _fgFilter.toLowerCase();
      if (!(item.bookingNo    || '').toLowerCase().includes(q) &&
          !(item.supplierName || '').toLowerCase().includes(q) &&
          !(item.description  || '').toLowerCase().includes(q) &&
          !(item.notes        || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* =============================================
   RENDER TABLE
   ============================================= */
function renderFgTable() {
  const all = DB.get('exp_finished_goods').slice().reverse();
  const filtered = applyFgFilters(all);

  /* ---- Finished Goods panel ---- */
  renderFinishedPanel(filtered);

  /* ---- Scrap panel ---- */
  renderScrapPanel(filtered);

  /* Count badge */
  const countEl = document.getElementById('fgCount');
  if (countEl) countEl.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;
}

/* ---- Finished Goods Table ---- */
function renderFinishedPanel(filtered) {
  const tbody = document.getElementById('fgTableBody');
  const tfoot = document.getElementById('fgTfoot');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state" style="padding:40px;">
          <i class="fas fa-layer-group"></i>
          <p>${_fgFilter || _fgFilterSupplier || _fgFilterDateFrom || _fgFilterDateTo
              ? 'No records match your filters.'
              : 'No finished goods yet. Complete a production batch first.'}</p>
          ${!_fgFilter && !_fgFilterSupplier
            ? '<a href="export-production.html" class="btn btn-primary btn-sm" style="margin-top:10px;"><i class="fas fa-industry"></i> Go to Production</a>'
            : ''}
        </div>
      </td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const remaining  = Number(item.remainingWeight) || 0;
    const finished   = Number(item.finishedWeight)  || 0;
    const delivered  = finished - remaining;
    const pct        = finished > 0 ? Math.round((remaining / finished) * 100) : 0;
    const fillClass  = pct <= 0 ? 'empty' : pct <= 30 ? 'low' : '';

    /* Calculate Cost & Expenses */
    const cost = getBatchCostDetails(item);

    return `
      <tr>
        <td>
          <span style="font-weight:700;color:var(--teal);font-size:12.5px;">
            ${escapeHtml(item.bookingNo || '—')}
          </span>
        </td>
        <td>${escapeHtml(item.supplierName || '—')}</td>
        <td style="font-weight:700;">${formatKG(item.inputWeight)} <small style="color:var(--text-muted);">TON</small></td>
        <td style="font-weight:700;color:var(--emerald);">${formatKG(finished)} <small style="color:var(--text-muted);">TON</small></td>
        <td>
          <div class="fg-remaining-cell">
            <span style="font-weight:700;color:${pct <= 0 ? 'var(--stone)' : pct <= 30 ? 'var(--copper)' : 'var(--teal)'}">
              ${formatKG(remaining)} TON
            </span>
            <div class="fg-remaining-bar">
              <div class="fg-remaining-fill ${fillClass}" style="width:${pct}%"></div>
            </div>
            <small style="color:var(--text-muted);">${pct}% remaining</small>
          </div>
        </td>
        <td>${delivered > 0
          ? `<span style="color:var(--copper);font-weight:700;">${formatKG(delivered)} TON</span>`
          : '<span style="color:var(--text-muted);">—</span>'
        }</td>
        <td>${formatDateTime(item.date)}</td>
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
              onclick="openFgExpenseModal('${escapeHtml(item.id)}')">
              <i class="fas fa-coins"></i>
            </button>
          </div>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm btn-icon" title="View Details"
            onclick="viewFgDetail('${escapeHtml(item.id)}')">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  /* Footer */
  if (tfoot) {
    const totalInput     = filtered.reduce((s, i) => s + (Number(i.inputWeight)     || 0), 0);
    const totalFinished  = filtered.reduce((s, i) => s + (Number(i.finishedWeight)  || 0), 0);
    const totalRemaining = filtered.reduce((s, i) => s + (Number(i.remainingWeight) || 0), 0);
    const totalDelivered = totalFinished - totalRemaining;
    const totalNetCost   = filtered.reduce((s, i) => s + getBatchCostDetails(i).netAmount, 0);

    tfoot.innerHTML = `
      <tr style="background:var(--color-surface-2);">
        <td colspan="2" style="font-weight:700;font-size:12px;color:var(--text-muted);">TOTAL (${filtered.length})</td>
        <td style="font-weight:800;">${formatKG(totalInput)} <small style="color:var(--text-muted);">TON</small></td>
        <td style="font-weight:800;color:var(--emerald);">${formatKG(totalFinished)} <small style="color:var(--text-muted);">TON</small></td>
        <td style="font-weight:800;color:var(--teal);">${formatKG(totalRemaining)} <small style="color:var(--text-muted);">TON</small></td>
        <td style="font-weight:800;color:var(--copper);">${formatKG(totalDelivered)} <small style="color:var(--text-muted);">TON</small></td>
        <td></td>
        <td style="font-weight:800;color:var(--color-text);">PKR ${formatCurrency(totalNetCost)}</td>
        <td></td>
      </tr>`;
  }
}

/* ---- Scrap Table ---- */
function renderScrapPanel(filtered) {
  const tbody = document.getElementById('scrapTableBody');
  const tfoot = document.getElementById('scrapTfoot');
  if (!tbody) return;

  /* Only records that have scrap > 0 */
  const scrapItems = filtered.filter(i => (Number(i.scrapWeight) || 0) > 0);

  if (!scrapItems.length) {
    tbody.innerHTML = `
      <tr><td colspan="5">
        <div class="empty-state" style="padding:40px;">
          <i class="fas fa-recycle"></i>
          <p>${_fgFilter || _fgFilterSupplier ? 'No scrap records match your filters.' : 'No scrap recorded yet.'}</p>
        </div>
      </td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = scrapItems.map(item => `
    <tr>
      <td>
        <span style="font-weight:700;color:var(--teal);font-size:12.5px;">
          ${escapeHtml(item.bookingNo || '—')}
        </span>
      </td>
      <td>${escapeHtml(item.supplierName || '—')}</td>
      <td style="font-weight:700;">${formatKG(item.inputWeight)} <small style="color:var(--text-muted);">TON</small></td>
      <td style="font-weight:700;color:var(--stone);">${formatKG(item.scrapWeight)} <small style="color:var(--text-muted);">TON</small></td>
      <td>${formatDateTime(item.date)}</td>
    </tr>`).join('');

  if (tfoot) {
    const totalScrap = scrapItems.reduce((s, i) => s + (Number(i.scrapWeight) || 0), 0);
    tfoot.innerHTML = `
      <tr style="background:var(--color-surface-2);">
        <td colspan="3" style="font-weight:700;font-size:12px;color:var(--text-muted);">TOTAL (${scrapItems.length})</td>
        <td style="font-weight:800;color:var(--stone);">${formatKG(totalScrap)} <small style="color:var(--text-muted);">TON</small></td>
        <td></td>
      </tr>`;
  }
}

/* =============================================
   OVERVIEW STATS
   ============================================= */
function updateFgStats() {
  const all = DB.get('exp_finished_goods');
  const totalFinished  = all.reduce((s, i) => s + (Number(i.finishedWeight)  || 0), 0);
  const totalRemaining = all.reduce((s, i) => s + (Number(i.remainingWeight) || 0), 0);
  const totalScrap     = all.reduce((s, i) => s + (Number(i.scrapWeight)     || 0), 0);
  const totalDelivered = totalFinished - totalRemaining;

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('fgStatTotal',     formatKG(totalFinished)  + ' TON');
  s('fgStatAvail',     formatKG(totalRemaining) + ' TON');
  s('fgStatDelivered', formatKG(totalDelivered) + ' TON');
  s('fgStatScrap',     formatKG(totalScrap)     + ' TON');
}

/* =============================================
   DETAIL MODAL
   ============================================= */
function viewFgDetail(id) {
  const item = DB.findById('exp_finished_goods', id);
  if (!item) return;
  _viewingId = id;

  const input    = Number(item.inputWeight)    || 0;
  const finished = Number(item.finishedWeight) || 0;
  const scrap    = Number(item.scrapWeight)    || 0;
  const remaining= Number(item.remainingWeight)|| 0;
  const delivered= finished - remaining;

  /* Header */
  const setEl = (eid, v) => { const el = document.getElementById(eid); if (el) el.innerHTML = v; };
  setEl('dBookingNo',   escapeHtml(item.bookingNo    || '—'));
  setEl('dSupplier',    escapeHtml(item.supplierName || '—'));
  setEl('dDate',        formatDateTime(item.date));
  setEl('dDescription', escapeHtml(item.description || '—'));
  setEl('dNotes',       escapeHtml(item.notes        || '—'));

  /* Weight detail items */
    setEl('dInputKg',     `${formatKG(input)} TON`);
  setEl('dFinishedKg',  `${formatKG(finished)} TON`);
  setEl('dScrapKg',     `${formatKG(scrap)} TON`);
  setEl('dRemainingKg', `${formatKG(remaining)} TON`);
  setEl('dDelivered',   `${formatKG(delivered)} TON`);
  setEl('dRemaining',   `${formatKG(remaining)} TON`);
  setEl('dScrap',       `${formatKG(scrap)} TON`);

  /* Breakdown bar (finished = delivered + remaining; scrap separate) */
  const total = input || 1;
  const pctDelivered = (delivered / total * 100).toFixed(1);
  const pctRemaining = (remaining / total * 100).toFixed(1);
  const pctScrap     = (scrap     / total * 100).toFixed(1);

  const bar = document.getElementById('dBreakdownBar');
  if (bar) {
    bar.innerHTML = `
      <div class="wb-segment-delivered"  style="width:${pctDelivered}%"></div>
      <div class="wb-segment-remaining"  style="width:${pctRemaining}%"></div>
      <div class="wb-segment-scrap"      style="width:${pctScrap}%"></div>`;
  }

  openModal('fgDetailModal');
}

/* =============================================
   EXPORT CSV (Finished Goods)
   ============================================= */
function exportFgCSV() {
  const all      = DB.get('exp_finished_goods').slice().reverse();
  const filtered = applyFgFilters(all);
  if (!filtered.length) { showToast('No data to export.', 'warning'); return; }

  const headers = ['Booking No','Supplier','Input (KG)','Finished (KG)','Scrap (KG)','Remaining (KG)','Delivered (KG)','Date','Notes'];
  const rows = filtered.map(i => [
    i.bookingNo    || '',
    i.supplierName || '',
    Number(i.inputWeight)    || 0,
    Number(i.finishedWeight) || 0,
    Number(i.scrapWeight)    || 0,
    Number(i.remainingWeight)|| 0,
    ((Number(i.finishedWeight) || 0) - (Number(i.remainingWeight) || 0)),
    i.date ? i.date.slice(0,10) : '',
    (i.notes || '').replace(/,/g, ';')
  ]);

  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `export-finished-goods-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully.', 'success');
}

/* =============================================
   EXPENSE MANAGEMENT MODAL LOGIC
   ============================================= */
function openFgExpenseModal(id) {
  const item = DB.findById('exp_finished_goods', id);
  if (!item) return;

  _expActiveFgId = id;
  cancelExpenseEdit();

  /* Set summary details */
  const setEl = (eid, val) => { const el = document.getElementById(eid); if (el) el.textContent = val; };
  setEl('expModalBookingNo', item.bookingNo || '—');
  setEl('expModalSupplier',  item.supplierName || '—');

  refreshExpenseModalUI();
  openModal('fgExpenseModal');
}

function refreshExpenseModalUI() {
  const item = _expActiveFgId ? DB.findById('exp_finished_goods', _expActiveFgId) : null;
  if (!item) return;

  const cost = getBatchCostDetails(item);

  const setEl = (eid, val) => { const el = document.getElementById(eid); if (el) el.textContent = val; };
  setEl('expModalBaseCost',  `PKR ${formatCurrency(cost.baseAmount)}`);
  setEl('expModalExtraCost', `+ PKR ${formatCurrency(cost.extraExpenses)}`);
  setEl('expModalNetCost',   `PKR ${formatCurrency(cost.netAmount)}`);

  /* Render expenses list */
  const tbody = document.getElementById('expListTbody');
  if (!tbody) return;

  if (!cost.expenses.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:16px;color:var(--text-muted);">
          No additional expenses added for this batch yet.
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
            onclick="editBatchExpense('${escapeHtml(exp.id || idx)}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon" title="Delete"
            onclick="deleteBatchExpense('${escapeHtml(exp.id || idx)}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function saveBatchExpense(e) {
  if (e) e.preventDefault();
  const item = _expActiveFgId ? DB.findById('exp_finished_goods', _expActiveFgId) : null;
  if (!item) return;

  const title    = sanitizeInput(document.getElementById('expTitle')?.value  || '');
  const amount   = parseFloat(document.getElementById('expAmount')?.value)   || 0;
  const notes    = sanitizeInput(document.getElementById('expNotes')?.value  || '');
  const editId   = document.getElementById('expEditingId')?.value            || '';

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
    /* Update existing */
    const idx = expenses.findIndex(x => (x.id || '') === editId);
    if (idx !== -1) {
      expenses[idx] = {
        ...expenses[idx],
        title,
        amount,
        notes,
        updatedAt: new Date().toISOString()
      };
      showToast('Expense updated successfully.', 'success');
    }
  } else {
    /* Add new */
    expenses.push({
      id: generateId(),
      title,
      amount,
      notes,
      date: new Date().toISOString()
    });
    showToast('Expense added successfully.', 'success');
  }

  /* Save to DB */
  DB.update('exp_finished_goods', _expActiveFgId, { expenses });

  cancelExpenseEdit();
  refreshExpenseModalUI();
  renderFgTable();
}

function editBatchExpense(expId) {
  const item = _expActiveFgId ? DB.findById('exp_finished_goods', _expActiveFgId) : null;
  if (!item) return;

  const expenses = Array.isArray(item.expenses) ? item.expenses : [];
  const exp = expenses.find(x => (x.id || '') === expId) || expenses[parseInt(expId)];
  if (!exp) return;

  document.getElementById('expEditingId').value = exp.id || expId;
  document.getElementById('expTitle').value     = exp.title || '';
  document.getElementById('expAmount').value    = exp.amount || '';
  document.getElementById('expNotes').value     = exp.notes || '';

  const titleEl = document.getElementById('expFormTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Edit Expense';

  const subBtn = document.getElementById('expSubmitBtn');
  if (subBtn) subBtn.innerHTML = '<i class="fas fa-save"></i> Update Expense';

  const cancelBtn = document.getElementById('expCancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';
}

function cancelExpenseEdit() {
  document.getElementById('fgExpenseForm')?.reset();
  const editIdEl = document.getElementById('expEditingId');
  if (editIdEl) editIdEl.value = '';

  const titleEl = document.getElementById('expFormTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Expense';

  const subBtn = document.getElementById('expSubmitBtn');
  if (subBtn) subBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';

  const cancelBtn = document.getElementById('expCancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function deleteBatchExpense(expId) {
  const item = _expActiveFgId ? DB.findById('exp_finished_goods', _expActiveFgId) : null;
  if (!item) return;

  showConfirm(
    'Are you sure you want to delete this expense record?',
    () => {
      let expenses = Array.isArray(item.expenses) ? [...item.expenses] : [];
      expenses = expenses.filter((x, idx) => (x.id || String(idx)) !== String(expId));

      DB.update('exp_finished_goods', _expActiveFgId, { expenses });
      showToast('Expense removed.', 'success');

      cancelExpenseEdit();
      refreshExpenseModalUI();
      renderFgTable();
    },
    'Delete Expense'
  );
}

