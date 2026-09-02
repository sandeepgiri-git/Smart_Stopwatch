// ============================================================
// DASHBOARD SCRIPT — Analytics and per-site breakdown
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

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getWeekKeys() {
  const keys = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(getDateKey(d));
  }
  return keys;
}

function getMonthKeys() {
  const keys = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(getDateKey(d));
  }
  return keys;
}

// ---- Category helper ----
function getCategoryForDomain(domain, userCategories) {
  if (userCategories && userCategories[domain]) return userCategories[domain];
  if (typeof DEFAULT_SITE_CATEGORIES !== 'undefined' && DEFAULT_SITE_CATEGORIES[domain]) {
    return DEFAULT_SITE_CATEGORIES[domain];
  }
  return 'Custom';
}

// ---- Aggregate sites for a set of date keys ----
function aggregateSites(dailyLogs, dateKeys) {
  const sites = {};
  let total = 0;

  dateKeys.forEach(key => {
    const log = dailyLogs[key];
    if (!log || !log.sites) return;
    Object.entries(log.sites).forEach(([domain, seconds]) => {
      if (!sites[domain]) sites[domain] = 0;
      sites[domain] += seconds;
      total += seconds;
    });
  });

  return { sites, total };
}

// ---- Aggregate by category ----
function aggregateByCategory(sites, userCategories) {
  const categories = {};
  let total = 0;

  Object.entries(sites).forEach(([domain, seconds]) => {
    const cat = getCategoryForDomain(domain, userCategories);
    if (!categories[cat]) categories[cat] = { total: 0, sites: {} };
    categories[cat].total += seconds;
    categories[cat].sites[domain] = (categories[cat].sites[domain] || 0) + seconds;
    total += seconds;
  });

  return { categories, total };
}

// ---- Heatmap ----
function getHeatmapLevel(seconds) {
  if (!seconds || seconds === 0) return 0;
  if (seconds < 1800) return 1; // < 30m
  if (seconds < 3600) return 2; // 30m - 1h
  if (seconds < 7200) return 3; // 1h - 2h
  return 4; // > 2h
}

function renderHeatmap(dailyLogs, goalSettings) {
  const grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364);

  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek);

  const totalDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = getDateKey(d);
    
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    
    if (d > today) {
      cell.style.visibility = 'hidden';
    } else {
      const log = dailyLogs[key];
      const seconds = log ? log.total : 0;
      const level = getHeatmapLevel(seconds);
      
      if (level > 0) {
        cell.dataset.level = level;
      }
      
      let isStreakDay = false;
      if (goalSettings && goalSettings.enabled && seconds > 0) {
        const goalSeconds = goalSettings.dailyGoalMins * 60;
        if (seconds >= goalSeconds) {
          isStreakDay = true;
          cell.classList.add('streak-day');
        }
      }
      
      cell.addEventListener('mouseenter', () => {
        const tooltip = document.getElementById('heatmapTooltip');
        document.getElementById('tooltipDate').textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
        let timeText = seconds > 0 ? formatTimeShort(seconds) : '0m 00s';
        if (isStreakDay) {
          timeText += ' 🔥 Goal Reached';
        }
        document.getElementById('tooltipTime').textContent = timeText;
        
        const rect = cell.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.left = (rect.left + window.scrollX - tooltip.offsetWidth / 2 + rect.width / 2) + 'px';
        tooltip.style.top = (rect.top + window.scrollY - tooltip.offsetHeight - 8) + 'px';
      });
      
      cell.addEventListener('mouseleave', () => {
        document.getElementById('heatmapTooltip').style.display = 'none';
      });

      // Click to open date detail page
      cell.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL(`daydetail.html?date=${key}`) });
      });
    }
    
    grid.appendChild(cell);
  }
  
  const container = document.querySelector('.heatmap-container');
  // Auto-scroll to latest only if it hasn't been scrolled yet (or roughly at 0)
  if (container.scrollLeft === 0 && container.scrollWidth > container.clientWidth) {
    container.scrollLeft = container.scrollWidth;
  }
}

// ---- Streak Card ----
function renderStreakCard(streakData, goalSettings, todayTotal) {
  const card = document.getElementById('streakCard');
  if (!goalSettings || !goalSettings.enabled) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  document.getElementById('currentStreak').textContent = streakData.current || 0;
  document.getElementById('longestStreak').textContent = streakData.longest || 0;

  // Goal progress
  const section = document.getElementById('goalProgressSection');
  section.style.display = 'flex';

  const goalSeconds = goalSettings.dailyGoalMins * 60;
  const progress = Math.min(todayTotal / goalSeconds, 1);
  const pct = Math.round(progress * 100);

  document.getElementById('goalProgressText').textContent =
    progress >= 1 ? '🎉 Goal reached!' : `${pct}% of today's goal`;

  const fill = document.getElementById('goalProgressFill');
  fill.style.width = `${pct}%`;
  if (progress >= 1) {
    fill.classList.add('complete');
  } else {
    fill.classList.remove('complete');
  }
}

// ---- Current state ----
let currentFilter = 'today';
let currentView = 'website'; // 'website' or 'category'

// ---- Render ----
function render() {
  chrome.storage.local.get(['dailyLogs', 'goalSettings', 'streakData', 'siteCategories'], (result) => {
    const dailyLogs = result.dailyLogs || {};
    const goalSettings = result.goalSettings || { enabled: false, dailyGoalMins: 120 };
    const streakDataResult = result.streakData || { current: 0, longest: 0, lastGoalDate: '' };
    const userCategories = result.siteCategories || {};

    // Hero stats — compute all-time total from dailyLogs (studyTime resets daily)
    const allTimeTotal = Object.values(dailyLogs).reduce((sum, log) => sum + (log.total || 0), 0);
    document.getElementById('allTimeTotal').textContent = formatTimeFull(allTimeTotal);

    const todayLog = dailyLogs[getTodayKey()];
    const todayTotal = todayLog ? todayLog.total : 0;
    document.getElementById('todayTotal').textContent = formatTimeShort(todayTotal);

    const weekKeys = getWeekKeys();
    const { total: weekTotal } = aggregateSites(dailyLogs, weekKeys);
    document.getElementById('weekTotal').textContent = formatTimeShort(weekTotal);

    // Streak card
    renderStreakCard(streakDataResult, goalSettings, todayTotal);

    // Render Heatmap
    renderHeatmap(dailyLogs, goalSettings);

    // Breakdown based on filter
    let dateKeys;
    switch (currentFilter) {
      case 'today':
        dateKeys = [getTodayKey()];
        break;
      case 'week':
        dateKeys = getWeekKeys();
        break;
      case 'month':
        dateKeys = getMonthKeys();
        break;
      case 'all':
        dateKeys = Object.keys(dailyLogs);
        break;
      default:
        dateKeys = [getTodayKey()];
    }

    const { sites, total } = aggregateSites(dailyLogs, dateKeys);
    const tbody = document.getElementById('breakdownBody');
    const emptyState = document.getElementById('emptyState');

    if (currentView === 'category') {
      renderCategoryView(sites, total, userCategories, tbody, emptyState);
    } else {
      renderWebsiteView(sites, total, userCategories, tbody, emptyState);
    }
  });
}

// ---- Website View ----
function renderWebsiteView(sites, total, userCategories, tbody, emptyState) {
  const sortedSites = Object.entries(sites).sort((a, b) => b[1] - a[1]);

  if (sortedSites.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  tbody.innerHTML = sortedSites.map(([domain, seconds]) => {
    const pct = total > 0 ? Math.round((seconds / total) * 100) : 0;
    const cat = getCategoryForDomain(domain, userCategories);
    const catInfo = (typeof CATEGORY_INFO !== 'undefined' && CATEGORY_INFO[cat]) ? CATEGORY_INFO[cat] : { color: '#71717a' };
    return `
      <tr>
        <td>
          <span class="category-dot" style="background: ${catInfo.color}"></span>
          <span class="site-name">${domain}</span>
        </td>
        <td><span class="time-value">${formatTimeShort(seconds)}</span></td>
        <td>${pct}%</td>
        <td>
          <div class="percent-bar-bg">
            <div class="percent-bar-fill" style="width: ${pct}%"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ---- Category View ----
function renderCategoryView(sites, total, userCategories, tbody, emptyState) {
  const { categories } = aggregateByCategory(sites, userCategories);
  const sortedCats = Object.entries(categories).sort((a, b) => b[1].total - a[1].total);

  if (sortedCats.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  let rows = '';

  sortedCats.forEach(([catName, catData]) => {
    const catInfo = (typeof CATEGORY_INFO !== 'undefined' && CATEGORY_INFO[catName]) ? CATEGORY_INFO[catName] : { emoji: '📌', color: '#fb923c' };
    const pct = total > 0 ? Math.round((catData.total / total) * 100) : 0;

    // Category header row
    rows += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
        <td>
          <span class="category-dot" style="background: ${catInfo.color}"></span>
          <span class="category-name">${catInfo.emoji} ${catName}</span>
        </td>
        <td><span class="time-value">${formatTimeShort(catData.total)}</span></td>
        <td>${pct}%</td>
        <td>
          <div class="percent-bar-bg">
            <div class="percent-bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, ${catInfo.color}, ${catInfo.color}aa)"></div>
          </div>
        </td>
      </tr>
    `;

    // Individual sites within category
    const sortedCatSites = Object.entries(catData.sites).sort((a, b) => b[1] - a[1]);
    sortedCatSites.forEach(([domain, seconds]) => {
      const sitePct = total > 0 ? Math.round((seconds / total) * 100) : 0;
      rows += `
        <tr>
          <td style="padding-left: 32px;">
            <span class="site-name" style="opacity: 0.75">${domain}</span>
          </td>
          <td><span class="time-value" style="opacity: 0.75">${formatTimeShort(seconds)}</span></td>
          <td style="opacity: 0.6">${sitePct}%</td>
          <td>
            <div class="percent-bar-bg">
              <div class="percent-bar-fill" style="width: ${sitePct}%; background: ${catInfo.color}66"></div>
            </div>
          </td>
        </tr>
      `;
    });
  });

  tbody.innerHTML = rows;
}

// ---- Filter buttons ----
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

// ---- View toggle (Website / Category) ----
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    render();
  });
});

// ---- Initial render & auto-refresh ----
render();
setInterval(render, 5000);
