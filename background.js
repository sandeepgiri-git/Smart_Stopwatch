// ============================================================
// BACKGROUND SERVICE WORKER — Central timekeeper
// The single source of truth for all study time tracking.
// ============================================================

// ---- Default Study Sites (duplicated here since importScripts is sync) ----
const DEFAULT_STUDY_SITES = [
  "udemy.com", "coursera.org", "edx.org", "khanacademy.org",
  "skillshare.com", "pluralsight.com", "linkedin.com",
  "freecodecamp.org", "leetcode.com", "hackerrank.com",
  "codewars.com", "codecademy.com", "exercism.org", "w3schools.com",
  "developer.mozilla.org", "devdocs.io", "learn.microsoft.com",
  "docs.python.org", "reactjs.org", "nodejs.org",
  "stackoverflow.com", "stackexchange.com", "geeksforgeeks.org",
  "medium.com", "dev.to", "github.com",
  "youtube.com",
  "chatgpt.com", "claude.ai", "gemini.google.com", "perplexity.ai"
];

// ---- State ----
let activeTabId = null;
let activeTabUrl = '';
let isTabVisible = true;
let isUserActive = true;           // Assume active on startup (service worker wake = user present)
let lastActivityTime = Date.now(); // Assume recent activity on startup
let idleTimeoutMs = 120000;        // 2 minutes default

let extensionEnabled = true;       // Master toggle
let lastTrackedDate = '';

let studyTime = 0;       // Global total (seconds)
let dailyLogs = {};       // { "2026-08-31": { total: 0, sites: { "udemy.com": 0 } } }
let whitelist = [];       // Combined: defaults + custom
let customSites = [];     // User-added sites
let disabledSites = [];   // Sites toggled off

let displaySettings = { dynamicIcon: false };
let notificationSettings = { enabled: false, intervalMins: 60 };
let lastNotifiedMinute = 0; // Prevent spamming notifications in the same minute

let goalSettings = { enabled: false, dailyGoalMins: 120 };
let streakData = { current: 0, longest: 0, lastGoalDate: '' };
let goalCelebratedToday = false; // Prevent repeated celebration notifications
let siteCategories = {};  // User-overridden site categories

let timerInterval = null;

// ---- Helpers ----
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    // Remove "www." prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isDomainWhitelisted(domain) {
  if (!domain) return false;
  // Check if the domain itself or any parent domain is in the active whitelist
  const activeSites = whitelist.filter(s => !disabledSites.includes(s));
  return activeSites.some(site => domain === site || domain.endsWith('.' + site));
}

// ---- Storage ----
async function loadState() {
  const result = await chrome.storage.local.get([
    'studyTime', 'dailyLogs', 'customSites', 'disabledSites', 
    'idleTimeoutMs', 'displaySettings', 'notificationSettings',
    'extensionEnabled', 'lastTrackedDate',
    'goalSettings', 'streakData', 'goalCelebratedToday', 'siteCategories'
  ]);
  studyTime = result.studyTime || 0;
  dailyLogs = result.dailyLogs || {};
  customSites = result.customSites || [];
  disabledSites = result.disabledSites || [];
  idleTimeoutMs = result.idleTimeoutMs || 120000;
  displaySettings = result.displaySettings || { dynamicIcon: false };
  notificationSettings = result.notificationSettings || { enabled: false, intervalMins: 60 };
  extensionEnabled = result.extensionEnabled !== false; // default true
  lastTrackedDate = result.lastTrackedDate || getTodayKey();
  goalSettings = result.goalSettings || { enabled: false, dailyGoalMins: 120 };
  streakData = result.streakData || { current: 0, longest: 0, lastGoalDate: '' };
  goalCelebratedToday = result.goalCelebratedToday || false;
  siteCategories = result.siteCategories || {};
  
  // Daily reset check on load
  const today = getTodayKey();
  if (lastTrackedDate !== today) {
    // Before resetting, check if yesterday met the goal for streak tracking
    updateStreakOnDayChange(lastTrackedDate);
    studyTime = 0;
    goalCelebratedToday = false;
    lastTrackedDate = today;
  }
  
  whitelist = [...DEFAULT_STUDY_SITES, ...customSites];
}

// ---- Streak Logic ----
function updateStreakOnDayChange(previousDateKey) {
  if (!goalSettings.enabled) return;

  const prevLog = dailyLogs[previousDateKey];
  const prevTotal = prevLog ? prevLog.total : 0;
  const goalSeconds = goalSettings.dailyGoalMins * 60;

  if (prevTotal >= goalSeconds) {
    // Previous day met the goal
    if (streakData.lastGoalDate === previousDateKey) {
      // Already counted (e.g. goal was met during the day)
      return;
    }
    streakData.current++;
    streakData.lastGoalDate = previousDateKey;
    if (streakData.current > streakData.longest) {
      streakData.longest = streakData.current;
    }
  } else {
    // Previous day did NOT meet goal — break streak
    // But only if the last goal date isn't today (we haven't skipped multiple days)
    const lastGoal = streakData.lastGoalDate;
    if (lastGoal && lastGoal !== previousDateKey) {
      // Check if consecutive
      const prev = new Date(previousDateKey + 'T00:00:00');
      const last = new Date(lastGoal + 'T00:00:00');
      const diffDays = Math.round((prev - last) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        streakData.current = 0;
      }
    }
    if (!lastGoal) {
      streakData.current = 0;
    }
  }
}

let saveTimeout = null;
function scheduleSave() {
  // Debounce saves — write at most every 5 seconds
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    chrome.storage.local.set({
      studyTime,
      dailyLogs,
      customSites,
      disabledSites,
      idleTimeoutMs,
      extensionEnabled,
      lastTrackedDate,
      goalSettings,
      streakData,
      goalCelebratedToday,
      siteCategories
    });
    saveTimeout = null;
  }, 5000);
}

function forceSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  chrome.storage.local.set({
    studyTime,
    dailyLogs,
    customSites,
    disabledSites,
    idleTimeoutMs,
    extensionEnabled,
    lastTrackedDate,
    goalSettings,
    streakData,
    goalCelebratedToday,
    siteCategories
  });
}

// ---- Badge (shows timer on extension icon) ----
function formatBadgeTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 100) return `${h}h`;
  if (h >= 10) return `${h}h`;
  if (h >= 1) return `${h}:${m.toString().padStart(2, '0')}`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function updateBadge(isTracking) {
  if (displaySettings.dynamicIcon && typeof OffscreenCanvas !== 'undefined') {
    // Dynamic Pie Chart Icon
    chrome.action.setBadgeText({ text: '' }); // Clear badge text
    updateDynamicIcon(isTracking);
  } else {
    // Standard Badge Text
    const text = formatBadgeTime(studyTime);
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({
      color: isTracking ? '#22c55e' : '#52525b'
    });
  }
}

// ---- Dynamic Canvas Icon ----
function updateDynamicIcon(isTracking) {
  const canvas = new OffscreenCanvas(32, 32);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  ctx.clearRect(0, 0, 32, 32);

  // Background circle
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, 2 * Math.PI);
  ctx.fillStyle = isTracking ? '#064e3b' : '#27272a'; // Dark green or dark gray
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = isTracking ? '#14532d' : '#3f3f46';
  ctx.stroke();

  // Progress slice (1 hour loop)
  const progress = (studyTime % 3600) / 3600;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (progress * 2 * Math.PI);

  ctx.beginPath();
  ctx.moveTo(16, 16);
  ctx.arc(16, 16, 14, startAngle, endAngle);
  ctx.fillStyle = isTracking ? '#4ade80' : '#a1a1aa'; // Light green or light gray
  ctx.fill();

  chrome.action.setIcon({ imageData: ctx.getImageData(0, 0, 32, 32) });
}

// ---- Timer Logic ----
function tick() {
  const domain = extractDomain(activeTabUrl);
  const isWhitelisted = isDomainWhitelisted(domain);
  const isActive = isUserActive && (Date.now() - lastActivityTime < idleTimeoutMs);
  const isTracking = extensionEnabled && isTabVisible && isWhitelisted && isActive;

  const today = getTodayKey();
  if (lastTrackedDate !== today) {
    updateStreakOnDayChange(lastTrackedDate);
    studyTime = 0;
    goalCelebratedToday = false;
    lastTrackedDate = today;
    forceSave();
  }

  if (isTracking) {
    studyTime++;

    // Update daily log
    if (!dailyLogs[today]) {
      dailyLogs[today] = { total: 0, sites: {} };
    }
    dailyLogs[today].total++;
    if (!dailyLogs[today].sites[domain]) {
      dailyLogs[today].sites[domain] = 0;
    }
    dailyLogs[today].sites[domain]++;

    // Check if daily goal was just reached
    if (goalSettings.enabled && !goalCelebratedToday) {
      const goalSeconds = goalSettings.dailyGoalMins * 60;
      const todayTotal = dailyLogs[today].total;
      if (todayTotal >= goalSeconds) {
        goalCelebratedToday = true;
        // Update streak immediately
        streakData.current++;
        streakData.lastGoalDate = today;
        if (streakData.current > streakData.longest) {
          streakData.longest = streakData.current;
        }
        // Fire celebration notification
        const hours = Math.floor(goalSettings.dailyGoalMins / 60);
        const mins = goalSettings.dailyGoalMins % 60;
        let goalStr = '';
        if (hours > 0) goalStr += `${hours}h `;
        if (mins > 0) goalStr += `${mins}m`;
        chrome.notifications.create('goal-reached', {
          type: 'basic',
          iconUrl: 'icon.png',
          title: '🎉 Daily Goal Reached!',
          message: `You hit your ${goalStr.trim()} study goal! 🔥 Streak: ${streakData.current} day${streakData.current > 1 ? 's' : ''}`
        });
      }
    }

    scheduleSave();
  }

  // Handle Notifications
  if (isTracking && notificationSettings.enabled && studyTime > 0) {
    const currentMinute = Math.floor(studyTime / 60);
    const intervalMins = notificationSettings.intervalMins || 60;
    
    // Check if we hit an exact multiple of the interval, and haven't notified for this specific minute yet
    if (currentMinute > 0 && currentMinute % intervalMins === 0 && currentMinute !== lastNotifiedMinute) {
      lastNotifiedMinute = currentMinute;
      
      const hours = Math.floor(currentMinute / 60);
      const mins = currentMinute % 60;
      let timeStr = '';
      if (hours > 0) timeStr += `${hours}h `;
      if (mins > 0 || hours === 0) timeStr += `${mins}m`;
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png', // Assuming there's a default icon, fallback is handled by Chrome
        title: 'Study Milestone Reached! 🚀',
        message: `You've studied for ${timeStr.trim()} in total. Keep up the great work!`
      });
    }
  }

  // Always update badge so color reflects tracking/paused state
  updateBadge(isTracking);
}

function startTimer() {
  if (!timerInterval) {
    timerInterval = setInterval(tick, 1000);
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    forceSave();
  }
}

// ---- Get current tracking status ----
function getTrackingStatus() {
  const domain = extractDomain(activeTabUrl);
  const isWhitelisted = isDomainWhitelisted(domain);
  const isActive = isUserActive && (Date.now() - lastActivityTime < idleTimeoutMs);
  const isTracking = extensionEnabled && isTabVisible && isWhitelisted && isActive;
  const today = getTodayKey();
  const todayTotal = (dailyLogs[today] && dailyLogs[today].total) || 0;

  return {
    isTracking,
    extensionEnabled,
    currentSite: isWhitelisted ? domain : null,
    studyTime,
    todayTotal,
    isWhitelisted,
    isActive,
    isTabVisible
  };
}

// ---- Tab Events ----
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  isTabVisible = true;           // The newly activated tab is visible
  isUserActive = true;           // Clicking a tab is user activity
  lastActivityTime = Date.now();
  
  try {
    const tab = await chrome.tabs.get(activeTabId);
    activeTabUrl = tab.url || '';
  } catch {
    activeTabUrl = '';
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    activeTabUrl = changeInfo.url;
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus entirely
    isTabVisible = false;
  } else {
    isTabVisible = true;
    // Re-query the active tab in this window
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs && tabs[0]) {
        activeTabId = tabs[0].id;
        activeTabUrl = tabs[0].url || '';
      }
    });
  }
});

// ---- Messages from content scripts ----
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVITY_HEARTBEAT') {
    // Accept heartbeats from any tab
    if (sender.tab) {
      isUserActive = true;
      lastActivityTime = Date.now();
      
      // If this heartbeat came from the focused tab, ensure our state reflects it
      if (sender.tab.active) {
        isTabVisible = true; // Fixes bug where window focus events are lost after OS sleep/lock
        activeTabId = sender.tab.id;
        activeTabUrl = sender.tab.url || activeTabUrl;
      }
    }
  } else if (message.type === 'VISIBILITY_CHANGE') {
    if (sender.tab && sender.tab.id === activeTabId) {
      isTabVisible = !message.hidden;
    }
  } else if (message.type === 'GET_STATUS') {
    // Only refresh activity if this request came from the Extension Popup or Side Panel
    // NOT from content scripts polling every second!
    if (!sender.tab) {
      lastActivityTime = Date.now();
      isUserActive = true;
    }
    sendResponse(getTrackingStatus());
    return true; // async response
  } else if (message.type === 'RESET_TODAY') {
    const today = getTodayKey();
    if (dailyLogs[today]) {
      const todayTotal = dailyLogs[today].total;
      studyTime = Math.max(0, studyTime - todayTotal);
      delete dailyLogs[today];
      forceSave();
    }
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'RESET_ALL') {
    studyTime = 0;
    dailyLogs = {};
    forceSave();
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'OPEN_SIDE_PANEL') {
    // Enable and open the side panel
    chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true }).then(() => {
      chrome.windows.getCurrent((win) => {
        if (win) {
          chrome.sidePanel.open({ windowId: win.id }).catch(() => {});
        }
      });
    }).catch(() => {});
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'CLOSE_SIDE_PANEL') {
    // Disable the side panel entirely (removes it from the UI)
    chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'UPDATE_SETTINGS') {
    // Reload settings from storage
    loadState().then(() => applySidePanelState());
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'TOGGLE_EXTENSION') {
    extensionEnabled = message.enabled;
    forceSave();
    sendResponse({ success: true });
    return true;
  }
});

// ---- Side Panel state ----
async function applySidePanelState() {
  try {
    const result = await chrome.storage.local.get(['displaySettings']);
    const settings = result.displaySettings || {};
    const enabled = settings.sidePanel === true;
    await chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled });
  } catch {
    // sidePanel API may not be available in all browsers
  }
}

// ---- Initialization ----
async function init() {
  await loadState();

  // Get the currently active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
      activeTabId = tab.id;
      activeTabUrl = tab.url || '';
    }
  } catch {
    // Ignore — no active tab yet
  }

  await applySidePanelState();
  startTimer();
}

init();

// ---- Keep service worker alive ----
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Heartbeat to prevent the service worker from sleeping
  }
});
