/* =============================================
   ARHAM TRADERS — EXPORT MODULE CONTROLLER
   js/export.js
   ============================================= */

/* ---- Global State for Export Module ---- */
let _expActiveTab = 'dashboard';
let _expFilterDateFrom = '';
let _expFilterDateTo = '';
let _expFilterSupplier = '';
let _expFilterCustomer = '';
let _expFilterMineral = '';
let _expFilterStatus = '';

/* Chart Instances */
let _expChartProfit = null;
let _expChartContainers = null;
let _expChartMinerals = null;

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
  bindFilters();
  renderAllExportViews();
}

/* =============================================
   NUMBER GENERATORS
   ============================================= */
function generateExpBookingNo() {
  const list = DB.get('exp_bookings');
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(list.length + 1).padStart(4, '0');
  return `EXP-PB-${year}${month}-${seq}`;
}

function generateExpProductionNo() {
  const list = DB.get('exp_production');
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(list.length + 1).padStart(4, '0');
  return `EXP-PR-${year}${month}-${seq}`;
}

function generateExpSalesBookingNo() {
  const list = DB.get('exp_sales_bookings');
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(list.length + 1).padStart(4, '0');
  return `EXP-SB-${year}${month}-${seq}`;
}

function generateExpPaymentNo() {
  const list = DB.get('exp_payments');
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(list.length + 1).padStart(4, '0');
  return `EXP-PAY-${year}${month}-${seq}`;
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

  // Check URL hash for direct tab navigation
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

  // Re-render specific views when opened
  if (tabName === 'dashboard') renderExportDashboard();
  if (tabName === 'profit') renderProfitAnalysis();
  if (tabName === 'reports') renderExportReports();
}

/* =============================================
   SET FORM DEFAULTS
   ============================================= */
function setFormDefaults() {
  const todayStr = today();
  const now = new Date();
  const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  // Set today's date in all date fields
  document.querySelectorAll('input[type="date"]').forEach(inp => {
    if (!inp.value) inp.value = todayStr;
  });
  document.querySelectorAll('input[type="datetime-local"]').forEach(inp => {
    if (!inp.value) inp.value = localIso;
  });

  // Auto set Generated IDs
  const pbNo = document.getElementById('pbBookingNo');
  if (pbNo && !pbNo.value) pbNo.value = generateExpBookingNo();

  const prNo = document.getElementById('prNo');
  if (prNo && !prNo.value) prNo.value = generateExpProductionNo();

  const sbNo = document.getElementById('sbBookingNo');
  if (sbNo && !sbNo.value) sbNo.value = generateExpSalesBookingNo();

  const payNo = document.getElementById('payReceiptNo');
  if (payNo && !payNo.value) payNo.value = generateExpPaymentNo();
}

/* =============================================
   POPULATE ALL DROPDOWNS
   ============================================= */
function populateDropdowns() {
  const suppliers = DB.get('suppliers') || [];
  const customers = DB.get('exp_customers') || [];
  const pBookings = DB.get('exp_bookings') || [];
  const sBookings = DB.get('exp_sales_bookings') || [];
  const containers = DB.get('exp_containers') || [];

  // 1. Suppliers dropdowns
  const supOptions = '<option value="">— Select Supplier —</option>' +
    suppliers.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');
  
  const filterSupOpts = '<option value="">All Suppliers</option>' +
    suppliers.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');

  ['pbSupplier', 'matExpSupplier', 'rcvSupplierFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = supOptions;
  });
  const fSup = document.getElementById('expFilterSupplier');
  if (fSup) fSup.innerHTML = filterSupOpts;

  // 2. Customers dropdowns
  const custOptions = '<option value="">— Select Customer —</option>' +
    customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.country || 'International')})</option>`).join('');

  const filterCustOpts = '<option value="">All Customers</option>' +
    customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');

  ['sbCustomer', 'cntCustomer', 'shipExpCustomer', 'payCustomer', 'custLedgerSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = custOptions;
  });
  const fCust = document.getElementById('expFilterCustomer');
  if (fCust) fCust.innerHTML = filterCustOpts;

  // 3. Purchase Bookings dropdowns (for receiving & inward expenses)
  const pbOptions = '<option value="">— Select Purchase Booking —</option>' +
    pBookings.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.bookingNo)} - ${escapeHtml(b.supplierName)} (${escapeHtml(b.mineral)} - ${formatKG(b.quantity)} ${b.unit})</option>`).join('');
  
  ['rcvBookingId', 'matExpBookingId'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = pbOptions;
  });

  // 4. Sales Bookings dropdowns (for container & shipment expenses)
  const sbOptions = '<option value="">— Select Sales Booking —</option>' +
    sBookings.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.bookingNo)} - ${escapeHtml(s.customerName)} (${escapeHtml(s.mineral)} - ${formatKG(s.quantity)} ${s.unit})</option>`).join('');

  ['cntSalesBookingId', 'shipExpSalesBookingId', 'paySalesBookingId'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = sbOptions;
  });

  // 5. Container dropdowns (for payments & expenses)
  const cntOptions = '<option value="">— Select Container (Optional) —</option>' +
    containers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.containerNo)} (${escapeHtml(c.mineral)} - ${escapeHtml(c.status)})</option>`).join('');

  ['shipExpContainerId', 'payContainerId'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = cntOptions;
  });

  // 6. Minerals in Warehouse for Production
  populateProductionMineralSource();
}

function populateProductionMineralSource() {
  const stock = getExpRawWarehouseStock();
  const prSel = document.getElementById('prMineralSource');
  if (!prSel) return;

  if (stock.length === 0) {
    prSel.innerHTML = '<option value="">No raw minerals in warehouse</option>';
    return;
  }

  prSel.innerHTML = '<option value="">— Select Raw Stock Batch —</option>' +
    stock.filter(s => s.availableTon > 0 || s.availableKG > 0).map(s => 
      `<option value="${escapeHtml(s.mineral)}|${escapeHtml(s.warehouse)}" data-ton="${s.availableTon}" data-kg="${s.availableKG}">
        ${escapeHtml(s.mineral)} (${escapeHtml(s.warehouse)}) — Available: ${formatTON(s.availableTon)} TON (${formatKG(s.availableKG)} KG)
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
  const pbUnit = document.getElementById('pbUnit');
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
  pbUnit?.addEventListener('change', calcPB);

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

  // 3. Sales Booking Total Calculation & Bag Weight
  const sbQty = document.getElementById('sbQuantity');
  const sbRate = document.getElementById('sbRate');
  const sbBags = document.getElementById('sbBags');
  const sbBagWt = document.getElementById('sbBagWeight');
  const sbTotal = document.getElementById('sbTotal');
  const sbCalcDisplay = document.getElementById('sbCalcTotal');

  const calcSB = () => {
    const q = parseFloat(sbQty?.value) || 0;
    const r = parseFloat(sbRate?.value) || 0;
    const total = q * r;
    if (sbTotal) sbTotal.value = total.toFixed(2);
    if (sbCalcDisplay) sbCalcDisplay.textContent = 'PKR ' + formatCurrency(total);

    // Auto calculate bags if bag weight entered
    const bWt = parseFloat(sbBagWt?.value) || 0;
    const unit = document.getElementById('sbUnit')?.value || 'TON';
    if (bWt > 0 && q > 0) {
      const totalKG = unit === 'TON' ? q * 1000 : q;
      const bags = Math.ceil(totalKG / bWt);
      if (sbBags && !sbBags.value) sbBags.value = bags;
    }
  };
  sbQty?.addEventListener('input', calcSB);
  sbRate?.addEventListener('input', calcSB);
  sbBagWt?.addEventListener('input', calcSB);
  document.getElementById('sbUnit')?.addEventListener('change', calcSB);

  // 4. Container Bags & Weight Calculation
  const cntBags = document.getElementById('cntBags');
  const cntBagWt = document.getElementById('cntBagWeight');
  const cntTotalKG = document.getElementById('cntTotalKG');
  const cntTotalTon = document.getElementById('cntTotalTon');

  const calcContainerWeight = () => {
    const bags = parseFloat(cntBags?.value) || 0;
    const bagWt = parseFloat(cntBagWt?.value) || 0;
    const totalKG = bags * bagWt;
    const totalTon = totalKG / 1000;
    if (cntTotalKG) cntTotalKG.value = totalKG.toFixed(2);
    if (cntTotalTon) cntTotalTon.value = totalTon.toFixed(3);
  };
  cntBags?.addEventListener('input', calcContainerWeight);
  cntBagWt?.addEventListener('input', calcContainerWeight);

  // 5. Foreign Payment Currency Converter
  const payForeignAmt = document.getElementById('payForeignAmount');
  const payExchangeRate = document.getElementById('payExchangeRate');
  const payPKRAmt = document.getElementById('payPKRAmount');
  const payConvertPreview = document.getElementById('payConvertPreview');

  const calcPaymentPKR = () => {
    const fAmt = parseFloat(payForeignAmt?.value) || 0;
    const rate = parseFloat(payExchangeRate?.value) || 1;
    const pkr = fAmt * rate;
    if (payPKRAmt) payPKRAmt.value = pkr.toFixed(2);
    const curr = document.getElementById('payCurrency')?.value || 'USD';
    if (payConvertPreview) {
      payConvertPreview.textContent = `${curr} ${formatCurrency(fAmt)} × ${rate} = PKR ${formatCurrency(pkr)}`;
    }
  };
  payForeignAmt?.addEventListener('input', calcPaymentPKR);
  payExchangeRate?.addEventListener('input', calcPaymentPKR);
  document.getElementById('payCurrency')?.addEventListener('change', calcPaymentPKR);

  // 6. Auto fill details on Receiving Booking Select
  const rcvBookingSel = document.getElementById('rcvBookingId');
  if (rcvBookingSel) {
    rcvBookingSel.addEventListener('change', () => {
      const bId = rcvBookingSel.value;
      const booking = DB.findById('exp_bookings', bId);
      if (booking) {
        document.getElementById('rcvSupplierDisplay').value = booking.supplierName;
        document.getElementById('rcvMineralDisplay').value = booking.mineral;
        document.getElementById('rcvWarehouse').value = booking.warehouse || 'Main Export Yard';
        
        // Calculate remaining
        const receivings = DB.filter('exp_receivings', r => r.bookingId === bId);
        const receivedTotal = receivings.reduce((s, r) => s + (Number(r.receivedQuantity) || 0), 0);
        const remaining = Math.max(0, (Number(booking.quantity) || 0) - receivedTotal);
        
        document.getElementById('rcvPendingDisplay').value = `${formatKG(remaining)} ${booking.unit} remaining (out of ${formatKG(booking.quantity)} ${booking.unit})`;
        const rcvQty = document.getElementById('rcvQuantity');
        if (rcvQty) {
          rcvQty.value = remaining > 0 ? remaining : 0;
          document.getElementById('rcvUnitDisplay').textContent = booking.unit;
        }
      }
    });
  }

  // 7. Auto fill details on Sales Booking Select for Container
  const cntSalesBookingSel = document.getElementById('cntSalesBookingId');
  if (cntSalesBookingSel) {
    cntSalesBookingSel.addEventListener('change', () => {
      const sbId = cntSalesBookingSel.value;
      const sb = DB.findById('exp_sales_bookings', sbId);
      if (sb) {
        if (document.getElementById('cntCustomer')) document.getElementById('cntCustomer').value = sb.customerId;
        if (document.getElementById('cntMineral')) document.getElementById('cntMineral').value = sb.mineral;
        if (document.getElementById('cntDestinationCountry')) document.getElementById('cntDestinationCountry').value = sb.destinationCountry || '';
        if (document.getElementById('cntPort')) document.getElementById('cntPort').value = sb.destinationPort || '';
        if (document.getElementById('cntBagWeight') && sb.bagWeight) document.getElementById('cntBagWeight').value = sb.bagWeight;
        if (document.getElementById('cntBags') && sb.bags) document.getElementById('cntBags').value = sb.bags;
        calcContainerWeight();
      }
    });
  }
}

/* =============================================
   FORM SUBMISSION HANDLERS
   ============================================= */
function bindForms() {
  // 1. Purchase Booking Form
  document.getElementById('expPurchaseBookingForm')?.addEventListener('submit', e => {
    e.preventDefault();
    savePurchaseBooking();
  });

  // 2. Receiving Form
  document.getElementById('expReceivingForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveWarehouseReceiving();
  });

  // 3. Material Expense Form
  document.getElementById('expMaterialExpenseForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveMaterialExpense();
  });

  // 4. Production Form
  document.getElementById('expProductionForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveProduction();
  });

  // 5. Customer Form
  document.getElementById('expCustomerForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveCustomer();
  });

  // 6. Sales Booking Form
  document.getElementById('expSalesBookingForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveSalesBooking();
  });

  // 7. Container Form
  document.getElementById('expContainerForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveContainer();
  });

  // 8. Shipment Expense Form
  document.getElementById('expShipmentExpenseForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveShipmentExpense();
  });

  // 9. Payment Form
  document.getElementById('expPaymentForm')?.addEventListener('submit', e => {
    e.preventDefault();
    savePayment();
  });
}

/* =============================================
   MODULE 1: SUPPLIER PURCHASE BOOKING
   ============================================= */
function savePurchaseBooking() {
  const bookingNo = sanitizeInput(document.getElementById('pbBookingNo')?.value || '');
  const receiptNo = sanitizeInput(document.getElementById('pbReceiptNo')?.value || '');
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

  // Validation
  if (!bookingNo) { showToast('Booking Number is required.', 'error'); return; }
  if (!supplierId) { showToast('Please select a Supplier.', 'error'); return; }
  if (!mineral) { showToast('Please enter/select Mineral Type.', 'error'); return; }
  if (quantity <= 0) { showToast('Quantity must be greater than 0.', 'error'); return; }
  if (rate <= 0) { showToast('Rate must be greater than 0.', 'error'); return; }

  // Check duplicate booking number
  const dups = DB.filter('exp_bookings', b => b.bookingNo === bookingNo);
  if (dups.length > 0) {
    showToast('Booking Number already exists. Regenerating...', 'warning');
    document.getElementById('pbBookingNo').value = generateExpBookingNo();
    return;
  }

  const supplier = DB.findById('suppliers', supplierId);
  const supplierName = supplier ? supplier.name : 'Unknown Supplier';

  const booking = DB.add('exp_bookings', {
    bookingNo,
    receiptNo: receiptNo || bookingNo,
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

  // Accounting Integration: If Cash, post Cash Out entry in existing expenses table safely
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

  showToast(`Export Purchase Booking ${bookingNo} saved successfully!`, 'success');

  // Reset & Refresh
  document.getElementById('expPurchaseBookingForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderPurchaseBookingsTable();
  renderExportDashboard();
}

function renderPurchaseBookingsTable() {
  const container = document.getElementById('pbTableBody');
  if (!container) return;

  let bookings = DB.get('exp_bookings') || [];

  // Apply filters
  if (_expFilterSupplier) bookings = bookings.filter(b => b.supplierId === _expFilterSupplier);
  if (_expFilterMineral) bookings = bookings.filter(b => (b.mineral || '').toLowerCase().includes(_expFilterMineral.toLowerCase()));
  if (_expFilterDateFrom) bookings = bookings.filter(b => b.date >= _expFilterDateFrom);
  if (_expFilterDateTo) bookings = bookings.filter(b => b.date <= _expFilterDateTo);

  // Sort latest first
  bookings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (bookings.length === 0) {
    container.innerHTML = `<tr><td colspan="10" class="text-center py-4" style="color:var(--text-muted);"><i class="fas fa-inbox fa-2x mb-2"></i><br>No Export Purchase Bookings found.</td></tr>`;
    return;
  }

  container.innerHTML = bookings.map((b, idx) => {
    const payBadge = b.paymentType === 'cash' ? '<span class="badge badge-status-cash">Cash</span>' : '<span class="badge badge-status-credit">Credit</span>';
    const recTotal = getBookingReceivedTotal(b.id);
    const rem = Math.max(0, (Number(b.quantity) || 0) - recTotal);
    const recBadge = rem === 0 ? '<span class="badge badge-status-delivered">Fully Received</span>' : (recTotal > 0 ? '<span class="badge badge-status-booked">Partial</span>' : '<span class="badge badge-status-ready">Pending</span>');

    return `
      <tr>
        <td><strong>${escapeHtml(b.bookingNo)}</strong><br><small style="color:var(--text-muted);">${formatDate(b.date)}</small></td>
        <td><strong>${escapeHtml(b.supplierName)}</strong></td>
        <td><span class="badge badge-mineral">${escapeHtml(b.mineral)}</span></td>
        <td>${formatKG(b.quantity)} <strong>${b.unit}</strong></td>
        <td>PKR ${formatCurrency(b.rate)}/${b.unit}</td>
        <td><strong>PKR ${formatCurrency(b.totalAmount)}</strong></td>
        <td>${payBadge}</td>
        <td>${escapeHtml(b.warehouse || '—')}</td>
        <td>${recBadge}<br><small>${formatKG(recTotal)} / ${formatKG(b.quantity)} ${b.unit}</small></td>
        <td>
          <div class="action-btn-group">
            <button class="btn-action-icon" title="Print Slip" onclick="printExportPurchaseSlip('${escapeHtml(b.id)}')"><i class="fas fa-print"></i></button>
            <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deletePurchaseBooking('${escapeHtml(b.id)}')"><i class="fas fa-trash-alt"></i></button>
          </div>
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

  showConfirm(`Delete Purchase Booking "${b.bookingNo}"? Any attached receiving and expenses will also be affected.`, () => {
    // 1. Remove linked cash expense if cash
    if (b.paymentType === 'cash') {
      const linkedExp = DB.filter('expenses', e => e.reference === b.bookingNo || e.expBookingId === id);
      linkedExp.forEach(e => DB.remove('expenses', e.id));
    }
    // 2. Remove purchase booking
    DB.remove('exp_bookings', id);
    showToast('Purchase booking deleted.', 'success');
    populateDropdowns();
    renderPurchaseBookingsTable();
    renderExportDashboard();
  });
}

/* =============================================
   MODULE 2: WAREHOUSE RECEIVING
   ============================================= */
function saveWarehouseReceiving() {
  const bookingId = document.getElementById('rcvBookingId')?.value || '';
  const dateVal = document.getElementById('rcvDate')?.value || today();
  const receivedQuantity = parseFloat(document.getElementById('rcvQuantity')?.value) || 0;
  const warehouse = sanitizeInput(document.getElementById('rcvWarehouse')?.value || 'Main Export Yard');
  const vehicle = sanitizeInput(document.getElementById('rcvVehicle')?.value || '');
  const biltyNo = sanitizeInput(document.getElementById('rcvBiltyNo')?.value || '');
  const remarks = sanitizeInput(document.getElementById('rcvRemarks')?.value || '');

  if (!bookingId) { showToast('Please select a Purchase Booking.', 'error'); return; }
  if (receivedQuantity <= 0) { showToast('Received quantity must be greater than 0.', 'error'); return; }

  const booking = DB.findById('exp_bookings', bookingId);
  if (!booking) { showToast('Selected booking not found.', 'error'); return; }

  const alreadyReceived = getBookingReceivedTotal(bookingId);
  const remaining = Math.max(0, (Number(booking.quantity) || 0) - alreadyReceived);

  if (receivedQuantity > remaining + 0.0001) {
    showToast(`Cannot receive more than remaining balance (${formatKG(remaining)} ${booking.unit}).`, 'warning');
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
    remarks,
    month: dateVal.substring(0, 7)
  });

  // Update booking status
  const newTotalReceived = alreadyReceived + receivedQuantity;
  DB.update('exp_bookings', bookingId, {
    receivedQuantity: newTotalReceived,
    status: newTotalReceived >= (Number(booking.quantity) || 0) ? 'received' : 'partial'
  });

  showToast(`Received ${formatKG(receivedQuantity)} ${booking.unit} into ${warehouse}!`, 'success');

  document.getElementById('expReceivingForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderReceivingsTable();
  renderExportDashboard();
}

function renderReceivingsTable() {
  const container = document.getElementById('rcvTableBody');
  if (!container) return;

  let receivings = DB.get('exp_receivings') || [];
  receivings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (receivings.length === 0) {
    container.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color:var(--text-muted);">No warehouse receiving records yet.</td></tr>`;
    return;
  }

  container.innerHTML = receivings.map(r => `
    <tr>
      <td><strong>${formatDate(r.date)}</strong></td>
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

  showConfirm('Delete this receiving record? Warehouse stock balance will be adjusted.', () => {
    const bookingId = r.bookingId;
    DB.remove('exp_receivings', id);

    if (bookingId) {
      const recTotal = getBookingReceivedTotal(bookingId);
      const booking = DB.findById('exp_bookings', bookingId);
      if (booking) {
        DB.update('exp_bookings', bookingId, {
          receivedQuantity: recTotal,
          status: recTotal >= (Number(booking.quantity) || 0) ? 'received' : (recTotal > 0 ? 'partial' : 'booked')
        });
      }
    }

    showToast('Receiving record removed.', 'success');
    populateDropdowns();
    renderReceivingsTable();
    renderExportDashboard();
  });
}

/* =============================================
   MODULE 3: MATERIAL INWARD EXPENSES
   ============================================= */
function saveMaterialExpense() {
  const bookingId = document.getElementById('matExpBookingId')?.value || '';
  const expenseType = document.getElementById('matExpType')?.value || 'Transport';
  const dateVal = document.getElementById('matExpDate')?.value || today();
  const amount = parseFloat(document.getElementById('matExpAmount')?.value) || 0;
  const paymentMethod = document.getElementById('matExpPaymentMethod')?.value || 'cash';
  const supplierId = document.getElementById('matExpSupplier')?.value || '';
  const remarks = sanitizeInput(document.getElementById('matExpRemarks')?.value || '');

  if (!bookingId) { showToast('Please select an Export Purchase Booking.', 'error'); return; }
  if (amount <= 0) { showToast('Amount must be greater than 0.', 'error'); return; }

  const booking = DB.findById('exp_bookings', bookingId);
  const targetSupplierId = supplierId || (booking ? booking.supplierId : '');
  const supplier = DB.findById('suppliers', targetSupplierId);
  const supplierName = supplier ? supplier.name : (booking ? booking.supplierName : 'Supplier');

  const exp = DB.add('exp_material_expenses', {
    bookingId,
    bookingNo: booking ? booking.bookingNo : '—',
    mineral: booking ? booking.mineral : '—',
    expenseType,
    date: dateVal,
    amount,
    paymentMethod,
    supplierId: targetSupplierId,
    supplierName,
    remarks,
    month: dateVal.substring(0, 7)
  });

  // If Cash payment method, post Cash Out to general expenses
  if (paymentMethod === 'cash') {
    DB.add('expenses', {
      month: dateVal.substring(0, 7),
      date: dateVal,
      description: `Inward ${expenseType}: ${booking ? booking.bookingNo : ''} (${supplierName})`,
      reference: booking ? booking.bookingNo : 'EXP-MAT-EXP',
      amount,
      source: 'exp_material_expense',
      expMatExpId: exp.id
    });
  }

  showToast(`Material Expense of PKR ${formatCurrency(amount)} saved!`, 'success');

  document.getElementById('expMaterialExpenseForm').reset();
  setFormDefaults();
  renderMaterialExpensesTable();
  renderExportDashboard();
}

function renderMaterialExpensesTable() {
  const container = document.getElementById('matExpTableBody');
  if (!container) return;

  let expenses = DB.get('exp_material_expenses') || [];
  expenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (expenses.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color:var(--text-muted);">No material expenses recorded.</td></tr>`;
    return;
  }

  container.innerHTML = expenses.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td><strong>${escapeHtml(e.bookingNo)}</strong></td>
      <td><span class="badge badge-mineral">${escapeHtml(e.expenseType)}</span></td>
      <td><strong>PKR ${formatCurrency(e.amount)}</strong></td>
      <td>${e.paymentMethod === 'cash' ? '<span class="badge badge-status-cash">Cash Out</span>' : '<span class="badge badge-status-credit">Supplier Ledger</span>'}</td>
      <td>${escapeHtml(e.supplierName || '—')}<br><small style="color:var(--text-muted);">${escapeHtml(e.remarks || '')}</small></td>
      <td>
        <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deleteMaterialExpense('${escapeHtml(e.id)}')"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function deleteMaterialExpense(id) {
  const exp = DB.findById('exp_material_expenses', id);
  if (!exp) return;

  showConfirm('Delete this material expense?', () => {
    if (exp.paymentMethod === 'cash') {
      const linked = DB.filter('expenses', e => e.expMatExpId === id || (e.reference === exp.bookingNo && e.source === 'exp_material_expense'));
      linked.forEach(e => DB.remove('expenses', e.id));
    }
    DB.remove('exp_material_expenses', id);
    showToast('Material expense deleted.', 'success');
    renderMaterialExpensesTable();
    renderExportDashboard();
  });
}

/* =============================================
   MODULE 4 & 5: PRODUCTION & READY STOCK
   ============================================= */
function getExpRawWarehouseStock() {
  const receivings = DB.get('exp_receivings') || [];
  const productions = DB.get('exp_production') || [];

  // Group receiving by Mineral & Warehouse
  const stockMap = {};
  receivings.forEach(r => {
    const key = `${r.mineral}|||${r.warehouse || 'Main Export Yard'}`;
    if (!stockMap[key]) {
      stockMap[key] = { mineral: r.mineral, warehouse: r.warehouse || 'Main Export Yard', totalReceivedTon: 0, totalReceivedKG: 0 };
    }
    const q = Number(r.receivedQuantity) || 0;
    if (r.unit === 'TON') {
      stockMap[key].totalReceivedTon += q;
      stockMap[key].totalReceivedKG += q * 1000;
    } else {
      stockMap[key].totalReceivedKG += q;
      stockMap[key].totalReceivedTon += q / 1000;
    }
  });

  // Deduct productions
  productions.forEach(p => {
    const key = `${p.mineral}|||${p.warehouse || 'Main Export Yard'}`;
    if (stockMap[key]) {
      const inp = Number(p.inputQuantity) || 0;
      if (p.unit === 'TON') {
        stockMap[key].totalReceivedTon -= inp;
        stockMap[key].totalReceivedKG -= inp * 1000;
      } else {
        stockMap[key].totalReceivedKG -= inp;
        stockMap[key].totalReceivedTon -= inp / 1000;
      }
    }
  });

  return Object.values(stockMap).map(s => ({
    mineral: s.mineral,
    warehouse: s.warehouse,
    availableTon: Math.max(0, s.totalReceivedTon),
    availableKG: Math.max(0, s.totalReceivedKG)
  }));
}

function saveProduction() {
  const prNo = sanitizeInput(document.getElementById('prNo')?.value || '');
  const dateVal = document.getElementById('prDate')?.value || today();
  const rawSource = document.getElementById('prMineralSource')?.value || '';
  const inputQty = parseFloat(document.getElementById('prInputQty')?.value) || 0;
  const unit = document.getElementById('prUnit')?.value || 'TON';
  const machine = sanitizeInput(document.getElementById('prMachine')?.value || 'Plant 1');
  const wastageQty = parseFloat(document.getElementById('prWastageQty')?.value) || 0;
  const readyQty = parseFloat(document.getElementById('prReadyQty')?.value) || Math.max(0, inputQty - wastageQty);
  const bags = parseInt(document.getElementById('prBags')?.value) || 0;
  const bagWeight = parseFloat(document.getElementById('prBagWeight')?.value) || 50;
  const remarks = sanitizeInput(document.getElementById('prRemarks')?.value || '');

  if (!prNo) { showToast('Production number is required.', 'error'); return; }
  if (!rawSource) { showToast('Please select Raw Mineral batch.', 'error'); return; }
  if (inputQty <= 0) { showToast('Input quantity must be greater than 0.', 'error'); return; }

  const [mineral, warehouse] = rawSource.split('|');

  // Verify stock availability
  const currentStocks = getExpRawWarehouseStock();
  const stock = currentStocks.find(s => s.mineral === mineral && s.warehouse === warehouse);
  const availableInput = unit === 'TON' ? (stock ? stock.availableTon : 0) : (stock ? stock.availableKG : 0);

  if (inputQty > availableInput + 0.001) {
    showToast(`Insufficient raw mineral stock! Available: ${formatKG(availableInput)} ${unit}.`, 'warning');
    return;
  }

  DB.add('exp_production', {
    productionNo: prNo,
    date: dateVal,
    mineral,
    warehouse,
    inputQuantity: inputQty,
    unit,
    machine,
    wastageQuantity: wastageQty,
    readyQuantity: readyQty,
    bags,
    bagWeight,
    remarks,
    month: dateVal.substring(0, 7)
  });

  // Ready Stock Entry / Batch
  DB.add('exp_ready_stock', {
    productionNo: prNo,
    date: dateVal,
    mineral,
    warehouse,
    quantity: readyQty,
    unit,
    bags,
    bagWeight,
    reservedQuantity: 0,
    status: 'available'
  });

  showToast(`Production entry ${prNo} recorded. +${formatKG(readyQty)} ${unit} Ready Stock added!`, 'success');

  document.getElementById('expProductionForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderProductionTable();
  renderReadyStockTable();
  renderExportDashboard();
}

function renderProductionTable() {
  const container = document.getElementById('prTableBody');
  if (!container) return;

  let records = DB.get('exp_production') || [];
  records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color:var(--text-muted);">No production records found.</td></tr>`;
    return;
  }

  container.innerHTML = records.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.productionNo)}</strong><br><small style="color:var(--text-muted);">${formatDate(p.date)}</small></td>
      <td><span class="badge badge-mineral">${escapeHtml(p.mineral)}</span></td>
      <td>${escapeHtml(p.warehouse)}<br><small>${escapeHtml(p.machine)}</small></td>
      <td>${formatKG(p.inputQuantity)} ${p.unit}</td>
      <td style="color:var(--crimson);">${formatKG(p.wastageQuantity)} ${p.unit}</td>
      <td style="color:var(--emerald);font-weight:700;">+${formatKG(p.readyQuantity)} ${p.unit}</td>
      <td>${p.bags ? `${p.bags} bags × ${p.bagWeight} kg` : 'Bulk'}</td>
      <td>
        <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deleteProduction('${escapeHtml(p.id)}')"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function deleteProduction(id) {
  const p = DB.findById('exp_production', id);
  if (!p) return;

  showConfirm(`Delete Production Entry "${p.productionNo}"? Ready stock created by this batch will be adjusted.`, () => {
    // Check if sales bookings are using ready stock from this production
    const readyStock = DB.filter('exp_ready_stock', rs => rs.productionNo === p.productionNo);
    readyStock.forEach(rs => DB.remove('exp_ready_stock', rs.id));
    DB.remove('exp_production', id);

    showToast('Production entry deleted.', 'success');
    populateDropdowns();
    renderProductionTable();
    renderReadyStockTable();
    renderExportDashboard();
  });
}

function getExpReadyStockSummary() {
  const readyBatches = DB.get('exp_ready_stock') || [];
  const salesBookings = DB.get('exp_sales_bookings') || [];

  // Group by Mineral
  const summary = {};
  readyBatches.forEach(b => {
    const min = b.mineral;
    if (!summary[min]) {
      summary[min] = { mineral: min, totalTon: 0, totalKG: 0, bags: 0, reservedTon: 0, reservedKG: 0 };
    }
    const q = Number(b.quantity) || 0;
    if (b.unit === 'TON') {
      summary[min].totalTon += q;
      summary[min].totalKG += q * 1000;
    } else {
      summary[min].totalKG += q;
      summary[min].totalTon += q / 1000;
    }
    summary[min].bags += (Number(b.bags) || 0);
  });

  // Calculate booked/reserved from sales bookings
  salesBookings.forEach(sb => {
    const min = sb.mineral;
    if (summary[min]) {
      const q = Number(sb.quantity) || 0;
      if (sb.unit === 'TON') {
        summary[min].reservedTon += q;
        summary[min].reservedKG += q * 1000;
      } else {
        summary[min].reservedKG += q;
        summary[min].reservedTon += q / 1000;
      }
    }
  });

  return Object.values(summary).map(s => ({
    mineral: s.mineral,
    totalTon: s.totalTon,
    totalKG: s.totalKG,
    reservedTon: s.reservedTon,
    reservedKG: s.reservedKG,
    availableTon: Math.max(0, s.totalTon - s.reservedTon),
    availableKG: Math.max(0, s.totalKG - s.reservedKG),
    bags: s.bags
  }));
}

function renderReadyStockTable() {
  const container = document.getElementById('readyStockTableBody');
  if (!container) return;

  const stocks = getExpReadyStockSummary();

  if (stocks.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color:var(--text-muted);">No ready stock available. Process minerals in Production.</td></tr>`;
    return;
  }

  container.innerHTML = stocks.map(s => `
    <tr>
      <td><span class="badge badge-mineral" style="font-size:13px;">${escapeHtml(s.mineral)}</span></td>
      <td><strong>${formatTON(s.totalTon)} TON</strong><br><small style="color:var(--text-muted);">${formatKG(s.totalKG)} KG</small></td>
      <td>${s.bags ? `${formatKG(s.bags)} Bags` : 'Bulk / Loose'}</td>
      <td style="color:var(--copper);font-weight:600;">${formatTON(s.reservedTon)} TON</td>
      <td style="color:var(--emerald);font-weight:800;font-size:14px;">${formatTON(s.availableTon)} TON</td>
      <td>
        ${s.availableTon > 0 
          ? '<span class="badge badge-status-delivered">Available for Export</span>' 
          : '<span class="badge badge-status-booked">Fully Reserved</span>'}
      </td>
    </tr>
  `).join('');
}

/* =============================================
   MODULE 6: EXPORT CUSTOMERS / BUYERS
   ============================================= */
function saveCustomer() {
  const name = sanitizeInput(document.getElementById('custName')?.value || '');
  const country = sanitizeInput(document.getElementById('custCountry')?.value || '');
  const port = sanitizeInput(document.getElementById('custPort')?.value || '');
  const currency = document.getElementById('custCurrency')?.value || 'USD';
  const contact = sanitizeInput(document.getElementById('custContact')?.value || '');
  const email = sanitizeInput(document.getElementById('custEmail')?.value || '');
  const address = sanitizeInput(document.getElementById('custAddress')?.value || '');

  if (!name) { showToast('Customer/Company Name is required.', 'error'); return; }

  DB.add('exp_customers', {
    name,
    country: country || 'International',
    port,
    currency,
    contact,
    email,
    address
  });

  showToast(`Export Customer "${name}" registered successfully!`, 'success');

  document.getElementById('expCustomerForm').reset();
  populateDropdowns();
  renderCustomersList();
  renderExportDashboard();
}

function renderCustomersList() {
  const container = document.getElementById('customersCardsGrid');
  if (!container) return;

  const customers = DB.get('exp_customers') || [];

  if (customers.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-5" style="color:var(--text-muted);"><i class="fas fa-users fa-3x mb-3"></i><p>No export buyers registered yet. Add your first foreign buyer above.</p></div>`;
    return;
  }

  container.innerHTML = customers.map(c => {
    const stats = getCustomerFinancialSummary(c.id);
    const balanceClass = stats.outstandingBalance > 0 ? 'color:var(--crimson);' : 'color:var(--emerald);';

    return `
      <div class="export-item-card">
        <div class="export-item-card-header">
          <div>
            <div class="export-item-card-title">${escapeHtml(c.name)}</div>
            <div class="export-item-card-sub"><i class="fas fa-globe"></i> ${escapeHtml(c.country)} ${c.port ? `• ${escapeHtml(c.port)}` : ''}</div>
          </div>
          <span class="badge badge-mineral">${escapeHtml(c.currency || 'USD')}</span>
        </div>
        <div class="export-item-body">
          <div class="export-item-row">
            <span class="lbl">Export Bookings:</span>
            <span class="val">${stats.bookingCount} (${formatTON(stats.totalTon)} TON)</span>
          </div>
          <div class="export-item-row">
            <span class="lbl">Total Sales:</span>
            <span class="val">PKR ${formatCurrency(stats.totalSalesPKR)}</span>
          </div>
          <div class="export-item-row">
            <span class="lbl">Customer Expenses:</span>
            <span class="val">PKR ${formatCurrency(stats.totalExpensesPKR)}</span>
          </div>
          <div class="export-item-row">
            <span class="lbl">Payments Received:</span>
            <span class="val" style="color:var(--emerald);">PKR ${formatCurrency(stats.totalPaymentsPKR)}</span>
          </div>
          <div class="export-item-row" style="border-top:1px dashed var(--color-border);padding-top:6px;margin-top:4px;">
            <span class="lbl"><strong>Outstanding Balance:</strong></span>
            <span class="val" style="${balanceClass};font-size:14px;"><strong>PKR ${formatCurrency(stats.outstandingBalance)}</strong></span>
          </div>
        </div>
        <div class="export-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="openCustomerLedgerModal('${escapeHtml(c.id)}')"><i class="fas fa-file-invoice"></i> Ledger</button>
          <button class="btn btn-secondary btn-sm btn-action-danger" onclick="deleteCustomer('${escapeHtml(c.id)}')"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

function getCustomerFinancialSummary(customerId) {
  const salesBookings = DB.filter('exp_sales_bookings', s => s.customerId === customerId);
  const shipmentExpenses = DB.filter('exp_shipment_expenses', e => e.customerId === customerId && e.paymentMethod === 'customer_account');
  const payments = DB.filter('exp_payments', p => p.customerId === customerId);

  const totalSalesPKR = salesBookings.reduce((s, b) => s + (Number(b.totalSaleAmount) || 0), 0);
  const totalExpensesPKR = shipmentExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalPaymentsPKR = payments.reduce((s, p) => s + (Number(p.pkrAmount) || 0), 0);

  const totalTon = salesBookings.reduce((s, b) => s + (b.unit === 'TON' ? (Number(b.quantity) || 0) : (Number(b.quantity) || 0) / 1000), 0);
  const outstandingBalance = (totalSalesPKR + totalExpensesPKR) - totalPaymentsPKR;

  return {
    bookingCount: salesBookings.length,
    totalTon,
    totalSalesPKR,
    totalExpensesPKR,
    totalPaymentsPKR,
    outstandingBalance
  };
}

function deleteCustomer(id) {
  const c = DB.findById('exp_customers', id);
  if (!c) return;

  showConfirm(`Delete Customer "${c.name}"?`, () => {
    DB.remove('exp_customers', id);
    showToast('Customer deleted.', 'success');
    populateDropdowns();
    renderCustomersList();
    renderExportDashboard();
  });
}

function openCustomerLedgerModal(customerId) {
  const cust = DB.findById('exp_customers', customerId);
  if (!cust) return;

  const titleEl = document.getElementById('custLedgerModalTitle');
  if (titleEl) titleEl.textContent = `${cust.name} (${cust.country || 'Export'}) — Statement of Account`;

  const tbody = document.getElementById('custLedgerTableBody');
  if (!tbody) return;

  const salesBookings = DB.filter('exp_sales_bookings', s => s.customerId === customerId);
  const shipmentExpenses = DB.filter('exp_shipment_expenses', e => e.customerId === customerId && e.paymentMethod === 'customer_account');
  const payments = DB.filter('exp_payments', p => p.customerId === customerId);

  // Combine into single chronological ledger
  const entries = [];
  salesBookings.forEach(sb => {
    entries.push({
      date: sb.date,
      type: 'Sales Booking',
      ref: sb.bookingNo,
      desc: `Export Sale: ${sb.mineral} (${formatKG(sb.quantity)} ${sb.unit})`,
      debit: Number(sb.totalSaleAmount) || 0,
      credit: 0
    });
  });

  shipmentExpenses.forEach(se => {
    entries.push({
      date: se.date,
      type: 'Billed Expense',
      ref: se.containerNo || 'EXP-EXP',
      desc: `Shipment ${se.expenseType}`,
      debit: Number(se.amount) || 0,
      credit: 0
    });
  });

  payments.forEach(p => {
    entries.push({
      date: p.date,
      type: 'Payment Received',
      ref: p.receiptNo || 'PAY-RCV',
      desc: `Foreign Payment: ${p.currency} ${formatCurrency(p.foreignAmount)} @ ${p.exchangeRate} (${p.bankOrCash || 'Bank'})`,
      debit: 0,
      credit: Number(p.pkrAmount) || 0
    });
  });

  entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let runningBal = 0;
  tbody.innerHTML = entries.map(e => {
    runningBal += (e.debit - e.credit);
    return `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td><strong>${escapeHtml(e.type)}</strong><br><small style="color:var(--text-muted);">${escapeHtml(e.ref)}</small></td>
        <td>${escapeHtml(e.desc)}</td>
        <td style="color:var(--crimson);">${e.debit > 0 ? 'PKR ' + formatCurrency(e.debit) : '—'}</td>
        <td style="color:var(--emerald);">${e.credit > 0 ? 'PKR ' + formatCurrency(e.credit) : '—'}</td>
        <td><strong>PKR ${formatCurrency(runningBal)}</strong></td>
      </tr>
    `;
  }).join('');

  const stats = getCustomerFinancialSummary(customerId);
  const sumEl = document.getElementById('custLedgerSummaryTotal');
  if (sumEl) {
    sumEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:20px;font-size:13px;margin-top:12px;padding:12px;background:var(--color-surface-2);border-radius:var(--radius-md);">
        <div>Total Sales: <strong>PKR ${formatCurrency(stats.totalSalesPKR)}</strong></div>
        <div>Customer Expenses: <strong>PKR ${formatCurrency(stats.totalExpensesPKR)}</strong></div>
        <div>Payments Received: <strong style="color:var(--emerald);">PKR ${formatCurrency(stats.totalPaymentsPKR)}</strong></div>
        <div>Net Receivable: <strong style="color:var(--crimson);font-size:14px;">PKR ${formatCurrency(stats.outstandingBalance)}</strong></div>
      </div>
    `;
  }

  openModal('custLedgerModal');
}

/* =============================================
   MODULE 7: SALES / EXPORT BOOKING
   ============================================= */
function saveSalesBooking() {
  const sbNo = sanitizeInput(document.getElementById('sbBookingNo')?.value || '');
  const dateVal = document.getElementById('sbDate')?.value || today();
  const customerId = document.getElementById('sbCustomer')?.value || '';
  const mineral = sanitizeInput(document.getElementById('sbMineral')?.value || '');
  const quantity = parseFloat(document.getElementById('sbQuantity')?.value) || 0;
  const unit = document.getElementById('sbUnit')?.value || 'TON';
  const bags = parseInt(document.getElementById('sbBags')?.value) || 0;
  const bagWeight = parseFloat(document.getElementById('sbBagWeight')?.value) || 50;
  const rate = parseFloat(document.getElementById('sbRate')?.value) || 0;
  const totalSaleAmount = quantity * rate;
  const paymentTerms = document.getElementById('sbPaymentTerms')?.value || 'credit';
  const destinationCountry = sanitizeInput(document.getElementById('sbCountry')?.value || '');
  const destinationPort = sanitizeInput(document.getElementById('sbPort')?.value || '');
  const remarks = sanitizeInput(document.getElementById('sbRemarks')?.value || '');

  if (!sbNo) { showToast('Sales Booking number is required.', 'error'); return; }
  if (!customerId) { showToast('Please select a Customer / Buyer.', 'error'); return; }
  if (!mineral) { showToast('Please enter Mineral Type.', 'error'); return; }
  if (quantity <= 0) { showToast('Quantity must be greater than 0.', 'error'); return; }
  if (rate <= 0) { showToast('Rate must be greater than 0.', 'error'); return; }

  // Check Ready Stock availability (Negative stock prevention)
  const readyStocks = getExpReadyStockSummary();
  const stock = readyStocks.find(s => s.mineral.toLowerCase() === mineral.toLowerCase());
  const availableTon = stock ? stock.availableTon : 0;
  const reqTon = unit === 'TON' ? quantity : quantity / 1000;

  if (reqTon > availableTon + 0.001) {
    showToast(`Insufficient ready stock! Available for ${mineral}: ${formatTON(availableTon)} TON. Requested: ${formatTON(reqTon)} TON.`, 'warning');
    return;
  }

  const customer = DB.findById('exp_customers', customerId);
  const customerName = customer ? customer.name : 'Unknown Customer';

  const booking = DB.add('exp_sales_bookings', {
    bookingNo: sbNo,
    date: dateVal,
    customerId,
    customerName,
    mineral,
    quantity,
    unit,
    bags,
    bagWeight,
    rate,
    totalSaleAmount,
    paymentTerms,
    destinationCountry: destinationCountry || (customer ? customer.country : ''),
    destinationPort: destinationPort || (customer ? customer.port : ''),
    remarks,
    containerStatus: 'pending',
    month: dateVal.substring(0, 7)
  });

  // Accounting Integration: If Cash sale, post Cash In entry to Income table safely
  if (paymentTerms === 'cash') {
    DB.add('income', {
      month: dateVal.substring(0, 7),
      date: dateVal,
      description: `Export Cash Sale: ${mineral} (${formatKG(quantity)} ${unit}) - ${customerName} [${sbNo}]`,
      reference: sbNo,
      amount: totalSaleAmount,
      source: 'exp_sales_booking',
      expSalesBookingId: booking.id
    });
  }

  showToast(`Export Sales Booking ${sbNo} saved! Quantity reserved from Ready Stock.`, 'success');

  document.getElementById('expSalesBookingForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderSalesBookingsTable();
  renderReadyStockTable();
  renderExportDashboard();
}

function renderSalesBookingsTable() {
  const container = document.getElementById('sbTableBody');
  if (!container) return;

  let bookings = DB.get('exp_sales_bookings') || [];
  bookings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (bookings.length === 0) {
    container.innerHTML = `<tr><td colspan="9" class="text-center py-4" style="color:var(--text-muted);">No Export Sales Bookings found.</td></tr>`;
    return;
  }

  container.innerHTML = bookings.map(b => `
    <tr>
      <td><strong>${escapeHtml(b.bookingNo)}</strong><br><small style="color:var(--text-muted);">${formatDate(b.date)}</small></td>
      <td><strong>${escapeHtml(b.customerName)}</strong></td>
      <td><span class="badge badge-mineral">${escapeHtml(b.mineral)}</span></td>
      <td>${formatKG(b.quantity)} <strong>${b.unit}</strong><br><small>${b.bags ? `${b.bags} bags` : ''}</small></td>
      <td>PKR ${formatCurrency(b.rate)}/${b.unit}</td>
      <td><strong>PKR ${formatCurrency(b.totalSaleAmount)}</strong></td>
      <td>${b.paymentTerms === 'cash' ? '<span class="badge badge-status-cash">Cash Sale</span>' : '<span class="badge badge-status-credit">Credit Sale</span>'}</td>
      <td>${escapeHtml(b.destinationCountry || '—')} ${b.destinationPort ? `(${escapeHtml(b.destinationPort)})` : ''}</td>
      <td>
        <div class="action-btn-group">
          <button class="btn-action-icon" title="Print Order Slip" onclick="printExportSalesSlip('${escapeHtml(b.id)}')"><i class="fas fa-print"></i></button>
          <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deleteSalesBooking('${escapeHtml(b.id)}')"><i class="fas fa-trash-alt"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function deleteSalesBooking(id) {
  const b = DB.findById('exp_sales_bookings', id);
  if (!b) return;

  showConfirm(`Delete Sales Booking "${b.bookingNo}"? Ready stock reservation will be released.`, () => {
    if (b.paymentTerms === 'cash') {
      const linkedInc = DB.filter('income', i => i.reference === b.bookingNo || i.expSalesBookingId === id);
      linkedInc.forEach(i => DB.remove('income', i.id));
    }
    DB.remove('exp_sales_bookings', id);
    showToast('Sales booking deleted.', 'success');
    populateDropdowns();
    renderSalesBookingsTable();
    renderReadyStockTable();
    renderExportDashboard();
  });
}

/* =============================================
   MODULE 8: CONTAINER MANAGEMENT
   ============================================= */
function saveContainer() {
  const containerNo = sanitizeInput(document.getElementById('cntContainerNo')?.value || '');
  const containerSize = document.getElementById('cntSize')?.value || '20ft';
  const sealNo = sanitizeInput(document.getElementById('cntSealNo')?.value || '');
  const salesBookingId = document.getElementById('cntSalesBookingId')?.value || '';
  const customerId = document.getElementById('cntCustomer')?.value || '';
  const mineral = sanitizeInput(document.getElementById('cntMineral')?.value || '');
  const bags = parseInt(document.getElementById('cntBags')?.value) || 0;
  const bagWeight = parseFloat(document.getElementById('cntBagWeight')?.value) || 50;
  const totalKG = parseFloat(document.getElementById('cntTotalKG')?.value) || (bags * bagWeight);
  const totalTon = parseFloat(document.getElementById('cntTotalTon')?.value) || (totalKG / 1000);
  const vehicle = sanitizeInput(document.getElementById('cntVehicle')?.value || '');
  const stuffingDate = document.getElementById('cntStuffingDate')?.value || today();
  const port = sanitizeInput(document.getElementById('cntPort')?.value || 'Karachi Port');
  const destinationCountry = sanitizeInput(document.getElementById('cntDestinationCountry')?.value || '');
  const shipmentDate = document.getElementById('cntShipmentDate')?.value || '';
  const status = document.getElementById('cntStatus')?.value || 'Ready';

  if (!containerNo) { showToast('Container Number is required.', 'error'); return; }
  if (bags <= 0) { showToast('Number of bags must be greater than 0.', 'error'); return; }

  const customer = DB.findById('exp_customers', customerId);
  const customerName = customer ? customer.name : 'Export Buyer';

  const sb = DB.findById('exp_sales_bookings', salesBookingId);
  const bookingNo = sb ? sb.bookingNo : 'Direct';

  DB.add('exp_containers', {
    containerNo,
    containerSize,
    sealNo,
    salesBookingId,
    bookingNo,
    customerId,
    customerName,
    mineral,
    bags,
    bagWeight,
    totalKG,
    totalTon,
    vehicle,
    stuffingDate,
    port,
    destinationCountry,
    shipmentDate,
    status,
    month: stuffingDate.substring(0, 7)
  });

  showToast(`Container ${containerNo} (${totalTon} TON) registered!`, 'success');

  document.getElementById('expContainerForm').reset();
  setFormDefaults();
  populateDropdowns();
  renderContainersView();
  renderExportDashboard();
}

function renderContainersView() {
  const container = document.getElementById('containersGrid');
  if (!container) return;

  let list = DB.get('exp_containers') || [];
  list.sort((a, b) => (b.stuffingDate || '').localeCompare(a.stuffingDate || ''));

  if (list.length === 0) {
    container.innerHTML = `<div class="col-12 text-center py-5" style="color:var(--text-muted);"><i class="fas fa-ship fa-3x mb-3"></i><p>No export containers created yet.</p></div>`;
    return;
  }

  container.innerHTML = list.map(c => {
    const statusClass = `badge-status-${(c.status || 'ready').toLowerCase()}`;
    const steps = ['Ready', 'Booked', 'Stuffed', 'Shipped', 'Delivered'];
    const currentIdx = steps.indexOf(c.status || 'Ready');

    return `
      <div class="export-item-card">
        <div class="export-item-card-header">
          <div>
            <div class="export-item-card-title"><i class="fas fa-box"></i> ${escapeHtml(c.containerNo)}</div>
            <div class="export-item-card-sub">${escapeHtml(c.containerSize)} • Seal: ${escapeHtml(c.sealNo || '—')}</div>
          </div>
          <span class="badge ${statusClass}">${escapeHtml(c.status)}</span>
        </div>

        <div class="container-stepper">
          ${steps.map((st, i) => `
            <div class="stepper-step ${i < currentIdx ? 'completed' : (i === currentIdx ? 'active' : '')}">
              <div class="stepper-circle">${i < currentIdx ? '<i class="fas fa-check"></i>' : (i + 1)}</div>
              <span>${st}</span>
            </div>
            ${i < steps.length - 1 ? `<div class="stepper-line ${i < currentIdx ? 'completed' : ''}"></div>` : ''}
          `).join('')}
        </div>

        <div class="export-item-body">
          <div class="export-item-row">
            <span class="lbl">Customer / Order:</span>
            <span class="val">${escapeHtml(c.customerName)} (${escapeHtml(c.bookingNo)})</span>
          </div>
          <div class="export-item-row">
            <span class="lbl">Mineral & Cargo:</span>
            <span class="val"><span class="badge badge-mineral">${escapeHtml(c.mineral)}</span> ${c.bags} bags × ${c.bagWeight} kg</span>
          </div>
          <div class="export-item-row">
            <span class="lbl">Total Weight:</span>
            <span class="val"><strong>${formatTON(c.totalTon)} TON</strong> (${formatKG(c.totalKG)} KG)</span>
          </div>
          <div class="export-item-row">
            <span class="lbl">Route & Port:</span>
            <span class="val">${escapeHtml(c.port)} → ${escapeHtml(c.destinationCountry || 'Intl')}</span>
          </div>
          <div class="export-item-row">
            <span class="lbl">Stuffing / Ship Date:</span>
            <span class="val">${formatDate(c.stuffingDate)} ${c.shipmentDate ? `• Ship: ${formatDate(c.shipmentDate)}` : ''}</span>
          </div>
        </div>

        <div class="export-item-actions">
          <select class="form-control" style="font-size:12px;padding:4px 8px;width:auto;" onchange="updateContainerStatus('${escapeHtml(c.id)}', this.value)">
            ${steps.map(st => `<option value="${st}" ${c.status === st ? 'selected' : ''}>Set Status: ${st}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="printContainerManifest('${escapeHtml(c.id)}')"><i class="fas fa-print"></i> Manifest</button>
          <button class="btn btn-secondary btn-sm btn-action-danger" onclick="deleteContainer('${escapeHtml(c.id)}')"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

function updateContainerStatus(id, newStatus) {
  DB.update('exp_containers', id, { status: newStatus });
  showToast(`Container status updated to "${newStatus}"!`, 'success');
  renderContainersView();
  renderExportDashboard();
}

function deleteContainer(id) {
  const c = DB.findById('exp_containers', id);
  if (!c) return;

  showConfirm(`Delete Container "${c.containerNo}"?`, () => {
    DB.remove('exp_containers', id);
    showToast('Container deleted.', 'success');
    populateDropdowns();
    renderContainersView();
    renderExportDashboard();
  });
}

/* =============================================
   MODULE 9: EXPORT SHIPMENT EXPENSES
   ============================================= */
function saveShipmentExpense() {
  const salesBookingId = document.getElementById('shipExpSalesBookingId')?.value || '';
  const containerId = document.getElementById('shipExpContainerId')?.value || '';
  const expenseType = document.getElementById('shipExpType')?.value || 'Customs';
  const dateVal = document.getElementById('shipExpDate')?.value || today();
  const amount = parseFloat(document.getElementById('shipExpAmount')?.value) || 0;
  const paymentMethod = document.getElementById('shipExpPaymentMethod')?.value || 'cash';
  const customerId = document.getElementById('shipExpCustomer')?.value || '';
  const remarks = sanitizeInput(document.getElementById('shipExpRemarks')?.value || '');

  if (amount <= 0) { showToast('Amount must be greater than 0.', 'error'); return; }

  const sb = DB.findById('exp_sales_bookings', salesBookingId);
  const cnt = DB.findById('exp_containers', containerId);
  const targetCustId = customerId || (sb ? sb.customerId : (cnt ? cnt.customerId : ''));
  const cust = DB.findById('exp_customers', targetCustId);
  const customerName = cust ? cust.name : (sb ? sb.customerName : 'Export Buyer');

  const exp = DB.add('exp_shipment_expenses', {
    salesBookingId,
    bookingNo: sb ? sb.bookingNo : '—',
    containerId,
    containerNo: cnt ? cnt.containerNo : '—',
    expenseType,
    date: dateVal,
    amount,
    paymentMethod,
    customerId: targetCustId,
    customerName,
    remarks,
    month: dateVal.substring(0, 7)
  });

  // If Cash payment, post Cash Out entry to Income & Expense table
  if (paymentMethod === 'cash') {
    DB.add('expenses', {
      month: dateVal.substring(0, 7),
      date: dateVal,
      description: `Export Expense (${expenseType}): ${cnt ? cnt.containerNo : (sb ? sb.bookingNo : '')} [${customerName}]`,
      reference: cnt ? cnt.containerNo : (sb ? sb.bookingNo : 'EXP-SHIP-EXP'),
      amount,
      source: 'exp_shipment_expense',
      expShipExpId: exp.id
    });
  }

  showToast(`Shipment Expense of PKR ${formatCurrency(amount)} logged!`, 'success');

  document.getElementById('expShipmentExpenseForm').reset();
  setFormDefaults();
  renderShipmentExpensesTable();
  renderExportDashboard();
}

function renderShipmentExpensesTable() {
  const container = document.getElementById('shipExpTableBody');
  if (!container) return;

  let list = DB.get('exp_shipment_expenses') || [];
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (list.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color:var(--text-muted);">No export shipment expenses recorded.</td></tr>`;
    return;
  }

  container.innerHTML = list.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td><strong>${escapeHtml(e.expenseType)}</strong></td>
      <td>${escapeHtml(e.bookingNo || '—')}<br><small>${escapeHtml(e.containerNo || '')}</small></td>
      <td><strong>PKR ${formatCurrency(e.amount)}</strong></td>
      <td>${e.paymentMethod === 'cash' ? '<span class="badge badge-status-cash">Cash Out</span>' : '<span class="badge badge-status-credit">Customer Ledger</span>'}</td>
      <td>${escapeHtml(e.customerName || '—')}<br><small style="color:var(--text-muted);">${escapeHtml(e.remarks || '')}</small></td>
      <td>
        <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deleteShipmentExpense('${escapeHtml(e.id)}')"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function deleteShipmentExpense(id) {
  const e = DB.findById('exp_shipment_expenses', id);
  if (!e) return;

  showConfirm('Delete this shipment expense?', () => {
    if (e.paymentMethod === 'cash') {
      const linked = DB.filter('expenses', exp => exp.expShipExpId === id);
      linked.forEach(exp => DB.remove('expenses', exp.id));
    }
    DB.remove('exp_shipment_expenses', id);
    showToast('Expense deleted.', 'success');
    renderShipmentExpensesTable();
    renderExportDashboard();
  });
}

/* =============================================
   MODULE 10: FOREIGN CUSTOMER PAYMENTS
   ============================================= */
function savePayment() {
  const receiptNo = sanitizeInput(document.getElementById('payReceiptNo')?.value || '');
  const customerId = document.getElementById('payCustomer')?.value || '';
  const salesBookingId = document.getElementById('paySalesBookingId')?.value || '';
  const containerId = document.getElementById('payContainerId')?.value || '';
  const currency = document.getElementById('payCurrency')?.value || 'USD';
  const foreignAmount = parseFloat(document.getElementById('payForeignAmount')?.value) || 0;
  const exchangeRate = parseFloat(document.getElementById('payExchangeRate')?.value) || 1;
  const pkrAmount = foreignAmount * exchangeRate;
  const dateVal = document.getElementById('payDate')?.value || today();
  const bankOrCash = document.getElementById('payBankOrCash')?.value || 'Bank Transfer';
  const remarks = sanitizeInput(document.getElementById('payRemarks')?.value || '');

  if (!customerId) { showToast('Please select a Customer.', 'error'); return; }
  if (foreignAmount <= 0) { showToast('Foreign amount must be greater than 0.', 'error'); return; }
  if (exchangeRate <= 0) { showToast('Exchange rate must be valid.', 'error'); return; }

  const customer = DB.findById('exp_customers', customerId);
  const customerName = customer ? customer.name : 'Customer';

  const sb = DB.findById('exp_sales_bookings', salesBookingId);
  const cnt = DB.findById('exp_containers', containerId);

  const payment = DB.add('exp_payments', {
    receiptNo: receiptNo || generateExpPaymentNo(),
    customerId,
    customerName,
    salesBookingId,
    bookingNo: sb ? sb.bookingNo : '—',
    containerId,
    containerNo: cnt ? cnt.containerNo : '—',
    currency,
    foreignAmount,
    exchangeRate,
    pkrAmount,
    date: dateVal,
    bankOrCash,
    remarks,
    month: dateVal.substring(0, 7)
  });

  // Post Income Entry directly into General Income store
  DB.add('income', {
    month: dateVal.substring(0, 7),
    date: dateVal,
    description: `Export Payment Received: ${customerName} (${currency} ${formatCurrency(foreignAmount)} @ ${exchangeRate}) [${payment.receiptNo}]`,
    reference: payment.receiptNo,
    amount: pkrAmount,
    source: 'exp_payment',
    expPaymentId: payment.id
  });

  showToast(`Payment of PKR ${formatCurrency(pkrAmount)} received & credited!`, 'success');

  document.getElementById('expPaymentForm').reset();
  setFormDefaults();
  renderPaymentsTable();
  renderCustomersList();
  renderExportDashboard();
}

function renderPaymentsTable() {
  const container = document.getElementById('paymentsTableBody');
  if (!container) return;

  let list = DB.get('exp_payments') || [];
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (list.length === 0) {
    container.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color:var(--text-muted);">No foreign payments recorded yet.</td></tr>`;
    return;
  }

  container.innerHTML = list.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.receiptNo)}</strong><br><small style="color:var(--text-muted);">${formatDate(p.date)}</small></td>
      <td><strong>${escapeHtml(p.customerName)}</strong></td>
      <td>${escapeHtml(p.bookingNo || '—')}</td>
      <td><span class="badge badge-mineral">${escapeHtml(p.currency)}</span> <strong>${formatCurrency(p.foreignAmount)}</strong></td>
      <td>@ ${p.exchangeRate}</td>
      <td style="color:var(--emerald);font-weight:800;font-size:13.5px;">PKR ${formatCurrency(p.pkrAmount)}</td>
      <td><span class="badge badge-status-ready">${escapeHtml(p.bankOrCash)}</span></td>
      <td>
        <div class="action-btn-group">
          <button class="btn-action-icon" title="Print Receipt" onclick="printPaymentReceiptSlip('${escapeHtml(p.id)}')"><i class="fas fa-print"></i></button>
          <button class="btn-action-icon btn-action-danger" title="Delete" onclick="deletePayment('${escapeHtml(p.id)}')"><i class="fas fa-trash-alt"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

function deletePayment(id) {
  const p = DB.findById('exp_payments', id);
  if (!p) return;

  showConfirm(`Delete Payment "${p.receiptNo}"?`, () => {
    const linkedInc = DB.filter('income', i => i.expPaymentId === id || (i.reference === p.receiptNo && i.source === 'exp_payment'));
    linkedInc.forEach(i => DB.remove('income', i.id));
    DB.remove('exp_payments', id);

    showToast('Payment voucher removed.', 'success');
    renderPaymentsTable();
    renderCustomersList();
    renderExportDashboard();
  });
}

/* =============================================
   MODULE 11: PROFIT ENGINE & ANALYSIS
   ============================================= */
function calculateExportProfitMetrics() {
  const sales = DB.get('exp_sales_bookings') || [];
  const purchases = DB.get('exp_bookings') || [];
  const matExpenses = DB.get('exp_material_expenses') || [];
  const shipExpenses = DB.get('exp_shipment_expenses') || [];

  const totalSalesPKR = sales.reduce((s, b) => s + (Number(b.totalSaleAmount) || 0), 0);
  const totalPurchaseCostPKR = purchases.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const totalMaterialExpensesPKR = matExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalShipmentExpensesPKR = shipExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const totalCosts = totalPurchaseCostPKR + totalMaterialExpensesPKR + totalShipmentExpensesPKR;
  const netProfitPKR = totalSalesPKR - totalCosts;
  const profitMarginPercent = totalSalesPKR > 0 ? ((netProfitPKR / totalSalesPKR) * 100).toFixed(1) : 0;

  return {
    totalSalesPKR,
    totalPurchaseCostPKR,
    totalMaterialExpensesPKR,
    totalShipmentExpensesPKR,
    totalCosts,
    netProfitPKR,
    profitMarginPercent
  };
}

function renderProfitAnalysis() {
  const metrics = calculateExportProfitMetrics();

  const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setT('pfGrossSales', `PKR ${formatCurrency(metrics.totalSalesPKR)}`);
  setT('pfPurchaseCost', `PKR ${formatCurrency(metrics.totalPurchaseCostPKR)}`);
  setT('pfMatExpenses', `PKR ${formatCurrency(metrics.totalMaterialExpensesPKR)}`);
  setT('pfShipExpenses', `PKR ${formatCurrency(metrics.totalShipmentExpensesPKR)}`);
  setT('pfTotalCosts', `PKR ${formatCurrency(metrics.totalCosts)}`);
  setT('pfNetProfit', `PKR ${formatCurrency(metrics.netProfitPKR)}`);
  setT('pfMargin', `${metrics.profitMarginPercent}%`);

  const profitValEl = document.getElementById('pfNetProfit');
  if (profitValEl) {
    profitValEl.style.color = metrics.netProfitPKR >= 0 ? '#52b788' : '#ff6b6b';
  }

  renderBookingWiseProfitTable();
  renderMineralWiseProfitTable();
}

function renderBookingWiseProfitTable() {
  const container = document.getElementById('pfBookingTableBody');
  if (!container) return;

  const sales = DB.get('exp_sales_bookings') || [];

  if (sales.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color:var(--text-muted);">No sales bookings to compute profit.</td></tr>`;
    return;
  }

  container.innerHTML = sales.map(sb => {
    const saleAmt = Number(sb.totalSaleAmount) || 0;
    // Allocated expenses for this booking
    const shipExp = DB.filter('exp_shipment_expenses', e => e.salesBookingId === sb.id)
                      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    
    // Estimate purchase material cost based on mineral purchase rate
    const purchases = DB.filter('exp_bookings', b => (b.mineral || '').toLowerCase() === (sb.mineral || '').toLowerCase());
    const avgPurchaseRate = purchases.length > 0 
      ? (purchases.reduce((s, b) => s + (Number(b.rate) || 0), 0) / purchases.length) 
      : 0;
    
    const matCost = (Number(sb.quantity) || 0) * avgPurchaseRate;
    const netProfit = saleAmt - matCost - shipExp;
    const margin = saleAmt > 0 ? ((netProfit / saleAmt) * 100).toFixed(1) : 0;

    return `
      <tr>
        <td><strong>${escapeHtml(sb.bookingNo)}</strong></td>
        <td>${escapeHtml(sb.customerName)}</td>
        <td><span class="badge badge-mineral">${escapeHtml(sb.mineral)}</span></td>
        <td>PKR ${formatCurrency(saleAmt)}</td>
        <td>PKR ${formatCurrency(matCost)}</td>
        <td>PKR ${formatCurrency(shipExp)}</td>
        <td style="color:${netProfit >= 0 ? 'var(--emerald)' : 'var(--crimson)'};font-weight:700;">
          PKR ${formatCurrency(netProfit)} (${margin}%)
        </td>
      </tr>
    `;
  }).join('');
}

function renderMineralWiseProfitTable() {
  const container = document.getElementById('pfMineralTableBody');
  if (!container) return;

  const sales = DB.get('exp_sales_bookings') || [];
  const purchases = DB.get('exp_bookings') || [];

  const minerals = [...new Set([...sales.map(s => s.mineral), ...purchases.map(p => p.mineral)].filter(Boolean))];

  if (minerals.length === 0) {
    container.innerHTML = `<tr><td colspan="6" class="text-center py-4" style="color:var(--text-muted);">No mineral data available.</td></tr>`;
    return;
  }

  container.innerHTML = minerals.map(min => {
    const minSales = sales.filter(s => (s.mineral || '').toLowerCase() === min.toLowerCase());
    const minPurchases = purchases.filter(p => (p.mineral || '').toLowerCase() === min.toLowerCase());

    const totalSalesTon = minSales.reduce((s, b) => s + (b.unit === 'TON' ? (Number(b.quantity) || 0) : (Number(b.quantity) || 0) / 1000), 0);
    const totalSalesAmt = minSales.reduce((s, b) => s + (Number(b.totalSaleAmount) || 0), 0);
    const totalPurchaseAmt = minPurchases.reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);

    const estProfit = totalSalesAmt - totalPurchaseAmt;

    return `
      <tr>
        <td><span class="badge badge-mineral" style="font-size:13px;">${escapeHtml(min)}</span></td>
        <td><strong>${formatTON(totalSalesTon)} TON</strong></td>
        <td>PKR ${formatCurrency(totalPurchaseAmt)}</td>
        <td>PKR ${formatCurrency(totalSalesAmt)}</td>
        <td style="color:${estProfit >= 0 ? 'var(--emerald)' : 'var(--crimson)'};font-weight:700;">
          PKR ${formatCurrency(estProfit)}
        </td>
      </tr>
    `;
  }).join('');
}

/* =============================================
   MODULE 12: EXPORT DASHBOARD
   ============================================= */
function renderExportDashboard() {
  // 1. Stock Counts
  const rawStock = getExpRawWarehouseStock();
  const rawTon = rawStock.reduce((s, r) => s + r.availableTon, 0);

  const readyStock = getExpReadyStockSummary();
  const readyTon = readyStock.reduce((s, r) => s + r.availableTon, 0);
  const reservedTon = readyStock.reduce((s, r) => s + r.reservedTon, 0);

  const productions = DB.get('exp_production') || [];
  const prodTon = productions.reduce((s, p) => s + (p.unit === 'TON' ? (Number(p.inputQuantity) || 0) : (Number(p.inputQuantity) || 0) / 1000), 0);

  // 2. Financials
  const metrics = calculateExportProfitMetrics();
  
  // Suppliers Payable
  const purchases = DB.get('exp_bookings') || [];
  const creditPurchases = purchases.filter(b => b.paymentType === 'credit')
                                   .reduce((s, b) => s + (Number(b.totalAmount) || 0), 0);
  const creditExpenses = (DB.get('exp_material_expenses') || [])
    .filter(e => e.paymentMethod === 'supplier_account')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalSupplierPayable = creditPurchases + creditExpenses;

  // Customer Receivables
  const customers = DB.get('exp_customers') || [];
  const totalCustomerReceivable = customers.reduce((sum, c) => sum + Math.max(0, getCustomerFinancialSummary(c.id).outstandingBalance), 0);

  // Payments received
  const totalPaymentsReceived = (DB.get('exp_payments') || []).reduce((s, p) => s + (Number(p.pkrAmount) || 0), 0);

  // Containers
  const containers = DB.get('exp_containers') || [];
  const inProcessCnt = containers.filter(c => c.status !== 'Delivered').length;
  const shippedCnt = containers.filter(c => c.status === 'Shipped' || c.status === 'Delivered').length;

  // Set KPI Card Values
  const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setEl('kpiRawStock', `${formatTON(rawTon)} TON`);
  setEl('kpiProductionStock', `${formatTON(prodTon)} TON`);
  setEl('kpiReadyStock', `${formatTON(readyTon)} TON`);
  setEl('kpiReservedStock', `${formatTON(reservedTon)} TON`);
  setEl('kpiTotalSales', `PKR ${formatCurrency(metrics.totalSalesPKR)}`);
  setEl('kpiTotalExpenses', `PKR ${formatCurrency(metrics.totalMaterialExpensesPKR + metrics.totalShipmentExpensesPKR)}`);
  setEl('kpiSupplierPayable', `PKR ${formatCurrency(totalSupplierPayable)}`);
  setEl('kpiCustomerReceivable', `PKR ${formatCurrency(totalCustomerReceivable)}`);
  setEl('kpiPaymentsReceived', `PKR ${formatCurrency(totalPaymentsReceived)}`);
  setEl('kpiExportProfit', `PKR ${formatCurrency(metrics.netProfitPKR)}`);
  setEl('kpiContainersProcess', inProcessCnt);
  setEl('kpiContainersShipped', shippedCnt);

  // Render Charts
  renderDashboardCharts(metrics, containers, readyStock);

  // Render Recent Activity Lists
  renderDashboardActivity();
}

function renderDashboardCharts(metrics, containers, readyStock) {
  if (typeof Chart === 'undefined') return;

  // 1. Revenue vs Cost Chart
  const ctxProfit = document.getElementById('chartExportFinancials')?.getContext('2d');
  if (ctxProfit) {
    if (_expChartProfit) _expChartProfit.destroy();
    _expChartProfit = new Chart(ctxProfit, {
      type: 'bar',
      data: {
        labels: ['Sales Revenue', 'Purchase Cost', 'Material Expenses', 'Export Expenses', 'Net Profit'],
        datasets: [{
          label: 'PKR Amount',
          data: [
            metrics.totalSalesPKR,
            metrics.totalPurchaseCostPKR,
            metrics.totalMaterialExpensesPKR,
            metrics.totalShipmentExpensesPKR,
            Math.max(0, metrics.netProfitPKR)
          ],
          backgroundColor: ['#2a9d8f', '#e76f51', '#f4a261', '#e07b39', '#52b788'],
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

  // 2. Container Status Breakdown
  const ctxCnt = document.getElementById('chartExportContainers')?.getContext('2d');
  if (ctxCnt) {
    if (_expChartContainers) _expChartContainers.destroy();
    const statuses = ['Ready', 'Booked', 'Stuffed', 'Shipped', 'Delivered'];
    const counts = statuses.map(st => containers.filter(c => (c.status || 'Ready') === st).length);

    _expChartContainers = new Chart(ctxCnt, {
      type: 'doughnut',
      data: {
        labels: statuses,
        datasets: [{
          data: counts,
          backgroundColor: ['#264653', '#e9c46a', '#2a9d8f', '#52b788', '#1b4332']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

function renderDashboardActivity() {
  // Recent Bookings
  const bkList = document.getElementById('dashRecentBookings');
  if (bkList) {
    const list = DB.get('exp_sales_bookings') || [];
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const top = list.slice(0, 5);

    if (top.length === 0) {
      bkList.innerHTML = '<div class="empty-state py-3"><p>No export bookings yet</p></div>';
    } else {
      bkList.innerHTML = top.map(b => `
        <div class="activity-item">
          <div>
            <strong>${escapeHtml(b.bookingNo)}</strong> — ${escapeHtml(b.customerName)}
            <br><small style="color:var(--text-muted);">${escapeHtml(b.mineral)} • ${formatKG(b.quantity)} ${b.unit}</small>
          </div>
          <div style="text-align:right;">
            <strong style="color:var(--teal);">PKR ${formatCurrency(b.totalSaleAmount)}</strong>
            <br><small>${formatDate(b.date)}</small>
          </div>
        </div>
      `).join('');
    }
  }

  // Recent Containers
  const cntList = document.getElementById('dashRecentContainers');
  if (cntList) {
    const list = DB.get('exp_containers') || [];
    list.sort((a, b) => (b.stuffingDate || '').localeCompare(a.stuffingDate || ''));
    const top = list.slice(0, 5);

    if (top.length === 0) {
      cntList.innerHTML = '<div class="empty-state py-3"><p>No containers registered</p></div>';
    } else {
      cntList.innerHTML = top.map(c => `
        <div class="activity-item">
          <div>
            <strong>${escapeHtml(c.containerNo)}</strong> (${escapeHtml(c.mineral)})
            <br><small style="color:var(--text-muted);">${escapeHtml(c.customerName)} → ${escapeHtml(c.port)}</small>
          </div>
          <div style="text-align:right;">
            <span class="badge badge-status-${(c.status || 'ready').toLowerCase()}">${escapeHtml(c.status)}</span>
            <br><small>${formatTON(c.totalTon)} TON</small>
          </div>
        </div>
      `).join('');
    }
  }
}

/* =============================================
   MODULE 13: EXPORT REPORTS & ANALYTICS
   ============================================= */
function renderExportReports() {
  const repType = document.getElementById('expReportSelect')?.value || 'purchase';
  const tableHead = document.getElementById('expReportTableHead');
  const tableBody = document.getElementById('expReportTableBody');
  const repTitle = document.getElementById('expReportTitle');
  if (!tableHead || !tableBody) return;

  if (repTitle) repTitle.textContent = getReportTitle(repType);

  switch (repType) {
    case 'purchase':
      renderReportPurchase(tableHead, tableBody);
      break;
    case 'receiving':
      renderReportReceiving(tableHead, tableBody);
      break;
    case 'production':
      renderReportProduction(tableHead, tableBody);
      break;
    case 'ready_stock':
      renderReportReadyStock(tableHead, tableBody);
      break;
    case 'sales':
      renderReportSales(tableHead, tableBody);
      break;
    case 'containers':
      renderReportContainers(tableHead, tableBody);
      break;
    case 'expenses':
      renderReportExpenses(tableHead, tableBody);
      break;
    case 'payments':
      renderReportPayments(tableHead, tableBody);
      break;
    case 'profit':
      renderReportProfit(tableHead, tableBody);
      break;
    default:
      renderReportPurchase(tableHead, tableBody);
  }
}

function getReportTitle(type) {
  const map = {
    purchase: 'Export Purchase & Supplier Material Report',
    receiving: 'Warehouse Raw Stock & Inward Receiving Report',
    production: 'Mineral Processing & Wastage Yield Report',
    ready_stock: 'Ready / Finished Export Stock & Reservation Report',
    sales: 'Customer Export Sales & Order Bookings Report',
    containers: 'Container Stuffing & Shipment Logistics Report',
    expenses: 'Comprehensive Export Expenses (Material vs Port)',
    payments: 'Foreign Customer Payment Receipts & Conversion Report',
    profit: 'Consolidated Export Net Profitability Report'
  };
  return map[type] || 'Export Report';
}

function renderReportPurchase(th, tb) {
  th.innerHTML = `<tr><th>Booking #</th><th>Date</th><th>Supplier</th><th>Mineral</th><th>Quantity</th><th>Rate</th><th>Total (PKR)</th><th>Payment</th><th>Status</th></tr>`;
  const list = DB.get('exp_bookings') || [];
  tb.innerHTML = list.map(b => `
    <tr>
      <td><strong>${escapeHtml(b.bookingNo)}</strong></td>
      <td>${formatDate(b.date)}</td>
      <td>${escapeHtml(b.supplierName)}</td>
      <td>${escapeHtml(b.mineral)}</td>
      <td>${formatKG(b.quantity)} ${b.unit}</td>
      <td>PKR ${formatCurrency(b.rate)}</td>
      <td><strong>PKR ${formatCurrency(b.totalAmount)}</strong></td>
      <td>${b.paymentType}</td>
      <td>${b.status}</td>
    </tr>
  `).join('');
}

function renderReportReceiving(th, tb) {
  th.innerHTML = `<tr><th>Date</th><th>Booking #</th><th>Supplier</th><th>Mineral</th><th>Received Qty</th><th>Warehouse</th><th>Vehicle</th></tr>`;
  const list = DB.get('exp_receivings') || [];
  tb.innerHTML = list.map(r => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td>${escapeHtml(r.bookingNo)}</td>
      <td>${escapeHtml(r.supplierName)}</td>
      <td>${escapeHtml(r.mineral)}</td>
      <td><strong>${formatKG(r.receivedQuantity)} ${r.unit}</strong></td>
      <td>${escapeHtml(r.warehouse)}</td>
      <td>${escapeHtml(r.vehicle || '—')}</td>
    </tr>
  `).join('');
}

function renderReportProduction(th, tb) {
  th.innerHTML = `<tr><th>PR #</th><th>Date</th><th>Mineral</th><th>Input Qty</th><th>Wastage</th><th>Ready Qty</th><th>Yield %</th><th>Bags</th></tr>`;
  const list = DB.get('exp_production') || [];
  tb.innerHTML = list.map(p => {
    const yieldPct = p.inputQuantity > 0 ? (((p.readyQuantity || 0) / p.inputQuantity) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${escapeHtml(p.productionNo)}</strong></td>
        <td>${formatDate(p.date)}</td>
        <td>${escapeHtml(p.mineral)}</td>
        <td>${formatKG(p.inputQuantity)} ${p.unit}</td>
        <td style="color:var(--crimson);">${formatKG(p.wastageQuantity)} ${p.unit}</td>
        <td style="color:var(--emerald);font-weight:700;">+${formatKG(p.readyQuantity)} ${p.unit}</td>
        <td><strong>${yieldPct}%</strong></td>
        <td>${p.bags ? `${p.bags} bags` : 'Bulk'}</td>
      </tr>
    `;
  }).join('');
}

function renderReportReadyStock(th, tb) {
  th.innerHTML = `<tr><th>Mineral</th><th>Total Ready Stock</th><th>Booked / Reserved</th><th>Available Stock</th><th>Bags</th><th>Status</th></tr>`;
  const list = getExpReadyStockSummary();
  tb.innerHTML = list.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.mineral)}</strong></td>
      <td>${formatTON(s.totalTon)} TON</td>
      <td style="color:var(--copper);">${formatTON(s.reservedTon)} TON</td>
      <td style="color:var(--emerald);font-weight:700;">${formatTON(s.availableTon)} TON</td>
      <td>${formatKG(s.bags)} Bags</td>
      <td>${s.availableTon > 0 ? 'In Stock' : 'Fully Booked'}</td>
    </tr>
  `).join('');
}

function renderReportSales(th, tb) {
  th.innerHTML = `<tr><th>Booking #</th><th>Date</th><th>Customer</th><th>Mineral</th><th>Quantity</th><th>Rate</th><th>Total (PKR)</th><th>Terms</th><th>Destination</th></tr>`;
  const list = DB.get('exp_sales_bookings') || [];
  tb.innerHTML = list.map(b => `
    <tr>
      <td><strong>${escapeHtml(b.bookingNo)}</strong></td>
      <td>${formatDate(b.date)}</td>
      <td>${escapeHtml(b.customerName)}</td>
      <td>${escapeHtml(b.mineral)}</td>
      <td>${formatKG(b.quantity)} ${b.unit}</td>
      <td>PKR ${formatCurrency(b.rate)}</td>
      <td><strong>PKR ${formatCurrency(b.totalSaleAmount)}</strong></td>
      <td>${b.paymentTerms}</td>
      <td>${escapeHtml(b.destinationCountry || '')} (${escapeHtml(b.destinationPort || '')})</td>
    </tr>
  `).join('');
}

function renderReportContainers(th, tb) {
  th.innerHTML = `<tr><th>Container #</th><th>Size / Seal</th><th>Customer</th><th>Cargo / Mineral</th><th>Weight (TON)</th><th>Bags</th><th>Port</th><th>Status</th></tr>`;
  const list = DB.get('exp_containers') || [];
  tb.innerHTML = list.map(c => `
    <tr>
      <td><strong>${escapeHtml(c.containerNo)}</strong></td>
      <td>${escapeHtml(c.containerSize)} / ${escapeHtml(c.sealNo || '—')}</td>
      <td>${escapeHtml(c.customerName)}</td>
      <td>${escapeHtml(c.mineral)}</td>
      <td><strong>${formatTON(c.totalTon)} TON</strong></td>
      <td>${c.bags} bags × ${c.bagWeight} kg</td>
      <td>${escapeHtml(c.port)}</td>
      <td><span class="badge badge-status-${(c.status || 'ready').toLowerCase()}">${escapeHtml(c.status)}</span></td>
    </tr>
  `).join('');
}

function renderReportExpenses(th, tb) {
  th.innerHTML = `<tr><th>Date</th><th>Category</th><th>Expense Type</th><th>Reference</th><th>Amount (PKR)</th><th>Payment Method</th><th>Party</th></tr>`;
  const matExp = (DB.get('exp_material_expenses') || []).map(e => ({ ...e, cat: 'Material Inward' }));
  const shipExp = (DB.get('exp_shipment_expenses') || []).map(e => ({ ...e, cat: 'Export Shipment' }));
  const allExp = [...matExp, ...shipExp].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  tb.innerHTML = allExp.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td><span class="badge badge-mineral">${e.cat}</span></td>
      <td><strong>${escapeHtml(e.expenseType)}</strong></td>
      <td>${escapeHtml(e.bookingNo || e.containerNo || '—')}</td>
      <td><strong>PKR ${formatCurrency(e.amount)}</strong></td>
      <td>${e.paymentMethod}</td>
      <td>${escapeHtml(e.supplierName || e.customerName || '—')}</td>
    </tr>
  `).join('');
}

function renderReportPayments(th, tb) {
  th.innerHTML = `<tr><th>Receipt #</th><th>Date</th><th>Customer</th><th>Foreign Currency</th><th>Exchange Rate</th><th>PKR Amount</th><th>Channel</th></tr>`;
  const list = DB.get('exp_payments') || [];
  tb.innerHTML = list.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.receiptNo)}</strong></td>
      <td>${formatDate(p.date)}</td>
      <td>${escapeHtml(p.customerName)}</td>
      <td>${escapeHtml(p.currency)} ${formatCurrency(p.foreignAmount)}</td>
      <td>@ ${p.exchangeRate}</td>
      <td style="color:var(--emerald);font-weight:700;">PKR ${formatCurrency(p.pkrAmount)}</td>
      <td>${escapeHtml(p.bankOrCash)}</td>
    </tr>
  `).join('');
}

function renderReportProfit(th, tb) {
  th.innerHTML = `<tr><th>Export Order</th><th>Customer</th><th>Mineral</th><th>Sale Amount</th><th>Est. Material Cost</th><th>Shipment Exp</th><th>Net Profit</th></tr>`;
  const sales = DB.get('exp_sales_bookings') || [];
  tb.innerHTML = sales.map(sb => {
    const saleAmt = Number(sb.totalSaleAmount) || 0;
    const shipExp = DB.filter('exp_shipment_expenses', e => e.salesBookingId === sb.id)
                      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const purchases = DB.filter('exp_bookings', b => (b.mineral || '').toLowerCase() === (sb.mineral || '').toLowerCase());
    const avgRate = purchases.length > 0 ? (purchases.reduce((s, b) => s + (Number(b.rate) || 0), 0) / purchases.length) : 0;
    const matCost = (Number(sb.quantity) || 0) * avgRate;
    const profit = saleAmt - matCost - shipExp;

    return `
      <tr>
        <td><strong>${escapeHtml(sb.bookingNo)}</strong></td>
        <td>${escapeHtml(sb.customerName)}</td>
        <td>${escapeHtml(sb.mineral)}</td>
        <td>PKR ${formatCurrency(saleAmt)}</td>
        <td>PKR ${formatCurrency(matCost)}</td>
        <td>PKR ${formatCurrency(shipExp)}</td>
        <td style="color:${profit >= 0 ? 'var(--emerald)' : 'var(--crimson)'};font-weight:700;">PKR ${formatCurrency(profit)}</td>
      </tr>
    `;
  }).join('');
}

/* =============================================
   EXPORT TO CSV / EXCEL
   ============================================= */
function exportReportCSV() {
  const table = document.getElementById('expReportTable');
  if (!table) return;

  let csv = [];
  const rows = table.querySelectorAll('tr');

  rows.forEach(row => {
    const cols = row.querySelectorAll('th, td');
    const rowData = [];
    cols.forEach(col => {
      let text = col.innerText.replace(/"/g, '""').trim();
      rowData.push(`"${text}"`);
    });
    csv.push(rowData.join(','));
  });

  const csvString = csv.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Export_Report_${today()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Report downloaded as CSV!', 'success');
}

/* =============================================
   PRINT / PDF HELPERS
   ============================================= */
function printExportReport() {
  const content = document.getElementById('expReportPrintArea');
  if (!content) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`
    <!DOCTYPE html><html><head>
      <title>Arham Traders - Export Report</title>
      <link rel="stylesheet" href="css/main.css" />
      <style>
        body { font-family: 'Inter', sans-serif; padding: 24px; color: #1e2333; background: #fff; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f4f5f7; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #181c2a; padding-bottom: 12px; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="header">
        <h2>ARHAM TRADERS — EXPORT DIVISION</h2>
        <p style="margin:2px 0;">Mineral Processing & Global Trade</p>
        <p style="font-size:12px;color:#666;">Generated on: ${new Date().toLocaleString('en-PK')}</p>
      </div>
      ${content.innerHTML}
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

function printExportPurchaseSlip(id) {
  const b = DB.findById('exp_bookings', id);
  if (!b) return;

  const win = window.open('', '_blank', 'width=600,height=700');
  win.document.write(`
    <!DOCTYPE html><html><head>
      <title>Purchase Slip - ${b.bookingNo}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 20px; font-size: 12px; color: #1e2333; }
        .slip { max-width: 400px; margin: 0 auto; border: 1px dashed #999; padding: 20px; border-radius: 8px; }
        .head { text-align: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 12px; }
        .row { display: flex; justify-content: space-between; padding: 5px 0; }
        .total-box { background: #f5f5f5; padding: 10px; border-radius: 6px; text-align: center; margin-top: 12px; font-size: 16px; font-weight: bold; }
      </style>
    </head><body>
      <div class="slip">
        <div class="head">
          <h3 style="margin:0;">ARHAM TRADERS</h3>
          <p style="margin:2px 0;font-size:11px;">Export Mineral Purchase Booking</p>
          <p style="margin:2px 0;font-weight:bold;">${escapeHtml(b.bookingNo)}</p>
        </div>
        <div class="row"><span>Date:</span><span>${formatDate(b.date)}</span></div>
        <div class="row"><span>Supplier:</span><span>${escapeHtml(b.supplierName)}</span></div>
        <div class="row"><span>Mineral:</span><span>${escapeHtml(b.mineral)}</span></div>
        <div class="row"><span>Quantity:</span><span>${formatKG(b.quantity)} ${b.unit}</span></div>
        <div class="row"><span>Rate:</span><span>PKR ${formatCurrency(b.rate)}/${b.unit}</span></div>
        <div class="row"><span>Payment Terms:</span><span>${b.paymentType.toUpperCase()}</span></div>
        <div class="row"><span>Warehouse:</span><span>${escapeHtml(b.warehouse)}</span></div>
        <div class="total-box">Total: PKR ${formatCurrency(b.totalAmount)}</div>
        <p style="text-align:center;font-size:10px;color:#888;margin-top:20px;">Export Division Management System</p>
      </div>
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

function printExportSalesSlip(id) {
  const b = DB.findById('exp_sales_bookings', id);
  if (!b) return;

  const win = window.open('', '_blank', 'width=600,height=700');
  win.document.write(`
    <!DOCTYPE html><html><head>
      <title>Sales Order - ${b.bookingNo}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 20px; font-size: 12px; color: #1e2333; }
        .slip { max-width: 440px; margin: 0 auto; border: 1px solid #264653; padding: 20px; border-radius: 8px; }
        .head { text-align: center; border-bottom: 2px solid #264653; padding-bottom: 10px; margin-bottom: 14px; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #eee; }
        .total-box { background: #e0f5f3; color: #1e7a6e; padding: 12px; border-radius: 6px; text-align: center; margin-top: 14px; font-size: 17px; font-weight: bold; }
      </style>
    </head><body>
      <div class="slip">
        <div class="head">
          <h2 style="margin:0;color:#264653;">ARHAM TRADERS</h2>
          <p style="margin:2px 0;font-size:11px;">Export Sales Order & Booking Confirmation</p>
          <p style="margin:4px 0;font-weight:bold;">${escapeHtml(b.bookingNo)}</p>
        </div>
        <div class="row"><span>Date:</span><span>${formatDate(b.date)}</span></div>
        <div class="row"><span>Customer / Buyer:</span><span><strong>${escapeHtml(b.customerName)}</strong></span></div>
        <div class="row"><span>Mineral:</span><span>${escapeHtml(b.mineral)}</span></div>
        <div class="row"><span>Quantity:</span><span>${formatKG(b.quantity)} ${b.unit} (${b.bags || '—'} Bags)</span></div>
        <div class="row"><span>Rate:</span><span>PKR ${formatCurrency(b.rate)}/${b.unit}</span></div>
        <div class="row"><span>Destination:</span><span>${escapeHtml(b.destinationCountry || 'Intl')} (${escapeHtml(b.destinationPort || 'Port')})</span></div>
        <div class="row"><span>Terms:</span><span>${b.paymentTerms.toUpperCase()}</span></div>
        <div class="total-box">Total Order Value: PKR ${formatCurrency(b.totalSaleAmount)}</div>
      </div>
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

function printContainerManifest(id) {
  const c = DB.findById('exp_containers', id);
  if (!c) return;

  const win = window.open('', '_blank', 'width=700,height=750');
  win.document.write(`
    <!DOCTYPE html><html><head>
      <title>Container Manifest - ${c.containerNo}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 24px; font-size: 12px; color: #1e2333; }
        .manifest { border: 2px solid #181c2a; padding: 24px; border-radius: 8px; }
        .head { text-align: center; border-bottom: 2px solid #181c2a; padding-bottom: 12px; margin-bottom: 16px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .box { background: #f8f9fa; border: 1px solid #eee; padding: 10px; border-radius: 6px; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; }
      </style>
    </head><body>
      <div class="manifest">
        <div class="head">
          <h2 style="margin:0;">ARHAM TRADERS — EXPORT LOGISTICS</h2>
          <p style="margin:2px 0;">CONTAINER STUFFING & SHIPPING MANIFEST</p>
          <h3 style="margin:6px 0;color:#2a9d8f;">CONTAINER NO: ${escapeHtml(c.containerNo)}</h3>
        </div>
        <div class="grid">
          <div class="box">
            <div class="row"><span>Container Size:</span><strong>${escapeHtml(c.containerSize)}</strong></div>
            <div class="row"><span>Seal No:</span><strong>${escapeHtml(c.sealNo || '—')}</strong></div>
            <div class="row"><span>Vehicle / Truck:</span><strong>${escapeHtml(c.vehicle || '—')}</strong></div>
            <div class="row"><span>Status:</span><strong>${escapeHtml(c.status)}</strong></div>
          </div>
          <div class="box">
            <div class="row"><span>Customer:</span><strong>${escapeHtml(c.customerName)}</strong></div>
            <div class="row"><span>Port of Loading:</span><strong>${escapeHtml(c.port)}</strong></div>
            <div class="row"><span>Destination:</span><strong>${escapeHtml(c.destinationCountry)}</strong></div>
            <div class="row"><span>Stuffing Date:</span><strong>${formatDate(c.stuffingDate)}</strong></div>
          </div>
        </div>
        <div class="box" style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px 0;border-bottom:1px solid #ddd;padding-bottom:4px;">CARGO SPECIFICATION</h4>
          <div class="row"><span>Mineral Type:</span><strong>${escapeHtml(c.mineral)}</strong></div>
          <div class="row"><span>Number of Bags:</span><strong>${formatKG(c.bags)} Bags</strong></div>
          <div class="row"><span>Bag Weight:</span><strong>${c.bagWeight} KG</strong></div>
          <div class="row"><span>Total Net Weight:</span><strong>${formatTON(c.totalTon)} TON (${formatKG(c.totalKG)} KG)</strong></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:40px;padding-top:20px;border-top:1px dashed #ccc;">
          <div>Authorized Logistics Sign: _____________________</div>
          <div>Port Authority Stamp: _____________________</div>
        </div>
      </div>
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

function printPaymentReceiptSlip(id) {
  const p = DB.findById('exp_payments', id);
  if (!p) return;

  const win = window.open('', '_blank', 'width=600,height=650');
  win.document.write(`
    <!DOCTYPE html><html><head>
      <title>Payment Receipt - ${p.receiptNo}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 20px; font-size: 12px; color: #1e2333; }
        .slip { max-width: 420px; margin: 0 auto; border: 1px solid #52b788; padding: 20px; border-radius: 8px; }
        .head { text-align: center; border-bottom: 2px solid #52b788; padding-bottom: 10px; margin-bottom: 14px; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #eee; }
        .total-box { background: #ebf7f2; color: #2d8a5e; padding: 12px; border-radius: 6px; text-align: center; margin-top: 14px; font-size: 18px; font-weight: bold; }
      </style>
    </head><body>
      <div class="slip">
        <div class="head">
          <h2 style="margin:0;color:#2d8a5e;">ARHAM TRADERS</h2>
          <p style="margin:2px 0;font-size:11px;">Foreign Export Payment Voucher</p>
          <p style="margin:4px 0;font-weight:bold;">${escapeHtml(p.receiptNo)}</p>
        </div>
        <div class="row"><span>Date:</span><span>${formatDate(p.date)}</span></div>
        <div class="row"><span>Customer:</span><span><strong>${escapeHtml(p.customerName)}</strong></span></div>
        <div class="row"><span>Foreign Currency:</span><span>${escapeHtml(p.currency)} ${formatCurrency(p.foreignAmount)}</span></div>
        <div class="row"><span>Exchange Rate:</span><span>PKR ${p.exchangeRate}</span></div>
        <div class="row"><span>Channel / Bank:</span><span>${escapeHtml(p.bankOrCash)}</span></div>
        <div class="row"><span>Reference Order:</span><span>${escapeHtml(p.bookingNo || 'Direct')}</span></div>
        <div class="total-box">PKR Amount: PKR ${formatCurrency(p.pkrAmount)}</div>
      </div>
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

/* =============================================
   FILTERS BINDING & VIEW RE-RENDER
   ============================================= */
function bindFilters() {
  document.getElementById('expFilterSupplier')?.addEventListener('change', e => {
    _expFilterSupplier = e.target.value;
    renderPurchaseBookingsTable();
  });
  document.getElementById('expFilterCustomer')?.addEventListener('change', e => {
    _expFilterCustomer = e.target.value;
  });
  document.getElementById('expFilterMineral')?.addEventListener('input', e => {
    _expFilterMineral = e.target.value;
    renderPurchaseBookingsTable();
  });
  document.getElementById('expFilterDateFrom')?.addEventListener('change', e => {
    _expFilterDateFrom = e.target.value;
    renderPurchaseBookingsTable();
  });
  document.getElementById('expFilterDateTo')?.addEventListener('change', e => {
    _expFilterDateTo = e.target.value;
    renderPurchaseBookingsTable();
  });
  document.getElementById('expReportSelect')?.addEventListener('change', () => {
    renderExportReports();
  });
}

function renderAllExportViews() {
  renderExportDashboard();
  renderPurchaseBookingsTable();
  renderReceivingsTable();
  renderMaterialExpensesTable();
  renderProductionTable();
  renderReadyStockTable();
  renderCustomersList();
  renderSalesBookingsTable();
  renderContainersView();
  renderShipmentExpensesTable();
  renderPaymentsTable();
  renderProfitAnalysis();
  renderExportReports();
}
