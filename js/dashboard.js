/* =============================================
   ARHAM TRADERS — DASHBOARD
   js/dashboard.js
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  initStockChart();
  initRatioChart();
  loadActivity();
});

/* =============================================
   STAT CARDS
   ============================================= */
function updateStats() {
  const s = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  s('totalSuppliers', Stats.getTotalSuppliers());
  s('warehouseStock', `${formatTON(Stats.getWarehouseStock())} <small>TON</small>`);
  s('inProduction',   `${formatTON(Stats.getInProduction())} <small>TON</small>`);
  s('finishedGoods',  `${formatTON(Stats.getFinishedGoods())} <small>TON</small>`);
  s('todayBookings',  Stats.getTodayBookings());
  s('todayDeliveries',Stats.getTodayDeliveries());
}

/* =============================================
   STOCK TREND CHART (Line)
   ============================================= */
function initStockChart() {
  const ctx = document.getElementById('stockTrendChart');
  if (!ctx) return;
  const { labels, data } = Stats.getStockTrend();

  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Booked (KG)',
        data,
        borderColor: '#2a9d8f',
        backgroundColor: 'rgba(42,157,143,0.07)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#2a9d8f',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#2a9d8f',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#181c2a',
          titleColor: '#ffffff',
          bodyColor: '#b8bccb',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: ctx => `  ${formatTON(ctx.parsed.y)} TON booked`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#9aa0b0', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          border: { display: false },
          ticks: {
            color: '#9aa0b0',
            font: { size: 11 },
            callback: v => formatTON(v)
          }
        }
      }
    }
  });
}

/* =============================================
   PRODUCTION RATIO CHART (Doughnut)
   ============================================= */
function initRatioChart() {
  const ctx = document.getElementById('productionRatioChart');
  if (!ctx) return;
  const { finished, scrap } = Stats.getProductionRatio();
  const hasData = finished > 0 || scrap > 0;
  const data   = hasData ? [finished, scrap] : [1, 0];
  const colors = hasData
    ? ['#2a9d8f', '#e07b39']
    : ['#e2ddd6', '#e2ddd6'];

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Finished Goods', 'Scrap'],
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 6,
        hoverBorderWidth: 2,
        hoverBorderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '74%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#181c2a',
          callbacks: {
            label: ctx => `  ${formatTON(ctx.parsed)} TON`
          }
        }
      }
    }
  });

  /* Custom legend */
  const legend = document.getElementById('doughnutLegend');
  if (legend) {
    const total = finished + scrap;
    const finPct = total > 0 ? Math.round(finished / total * 100) : 0;
    const scrPct = total > 0 ? Math.round(scrap    / total * 100) : 0;
    legend.innerHTML = `
      <div class="legend-item">
        <div class="legend-dot" style="background:#2a9d8f;"></div>
        <span>Finished Goods</span>
        <span>${finPct}%</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot" style="background:#e07b39;"></div>
        <span>Scrap</span>
        <span>${scrPct}%</span>
      </div>
      <div class="legend-item" style="margin-top:4px;border-top:1px solid var(--color-border);padding-top:8px;">
        <div class="legend-dot" style="background:var(--color-border);"></div>
        <span style="color:var(--text-muted);">Total</span>
        <span>${formatTON(total)} TON</span>
      </div>`;
  }
}

/* =============================================
   RECENT ACTIVITY
   ============================================= */
function loadActivity() {
  renderRecentBookings();
  renderRecentDeliveries();
  renderTopSuppliers();
}

function renderRecentBookings() {
  const el = document.getElementById('recentBookings');
  if (!el) return;
  const bookings = DB.get('bookings').slice(-5).reverse();
  if (!bookings.length) return;
  el.innerHTML = bookings.map(b => `
    <div class="activity-item">
      <div class="activity-icon">
        <i class="fas fa-clipboard-list"></i>
      </div>
      <div class="activity-details">
        <div class="activity-name">${escapeHtml(b.supplierName || 'Unknown')}</div>
        <div class="activity-meta">${escapeHtml(b.bookingNo || '')} &nbsp;·&nbsp; ${formatDate(b.date)}</div>
      </div>
      <span class="activity-amount">${formatTON(b.weight)} TON</span>
    </div>`).join('');
}

function renderRecentDeliveries() {
  const el = document.getElementById('recentDeliveries');
  if (!el) return;
  const deliveries = DB.get('deliveries').slice(-5).reverse();
  if (!deliveries.length) return;
  el.innerHTML = deliveries.map(d => `
    <div class="activity-item">
      <div class="activity-icon" style="background:var(--emerald-light);color:var(--emerald);">
        <i class="fas fa-truck"></i>
      </div>
      <div class="activity-details">
        <div class="activity-name">${escapeHtml(d.supplierName || 'Unknown')}</div>
        <div class="activity-meta">${escapeHtml(d.referenceNo || '')} &nbsp;·&nbsp; ${formatDate(d.date)}</div>
      </div>
      <span class="activity-amount" style="color:var(--emerald);">${formatTON(d.weight)} TON</span>
    </div>`).join('');
}

function renderTopSuppliers() {
  const el = document.getElementById('topSuppliers');
  if (!el) return;
  const suppliers = DB.get('suppliers').slice(0, 5);
  if (!suppliers.length) return;
  el.innerHTML = suppliers.map((s, i) => `
    <div class="activity-item">
      <div class="activity-icon" style="background:var(--mineral-blue-light);color:var(--mineral-blue);">
        <span style="font-weight:800;font-size:12px;">${i + 1}</span>
      </div>
      <div class="activity-details">
        <div class="activity-name">${escapeHtml(s.name)}</div>
        <div class="activity-meta">${escapeHtml(s.phone || '')} ${s.city ? ' &nbsp;·&nbsp; ' + escapeHtml(s.city) : ''}</div>
      </div>
      <span class="badge badge-teal">Active</span>
    </div>`).join('');
}
