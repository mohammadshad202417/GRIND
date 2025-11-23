console.log('Grind Extension background script loaded');

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

      const newLevel = Math.floor(userStats.totalXP / 100) + 1;
      if (newLevel > userStats.level) {
        userStats.level = newLevel;
      }

      await chrome.storage.local.set({ userStats: userStats });

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

      sessionData.totalTime += timeSpent;

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

const storageManager = new StorageManager();

let activeTabId = null;
let activeDomain = null;
let trackingInterval = null;
let lastUpdateTime = Date.now();
let tabData = new Map();

(async () => {
  try {
    console.log('Service worker loaded - initializing tracking');
    await new Promise(resolve => setTimeout(resolve, 100));
    await initializeTracking();
  } catch (error) {
    console.error('Error during service worker initialization:', error);
  }
})();

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Grind Extension installed/updated:', details.reason);

  try {
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

    if (details.reason === 'install') {
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

chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension startup - initializing tracking');
  try {
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

chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked on tab:', tab.id);
});

async function initializeTracking() {
  try {
    await new Promise(resolve => setTimeout(resolve, 500));

    await initializeDefaultTimeLimits();

    if (!chrome.tabs || !chrome.tabs.query) {
      console.log('Chrome tabs API not available yet, skipping initialization');
      return;
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];

      if (!tab.url || typeof tab.url !== 'string') {
        console.log('Invalid tab URL, skipping initialization');
        return;
      }

      const domain = extractDomain(tab.url);

      activeTabId = tab.id;
      activeDomain = domain;
      lastUpdateTime = Date.now();

      await storageManager.updateSessionData(domain, 0, true, false);

      await checkAndBlockSite(tab.id, domain);

      console.log(`Initial tab: ${domain} (${tab.id}) - no visit counted`);
    }

    startTrackingInterval();

    startMidnightResetChecker();

    console.log('Tracking system initialized');
  } catch (error) {
    console.error('Error initializing tracking:', error);
  }
}

async function initializeDefaultTimeLimits() {
  try {
    const result = await chrome.storage.local.get(['timeLimits']);
    if (!result.timeLimits || Object.keys(result.timeLimits).length === 0) {
      const defaultLimits = {
        'youtube.com': 7200,
        'instagram.com': 3600,
        'facebook.com': 1800,
        'twitter.com': 1800,
        'tiktok.com': 1800,
        'reddit.com': 3600,
        'netflix.com': 7200,
        'twitch.tv': 3600
      };

      await chrome.storage.local.set({ timeLimits: defaultLimits });
      console.log('Initialized default time limits');
    }
  } catch (error) {
    console.error('Error initializing default time limits:', error);
  }
}

function startMidnightResetChecker() {
  setInterval(async () => {
    await storageManager.checkMidnightReset();
  }, 60000);

  console.log('Midnight reset checker started');
}

async function checkTimeLimits(domain, tabId) {
  try {
    if (!(await tabExists(tabId))) {
      console.log(`Tab ${tabId} no longer exists, skipping time limit check`);
      return;
    }

    const [timeLimits, dailyUsage] = await Promise.all([
      storageManager.getTimeLimits(),
      storageManager.getDailyTimeUsage()
    ]);

    const limit = timeLimits[domain];
    if (!limit) return;

    const usage = dailyUsage[domain];
    if (!usage) return;

    const timeTodayMs = usage.timeToday;
    const limitMs = limit * 1000;
    const percentage = (timeTodayMs / limitMs) * 100;

    try {
      await chrome.tabs.sendMessage(parseInt(tabId), {
        action: 'updateTimeBar',
        percentage: Math.min(percentage, 100),
        timeToday: timeTodayMs,
        limit: limitMs
      });
    } catch (error) {
      if (error.message.includes('No tab with id')) {
        console.log(`Tab ${tabId} no longer exists, skipping progress update`);
      }
    }

    if (percentage >= 100 && !usage.limitExceeded) {
      console.log(`⏱ Time limit exceeded for ${domain}: ${Math.round(timeTodayMs / 1000)}s / ${limit}s`);

      usage.limitExceeded = true;
      await chrome.storage.local.set({ dailyTimeUsage: dailyUsage });

      await addBlockedSite(domain);

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

      await chrome.storage.local.set({ focusBonusEligible: false });

    } else if (percentage >= 90 && percentage < 100) {
      const remainingMinutes = Math.ceil((limitMs - timeTodayMs) / 60000);
      console.log(`⚠️ 10% time remaining for ${domain}: ${remainingMinutes} minutes left`);

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

function startTrackingInterval() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }

  trackingInterval = setInterval(async () => {
    await updateActiveTabTime();
  }, 5000);

  setInterval(async () => {
    await checkAllTabsForBlocking();
  }, 30000);

  console.log('Tracking interval started');
}

async function updateActiveTabTime() {
  if (!activeTabId || !activeDomain) {
    console.log('No active tab or domain to track');
    return;
  }

  try {
    const currentTime = Date.now();
    const timeDiff = currentTime - lastUpdateTime;

    if (timeDiff >= 1000 && timeDiff <= 300000) {
      await storageManager.updateWebsiteTime(activeDomain, timeDiff);

      await storageManager.updateDailyTime(activeDomain, timeDiff);

      await storageManager.updateSessionData(activeDomain, timeDiff, false, false);

      console.log(`✅ Time updated for ${activeDomain}: +${Math.round(timeDiff / 1000)}s`);

      await checkTimeLimits(activeDomain, activeTabId);
    } else if (timeDiff > 300000) {
      console.log(`⚠️ Skipping large time jump: ${Math.round(timeDiff / 1000)}s (likely browser sleep/wake)`);
    }

    lastUpdateTime = currentTime;

    await checkAndBlockSite(activeTabId, activeDomain);
  } catch (error) {
    console.error('Error updating active tab time:', error);
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await handleTabActivated(activeInfo);
  } catch (error) {
    console.error('Error handling tab activation:', error);
    if (error.message.includes('No tab with id')) {
      console.log('Resetting tracking state due to tab activation error');
      activeTabId = null;
      activeDomain = null;
    }
  }
});

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
    if (activeTabId && activeDomain) {
      await updateActiveTabTime();
    }

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
      throw error;
    }

    const previousTabId = activeTabId;
    activeTabId = tab.id;

    if (!tab.url || typeof tab.url !== 'string') {
      console.log('Invalid tab URL, skipping domain extraction');
      activeDomain = null;
      return;
    }

    const domain = extractDomain(tab.url);

    const domainChanged = domain && domain !== activeDomain;

    const tabSwitched = previousTabId !== null && previousTabId !== activeTabId;

    if (domainChanged) {
      await storageManager.incrementWebsiteVisits(domain);
    }

    activeDomain = domain;
    lastUpdateTime = Date.now();

    await storageManager.updateSessionData(domain, 0, domainChanged, tabSwitched);

    await checkAndBlockSite(activeTabId, domain);

    console.log(`Tab activated: ${domain} (${tab.id}) - Switch: ${tabSwitched}, Domain changed: ${domainChanged}`);
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
}

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    if (tabId === activeTabId) {
      await updateActiveTabTime();
      activeTabId = null;
      activeDomain = null;

      await storageManager.updateSessionData(null, 0, true, false);

      console.log('Active tab closed, clearing tracking');
    }
  } catch (error) {
    console.error('Error handling tab removal:', error);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      if (!tab.url || typeof tab.url !== 'string') {
        console.log('Invalid tab URL in update, skipping');
        return;
      }

      const domain = extractDomain(tab.url);

      if (tabId === activeTabId) {
        if (domain !== activeDomain) {
          await updateActiveTabTime();

          activeDomain = domain;
          lastUpdateTime = Date.now();

          await storageManager.updateSessionData(domain, 0, true, false);

          console.log(`Tab URL changed: ${activeDomain} (${tabId})`);
        }
      }

      await checkAndBlockSite(tabId, domain);

    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }
});

async function tabExists(tabId) {
  try {
    if (tabId === null || tabId === undefined) return false;
    const id = Math.floor(Number(tabId));
    if (isNaN(id) || !Number.isInteger(id) || id < 0) return false;

    await chrome.tabs.get(id);
    return true;
  } catch (error) {
    return false;
  }
}

function extractDomain(url) {
  try {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return null;
    }

    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
      url.startsWith('moz-extension://') || url.startsWith('edge://') ||
      url.startsWith('about:') || url.startsWith('data:') ||
      url.startsWith('file://') || url.startsWith('javascript:')) {
      return null;
    }

    if (!url.includes('://')) {
      url = 'http://' + url;
    }

    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Error extracting domain from URL:', url, error);
    return null;
  }
}

function categorizeSite(domain) {
  const productiveDomains = [
    'github.com', 'stackoverflow.com', 'developer.mozilla.org',
    'docs.microsoft.com', 'aws.amazon.com', 'cloud.google.com',
    'docs.google.com', 'notion.so', 'trello.com', 'asana.com',
    'coursera.org', 'udemy.com', 'khanacademy.org', 'edx.org',
    'linkedin.com', 'medium.com', 'dev.to', 'hashnode.com'
  ];

  const unproductiveDomains = [
    'facebook.com', 'twitter.com', 'instagram.com',
    'tiktok.com', 'reddit.com', 'youtube.com', 'netflix.com',
    'twitch.tv', 'discord.com', 'snapchat.com', 'pinterest.com',
    '9gag.com', 'buzzfeed.com', 'imgur.com', 'vine.co'
  ];

  if (productiveDomains.some(site => domain.includes(site))) {
    return 'productive';
  }

  if (unproductiveDomains.some(site => domain.includes(site))) {
    return 'unproductive';
  }

  return 'neutral';
}

async function checkAndBlockSite(tabId, domain) {
  if (!domain) return;

  if (!(await tabExists(tabId))) {
    console.log(`Tab ${tabId} no longer exists, skipping blocking check`);
    return;
  }

  try {
    const settings = await chrome.storage.sync.get(['blockingEnabled', 'blockedSites', 'blockingLevel']);

    if (!settings.blockingEnabled) return;

    const blockedSites = settings.blockedSites || [];
    const isBlocked = blockedSites.some(site => {
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
        }
      }
    } else {
      try {
        await chrome.tabs.sendMessage(parseInt(tabId), {
          action: 'hideBlockingOverlay'
        });
      } catch (error) {
        if (error.message.includes('No tab with id')) {
          console.log(`Tab ${tabId} no longer exists, skipping hide overlay message`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking site blocking:', error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);

  switch (request.action) {
    case 'getTabInfo':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
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
      return true;

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
      const testDomain = request.domain || 'example.com';
      console.log(`🧪 Testing blocking for domain: ${testDomain}`);

      chrome.storage.sync.get(['blockingEnabled', 'blockedSites', 'blockingLevel'], (settings) => {
        console.log('Current blocking settings:', settings);

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

async function addBlockedSite(domain) {
  try {
    const result = await chrome.storage.sync.get(['blockedSites']);
    const blockedSites = result.blockedSites || [];

    if (!blockedSites.includes(domain)) {
      blockedSites.push(domain);
      await chrome.storage.sync.set({ blockedSites: blockedSites });
      console.log(`Added blocked site: ${domain}`);

      if (activeTabId && activeDomain === domain) {
        console.log(`Immediately checking blocking for newly added site: ${domain}`);
        await checkAndBlockSite(activeTabId, domain);
      }
    }
  } catch (error) {
    console.error('Error adding blocked site:', error);
  }
}

async function removeBlockedSite(domain) {
  try {
    const result = await chrome.storage.sync.get(['blockedSites']);
    const blockedSites = result.blockedSites || [];

    const index = blockedSites.indexOf(domain);
    if (index > -1) {
      blockedSites.splice(index, 1);
      await chrome.storage.sync.set({ blockedSites: blockedSites });
      console.log(`Removed blocked site: ${domain}`);

      if (activeTabId && activeDomain === domain) {
        console.log(`Immediately checking unblocking for removed site: ${domain}`);
        await checkAndBlockSite(activeTabId, domain);
      }
    }
  } catch (error) {
    console.error('Error removing blocked site:', error);
  }
}

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

async function handleTimeLimitBypass(domain) {
  try {
    console.log(`⏱ Time limit bypassed for ${domain} - deducting 10 XP`);

    const result = await chrome.storage.local.get(['userStats']);
    const userStats = result.userStats || { xp: 0, level: 1, streak: 0, totalXP: 0 };

    userStats.xp = Math.max(0, userStats.xp - 10);

    await chrome.storage.local.set({ userStats: userStats });

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

    await removeBlockedSite(domain);

    setTimeout(async () => {
      await addBlockedSite(domain);
      console.log(`Re-blocked ${domain} after 5-minute bypass`);
    }, 5 * 60 * 1000);

    console.log(`Time limit bypass handled for ${domain}: -10 XP, 5min unblock`);
  } catch (error) {
    console.error('Error handling time limit bypass:', error);
  }
}

async function startFocusSession(isResume = false) {
  try {
    if (isResume) {
      chrome.action.setBadgeText({ text: 'FOCUS' });
      console.log('Focus session resumed');
      return;
    }

    const settings = await chrome.storage.sync.get(['focusSessionDuration']);
    const duration = settings.focusSessionDuration || 25;

    await chrome.storage.local.set({
      focusSession: {
        active: true,
        startTime: Date.now(),
        duration: duration * 60 * 1000,
        endTime: Date.now() + (duration * 60 * 1000)
      }
    });

    chrome.action.setBadgeText({ text: 'FOCUS' });

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

    chrome.action.setBadgeText({ text: '' });

    await generateGalaxyStar();

    console.log('Focus session ended');
  } catch (error) {
    console.error('Error ending focus session:', error);
  }
}

async function generateGalaxyStar() {
  try {
    const result = await chrome.storage.local.get(['galaxyData']);
    const galaxyData = result.galaxyData || { stars: [], firstSessionDate: null };

    const sessionDuration = 25;
    const sessionQuality = 'good';

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
    'excellent': '#00ffff',
    'good': '#00ff00',
    'fair': '#ffff00',
    'poor': '#ff6600'
  };
  return colors[quality] || colors['good'];
}

chrome.runtime.onSuspend.addListener(async () => {
  if (activeTabId && activeDomain) {
    await updateActiveTabTime();
  }

  if (trackingInterval) {
    clearInterval(trackingInterval);
  }

  console.log('Extension suspended - cleanup completed');
});

console.log('Service worker initialization complete');
