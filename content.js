// ============================================================
// CONTENT SCRIPT — Activity sensor + Floating widget
// Reports user activity and tab visibility to background.js.
// Optionally shows a floating timer widget on the page.
// ============================================================

let lastHeartbeat = 0;
const HEARTBEAT_THROTTLE_MS = 3000; // Send at most 1 heartbeat per 3 seconds

// ---- Send activity heartbeat (throttled) ----
function sendHeartbeat() {
  const now = Date.now();
  if (now - lastHeartbeat < HEARTBEAT_THROTTLE_MS) return;
  lastHeartbeat = now;

  try {
    chrome.runtime.sendMessage({ type: 'ACTIVITY_HEARTBEAT' });
  } catch {
    // Extension context invalidated (e.g., during reload) — ignore
  }
}

// ---- User activity listeners ----
window.addEventListener('mousemove', sendHeartbeat, { passive: true });
window.addEventListener('keydown', sendHeartbeat, { passive: true });
window.addEventListener('scroll', sendHeartbeat, { passive: true });
window.addEventListener('click', sendHeartbeat, { passive: true });
window.addEventListener('touchstart', sendHeartbeat, { passive: true });

// ---- Tab visibility ----
document.addEventListener('visibilitychange', () => {
  try {
    chrome.runtime.sendMessage({
      type: 'VISIBILITY_CHANGE',
      hidden: document.hidden
    });
  } catch {
    // Ignore
  }
});

// ---- Video detection ----
function observeVideos() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (video._smartStopwatchObserved) return;
    video._smartStopwatchObserved = true;

    video.addEventListener('play', sendHeartbeat);
    video.addEventListener('timeupdate', sendHeartbeat);
  });
}

observeVideos();
const videoObserverInterval = setInterval(observeVideos, 5000);

const mutationObserver = new MutationObserver(() => {
  observeVideos();
});
mutationObserver.observe(document.body || document.documentElement, {
  childList: true,
  subtree: true
});

// Send an initial heartbeat and visibility state so the background knows this tab is active
sendHeartbeat();
try {
  chrome.runtime.sendMessage({
    type: 'VISIBILITY_CHANGE',
    hidden: document.hidden
  });
} catch {
  // Ignore
}


// ============================================================
// FLOATING WIDGET — Shows timer on the page
// ============================================================

let widgetEl = null;
let widgetInterval = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function createWidget() {
  if (widgetEl) return;

  const container = document.createElement('div');
  container.id = 'sst-floating-widget';

  container.innerHTML = `
    <div id="sst-widget-pill">
      <div id="sst-widget-dot"></div>
      <div id="sst-widget-time">00:00:00</div>
      <button id="sst-widget-close" title="Hide widget">✕</button>
    </div>
  `;

  document.body.appendChild(container);
  widgetEl = container;

  // ---- Dragging ----
  const pill = container.querySelector('#sst-widget-pill');

  pill.addEventListener('mousedown', (e) => {
    if (e.target.id === 'sst-widget-close') return;
    isDragging = true;
    const rect = container.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    pill.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    container.style.left = x + 'px';
    container.style.top = y + 'px';
    container.style.right = 'auto';
    container.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      pill.style.cursor = 'grab';
    }
  });

  // ---- Close button ----
  container.querySelector('#sst-widget-close').addEventListener('click', () => {
    hideWidget();
    sessionStorage.setItem('sst-widget-closed', 'true');
    checkDisplaySettings(); // re-eval interval
  });
}
// ============================================================
// DISPLAY UPDATES (Widget + Tab Title)
// ============================================================

let displayInterval = null;
let tabTitleEnabled = false;
let widgetEnabled = false;
let originalTitle = document.title;
let titleIntervalBackup = null; // backup original title in case page changes it

function updateDisplays() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) return;

      const { isTracking, studyTime } = response;
      const timeStr = formatTime(studyTime);

      // 1. Update Widget
      if (widgetEl && !widgetEl.classList.contains('sst-hidden')) {
        const timeEl = widgetEl.querySelector('#sst-widget-time');
        const dotEl = widgetEl.querySelector('#sst-widget-dot');
        const pillEl = widgetEl.querySelector('#sst-widget-pill');

        if (timeEl) {
          timeEl.textContent = timeStr;
          timeEl.className = isTracking ? 'sst-tracking' : '';
        }
        if (dotEl) {
          dotEl.className = isTracking ? 'sst-active' : '';
        }
        if (pillEl) {
          pillEl.className = isTracking ? 'sst-tracking' : '';
        }
      }

      // 2. Update Tab Title
      if (tabTitleEnabled) {
        // If the page itself changed the title, keep the new base title
        if (document.title && !document.title.startsWith('[')) {
          originalTitle = document.title;
        }
        document.title = `[${timeStr}] ${originalTitle}`;
      }
    });
  } catch {
    // Ignore context invalidated
  }
}

function showWidget() {
  if (!widgetEl) createWidget();
  widgetEl.classList.remove('sst-hidden');
}

function hideWidget() {
  if (widgetEl) widgetEl.classList.add('sst-hidden');
}

function destroyWidget() {
  hideWidget();
  if (widgetEl) {
    widgetEl.remove();
    widgetEl = null;
  }
}

function resetTabTitle() {
  if (document.title.startsWith('[')) {
    document.title = originalTitle;
  }
}

function checkDisplaySettings() {
  try {
    chrome.storage.local.get(['displaySettings'], (result) => {
      if (chrome.runtime.lastError) return;
      const settings = result.displaySettings || {};
      
      widgetEnabled = settings.widget === true;
      tabTitleEnabled = settings.tabTitle === true;

      // Handle Widget
      const widgetAllowed = widgetEnabled && !sessionStorage.getItem('sst-widget-closed');
      if (widgetAllowed) {
        showWidget();
      } else {
        destroyWidget();
      }

      // Handle Tab Title
      if (!tabTitleEnabled) {
        resetTabTitle();
      }

      // Manage Polling Interval
      const needsInterval = widgetAllowed || tabTitleEnabled;
      if (needsInterval && !displayInterval) {
        updateDisplays();
        displayInterval = setInterval(updateDisplays, 1000);
      } else if (!needsInterval && displayInterval) {
        clearInterval(displayInterval);
        displayInterval = null;
      }
    });
  } catch {
    // Ignore
  }
}

// Check on load
checkDisplaySettings();

// Listen for setting changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.displaySettings) {
    sessionStorage.removeItem('sst-widget-closed'); 
    checkDisplaySettings();
  }
});