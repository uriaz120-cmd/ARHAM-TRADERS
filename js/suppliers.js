/* =============================================
   ARHAM TRADERS — SUPPLIER MANAGEMENT
   js/suppliers.js  |  Phase 2
   ============================================= */

/* ---- State ---- */
let _editingId  = null;   // null = new, string = editing
let _filterText = '';

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  renderSuppliers();
  bindForm();
  bindSearch();
  updateSupplierStats();
});

/* =============================================
   RENDER
   ============================================= */
function renderSuppliers() {
  let suppliers = DB.get('suppliers');

  /* Apply search filter */
  if (_filterText.trim()) {
    const q = _filterText.toLowerCase();
    suppliers = suppliers.filter(s =>
      (s.name    || '').toLowerCase().includes(q) ||
      (s.phone   || '').toLowerCase().includes(q) ||
      (s.cnic    || '').toLowerCase().includes(q) ||
      (s.ntn     || '').toLowerCase().includes(q) ||
      (s.city    || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q)
    );
  }

  const tbody     = document.getElementById('supplierTableBody');
  const cardsList = document.getElementById('supplierCards');
  const countEl   = document.getElementById('resultCount');

  if (countEl) countEl.textContent = `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`;

  /* Empty state */
  if (!suppliers.length) {
    const html = `
      <div class="empty-state" style="padding:48px 24px;">
        <i class="fas fa-users"></i>
        <p>${_filterText ? 'No suppliers match your search.' : 'No suppliers added yet. Click "+ Add Supplier" to start.'}</p>
      </div>`;
    if (tbody)     tbody.innerHTML     = `<tr><td colspan="7">${html}</td></tr>`;
    if (cardsList) cardsList.innerHTML = html;
    return;
  }

  /* Table rows (desktop) */
  if (tbody) {
    tbody.innerHTML = suppliers.map((s, i) => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="sup-avatar" style="background:${avatarColor(i)};">
              ${escapeHtml(initials(s.name))}
            </div>
            <div>
              <div style="font-weight:700;font-size:13.5px;">${escapeHtml(s.name)}</div>
              ${s.city ? `<div style="font-size:11px;color:var(--text-muted);">${escapeHtml(s.city)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${escapeHtml(s.cnic  || '—')}</td>
        <td>${escapeHtml(s.phone || '—')}</td>
        <td>${escapeHtml(s.ntn   || '—')}</td>
        <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.address || '—')}</td>
        <td>${formatDate(s.createdAt)}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-secondary btn-sm btn-icon" title="View Ledger"
              onclick="window.location.href='ledger.html?supplier=${encodeURIComponent(s.id)}'">
              <i class="fas fa-book"></i>
            </button>
            <button class="btn btn-secondary btn-sm btn-icon" title="Edit"
              onclick="editSupplier('${escapeHtml(s.id)}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-danger btn-sm btn-icon" title="Delete"
              onclick="deleteSupplier('${escapeHtml(s.id)}','${escapeHtml(s.name)}')">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  /* Mobile Cards */
  if (cardsList) {
    cardsList.innerHTML = suppliers.map((s, i) => `
      <div class="supplier-card">
        <div class="sc-header">
          <div class="sup-avatar" style="background:${avatarColor(i)};width:44px;height:44px;font-size:16px;">
            ${escapeHtml(initials(s.name))}
          </div>
          <div class="sc-name-block">
            <div class="sc-name">${escapeHtml(s.name)}</div>
            ${s.city ? `<div class="sc-city"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(s.city)}</div>` : ''}
          </div>
          <span class="badge badge-teal">Active</span>
        </div>
        <div class="sc-details">
          ${s.cnic  ? `<div class="sc-detail-item"><i class="fas fa-id-card"></i><span>${escapeHtml(s.cnic)}</span></div>` : ''}
          ${s.phone ? `<div class="sc-detail-item"><i class="fas fa-phone"></i><span>${escapeHtml(s.phone)}</span></div>` : ''}
          ${s.ntn   ? `<div class="sc-detail-item"><i class="fas fa-file-invoice"></i><span>NTN: ${escapeHtml(s.ntn)}</span></div>` : ''}
          ${s.address ? `<div class="sc-detail-item"><i class="fas fa-map"></i><span>${escapeHtml(s.address)}</span></div>` : ''}
        </div>
        <div class="sc-actions">
          <button class="btn btn-secondary btn-sm" onclick="window.location.href='ledger.html?supplier=${encodeURIComponent(s.id)}'">
            <i class="fas fa-book"></i> Ledger
          </button>
          <button class="btn btn-secondary btn-sm" onclick="editSupplier('${escapeHtml(s.id)}')">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${escapeHtml(s.id)}','${escapeHtml(s.name)}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>`).join('');
  }
}

/* =============================================
   FORM BINDING
   ============================================= */
function bindForm() {
  const form = document.getElementById('supplierForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    saveSupplier();
  });

  /* CNIC auto-format: 00000-0000000-0 */
  const cnicInput = document.getElementById('fCnic');
  if (cnicInput) {
    cnicInput.addEventListener('input', () => {
      let val = cnicInput.value.replace(/[^0-9]/g, '');
      if (val.length > 5  && val.length <= 12) val = val.slice(0,5) + '-' + val.slice(5);
      if (val.length > 13) val = val.slice(0,13) + '-' + val.slice(13,14);
      cnicInput.value = val.slice(0, 15);
    });
  }

  /* Phone auto-format */
  const phoneInput = document.getElementById('fPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      let val = phoneInput.value.replace(/[^0-9+\-\s]/g, '');
      phoneInput.value = val.slice(0, 15);
    });
  }
}

/* =============================================
   SAVE (Add or Update)
   ============================================= */
function saveSupplier() {
  const name    = sanitizeInput(document.getElementById('fName')?.value    || '');
  const cnic    = sanitizeInput(document.getElementById('fCnic')?.value    || '');
  const phone   = sanitizeInput(document.getElementById('fPhone')?.value   || '');
  const ntn     = sanitizeInput(document.getElementById('fNtn')?.value     || '');
  const city    = sanitizeInput(document.getElementById('fCity')?.value    || '');
  const address = sanitizeInput(document.getElementById('fAddress')?.value || '');

  /* Validation */
  if (!name.trim()) {
    showToast('Supplier name is required.', 'error');
    document.getElementById('fName')?.focus();
    return;
  }

  /* Check duplicate name (excluding self on edit) */
  const existing = DB.filter('suppliers', s =>
    s.name.trim().toLowerCase() === name.trim().toLowerCase() && s.id !== _editingId
  );
  if (existing.length) {
    showToast('A supplier with this name already exists.', 'warning');
    return;
  }

  const payload = { name, cnic, phone, ntn, city, address };

  if (_editingId) {
    DB.update('suppliers', _editingId, payload);
    showToast('Supplier updated successfully.', 'success');
  } else {
    DB.add('suppliers', payload);
    showToast('Supplier added successfully.', 'success');
  }

  closeModal('supplierModal');
  resetForm();
  renderSuppliers();
  updateSupplierStats();
}

/* =============================================
   EDIT
   ============================================= */
function editSupplier(id) {
  const s = DB.findById('suppliers', id);
  if (!s) return;

  _editingId = id;

  /* Fill form */
  document.getElementById('fName').value    = s.name    || '';
  document.getElementById('fCnic').value    = s.cnic    || '';
  document.getElementById('fPhone').value   = s.phone   || '';
  document.getElementById('fNtn').value     = s.ntn     || '';
  document.getElementById('fCity').value    = s.city    || '';
  document.getElementById('fAddress').value = s.address || '';

  /* Update modal title */
  const title = document.getElementById('modalTitle');
  if (title) title.textContent = 'Edit Supplier';

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Supplier';

  openModal('supplierModal');
}

/* =============================================
   DELETE
   ============================================= */
function deleteSupplier(id, name) {
  showConfirm(
    `Delete supplier "${name}"?\n\nThis will NOT delete their booking history, but they will be removed from the supplier list.`,
    () => {
      DB.remove('suppliers', id);
      showToast(`"${name}" has been deleted.`, 'success');
      renderSuppliers();
      updateSupplierStats();
    },
    'Delete Supplier'
  );
}

/* =============================================
   SEARCH
   ============================================= */
function bindSearch() {
  const inp = document.getElementById('searchInput');
  if (!inp) return;
  inp.addEventListener('input', () => {
    _filterText = inp.value;
    renderSuppliers();
  });
}

/* =============================================
   OPEN ADD MODAL
   ============================================= */
function openAddModal() {
  resetForm();
  _editingId = null;

  const title = document.getElementById('modalTitle');
  if (title) title.textContent = 'Add New Supplier';

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-plus"></i> Add Supplier';

  openModal('supplierModal');
  setTimeout(() => document.getElementById('fName')?.focus(), 100);
}

/* =============================================
   RESET FORM
   ============================================= */
function resetForm() {
  document.getElementById('supplierForm')?.reset();
  _editingId = null;
}

/* =============================================
   STATS
   ============================================= */
function updateSupplierStats() {
  const total = DB.count('suppliers');
  const el = document.getElementById('totalSupplierCount');
  if (el) el.textContent = total;

  const todayEl = document.getElementById('todayAdded');
  if (todayEl) {
    const count = DB.filter('suppliers', s => s.createdAt && s.createdAt.startsWith(today())).length;
    todayEl.textContent = count;
  }

  /* Update sidebar badge count */
  const badge = document.getElementById('todayBookingBadge');
  if (badge) {
    const c = Stats.getTodayBookings();
    badge.textContent = c;
    badge.style.display = c > 0 ? 'inline-flex' : 'none';
  }
}

/* =============================================
   HELPERS
   ============================================= */
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  '#2a9d8f','#e07b39','#264653','#e9c46a','#52b788',
  '#6c757d','#4a6fa5','#c77dff','#f4a261','#2d6a4f'
];
function avatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

/* =============================================
   EXPORT (CSV)
   ============================================= */
function exportSupplierCSV() {
  const suppliers = DB.get('suppliers');
  if (!suppliers.length) { showToast('No suppliers to export.', 'warning'); return; }

  const headers = ['Name','CNIC','Phone','NTN','City','Address','Added On'];
  const rows = suppliers.map(s => [
    s.name    || '',
    s.cnic    || '',
    s.phone   || '',
    s.ntn     || '',
    s.city    || '',
    s.address || '',
    formatDate(s.createdAt)
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `suppliers-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Suppliers exported as CSV.', 'success');
}
