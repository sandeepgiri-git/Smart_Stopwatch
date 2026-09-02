# Smart Study Stopwatch — Project Goal

> A Chrome extension that intelligently tracks the total time you invest in learning and studying through your browser. It differentiates real study time from idle browsing, gives you per-site analytics, and helps you stay focused.

---

## Core Philosophy

- **Global Total Time is King.** The user should always see their cumulative study time front-and-center in the popup.
- **Smart, Not Annoying.** The extension auto-detects study activity — no need to manually start/stop a timer.
- **Honest Tracking.** Only count time when the user is genuinely engaged (active tab + user activity). Switching tabs = instant pause.

---

## Feature 1: Instant Pause on Tab Switch

**Priority:** 🔴 Critical (Foundation)

When the user switches away from a study tab (e.g., Alt+Tab, clicks another tab, minimizes the browser), the stopwatch **instantly pauses**. No blacklists, no site blocking — just honest time tracking.

### How It Works
- Use the **Page Visibility API** (`document.visibilitychange` event) inside `content.js`.
- When `document.hidden === true`, immediately stop counting time for that tab.
- When the user returns to the tab, resume counting (if other conditions like user activity are also met).
- A `background.js` (Service Worker) coordinates across tabs to ensure only **one active tab** is counted at a time. If two study sites are open, only the focused one accumulates time.

### Technical Details
- `content.js` listens to `visibilitychange` and reports tab state to the background service worker.
- `background.js` maintains a single `activeStudyTabId` variable. Only that tab's time ticks.
- On tab switch (`chrome.tabs.onActivated`), the service worker updates which tab is active.

---

## Feature 2: Smart Educational Website Tracking

**Priority:** 🔴 Critical (Foundation)

The extension tracks time on **educational websites only**. It comes pre-loaded with popular study sites and lets the user add their own.

### Pre-Loaded Study Sites
The extension ships with a default whitelist of well-known educational platforms:

| Category | Sites |
|---|---|
| Video Courses | `udemy.com`, `coursera.org`, `edx.org`, `khanacademy.org`, `skillshare.com`, `pluralsight.com`, `linkedin.com/learning` |
| Coding | `freecodecamp.org`, `leetcode.com`, `hackerrank.com`, `codewars.com`, `codecademy.com`, `exercism.org`, `w3schools.com` |
| Documentation | `developer.mozilla.org` (MDN), `docs.python.org`, `learn.microsoft.com`, `devdocs.io`, `reactjs.org`, `nodejs.org` |
| Q&A / Reference | `stackoverflow.com`, `stackexchange.com`, `geeksforgeeks.org`, `medium.com`, `dev.to`, `github.com` |
| Video (Educational) | `youtube.com` (tracked when a video is playing) |
| AI Learning | `chatgpt.com`, `claude.ai`, `gemini.google.com`, `perplexity.ai` |

### Custom Website Management
- Users can open a **full-page options/settings page** to:
  - **Add** any custom domain (e.g., `myuniversity.edu/portal`)
  - **Remove** any site (including pre-loaded ones)
  - **Toggle** individual sites on/off without deleting them
- Stored in `chrome.storage.sync` so custom sites sync across devices.

### Activity Detection on These Sites
- **Video pages:** Track when a `<video>` element is playing AND user is active.
- **Text/reading pages (no video):** Track when the user is actively engaging:
  - Mouse movement
  - Scrolling
  - Keyboard input (typing in search, code editors, etc.)
  - Clicking
- **Idle Timeout:** If **no activity is detected for 2–3 minutes** (configurable), the timer automatically pauses for that tab. It resumes the moment any activity is detected again.

---

## Feature 3: Global Timer + Per-Website Breakdown

**Priority:** 🟡 Important

### Popup View (Quick Glance)
The popup always shows the **global total study time** prominently at the top. This is the single most important number — "How much total time have I invested in learning?"

Below the global timer, show a compact summary:
- Today's study time
- Current session time (since browser opened)
- A small "View Details →" link to open the full analytics page

### Full Analytics Page (`dashboard.html`)
A dedicated full-page view (opened via the popup) where the user can see:

- **Global total time** (still at the top)
- **Per-website breakdown table:**
  - Domain name
  - Total time spent on that domain
  - Percentage of total time
  - Last active timestamp
- **Filters:**
  - Filter by date range (Today, This Week, This Month, All Time)
  - Filter by specific website
  - Sort by most time spent, alphabetical, or most recent
- **Visual chart:** A simple bar chart or pie chart showing time distribution across top sites.

### Data Structure (Storage)
```json
{
  "studyTime": 45000,
  "dailyLogs": {
    "2026-08-31": {
      "total": 7200,
      "sites": {
        "udemy.com": 3600,
        "stackoverflow.com": 1800,
        "youtube.com": 1800
      }
    },
    "2026-08-30": { ... }
  },
  "sessions": {
    "current": {
      "startTime": 1724012345678,
      "total": 1200
    }
  }
}
```

---

## Feature 4: Daily Goals & Streaks

**Priority:** 🟡 Important

### Daily Goal
- User sets a daily study goal (e.g., "3 hours per day") from the popup or settings page.
- The popup shows a **circular progress ring** or **progress bar** indicating how much of today's goal has been completed (e.g., "1h 45m / 3h 00m — 58%").
- When the goal is hit, show a celebratory animation/notification.

### Streak Tracking
- Track how many **consecutive days** the user has met their daily goal.
- Display the current streak in the popup (e.g., "🔥 7-day streak").
- If the user misses a day, the streak resets to 0.

### Weekly Summary
- At the end of each week (or on demand), show a summary:
  - Total hours studied this week
  - Average daily study time
  - Best day / worst day
  - Streak status

---

## Feature 5: Pomodoro Mode (Optional)

**Priority:** 🟢 Nice-to-Have

An optional Pomodoro timer that integrates with the study tracker:
- **25 minutes study / 5 minutes break** (default, configurable).
- While in a Pomodoro session, study time still accumulates into the global total.
- Browser notification when it's time to take a break.
- Browser notification when break is over.
- Pomodoro count for the day (e.g., "🍅 × 4 today").

---

## Feature 6: Cloud Sync

**Priority:** 🟢 Nice-to-Have

- Use `chrome.storage.sync` instead of `chrome.storage.local` for settings and whitelist.
- For study time data (which can be large), use `chrome.storage.local` but offer an **Export to CSV** button on the dashboard.
- Future: optional Google Drive backup for full data portability.

---

## Feature 7: Display Options & Notifications

**Priority:** 🟡 Important

To allow users to keep an eye on their timer without constantly checking the popup, we offer multiple display options. These can be toggled on/off instantly.

### Supported Displays
- **Floating Widget:** A draggable, glassmorphism clock overlay injected directly into the active study webpage.
- **Side Panel:** Chrome's native docked sidebar interface showing real-time stats without obscuring the webpage.
- **Pinned Dashboard Tab:** A full-page analytics dashboard pinned to the browser that updates live.
- **Tab Title Timer:** Modifies the webpage's tab title to prepend the timer (e.g., `[01:23:45] Wikipedia`), visible from anywhere in the browser.
- **Dynamic Icon:** Uses an `OffscreenCanvas` to replace the extension's badge with a live-updating pie chart/progress ring representing tracking state and time.

### Desktop Notifications (Milestones)
Instead of continuous visual distraction, the user can opt-in to system notifications.
- The user can configure an **interval** (e.g., every 60 minutes).
- When active study time crosses that milestone, a native desktop notification pops up (e.g., "Study Milestone Reached! You've studied for 2h 0m in total.").

---

## Architecture Overview

```
SmartStopwatch/
├── manifest.json          # Extension config (MV3)
├── background.js          # Service Worker — central timekeeper
├── content.js             # Injected into pages — detects activity & videos
├── popup.html             # Quick popup — global timer, today's stats, goal progress
├── popup.js               # Popup logic
├── popup.css              # Popup styles
├── dashboard.html         # Full analytics page
├── dashboard.js           # Dashboard logic (charts, filters, per-site breakdown)
├── dashboard.css          # Dashboard styles
├── options.html           # Settings page (manage whitelist, set goals, configure idle timeout)
├── options.js             # Options logic
├── options.css            # Options styles
└── icons/                 # Extension icons (16, 48, 128px)
```

### Data Flow
```
content.js (per tab)
  ├── Detects: video playing, scroll, mouse, keyboard, visibility
  ├── Reports activity state to background.js via chrome.runtime.sendMessage
  │
background.js (Service Worker — single instance)
  ├── Receives activity reports from all content scripts
  ├── Knows which tab is focused (chrome.tabs.onActivated)
  ├── Maintains the ONE true timer
  ├── Increments studyTime only for the active, whitelisted, non-idle tab
  ├── Saves to chrome.storage every few seconds
  │
popup.js
  ├── Reads from chrome.storage to display global time, today's time, goal progress
  │
dashboard.js
  ├── Reads from chrome.storage to display full analytics, charts, per-site breakdown
```

---

## Implementation Order

| Phase | Features | Complexity |
|---|---|---|
| **Phase 1** | Tab-pause + Whitelist + Activity detection + Background service worker | High (foundation rewrite) |
| **Phase 2** | Per-site tracking + Dashboard page with breakdown & filters | Medium |
| **Phase 3** | Daily goals + Progress bar + Streaks | Medium |
| **Phase 4** | Pomodoro mode + Export + Cloud sync | Low–Medium |

---

> **This document is the single source of truth for the project's direction.** All implementation plans and code changes should align with these goals.
