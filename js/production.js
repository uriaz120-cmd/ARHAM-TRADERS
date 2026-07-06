/* =============================================
   ARHAM TRADERS — PRODUCTION MODULE
   js/production.js  |  Phase 5
   ============================================= */

/* ---- State ---- */
let _filterText     = '';
let _filterSupplier = '';
let _filterStatus   = '';
let _completingId   = null;   /* production record being completed */

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  populateFilterDropdowns();
  bindFilters();
  renderProductionTable();
  updatePipelineStats();
  bindCompleteModal();
});

/* =============================================
   FILTER DROPDOWNS
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
    _filterText = e.target.value; renderProductionTable();
  });
  document.getElementById('filterSupplier')?.addEventListener('change', e => {
    _filterSupplier = e.target.value; renderProductionTable();
  });
  document.getElementById('filterStatus')?.addEventListener('change', e => {
    _filterStatus = e.target.value; renderProductionTable();
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    _filterText = _filterSupplier = _filterStatus = '';
    ['searchInput','filterSupplier','filterStatus']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderProductionTable();
  });
}

function applyFilters(items) {
  return items.filter(p => {
    if (_filterSupplier && p.supplierId !== _filterSupplier) return false;
    if (_filterStatus   && p.status     !== _filterStatus)   return false;
    if (_filterText) {
      const q = _filterText.toLowerCase();
      if (!(p.bookingNo    || '').toLowerCase().includes(q) &&
          !(p.supplierName || '').toLowerCase().includes(q) &&
          !(p.description  || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* =============================================
   RENDER TABLE
   ============================================= */
function renderProductionTable() {
  const all      = DB.get('production').reverse();
  const filtered = applyFilters(all);
  const tbody    = document.getElementById('productionTableBody');
  const countEl  = document.getElementById('productionCount');

  if (countEl) countEl.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="8">
        <div class="empty-state" style="padding:40px;">
          <i class="fas fa-industry"></i>
          <p>${_filterText || _filterSupplier || _filterStatus
              ? 'No records match your filters.'
              : 'No production records yet. Send material from Warehouse to start.'}</p>
          ${!_filterText && !_filterSupplier && !_filterStatus
              ? '<a href="warehouse.html" class="btn btn-primary btn-sm" style="margin-top:10px;"><i class="fas fa-warehouse"></i> Go to Warehouse</a>'
              : ''}
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const statusInfo = getStatusInfo(p.status);
    const actionBtns = buildActionButtons(p);

    return `
      <tr>
        <td>
          <span style="font-weight:700;color:var(--teal);font-size:12.5px;">
            ${escapeHtml(p.bookingNo || '—')}
          </span>
        </td>
        <td>${escapeHtml(p.supplierName || '—')}</td>
        <td style="font-weight:700;">
          ${formatKG(p.weight)} <small style="color:var(--text-muted);font-weight:400;">TON</small>
        </td>
        <td>${escapeHtml(p.description || '—')}</td>
        <td>${formatDateTime(p.date)}</td>
        <td>
          <span class="prod-status ${statusInfo.cls}">
            <span class="prod-status-dot"></span>
            ${statusInfo.label}
          </span>
        </td>
        <td>${p.completedAt ? formatDateTime(p.completedAt) : '<span style="color:var(--text-muted);">—</span>'}</td>
        <td>
          <div class="status-btn-group">
            ${actionBtns}
          </div>
        </td>
      </tr>`;
  }).join('');

  /* Footer */
  const tfoot = document.getElementById('productionTfoot');
  if (tfoot) {
    const totalKg   = filtered.reduce((s, p) => s + (Number(p.weight) || 0), 0);
    const pending   = filtered.filter(p => p.status === 'pending').length;
    const inProcess = filtered.filter(p => p.status === 'in_process').length;
    const completed = filtered.filter(p => p.status === 'completed').length;
    tfoot.innerHTML = `
      <tr style="background:var(--color-surface-2);">
        <td colspan="2" style="font-weight:700;font-size:12px;color:var(--text-muted);">
          TOTAL (${filtered.length})
        </td>
        <td style="font-weight:800;">${formatKG(totalKg)} <small style="color:var(--text-muted);">TON</small></td>
        <td colspan="2"></td>
        <td style="font-size:11.5px;color:var(--text-muted);">
          <span style="color:#b8960a;">${pending} pending</span> &nbsp;·&nbsp;
          <span style="color:var(--teal);">${inProcess} processing</span> &nbsp;·&nbsp;
          <span style="color:var(--emerald);">${completed} done</span>
        </td>
        <td colspan="2"></td>
      </tr>`;
  }
}

/* =============================================
   STATUS INFO
   ============================================= */
function getStatusInfo(status) {
  switch (status) {
    case 'pending':    return { cls: 'pstatus-pending',    label: 'Pending' };
    case 'in_process': return { cls: 'pstatus-in_process', label: 'In Process' };
    case 'completed':  return { cls: 'pstatus-completed',  label: 'Completed' };
    default:           return { cls: 'pstatus-pending',    label: status || 'Pending' };
  }
}

/* =============================================
   ACTION BUTTONS PER ROW
   ============================================= */
function buildActionButtons(p) {
  const id = escapeHtml(p.id);
  if (p.status === 'pending') {
    return `
      <button class="btn-inprocess" onclick="changeStatus('${id}','in_process')" title="Start Processing">
        <i class="fas fa-play"></i> Start
      </button>
      <button class="btn btn-danger btn-sm btn-icon" title="Delete" onclick="deleteProduction('${id}','${escapeHtml(p.bookingNo || '')}')">
        <i class="fas fa-trash-alt"></i>
      </button>`;
  }
  if (p.status === 'in_process') {
    return `
      <button class="btn btn-primary btn-sm" onclick="openCompleteModal('${id}')" title="Mark Completed">
        <i class="fas fa-check-circle"></i> Complete
      </button>`;
  }
  /* completed */
  return `<span class="badge badge-emerald" style="font-size:11.5px;"><i class="fas fa-check"></i> Done</span>`;
}

/* =============================================
   STATUS CHANGE
   ============================================= */
function changeStatus(id, newStatus) {
  const p = DB.findById('production', id);
  if (!p) return;

  /* Guard: can only go forward */
  const order = { pending: 0, in_process: 1, completed: 2 };
  if (order[newStatus] <= order[p.status]) {
    showToast('Cannot go back to a previous status.', 'warning');
    return;
  }

  DB.update('production', id, {
    status: newStatus,
    startedAt: newStatus === 'in_process' ? new Date().toISOString() : p.startedAt
  });

  showToast(`Status updated to "${getStatusInfo(newStatus).label}".`, 'success');
  renderProductionTable();
  updatePipelineStats();
}

/* =============================================
   COMPLETE PRODUCTION MODAL
   ============================================= */
function openCompleteModal(id) {
  const p = DB.findById('production', id);
  if (!p) return;
  _completingId = id;

  const weight = Number(p.weight) || 0;

  /* Header info */
  const setEl = (eid, v) => { const el = document.getElementById(eid); if (el) el.textContent = v; };
  setEl('cpBookingNo',   p.bookingNo    || '—');
  setEl('cpSupplier',    p.supplierName || '—');
  setEl('cpInputWeight', formatKG(weight) + ' TON');

  /* Default: all finished, 0 scrap */
  const finInput  = document.getElementById('cpFinished');
  const scrapInput = document.getElementById('cpScrap');
  if (finInput)  finInput.value  = weight.toFixed(2);
  if (scrapInput) scrapInput.value = '0';

  updateOutputValidation();
  openModal('completeProductionModal');
  finInput?.focus();
}

function bindCompleteModal() {
  const finInput   = document.getElementById('cpFinished');
  const scrapInput = document.getElementById('cpScrap');
  if (!finInput || !scrapInput) return;

  /* When finished changes, auto-calc scrap */
  finInput.addEventListener('input', () => {
    const p = DB.findById('production', _completingId);
    if (!p) return;
    const total    = Number(p.weight) || 0;
    const finished = Math.min(parseFloat(finInput.value) || 0, total);
    const scrap    = Math.max(total - finished, 0);
    scrapInput.value = scrap.toFixed(2);
    updateOutputValidation();
  });

  /* When scrap changes, auto-calc finished */
  scrapInput.addEventListener('input', () => {
    const p = DB.findById('production', _completingId);
    if (!p) return;
    const total    = Number(p.weight) || 0;
    const scrap    = Math.min(parseFloat(scrapInput.value) || 0, total);
    const finished = Math.max(total - scrap, 0);
    finInput.value = finished.toFixed(2);
    updateOutputValidation();
  });
}

function updateOutputValidation() {
  const p = _completingId ? DB.findById('production', _completingId) : null;
  const totalInput = Number(p?.weight) || 0;
  const finished   = parseFloat(document.getElementById('cpFinished')?.value)  || 0;
  const scrap      = parseFloat(document.getElementById('cpScrap')?.value)     || 0;
  const outputSum  = finished + scrap;
  const diff       = Math.abs(outputSum - totalInput);
  const isValid    = diff < 0.01;

  const valEl = document.getElementById('outputValidation');
  if (!valEl) return;

  valEl.className = `output-validation ${isValid ? 'valid' : 'invalid'}`;
  valEl.innerHTML = `
    <span class="output-validation-label">
      <i class="fas ${isValid ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      Input Weight
    </span>
    <span class="output-validation-value">
      ${formatKG(outputSum)} / ${formatKG(totalInput)} TON
      ${isValid ? '<i class="fas fa-check" style="margin-left:6px;"></i>' : '— must match'}
    </span>`;
}

function confirmCompleteProduction() {
  const p = DB.findById('production', _completingId);
  if (!p) return;

  const finishedWeight = parseFloat(document.getElementById('cpFinished')?.value)  || 0;
  const scrapWeight    = parseFloat(document.getElementById('cpScrap')?.value)     || 0;
  const notes          = sanitizeInput(document.getElementById('cpNotes')?.value   || '');
  const inputWeight    = Number(p.weight) || 0;
  const diff           = Math.abs((finishedWeight + scrapWeight) - inputWeight);

  if (diff >= 0.01) {
    showToast(`Finished (${formatKG(finishedWeight)}) + Scrap (${formatKG(scrapWeight)}) must equal Input (${formatKG(inputWeight)}) TON.`, 'error');
    return;
  }
  if (finishedWeight < 0 || scrapWeight < 0) {
    showToast('Weights cannot be negative.', 'error');
    return;
  }

  /* Update production status */
  DB.update('production', _completingId, {
    status:          'completed',
    completedAt:     new Date().toISOString(),
    finishedWeight,
    scrapWeight,
    notes
  });

  /* Add to Finished Goods */
  DB.add('finished_goods', {
    productionId:    _completingId,
    bookingNo:       p.bookingNo,
    supplierId:      p.supplierId,
    supplierName:    p.supplierName,
    inputWeight,
    finishedWeight,
    scrapWeight,
    remainingWeight: finishedWeight,   /* available for delivery */
    description:     p.description || '',
    notes,
    date:            new Date().toISOString()
  });

  closeModal('completeProductionModal');
  showToast(`Production complete! ${formatKG(finishedWeight)} TON Finished + ${formatKG(scrapWeight)} TON Scrap recorded.`, 'success');
  renderProductionTable();
  updatePipelineStats();
}

/* =============================================
   DELETE PRODUCTION RECORD
   ============================================= */
function deleteProduction(id, bookingNo) {
  showConfirm(
    `Delete production record for booking "${bookingNo}"?\n\nThis will restore the warehouse stock for that item.`,
    () => {
      const p = DB.findById('production', id);
      if (!p) return;

      /* Restore warehouse remaining weight */
      const wItem = DB.findById('warehouse', p.warehouseId);
      if (wItem) {
        const newRemaining = (Number(wItem.remainingWeight) || 0) + (Number(p.weight) || 0);
        const newStatus    = newRemaining >= Number(wItem.totalWeight) ? 'in_stock' : 'partial';
        DB.update('warehouse', p.warehouseId, { remainingWeight: newRemaining, status: newStatus });
      }

      DB.remove('production', id);
      showToast('Production record deleted. Warehouse stock restored.', 'success');
      renderProductionTable();
      updatePipelineStats();
    },
    'Delete Record'
  );
}

/* =============================================
   PIPELINE STATS
   ============================================= */
function updatePipelineStats() {
  const all = DB.get('production');

  const pending   = all.filter(p => p.status === 'pending');
  const inProcess = all.filter(p => p.status === 'in_process');
  const completed = all.filter(p => p.status === 'completed');

  const sumKg = arr => arr.reduce((s, p) => s + (Number(p.weight) || 0), 0);

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('pipePendingCount',    pending.length);
  s('pipePendingKg',       formatKG(sumKg(pending)) + ' TON');
  s('pipeInProcessCount',  inProcess.length);
  s('pipeInProcessKg',     formatKG(sumKg(inProcess)) + ' TON');
  s('pipeCompletedCount',  completed.length);
  s('pipeCompletedKg',     formatKG(sumKg(completed)) + ' TON');
}
