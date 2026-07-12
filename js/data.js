/* =============================================
   ARHAM TRADERS — DATA LAYER (Cloud-Only / In-Memory)
   js/data.js
   ============================================= */

/* In-memory store — filled from Supabase on page load */
/* Using var so it's accessible via window._memStore from other scripts */
var _memStore = {};

const DB = {
  /* Read array from memory */
  get(key) {
    return _memStore[key] ? [..._memStore[key]] : [];
  },

  /* Write array to memory */
  set(key, data) {
    _memStore[key] = Array.isArray(data) ? [...data] : [];
  },

  /* Add item — returns item with id */
  add(key, item) {
    if (!_memStore[key]) _memStore[key] = [];
    item.id = item.id || generateId();
    item.createdAt = item.createdAt || new Date().toISOString();
    _memStore[key].push(item);
    return item;
  },

  /* Update item by id */
  update(key, id, updates) {
    if (!_memStore[key]) return null;
    const idx = _memStore[key].findIndex(i => i.id === id);
    if (idx !== -1) {
      _memStore[key][idx] = { ..._memStore[key][idx], ...updates, updatedAt: new Date().toISOString() };
      return _memStore[key][idx];
    }
    return null;
  },

  /* Delete item by id */
  remove(key, id) {
    if (!_memStore[key]) return;
    _memStore[key] = _memStore[key].filter(i => i.id !== id);
  },

  /* Find single item by id */
  findById(key, id) {
    if (!_memStore[key]) return null;
    return _memStore[key].find(i => i.id === id) || null;
  },

  /* Find items matching predicate */
  filter(key, predicate) {
    return this.get(key).filter(predicate);
  },

  /* Count items */
  count(key) {
    return _memStore[key] ? _memStore[key].length : 0;
  },

  /* Clear a single store */
  clear(key) {
    _memStore[key] = [];
  },

  /* Clear ALL app data */
  clearAll() {
    Object.keys(_memStore).forEach(k => { _memStore[k] = []; });
  }
};

/* =============================================
   ID & DATE UTILITIES
   ============================================= */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function nowISO() {
  return new Date().toISOString();
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateStr; }
}

function formatKG(num) {
  if (num === null || num === undefined || num === '') return '0';
  const n = Number(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatTON(num) {
  if (num === null || num === undefined || num === '') return '0';
  const n = Number(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function formatCurrency(num) {
  if (num === null || num === undefined || num === '') return '0';
  const n = Number(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* =============================================
   BOOKING NUMBER GENERATOR
   ============================================= */
function generateBookingNo() {
  const bookings = DB.get('bookings');
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(bookings.length + 1).padStart(4, '0');
  return `BK-${year}${month}-${seq}`;
}

function generateDeliveryNo() {
  const deliveries = DB.get('deliveries');
  const year = new Date().getFullYear().toString().substr(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const seq = String(deliveries.length + 1).padStart(4, '0');
  return `DL-${year}${month}-${seq}`;
}

/* =============================================
   STATS ENGINE
   ============================================= */
const Stats = {
  getTotalSuppliers() {
    return DB.count('suppliers');
  },

  getWarehouseStock() {
    return DB.get('warehouse').reduce((s, i) => s + (Number(i.remainingWeight) || 0), 0);
  },

  getInProduction() {
    return DB.filter('production', p => p.status === 'pending' || p.status === 'in_process')
             .reduce((s, p) => s + (Number(p.weight) || 0), 0);
  },

  getFinishedGoods() {
    return DB.get('finished_goods').reduce((s, i) => s + (Number(i.remainingWeight) || 0), 0);
  },

  getTodayBookings() {
    const t = today();
    return DB.filter('bookings', b => b.date && b.date.startsWith(t)).length;
  },

  getTodayDeliveries() {
    const t = today();
    return DB.filter('deliveries', d => d.date && d.date.startsWith(t)).length;
  },

  /* Last 7 days booking weight per day */
  getStockTrend() {
    const bookings = DB.get('bookings');
    const labels = [], data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }));
      const total = bookings
        .filter(b => b.date && b.date.startsWith(dateStr))
        .reduce((s, b) => s + (Number(b.weight) || 0), 0);
      data.push(total);
    }
    return { labels, data };
  },

  /* Finished goods vs scrap totals */
  getProductionRatio() {
    const fg = DB.get('finished_goods');
    return {
      finished: fg.reduce((s, i) => s + (Number(i.finishedWeight) || 0), 0),
      scrap:    fg.reduce((s, i) => s + (Number(i.scrapWeight)    || 0), 0)
    };
  },

  /* Supplier ledger summary */
  getSupplierLedger(supplierId) {
    const totalReceived  = DB.filter('bookings', b => b.supplierId === supplierId)
                            .reduce((s, b) => s + (Number(b.weight) || 0), 0);
    const sentProduction = DB.filter('production', p => p.supplierId === supplierId)
                            .reduce((s, p) => s + (Number(p.weight) || 0), 0);
    const totalFinished  = DB.filter('finished_goods', f => f.supplierId === supplierId)
                            .reduce((s, f) => s + (Number(f.finishedWeight) || 0), 0);
    const totalScrap     = DB.filter('finished_goods', f => f.supplierId === supplierId)
                            .reduce((s, f) => s + (Number(f.scrapWeight) || 0), 0);
    const totalDelivered = DB.filter('deliveries', d => d.supplierId === supplierId)
                            .reduce((s, d) => s + (Number(d.weight) || 0), 0);
    const remainingFinished = totalFinished - totalDelivered;
    const warehouseBalance  = DB.filter('warehouse', w => w.supplierId === supplierId)
                               .reduce((s, w) => s + (Number(w.remainingWeight) || 0), 0);
    return {
      totalReceived, sentProduction, totalFinished, totalScrap,
      totalDelivered, remainingFinished, warehouseBalance
    };
  }
};
