/* =============================================
   ARHAM TRADERS — AUTH SYSTEM
   js/auth.js  |  Phase 10
   ============================================= */

const _AUTH_SESSION_KEY = 'at_session';
const _AUTH_USERS_KEY   = 'at_users';

/* =============================================
   SEED DEFAULT USERS (runs once)
   ============================================= */
(function seedUsers() {
  try {
    const existing = JSON.parse(localStorage.getItem(_AUTH_USERS_KEY) || '[]');
    if (!existing.length) {
      localStorage.setItem(_AUTH_USERS_KEY, JSON.stringify([
        { id: 'u_admin', username: 'admin', password: 'admin123', name: 'Admin User',  role: 'admin' },
        { id: 'u_staff', username: 'staff', password: 'staff123', name: 'Staff User',  role: 'staff' }
      ]));
    }
  } catch (e) { /* storage unavailable — continue without auth */ }
})();

/* =============================================
   SESSION HELPERS
   ============================================= */
function getSession() {
  try { return JSON.parse(localStorage.getItem(_AUTH_SESSION_KEY)) || null; }
  catch { return null; }
}

function _setSession(user) {
  localStorage.setItem(_AUTH_SESSION_KEY, JSON.stringify({
    userId: user.id, username: user.username,
    name: user.name, role: user.role,
    loggedAt: new Date().toISOString()
  }));
}

function getCurrentUser() {
  return getSession();
}

function isAdmin() {
  const s = getSession();
  return s && s.role === 'admin';
}

/* =============================================
   IMMEDIATE AUTH GUARD
   Runs before DOM — redirects if no session
   ============================================= */
(function authGuard() {
  const session  = getSession();
  const path     = window.location.pathname.replace(/\\/g, '/');
  const onLogin  = path.endsWith('login.html') || path.endsWith('/login');

  if (!session && !onLogin) {
    window.location.replace('login.html');
    return;
  }
  if (session && onLogin) {
    window.location.replace('index.html');
  }
})();

/* =============================================
   DOM READY — UPDATE SIDEBAR UI
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  const session = getSession();
  if (!session) return;

  /* Add role class to body — enables CSS-based role restrictions */
  document.body.classList.add('role-' + session.role);

  /* Update sidebar user name & role label */
  const nameEl = document.querySelector('.sidebar-footer .user-name');
  const roleEl = document.querySelector('.sidebar-footer .user-role');
  if (nameEl) nameEl.textContent = session.name;
  if (roleEl) roleEl.textContent = session.role === 'admin' ? 'Administrator' : 'Staff';

  /* Add logout button if not already present */
  const footer = document.querySelector('.sidebar-footer');
  if (footer && !footer.querySelector('.logout-btn')) {
    const btn = document.createElement('button');
    btn.className = 'logout-btn';
    btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
    btn.addEventListener('click', logout);
    footer.appendChild(btn);
  }
});

/* =============================================
   LOGIN / LOGOUT
   ============================================= */
function doLogin(username, password) {
  /* Sanitize */
  username = (username || '').trim().toLowerCase();
  password = (password || '');

  if (!username || !password) return { ok: false, msg: 'Enter username and password.' };

  try {
    const users = JSON.parse(localStorage.getItem(_AUTH_USERS_KEY) || '[]');
    const user  = users.find(u => u.username === username && u.password === password);
    if (user) {
      _setSession(user);
      return { ok: true };
    }
    return { ok: false, msg: 'Invalid username or password.' };
  } catch {
    return { ok: false, msg: 'Login error. Please try again.' };
  }
}

function logout() {
  const doIt = () => {
    localStorage.removeItem(_AUTH_SESSION_KEY);
    window.location.replace('login.html');
  };

  if (typeof showConfirm === 'function') {
    showConfirm('Are you sure you want to logout?', doIt, 'Logout');
  } else {
    doIt();
  }
}

/* =============================================
   DEMO DATA SEEDER
   ============================================= */
function seedDemoData() {
  /* Only seed if no suppliers exist yet */
  const existing = JSON.parse(localStorage.getItem('at_suppliers') || '[]');
  if (existing.length) return false;

  /* Suppliers */
  const suppliers = [
    { id: 'sup_1', name: 'Muhammad Aslam',  phone: '0300-1234567', city: 'Lahore',    cnic: '35201-1234567-1', ntn: '',         address: 'Model Town, Lahore',  createdAt: new Date().toISOString() },
    { id: 'sup_2', name: 'Haji Zafar Khan', phone: '0321-9876543', city: 'Quetta',    cnic: '54400-9876543-2', ntn: 'NTN-1234', address: 'Satellite Town, Quetta', createdAt: new Date().toISOString() },
    { id: 'sup_3', name: 'Tariq Minerals',  phone: '0333-5551234', city: 'Islamabad', cnic: '37405-5551234-3', ntn: 'NTN-5678', address: 'G-11/2, Islamabad',    createdAt: new Date().toISOString() }
  ];
  localStorage.setItem('at_suppliers', JSON.stringify(suppliers));

  /* Bookings */
  const bookings = [
    { id: 'bk_1', bookingNo: 'BK-2605-0001', supplierId: 'sup_1', supplierName: 'Muhammad Aslam',  weight: 5000, rate: 15, total: 75000, description: 'Silica Sand Grade A', date: '2026-04-10', createdAt: new Date().toISOString() },
    { id: 'bk_2', bookingNo: 'BK-2605-0002', supplierId: 'sup_2', supplierName: 'Haji Zafar Khan', weight: 8000, rate: 12, total: 96000, description: 'Iron Ore Batch 1',    date: '2026-04-15', createdAt: new Date().toISOString() },
    { id: 'bk_3', bookingNo: 'BK-2605-0003', supplierId: 'sup_3', supplierName: 'Tariq Minerals',  weight: 3000, rate: 20, total: 60000, description: 'Limestone Powder',    date: '2026-04-20', createdAt: new Date().toISOString() }
  ];
  localStorage.setItem('at_bookings', JSON.stringify(bookings));

  /* Warehouse */
  const warehouse = [
    { id: 'wh_1', bookingId: 'bk_1', bookingNo: 'BK-2605-0001', supplierId: 'sup_1', supplierName: 'Muhammad Aslam',  totalWeight: 5000, remainingWeight: 2000, status: 'partial',   description: 'Silica Sand Grade A', date: '2026-04-10', createdAt: new Date().toISOString() },
    { id: 'wh_2', bookingId: 'bk_2', bookingNo: 'BK-2605-0002', supplierId: 'sup_2', supplierName: 'Haji Zafar Khan', totalWeight: 8000, remainingWeight: 3000, status: 'partial',   description: 'Iron Ore Batch 1',    date: '2026-04-15', createdAt: new Date().toISOString() },
    { id: 'wh_3', bookingId: 'bk_3', bookingNo: 'BK-2605-0003', supplierId: 'sup_3', supplierName: 'Tariq Minerals',  totalWeight: 3000, remainingWeight: 3000, status: 'in_stock',  description: 'Limestone Powder',    date: '2026-04-20', createdAt: new Date().toISOString() }
  ];
  localStorage.setItem('at_warehouse', JSON.stringify(warehouse));

  /* Production */
  const production = [
    { id: 'pr_1', warehouseId: 'wh_1', bookingNo: 'BK-2605-0001', supplierId: 'sup_1', supplierName: 'Muhammad Aslam',  weight: 3000, description: 'Silica Sand Grade A', status: 'completed', finishedWeight: 2700, scrapWeight: 300, date: '2026-04-12', completedAt: '2026-04-14T10:00:00.000Z', createdAt: new Date().toISOString() },
    { id: 'pr_2', warehouseId: 'wh_2', bookingNo: 'BK-2605-0002', supplierId: 'sup_2', supplierName: 'Haji Zafar Khan', weight: 5000, description: 'Iron Ore Batch 1',    status: 'in_process',                              date: '2026-04-17', createdAt: new Date().toISOString() }
  ];
  localStorage.setItem('at_production', JSON.stringify(production));

  /* Finished Goods */
  const finishedGoods = [
    { id: 'fg_1', productionId: 'pr_1', bookingNo: 'BK-2605-0001', supplierId: 'sup_1', supplierName: 'Muhammad Aslam', inputWeight: 3000, finishedWeight: 2700, scrapWeight: 300, remainingWeight: 1700, description: 'Silica Sand Grade A', notes: 'Good quality batch', date: '2026-04-14T10:00:00.000Z', createdAt: new Date().toISOString() }
  ];
  localStorage.setItem('at_finished_goods', JSON.stringify(finishedGoods));

  /* Deliveries */
  const deliveries = [
    { id: 'dl_1', deliveryNo: 'DL-2605-0001', supplierId: 'sup_1', supplierName: 'Muhammad Aslam', weight: 1000, refNo: 'Truck-AT-001', description: 'Silica Sand Grade A', date: '2026-04-20T09:00:00.000Z', createdAt: new Date().toISOString() }
  ];
  localStorage.setItem('at_deliveries', JSON.stringify(deliveries));

  return true;
}
