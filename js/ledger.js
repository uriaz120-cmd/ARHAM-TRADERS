/* =============================================
   ARHAM TRADERS — SUPPLIER LEDGER
   js/ledger.js  |  Phase 8
   ============================================= */

/* ---- State ---- */
let _selectedSupplierId = null;
let _supplierSearch     = '';
const AVATAR_COLORS = [
  '#2a9d8f','#264653','#e07b39','#b8960a','#6c757d',
  '#3a86ff','#8338ec','#e63946','#2ec4b6','#f4a261'
];

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  renderSupplierList();
  bindSupplierSearch();

  /* Auto-select first supplier if any */
  const suppliers = DB.get('suppliers');
  if (suppliers.length) selectSupplier(suppliers[0].id);
});

/* =============================================
   SUPPLIER LIST (left panel)
   ============================================= */
function renderSupplierList() {
  const suppliers = DB.get('suppliers');
  const list      = document.getElementById('supplierListItems');
  if (!list) return;

  const q = _supplierSearch.toLowerCase();
  const filtered = q
    ? suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q))
    : suppliers;

  if (!filtered.length) {
    list.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">
      ${q ? 'No suppliers match your search.' : 'No suppliers added yet.'}
    </div>`;
    return;
  }

  list.innerHTML = filtered.map((s, i) => {
    const ledger  = Stats.getSupplierLedger(s.id);
    const balance = ledger.remainingFinished + ledger.warehouseBalance;
    const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const color    = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const isActive = s.id === _selectedSupplierId;

    return `
      <div class="slp-item ${isActive ? 'active' : ''}" onclick="selectSupplier('${escapeHtml(s.id)}')">
        <div class="slp-avatar" style="background:${color};">${escapeHtml(initials)}</div>
        <div class="slp-info">
          <div class="slp-name">${escapeHtml(s.name)}</div>
          <div class="slp-city">${escapeHtml(s.city || 'No city')}</div>
        </div>
        <span class="slp-bal ${balance > 0 ? 'has-bal' : 'zero-bal'}">
          ${formatKG(balance)} KG
        </span>
      </div>`;
  }).join('');
}

function bindSupplierSearch() {
  document.getElementById('supplierSearch')?.addEventListener('input', e => {
    _supplierSearch = e.target.value;
    renderSupplierList();
  });
}

/* =============================================
   SELECT SUPPLIER → LOAD LEDGER
   ============================================= */
function selectSupplier(id) {
  _selectedSupplierId = id;
  renderSupplierList();      /* re-render to update active state */
  renderLedgerDetail(id);
}

/* =============================================
   LEDGER DETAIL (right panel)
   ============================================= */
function renderLedgerDetail(supplierId) {
  const panel = document.getElementById('ledgerDetailPanel');
  if (!panel) return;

  const supplier = DB.findById('suppliers', supplierId);
  if (!supplier) {
    panel.innerHTML = buildEmptyState('Supplier not found.');
    return;
  }

  const ledger = Stats.getSupplierLedger(supplierId);
  const suppliers = DB.get('suppliers');
  const idx       = suppliers.findIndex(s => s.id === supplierId);
  const color     = AVATAR_COLORS[idx >= 0 ? idx % AVATAR_COLORS.length : 0];
  const initials  = supplier.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const totalBalance = ledger.remainingFinished + ledger.warehouseBalance;

  panel.innerHTML = `
    <!-- Supplier header -->
    <div class="ledger-sup-header">
      <div class="lsh-avatar" style="background:${color};">${escapeHtml(initials)}</div>
      <div class="lsh-info">
        <h3>${escapeHtml(supplier.name)}</h3>
        <p>
          ${supplier.phone ? `<i class="fas fa-phone" style="margin-right:4px;"></i>${escapeHtml(supplier.phone)}` : ''}
          ${supplier.city  ? ` &nbsp;·&nbsp; <i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>${escapeHtml(supplier.city)}` : ''}
          ${supplier.cnic  ? ` &nbsp;·&nbsp; CNIC: ${escapeHtml(supplier.cnic)}` : ''}
        </p>
      </div>
      <div class="lsh-actions">
        <button class="lsh-btn" onclick="exportLedgerCSV('${escapeHtml(supplierId)}')">
          <i class="fas fa-file-csv"></i> Export
        </button>
        <button class="lsh-btn" onclick="printLedger()">
          <i class="fas fa-print"></i> Print
        </button>
      </div>
    </div>

    <!-- Flow summary cards -->
    <div class="ledger-flow">
      <div class="lf-card lf-received">
        <div class="lf-icon"><i class="fas fa-arrow-down"></i></div>
        <div class="lf-value">${formatKG(ledger.totalReceived)}</div>
        <div class="lf-label">Received (KG)</div>
      </div>
      <div class="lf-card lf-warehouse">
        <div class="lf-icon"><i class="fas fa-warehouse"></i></div>
        <div class="lf-value">${formatKG(ledger.warehouseBalance)}</div>
        <div class="lf-label">In Warehouse</div>
      </div>
      <div class="lf-card lf-production">
        <div class="lf-icon"><i class="fas fa-industry"></i></div>
        <div class="lf-value">${formatKG(ledger.sentProduction)}</div>
        <div class="lf-label">In Production</div>
      </div>
      <div class="lf-card lf-finished">
        <div class="lf-icon"><i class="fas fa-layer-group"></i></div>
        <div class="lf-value">${formatKG(ledger.totalFinished)}</div>
        <div class="lf-label">Finished Goods</div>
      </div>
      <div class="lf-card lf-scrap">
        <div class="lf-icon"><i class="fas fa-recycle"></i></div>
        <div class="lf-value">${formatKG(ledger.totalScrap)}</div>
        <div class="lf-label">Scrap</div>
      </div>
      <div class="lf-card lf-delivered">
        <div class="lf-icon"><i class="fas fa-truck"></i></div>
        <div class="lf-value">${formatKG(ledger.totalDelivered)}</div>
        <div class="lf-label">Delivered</div>
      </div>
    </div>

    <!-- Balance box -->
    <div class="ledger-balance-box">
      <div class="lbb-item">
        <div class="lbb-value" style="color:var(--teal);">${formatKG(totalBalance)} KG</div>
        <div class="lbb-label">Total Outstanding Balance</div>
      </div>
      <div class="lbb-divider"></div>
      <div class="lbb-item">
        <div class="lbb-value" style="color:var(--emerald);">${formatKG(ledger.remainingFinished)} KG</div>
        <div class="lbb-label">Ready for Delivery</div>
      </div>
      <div class="lbb-divider"></div>
      <div class="lbb-item">
        <div class="lbb-value" style="color:var(--mineral-blue);">${formatKG(ledger.warehouseBalance)} KG</div>
        <div class="lbb-label">In Warehouse / Processing</div>
      </div>
      <div class="lbb-divider"></div>
      <div class="lbb-item">
        <div class="lbb-value" style="color:var(--copper);">${formatKG(ledger.totalDelivered)} KG</div>
        <div class="lbb-label">Already Delivered</div>
      </div>
    </div>

    <!-- Transaction timeline -->
    <div class="timeline-section" id="ledgerTimeline">
      ${buildTimeline(supplierId)}
    </div>`;
}

/* =============================================
   TRANSACTION TIMELINE
   ============================================= */
function buildTimeline(supplierId) {
  /* Gather all events */
  const events = [];

  DB.filter('bookings', b => b.supplierId === supplierId).forEach(b => {
    events.push({
      type: 'booking', date: b.date || b.createdAt,
      label: 'Booking', ref: b.bookingNo,
      weight: Number(b.weight) || 0,
      desc: b.description || '',
      icon: 'fa-clipboard-list'
    });
  });

  DB.filter('production', p => p.supplierId === supplierId).forEach(p => {
    events.push({
      type: 'production', date: p.date,
      label: p.status === 'completed' ? 'Production Completed' : p.status === 'in_process' ? 'Production In Process' : 'Production Pending',
      ref: p.bookingNo,
      weight: Number(p.weight) || 0,
      desc: p.description || '',
      icon: 'fa-industry'
    });
  });

  DB.filter('finished_goods', f => f.supplierId === supplierId).forEach(f => {
    events.push({
      type: 'finished', date: f.date,
      label: 'Finished Goods',
      ref: f.bookingNo,
      weight: Number(f.finishedWeight) || 0,
      scrap: Number(f.scrapWeight) || 0,
      desc: f.notes || f.description || '',
      icon: 'fa-layer-group'
    });
  });

  DB.filter('deliveries', d => d.supplierId === supplierId).forEach(d => {
    events.push({
      type: 'delivery', date: d.date,
      label: 'Delivery',
      ref: d.deliveryNo,
      weight: Number(d.weight) || 0,
      desc: d.description || '',
      icon: 'fa-truck'
    });
  });

  if (!events.length) {
    return `
      <h4><i class="fas fa-history"></i> Transaction History</h4>
      <div class="tl-empty"><i class="fas fa-inbox" style="font-size:28px;margin-bottom:8px;display:block;"></i>No transactions yet for this supplier.</div>`;
  }

  /* Sort by date descending */
  events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const items = events.map(e => `
    <div class="tl-item tl-${e.type}">
      <div class="tl-dot"></div>
      <div class="tl-card">
        <div class="tl-header">
          <span class="tl-type"><i class="fas ${e.icon}" style="margin-right:5px;"></i>${escapeHtml(e.label)}</span>
          <span class="tl-date">${formatDateTime(e.date)}</span>
        </div>
        <div class="tl-body">
          <span class="tl-weight">${formatKG(e.weight)} KG</span>
          ${e.scrap ? ` &nbsp;·&nbsp; Scrap: ${formatKG(e.scrap)} KG` : ''}
          ${e.ref   ? ` &nbsp;·&nbsp; <span style="color:var(--text-muted);">Ref: ${escapeHtml(e.ref)}</span>` : ''}
          ${e.desc  ? `<br><small style="color:var(--text-muted);">${escapeHtml(e.desc)}</small>` : ''}
        </div>
      </div>
    </div>`).join('');

  return `
    <h4><i class="fas fa-history"></i> Transaction History (${events.length})</h4>
    <div class="timeline">${items}</div>`;
}

/* =============================================
   EMPTY STATE
   ============================================= */
function buildEmptyState(msg) {
  return `
    <div class="ledger-empty">
      <i class="fas fa-book-open"></i>
      <p>${escapeHtml(msg)}</p>
    </div>`;
}

/* =============================================
   EXPORT LEDGER CSV
   ============================================= */
function exportLedgerCSV(supplierId) {
  const supplier = DB.findById('suppliers', supplierId);
  if (!supplier) return;
  const ledger = Stats.getSupplierLedger(supplierId);

  const rows = [
    ['Supplier', escapeHtml(supplier.name)],
    ['Phone',   supplier.phone || ''],
    ['City',    supplier.city  || ''],
    ['CNIC',    supplier.cnic  || ''],
    [],
    ['Metric', 'Weight (KG)'],
    ['Total Received',      ledger.totalReceived],
    ['Sent to Production',  ledger.sentProduction],
    ['Finished Goods',      ledger.totalFinished],
    ['Scrap',               ledger.totalScrap],
    ['Total Delivered',     ledger.totalDelivered],
    ['In Warehouse',        ledger.warehouseBalance],
    ['Ready for Delivery',  ledger.remainingFinished],
    ['Total Balance',       ledger.remainingFinished + ledger.warehouseBalance],
    [],
    ['--- TRANSACTIONS ---'],
    ['Type','Ref No','Weight (KG)','Date','Description']
  ];

  /* Bookings */
  DB.filter('bookings', b => b.supplierId === supplierId).forEach(b => {
    rows.push(['Booking', b.bookingNo || '', Number(b.weight) || 0, b.date ? b.date.slice(0,10) : '', (b.description || '').replace(/,/g,';')]);
  });
  /* Productions */
  DB.filter('production', p => p.supplierId === supplierId).forEach(p => {
    rows.push([`Production (${p.status})`, p.bookingNo || '', Number(p.weight) || 0, p.date ? p.date.slice(0,10) : '', (p.description || '').replace(/,/g,';')]);
  });
  /* Finished goods */
  DB.filter('finished_goods', f => f.supplierId === supplierId).forEach(f => {
    rows.push(['Finished Goods', f.bookingNo || '', Number(f.finishedWeight) || 0, f.date ? f.date.slice(0,10) : '', `Scrap: ${Number(f.scrapWeight)||0} KG`]);
  });
  /* Deliveries */
  DB.filter('deliveries', d => d.supplierId === supplierId).forEach(d => {
    rows.push(['Delivery', d.deliveryNo || '', Number(d.weight) || 0, d.date ? d.date.slice(0,10) : '', (d.description || '').replace(/,/g,';')]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ledger-${(supplier.name || 'supplier').replace(/\s+/g,'-')}-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Ledger exported as CSV.', 'success');
}

/* =============================================
   PRINT LEDGER
   ============================================= */
function printLedger() {
  printElement('ledgerDetailPanel');
}
