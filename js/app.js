/* =============================================
   ARHAM TRADERS — APP CORE
   js/app.js  |  Sidebar · Topbar · Modal · Toast
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTopbar();
  initToast();
});

/* =============================================
   SIDEBAR
   ============================================= */
function initSidebar() {
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const toggle    = document.getElementById('menuToggle');
  const closeBtn  = document.getElementById('sidebarClose');
  const main      = document.getElementById('mainContent');
  if (!sidebar) return;

  /* Toggle handler */
  toggle?.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    } else {
      sidebar.classList.toggle('collapsed');
      main?.classList.toggle('sidebar-collapsed');
    }
  });

  /* Close (mobile) */
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay?.classList.remove('active');
  }

  /* Active nav item from URL */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('href') === currentPage ||
       (currentPage === '' && item.getAttribute('href') === 'index.html')) {
      item.classList.add('active');
    }
  });

  /* Today's booking badge */
  const badge = document.getElementById('todayBookingBadge');
  if (badge) {
    const count = Stats.getTodayBookings();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  /* Close sidebar on nav click (mobile) */
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

/* =============================================
   TOPBAR — DATE
   ============================================= */
function initTopbar() {
  const el = document.getElementById('currentDate');
  if (el) {
    el.textContent = new Date().toLocaleDateString('en-PK', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

/* =============================================
   TOAST NOTIFICATIONS
   ============================================= */
let _toastContainer;

function initToast() {
  _toastContainer = document.createElement('div');
  _toastContainer.className = 'toast-container';
  document.body.appendChild(_toastContainer);
}

function showToast(message, type = 'success', duration = 3200) {
  if (!_toastContainer) initToast();
  const icons = {
    success: 'fa-check-circle',
    error:   'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info:    'fa-info-circle'
  };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  _toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.25s ease reverse';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/* =============================================
   MODAL HELPERS
   ============================================= */
function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

/* Close modal on overlay click */
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

/* Close modal on Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

/* =============================================
   CONFIRM DIALOG
   ============================================= */
function showConfirm(message, onConfirm, confirmLabel = 'Delete') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px;">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fas fa-exclamation-triangle" style="color:var(--crimson);margin-right:8px;"></i>Confirm</h3>
        <button class="modal-close btn-no"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-secondary);font-size:13.5px;line-height:1.6;">${escapeHtml(message)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm btn-no">Cancel</button>
        <button class="btn btn-danger btn-sm btn-yes">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.btn-yes').addEventListener('click', () => { onConfirm(); overlay.remove(); });
  overlay.querySelectorAll('.btn-no').forEach(b => b.addEventListener('click', () => overlay.remove()));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

/* =============================================
   SECURITY HELPER — XSS PREVENTION
   ============================================= */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* =============================================
   PRINT HELPER
   ============================================= */
function printElement(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open('', '_blank', 'width=600,height=700');
  win.document.write(`
    <!DOCTYPE html><html><head>
      <title>Arham Traders</title>
      <style>
        body {
          font-family: 'Inter', sans-serif;
          color: #1e2333;
          margin: 0;
          padding: 0;
          background: #fff;
        }
        * { box-sizing: border-box; }
        .receipt-paper {
          max-width: 280px;
          width: 100%;
          margin: 0 auto;
          padding: 16px 14px;
          font-size: 11px;
          border-radius: 8px;
          border: 1px dashed #c8c0b4;
        }
        .receipt-company { font-size: 18px; }
        .receipt-subtitle { font-size: 10px; }
        .receipt-title { font-size: 10px; padding: 3px 10px; }
        .receipt-row-label,
        .receipt-row-value,
        .receipt-total-box .label,
        .receipt-total-box .amount,
        .receipt-footer-note,
        .receipt-stamp {
          font-size: 10px;
        }
        .receipt-total-box { padding: 10px 12px; }
        .receipt-total-box .amount { font-size: 14px; }
        .receipt-divider { margin: 10px 0; }
        @page { size: 80mm auto; margin: 0; }
      </style>
    </head><body>${el.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

/* =============================================
   WHATSAPP SHARE
   ============================================= */
function shareWhatsApp(text) {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
}

/* =============================================
   INPUT SANITIZER (for form inputs)
   ============================================= */
function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/[<>]/g, '');
}

/* =============================================
   DELETE ALL DATA (localStorage + Supabase)
   ============================================= */
function deleteAllDataConfirm() {
  showConfirm(
    '⚠️ WARNING: This will permanently delete ALL data (Suppliers, Bookings, Warehouse, Production, Finished Goods, Deliveries, Finance, Vendors, Income/Expense) from the cloud. This action CANNOT be undone!',
    function () {
      /* Second confirmation for safety */
      showConfirm(
        '🔴 LAST CHANCE: Are you ABSOLUTELY SURE? ALL data will be permanently deleted from the cloud. This cannot be recovered!',
        async function () {
          const btn = document.getElementById('deleteAllDataBtn');
          if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span class="btn-label-desktop"> Deleting...</span>'; }

          const ALL_KEYS = [
            'suppliers', 'bookings', 'warehouse', 'production',
            'finished_goods', 'deliveries',
            'sf_payments',
            'vendors', 'vendor_expenses', 'vendor_payments', 'vendor_monthly_closings',
            'income', 'expenses', 'monthly_closings',
            'exp_bookings', 'exp_receivings', 'exp_material_expenses',
            'exp_production', 'exp_ready_stock', 'exp_customers',
            'exp_sales_bookings', 'exp_containers', 'exp_shipment_expenses',
            'exp_payments'
          ];

          /* Step 1: Clear in-memory store */
          ALL_KEYS.forEach(k => { if (window._memStore) window._memStore[k] = []; });

          /* Step 2: Clear Supabase cloud data */
          let cloudError = null;
          if (typeof window.supabaseClearRemoteData === 'function') {
            const result = await window.supabaseClearRemoteData(ALL_KEYS);
            if (result && result.error) {
              cloudError = result.error.message || 'Unknown cloud error';
            }
          }

          /* Step 3: Also clean up any old localStorage remnants */
          ALL_KEYS.forEach(k => {
            localStorage.removeItem('at_' + k);
            localStorage.removeItem('at_deleted_' + k);
          });

          if (cloudError) {
            showToast('⚠️ Cloud error: ' + cloudError + '. Try again.', 'warning', 5000);
          } else {
            showToast('✅ All data deleted permanently from cloud!', 'success', 4000);
          }

          /* Step 4: Reset the button */
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash-alt"></i><span class="btn-label-desktop"> Delete All Data</span>'; }

          /* Step 5: Reload page after short delay */
          setTimeout(() => location.reload(), 1500);
        },
        'Yes, Delete Everything'
      );
    },
    'Continue to Delete'
  );
}
