/* =============================================
   ARHAM TRADERS — EXPORT PROFIT & LOSS MODULE
   js/export-profit-loss.js
   ============================================= */

/* ---- State ---- */
let _plSearch = '';
let _plFilterBuyer = '';
let _plFilterDateFrom = '';
let _plFilterDateTo = '';
let _activePlSaleId = null;
let _currentSinglePlSale = null;

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  populatePlDropdowns();
  bindPlFilterEvents();
  renderPlDashboard();
});

/* =============================================
   FINISHED GOODS COST HELPER (COGS)
   ============================================= */
function getFinishedGoodsCostDetails(bookingNo) {
  if (!bookingNo) {
    return { netAmount: 0, finishedWeight: 0, costPerTon: 0, baseAmount: 0, whExpenses: 0, extraExpenses: 0 };
  }

  const fg = DB.filter('exp_finished_goods', f => f.bookingNo === bookingNo)[0];
  if (!fg) {
    /* Fallback: check warehouse or booking directly */
    const wh = DB.filter('exp_warehouse', w => w.bookingNo === bookingNo)[0];
    let base = 0, whExp = 0;
    if (wh) {
      base = Number(wh.total) || 0;
      if (Array.isArray(wh.expenses)) {
        whExp = wh.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      }
    } else {
      const bk = DB.filter('exp_bookings', b => b.bookingNo === bookingNo)[0];
      if (bk && bk.total) base = Number(bk.total) || 0;
    }
    const net = base + whExp;
    return { netAmount: net, finishedWeight: 0, costPerTon: 0, baseAmount: base, whExpenses: whExp, extraExpenses: 0 };
  }

  /* 1. Base amount from exp_warehouse (Booking Amount + Warehouse Expenses) */
  let baseAmount = 0;
  let whExpenses = 0;
  const wh = DB.filter('exp_warehouse', w => w.bookingNo === bookingNo)[0];
  if (wh) {
    baseAmount = Number(wh.total) || 0;
    if (!baseAmount) {
      const bk = DB.filter('exp_bookings', b => b.bookingNo === bookingNo)[0];
      if (bk && bk.total) baseAmount = Number(bk.total) || 0;
    }
    if (Array.isArray(wh.expenses)) {
      whExpenses = wh.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    }
  } else {
    const bk = DB.filter('exp_bookings', b => b.bookingNo === bookingNo)[0];
    if (bk && bk.total) baseAmount = Number(bk.total) || 0;
  }

  const warehouseTotalAmount = baseAmount + whExpenses;
  const fgExpenses = Array.isArray(fg.expenses) ? fg.expenses : [];
  const extraExpenses = fgExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netAmount = warehouseTotalAmount + extraExpenses;

  const finishedWeight = Number(fg.finishedWeight) || Number(fg.inputWeight) || 0;
  const costPerTon = finishedWeight > 0 ? (netAmount / finishedWeight) : 0;

  return {
    netAmount,
    finishedWeight,
    costPerTon,
    baseAmount,
    whExpenses,
    extraExpenses
  };
}

function calculateSalePl(sale) {
  const revenue = Number(sale.totalAmount) || 0;
  const weight = Number(sale.weight) || 0;

  /* Finished Goods Cost */
  const fgCost = getFinishedGoodsCostDetails(sale.bookingNo);
  const cogs = Math.round(weight * fgCost.costPerTon);

  /* Sale Shipment Expenses */
  const expensesList = Array.isArray(sale.expenses) ? sale.expenses : [];
  const saleExpenses = expensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  /* Net Profit / Loss */
  const netProfit = revenue - cogs - saleExpenses;
  const margin = revenue > 0 ? ((netProfit / revenue) * 100) : 0;

  return {
    revenue,
    weight,
    fgCost,
    cogs,
    expensesList,
    saleExpenses,
    netProfit,
    margin
  };
}

/* =============================================
   POPULATE DROPDOWNS
   ============================================= */
function populatePlDropdowns() {
  const buyers = DB.get('exp_buyers');
  const sel = document.getElementById('filterPlBuyer');
  if (sel) {
    sel.innerHTML = '<option value="">All Buyers</option>' +
      buyers.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join('');
  }
}

/* =============================================
   BIND FILTERS
   ============================================= */
function bindPlFilterEvents() {
  document.getElementById('plSearchInput')?.addEventListener('input', e => {
    _plSearch = (e.target.value || '').toLowerCase().trim();
    renderPlDashboard();
  });

  document.getElementById('filterPlBuyer')?.addEventListener('change', e => {
    _plFilterBuyer = e.target.value;
    renderPlDashboard();
  });

  document.getElementById('filterPlDateFrom')?.addEventListener('change', e => {
    _plFilterDateFrom = e.target.value;
    renderPlDashboard();
  });

  document.getElementById('filterPlDateTo')?.addEventListener('change', e => {
    _plFilterDateTo = e.target.value;
    renderPlDashboard();
  });
}

/* =============================================
   RENDER P&L DASHBOARD
   ============================================= */
function renderPlDashboard() {
  const allSales = DB.get('exp_sales').slice().reverse();

  let filtered = allSales.filter(s => {
    if (_plFilterBuyer && s.buyerId !== _plFilterBuyer) return false;
    if (_plFilterDateFrom && s.date < _plFilterDateFrom) return false;
    if (_plFilterDateTo && s.date > _plFilterDateTo) return false;
    if (_plSearch) {
      const q = _plSearch;
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

  const countEl = document.getElementById('plResultCount');
  if (countEl) {
    countEl.textContent = `${filtered.length} of ${allSales.length} sale${allSales.length !== 1 ? 's' : ''}`;
  }

  /* Compute Totals */
  let totalRevenue = 0;
  let totalCogs = 0;
  let totalExpenses = 0;

  const salesData = filtered.map(sale => {
    const pl = calculateSalePl(sale);
    totalRevenue  += pl.revenue;
    totalCogs     += pl.cogs;
    totalExpenses += pl.saleExpenses;
    return { sale, pl };
  });

  const totalNetProfit = totalRevenue - totalCogs - totalExpenses;
  const avgMargin = totalRevenue > 0 ? ((totalNetProfit / totalRevenue) * 100) : 0;

  /* Summary Metrics Cards */
  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setT('statPlRevenue', `PKR ${formatCurrency(totalRevenue)}`);
  setT('statPlCogs', `PKR ${formatCurrency(totalCogs)}`);
  setT('statPlExpenses', `PKR ${formatCurrency(totalExpenses)}`);
  setT('statPlNetProfit', `${totalNetProfit >= 0 ? '+' : ''}PKR ${formatCurrency(totalNetProfit)}`);
  setT('statPlMargin', `${avgMargin.toFixed(1)}%`);

  const netCard = document.getElementById('statPlNetCard');
  const netIcon = document.getElementById('statPlNetIcon');
  const netLbl  = document.getElementById('statPlNetLbl');
  if (netCard && netIcon && netLbl) {
    if (totalNetProfit >= 0) {
      netIcon.style.background = '#ecfdf5';
      netIcon.style.color = '#059669';
      netLbl.textContent = 'Net Export Profit';
    } else {
      netIcon.style.background = '#fef2f2';
      netIcon.style.color = '#dc2626';
      netLbl.textContent = 'Net Export Loss';
    }
  }

  /* Render Table */
  renderPlTable(salesData);
}

/* =============================================
   RENDER P&L TABLE
   ============================================= */
function renderPlTable(salesData) {
  const tbody = document.getElementById('plTableBody');
  const tfoot = document.getElementById('plTableFoot');
  const mobileContainer = document.getElementById('plMobileCards');
  if (!tbody) return;

  if (!salesData.length) {
    tbody.innerHTML = `
      <tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">
        <i class="fas fa-chart-line" style="font-size:32px;margin-bottom:10px;display:block;"></i>
        ${_plSearch || _plFilterBuyer || _plFilterDateFrom || _plFilterDateTo
          ? 'No sales records match your filters.'
          : 'No export sales recorded yet. Record a sale in the Export Sales module.'}
        <div style="margin-top:10px;">
          <a href="export-sales.html" class="btn btn-sm btn-primary"><i class="fas fa-shopping-cart"></i> Go to Export Sales</a>
        </div>
      </td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';
    return;
  }

  /* Desktop Table */
  tbody.innerHTML = salesData.map(({ sale, pl }) => {
    const isProfit = pl.netProfit >= 0;

    return `
      <tr>
        <td>
          <strong style="color:var(--teal);font-size:12.5px;">${escapeHtml(sale.saleNo || '—')}</strong>
        </td>
        <td>${formatDate(sale.date)}</td>
        <td>
          <strong>${escapeHtml(sale.buyerName || '—')}</strong>
          ${sale.buyerCompany ? `<div style="font-size:11px;color:var(--text-muted);">${escapeHtml(sale.buyerCompany)}</div>` : ''}
        </td>
        <td>
          <div>${escapeHtml(sale.mineralDescription || 'Mineral')}</div>
          ${sale.bookingNo ? `<small style="color:var(--text-muted);">Batch: ${escapeHtml(sale.bookingNo)}</small>` : ''}
        </td>
        <td style="text-align:right;font-weight:700;">${formatKG(sale.weight)} TON</td>
        <td style="text-align:right;font-weight:700;color:var(--color-text);">
          PKR ${formatCurrency(pl.revenue)}
        </td>
        <td style="text-align:right;">
          <div style="font-weight:700;color:var(--copper,#d97706);">PKR ${formatCurrency(pl.cogs)}</div>
          <small style="font-size:10.5px;color:var(--text-muted);">@ ${formatCurrency(Math.round(pl.fgCost.costPerTon))}/TON</small>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <div>
              <div style="font-weight:700;color:${pl.saleExpenses > 0 ? 'var(--crimson,#dc2626)' : 'var(--text-muted)'};">
                PKR ${formatCurrency(pl.saleExpenses)}
              </div>
              ${pl.expensesList.length > 0 ? `<small style="font-size:10px;color:var(--text-muted);">${pl.expensesList.length} expense${pl.expensesList.length !== 1 ? 's' : ''}</small>` : ''}
            </div>
            <button class="btn btn-secondary btn-sm btn-icon" title="Add / View Expenses"
              style="width:28px;height:28px;color:var(--teal);border-color:var(--color-border);"
              onclick="openSaleExpenseModal('${escapeHtml(sale.id)}')">
              <i class="fas fa-coins"></i>
            </button>
          </div>
        </td>
        <td style="text-align:right;">
          <div class="profit-pill ${isProfit ? 'is-profit' : 'is-loss'}">
            ${isProfit ? '+' : ''}PKR ${formatCurrency(pl.netProfit)}
          </div>
          <span class="margin-tag" style="color:${isProfit ? 'var(--emerald)' : 'var(--crimson)'};">
            ${pl.margin.toFixed(1)}% margin
          </span>
        </td>
        <td style="text-align:center;">
          <button class="btn btn-secondary btn-sm btn-icon" title="View P&amp;L Statement"
            onclick="viewSingleSalePl('${escapeHtml(sale.id)}')">
            <i class="fas fa-file-invoice"></i>
          </button>
        </td>
      </tr>`;
  }).join('');

  /* Table Footer Totals */
  if (tfoot) {
    const totalWeight = salesData.reduce((s, { sale }) => s + (Number(sale.weight) || 0), 0);
    const totalRev    = salesData.reduce((s, { pl }) => s + pl.revenue, 0);
    const totalCost   = salesData.reduce((s, { pl }) => s + pl.cogs, 0);
    const totalExp    = salesData.reduce((s, { pl }) => s + pl.saleExpenses, 0);
    const totalNet    = totalRev - totalCost - totalExp;
    const isNetProf   = totalNet >= 0;

    tfoot.innerHTML = `
      <tr style="background:var(--color-surface-2);">
        <td colspan="4" style="font-weight:700;font-size:12px;color:var(--text-muted);">TOTAL (${salesData.length} Sales)</td>
        <td style="text-align:right;font-weight:800;color:var(--teal);">${formatKG(totalWeight)} TON</td>
        <td style="text-align:right;font-weight:800;color:var(--color-text);">PKR ${formatCurrency(totalRev)}</td>
        <td style="text-align:right;font-weight:800;color:var(--copper,#d97706);">PKR ${formatCurrency(totalCost)}</td>
        <td style="text-align:right;font-weight:800;color:var(--crimson,#dc2626);">PKR ${formatCurrency(totalExp)}</td>
        <td style="text-align:right;font-weight:800;color:${isNetProf ? 'var(--emerald,#059669)' : 'var(--crimson,#dc2626)'};font-size:14px;">
          ${isNetProf ? '+' : ''}PKR ${formatCurrency(totalNet)}
        </td>
        <td></td>
      </tr>`;
  }

  /* Mobile Cards */
  if (mobileContainer) {
    mobileContainer.innerHTML = salesData.map(({ sale, pl }) => {
      const isProfit = pl.netProfit >= 0;

      return `
        <div class="sf-sup-card" style="margin-bottom:14px;">
          <div class="sf-sup-card-top">
            <div>
              <span style="font-weight:800;color:var(--teal);font-size:13px;">${escapeHtml(sale.saleNo)}</span>
              <div style="font-weight:700;font-size:14px;margin-top:2px;">${escapeHtml(sale.buyerName)}</div>
              <div style="font-size:11px;color:var(--text-muted);">${formatDate(sale.date)} &bull; ${escapeHtml(sale.mineralDescription || '')}</div>
            </div>
            <span class="badge" style="background:#ecfdf5;color:#059669;font-weight:800;">${formatKG(sale.weight)} TON</span>
          </div>

          <div class="sf-sup-card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11.5px;margin-bottom:10px;">
              <div>
                <span style="color:var(--text-muted);">Sale Revenue</span>
                <div style="font-weight:800;color:var(--color-text);">PKR ${formatCurrency(pl.revenue)}</div>
              </div>
              <div>
                <span style="color:var(--text-muted);">FG Cost</span>
                <div style="font-weight:800;color:var(--copper,#d97706);">PKR ${formatCurrency(pl.cogs)}</div>
              </div>
              <div>
                <span style="color:var(--text-muted);">Expenses</span>
                <div style="font-weight:800;color:var(--crimson,#dc2626);">PKR ${formatCurrency(pl.saleExpenses)}</div>
              </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--color-border);padding-top:10px;">
              <div>
                <span style="font-size:11px;color:var(--text-muted);font-weight:700;">NET PROFIT / LOSS</span>
                <div style="font-size:14px;font-weight:800;color:${isProfit ? 'var(--emerald)' : 'var(--crimson)'};">
                  ${isProfit ? '+' : ''}PKR ${formatCurrency(pl.netProfit)} (${pl.margin.toFixed(1)}%)
                </div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-secondary btn-sm" onclick="openSaleExpenseModal('${escapeHtml(sale.id)}')">
                  <i class="fas fa-coins" style="color:var(--teal);"></i> Expenses
                </button>
                <button class="btn btn-secondary btn-sm" onclick="viewSingleSalePl('${escapeHtml(sale.id)}')">
                  <i class="fas fa-file-invoice"></i>
                </button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }
}

/* =============================================
   SALE EXPENSES MODAL MANAGEMENT
   ============================================= */
function openSaleExpenseModal(saleId) {
  _activePlSaleId = saleId;
  const sale = DB.findById('exp_sales', saleId);
  if (!sale) return;

  const headerEl = document.getElementById('seModalSaleHeader');
  if (headerEl) {
    headerEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <strong style="color:var(--teal);font-size:14px;">${escapeHtml(sale.saleNo)}</strong>
          <span style="margin:0 6px;color:var(--text-muted);">&bull;</span>
          <strong>Buyer:</strong> ${escapeHtml(sale.buyerName)}
          <span style="margin:0 6px;color:var(--text-muted);">&bull;</span>
          <strong>Mineral:</strong> ${escapeHtml(sale.mineralDescription || 'Mineral')} (${escapeHtml(sale.bookingNo || '')})
        </div>
        <div style="font-size:13px;">
          <strong>Weight:</strong> ${formatKG(sale.weight)} TON
          <span style="margin:0 6px;color:var(--text-muted);">&bull;</span>
          <strong style="color:var(--color-text);">Sale Value: PKR ${formatCurrency(sale.totalAmount)}</strong>
        </div>
      </div>
    `;
  }

  cancelSaleExpenseEdit();
  renderSaleExpenseTable(sale);
  openModal('saleExpenseModal');
}

function renderSaleExpenseTable(sale) {
  const tbody = document.getElementById('seModalTableBody');
  const totalBadge = document.getElementById('seModalTotalExp');
  if (!tbody) return;

  const expenses = Array.isArray(sale.expenses) ? sale.expenses : [];
  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  if (totalBadge) {
    totalBadge.textContent = `Total: PKR ${formatCurrency(total)}`;
  }

  if (!expenses.length) {
    tbody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">
        No shipment or operational expenses added for this sale yet.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(exp => `
    <tr>
      <td><strong>${escapeHtml(exp.category || 'Expense')}</strong></td>
      <td>${formatDate(exp.date)}</td>
      <td>${escapeHtml(exp.notes || '—')}</td>
      <td style="text-align:right;font-weight:700;color:var(--crimson,#dc2626);">
        PKR ${formatCurrency(exp.amount)}
      </td>
      <td style="text-align:center;">
        <div style="display:inline-flex;gap:4px;">
          <button type="button" class="btn btn-secondary btn-sm btn-icon" title="Edit Expense" onclick="editSaleExpense('${escapeHtml(exp.id)}')">
            <i class="fas fa-edit"></i>
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-icon" title="Delete Expense" onclick="deleteSaleExpense('${escapeHtml(exp.id)}')">
            <i class="fas fa-trash" style="color:var(--crimson);"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function saveSaleExpense(event) {
  event.preventDefault();
  if (!_activePlSaleId) return;

  const sale = DB.findById('exp_sales', _activePlSaleId);
  if (!sale) return;

  const editId = document.getElementById('fExpEditId')?.value;
  const category = (document.getElementById('fExpCategory')?.value || '').trim();
  const amount = Number(document.getElementById('fExpAmount')?.value) || 0;
  const date = document.getElementById('fExpDate')?.value || today();
  const notes = (document.getElementById('fExpNotes')?.value || '').trim();

  if (!category) {
    showToast('Please enter an expense category or title.', 'warning');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('Please enter a valid expense amount.', 'warning');
    return;
  }

  const expenses = Array.isArray(sale.expenses) ? [...sale.expenses] : [];

  if (editId) {
    /* Update existing */
    const idx = expenses.findIndex(e => e.id === editId);
    if (idx !== -1) {
      expenses[idx] = { ...expenses[idx], category, amount, date, notes };
      showToast('Expense updated!', 'success');
    }
  } else {
    /* Add new */
    expenses.push({
      id: generateId(),
      category,
      amount,
      date,
      notes
    });
    showToast('Expense added to sale!', 'success');
  }

  DB.update('exp_sales', sale.id, { expenses });

  cancelSaleExpenseEdit();
  renderSaleExpenseTable(sale);
  renderPlDashboard();
}

function editSaleExpense(expId) {
  if (!_activePlSaleId) return;
  const sale = DB.findById('exp_sales', _activePlSaleId);
  if (!sale || !Array.isArray(sale.expenses)) return;

  const exp = sale.expenses.find(e => e.id === expId);
  if (!exp) return;

  const idEl = document.getElementById('fExpEditId');
  if (idEl) idEl.value = exp.id;

  const catEl = document.getElementById('fExpCategory');
  if (catEl) catEl.value = exp.category || '';

  const amtEl = document.getElementById('fExpAmount');
  if (amtEl) amtEl.value = exp.amount || '';

  const dateEl = document.getElementById('fExpDate');
  if (dateEl) dateEl.value = exp.date || today();

  const notesEl = document.getElementById('fExpNotes');
  if (notesEl) notesEl.value = exp.notes || '';

  const titleEl = document.getElementById('expFormTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit"></i> Edit Sale Expense';

  const saveBtn = document.getElementById('saveExpBtn');
  if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Expense';

  const cancelBtn = document.getElementById('cancelExpEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function cancelSaleExpenseEdit() {
  document.getElementById('saleExpenseForm')?.reset();
  const idEl = document.getElementById('fExpEditId');
  if (idEl) idEl.value = '';

  const dateEl = document.getElementById('fExpDate');
  if (dateEl) dateEl.value = today();

  const titleEl = document.getElementById('expFormTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Expense for this Sale';

  const saveBtn = document.getElementById('saveExpBtn');
  if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';

  const cancelBtn = document.getElementById('cancelExpEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function deleteSaleExpense(expId) {
  if (!_activePlSaleId) return;
  const sale = DB.findById('exp_sales', _activePlSaleId);
  if (!sale || !Array.isArray(sale.expenses)) return;

  showConfirm('Are you sure you want to delete this expense?', () => {
    const updated = sale.expenses.filter(e => e.id !== expId);
    DB.update('exp_sales', sale.id, { expenses: updated });
    showToast('Expense removed.', 'info');
    renderSaleExpenseTable(sale);
    renderPlDashboard();
  });
}

/* =============================================
   SINGLE SALE P&L STATEMENT MODAL
   ============================================= */
function viewSingleSalePl(saleId) {
  const sale = DB.findById('exp_sales', saleId);
  if (!sale) return;

  _currentSinglePlSale = sale;
  const pl = calculateSalePl(sale);
  const isProfit = pl.netProfit >= 0;

  const container = document.getElementById('salePlDetailContainer');
  if (!container) return;

  container.innerHTML = `
    <div id="printableSingleSalePl" style="font-family:sans-serif;padding:16px;background:#fff;color:#1e293b;">
      <div style="text-align:center;border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:16px;">
        <h2 style="margin:0;font-size:22px;color:#0d9488;">Arham Traders</h2>
        <div style="font-size:12px;color:#64748b;">Export Operations &bull; Commercial Profit &amp; Loss Statement</div>
        <div style="display:inline-block;margin-top:6px;background:#e6fffa;color:#0d9488;font-weight:700;font-size:11px;padding:3px 10px;border-radius:12px;">
          SALE VOUCHER: ${escapeHtml(sale.saleNo)}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12.5px;margin-bottom:16px;background:#f8fafc;padding:12px;border-radius:8px;">
        <div>
          <strong>Date:</strong> ${formatDate(sale.date)}<br/>
          <strong>Buyer:</strong> ${escapeHtml(sale.buyerName)}<br/>
          <strong>Mineral:</strong> ${escapeHtml(sale.mineralDescription || 'Mineral')}
        </div>
        <div style="text-align:right;">
          <strong>Batch Ref:</strong> ${escapeHtml(sale.bookingNo || '—')}<br/>
          <strong>Sold Weight:</strong> ${formatKG(sale.weight)} TON<br/>
          <strong>Rate:</strong> PKR ${formatCurrency(sale.rate)} / TON
        </div>
      </div>

      <h4 style="font-size:13px;margin:0 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;color:#0f172a;">
        Revenue &amp; Cost Breakdown
      </h4>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:16px;">
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;font-weight:700;color:#0f172a;">1. Total Sale Revenue</td>
            <td style="padding:8px 0;text-align:right;font-weight:800;color:#0f172a;">PKR ${formatCurrency(pl.revenue)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#d97706;">
              2. Finished Goods Batch Cost (COGS)
              <div style="font-size:11px;color:#94a3b8;">${formatKG(sale.weight)} TON @ PKR ${formatCurrency(Math.round(pl.fgCost.costPerTon))}/TON</div>
            </td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#d97706;">- PKR ${formatCurrency(pl.cogs)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 0;color:#dc2626;">
              3. Shipment &amp; Port Expenses (${pl.expensesList.length} items)
            </td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#dc2626;">- PKR ${formatCurrency(pl.saleExpenses)}</td>
          </tr>
        </tbody>
      </table>

      ${pl.expensesList.length > 0 ? `
        <div style="background:#fef2f2;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:11.5px;">
          <strong>Itemized Sale Expenses:</strong>
          <ul style="margin:4px 0 0;padding-left:18px;">
            ${pl.expensesList.map(e => `<li>${escapeHtml(e.category)}: PKR ${formatCurrency(e.amount)} ${e.notes ? '(' + escapeHtml(e.notes) + ')' : ''}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <div style="background:${isProfit ? '#ecfdf5' : '#fef2f2'};border:1px solid ${isProfit ? '#a7f3d0' : '#fecaca'};padding:14px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <strong style="font-size:14px;color:${isProfit ? '#059669' : '#dc2626'};">NET PROFIT / LOSS</strong>
          <div style="font-size:11px;color:#64748b;">Profit Margin: ${pl.margin.toFixed(2)}%</div>
        </div>
        <div style="font-size:18px;font-weight:800;color:${isProfit ? '#059669' : '#dc2626'};">
          ${isProfit ? '+' : ''}PKR ${formatCurrency(pl.netProfit)}
        </div>
      </div>

      <div style="text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #e2e8f0;padding-top:8px;">
        Arham Traders Management System &bull; Export Profit &amp; Loss
      </div>
    </div>
  `;

  openModal('salePlDetailModal');
}

function printSingleSalePl() {
  printElement('printableSingleSalePl');
}

/* =============================================
   PRINT FULL P&L REPORT
   ============================================= */
function printPlReport() {
  const allSales = DB.get('exp_sales').slice().reverse();

  let filtered = allSales.filter(s => {
    if (_plFilterBuyer && s.buyerId !== _plFilterBuyer) return false;
    if (_plFilterDateFrom && s.date < _plFilterDateFrom) return false;
    if (_plFilterDateTo && s.date > _plFilterDateTo) return false;
    if (_plSearch) {
      const q = _plSearch;
      if (!(s.saleNo || '').toLowerCase().includes(q) &&
          !(s.buyerName || '').toLowerCase().includes(q) &&
          !(s.buyerCompany || '').toLowerCase().includes(q) &&
          !(s.bookingNo || '').toLowerCase().includes(q) &&
          !(s.mineralDescription || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  let totalRev = 0, totalCost = 0, totalExp = 0;
  const rows = filtered.map(sale => {
    const pl = calculateSalePl(sale);
    totalRev += pl.revenue;
    totalCost += pl.cogs;
    totalExp += pl.saleExpenses;
    return { sale, pl };
  });

  const totalNet = totalRev - totalCost - totalExp;

  const html = `
    <div style="font-family:sans-serif;padding:24px;max-width:900px;margin:0 auto;color:#1e293b;">
      <div style="text-align:center;border-bottom:2px solid #0d9488;padding-bottom:14px;margin-bottom:20px;">
        <h2 style="margin:0;font-size:24px;color:#0d9488;">Arham Traders</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Export Operations &bull; Commercial Profit &amp; Loss Report</p>
        <div style="margin-top:6px;font-size:12px;color:#94a3b8;">Generated: ${formatDate(today())}</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;font-size:12px;margin-bottom:20px;background:#f8fafc;padding:12px;border-radius:8px;">
        <div><strong>Total Revenue:</strong><br/>PKR ${formatCurrency(totalRev)}</div>
        <div><strong>Finished Goods Cost:</strong><br/>PKR ${formatCurrency(totalCost)}</div>
        <div><strong>Sale Expenses:</strong><br/>PKR ${formatCurrency(totalExp)}</div>
        <div><strong>Net Profit:</strong><br/><span style="color:${totalNet >= 0 ? '#059669' : '#dc2626'};font-weight:700;">PKR ${formatCurrency(totalNet)}</span></div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:8px;border:1px solid #cbd5e1;">Sale No</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Date</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Buyer</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Mineral</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Weight</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Sale Revenue</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">FG Cost</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Expenses</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Net Profit</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(({ sale, pl }) => `
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(sale.saleNo)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${formatDate(sale.date)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(sale.buyerName)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(sale.mineralDescription || '')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatKG(sale.weight)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(pl.revenue)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(pl.cogs)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(pl.saleExpenses)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;color:${pl.netProfit >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(pl.netProfit)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#f1f5f9;font-weight:700;">
            <td colspan="5" style="padding:8px;border:1px solid #cbd5e1;">TOTAL (${rows.length})</td>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">PKR ${formatCurrency(totalRev)}</td>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">PKR ${formatCurrency(totalCost)}</td>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">PKR ${formatCurrency(totalExp)}</td>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;color:${totalNet >= 0 ? '#059669' : '#dc2626'};">PKR ${formatCurrency(totalNet)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:30px;padding-top:12px;border-top:1px dashed #cbd5e1;text-align:center;font-size:11px;color:#94a3b8;">
        Arham Traders Management System &bull; Generated Automatically
      </div>
    </div>
  `;

  const win = window.open('', '_blank');
  if (!win) { showToast('Popup blocked by browser. Please allow popups.', 'warning'); return; }
  win.document.write(`<html><head><title>Export Profit and Loss Report</title></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
