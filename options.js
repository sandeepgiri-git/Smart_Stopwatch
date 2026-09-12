// ============================================================
// OPTIONS SCRIPT — Whitelist management & settings
// ============================================================

let customSites = [];
let disabledSites = [];
let idleTimeoutMs = 120000;
let displaySettings = { widget: false, sidePanel: false, newtab: false, tabTitle: false, dynamicIcon: false };
let notificationSettings = { enabled: false, intervalMins: 60 };
let goalSettings = { enabled: false, dailyGoalMins: 120 };
let siteCategories = {};  // User-overridden categories

// ---- Toast ----
function showToast(message = 'Saved!') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ---- Get category for a domain ----
function getCategoryForDomain(domain) {
  // User override takes priority
  if (siteCategories[domain]) return siteCategories[domain];
  // Then check defaults
  if (typeof DEFAULT_SITE_CATEGORIES !== 'undefined' && DEFAULT_SITE_CATEGORIES[domain]) {
    return DEFAULT_SITE_CATEGORIES[domain];
  }
  return 'Custom';
}

// ---- Save to storage & notify background ----
function saveSettings() {
  chrome.storage.local.set({
    customSites,
    disabledSites,
    idleTimeoutMs,
    displaySettings,
    notificationSettings,
    goalSettings,
    siteCategories
  }, () => {
    // Notify background to reload settings
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
    showToast();
  });
}

// ---- Render site list ----
function renderSiteList() {
  const list = document.getElementById('siteList');
  list.innerHTML = '';

  // Combine defaults and custom, mark which is which
  const allSites = [
    ...customSites.map(s => ({ domain: s, isCustom: true })),
    ...DEFAULT_STUDY_SITES.map(s => ({ domain: s, isCustom: false }))
  ];

  // Sort: custom first, then alphabetical within each group
  allSites.sort((a, b) => {
    if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
    return a.domain.localeCompare(b.domain);
  });

  allSites.forEach(({ domain, isCustom }) => {
    const li = document.createElement('li');
    li.className = 'site-item';

    const isEnabled = !disabledSites.includes(domain);
    const currentCategory = getCategoryForDomain(domain);

    // Build category dropdown options
    const categories = typeof CATEGORY_LIST !== 'undefined' ? CATEGORY_LIST : ['Custom'];
    const categoryOptions = categories.map(cat => {
      const info = (typeof CATEGORY_INFO !== 'undefined' && CATEGORY_INFO[cat]) ? CATEGORY_INFO[cat] : {};
      const emoji = info.emoji || '';
      const selected = cat === currentCategory ? 'selected' : '';
      return `<option value="${cat}" ${selected}>${emoji} ${cat}</option>`;
    }).join('');

    li.innerHTML = `
      <label class="toggle">
        <input type="checkbox" ${isEnabled ? 'checked' : ''} data-domain="${domain}">
        <span class="toggle-slider"></span>
      </label>
      <span class="site-domain">${domain}</span>
      <select class="site-category-select" data-domain="${domain}">${categoryOptions}</select>
      ${isCustom ? `<button class="site-delete-btn" data-domain="${domain}" title="Remove">✕</button>` : ''}
    `;

    list.appendChild(li);
  });

  // Attach toggle listeners
  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const domain = e.target.dataset.domain;
      if (e.target.checked) {
        disabledSites = disabledSites.filter(s => s !== domain);
      } else {
        if (!disabledSites.includes(domain)) {
          disabledSites.push(domain);
        }
      }
      saveSettings();
    });
  });

  // Attach category select listeners
  list.querySelectorAll('.site-category-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const domain = e.target.dataset.domain;
      const selectedCat = e.target.value;
      const defaultCat = (typeof DEFAULT_SITE_CATEGORIES !== 'undefined' && DEFAULT_SITE_CATEGORIES[domain])
        ? DEFAULT_SITE_CATEGORIES[domain]
        : 'Custom';

      if (selectedCat === defaultCat) {
        // Remove override if it matches the default
        delete siteCategories[domain];
      } else {
        siteCategories[domain] = selectedCat;
      }
      saveSettings();
    });
  });

  // Attach delete listeners
  list.querySelectorAll('.site-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const domain = e.target.dataset.domain;
      customSites = customSites.filter(s => s !== domain);
      disabledSites = disabledSites.filter(s => s !== domain);
      delete siteCategories[domain];
      saveSettings();
      renderSiteList();
      showToast('Removed!');
    });
  });
}

// ---- Add site ----
function addSite() {
  const input = document.getElementById('newSiteInput');
  let domain = input.value.trim().toLowerCase();

  // Clean up the input
  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

  if (!domain) return;

  // Validate: must contain at least one dot
  if (!domain.includes('.')) {
    showToast('Enter a valid domain (e.g., example.com)');
    return;
  }

  // Check duplicates
  if (DEFAULT_STUDY_SITES.includes(domain) || customSites.includes(domain)) {
    showToast('Already in the list!');
    return;
  }

  customSites.push(domain);
  input.value = '';
  saveSettings();
  renderSiteList();
  showToast('Added!');
}

document.getElementById('addSiteBtn').addEventListener('click', addSite);
document.getElementById('newSiteInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSite();
});

// ---- Idle Timeout Slider ----
const slider = document.getElementById('idleSlider');
const sliderValue = document.getElementById('idleValue');

slider.addEventListener('input', () => {
  const mins = parseFloat(slider.value);
  sliderValue.textContent = `${mins} min`;
});

slider.addEventListener('change', () => {
  const mins = parseFloat(slider.value);
  idleTimeoutMs = mins * 60 * 1000;
  saveSettings();
});

// ---- Daily Goal Settings ----
const toggleGoalEnabled = document.getElementById('toggleGoalEnabled');
const goalSlider = document.getElementById('goalSlider');
const goalValue = document.getElementById('goalValue');

function formatGoalValue(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (h > 0) return `${h}h 00m`;
  return `${m}m`;
}

function saveGoalSettings() {
  goalSettings = {
    enabled: toggleGoalEnabled.checked,
    dailyGoalMins: parseInt(goalSlider.value, 10)
  };
  // Save goal settings directly too (not just through saveSettings which doesn't save goalSettings to background)
  chrome.storage.local.set({ goalSettings }, () => {
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS' });
    showToast();
  });
}

toggleGoalEnabled.addEventListener('change', saveGoalSettings);

goalSlider.addEventListener('input', () => {
  goalValue.textContent = formatGoalValue(parseInt(goalSlider.value, 10));
});

goalSlider.addEventListener('change', saveGoalSettings);

// ---- Display Option Toggles ----
const toggleWidget = document.getElementById('toggleWidget');
const toggleSidePanel = document.getElementById('toggleSidePanel');
const toggleNewTab = document.getElementById('toggleNewTab');
const toggleTabTitle = document.getElementById('toggleTabTitle');
const toggleDynamicIcon = document.getElementById('toggleDynamicIcon');

function saveDisplaySettings() {
  displaySettings = {
    widget: toggleWidget.checked,
    sidePanel: toggleSidePanel.checked,
    newtab: toggleNewTab.checked,
    tabTitle: toggleTabTitle.checked,
    dynamicIcon: toggleDynamicIcon.checked
  };
  saveSettings();
}

toggleWidget.addEventListener('change', saveDisplaySettings);
toggleTabTitle.addEventListener('change', saveDisplaySettings);
toggleDynamicIcon.addEventListener('change', saveDisplaySettings);

toggleSidePanel.addEventListener('change', () => {
  saveDisplaySettings();
  if (toggleSidePanel.checked) {
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
toggleNewTab.addEventListener('change', () => {
  saveDisplaySettings();
  const dashUrl = chrome.runtime.getURL('newtab.html');
  if (toggleNewTab.checked) {
    // Open dashboard as a pinned tab
    chrome.tabs.create({ url: dashUrl, pinned: true });
  } else {
    // Close any open dashboard tabs
    chrome.tabs.query({ url: dashUrl }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.remove(tab.id));
    });
  }
});

// ---- Notifications ----
const toggleNotifications = document.getElementById('toggleNotifications');
const notifSlider = document.getElementById('notificationIntervalSlider');
const notifValue = document.getElementById('notificationIntervalValue');

function saveNotificationSettings() {
  notificationSettings = {
    enabled: toggleNotifications.checked,
    intervalMins: parseInt(notifSlider.value, 10)
  };
  saveSettings();
}

toggleNotifications.addEventListener('change', saveNotificationSettings);
notifSlider.addEventListener('input', () => {
  notifValue.textContent = `${notifSlider.value} min`;
});
notifSlider.addEventListener('change', saveNotificationSettings);

// ---- Clear All Data ----
document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (confirm('Are you sure? This will permanently delete ALL study time data.')) {
    chrome.runtime.sendMessage({ type: 'RESET_ALL' }, () => {
      showToast('All data cleared.');
    });
  }
});

// ---- Load settings on page open ----
chrome.storage.local.get(['customSites', 'disabledSites', 'idleTimeoutMs', 'displaySettings', 'notificationSettings', 'goalSettings', 'siteCategories'], (result) => {
  customSites = result.customSites || [];
  disabledSites = result.disabledSites || [];
  idleTimeoutMs = result.idleTimeoutMs || 120000;
  displaySettings = result.displaySettings || { widget: false, sidePanel: false, newtab: false, tabTitle: false, dynamicIcon: false };
  notificationSettings = result.notificationSettings || { enabled: false, intervalMins: 60 };
  goalSettings = result.goalSettings || { enabled: false, dailyGoalMins: 120 };
  siteCategories = result.siteCategories || {};

  // Set slider
  const mins = idleTimeoutMs / 60000;
  slider.value = mins;
  sliderValue.textContent = `${mins} min`;

  // Set display toggles
  toggleWidget.checked = displaySettings.widget;
  toggleSidePanel.checked = displaySettings.sidePanel;
  toggleNewTab.checked = displaySettings.newtab;
  toggleTabTitle.checked = displaySettings.tabTitle;
  toggleDynamicIcon.checked = displaySettings.dynamicIcon;

  // Set notification settings
  toggleNotifications.checked = notificationSettings.enabled;
  notifSlider.value = notificationSettings.intervalMins;
  notifValue.textContent = `${notificationSettings.intervalMins} min`;

  // Set goal settings
  toggleGoalEnabled.checked = goalSettings.enabled;
  goalSlider.value = goalSettings.dailyGoalMins;
  goalValue.textContent = formatGoalValue(goalSettings.dailyGoalMins);

  renderSiteList();
});

// ---- Navigation ----
const dashboardBtn = document.getElementById('dashboardBtn');
if (dashboardBtn) {
  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard.html' });
  });
}
