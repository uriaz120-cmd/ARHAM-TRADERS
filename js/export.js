/* =============================================
   ARHAM TRADERS — EXPORT MODULE CONTROLLER (SIMPLIFIED & STREAMLINED)
   js/export.js
   ============================================= */

/* ---- Global State ---- */
let _expActiveTab = 'dashboard';
let _expChartProfit = null;

/* =============================================
   INITIALIZATION
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  initExportModule();
});

function initExportModule() {
  initTabs();
  setFormDefaults();
  populateDropdowns();
  bindCalculations();
  bindForms();
  renderAllExportViews();
}

/* =============================================
   NUMBER GENERATORS
   ============================================= */
function generateExpBookingNo() {
  const list = DB.get('exp_bookings') || [];
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(list.length + 1).padStart(4, '0');
  return `EXP-PB-${year}${month}-${seq}`;
}

function generateExpProductionNo() {
  const list = DB.get('exp_production') || [];
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(list.length + 1).padStart(4, '0');
  return `EXP-PR-${year}${month}-${seq}`;
}

function generateExpSalesBookingNo() {
  const list = DB.get('exp_sales_bookings') || [];
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(list.length + 1).padStart(4, '0');
  return `EXP-SB-${year}${month}-${seq}`;
}

/* =============================================
   TAB SWITCHING
   ============================================= */
function initTabs() {
  const tabs = document.querySelectorAll('.export-tab-btn');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchExportTab(target);
    });
  });

  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(`tab-${hash}`)) {
    switchExportTab(hash);
  }
}

function switchExportTab(tabName) {
  _expActiveTab = tabName;
  window.location.hash = tabName;

  document.querySelectorAll('.export-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });

  document.querySelectorAll('.export-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });

  populateDropdowns();
  if (tabName === 'dashboard') renderExportDashboard();
  if (tabName === 'expenses-profit') renderProfitAnalysis();
}

/* =============================================
   SET FORM DEFAULTS
   ============================================= */
function setFormDefaults() {
  const todayStr = today();

  document.querySelectorAll('input[type="date"]').forEach(inp => {
    if (!inp.value) inp.value = todayStr;
  });

  const pbNo = document.getElementById('pbBookingNo');
  if (pbNo) pbNo.value = generateExpBookingNo();

  const prNo = document.getElementById('prNo');
  if (prNo) prNo.value = generateExpProductionNo();

  const sbNo = document.getElementById('sbBookingNo');
  if (sbNo) sbNo.value = generateExpSalesBookingNo();
}

/* =============================================
   POPULATE ALL DROPDOWNS
   ============================================= */
function populateDropdowns() {
  const suppliers = DB.get('exp_suppliers') || [];
  const customers = DB.get('exp_customers') || [];
  const pBookings = DB.get('exp_bookings') || [];

  // 1. Export Suppliers Dropdown
  const pbSupSel = document.getElementById('pbSupplier');
  if (pbSupSel) {
    if (suppliers.length === 0) {
      pbSupSel.innerHTML = '<option value="">— Koi Supplier nahi hai (Upar "+ Naya Supplier" dabayein) —</option>';
    } else {
      pbSupSel.innerHTML = '<option value="">— Select Supplier —</option>' +
        suppliers.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.city || 'Supplier')})</option>`).join('');
    }
  }

  // 2. Pending Bookings Dropdown for Warehouse Receiving
  const rcvBookingSel = document.getElementById('rcvBookingId');
  if (rcvBookingSel) {
    const pendingBookings = pBookings.filter(b => {
      const rec = getBookingReceivedTotal(b.id);
      return (Number(b.quantity) || 0) > rec;
    });

    if (pendingBookings.length === 0) {
      rcvBookingSel.innerHTML = '<option value="">— Koi pending maal nahi hai (Nayi booking banayein) —</option>';
    } else {
      rcvBookingSel.innerHTML = '<option value="">— Select Purchase Booking —</option>' +
        pendingBookings.map(b => {
          const rec = getBookingReceivedTotal(b.id);
          const rem = (Number(b.quantity) || 0) - rec;
          return `<option value="${escapeHtml(b.id)}">${escapeHtml(b.bookingNo)} — ${escapeHtml(b.supplierName)} (${escapeHtml(b.mineral)}: ${formatKG(rem)} ${b.unit} Baqi)</option>`;
        }).join('');
    }
  }

  // 3. Raw Mineral Stock in Warehouse for Production
  populateProductionMineralSource();

  // 4. Buyers Dropdown
  const custSel = document.getElementById('sbCustomer');
  if (custSel) {
    if (customers.length === 0) {
      custSel.innerHTML = '<option value="">— Koi Buyer nahi hai (Upar "+ Naya Buyer" dabayein) —</option>';
    } else {
      custSel.innerHTML = '<option value="">— Select Buyer / Customer —</option>' +
        customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.country || 'Buyer')})</option>`).join('');
    }
  }

  // 5. Ready Stock Minerals Dropdown for Sale
  const sbMinSel = document.getElementById('sbMineralSelect');
  if (sbMinSel) {
    const readyStocks = getExpReadyStockSummary();
    const availableStocks = readyStocks.filter(s => s.availableTon > 0);
    if (availableStocks.length === 0) {
      sbMinSel.innerHTML = '<option value="">— Ready Stock khali hai (Pehle Production karein) —</option>';
    } else {
      sbMinSel.innerHTML = '<option value="">— Select Ready Mineral —</option>' +
        availableStocks.map(s => `<option value="${escapeHtml(s.mineral)}">${escapeHtml(s.mineral)} — Available: ${formatTON(s.availableTon)} TON</option>`).join('');
    }
  }
}

function populateProductionMineralSource() {
  const stock = getExpRawWarehouseStock();
  const prSel = document.getElementById('prMineralSource');
  if (!prSel) return;

  const available = stock.filter(s => s.availableTon > 0);
  if (available.length === 0) {
    prSel.innerHTML = '<option value="">— Warehouse mein koi raw maal nahi hai (Pehle Receiving karein) —</option>';
    return;
  }

  prSel.innerHTML = '<option value="">— Select Raw Mineral from Warehouse —</option>' +
    available.map(s => 
      `<option value="${escapeHtml(s.mineral)}|${escapeHtml(s.warehouse)}">
        ${escapeHtml(s.mineral)} (${escapeHtml(s.warehouse)}) — Available Raw Stock: ${formatTON(s.availableTon)} TON
      </option>`
    ).join('');
}

/* =============================================
   DYNAMIC CALCULATIONS & BINDINGS
   ============================================= */
function bindCalculations() {
  // 1. Purchase Booking Total Calculation
  const pbQty = document.getElementById('pbQuantity');
  const pbRate = document.getElementById('pbRate');
  const pbTotal = document.getElementById('pbTotal');
  const pbCalcDisplay = document.getElementById('pbCalcTotal');

  const calcPB = () => {
    const q = parseFloat(pbQty?.value) || 0;
    const r = parseFloat(pbRate?.value) || 0;
    const total = q * r;
    if (pbTotal) pbTotal.value = total.toFixed(2);
    if (pbCalcDisplay) pbCalcDisplay.textContent = 'PKR ' + formatCurrency(total);
  };
  pbQty?.addEventListener('input', calcPB);
  pbRate?.addEventListener('input', calcPB);

  // 2. Production Wastage & Output Calculation
  const prInput = document.getElementById('prInputQty');
  const prWastage = document.getElementById('prWastageQty');
  const prOutput = document.getElementById('prReadyQty');

  const calcPR = () => {
    const inp = parseFloat(prInput?.value) || 0;
    const wst = parseFloat(prWastage?.value) || 0;
    const out = Math.max(0, inp - wst);
    if (prOutput) prOutput.value = out.toFixed(3);
  };
  prInput?.addEventListener('input', calcPR);
  prWastage?.addEventListener('input', calcPR);

  // 3. Sales Booking Total Calculation
  const sbQty = document.getElementById('sbQuantity');
  const sbRate = document.getElementById('sbRate');
  const sbTotal = document.getElementById('sbTotal');
  const sbCalcDisplay = document.getElementById('sbCalcTotal');

  const calcSB = () => {
    const q = parseFloat(sbQty?.value) || 0;
    const r = parseFloat(sbRate?.value) || 0;
    const total = q * r;
    if (sbTotal) sbTotal.value = total.toFixed(2);
    if (sbCalcDisplay) sbCalcDisplay.textContent = 'PKR ' + formatCurrency(total);
  };
  sbQty?.addEventListener('input', calcSB);
  sbRate?.addEventListener('input', calcSB);

  // 4. Warehouse Receiving Booking Change
  const rcvBookingSel = document.getElementById('rcvBookingId');
  if (rcvBookingSel) {
    rcvBookingSel.addEventListener('change', () => {
      const bId = rcvBookingSel.value;
      const booking = DB.findById('exp_bookings', bId);
      if (booking) {
        document.getElementById('rcvSupplierDisplay').value = booking.supplierName;
        document.getElementById('rcvMineralDisplay').value = booking.mineral;
        document.getElementById('rcvWarehouse').value = booking.warehouse || 'Main Export Yard';
        
        const receivings = DB.filter('exp_receivings', r => r.bookingId === bId);
        const receivedTotal = receivings.reduce((s, r) => s + (Number(r.receivedQuantity) || 0), 0);
        const remaining = Math.max(0, (Number(booking.quantity) || 0) - receivedTotal);
        
        document.getElementById('rcvPendingDisplay').value = `${formatKG(remaining)} ${booking.unit} baqi (Total: ${formatKG(booking.quantity)} ${booking.unit})`;
        const rcvQty = document.getElementById('rcvQuantity');
        if (rcvQty) {
          rcvQty.value = remaining > 0 ? remaining : 0;
          document.getElementById('rcvUnitDisplay').textContent = booking.unit;
        }
      }
    });
  }
}

/* =============================================
   FORM SUBMISSIONS
   ============================================= */
function bindForms() {
  // Modal: Add Supplier
  document.getElementById('expSupplierForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveSupplier();
  });

  // Modal: Add Customer
  document.getElementById('expCustomerForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveCustomer();
  });

  // Tab 2: Purchase Booking
  document.getElementById('expPurchaseBookingForm')?.addEventListener('submit', e => {
    e.preventDefault();
    savePurchaseBooking();
  });

  // Tab 3: Warehouse Receiving
  document.getElementById('expReceivingForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveWarehouseReceiving();
  });

  // Tab 4: Production
  document.getElementById('expProductionForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveProduction();
  });

  // Tab 6: Sales Booking
  document.getElementById('expSalesBookingForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveSalesBooking();
  });

  // Tab 7: Kharcha Form
  document.getElementById('expSimpleExpenseForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveSimpleExpense();
  });
}

/* =============================================
   SUPPLIER & CUSTOMER HELPERS
   ============================================= */
function openSupplierModal() {
  document.getElementById('expSupplierForm')?.reset();
  openModal('supplierModal');
}

function openCustomerModal() {
  document.getElementById('expCustomerForm')?.reset();
  openModal('customerModal');
}

function saveSupplier() {
  const name = sanitizeInput(document.getElementById('expSupName')?.value || '');
  const phone = sanitizeInput(document.getElementById('expSupPhone')?.value || '');
  const city = sanitizeInput(document.getElementById('expSupCity')?.value || '');
  const minerals = sanitizeInput(document.getElementById('expSupMinerals')?.value || '');

  if (!name) { showToast('Supplier Name is required.', 'error'); return; }

  const sup = DB.add('exp_suppliers', {
    name,
    phone: phone || '',
    city: city || 'Pakistan',
    minerals: minerals || 'Minerals'
  });

  showToast(`Supplier "${name}" save ho gaya!`, 'success');
  closeModal('supplierModal');
  populateDropdowns();

  // Auto-select in pbSupplier
  const pbSel = document.getElementById('pbSupplier');
  if (pbSel) pbSel.value = sup.id;
}

function saveCustomer() {
  const name = sanitizeInput(document.getElementById('custName')?.value || '');
  const country = sanitizeInput(document.getElementById('custCountry')?.value || '');
  const contact = sanitizeInput(document.getElementById('custContact')?.value || '');

  if (!name) { showToast('Buyer Name is required.', 'error'); return; }

  const cust = DB.add('exp_customers', {
    name,
    country: country || 'International',
    contact: contact || ''
  });

  showToast(`Buyer "${name}" save ho gaya!`, 'success');
  closeModal('customerModal');
  populateDropdowns();
  renderCustomersList();

  // Auto-select in sbCustomer
  const sbSel = document.getElementById('sbCustomer');
  if (sbSel) sbSel.value = cust.id;
}

/* =============================================
   1. PURCHASE BOOKING (MAAL KHAREEDNA)
   ============================================= */
function savePurchaseBooking() {
  const bookingNo = sanitizeInput(document.getElementById('pbBookingNo')?.value || '');
  const dateVal = document.getElementById('pbDate')?.value || today();
  const supplierId = document.getElementById('pbSupplier')?.value || '';
  const mineral = sanitizeInput(document.getElementById('pbMineral')?.value || '');
  const quantity = parseFloat(document.getElementById('pbQuantity')?.value) || 0;
  const unit = document.getElementById('pbUnit')?.value || 'TON';
  const rate = parseFloat(document.getElementById('pbRate')?.value) || 0;
  const totalAmount = quantity * rate;
  const paymentType = document.getElementById('pbPaymentType')?.value || 'credit';
  const warehouse = sanitizeInput(document.getElementById('pbWarehouse')?.value || 'Main Export Yard');
  const remarks = sanitizeInput(document.getElementById('pbRemarks')?.value || '');

  if (!supplierId) { showToast('Supplier select karein ya naya add karein.', 'error'); return; }
  if (!mineral) { showToast('Mineral Type zaroori hai.', 'error'); return; }
  if (quantity <= 0) { showToast('Quantity 0 se bari honi chahiye.', 'error'); return; }
  if (rate <= 0) { showToast('Rate enter karein.', 'error'); return; }

  const supplier = DB.findById('exp_suppliers', supplierId);
  const supplierName = supplier ? supplier.name : 'Supplier';

  const booking = DB.add('exp_bookings', {
    bookingNo,
    date: dateVal,
    supplierId,
    supplierName,
    mineral,
    quantity,
    unit,
    rate,
    totalAmount,
    paymentType,
    warehouse,
    remarks,
    receivedQuantity: 0,
    status: 'booked',
    month: dateVal.substring(0, 7)
  });

  // Agar Cash hai to Expense mein Cash Out record ho
  if (paymentType === 'cash') {
    DB.add('expenses', {
      month: dateVal.substring(0, 7),
      date: dateVal,
      description: `Export Purchase: ${mineral} (${formatKG(quantity)} ${unit}) - ${supplierName} [${bookingNo}]`,
      reference: bookingNo,
      amount: totalAmount,
      source: 'exp_booking',
      expBookingId: booking.id
    });
  }

  showToast(`Booking ${bookingNo} save ho gayi! Ab Warehouse mein maal receive karein.`, 'success');

  document.getElementById('expPurchaseBookingForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderPurchaseBookingsTable();
  renderExportDashboard();
}

function renderPurchaseBookingsTable() {
  const container = document.getElementById('pbTableBody');
  if (!container) return;

  const bookings = DB.get('exp_bookings') || [];
  bookings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (bookings.length === 0) {
    container.innerHTML = `<tr><td colspan="9" class="text-center py-4" style="color:var(--text-muted);"><i class="fas fa-inbox fa-2x mb-2"></i><br>Koi Purchase Booking nahi mili. Upar se maal khareedein.</td></tr>`;
    return;
  }

  container.innerHTML = bookings.map(b => {
    const payBadge = b.paymentType === 'cash' 
      ? '<span class="badge badge-status-cash">Naqad (Cash)</span>' 
      : '<span class="badge badge-status-credit">Udhaar (Credit)</span>';
    
    const recTotal = getBookingReceivedTotal(b.id);
    const rem = Math.max(0, (Number(b.quantity) || 0) - recTotal);
    const recBadge = rem === 0 
      ? '<span class="badge badge-status-delivered">Pura Received</span>' 
      : (recTotal > 0 
          ? `<span class="badge badge-status-booked">Received: ${formatKG(recTotal)} / ${formatKG(b.quantity)} ${b.unit}</span>` 
          : '<span class="badge badge-status-ready">Pending (Aana Baqi)</span>');

    return `
      <tr>
        <td><strong>${escapeHtml(b.bookingNo)}</strong><br><small style="color:var(--text-muted);">${formatDate(b.date)}</small></td>
        <td><strong>${escapeHtml(b.supplierName)}</strong></td>
        <td><span class="badge badge-mineral">${escapeHtml(b.mineral)}</span></td>
        <td>${formatKG(b.quantity)} <strong>${b.unit}</strong></td>
        <td>PKR ${formatCurrency(b.rate)}/${b.unit}</td>
        <td><strong>PKR ${formatCurrency(b.totalAmount)}</strong></td>
        <td>${payBadge}</td>
        <td>${recBadge}</td>
        <td>
          <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deletePurchaseBooking('${escapeHtml(b.id)}')"><i class="fas fa-trash-alt"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function getBookingReceivedTotal(bookingId) {
  const receivings = DB.filter('exp_receivings', r => r.bookingId === bookingId);
  return receivings.reduce((s, r) => s + (Number(r.receivedQuantity) || 0), 0);
}

function deletePurchaseBooking(id) {
  const b = DB.findById('exp_bookings', id);
  if (!b) return;

  showConfirm(`Delete Purchase Booking "${b.bookingNo}"?`, () => {
    if (b.paymentType === 'cash') {
      const linked = DB.filter('expenses', e => e.expBookingId === id || e.reference === b.bookingNo);
      linked.forEach(e => DB.remove('expenses', e.id));
    }
    DB.remove('exp_bookings', id);
    showToast('Booking delete ho gayi.', 'success');
    populateDropdowns();
    renderPurchaseBookingsTable();
    renderExportDashboard();
  });
}

/* =============================================
   2. WAREHOUSE RECEIVING & RAW STOCK
   ============================================= */
function saveWarehouseReceiving() {
  const bookingId = document.getElementById('rcvBookingId')?.value || '';
  const dateVal = document.getElementById('rcvDate')?.value || today();
  const receivedQuantity = parseFloat(document.getElementById('rcvQuantity')?.value) || 0;
  const warehouse = sanitizeInput(document.getElementById('rcvWarehouse')?.value || 'Main Export Yard');
  const vehicle = sanitizeInput(document.getElementById('rcvVehicle')?.value || '');
  const biltyNo = sanitizeInput(document.getElementById('rcvBiltyNo')?.value || '');

  if (!bookingId) { showToast('Purchase booking select karein.', 'error'); return; }
  if (receivedQuantity <= 0) { showToast('Received quantity 0 se bari honi chahiye.', 'error'); return; }

  const booking = DB.findById('exp_bookings', bookingId);
  if (!booking) { showToast('Booking nahi mili.', 'error'); return; }

  const alreadyReceived = getBookingReceivedTotal(bookingId);
  const remaining = Math.max(0, (Number(booking.quantity) || 0) - alreadyReceived);

  if (receivedQuantity > remaining + 0.001) {
    showToast(`Baqi bache maal (${formatKG(remaining)} ${booking.unit}) se zyada receive nahi ho sakta.`, 'warning');
    return;
  }

  DB.add('exp_receivings', {
    bookingId,
    bookingNo: booking.bookingNo,
    supplierId: booking.supplierId,
    supplierName: booking.supplierName,
    mineral: booking.mineral,
    receivedQuantity,
    unit: booking.unit,
    date: dateVal,
    warehouse,
    vehicle,
    biltyNo,
    month: dateVal.substring(0, 7)
  });

  const newTotalReceived = alreadyReceived + receivedQuantity;
  DB.update('exp_bookings', bookingId, {
    receivedQuantity: newTotalReceived,
    status: newTotalReceived >= (Number(booking.quantity) || 0) ? 'received' : 'partial'
  });

  showToast(`${formatKG(receivedQuantity)} ${booking.unit} ${booking.mineral} warehouse mein receive ho gaya!`, 'success');

  document.getElementById('expReceivingForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderReceivingsTable();
  renderWarehouseStockBanner();
  renderExportDashboard();
}

function getExpRawWarehouseStock() {
  const receivings = DB.get('exp_receivings') || [];
  const productions = DB.get('exp_production') || [];

  const stockMap = {};
  receivings.forEach(r => {
    const key = `${r.mineral}|||${r.warehouse || 'Main Export Yard'}`;
    if (!stockMap[key]) {
      stockMap[key] = { mineral: r.mineral, warehouse: r.warehouse || 'Main Export Yard', totalReceivedTon: 0 };
    }
    const q = Number(r.receivedQuantity) || 0;
    const ton = r.unit === 'TON' ? q : q / 1000.0;
    stockMap[key].totalReceivedTon += ton;
  });

  productions.forEach(p => {
    const key = `${p.mineral}|||${p.warehouse || 'Main Export Yard'}`;
    if (stockMap[key]) {
      const inp = Number(p.inputQuantity) || 0;
      const ton = p.unit === 'TON' ? inp : inp / 1000.0;
      stockMap[key].totalReceivedTon -= ton;
    }
  });

  return Object.values(stockMap).map(s => ({
    mineral: s.mineral,
    warehouse: s.warehouse,
    availableTon: Math.max(0, s.totalReceivedTon)
  }));
}

function renderWarehouseStockBanner() {
  const banner = document.getElementById('warehouseStockSummaryBanner');
  if (!banner) return;

  const stocks = getExpRawWarehouseStock();
  if (stocks.length === 0 || stocks.every(s => s.availableTon <= 0)) {
    banner.innerHTML = '<span style="opacity:0.8;font-size:13px;">Warehouse khali hai. Maal receive karein ge to yahan dikhega.</span>';
    return;
  }

  banner.innerHTML = stocks.map(s => `
    <div style="background:rgba(255,255,255,0.12);padding:10px 16px;border-radius:var(--radius-md);border:1px solid rgba(255,255,255,0.2);">
      <div style="font-size:11px;opacity:0.8;text-transform:uppercase;">${escapeHtml(s.mineral)} (${escapeHtml(s.warehouse)})</div>
      <div style="font-size:20px;font-weight:800;color:#52b788;">${formatTON(s.availableTon)} TON</div>
      <div style="font-size:11px;opacity:0.7;">Raw Stock Maujood</div>
    </div>
  `).join('');
}

function renderReceivingsTable() {
  const container = document.getElementById('rcvTableBody');
  if (!container) return;

  const receivings = DB.get('exp_receivings') || [];
  receivings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (receivings.length === 0) {
    container.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color:var(--text-muted);">Koi receiving record nahi mila.</td></tr>`;
    return;
  }

  container.innerHTML = receivings.map(r => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td><strong>${escapeHtml(r.bookingNo)}</strong></td>
      <td>${escapeHtml(r.supplierName)}</td>
      <td><span class="badge badge-mineral">${escapeHtml(r.mineral)}</span></td>
      <td><strong>${formatKG(r.receivedQuantity)} ${r.unit}</strong></td>
      <td>${escapeHtml(r.warehouse)}</td>
      <td>${escapeHtml(r.vehicle || '—')} ${r.biltyNo ? `(Bilty: ${escapeHtml(r.biltyNo)})` : ''}</td>
      <td>
        <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deleteReceiving('${escapeHtml(r.id)}')"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function deleteReceiving(id) {
  const r = DB.findById('exp_receivings', id);
  if (!r) return;

  showConfirm('Delete receiving entry?', () => {
    const bookingId = r.bookingId;
    DB.remove('exp_receivings', id);

    if (bookingId) {
      const recTotal = getBookingReceivedTotal(bookingId);
      const b = DB.findById('exp_bookings', bookingId);
      if (b) {
        DB.update('exp_bookings', bookingId, {
          receivedQuantity: recTotal,
          status: recTotal >= (Number(b.quantity) || 0) ? 'received' : (recTotal > 0 ? 'partial' : 'booked')
        });
      }
    }

    showToast('Receiving delete ho gayi.', 'success');
    populateDropdowns();
    renderReceivingsTable();
    renderWarehouseStockBanner();
    renderExportDashboard();
  });
}

/* =============================================
   3. PRODUCTION (PROCESSING & READY YIELD)
   ============================================= */
function saveProduction() {
  const prNo = sanitizeInput(document.getElementById('prNo')?.value || '');
  const dateVal = document.getElementById('prDate')?.value || today();
  const rawSource = document.getElementById('prMineralSource')?.value || '';
  const inputQty = parseFloat(document.getElementById('prInputQty')?.value) || 0;
  const unit = document.getElementById('prUnit')?.value || 'TON';
  const wastageQty = parseFloat(document.getElementById('prWastageQty')?.value) || 0;
  const readyQty = parseFloat(document.getElementById('prReadyQty')?.value) || Math.max(0, inputQty - wastageQty);
  const machine = sanitizeInput(document.getElementById('prMachine')?.value || 'Plant 1');
  const bags = parseInt(document.getElementById('prBags')?.value) || 0;
  const remarks = sanitizeInput(document.getElementById('prRemarks')?.value || '');

  if (!rawSource) { showToast('Warehouse ka raw mineral select karein.', 'error'); return; }
  if (inputQty <= 0) { showToast('Input quantity 0 se bari honi chahiye.', 'error'); return; }

  const [mineral, warehouse] = rawSource.split('|');

  const stocks = getExpRawWarehouseStock();
  const stock = stocks.find(s => s.mineral === mineral && s.warehouse === warehouse);
  const availTon = stock ? stock.availableTon : 0;
  const reqTon = unit === 'TON' ? inputQty : inputQty / 1000.0;

  if (reqTon > availTon + 0.001) {
    showToast(`Warehouse mein raw maal kam hai! Available: ${formatTON(availTon)} TON.`, 'warning');
    return;
  }

  DB.add('exp_production', {
    productionNo: prNo,
    date: dateVal,
    mineral,
    warehouse,
    inputQuantity: inputQty,
    unit,
    wastageQuantity: wastageQty,
    readyQuantity: readyQty,
    machine,
    bags,
    remarks,
    month: dateVal.substring(0, 7)
  });

  showToast(`Batch ${prNo} ready! Warehouse se raw maal deduct hua aur +${formatKG(readyQty)} ${unit} Ready Stock mein add ho gaya.`, 'success');

  document.getElementById('expProductionForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderProductionTable();
  renderWarehouseStockBanner();
  renderReadyStockTable();
  renderExportDashboard();
}

function renderProductionTable() {
  const container = document.getElementById('prTableBody');
  if (!container) return;

  const records = DB.get('exp_production') || [];
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color:var(--text-muted);">Koi production record nahi hai.</td></tr>`;
    return;
  }

  container.innerHTML = records.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.productionNo)}</strong><br><small style="color:var(--text-muted);">${formatDate(p.date)}</small></td>
      <td><span class="badge badge-mineral">${escapeHtml(p.mineral)}</span></td>
      <td>${formatKG(p.inputQuantity)} ${p.unit}</td>
      <td style="color:var(--crimson);">${formatKG(p.wastageQuantity)} ${p.unit}</td>
      <td style="color:var(--emerald);font-weight:700;">+${formatKG(p.readyQuantity)} ${p.unit}</td>
      <td>${p.bags ? `${p.bags} bags` : 'Bulk'}</td>
      <td>${escapeHtml(p.machine)}</td>
      <td>
        <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deleteProduction('${escapeHtml(p.id)}')"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function deleteProduction(id) {
  const p = DB.findById('exp_production', id);
  if (!p) return;

  showConfirm(`Delete Production Batch "${p.productionNo}"?`, () => {
    DB.remove('exp_production', id);
    showToast('Production entry delete ho gayi.', 'success');
    populateDropdowns();
    renderProductionTable();
    renderWarehouseStockBanner();
    renderReadyStockTable();
    renderExportDashboard();
  });
}

/* =============================================
   4. READY STOCK (TAYAR MAAL)
   ============================================= */
function getExpReadyStockSummary() {
  const productions = DB.get('exp_production') || [];
  const sales = DB.get('exp_sales_bookings') || [];

  const summary = {};
  productions.forEach(p => {
    const min = p.mineral;
    if (!summary[min]) summary[min] = { mineral: min, totalReadyTon: 0, soldTon: 0 };
    const q = Number(p.readyQuantity) || 0;
    summary[min].totalReadyTon += (p.unit === 'TON' ? q : q / 1000.0);
  });

  sales.forEach(s => {
    const min = s.mineral;
    if (summary[min]) {
      const q = Number(s.quantity) || 0;
      summary[min].soldTon += (s.unit === 'TON' ? q : q / 1000.0);
    }
  });

  return Object.values(summary).map(s => ({
    mineral: s.mineral,
    totalReadyTon: s.totalReadyTon,
    soldTon: s.soldTon,
    availableTon: Math.max(0, s.totalReadyTon - s.soldTon)
  }));
}

function renderReadyStockTable() {
  const container = document.getElementById('readyStockTableBody');
  if (!container) return;

  const list = getExpReadyStockSummary();
  if (list.length === 0) {
    container.innerHTML = `<tr><td colspan="5" class="text-center py-4" style="color:var(--text-muted);">Koi ready stock nahi hai. Production karke maal tayar karein.</td></tr>`;
    return;
  }

  container.innerHTML = list.map(s => `
    <tr>
      <td><span class="badge badge-mineral" style="font-size:13px;">${escapeHtml(s.mineral)}</span></td>
      <td><strong>${formatTON(s.totalReadyTon)} TON</strong></td>
      <td style="color:var(--copper);">${formatTON(s.soldTon)} TON</td>
      <td style="color:var(--emerald);font-weight:800;font-size:14px;">${formatTON(s.availableTon)} TON</td>
      <td>
        ${s.availableTon > 0 
          ? '<span class="badge badge-status-delivered">Stock Maujood Hai (Sell kar sakte hain)</span>' 
          : '<span class="badge badge-status-booked">Pura Bik Chuka Hai</span>'}
      </td>
    </tr>
  `).join('');
}

/* =============================================
   5. BUYERS & SALE (MAAL BECHNA)
   ============================================= */
function saveSalesBooking() {
  const sbNo = sanitizeInput(document.getElementById('sbBookingNo')?.value || '');
  const dateVal = document.getElementById('sbDate')?.value || today();
  const customerId = document.getElementById('sbCustomer')?.value || '';
  const mineral = document.getElementById('sbMineralSelect')?.value || '';
  const quantity = parseFloat(document.getElementById('sbQuantity')?.value) || 0;
  const unit = document.getElementById('sbUnit')?.value || 'TON';
  const rate = parseFloat(document.getElementById('sbRate')?.value) || 0;
  const totalSaleAmount = quantity * rate;
  const paymentTerms = document.getElementById('sbPaymentTerms')?.value || 'credit';
  const destinationCountry = sanitizeInput(document.getElementById('sbCountry')?.value || '');
  const remarks = sanitizeInput(document.getElementById('sbRemarks')?.value || '');

  if (!customerId) { showToast('Buyer select karein ya naya buyer add karein.', 'error'); return; }
  if (!mineral) { showToast('Ready mineral select karein.', 'error'); return; }
  if (quantity <= 0) { showToast('Quantity 0 se bari honi chahiye.', 'error'); return; }
  if (rate <= 0) { showToast('Rate enter karein.', 'error'); return; }

  // Negative Stock Check
  const stocks = getExpReadyStockSummary();
  const stock = stocks.find(s => s.mineral === mineral);
  const availTon = stock ? stock.availableTon : 0;
  const reqTon = unit === 'TON' ? quantity : quantity / 1000.0;

  if (reqTon > availTon + 0.001) {
    showToast(`Tayar maal kam hai! Available: ${formatTON(availTon)} TON.`, 'warning');
    return;
  }

  const customer = DB.findById('exp_customers', customerId);
  const customerName = customer ? customer.name : 'Buyer';

  const sale = DB.add('exp_sales_bookings', {
    bookingNo: sbNo,
    date: dateVal,
    customerId,
    customerName,
    mineral,
    quantity,
    unit,
    rate,
    totalSaleAmount,
    paymentTerms,
    destinationCountry,
    remarks,
    month: dateVal.substring(0, 7)
  });

  // Agar Cash Sale hai to Income mein Cash In ho
  if (paymentTerms === 'cash') {
    DB.add('income', {
      month: dateVal.substring(0, 7),
      date: dateVal,
      description: `Export Cash Sale: ${mineral} (${formatKG(quantity)} ${unit}) - ${customerName} [${sbNo}]`,
      reference: sbNo,
      amount: totalSaleAmount,
      source: 'exp_sales_booking',
      expSalesBookingId: sale.id
    });
  }

  showToast(`Sale Invoice ${sbNo} save ho gaya! Ready stock se minus ho gaya.`, 'success');

  document.getElementById('expSalesBookingForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderSalesBookingsTable();
  renderReadyStockTable();
  renderCustomersList();
  renderExportDashboard();
}

function renderSalesBookingsTable() {
  const container = document.getElementById('sbTableBody');
  if (!container) return;

  const sales = DB.get('exp_sales_bookings') || [];
  sales.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (sales.length === 0) {
    container.innerHTML = `<tr><td colspan="9" class="text-center py-4" style="color:var(--text-muted);">Koi sale order nahi hai. Upar se sale karein.</td></tr>`;
    return;
  }

  container.innerHTML = sales.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.bookingNo)}</strong><br><small style="color:var(--text-muted);">${formatDate(s.date)}</small></td>
      <td><strong>${escapeHtml(s.customerName)}</strong></td>
      <td><span class="badge badge-mineral">${escapeHtml(s.mineral)}</span></td>
      <td>${formatKG(s.quantity)} <strong>${s.unit}</strong></td>
      <td>PKR ${formatCurrency(s.rate)}/${s.unit}</td>
      <td><strong>PKR ${formatCurrency(s.totalSaleAmount)}</strong></td>
      <td>${s.paymentTerms === 'cash' ? '<span class="badge badge-status-cash">Naqad (Cash)</span>' : '<span class="badge badge-status-credit">Udhaar (Credit)</span>'}</td>
      <td>
        <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deleteSalesBooking('${escapeHtml(s.id)}')"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function deleteSalesBooking(id) {
  const s = DB.findById('exp_sales_bookings', id);
  if (!s) return;

  showConfirm(`Delete Sale Order "${s.bookingNo}"? Ready stock wapas barh jayega.`, () => {
    if (s.paymentTerms === 'cash') {
      const linked = DB.filter('income', i => i.expSalesBookingId === id || i.reference === s.bookingNo);
      linked.forEach(i => DB.remove('income', i.id));
    }
    DB.remove('exp_sales_bookings', id);
    showToast('Sale order delete ho gaya.', 'success');
    populateDropdowns();
    renderSalesBookingsTable();
    renderReadyStockTable();
    renderCustomersList();
    renderExportDashboard();
  });
}

function renderCustomersList() {
  const container = document.getElementById('customersCardsGrid');
  if (!container) return;

  const customers = DB.get('exp_customers') || [];
  if (customers.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-4" style="color:var(--text-muted);">Koi buyer registered nahi hai.</div>`;
    return;
  }

  container.innerHTML = customers.map(c => {
    const sales = DB.filter('exp_sales_bookings', s => s.customerId === c.id);
    const totalSalesPKR = sales.reduce((sum, s) => sum + (Number(s.totalSaleAmount) || 0), 0);
    const creditSalesPKR = sales.filter(s => s.paymentTerms === 'credit')
                                .reduce((sum, s) => sum + (Number(s.totalSaleAmount) || 0), 0);
    const totalTon = sales.reduce((sum, s) => sum + (s.unit === 'TON' ? (Number(s.quantity) || 0) : (Number(s.quantity) || 0) / 1000.0), 0);

    return `
      <div class="export-item-card">
        <div class="export-item-card-header">
          <div>
            <div class="export-item-card-title"><i class="fas fa-user-tie" style="color:var(--teal);margin-right:6px;"></i>${escapeHtml(c.name)}</div>
            <div class="export-item-card-sub"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(c.country)} • <i class="fas fa-phone"></i> ${escapeHtml(c.contact || '—')}</div>
          </div>
        </div>
        <div class="export-item-body">
          <div class="export-item-row">
            <span class="lbl">Total Maal Diya:</span>
            <span class="val">${formatTON(totalTon)} TON (${sales.length} Orders)</span>
          </div>
          <div class="export-item-row">
            <span class="lbl">Total Sale Value:</span>
            <span class="val">PKR ${formatCurrency(totalSalesPKR)}</span>
          </div>
          <div class="export-item-row" style="border-top:1px dashed var(--color-border);padding-top:6px;margin-top:4px;">
            <span class="lbl"><strong>Baqi Udhaar (Receivable):</strong></span>
            <span class="val" style="color:var(--crimson);font-size:14px;"><strong>PKR ${formatCurrency(creditSalesPKR)}</strong></span>
          </div>
        </div>
        <div class="export-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="openBuyerLedgerModal('${escapeHtml(c.id)}')"><i class="fas fa-file-invoice"></i> Khata Record</button>
          <button class="btn btn-secondary btn-sm btn-action-danger" onclick="deleteCustomer('${escapeHtml(c.id)}')"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

function deleteCustomer(id) {
  const c = DB.findById('exp_customers', id);
  if (!c) return;

  showConfirm(`Delete Buyer "${c.name}"?`, () => {
    DB.remove('exp_customers', id);
    showToast('Buyer delete ho gaya.', 'success');
    populateDropdowns();
    renderCustomersList();
    renderExportDashboard();
  });
}

function openBuyerLedgerModal(customerId) {
  const c = DB.findById('exp_customers', customerId);
  if (!c) return;

  document.getElementById('custLedgerModalTitle').textContent = `${c.name} — Khata Record (Statement of Account)`;
  const tbody = document.getElementById('custLedgerTableBody');
  if (!tbody) return;

  const sales = DB.filter('exp_sales_bookings', s => s.customerId === customerId);
  sales.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let runningBal = 0;
  tbody.innerHTML = sales.map(s => {
    const saleAmt = Number(s.totalSaleAmount) || 0;
    const paidAmt = s.paymentTerms === 'cash' ? saleAmt : 0;
    runningBal += (saleAmt - paidAmt);

    return `
      <tr>
        <td>${formatDate(s.date)}</td>
        <td><strong>${escapeHtml(s.bookingNo)}</strong></td>
        <td>${escapeHtml(s.mineral)} (${formatKG(s.quantity)} ${s.unit}) [${s.paymentTerms.toUpperCase()}]</td>
        <td style="color:var(--crimson);">PKR ${formatCurrency(saleAmt)}</td>
        <td style="color:var(--emerald);">${paidAmt > 0 ? 'PKR ' + formatCurrency(paidAmt) : '—'}</td>
        <td><strong>PKR ${formatCurrency(runningBal)}</strong></td>
      </tr>
    `;
  }).join('');

  const totalSales = sales.reduce((sum, s) => sum + (Number(s.totalSaleAmount) || 0), 0);
  const totalPaid = sales.filter(s => s.paymentTerms === 'cash').reduce((sum, s) => sum + (Number(s.totalSaleAmount) || 0), 0);
  const balance = totalSales - totalPaid;

  document.getElementById('custLedgerSummaryTotal').innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:12px;background:var(--color-surface-2);border-radius:var(--radius-md);margin-top:12px;font-size:13px;">
      <div>Total Sale: <strong>PKR ${formatCurrency(totalSales)}</strong></div>
      <div>Paid: <strong style="color:var(--emerald);">PKR ${formatCurrency(totalPaid)}</strong></div>
      <div>Baqi Udhaar: <strong style="color:var(--crimson);font-size:14px;">PKR ${formatCurrency(balance)}</strong></div>
    </div>
  `;

  openModal('custLedgerModal');
}

/* =============================================
   6. KHARCHAY & ASAL MUNAFA (PROFIT)
   ============================================= */
function saveSimpleExpense() {
  const expenseType = document.getElementById('expKharchaType')?.value || 'Transport';
  const dateVal = document.getElementById('expKharchaDate')?.value || today();
  const amount = parseFloat(document.getElementById('expKharchaAmount')?.value) || 0;
  const paymentMethod = document.getElementById('expKharchaPayment')?.value || 'cash';
  const remarks = sanitizeInput(document.getElementById('expKharchaRemarks')?.value || '');

  if (amount <= 0) { showToast('Amount enter karein.', 'error'); return; }

  const exp = DB.add('exp_material_expenses', {
    expenseType,
    date: dateVal,
    amount,
    paymentMethod,
    remarks,
    month: dateVal.substring(0, 7)
  });

  if (paymentMethod === 'cash') {
    DB.add('expenses', {
      month: dateVal.substring(0, 7),
      date: dateVal,
      description: `Export Kharcha (${expenseType}): ${remarks || ''}`,
      reference: 'EXP-KHARCHA',
      amount,
      source: 'exp_material_expense',
      expMatExpId: exp.id
    });
  }

  showToast(`Kharcha of PKR ${formatCurrency(amount)} save ho gaya!`, 'success');
  document.getElementById('expSimpleExpenseForm').reset();
  setFormDefaults();
  renderExpensesTable();
  renderProfitAnalysis();
  renderExportDashboard();
}

function renderExpensesTable() {
  const container = document.getElementById('expKharchayTableBody');
  if (!container) return;

  const expenses = DB.get('exp_material_expenses') || [];
  expenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (expenses.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center py-4" style="color:var(--text-muted);">Koi kharcha record nahi hai.</td></tr>`;
    return;
  }

  container.innerHTML = expenses.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td><strong>${escapeHtml(e.expenseType)}</strong></td>
      <td><strong>PKR ${formatCurrency(e.amount)}</strong></td>
      <td>${e.paymentMethod === 'cash' ? '<span class="badge badge-status-cash">Naqad (Cash)</span>' : '<span class="badge badge-status-credit">Khata / Udhar</span>'}</td>
      <td>${escapeHtml(e.remarks || '—')}</td>
      <td>
        <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deleteExpense('${escapeHtml(e.id)}')"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function deleteExpense(id) {
  const exp = DB.findById('exp_material_expenses', id);
  if (!exp) return;

  showConfirm('Delete kharcha?', () => {
    if (exp.paymentMethod === 'cash') {
      const linked = DB.filter('expenses', e => e.expMatExpId === id);
      linked.forEach(e => DB.remove('expenses', e.id));
    }
    DB.remove('exp_material_expenses', id);
    showToast('Kharcha delete ho gaya.', 'success');
    renderExpensesTable();
    renderProfitAnalysis();
    renderExportDashboard();
  });
}

function renderProfitAnalysis() {
  const sales = DB.get('exp_sales_bookings') || [];
  const purchases = DB.get('exp_bookings') || [];
  const expenses = DB.get('exp_material_expenses') || [];

  const totalSalesPKR = sales.reduce((s, b) => s + (Number(b.totalSaleAmount) || 0), 0);
  const totalPurchasesPKR = purchases.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const totalExpensesPKR = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const netProfit = totalSalesPKR - totalPurchasesPKR - totalExpensesPKR;

  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setT('pfGrossSales', `PKR ${formatCurrency(totalSalesPKR)}`);
  setT('pfPurchaseCost', `PKR ${formatCurrency(totalPurchasesPKR)}`);
  setT('pfTotalExpenses', `PKR ${formatCurrency(totalExpensesPKR)}`);
  setT('pfNetProfit', `PKR ${formatCurrency(netProfit)}`);

  const profitEl = document.getElementById('pfNetProfit');
  if (profitEl) profitEl.style.color = netProfit >= 0 ? '#52b788' : '#ff6b6b';
}

/* =============================================
   DASHBOARD OVERVIEW & CHARTS
   ============================================= */
function renderExportDashboard() {
  const rawStock = getExpRawWarehouseStock();
  const rawTon = rawStock.reduce((s, r) => s + r.availableTon, 0);

  const productions = DB.get('exp_production') || [];
  const prodTon = productions.reduce((s, p) => s + (p.unit === 'TON' ? (Number(p.inputQuantity) || 0) : (Number(p.inputQuantity) || 0) / 1000.0), 0);

  const readyStock = getExpReadyStockSummary();
  const readyTon = readyStock.reduce((s, r) => s + r.availableTon, 0);
  const soldTon = readyStock.reduce((s, r) => s + r.soldTon, 0);

  const sales = DB.get('exp_sales_bookings') || [];
  const purchases = DB.get('exp_bookings') || [];
  const expenses = DB.get('exp_material_expenses') || [];

  const totalSales = sales.reduce((s, b) => s + (Number(b.totalSaleAmount) || 0), 0);
  const totalPurchases = purchases.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netProfit = totalSales - totalPurchases - totalExpenses;

  const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setEl('kpiRawStock', `${formatTON(rawTon)} TON`);
  setEl('kpiProductionStock', `${formatTON(prodTon)} TON`);
  setEl('kpiReadyStock', `${formatTON(readyTon)} TON`);
  setEl('kpiSoldStock', `${formatTON(soldTon)} TON`);
  setEl('kpiTotalPurchases', `PKR ${formatCurrency(totalPurchases)}`);
  setEl('kpiTotalSales', `PKR ${formatCurrency(totalSales)}`);
  setEl('kpiTotalExpenses', `PKR ${formatCurrency(totalExpenses)}`);
  setEl('kpiExportProfit', `PKR ${formatCurrency(netProfit)}`);

  const profitKpi = document.getElementById('kpiExportProfit');
  if (profitKpi) profitKpi.style.color = netProfit >= 0 ? 'var(--emerald)' : 'var(--crimson)';

  renderDashboardChart(totalPurchases, totalSales, totalExpenses, netProfit);
}

function renderDashboardChart(purchases, sales, expenses, profit) {
  if (typeof Chart === 'undefined') return;

  const ctx = document.getElementById('chartExportFinancials')?.getContext('2d');
  if (!ctx) return;

  if (_expChartProfit) _expChartProfit.destroy();
  _expChartProfit = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Kharidari (Purchases)', 'Kharchay (Expenses)', 'Farokht (Sales)', 'Asal Munafa (Net Profit)'],
      datasets: [{
        label: 'PKR Amount',
        data: [purchases, expenses, sales, Math.max(0, profit)],
        backgroundColor: ['#e76f51', '#f4a261', '#2a9d8f', '#52b788'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: v => 'Rs ' + formatCurrency(v) } }
      }
    }
  });
}

function renderAllExportViews() {
  renderExportDashboard();
  renderPurchaseBookingsTable();
  renderReceivingsTable();
  renderWarehouseStockBanner();
  renderProductionTable();
  renderReadyStockTable();
  renderSalesBookingsTable();
  renderCustomersList();
  renderExpensesTable();
  renderProfitAnalysis();
}
