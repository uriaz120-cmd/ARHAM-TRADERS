/* =============================================
   ARHAM TRADERS — EXPORT BUYERS MODULE
   js/export-buyers.js
   ============================================= */

/* ---- State ---- */
let _activeBuyerId = null;
let _buyerSearchQuery = '';

/* =============================================
   INIT
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('buyerSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      _buyerSearchQuery = (e.target.value || '').toLowerCase().trim();
      renderBuyerDashboard();
    });
  }

  /* Set today's date on payment modal */
  const payDateEl = document.getElementById('fPayDate');
  if (payDateEl) payDateEl.value = today();

  renderBuyerDashboard();
});

/* =============================================
   FINANCIAL HELPERS FOR BUYERS
   ============================================= */
function getBuyerFinances(buyerId) {
  const sales = DB.filter('exp_sales', s => s.buyerId === buyerId);
  const payments = DB.filter('exp_buyer_payments', p => p.buyerId === buyerId);

  const totalSales = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  const totalReceived = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const balance = totalSales - totalReceived;

  return { sales, payments, totalSales, totalReceived, balance };
}

/* =============================================
   DASHBOARD RENDER
   ============================================= */
function renderBuyerDashboard() {
  const buyers = DB.get('exp_buyers');
  const allSales = DB.get('exp_sales');
  const allPayments = DB.get('exp_buyer_payments');

  /* Calculate Global Summary */
  const totalSalesAmount = allSales.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0);
  const totalReceivedAmount = allPayments.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const totalBalanceDue = totalSalesAmount - totalReceivedAmount;

  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setT('sumTotalBuyers', buyers.length);
  setT('sumTotalSales', `PKR ${formatCurrency(totalSalesAmount)}`);
  setT('sumTotalReceived', `PKR ${formatCurrency(totalReceivedAmount)}`);
  setT('sumTotalBalance', `PKR ${formatCurrency(totalBalanceDue)}`);

  const balCard = document.getElementById('sumBalCard');
  if (balCard) {
    balCard.classList.toggle('all-clear', totalBalanceDue <= 0);
  }

  /* Filter buyers */
  let filtered = buyers;
  if (_buyerSearchQuery) {
    filtered = buyers.filter(b => {
      return (b.name || '').toLowerCase().includes(_buyerSearchQuery) ||
             (b.company || '').toLowerCase().includes(_buyerSearchQuery) ||
             (b.country || '').toLowerCase().includes(_buyerSearchQuery) ||
             (b.phone || '').toLowerCase().includes(_buyerSearchQuery) ||
             (b.email || '').toLowerCase().includes(_buyerSearchQuery);
    });
  }

  const resultCountEl = document.getElementById('buyerResultCount');
  if (resultCountEl) {
    resultCountEl.textContent = `${filtered.length} of ${buyers.length} buyer${buyers.length !== 1 ? 's' : ''}`;
  }

  renderBuyersGrid(filtered);
}

function renderBuyersGrid(buyers) {
  const container = document.getElementById('buyersCardsGrid');
  if (!container) return;

  if (!buyers.length) {
    container.innerHTML = `
      <div class="sf-empty-state" style="grid-column: 1 / -1; padding: 50px 20px; text-align: center;">
        <i class="fas fa-user-slash" style="font-size:36px;color:var(--text-muted);margin-bottom:12px;"></i>
        <p style="color:var(--text-muted);font-size:14px;">
          ${_buyerSearchQuery ? 'No buyers match your search.' : 'No export buyers found. Click "Add New Buyer" to create the first buyer account.'}
        </p>
        ${!_buyerSearchQuery ? `
          <button class="btn btn-primary btn-sm" onclick="openAddBuyerModal()" style="margin-top:12px;">
            <i class="fas fa-plus"></i> Add New Buyer
          </button>
        ` : ''}
      </div>`;
    return;
  }

  container.innerHTML = buyers.map(b => {
    const fin = getBuyerFinances(b.id);
    const initials = (b.name || '?').charAt(0).toUpperCase();
    const isSettled = fin.balance <= 0;

    return `
      <div class="sf-sup-card" style="cursor:default;">
        <div class="sf-sup-card-top" style="cursor:pointer;" onclick="openBuyerAccount('${escapeHtml(b.id)}')">
          <div class="sf-sup-avatar" style="background:#0284c7;color:#fff;">${initials}</div>
          <div style="flex:1;min-width:0;">
            <div class="sf-sup-name" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.name)}</span>
              ${b.country ? `<span class="buyer-country-badge"><i class="fas fa-globe-americas"></i> ${escapeHtml(b.country)}</span>` : ''}
            </div>
            <div class="sf-sup-phone" style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${b.company ? `<i class="fas fa-building" style="margin-right:4px;"></i>${escapeHtml(b.company)} &bull; ` : ''}
              ${b.phone ? `<i class="fas fa-phone" style="margin-right:4px;"></i>${escapeHtml(b.phone)}` : 'No phone'}
            </div>
          </div>
        </div>

        <div class="sf-sup-card-body">
          <div class="sf-sup-stats">
            <div class="sf-sup-stat">
              <div class="sf-sup-stat-val sf-bk-count" style="color:var(--teal);">${fin.sales.length}</div>
              <div class="sf-sup-stat-lbl">Sales Orders</div>
            </div>
            <div class="sf-sup-stat">
              <div class="sf-sup-stat-val sf-bk-amount">PKR ${formatCurrency(fin.totalSales)}</div>
              <div class="sf-sup-stat-lbl">Total Sales</div>
            </div>
            <div class="sf-sup-stat">
              <div class="sf-sup-stat-val sf-bk-rcvd" style="color:var(--emerald);">PKR ${formatCurrency(fin.totalReceived)}</div>
              <div class="sf-sup-stat-lbl">Total Received</div>
            </div>
          </div>

          <div class="sf-sup-bal-row" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--color-border,#e2e8f0);display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div class="sf-sup-bal-label" style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Remaining Balance</div>
              <div class="sf-sup-bal-value ${isSettled ? 'settled' : ''}" style="font-size:15px;font-weight:800;color:${isSettled ? 'var(--emerald)' : 'var(--crimson)'};">
                PKR ${formatCurrency(fin.balance)}
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-secondary" title="Receive Payment" onclick="openReceivePaymentModal('${escapeHtml(b.id)}')">
                <i class="fas fa-hand-holding-dollar" style="color:var(--emerald);"></i>
              </button>
              <button class="btn btn-sm btn-secondary" title="Edit Profile" onclick="openEditBuyerModal('${escapeHtml(b.id)}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-secondary" title="Open Account Ledger" onclick="openBuyerAccount('${escapeHtml(b.id)}')">
                <i class="fas fa-arrow-right"></i> Account
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* =============================================
   BUYER DETAIL / LEDGER VIEW
   ============================================= */
function openBuyerAccount(buyerId) {
  _activeBuyerId = buyerId;
  const buyer = DB.findById('exp_buyers', buyerId);
  if (!buyer) return;

  document.getElementById('buyerListView').style.display = 'none';
  const detView = document.getElementById('buyerDetailView');
  detView.style.display = 'block';

  renderActiveBuyerAccount(buyer);
}

function buyerGoBack() {
  _activeBuyerId = null;
  document.getElementById('buyerDetailView').style.display = 'none';
  document.getElementById('buyerListView').style.display = 'block';
  renderBuyerDashboard();
}

function renderActiveBuyerAccount(buyer) {
  const fin = getBuyerFinances(buyer.id);

  /* Set Header Info */
  const nameEl = document.getElementById('detBuyerName');
  if (nameEl) nameEl.textContent = buyer.name;

  const metaEl = document.getElementById('detBuyerMeta');
  if (metaEl) {
    metaEl.innerHTML = `
      ${buyer.company ? `<span><i class="fas fa-building"></i> ${escapeHtml(buyer.company)}</span>` : ''}
      ${buyer.country ? `<span><i class="fas fa-globe"></i> ${escapeHtml(buyer.country)}</span>` : ''}
      ${buyer.phone ? `<span><i class="fas fa-phone"></i> ${escapeHtml(buyer.phone)}</span>` : ''}
      ${buyer.email ? `<span><i class="fas fa-envelope"></i> ${escapeHtml(buyer.email)}</span>` : ''}
      ${buyer.address ? `<span><i class="fas fa-location-dot"></i> ${escapeHtml(buyer.address)}</span>` : ''}
    `;
  }

  /* Summary numbers */
  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setT('detBuyerSales', `PKR ${formatCurrency(fin.totalSales)}`);
  setT('detBuyerReceived', `PKR ${formatCurrency(fin.totalReceived)}`);
  setT('detBuyerBalance', `PKR ${formatCurrency(fin.balance)}`);

  const balCard = document.getElementById('detBuyerBalCard');
  if (balCard) balCard.classList.toggle('all-clear', fin.balance <= 0);

  const countBadge = document.getElementById('detSalesCountBadge');
  if (countBadge) countBadge.textContent = `${fin.sales.length} Sales Order${fin.sales.length !== 1 ? 's' : ''}`;

  /* Render Sales Table */
  renderSalesTableForBuyer(fin.sales);

  /* Render Payments Received Table */
  renderPaymentsTableForBuyer(fin.payments);
}

function renderSalesTableForBuyer(sales) {
  const wrap = document.getElementById('detSalesTableWrap');
  if (!wrap) return;

  if (!sales.length) {
    wrap.innerHTML = `
      <div style="padding:30px;text-align:center;color:var(--text-muted);font-size:13px;">
        <i class="fas fa-box-open" style="font-size:24px;margin-bottom:8px;display:block;"></i>
        No sales recorded for this buyer yet.
        <div style="margin-top:10px;">
          <a href="export-sales.html" class="btn btn-sm btn-primary"><i class="fas fa-shopping-cart"></i> Create Export Sale</a>
        </div>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="data-table" style="font-size:12.5px;">
      <thead>
        <tr>
          <th>Sale No</th>
          <th>Date</th>
          <th>Mineral / Ref</th>
          <th style="text-align:right;">Weight</th>
          <th style="text-align:right;">Rate/TON</th>
          <th style="text-align:right;">Total Amount</th>
          <th style="text-align:center;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${sales.slice().reverse().map(s => `
          <tr>
            <td><strong style="color:var(--teal);">${escapeHtml(s.saleNo || '—')}</strong></td>
            <td>${formatDate(s.date)}</td>
            <td>
              <div>${escapeHtml(s.mineralDescription || s.mineralType || 'Mineral')}</div>
              ${s.bookingNo ? `<small style="color:var(--text-muted);">Batch: ${escapeHtml(s.bookingNo)}</small>` : ''}
            </td>
            <td style="text-align:right;font-weight:700;">${formatKG(s.weight)} TON</td>
            <td style="text-align:right;">PKR ${formatCurrency(s.rate)}</td>
            <td style="text-align:right;font-weight:800;color:var(--color-text);">PKR ${formatCurrency(s.totalAmount)}</td>
            <td style="text-align:center;">
              <button class="btn btn-secondary btn-sm btn-icon" title="View in Export Sales" onclick="window.location.href='export-sales.html'">
                <i class="fas fa-external-link-alt"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function renderPaymentsTableForBuyer(payments) {
  const wrap = document.getElementById('detPaymentsTableWrap');
  if (!wrap) return;

  if (!payments.length) {
    wrap.innerHTML = `
      <div style="padding:30px;text-align:center;color:var(--text-muted);font-size:13px;">
        <i class="fas fa-hand-holding-dollar" style="font-size:24px;margin-bottom:8px;display:block;"></i>
        No payment receipts recorded yet.
        <div style="margin-top:10px;">
          <button class="btn btn-sm btn-success" onclick="openReceiveModalForActiveBuyer()" style="background:#059669;color:#fff;border:none;">
            <i class="fas fa-plus"></i> Receive Amount
          </button>
        </div>
      </div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="data-table" style="font-size:12.5px;">
      <thead>
        <tr>
          <th>Date</th>
          <th>Method</th>
          <th>Reference / Notes</th>
          <th style="text-align:right;">Received Amount</th>
          <th style="text-align:center;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${payments.slice().reverse().map(p => `
          <tr>
            <td>${formatDate(p.date)}</td>
            <td><span class="badge" style="background:#ecfdf5;color:#059669;font-weight:700;">${escapeHtml(p.paymentMethod || 'Payment')}</span></td>
            <td>
              <div>${escapeHtml(p.reference || '—')}</div>
              ${p.notes ? `<small style="color:var(--text-muted);">${escapeHtml(p.notes)}</small>` : ''}
            </td>
            <td style="text-align:right;font-weight:800;color:var(--emerald);">PKR ${formatCurrency(p.amount)}</td>
            <td style="text-align:center;">
              <button class="btn btn-secondary btn-sm btn-icon" title="Delete Payment" onclick="deleteBuyerPayment('${escapeHtml(p.id)}')">
                <i class="fas fa-trash" style="color:var(--crimson);"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

/* =============================================
   BUYER CRUD (Add / Edit / Delete)
   ============================================= */
function openAddBuyerModal() {
  document.getElementById('buyerForm')?.reset();
  const idEl = document.getElementById('fBuyerId');
  if (idEl) idEl.value = '';

  const titleEl = document.getElementById('buyerModalTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-user-plus" style="color:var(--teal);margin-right:8px;"></i>Add New Export Buyer';

  const saveBtn = document.getElementById('saveBuyerBtn');
  if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-plus"></i> Add Buyer';

  openModal('buyerModal');
}

function openEditBuyerModal(id) {
  const buyer = DB.findById('exp_buyers', id);
  if (!buyer) return;

  const idEl = document.getElementById('fBuyerId');
  if (idEl) idEl.value = buyer.id;

  const nameEl = document.getElementById('fBuyerName');
  if (nameEl) nameEl.value = buyer.name || '';

  const compEl = document.getElementById('fBuyerCompany');
  if (compEl) compEl.value = buyer.company || '';

  const ctryEl = document.getElementById('fBuyerCountry');
  if (ctryEl) ctryEl.value = buyer.country || '';

  const phEl = document.getElementById('fBuyerPhone');
  if (phEl) phEl.value = buyer.phone || '';

  const emEl = document.getElementById('fBuyerEmail');
  if (emEl) emEl.value = buyer.email || '';

  const addrEl = document.getElementById('fBuyerAddress');
  if (addrEl) addrEl.value = buyer.address || '';

  const titleEl = document.getElementById('buyerModalTitle');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-edit" style="color:var(--teal);margin-right:8px;"></i>Edit Export Buyer';

  const saveBtn = document.getElementById('saveBuyerBtn');
  if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> Update Buyer';

  openModal('buyerModal');
}

function saveBuyer() {
  const name = (document.getElementById('fBuyerName')?.value || '').trim();
  if (!name) {
    showToast('Please enter the buyer contact name.', 'warning');
    return;
  }

  const id = document.getElementById('fBuyerId')?.value;
  const buyerData = {
    name,
    company: (document.getElementById('fBuyerCompany')?.value || '').trim(),
    country: (document.getElementById('fBuyerCountry')?.value || '').trim(),
    phone:   (document.getElementById('fBuyerPhone')?.value || '').trim(),
    email:   (document.getElementById('fBuyerEmail')?.value || '').trim(),
    address: (document.getElementById('fBuyerAddress')?.value || '').trim()
  };

  if (id) {
    DB.update('exp_buyers', id, buyerData);
    showToast('Buyer updated successfully!', 'success');
  } else {
    DB.add('exp_buyers', buyerData);
    showToast('New export buyer added!', 'success');
  }

  closeModal('buyerModal');
  renderBuyerDashboard();

  if (_activeBuyerId && _activeBuyerId === id) {
    const updated = DB.findById('exp_buyers', id);
    if (updated) renderActiveBuyerAccount(updated);
  }
}

function deleteBuyer(id) {
  const fin = getBuyerFinances(id);
  if (fin.sales.length > 0 || fin.payments.length > 0) {
    showToast('Cannot delete buyer with existing sales or payment records.', 'warning');
    return;
  }

  showConfirm('Are you sure you want to delete this buyer?', () => {
    DB.remove('exp_buyers', id);
    showToast('Buyer deleted.', 'info');
    renderBuyerDashboard();
  });
}

/* =============================================
   RECEIVE PAYMENT MODAL & SUBMIT
   ============================================= */
function openReceivePaymentModal(buyerId) {
  const buyer = DB.findById('exp_buyers', buyerId);
  if (!buyer) return;

  const idEl = document.getElementById('fPayBuyerId');
  if (idEl) idEl.value = buyer.id;

  const nameEl = document.getElementById('fPayBuyerNameDisplay');
  if (nameEl) nameEl.value = `${buyer.name} (${buyer.company || buyer.country || 'Buyer'})`;

  const amtEl = document.getElementById('fPayAmount');
  if (amtEl) amtEl.value = '';

  const refEl = document.getElementById('fPayRef');
  if (refEl) refEl.value = '';

  const notesEl = document.getElementById('fPayNotes');
  if (notesEl) notesEl.value = '';

  const dateEl = document.getElementById('fPayDate');
  if (dateEl) dateEl.value = today();

  openModal('receivePaymentModal');
}

function openReceiveModalForActiveBuyer() {
  if (_activeBuyerId) {
    openReceivePaymentModal(_activeBuyerId);
  }
}

function submitBuyerPayment() {
  const buyerId = document.getElementById('fPayBuyerId')?.value;
  const amount = Number(document.getElementById('fPayAmount')?.value);
  const date = document.getElementById('fPayDate')?.value;
  const method = document.getElementById('fPayMethod')?.value;
  const ref = (document.getElementById('fPayRef')?.value || '').trim();
  const notes = (document.getElementById('fPayNotes')?.value || '').trim();

  if (!buyerId) {
    showToast('Buyer not selected.', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('Please enter a valid received amount.', 'warning');
    return;
  }
  if (!date) {
    showToast('Please select payment date.', 'warning');
    return;
  }

  const paymentRecord = {
    paymentNo: generateExportPaymentNo(),
    buyerId,
    amount,
    date,
    paymentMethod: method,
    reference: ref,
    notes,
    createdAt: new Date().toISOString()
  };

  DB.add('exp_buyer_payments', paymentRecord);
  showToast(`PKR ${formatCurrency(amount)} received successfully!`, 'success');
  closeModal('receivePaymentModal');

  /* Rerender current view */
  renderBuyerDashboard();
  if (_activeBuyerId === buyerId) {
    const buyer = DB.findById('exp_buyers', buyerId);
    if (buyer) renderActiveBuyerAccount(buyer);
  }
}

function deleteBuyerPayment(paymentId) {
  showConfirm('Are you sure you want to delete this payment entry?', () => {
    DB.remove('exp_buyer_payments', paymentId);
    showToast('Payment entry removed.', 'info');
    renderBuyerDashboard();
    if (_activeBuyerId) {
      const buyer = DB.findById('exp_buyers', _activeBuyerId);
      if (buyer) renderActiveBuyerAccount(buyer);
    }
  });
}

/* =============================================
   PRINT STATEMENT
   ============================================= */
function printBuyerStatement() {
  if (!_activeBuyerId) return;
  const buyer = DB.findById('exp_buyers', _activeBuyerId);
  if (!buyer) return;

  const fin = getBuyerFinances(buyer.id);

  const html = `
    <div style="font-family:sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#1e293b;">
      <div style="text-align:center;border-bottom:2px solid #0d9488;padding-bottom:14px;margin-bottom:20px;">
        <h2 style="margin:0;font-size:24px;color:#0d9488;">Arham Traders</h2>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Export Operations &bull; Buyer Account Statement</p>
      </div>

      <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px;">
        <div>
          <strong>Buyer Name:</strong> ${escapeHtml(buyer.name)}<br/>
          <strong>Company:</strong> ${escapeHtml(buyer.company || '—')}<br/>
          <strong>Country / Port:</strong> ${escapeHtml(buyer.country || '—')}<br/>
          <strong>Phone:</strong> ${escapeHtml(buyer.phone || '—')}
        </div>
        <div style="text-align:right;">
          <strong>Date Generated:</strong> ${formatDate(today())}<br/>
          <strong>Total Sales:</strong> PKR ${formatCurrency(fin.totalSales)}<br/>
          <strong>Total Received:</strong> PKR ${formatCurrency(fin.totalReceived)}<br/>
          <strong style="color:${fin.balance > 0 ? '#dc2626' : '#059669'};">Balance Due: PKR ${formatCurrency(fin.balance)}</strong>
        </div>
      </div>

      <h3 style="font-size:15px;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-top:20px;">Sales Invoices</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:8px;border:1px solid #cbd5e1;">Sale No</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Date</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Mineral</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Weight (TON)</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Rate</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${fin.sales.map(s => `
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(s.saleNo || '—')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${formatDate(s.date)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(s.mineralDescription || s.mineralType || 'Mineral')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatKG(s.weight)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(s.rate)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${formatCurrency(s.totalAmount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3 style="font-size:15px;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-top:20px;">Payments Received</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:8px;border:1px solid #cbd5e1;">Date</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Method</th>
            <th style="padding:8px;border:1px solid #cbd5e1;">Reference</th>
            <th style="padding:8px;border:1px solid #cbd5e1;text-align:right;">Received (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${fin.payments.map(p => `
            <tr>
              <td style="padding:8px;border:1px solid #cbd5e1;">${formatDate(p.date)}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(p.paymentMethod || 'Payment')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(p.reference || '—')}</td>
              <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;font-weight:700;color:#059669;">${formatCurrency(p.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top:30px;padding-top:12px;border-top:1px dashed #cbd5e1;text-align:center;font-size:11px;color:#94a3b8;">
        Arham Traders Management System &bull; Generated Automatically
      </div>
    </div>
  `;

  const win = window.open('', '_blank');
  if (!win) { showToast('Popup blocked by browser. Please allow popups.', 'warning'); return; }
  win.document.write(`<html><head><title>Statement - ${escapeHtml(buyer.name)}</title></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}
