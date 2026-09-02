// ============================================================
// NEW TAB SCRIPT — Study dashboard on every new tab
// ============================================================

const QUOTES = [
  "The expert in anything was once a beginner.",
  "Small daily improvements lead to stunning results.",
  "Don't watch the clock; do what it does — keep going.",
  "The capacity to learn is a gift; the ability to learn is a skill.",
  "Study hard what interests you the most in the most undisciplined, irreverent way possible.",
  "An investment in knowledge pays the best interest.",
  "The beautiful thing about learning is nobody can take it away from you.",
  "Education is not the filling of a pail, but the lighting of a fire.",
  "Live as if you were to die tomorrow. Learn as if you were to live forever.",
  "The more that you read, the more things you will know."
];

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
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function shortenDomain(domain) {
  if (!domain) return '—';
  return domain.replace(/\.(com|org|net|io|ai|dev)$/, '');
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

// ---- Check if new tab dashboard is enabled ----
chrome.storage.local.get(['displaySettings'], (result) => {
  const settings = result.displaySettings || {};
  const newtabEnabled = settings.newtab !== false; // Default: enabled

  if (!newtabEnabled) {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('disabledMsg').style.display = 'block';
    document.getElementById('openSettingsLink').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    return;
  }

  // ---- Initialize ----
  init();
});

function init() {
  // Greeting
  document.getElementById('greeting').textContent = getGreeting();

  // Date
  const now = new Date();
  document.getElementById('dateDisplay').textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  // Random quote
  document.getElementById('quote').textContent = `"${QUOTES[Math.floor(Math.random() * QUOTES.length)]}"`;

  // Start updating
  updateDisplay();
  setInterval(updateDisplay, 1000);
}

function updateDisplay() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    const { isTracking, currentSite, studyTime, todayTotal } = response;

    // Big timer
    const bigTimer = document.getElementById('bigTimer');
    bigTimer.textContent = formatTimeFull(studyTime);
    bigTimer.className = isTracking ? 'big-timer tracking' : 'big-timer';

    // Status
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (isTracking) {
      statusDot.className = 'nt-status-dot active';
      statusText.innerHTML = `Tracking <span class="nt-status-site">${shortenDomain(currentSite)}</span>`;
    } else {
      statusDot.className = 'nt-status-dot';
      statusText.textContent = currentSite ? 'Paused' : 'Not tracking';
    }

    // Today
    document.getElementById('todayStat').textContent = formatTimeShort(todayTotal);

    // Current site
    document.getElementById('siteStat').textContent = shortenDomain(currentSite);
  });

  // Week total from storage
  chrome.storage.local.get(['dailyLogs'], (result) => {
    const dailyLogs = result.dailyLogs || {};
    let weekTotal = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      if (dailyLogs[key]) weekTotal += dailyLogs[key].total;
    }
    document.getElementById('weekStat').textContent = formatTimeShort(weekTotal);
  });
}
