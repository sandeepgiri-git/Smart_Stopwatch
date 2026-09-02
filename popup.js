// ============================================================
// POPUP SCRIPT — Reads state from background & storage
// ============================================================

// ---- Format Helpers ----
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
  return `${m}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function shortenDomain(domain) {
  if (!domain) return '—';
  // Remove common TLDs for display
  return domain.replace(/\.(com|org|net|io|ai|dev)$/, '');
}

// ---- Update Display ----
const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // ~326.73

function updateProgressRing(todayTotal, goalSettings) {
  const ring = document.getElementById('progressRing');
  const goalLabel = document.getElementById('goalLabel');
  const goalText = document.getElementById('goalText');

  if (!goalSettings || !goalSettings.enabled) {
    // Hide the ring stroke and label when no goal set
    ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
    goalLabel.style.display = 'none';
    return;
  }

  const goalSeconds = goalSettings.dailyGoalMins * 60;
  const progress = Math.min(todayTotal / goalSeconds, 1);
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  ring.style.strokeDashoffset = offset;

  goalLabel.style.display = 'block';

  if (progress >= 1) {
    ring.classList.add('complete');
    goalText.className = 'goal-text achieved';
    goalText.textContent = '🎉 Goal reached!';
  } else {
    ring.classList.remove('complete');
    goalText.className = 'goal-text';
    const pct = Math.round(progress * 100);
    const h = Math.floor(goalSettings.dailyGoalMins / 60);
    const m = goalSettings.dailyGoalMins % 60;
    let goalStr = '';
    if (h > 0) goalStr += `${h}h`;
    if (m > 0) goalStr += ` ${m}m`;
    goalText.textContent = `🎯 ${pct}% of ${goalStr.trim()} goal`;
  }
}

function updateDisplay() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      // Background might not be ready yet, try reading from storage instead
      chrome.storage.local.get(['studyTime'], (result) => {
        document.getElementById('globalTime').innerText = formatTimeFull(result.studyTime || 0);
      });
      return;
    }

    const { isTracking, extensionEnabled, currentSite, studyTime, todayTotal } = response;

    const extToggle = document.getElementById('extensionToggle');
    if (extToggle && extToggle.checked !== extensionEnabled) {
      extToggle.checked = extensionEnabled;
    }

    // Global time
    const globalTimeEl = document.getElementById('globalTime');
    globalTimeEl.innerText = formatTimeFull(studyTime);
    if (isTracking) {
      globalTimeEl.classList.add('tracking');
    } else {
      globalTimeEl.classList.remove('tracking');
    }

    // Status
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (isTracking) {
      statusDot.className = 'status-dot active';
      statusText.innerHTML = `Tracking <span class="status-site">${shortenDomain(currentSite)}</span>`;
    } else if (currentSite) {
      statusDot.className = 'status-dot paused';
      statusText.innerHTML = `Paused on <span class="status-site">${shortenDomain(currentSite)}</span>`;
    } else {
      statusDot.className = 'status-dot';
      statusText.innerText = 'Not a study site';
    }

    // Today
    document.getElementById('todayTime').innerText = formatTimeShort(todayTotal);

    // Current site
    document.getElementById('currentSite').innerText = shortenDomain(currentSite);

    // Progress ring — read goal settings from storage
    chrome.storage.local.get(['goalSettings'], (result) => {
      const gs = result.goalSettings || { enabled: false, dailyGoalMins: 120 };
      updateProgressRing(todayTotal, gs);
    });
  });
}

// ---- Init ----
updateDisplay();
setInterval(updateDisplay, 1000);

// ---- Extension Toggle ----
document.getElementById('extensionToggle').addEventListener('change', (e) => {
  chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION', enabled: e.target.checked }, () => {
    updateDisplay();
  });
});

// ---- Reset Today Button ----
document.getElementById('resetTodayBtn').addEventListener('click', () => {
  if (confirm('Reset today\'s study time? Your all-time total will also be reduced.')) {
    chrome.runtime.sendMessage({ type: 'RESET_TODAY' }, () => {
      updateDisplay();
    });
  }
});

// ---- Dashboard Button ----
document.getElementById('dashboardBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

// ---- Settings Button ----
document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ---- Display Options Logic ----
const toggleWidgetPopup = document.getElementById('toggleWidgetPopup');
const toggleSidePanelPopup = document.getElementById('toggleSidePanelPopup');
const toggleNewTabPopup = document.getElementById('toggleNewTabPopup');
const toggleTabTitlePopup = document.getElementById('toggleTabTitlePopup');
const toggleDynamicIconPopup = document.getElementById('toggleDynamicIconPopup');

// Load settings
chrome.storage.local.get(['displaySettings'], (result) => {
  const settings = result.displaySettings || { widget: false, sidePanel: false, newtab: false, tabTitle: false, dynamicIcon: false };
  toggleWidgetPopup.checked = settings.widget;
  toggleSidePanelPopup.checked = settings.sidePanel;
  toggleNewTabPopup.checked = settings.newtab;
  toggleTabTitlePopup.checked = settings.tabTitle;
  toggleDynamicIconPopup.checked = settings.dynamicIcon;
});

function savePopupDisplaySettings() {
  chrome.storage.local.get(['displaySettings'], (result) => {
    const settings = result.displaySettings || { widget: false, sidePanel: false, newtab: false, tabTitle: false, dynamicIcon: false };
    settings.widget = toggleWidgetPopup.checked;
    settings.sidePanel = toggleSidePanelPopup.checked;
    settings.newtab = toggleNewTabPopup.checked;
    settings.tabTitle = toggleTabTitlePopup.checked;
    settings.dynamicIcon = toggleDynamicIconPopup.checked;
    
    chrome.storage.local.set({ displaySettings: settings }, () => {
      chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
    });
  });
}

toggleWidgetPopup.addEventListener('change', savePopupDisplaySettings);
toggleTabTitlePopup.addEventListener('change', savePopupDisplaySettings);
toggleDynamicIconPopup.addEventListener('change', savePopupDisplaySettings);

toggleSidePanelPopup.addEventListener('change', () => {
  savePopupDisplaySettings();
  if (toggleSidePanelPopup.checked) {
    // Enable the side panel first, then open it in the current window.
    // Calling this directly in the popup satisfies the 'user gesture' requirement.
    chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true }).then(() => {
      chrome.windows.getCurrent((win) => {
        if (win) {
          chrome.sidePanel.open({ windowId: win.id }).catch(() => {});
        }
      });
    }).catch(() => {});
  } else {
    chrome.runtime.sendMessage({ type: 'CLOSE_SIDE_PANEL' });
  }
});

toggleNewTabPopup.addEventListener('change', () => {
  savePopupDisplaySettings();
  const dashUrl = chrome.runtime.getURL('newtab.html');
  if (toggleNewTabPopup.checked) {
    chrome.tabs.create({ url: dashUrl, pinned: true });
  } else {
    chrome.tabs.query({ url: dashUrl }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.remove(tab.id));
    });
  }
});