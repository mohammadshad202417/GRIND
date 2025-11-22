// Grind Extension - Enhanced Background Service Worker
console.log('Grind Extension background script loaded');

// Storage utility functions (inline to avoid importScripts issues)
class StorageManager {
  constructor() {
    this.defaultSettings = {
      theme: 'dark',
      grindMode: false,
      notifications: true,
      autoStart: false,
      sound: true,
      sessionDuration: 25,
      breakDuration: 5,
      dailyGoal: 4,
      fontSize: 'medium',
      widgetPosition: 'top-right',
      sessionStartTime: null,
      totalGrindTime: 0,
      dailyGrindTime: 0,
      streak: 0,
      lastGrindDate: null
    };
  }

  async updateWebsiteTime(domain, timeSpent) {
    if (!domain) return;

    try {
      const result = await chrome.storage.local.get(['websiteStats']);
      const websiteStats = result.websiteStats || {};

      if (!websiteStats[domain]) {
        websiteStats[domain] = {
          timeSpent: 0,
          visits: 0,
          category: categorizeSite(domain),
          lastVisit: Date.now(),
          firstVisit: Date.now()
        };
        console.log(`Created new website entry for ${domain}`);
      }

      const oldTime = websiteStats[domain].timeSpent;
      websiteStats[domain].timeSpent += timeSpent;
      websiteStats[domain].lastVisit = Date.now();

      await chrome.storage.local.set({ websiteStats: websiteStats });

      console.log(`Updated time for ${domain}: ${Math.round(oldTime / 1000)}s -> ${Math.round(websiteStats[domain].timeSpent / 1000)}s (+${Math.round(timeSpent / 1000)}s)`);
    } catch (error) {
      console.error('Error updating website time:', error);
    }
  }

  async updateDailyTime(domain, timeSpent) {
    if (!domain) return;

    try {
      const result = await chrome.storage.local.get(['dailyTimeUsage']);
      const dailyTimeUsage = result.dailyTimeUsage || {};

      if (!dailyTimeUsage[domain]) {
        dailyTimeUsage[domain] = {
          timeToday: 0,
          lastReset: Date.now(),
          limitExceeded: false
        };
        console.log(`Created new daily time entry for ${domain}`);
      }

      const oldTime = dailyTimeUsage[domain].timeToday;
      dailyTimeUsage[domain].timeToday += timeSpent;

      await chrome.storage.local.set({ dailyTimeUsage: dailyTimeUsage });

      console.log(`Updated daily time for ${domain}: ${Math.round(oldTime / 1000)}s -> ${Math.round(dailyTimeUsage[domain].timeToday / 1000)}s (+${Math.round(timeSpent / 1000)}s)`);
    } catch (error) {
      console.error('Error updating daily time:', error);
    }
  }

  async getDailyTimeUsage() {
    try {
      const result = await chrome.storage.local.get(['dailyTimeUsage']);
      return result.dailyTimeUsage || {};
    } catch (error) {
      console.error('Error getting daily time usage:', error);
      return {};
    }
  }

  async getTimeLimits() {
    try {
      const result = await chrome.storage.local.get(['timeLimits']);
      return result.timeLimits || {};
    } catch (error) {
      console.error('Error getting time limits:', error);
      return {};
    }
  }

  async setTimeLimit(domain, limitInSeconds) {
    try {
      const result = await chrome.storage.local.get(['timeLimits']);
      const timeLimits = result.timeLimits || {};

      timeLimits[domain] = limitInSeconds;
      await chrome.storage.local.set({ timeLimits: timeLimits });

      console.log(`Set time limit for ${domain}: ${limitInSeconds}s (${Math.round(limitInSeconds / 60)}m)`);
    } catch (error) {
      console.error('Error setting time limit:', error);
    }
  }

  async resetDailyTimeUsage() {
    try {
      const result = await chrome.storage.local.get(['dailyTimeUsage', 'focusBonusEligible']);
      const dailyTimeUsage = result.dailyTimeUsage || {};
      const focusBonusEligible = result.focusBonusEligible !== false;

      // Reset all daily time counters
      Object.keys(dailyTimeUsage).forEach(domain => {
        dailyTimeUsage[domain].timeToday = 0;
        dailyTimeUsage[domain].lastReset = Date.now();
        dailyTimeUsage[domain].limitExceeded = false;
      });

      await chrome.storage.local.set({
        dailyTimeUsage: dailyTimeUsage,
        lastMidnightCheck: Date.now(),
        focusBonusEligible: true
      });

      console.log('Daily time usage reset at midnight');

      // Award Focus Bonus if eligible
      if (focusBonusEligible) {
        await this.awardFocusBonus();
      }
    } catch (error) {
      console.error('Error resetting daily time usage:', error);
    }
  }

  async awardFocusBonus() {
    try {
      const result = await chrome.storage.local.get(['userStats']);
      const userStats = result.userStats || { xp: 0, level: 1, streak: 0, totalXP: 0 };

      userStats.xp += 50;
      userStats.totalXP += 50;

      // Check for level up
      const newLevel = Math.floor(userStats.totalXP / 100) + 1;
      if (newLevel > userStats.level) {
        userStats.level = newLevel;
      }

      await chrome.storage.local.set({ userStats: userStats });

      // Show notification
      try {
        chrome.notifications.create({
          type: 'basic',
          title: 'Focus Bonus Earned!',
          message: '🎯 +50 XP: You stayed within all time limits today!',
          iconUrl: chrome.runtime.getURL('assets/icon48.svg')
        });
      } catch (notifError) {
        console.log('Focus bonus notification failed, continuing without it:', notifError);
      }

      console.log('Awarded Focus Bonus: +50 XP');
    } catch (error) {
      console.error('Error awarding Focus Bonus:', error);
    }
  }

  async checkMidnightReset() {
    try {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);

      const result = await chrome.storage.local.get(['lastMidnightCheck']);
      const lastCheck = result.lastMidnightCheck || 0;

      // Check if we've crossed midnight
      if (now.getTime() - lastCheck > 24 * 60 * 60 * 1000 ||
        (now.getTime() >= midnight.getTime() && lastCheck < midnight.getTime())) {

        console.log('Midnight detected, resetting daily time usage');
        await this.resetDailyTimeUsage();
      }
    } catch (error) {
      console.error('Error checking midnight reset:', error);
    }
  }

  async updateSessionData(domain, timeSpent, domainChanged = false, tabSwitched = false) {
    try {
      const result = await chrome.storage.local.get(['sessionData']);
      const sessionData = result.sessionData || {
        startTime: Date.now(),
        totalTime: 0,
        currentDomain: null,
        domainHistory: [],
        tabsOpened: 0,
        tabSwitches: 0
      };

      // Ensure domainHistory is always an array
      if (!Array.isArray(sessionData.domainHistory)) {
        sessionData.domainHistory = [];
      }

      // Ensure other required properties exist
      if (typeof sessionData.tabsOpened !== 'number') {
        sessionData.tabsOpened = 0;
      }
      if (typeof sessionData.tabSwitches !== 'number') {
        sessionData.tabSwitches = 0;
      }
      if (typeof sessionData.totalTime !== 'number') {
        sessionData.totalTime = 0;
      }

      sessionData.totalTime += timeSpent;

      // Always increment tab switches when switching tabs
      if (tabSwitched) {
        sessionData.tabSwitches += 1;
      }

      if (domainChanged) {
        if (sessionData.currentDomain && sessionData.currentDomain !== domain) {
          sessionData.domainHistory.push({
            domain: sessionData.currentDomain,
            startTime: sessionData.lastDomainStartTime || Date.now(),
            endTime: Date.now()
          });
        }

        sessionData.currentDomain = domain;
        sessionData.lastDomainStartTime = Date.now();
      }

      await chrome.storage.local.set({ sessionData: sessionData });
    } catch (error) {
      console.error('Error updating session data:', error);
    }
  }

  async incrementTabCount() {
    try {
      const result = await chrome.storage.local.get(['sessionData']);
      const sessionData = result.sessionData || {
        startTime: Date.now(),
        totalTime: 0,
        currentDomain: null,
        domainHistory: [],
        tabsOpened: 0,
        tabSwitches: 0
      };

      // Ensure tabsOpened is always a number
      if (typeof sessionData.tabsOpened !== 'number') {
        sessionData.tabsOpened = 0;
      }

      sessionData.tabsOpened += 1;
      await chrome.storage.local.set({ sessionData: sessionData });
    } catch (error) {
      console.error('Error incrementing tab count:', error);
    }
  }

  async incrementWebsiteVisits(domain) {
    if (!domain) return;

    try {
      const result = await chrome.storage.local.get(['websiteStats']);
      const websiteStats = result.websiteStats || {};

      if (!websiteStats[domain]) {
        websiteStats[domain] = {
          timeSpent: 0,
          visits: 0,
          category: categorizeSite(domain),
          lastVisit: Date.now(),
          firstVisit: Date.now()
        };
        console.log(`Created new website entry for ${domain} (visits)`);
      }

      const oldVisits = websiteStats[domain].visits;
      websiteStats[domain].visits += 1;
      websiteStats[domain].lastVisit = Date.now();

      await chrome.storage.local.set({ websiteStats: websiteStats });

      console.log(`✅ Incremented visits for ${domain}: ${oldVisits} -> ${websiteStats[domain].visits}`);
    } catch (error) {
      console.error('Error incrementing website visits:', error);
    }
  }

  async getWebsiteStats() {
    try {
      const result = await chrome.storage.local.get(['websiteStats']);
      return result.websiteStats || {};
    } catch (error) {
      console.error('Error getting website stats:', error);
      return {};
    }
  }

  async getSessionData() {
    try {
      const result = await chrome.storage.local.get(['sessionData']);
      const sessionData = result.sessionData || {
        startTime: Date.now(),
        totalTime: 0,
        currentDomain: null,
        domainHistory: [],
        tabsOpened: 0,
        tabSwitches: 0
      };

      // Ensure all required properties exist and are of correct type
      if (!Array.isArray(sessionData.domainHistory)) {
        sessionData.domainHistory = [];
      }
      if (typeof sessionData.tabsOpened !== 'number') {
        sessionData.tabsOpened = 0;
      }
      if (typeof sessionData.tabSwitches !== 'number') {
        sessionData.tabSwitches = 0;
      }
      if (typeof sessionData.totalTime !== 'number') {
        sessionData.totalTime = 0;
      }
      if (typeof sessionData.startTime !== 'number') {
        sessionData.startTime = Date.now();
      }

      return sessionData;
    } catch (error) {
      console.error('Error getting session data:', error);
      return {
        startTime: Date.now(),
        totalTime: 0,
        currentDomain: null,
        domainHistory: [],
        tabsOpened: 0,
        tabSwitches: 0
      };
    }
  }

  async resetSessionData() {
    try {
      await chrome.storage.local.set({
        sessionData: {
          startTime: Date.now(),
          totalTime: 0,
          currentDomain: null,
          domainHistory: [],
          tabsOpened: 0,
          tabSwitches: 0
        }
      });
    } catch (error) {
      console.error('Error resetting session data:', error);
    }
  }
}

// Initialize storage manager
const storageManager = new StorageManager();

// Global state for tracking
let activeTabId = null;
let activeDomain = null;
let trackingInterval = null;
let lastUpdateTime = Date.now();
let tabData = new Map(); // Store tab data temporarily

// Initialize tracking immediately when service worker loads
(async () => {
  try {
    console.log('Service worker loaded - initializing tracking');
    // Small delay to ensure Chrome APIs are ready
    await new Promise(resolve => setTimeout(resolve, 100));
    await initializeTracking();
  } catch (error) {
    console.error('Error during service worker initialization:', error);
  }
})();

// Extension installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Grind Extension installed/updated:', details.reason);

  try {
    // Initialize default settings
    await chrome.storage.sync.set({
      theme: 'dark',
      grindMode: false,
      notifications: true,
      blockedSites: [],
      incognitoAllowed: false,
      trackingEnabled: true,
      blockingEnabled: true,
      blockingLevel: 'strict'
    });

    // Initialize tracking data (don't overwrite existing data)
    const existingData = await chrome.storage.local.get(['sessionData']);
    if (!existingData.sessionData) {
      await chrome.storage.local.set({
        websiteStats: {},
        sessionData: {
          startTime: Date.now(),
          totalTime: 0,
          currentDomain: null,
          domainHistory: [],
          tabsOpened: 0,
          tabSwitches: 0
        }
      });
    }

    // Initialize tracking if this is an install (not update)
    if (details.reason === 'install') {
      // Wait for Chrome APIs to be available
      setTimeout(async () => {
        try {
          await initializeTracking();
        } catch (error) {
          console.error('Error during delayed initialization:', error);
        }
      }, 1000);
    }
  } catch (error) {
    console.error('Error during installation:', error);
  }
});

// Initialize tracking when extension starts
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup - initializing tracking');
  try {
    // Wait for Chrome APIs to be available
    setTimeout(async () => {
      try {
        await initializeTracking();
      } catch (error) {
        console.error('Error during startup initialization:', error);
      }
    }, 1000);
  } catch (error) {
    console.error('Error during startup initialization:', error);
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
});

// Initialize tracking system
async function initializeTracking() {
  try {
    // Wait a bit to ensure extension is fully loaded
    await new Promise(resolve => setTimeout(resolve, 500));

    // Initialize default time limits if not set
    await initializeDefaultTimeLimits();

    // Check if chrome.tabs API is available
    if (!chrome.tabs || !chrome.tabs.query) {
      console.log('Chrome tabs API not available yet, skipping initialization');
      return;
    }

    // Get current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];

      // Validate tab URL before extracting domain
      if (!tab.url || typeof tab.url !== 'string') {
        console.log('Invalid tab URL, skipping initialization');
        return;
      }

      const domain = extractDomain(tab.url);

      // Set initial tracking state
      activeTabId = tab.id;
      activeDomain = domain;
      lastUpdateTime = Date.now();

      // Remove initial visit counting when extension loads
      // Visits will only be counted on actual user interactions (tab switches)

      // Update session data
      await storageManager.updateSessionData(domain, 0, true, false);

      // Check for blocking immediately on initialization
      await checkAndBlockSite(tab.id, domain);

      console.log(`Initial tab: ${domain} (${tab.id}) - no visit counted`);
    }

    // Start tracking interval
    startTrackingInterval();

    // Start midnight reset checker
    startMidnightResetChecker();

    console.log('Tracking system initialized');
  } catch (error) {
    console.error('Error initializing tracking:', error);
    // Don't throw the error, just log it to prevent service worker crashes
  }
}

// Initialize default time limits
async function initializeDefaultTimeLimits() {
  try {
    const result = await chrome.storage.local.get(['timeLimits']);
    if (!result.timeLimits || Object.keys(result.timeLimits).length === 0) {
      const defaultLimits = {
        'youtube.com': 7200,    // 2 hours
        'instagram.com': 3600,   // 1 hour
        'facebook.com': 1800,   // 30 minutes
        'twitter.com': 1800,     // 30 minutes
        'tiktok.com': 1800,     // 30 minutes
        'reddit.com': 3600,     // 1 hour
        'netflix.com': 7200,    // 2 hours
        'twitch.tv': 3600       // 1 hour
      };

      await chrome.storage.local.set({ timeLimits: defaultLimits });
      console.log('Initialized default time limits');
    }
  } catch (error) {
    console.error('Error initializing default time limits:', error);
  }
}

// Start midnight reset checker
function startMidnightResetChecker() {
  // Check for midnight reset every minute
  setInterval(async () => {
    await storageManager.checkMidnightReset();
  }, 60000); // Check every minute

  console.log('Midnight reset checker started');
}

// Check time limits and handle notifications/blocking
async function checkTimeLimits(domain, tabId) {
  try {
    // Check if tab still exists before trying to send messages
    // console.log(`Checking time limits for tab ${tabId} (${typeof tabId})`);
    if (!(await tabExists(tabId))) {
      console.log(`Tab ${tabId} no longer exists, skipping time limit check`);
      return;
    }

    const [timeLimits, dailyUsage] = await Promise.all([
      storageManager.getTimeLimits(),
      storageManager.getDailyTimeUsage()
    ]);

    const limit = timeLimits[domain];
    if (!limit) return; // No limit set for this domain

    const usage = dailyUsage[domain];
    if (!usage) return; // No usage data yet

    const timeTodayMs = usage.timeToday;
    const limitMs = limit * 1000;
    const percentage = (timeTodayMs / limitMs) * 100;

    // Send progress bar update to content script
    try {
      await chrome.tabs.sendMessage(parseInt(tabId), {
        action: 'updateTimeBar',
        percentage: Math.min(percentage, 100),
        timeToday: timeTodayMs,
        limit: limitMs
      });
    } catch (error) {
      // Content script may not be loaded yet or tab may not exist
      if (error.message.includes('No tab with id')) {
        console.log(`Tab ${tabId} no longer exists, skipping progress update`);
      }
    }

    // Check for notifications and auto-blocking
    if (percentage >= 100 && !usage.limitExceeded) {
      // Time limit exceeded - auto-block
      console.log(`⏱ Time limit exceeded for ${domain}: ${Math.round(timeTodayMs / 1000)}s / ${limit}s`);

      // Mark as exceeded
      usage.limitExceeded = true;
      await chrome.storage.local.set({ dailyTimeUsage: dailyUsage });

      // Add to blocked sites
      await addBlockedSite(domain);

      // Show notification
      try {
        chrome.notifications.create({
          type: 'basic',
          title: 'Time Limit Reached!',
          message: `⏱ Time's up! You've reached your daily limit for ${domain}`,
          iconUrl: chrome.runtime.getURL('assets/icon48.svg')
        });
      } catch (notifError) {
        console.log('Notification failed, continuing without it:', notifError);
      }

      // Mark focus bonus as ineligible
      await chrome.storage.local.set({ focusBonusEligible: false });

    } else if (percentage >= 90 && percentage < 100) {
      // Warning at 90%
      const remainingMinutes = Math.ceil((limitMs - timeTodayMs) / 60000);
      console.log(`⚠️ 10% time remaining for ${domain}: ${remainingMinutes} minutes left`);

      // Show warning notification (only once per session)
      if (!usage.warningShown) {
        try {
          chrome.notifications.create({
            type: 'basic',
            title: 'Time Warning',
            message: `⚠️ ${remainingMinutes} minutes remaining for ${domain}`,
            iconUrl: chrome.runtime.getURL('assets/icon48.svg')
          });
        } catch (notifError) {
          console.log('Warning notification failed, continuing without it:', notifError);
        }

        usage.warningShown = true;
        await chrome.storage.local.set({ dailyTimeUsage: dailyUsage });
      }
    }
  } catch (error) {
    console.error('Error checking time limits:', error);
  }
}

// Start the tracking interval
function startTrackingInterval() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }

  trackingInterval = setInterval(async () => {
    await updateActiveTabTime();
  }, 5000); // Update every 5 seconds for more responsive blocking

  // Also check all tabs for blocking every 30 seconds
  setInterval(async () => {
    await checkAllTabsForBlocking();
  }, 30000);

  console.log('Tracking interval started');
}

// Update time for active tab
async function updateActiveTabTime() {
  if (!activeTabId || !activeDomain) {
    console.log('No active tab or domain to track');
    return;
  }

  try {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastUpdateTime;

    // Validate time difference - only count time between 1 second and 5 minutes
    if (timeDiff >= 1000 && timeDiff <= 300000) {
      // Update website stats
      await storageManager.updateWebsiteTime(activeDomain, timeDiff);

      // Update daily time usage
      await storageManager.updateDailyTime(activeDomain, timeDiff);

      // Update session data
      await storageManager.updateSessionData(activeDomain, timeDiff, false, false);

      console.log(`✅ Time updated for ${activeDomain}: +${Math.round(timeDiff / 1000)}s`);

      // Check time limits and send progress updates
      await checkTimeLimits(activeDomain, activeTabId);
    } else if (timeDiff > 300000) {
      console.log(`⚠️ Skipping large time jump: ${Math.round(timeDiff / 1000)}s (likely browser sleep/wake)`);
    }

    // Update lastUpdateTime after processing
    lastUpdateTime = currentTime;

    // Check for blocking
    await checkAndBlockSite(activeTabId, activeDomain);
  } catch (error) {
    console.error('Error updating active tab time:', error);
  }
}

// Handle tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await handleTabActivated(activeInfo);
  } catch (error) {
    console.error('Error handling tab activation:', error);
    // Reset tracking state if there's an error
    if (error.message.includes('No tab with id')) {
      console.log('Resetting tracking state due to tab activation error');
      activeTabId = null;
      activeDomain = null;
    }
  }
});

// Handle tab creation (new tabs opened)
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    await storageManager.incrementTabCount();
    console.log('New tab created:', tab.id);
  } catch (error) {
    console.error('Error handling tab creation:', error);
  }
});

async function handleTabActivated(activeInfo) {
  try {
    // Save previous tab time
    if (activeTabId && activeDomain) {
      await updateActiveTabTime();
    }

    // Get new active tab with error handling for non-existent tabs
    let tab;
    try {
      if (!Number.isInteger(activeInfo.tabId)) {
        console.log('Invalid tab ID in activeInfo:', activeInfo.tabId);
        return;
      }
      tab = await chrome.tabs.get(activeInfo.tabId);
    } catch (error) {
      if (error.message.includes('No tab with id') || error.message.includes('No matching signature')) {
        console.log(`Tab ${activeInfo.tabId} issue: ${error.message}`);
        return;
      }
      throw error; // Re-throw if it's a different error
    }

    const previousTabId = activeTabId;
    activeTabId = tab.id;

    // Validate tab URL before extracting domain
    if (!tab.url || typeof tab.url !== 'string') {
      console.log('Invalid tab URL, skipping domain extraction');
      activeDomain = null;
      return;
    }

    // Extract domain from URL
    const domain = extractDomain(tab.url);

    // Determine if domain changed
    const domainChanged = domain && domain !== activeDomain;

    // Always increment tab switches when switching tabs (except on initial load)
    const tabSwitched = previousTabId !== null && previousTabId !== activeTabId;

    // Only increment visits if domain actually changed
    if (domainChanged) {
      await storageManager.incrementWebsiteVisits(domain);
    }

    activeDomain = domain;
    lastUpdateTime = Date.now();

    // Update session data with both domain change and tab switch flags
    await storageManager.updateSessionData(domain, 0, domainChanged, tabSwitched);

    // Check for blocking
    await checkAndBlockSite(activeTabId, domain);

    console.log(`Tab activated: ${domain} (${tab.id}) - Switch: ${tabSwitched}, Domain changed: ${domainChanged}`);
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
}

// Handle tab removal (closing tabs)
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    // If the closed tab was active, clear tracking
    if (tabId === activeTabId) {
      await updateActiveTabTime();
      activeTabId = null;
      activeDomain = null;

      // Update session data
      await storageManager.updateSessionData(null, 0, true, false);

      console.log('Active tab closed, clearing tracking');
    }
  } catch (error) {
    console.error('Error handling tab removal:', error);
  }
});

// Handle tab updates (URL changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Validate tab URL before extracting domain
      if (!tab.url || typeof tab.url !== 'string') {
        console.log('Invalid tab URL in update, skipping');
        return;
      }

      const domain = extractDomain(tab.url);

      // If this is the active tab and domain changed
      if (tabId === activeTabId) {
        if (domain !== activeDomain) {
          // Save time for previous domain
          await updateActiveTabTime();

          // Update to new domain
          activeDomain = domain;
          lastUpdateTime = Date.now();

          // Remove visit counting from tab update - only count on tab activation
          // Visit counting is now handled in handleTabActivated function

          // Update session data
          await storageManager.updateSessionData(domain, 0, true, false);

          console.log(`Tab URL changed: ${activeDomain} (${tabId})`);
        }
      }

      // Check for blocking on any tab update
      await checkAndBlockSite(tabId, domain);

    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }
});

// Utility function to check if a tab exists
async function tabExists(tabId) {
  try {
    if (tabId === null || tabId === undefined) return false;
    const id = Math.floor(Number(tabId));
    if (isNaN(id) || !Number.isInteger(id) || id < 0) return false;

    await chrome.tabs.get(id);
    return true;
  } catch (error) {
    // Ignore errors about non-existent tabs or other issues
    return false;
  }
}

// Extract domain from URL
function extractDomain(url) {
  try {
    // Check if url is valid and not empty
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return null;
    }

    // Skip restricted pages
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
      url.startsWith('moz-extension://') || url.startsWith('edge://') ||
      url.startsWith('about:') || url.startsWith('data:') ||
      url.startsWith('file://') || url.startsWith('javascript:')) {
      return null;
    }

    // Check if URL has a valid protocol
    if (!url.includes('://')) {
      // Try to add http:// if no protocol is specified
      url = 'http://' + url;
    }

    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Error extracting domain from URL:', url, error);
    return null;
  }
}

// Categorize website based on domain patterns
function categorizeSite(domain) {
  // Productive sites
  const productiveDomains = [
    'github.com', 'stackoverflow.com', 'developer.mozilla.org',
    'docs.microsoft.com', 'aws.amazon.com', 'cloud.google.com',
    'docs.google.com', 'notion.so', 'trello.com', 'asana.com',
    'coursera.org', 'udemy.com', 'khanacademy.org', 'edx.org',
    'linkedin.com', 'medium.com', 'dev.to', 'hashnode.com'
  ];

  // Unproductive/distracting sites  
  const unproductiveDomains = [
    'facebook.com', 'twitter.com', 'instagram.com',
    'tiktok.com', 'reddit.com', 'youtube.com', 'netflix.com',
    'twitch.tv', 'discord.com', 'snapchat.com', 'pinterest.com',
    '9gag.com', 'buzzfeed.com', 'imgur.com', 'vine.co'
  ];

  // Check productive
  if (productiveDomains.some(site => domain.includes(site))) {
    return 'productive';
  }

  // Check unproductive
  if (unproductiveDomains.some(site => domain.includes(site))) {
    return 'unproductive';
  }

  // Default to neutral
  return 'neutral';
}

// Check if site should be blocked and notify content script
async function checkAndBlockSite(tabId, domain) {
  if (!domain) return;

  // Check if tab still exists before trying to send messages
  if (!(await tabExists(tabId))) {
    console.log(`Tab ${tabId} no longer exists, skipping blocking check`);
    return;
  }

  try {
    const settings = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites', 'blockingLevel']);

    if (!settings.blockingEnabled) return;

    const blockedSites = settings.blockedSites || [];
    const isBlocked = blockedSites.some(site => {
      // Support both exact matches and wildcard patterns
      if (site.includes('*')) {
        const pattern = site.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(domain);
      }
      return domain === site || domain.endsWith('.' + site);
    });

    if (isBlocked) {
      console.log(`🚫 Site ${domain} is blocked, notifying content script`);
      console.log(`Blocked sites:`, blockedSites);
      console.log(`Blocking level:`, settings.blockingLevel || 'strict');

      // Send blocking message to existing content script
      // Content script will handle the overlay display
      try {
        await chrome.tabs.sendMessage(parseInt(tabId), {
          action: 'showBlockingOverlay',
          domain: domain,
          reason: 'Site is blocked',
          blockingLevel: settings.blockingLevel || 'strict'
        });
        console.log(`✅ Blocking message sent to tab ${tabId} for domain ${domain}`);
      } catch (error) {
        if (error.message.includes('No tab with id')) {
          console.log(`Tab ${tabId} no longer exists, skipping blocking message`);
        } else {
          console.log(`❌ Could not send blocking message to tab ${tabId}:`, error.message);
          // Content script may not be loaded yet, it will check on page load
        }
      }
    } else {
      // Send message to hide blocking overlay if it exists
      try {
        await chrome.tabs.sendMessage(parseInt(tabId), {
          action: 'hideBlockingOverlay'
        });
      } catch (error) {
        if (error.message.includes('No tab with id')) {
          console.log(`Tab ${tabId} no longer exists, skipping hide overlay message`);
        }
        // Ignore other errors when trying to hide overlay
      }
    }
  } catch (error) {
    console.error('Error checking site blocking:', error);
  }
}

// Handle messages from content scripts, popup, and options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);

  switch (request.action) {
    case 'getTabInfo':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          // Validate tab URL before extracting domain
          const tabUrl = tabs[0].url;
          const domain = (tabUrl && typeof tabUrl === 'string') ? extractDomain(tabUrl) : null;

          sendResponse({
            url: tabUrl || '',
            title: tabs[0].title || '',
            domain: domain
          });
        } else {
          sendResponse({
            url: '',
            title: 'No active tab',
            domain: null
          });
        }
      });
      return true; // Keep message channel open for async response

    case 'getWebsiteStats':
      storageManager.getWebsiteStats().then(stats => {
        console.log('Sending website stats:', stats);
        sendResponse(stats);
      }).catch(error => {
        console.error('Error getting website stats:', error);
        sendResponse({});
      });
      return true;

    case 'getSessionData':
      storageManager.getSessionData().then(data => {
        sendResponse(data);
      }).catch(error => {
        console.error('Error getting session data:', error);
        sendResponse({
          startTime: Date.now(),
          totalTime: 0,
          currentDomain: null,
          domainHistory: []
        });
      });
      return true;

    case 'updateBadge':
      chrome.action.setBadgeText({
        text: request.text,
        tabId: sender.tab?.id
      });
      break;

    case 'setTheme':
      chrome.storage.sync.set({ theme: request.theme });
      break;

    case 'resetSessionData':
      storageManager.resetSessionData().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error resetting session data:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'addBlockedSite':
      addBlockedSite(request.domain).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error adding blocked site:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'testBlocking':
      // Test function to debug blocking
      const testDomain = request.domain || 'example.com';
      console.log(`🧪 Testing blocking for domain: ${testDomain}`);

      // Get current settings
      chrome.storage.sync.get(['blockingEnabled', 'blockedSites', 'blockingLevel'], (settings) => {
        console.log('Current blocking settings:', settings);

        // Test if domain would be blocked
        const blockedSites = settings.blockedSites || [];
        const isBlocked = blockedSites.some(site => {
          if (site.includes('*')) {
            const pattern = site.replace(/\*/g, '.*');
            return new RegExp(`^${pattern}$`).test(testDomain);
          }
          return testDomain === site || testDomain.endsWith('.' + site);
        });

        console.log(`Domain ${testDomain} would be blocked:`, isBlocked);
        sendResponse({
          success: true,
          domain: testDomain,
          isBlocked: isBlocked,
          settings: settings,
          blockedSites: blockedSites
        });
      });
      return true;

    case 'removeBlockedSite':
      removeBlockedSite(request.domain).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error removing blocked site:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'getBlockedSites':
      chrome.storage.sync.get(['blockedSites']).then(result => {
        sendResponse(result.blockedSites || []);
      }).catch(error => {
        console.error('Error getting blocked sites:', error);
        sendResponse([]);
      });
      return true;

    case 'startFocusSession':
      startFocusSession(request.isResume).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error starting focus session:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'pauseFocusSession':
      pauseFocusSession().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error pausing focus session:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'endFocusSession':
      endFocusSession().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error ending focus session:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'checkAllTabsForBlocking':
      checkAllTabsForBlocking().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error checking all tabs for blocking:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'setTimeLimit':
      storageManager.setTimeLimit(request.domain, request.limitInSeconds).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error setting time limit:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'getTimeLimit':
      storageManager.getTimeLimits().then(limits => {
        sendResponse({ limit: limits[request.domain] || null });
      }).catch(error => {
        console.error('Error getting time limit:', error);
        sendResponse({ limit: null });
      });
      return true;

    case 'getTimeLimits':
      storageManager.getTimeLimits().then(limits => {
        sendResponse(limits);
      }).catch(error => {
        console.error('Error getting time limits:', error);
        sendResponse({});
      });
      return true;

    case 'getDailyUsage':
      storageManager.getDailyTimeUsage().then(usage => {
        if (request.domain) {
          sendResponse({ usage: usage[request.domain] || null });
        } else {
          sendResponse(usage);
        }
      }).catch(error => {
        console.error('Error getting daily usage:', error);
        sendResponse(request.domain ? { usage: null } : {});
      });
      return true;

    case 'bypassTimeLimit':
      handleTimeLimitBypass(request.domain).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        console.error('Error handling time limit bypass:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true;

    default:
      console.log('Unknown action:', request.action);
  }
});

// Add site to blocked list
async function addBlockedSite(domain) {
  try {
    const result = await chrome.storage.sync.get(['blockedSites']);
    const blockedSites = result.blockedSites || [];

    if (!blockedSites.includes(domain)) {
      blockedSites.push(domain);
      await chrome.storage.sync.set({ blockedSites: blockedSites });
      console.log(`Added blocked site: ${domain}`);

      // Immediately check if current active tab should be blocked
      if (activeTabId && activeDomain === domain) {
        console.log(`Immediately checking blocking for newly added site: ${domain}`);
        await checkAndBlockSite(activeTabId, domain);
      }
    }
  } catch (error) {
    console.error('Error adding blocked site:', error);
  }
}

// Remove site from blocked list
async function removeBlockedSite(domain) {
  try {
    const result = await chrome.storage.sync.get(['blockedSites']);
    const blockedSites = result.blockedSites || [];

    const index = blockedSites.indexOf(domain);
    if (index > -1) {
      blockedSites.splice(index, 1);
      await chrome.storage.sync.set({ blockedSites: blockedSites });
      console.log(`Removed blocked site: ${domain}`);

      // Immediately check if current active tab should be unblocked
      if (activeTabId && activeDomain === domain) {
        console.log(`Immediately checking unblocking for removed site: ${domain}`);
        await checkAndBlockSite(activeTabId, domain);
      }
    }
  } catch (error) {
    console.error('Error removing blocked site:', error);
  }
}

// Check all open tabs for blocking
async function checkAllTabsForBlocking() {
  try {
    const tabs = await chrome.tabs.query({});
    console.log(`Checking ${tabs.length} tabs for blocking`);

    for (const tab of tabs) {
      try {
        if (tab.url && typeof tab.url === 'string') {
          const domain = extractDomain(tab.url);
          if (domain) {
            await checkAndBlockSite(tab.id, domain);
          }
        }
      } catch (error) {
        if (error.message.includes('No tab with id')) {
          console.log(`Tab ${tab.id} no longer exists, skipping blocking check`);
        } else {
          console.error(`Error checking tab ${tab.id} for blocking:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error checking all tabs for blocking:', error);
  }
}

// Handle time limit bypass with XP penalty
async function handleTimeLimitBypass(domain) {
  try {
    console.log(`⏱ Time limit bypassed for ${domain} - deducting 10 XP`);

    // Deduct XP
    const result = await chrome.storage.local.get(['userStats']);
    const userStats = result.userStats || { xp: 0, level: 1, streak: 0, totalXP: 0 };

    userStats.xp = Math.max(0, userStats.xp - 10); // Don't go below 0

    await chrome.storage.local.set({ userStats: userStats });

    // Show notification
    try {
      chrome.notifications.create({
        type: 'basic',
        title: 'Time Limit Bypassed',
        message: `⚠️ -10 XP: Time limit bypass for ${domain}`,
        iconUrl: chrome.runtime.getURL('assets/icon48.svg')
      });
    } catch (notifError) {
      console.log('Bypass notification failed, continuing without it:', notifError);
    }

    // Temporarily unblock for 5 minutes
    await removeBlockedSite(domain);

    // Re-block after 5 minutes
    setTimeout(async () => {
      await addBlockedSite(domain);
      console.log(`Re-blocked ${domain} after 5-minute bypass`);
    }, 5 * 60 * 1000);

    console.log(`Time limit bypass handled for ${domain}: -10 XP, 5min unblock`);
  } catch (error) {
    console.error('Error handling time limit bypass:', error);
  }
}

// Handle window focus/blur for better tracking
// Note: chrome.windows.onFocusChanged is not available in service workers
// This functionality is disabled for Manifest V3 compatibility

// Focus session management
async function startFocusSession(isResume = false) {
  try {
    // If resuming, just update badge and return
    if (isResume) {
      chrome.action.setBadgeText({ text: 'FOCUS' });
      console.log('Focus session resumed');
      return;
    }

    const settings = await chrome.storage.sync.get(['focusSessionDuration']);
    const duration = settings.focusSessionDuration || 25; // Default 25 minutes

    await chrome.storage.local.set({
      focusSession: {
        active: true,
        startTime: Date.now(),
        duration: duration * 60 * 1000, // Convert to milliseconds
        endTime: Date.now() + (duration * 60 * 1000)
      }
    });

    // Update badge to show focus session
    chrome.action.setBadgeText({ text: 'FOCUS' });
    // Note: setBadgeBackgroundColor is not available in service workers

    console.log(`Focus session started for ${duration} minutes`);
  } catch (error) {
    console.error('Error starting focus session:', error);
  }
}

async function pauseFocusSession() {
  try {
    const result = await chrome.storage.local.get(['focusSession']);
    const focusSession = result.focusSession;

    if (focusSession && focusSession.active) {
      const timeLeft = focusSession.endTime - Date.now();

      await chrome.storage.local.set({
        focusSession: {
          ...focusSession,
          active: false,
          pausedTime: timeLeft
        }
      });

      // Clear badge
      chrome.action.setBadgeText({ text: 'PAUSED' });

      console.log('Focus session paused');
    }
  } catch (error) {
    console.error('Error pausing focus session:', error);
  }
}

async function endFocusSession() {
  try {
    await chrome.storage.local.remove(['focusSession']);

    // Clear badge
    chrome.action.setBadgeText({ text: '' });

    // Generate galaxy star for completed session
    await generateGalaxyStar();

    console.log('Focus session ended');
  } catch (error) {
    console.error('Error ending focus session:', error);
  }
}

// Generate a star in the galaxy for completed focus session
async function generateGalaxyStar() {
  try {
    const result = await chrome.storage.local.get(['galaxyData']);
    const galaxyData = result.galaxyData || { stars: [], firstSessionDate: null };

    // Calculate session duration (default 25 minutes if not available)
    const sessionDuration = 25; // Default focus session duration
    const sessionQuality = 'good'; // Default quality

    const star = {
      id: Date.now(),
      x: 150 + (Math.random() - 0.5) * 200,
      y: 100 + (Math.random() - 0.5) * 150,
      radius: Math.max(2, Math.min(8, Math.floor(sessionDuration / 5))),
      color: getStarColor(sessionQuality),
      brightness: Math.random() * 0.5 + 0.5,
      orbitRadius: Math.floor(Math.random() * 80) + 20,
      orbitSpeed: Math.random() * 0.02 + 0.01,
      orbitAngle: Math.random() * Math.PI * 2,
      createdAt: Date.now()
    };

    galaxyData.stars.push(star);

    // Set first session date if this is the first star
    if (!galaxyData.firstSessionDate) {
      galaxyData.firstSessionDate = Date.now();
    }

    await chrome.storage.local.set({ galaxyData });
    console.log('Galaxy star generated for completed focus session');
  } catch (error) {
    console.error('Error generating galaxy star:', error);
  }
}

function getStarColor(quality) {
  const colors = {
    'excellent': '#00ffff', // Cyan
    'good': '#00ff00',      // Green
    'fair': '#ffff00',      // Yellow
    'poor': '#ff6600'       // Orange
  };
  return colors[quality] || colors['good'];
}

// Clean up on extension shutdown
chrome.runtime.onSuspend.addListener(async () => {
  if (activeTabId && activeDomain) {
    await updateActiveTabTime();
  }

  if (trackingInterval) {
    clearInterval(trackingInterval);
  }

  console.log('Extension suspended - cleanup completed');
});

// Initialize the service worker
console.log('Service worker initialization complete');
