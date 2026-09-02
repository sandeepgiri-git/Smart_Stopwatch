// ============================================================
// DAY DETAIL SCRIPT — Shows website time distribution for a date
// ============================================================

// ---- Helpers ----
function formatTimeFull(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatTimeShort(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${(seconds % 60).toString().padStart(2, '0')}s`;
}

// ---- Chart Colors (harmonious palette) ----
const CHART_COLORS = [
  '#4ade80', '#22d3ee', '#a78bfa', '#fb923c', '#f472b6',
  '#facc15', '#34d399', '#60a5fa', '#e879f9', '#f87171',
  '#2dd4bf', '#818cf8', '#fbbf24', '#c084fc', '#38bdf8',
  '#a3e635', '#fb7185', '#67e8f9', '#d946ef', '#fda4af'
];

// ---- Parse date from URL ----
function getDateParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('date');
}

// ---- Render donut chart ----
function renderDonutChart(sortedSites, total) {
  const canvas = document.getElementById('donutChart');
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const center = size / 2;
  const outerRadius = size / 2 - 10;
  const innerRadius = outerRadius * 0.6;

  ctx.clearRect(0, 0, size, size);

  if (sortedSites.length === 0) return;

  let startAngle = -Math.PI / 2;

  sortedSites.forEach(([domain, seconds], i) => {
    const sliceAngle = (seconds / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const color = CHART_COLORS[i % CHART_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(
      center + innerRadius * Math.cos(startAngle),
      center + innerRadius * Math.sin(startAngle)
    );
    ctx.arc(center, center, outerRadius, startAngle, endAngle);
    ctx.arc(center, center, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Subtle gap between slices
    ctx.strokeStyle = '#0a0a0f';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle = endAngle;
  });
}

// ---- Render legend ----
function renderLegend(sortedSites, total) {
  const legend = document.getElementById('chartLegend');
  legend.innerHTML = sortedSites.map(([domain, seconds], i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const pct = total > 0 ? Math.round((seconds / total) * 100) : 0;
    return `
      <div class="legend-item">
        <div class="legend-dot" style="background: ${color}"></div>
        <span class="legend-domain" title="${domain}">${domain}</span>
        <span class="legend-time">${pct}%</span>
      </div>
    `;
  }).join('');
}

// ---- Category helper ----
function getCategoryForDomain(domain, userCategories) {
  if (userCategories && userCategories[domain]) return userCategories[domain];
  if (typeof DEFAULT_SITE_CATEGORIES !== 'undefined' && DEFAULT_SITE_CATEGORIES[domain]) {
    return DEFAULT_SITE_CATEGORIES[domain];
  }
  return 'Custom';
}

// ---- Render breakdown table ----
function renderBreakdown(sortedSites, total, userCategories) {
  const table = document.getElementById('breakdownTable');
  const tbody = document.getElementById('breakdownBody');
  const emptyState = document.getElementById('emptyState');

  if (sortedSites.length === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  emptyState.style.display = 'none';

  tbody.innerHTML = sortedSites.map(([domain, seconds], i) => {
    const pct = total > 0 ? Math.round((seconds / total) * 100) : 0;
    const rank = i + 1;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const cat = getCategoryForDomain(domain, userCategories);
    const catInfo = (typeof CATEGORY_INFO !== 'undefined' && CATEGORY_INFO[cat]) ? CATEGORY_INFO[cat] : { emoji: '📌', color: '#fb923c' };

    let rankClass = 'rank-default';
    if (rank === 1) rankClass = 'rank-1';
    else if (rank === 2) rankClass = 'rank-2';
    else if (rank === 3) rankClass = 'rank-3';

    return `
      <tr>
        <td><span class="rank-badge ${rankClass}">${rank}</span></td>
        <td>
          <span class="site-name">${domain}</span>
          <span class="cat-badge" style="background: ${catInfo.color}22; color: ${catInfo.color}">${catInfo.emoji} ${cat}</span>
        </td>
        <td><span class="time-value">${formatTimeShort(seconds)}</span></td>
        <td>${pct}%</td>
        <td>
          <div class="percent-bar-bg">
            <div class="percent-bar-fill" style="width: ${pct}%; background: ${color}"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ---- Main ----
function init() {
  const dateKey = getDateParam();

  // Back button
  document.getElementById('backBtn').addEventListener('click', (e) => {
    e.preventDefault();
    // Navigate to dashboard
    chrome.tabs.update({ url: chrome.runtime.getURL('dashboard.html') });
  });

  if (!dateKey) {
    document.getElementById('dateTitle').textContent = 'No date selected';
    document.getElementById('emptyState').style.display = 'block';
    return;
  }

  // Parse date for display
  const [year, month, day] = dateKey.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dateFormatted = dateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  document.getElementById('dateTitle').textContent = dateFormatted;

  // Check if it's today, yesterday, etc.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(year, month - 1, day);
  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));

  let dayLabel = '';
  if (diffDays === 0) dayLabel = "Today";
  else if (diffDays === 1) dayLabel = "Yesterday";
  else if (diffDays > 1 && diffDays < 7) dayLabel = `${diffDays} days ago`;
  else if (diffDays === 7) dayLabel = "1 week ago";
  document.getElementById('dayLabel').textContent = dayLabel;

  // Load data
  chrome.storage.local.get(['dailyLogs', 'siteCategories'], (result) => {
    const dailyLogs = result.dailyLogs || {};
    const userCategories = result.siteCategories || {};
    const dayLog = dailyLogs[dateKey];

    if (!dayLog || !dayLog.sites || Object.keys(dayLog.sites).length === 0) {
      document.getElementById('totalTime').textContent = '0:00';
      document.getElementById('siteCount').textContent = '0';
      document.getElementById('emptyState').style.display = 'block';
      return;
    }

    const total = dayLog.total || 0;
    const sites = dayLog.sites || {};
    const sortedSites = Object.entries(sites).sort((a, b) => b[1] - a[1]);

    // Summary cards
    document.getElementById('totalTime').textContent = formatTimeShort(total);
    document.getElementById('siteCount').textContent = sortedSites.length;

    // Chart
    document.getElementById('chartSection').style.display = 'block';
    document.getElementById('centerTime').textContent = formatTimeShort(total);
    renderDonutChart(sortedSites, total);
    renderLegend(sortedSites, total);

    // Table
    renderBreakdown(sortedSites, total, userCategories);
  });
}

document.addEventListener('DOMContentLoaded', init);
