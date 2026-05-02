/* =============================================
   ARHAM TRADERS — REPORTS MODULE
   js/reports.js  |  Phase 9
   ============================================= */

/* ---- State ---- */
let _reportType  = 'daily';       /* daily | supplier | production | stock */
let _reportFrom  = '';
let _reportTo    = '';
let _reportSupplier = '';

const AVATAR_COLORS = [
  '#2a9d8f','#264653','#e07b39','#b8960a','#6c757d',
  '#3a86ff','#8338ec','#e63946','#2ec4b6','#f4a261'
];

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  /* Default date range: last 30 days */
  const toDate   = today();
  const fromDate = (() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  })();
  _reportFrom = fromDate;
  _reportTo   = toDate;

  const fromEl = document.getElementById('reportFrom');
  const toEl   = document.getElementById('reportTo');
  if (fromEl) fromEl.value = fromDate;
  if (toEl)   toEl.value   = toDate;

  populateSupplierFilter();
  bindControls();
  renderReport();
});

/* =============================================
   POPULATE CONTROLS
   ============================================= */
function populateSupplierFilter() {
  const sel = document.getElementById('reportSupplierFilter');
  if (!sel) return;
  const suppliers = DB.get('suppliers');
  sel.innerHTML = '<option value="">All Suppliers</option>' +
    suppliers.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
}

/* =============================================
   BIND CONTROLS
   ============================================= */
function bindControls() {
  document.getElementById('reportFrom')?.addEventListener('change', e => { _reportFrom = e.target.value; renderReport(); });
  document.getElementById('reportTo')  ?.addEventListener('change', e => { _reportTo   = e.target.value; renderReport(); });
  document.getElementById('reportSupplierFilter')?.addEventListener('change', e => { _reportSupplier = e.target.value; renderReport(); });
}

function switchReport(type) {
  _reportType = type;
  document.querySelectorAll('.report-type-card').forEach(c => {
    c.classList.toggle('active', c.dataset.type === type);
  });

  /* Show/hide supplier filter based on type */
  const supWrap = document.getElementById('supplierFilterWrap');
  if (supWrap) supWrap.style.display = (type === 'supplier') ? '' : 'none';

  renderReport();
}

/* =============================================
   RENDER DISPATCHER
   ============================================= */
function renderReport() {
  const output = document.getElementById('reportOutputBody');
  const title  = document.getElementById('reportTitle');
  const meta   = document.getElementById('reportMeta');
  if (!output) return;

  const rangeLabel = `${_reportFrom} to ${_reportTo}`;
  if (meta) meta.textContent = `Period: ${rangeLabel}`;

  switch (_reportType) {
    case 'daily':      renderDailyReport(output, title);      break;
    case 'supplier':   renderSupplierReport(output, title);   break;
    case 'production': renderProductionReport(output, title); break;
    case 'stock':      renderStockReport(output, title);      break;
  }
}

/* =============================================
   DATE FILTER HELPER
   ============================================= */
function inRange(dateStr) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  if (_reportFrom && d < _reportFrom) return false;
  if (_reportTo   && d > _reportTo)   return false;
  return true;
}

/* =============================================
   DAILY REPORT
   ============================================= */
function renderDailyReport(output, titleEl) {
  if (titleEl) titleEl.textContent = 'Daily Activity Report';

  const bookings    = DB.get('bookings')   .filter(b => inRange(b.date));
  const deliveries  = DB.get('deliveries') .filter(d => inRange(d.date));
  const productions = DB.get('production') .filter(p => inRange(p.date));
  const fgCompleted = DB.get('finished_goods').filter(f => inRange(f.date));

  const totalBookWeight = bookings  .reduce((s, b) => s + (Number(b.weight) || 0), 0);
  const totalDelWeight  = deliveries.reduce((s, d) => s + (Number(d.weight) || 0), 0);
  const totalProdWeight = productions.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const totalFinished   = fgCompleted.reduce((s, f) => s + (Number(f.finishedWeight) || 0), 0);
  const totalScrap      = fgCompleted.reduce((s, f) => s + (Number(f.scrapWeight) || 0), 0);

  output.innerHTML = `
    <!-- KPIs -->
    <div class="report-kpi-row">
      <div class="report-kpi rk-teal">
        <div class="rk-value">${bookings.length}</div>
        <div class="rk-label">Bookings</div>
      </div>
      <div class="report-kpi rk-blue">
        <div class="rk-value">${formatKG(totalBookWeight)} KG</div>
        <div class="rk-label">Material Received</div>
      </div>
      <div class="report-kpi rk-sand">
        <div class="rk-value">${productions.length}</div>
        <div class="rk-label">Production Batches</div>
      </div>
      <div class="report-kpi rk-emerald">
        <div class="rk-value">${formatKG(totalFinished)} KG</div>
        <div class="rk-label">Finished Output</div>
      </div>
      <div class="report-kpi rk-stone">
        <div class="rk-value">${formatKG(totalScrap)} KG</div>
        <div class="rk-label">Scrap</div>
      </div>
      <div class="report-kpi rk-copper">
        <div class="rk-value">${formatKG(totalDelWeight)} KG</div>
        <div class="rk-label">Delivered</div>
      </div>
    </div>

    <!-- Bookings table -->
    <div class="report-section-heading"><i class="fas fa-clipboard-list"></i> Bookings (${bookings.length})</div>
    ${buildSimpleTable(
      ['Booking No','Supplier','Weight (KG)','Rate','Total Amount','Date'],
      bookings.map(b => [
        escapeHtml(b.bookingNo || '—'),
        escapeHtml(b.supplierName || '—'),
        formatKG(b.weight) + ' KG',
        b.rate ? `Rs. ${formatCurrency(b.rate)}` : '—',
        b.total ? `Rs. ${formatCurrency(b.total)}` : '—',
        formatDate(b.date)
      ]),
      'No bookings in this period.'
    )}

    <!-- Deliveries table -->
    <div class="report-section-heading"><i class="fas fa-truck"></i> Deliveries (${deliveries.length})</div>
    ${buildSimpleTable(
      ['Delivery No','Supplier','Weight (KG)','Ref No','Date'],
      deliveries.map(d => [
        escapeHtml(d.deliveryNo || '—'),
        escapeHtml(d.supplierName || '—'),
        formatKG(d.weight) + ' KG',
        escapeHtml(d.refNo || '—'),
        formatDate(d.date)
      ]),
      'No deliveries in this period.'
    )}

    <!-- Completed production -->
    <div class="report-section-heading"><i class="fas fa-industry"></i> Production Batches (${productions.length})</div>
    ${buildSimpleTable(
      ['Booking No','Supplier','Input (KG)','Status','Date'],
      productions.map(p => [
        escapeHtml(p.bookingNo || '—'),
        escapeHtml(p.supplierName || '—'),
        formatKG(p.weight) + ' KG',
        escapeHtml(p.status || '—'),
        formatDate(p.date)
      ]),
      'No production records in this period.'
    )}`;
}

/* =============================================
   SUPPLIER REPORT
   ============================================= */
function renderSupplierReport(output, titleEl) {
  if (titleEl) titleEl.textContent = 'Supplier-wise Summary Report';

  let suppliers = DB.get('suppliers');
  if (_reportSupplier) suppliers = suppliers.filter(s => s.id === _reportSupplier);

  if (!suppliers.length) {
    output.innerHTML = `<div class="empty-state" style="padding:50px;"><i class="fas fa-users"></i><p>No suppliers found.</p></div>`;
    return;
  }

  const rows = suppliers.map((s, i) => {
    const ledger  = Stats.getSupplierLedger(s.id);
    const color   = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const initials= s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const balance = ledger.remainingFinished + ledger.warehouseBalance;
    return { s, ledger, color, initials, balance };
  });

  /* KPI totals across all displayed suppliers */
  const totReceived  = rows.reduce((a, r) => a + r.ledger.totalReceived,    0);
  const totFinished  = rows.reduce((a, r) => a + r.ledger.totalFinished,    0);
  const totDelivered = rows.reduce((a, r) => a + r.ledger.totalDelivered,   0);
  const totBalance   = rows.reduce((a, r) => a + r.balance,                 0);

  output.innerHTML = `
    <div class="report-kpi-row">
      <div class="report-kpi rk-blue">
        <div class="rk-value">${suppliers.length}</div>
        <div class="rk-label">Suppliers</div>
      </div>
      <div class="report-kpi rk-teal">
        <div class="rk-value">${formatKG(totReceived)} KG</div>
        <div class="rk-label">Total Received</div>
      </div>
      <div class="report-kpi rk-emerald">
        <div class="rk-value">${formatKG(totFinished)} KG</div>
        <div class="rk-label">Total Finished</div>
      </div>
      <div class="report-kpi rk-copper">
        <div class="rk-value">${formatKG(totDelivered)} KG</div>
        <div class="rk-label">Total Delivered</div>
      </div>
      <div class="report-kpi rk-sand">
        <div class="rk-value">${formatKG(totBalance)} KG</div>
        <div class="rk-label">Outstanding Balance</div>
      </div>
    </div>

    <div class="report-section-heading"><i class="fas fa-users"></i> Per Supplier Breakdown</div>
    <div class="supplier-report-grid">
      ${rows.map(r => `
        <div class="src-card">
          <div class="src-name">
            <span style="width:28px;height:28px;border-radius:50%;background:${r.color};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">${escapeHtml(r.initials)}</span>
            ${escapeHtml(r.s.name)}
          </div>
          <div class="src-row"><span>Received</span><span class="src-row-value">${formatKG(r.ledger.totalReceived)} KG</span></div>
          <div class="src-row"><span>In Warehouse</span><span class="src-row-value">${formatKG(r.ledger.warehouseBalance)} KG</span></div>
          <div class="src-row"><span>In Production</span><span class="src-row-value">${formatKG(r.ledger.sentProduction)} KG</span></div>
          <div class="src-row"><span>Finished</span><span class="src-row-value">${formatKG(r.ledger.totalFinished)} KG</span></div>
          <div class="src-row"><span>Scrap</span><span class="src-row-value">${formatKG(r.ledger.totalScrap)} KG</span></div>
          <div class="src-row"><span>Delivered</span><span class="src-row-value">${formatKG(r.ledger.totalDelivered)} KG</span></div>
          <div class="src-balance">Balance: ${formatKG(r.balance)} KG</div>
        </div>`).join('')}
    </div>

    ${buildSimpleTable(
      ['Supplier','Received','Warehouse','Production','Finished','Scrap','Delivered','Balance'],
      rows.map(r => [
        escapeHtml(r.s.name),
        formatKG(r.ledger.totalReceived)    + ' KG',
        formatKG(r.ledger.warehouseBalance) + ' KG',
        formatKG(r.ledger.sentProduction)   + ' KG',
        formatKG(r.ledger.totalFinished)    + ' KG',
        formatKG(r.ledger.totalScrap)       + ' KG',
        formatKG(r.ledger.totalDelivered)   + ' KG',
        formatKG(r.balance)                 + ' KG'
      ]),
      ''
    )}`;
}

/* =============================================
   PRODUCTION REPORT
   ============================================= */
function renderProductionReport(output, titleEl) {
  if (titleEl) titleEl.textContent = 'Production Report';

  const all         = DB.get('production');
  const inRange_    = all.filter(p => inRange(p.date));
  const completed   = inRange_.filter(p => p.status === 'completed');
  const pending     = inRange_.filter(p => p.status === 'pending');
  const inProcess   = inRange_.filter(p => p.status === 'in_process');

  const totalInput    = inRange_.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const totalFinished = completed.reduce((s, p) => s + (Number(p.finishedWeight) || 0), 0);
  const totalScrap    = completed.reduce((s, p) => s + (Number(p.scrapWeight)    || 0), 0);
  const yieldPct      = totalInput > 0 ? ((totalFinished / totalInput) * 100).toFixed(1) : '0';

  output.innerHTML = `
    <div class="report-kpi-row">
      <div class="report-kpi rk-teal">
        <div class="rk-value">${inRange_.length}</div>
        <div class="rk-label">Total Batches</div>
      </div>
      <div class="report-kpi rk-sand">
        <div class="rk-value">${pending.length}</div>
        <div class="rk-label">Pending</div>
      </div>
      <div class="report-kpi rk-blue">
        <div class="rk-value">${inProcess.length}</div>
        <div class="rk-label">In Process</div>
      </div>
      <div class="report-kpi rk-emerald">
        <div class="rk-value">${completed.length}</div>
        <div class="rk-label">Completed</div>
      </div>
      <div class="report-kpi rk-teal">
        <div class="rk-value">${formatKG(totalInput)} KG</div>
        <div class="rk-label">Total Input</div>
      </div>
      <div class="report-kpi rk-emerald">
        <div class="rk-value">${formatKG(totalFinished)} KG</div>
        <div class="rk-label">Finished Output</div>
      </div>
      <div class="report-kpi rk-stone">
        <div class="rk-value">${formatKG(totalScrap)} KG</div>
        <div class="rk-label">Scrap</div>
      </div>
      <div class="report-kpi rk-copper">
        <div class="rk-value">${yieldPct}%</div>
        <div class="rk-label">Yield Rate</div>
      </div>
    </div>

    <div class="report-section-heading"><i class="fas fa-industry"></i> Production Records (${inRange_.length})</div>
    ${buildSimpleTable(
      ['Booking No','Supplier','Input (KG)','Finished (KG)','Scrap (KG)','Yield %','Status','Date'],
      inRange_.map(p => {
        const fin   = Number(p.finishedWeight) || 0;
        const scr   = Number(p.scrapWeight)    || 0;
        const inp   = Number(p.weight)         || 0;
        const yld   = inp > 0 ? ((fin / inp) * 100).toFixed(1) + '%' : '—';
        return [
          escapeHtml(p.bookingNo    || '—'),
          escapeHtml(p.supplierName || '—'),
          formatKG(inp)  + ' KG',
          p.status === 'completed' ? formatKG(fin) + ' KG' : '—',
          p.status === 'completed' ? formatKG(scr) + ' KG' : '—',
          p.status === 'completed' ? yld : '—',
          escapeHtml(p.status || '—'),
          formatDate(p.date)
        ];
      }),
      'No production records in this period.'
    )}`;
}

/* =============================================
   STOCK REPORT
   ============================================= */
function renderStockReport(output, titleEl) {
  if (titleEl) titleEl.textContent = 'Stock Overview Report';

  /* Current state (not date-filtered — shows live inventory) */
  const warehouseItems = DB.get('warehouse');
  const fgItems        = DB.get('finished_goods');
  const prodPending    = DB.filter('production', p => p.status !== 'completed');

  const totalWarehouse  = warehouseItems.reduce((s, i) => s + (Number(i.remainingWeight) || 0), 0);
  const totalProduction = prodPending.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const totalFinished   = fgItems.reduce((s, f) => s + (Number(f.remainingWeight) || 0), 0);
  const totalScrap      = fgItems.reduce((s, f) => s + (Number(f.scrapWeight) || 0), 0);
  const grandTotal      = totalWarehouse + totalProduction + totalFinished;

  output.innerHTML = `
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
      <i class="fas fa-info-circle"></i> Stock report shows <strong>current live inventory</strong> — not filtered by date.
    </p>

    <div class="report-kpi-row">
      <div class="report-kpi rk-teal">
        <div class="rk-value">${formatKG(grandTotal)} KG</div>
        <div class="rk-label">Total Stock</div>
      </div>
      <div class="report-kpi rk-blue">
        <div class="rk-value">${formatKG(totalWarehouse)} KG</div>
        <div class="rk-label">In Warehouse</div>
      </div>
      <div class="report-kpi rk-sand">
        <div class="rk-value">${formatKG(totalProduction)} KG</div>
        <div class="rk-label">In Production</div>
      </div>
      <div class="report-kpi rk-emerald">
        <div class="rk-value">${formatKG(totalFinished)} KG</div>
        <div class="rk-label">Finished Goods</div>
      </div>
      <div class="report-kpi rk-stone">
        <div class="rk-value">${formatKG(totalScrap)} KG</div>
        <div class="rk-label">Total Scrap</div>
      </div>
    </div>

    <div class="report-section-heading"><i class="fas fa-warehouse"></i> Warehouse Stock (${warehouseItems.length} entries)</div>
    ${buildSimpleTable(
      ['Booking No','Supplier','Total (KG)','Remaining (KG)','Status'],
      warehouseItems.filter(i => (Number(i.remainingWeight) || 0) > 0).map(i => [
        escapeHtml(i.bookingNo    || '—'),
        escapeHtml(i.supplierName || '—'),
        formatKG(i.totalWeight)     + ' KG',
        formatKG(i.remainingWeight) + ' KG',
        escapeHtml(i.status || '—')
      ]),
      'No warehouse stock remaining.'
    )}

    <div class="report-section-heading"><i class="fas fa-layer-group"></i> Finished Goods Available (${fgItems.filter(f => (Number(f.remainingWeight)||0)>0).length} entries)</div>
    ${buildSimpleTable(
      ['Booking No','Supplier','Finished (KG)','Remaining (KG)','Scrap (KG)'],
      fgItems.filter(f => (Number(f.remainingWeight)||0) > 0).map(f => [
        escapeHtml(f.bookingNo    || '—'),
        escapeHtml(f.supplierName || '—'),
        formatKG(f.finishedWeight)  + ' KG',
        formatKG(f.remainingWeight) + ' KG',
        formatKG(f.scrapWeight)     + ' KG'
      ]),
      'No finished goods available.'
    )}`;
}

/* =============================================
   TABLE BUILDER HELPER
   ============================================= */
function buildSimpleTable(headers, rows, emptyMsg) {
  if (!rows.length && emptyMsg) {
    return `<div class="empty-state" style="padding:28px;"><i class="fas fa-inbox"></i><p>${escapeHtml(emptyMsg)}</p></div>`;
  }
  if (!rows.length) return '';

  return `
    <div class="table-wrapper" style="margin-bottom:20px;">
      <table class="data-table">
        <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/* =============================================
   EXPORT CSV
   ============================================= */
function exportReportCSV() {
  const output = document.getElementById('reportOutputBody');
  if (!output) return;

  /* Build CSV from whichever report is active */
  let rows = [];
  const title = document.getElementById('reportTitle')?.textContent || 'Report';
  rows.push([title]);
  rows.push([`Period: ${_reportFrom} to ${_reportTo}`]);
  rows.push([]);

  switch (_reportType) {
    case 'daily': {
      const bookings   = DB.get('bookings')   .filter(b => inRange(b.date));
      const deliveries = DB.get('deliveries') .filter(d => inRange(d.date));
      rows.push(['--- BOOKINGS ---']);
      rows.push(['Booking No','Supplier','Weight (KG)','Rate','Total','Date']);
      bookings.forEach(b => rows.push([b.bookingNo||'',b.supplierName||'',Number(b.weight)||0,Number(b.rate)||0,Number(b.total)||0,(b.date||'').slice(0,10)]));
      rows.push([]);
      rows.push(['--- DELIVERIES ---']);
      rows.push(['Delivery No','Supplier','Weight (KG)','Ref No','Date']);
      deliveries.forEach(d => rows.push([d.deliveryNo||'',d.supplierName||'',Number(d.weight)||0,d.refNo||'',(d.date||'').slice(0,10)]));
      break;
    }
    case 'supplier': {
      rows.push(['Supplier','Received','Warehouse','In Production','Finished','Scrap','Delivered','Balance']);
      let suppliers = DB.get('suppliers');
      if (_reportSupplier) suppliers = suppliers.filter(s => s.id === _reportSupplier);
      suppliers.forEach(s => {
        const l = Stats.getSupplierLedger(s.id);
        rows.push([s.name,l.totalReceived,l.warehouseBalance,l.sentProduction,l.totalFinished,l.totalScrap,l.totalDelivered,(l.remainingFinished+l.warehouseBalance)]);
      });
      break;
    }
    case 'production': {
      rows.push(['Booking No','Supplier','Input (KG)','Finished (KG)','Scrap (KG)','Yield %','Status','Date']);
      DB.get('production').filter(p => inRange(p.date)).forEach(p => {
        const fin = Number(p.finishedWeight)||0;
        const inp = Number(p.weight)||0;
        const yld = inp > 0 ? ((fin/inp)*100).toFixed(1)+'%' : '—';
        rows.push([p.bookingNo||'',p.supplierName||'',inp,fin,Number(p.scrapWeight)||0,yld,p.status||'',(p.date||'').slice(0,10)]);
      });
      break;
    }
    case 'stock': {
      rows.push(['--- WAREHOUSE ---']);
      rows.push(['Booking No','Supplier','Total (KG)','Remaining (KG)','Status']);
      DB.get('warehouse').filter(i => (Number(i.remainingWeight)||0)>0).forEach(i => {
        rows.push([i.bookingNo||'',i.supplierName||'',Number(i.totalWeight)||0,Number(i.remainingWeight)||0,i.status||'']);
      });
      rows.push([]);
      rows.push(['--- FINISHED GOODS ---']);
      rows.push(['Booking No','Supplier','Finished (KG)','Remaining (KG)','Scrap (KG)']);
      DB.get('finished_goods').filter(f => (Number(f.remainingWeight)||0)>0).forEach(f => {
        rows.push([f.bookingNo||'',f.supplierName||'',Number(f.finishedWeight)||0,Number(f.remainingWeight)||0,Number(f.scrapWeight)||0]);
      });
      break;
    }
  }

  const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `arham-${_reportType}-report-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Report exported as CSV.', 'success');
}

/* =============================================
   PRINT REPORT
   ============================================= */
function printReport() {
  printElement('reportOutput');
}
