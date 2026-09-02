// ============================================================
// SIDE PANEL SCRIPT — Persistent timer display
// Same logic as popup.js but runs in the side panel context
// ============================================================

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

function updateDisplay() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    const { isTracking, currentSite, studyTime, todayTotal } = response;

    const globalTimeEl = document.getElementById('globalTime');
    globalTimeEl.innerText = formatTimeFull(studyTime);
    globalTimeEl.className = isTracking ? 'timer-value tracking' : 'timer-value';

    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (isTracking) {
      statusDot.className = 'status-dot active';
      statusText.innerHTML = `Tracking <span class="status-site">${shortenDomain(currentSite)}</span>`;
    } else if (currentSite) {
      statusDot.className = 'status-dot';
      statusText.innerHTML = `Paused`;
    } else {
      statusDot.className = 'status-dot';
      statusText.innerText = 'Not a study site';
    }

    document.getElementById('todayTime').innerText = formatTimeShort(todayTotal);
    document.getElementById('currentSite').innerText = shortenDomain(currentSite);
  });
}

updateDisplay();
setInterval(updateDisplay, 1000);
