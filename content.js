// Grind Extension - Content Script
console.log('Grind Extension content script loaded');

// Inject pixel-art styles
const style = document.createElement('style');
style.textContent = `
  .grind-extension-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999999;
    font-family: 'Press Start 2P', 'VT323', monospace;
  }
  
  .grind-extension-widget {
    position: absolute;
    background: #000;
    color: #fff;
    border: 2px solid #fff;
    padding: 8px;
    font-size: 12px;
    pointer-events: auto;
    box-shadow: 4px 4px 0px #666;
  }
  
  .grind-extension-widget.light {
    background: #fff;
    color: #000;
    border-color: #000;
    box-shadow: 4px 4px 0px #ccc;
  }
`;

document.head.appendChild(style);

// Initialize content script
function initContentScript() {
  console.log('Initializing Grind Extension content script');
  
  // Get current theme from storage
  chrome.storage.sync.get(['theme'], (result) => {
    const theme = result.theme || 'dark';
    console.log('Current theme:', theme);
    
    // Apply theme to any existing widgets
    document.querySelectorAll('.grind-extension-widget').forEach(widget => {
      widget.className = `grind-extension-widget ${theme}`;
    });
  });
  
  // Check for blocking on page load
  checkForBlocking();
  
  // Inject time progress bar if site has time limit
  injectTimeProgressBar();
  
  // Listen for theme changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.theme) {
      const newTheme = changes.theme.newValue;
      console.log('Theme changed to:', newTheme);
      
      // Update all widgets
      document.querySelectorAll('.grind-extension-widget').forEach(widget => {
        widget.className = `grind-extension-widget ${newTheme}`;
      });
      
      // Update blocking overlay theme if it exists
      const overlay = document.getElementById('grind-focus-overlay');
      if (overlay) {
        overlay.className = `grind-focus-overlay ${newTheme}`;
      }
    }
    
    // Listen for blocking settings changes
    if (namespace === 'sync' && (changes.blockingEnabled || changes.blockedSites || changes.blockingLevel)) {
      checkForBlocking();
    }
  });
}

// Check if current domain should be blocked
async function checkForBlocking() {
  try {
    const domain = window.location.hostname;
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
      console.log(`🚫 Domain ${domain} is blocked, showing focus overlay`);
      console.log(`Blocked sites:`, blockedSites);
      console.log(`Blocking level:`, settings.blockingLevel || 'strict');
      showFocusOverlay(domain, settings.blockingLevel || 'strict');
    } else {
      console.log(`✅ Domain ${domain} is not blocked`);
      hideFocusOverlay();
    }
  } catch (error) {
    console.error('Error checking for blocking:', error);
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  switch (request.action) {
    case 'injectWidget':
      injectWidget(request.data);
      break;
      
    case 'removeWidget':
      removeWidget(request.id);
      break;
      
    case 'showBlockingOverlay':
      console.log('Received showBlockingOverlay message:', request);
      showBlockingOverlay(request.domain, request.reason, request.blockingLevel);
      break;
      
    case 'hideBlockingOverlay':
      console.log('Received hideBlockingOverlay message');
      hideBlockingOverlay();
      break;
      
    case 'updateTimeBar':
      console.log('Received updateTimeBar message:', request);
      updateTimeProgressBar(request.percentage, request.timeToday, request.limit);
      break;
      
    case 'getPageInfo':
      sendResponse({
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname
      });
      break;
      
    default:
      console.log('Unknown action:', request.action);
  }
});

// Widget management functions
function injectWidget(data) {
  const widget = document.createElement('div');
  widget.className = 'grind-extension-widget';
  widget.id = data.id || 'grind-widget';
  widget.textContent = data.text || 'Grind Widget';
  widget.style.top = (data.top || 20) + 'px';
  widget.style.left = (data.left || 20) + 'px';
  
  // Apply current theme
  chrome.storage.sync.get(['theme'], (result) => {
    const theme = result.theme || 'dark';
    widget.className = `grind-extension-widget ${theme}`;
  });
  
  document.body.appendChild(widget);
}

function removeWidget(id) {
  const widget = document.getElementById(id);
  if (widget) {
    widget.remove();
  }
}

// Focus overlay functions
function showFocusOverlay(domain, blockingLevel) {
  // Remove existing overlay if any
  hideFocusOverlay();
  
  // Create focus overlay
  const overlay = document.createElement('div');
  overlay.id = 'grind-focus-overlay';
  overlay.className = 'grind-focus-overlay';
  
  // Get current theme
  chrome.storage.sync.get(['theme'], (result) => {
    const theme = result.theme || 'dark';
    overlay.className = `grind-focus-overlay ${theme}`;
  });
  
  // Determine button availability based on blocking level
  const isStrictMode = blockingLevel === 'strict';
  const unblockButton = isStrictMode 
    ? '<button id="grind-work-btn" class="grind-btn work-btn" disabled><span class="btn-text">Strict Mode Active</span></button>'
    : '<button id="grind-unblock-btn" class="grind-btn unblock-btn"><span class="btn-text">Go Back to Work</span></button>';
  
  overlay.innerHTML = `
    <div class="focus-grid-bg"></div>
    <div class="focus-content">
      <div class="focus-icon">⚡</div>
      <h1 class="focus-title">Stay Focused, Hero!</h1>
      <p class="focus-subtitle">You've got this.</p>
      <div class="focus-domain">${domain}</div>
      <div class="focus-actions">
        ${unblockButton}
        <button id="grind-focus-session-btn" class="grind-btn focus-btn">
          <span class="btn-text">Start Focus Session</span>
        </button>
      </div>
      <div class="focus-stats">
        <div class="stat-item">
          <span class="stat-label">Time Saved:</span>
          <span class="stat-value" id="time-saved">0</span> min
        </div>
        <div class="stat-item">
          <span class="stat-label">Focus Level:</span>
          <span class="stat-value">${blockingLevel.toUpperCase()}</span>
        </div>
      </div>
    </div>
  `;
  
  // Add focus overlay styles
  const focusStyles = document.createElement('style');
  focusStyles.id = 'grind-focus-styles';
  focusStyles.textContent = `
    .grind-focus-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Press Start 2P', 'VT323', monospace;
      backdrop-filter: blur(15px);
      overflow: hidden;
    }
    
    .grind-focus-overlay.light {
      background: rgba(255, 255, 255, 0.95);
    }
    
    .focus-grid-bg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: 
        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 20px 20px;
      animation: gridMove 20s linear infinite;
    }
    
    .grind-focus-overlay.light .focus-grid-bg {
      background-image: 
        linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px);
    }
    
    @keyframes gridMove {
      0% { transform: translate(0, 0); }
      100% { transform: translate(20px, 20px); }
    }
    
    .focus-content {
      text-align: center;
      padding: 40px;
      border: 4px solid #fff;
      background: #000;
      box-shadow: 8px 8px 0px #666;
      max-width: 600px;
      width: 90%;
      position: relative;
      z-index: 1;
    }
    
    .grind-focus-overlay.light .focus-content {
      background: #fff;
      border-color: #000;
      box-shadow: 8px 8px 0px #ccc;
    }
    
    .focus-icon {
      font-size: 64px;
      margin-bottom: 20px;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    
    .focus-title {
      font-size: 28px;
      color: #fff;
      margin-bottom: 8px;
      text-shadow: 2px 2px 0px #666;
    }
    
    .grind-focus-overlay.light .focus-title {
      color: #000;
      text-shadow: 2px 2px 0px #ccc;
    }
    
    .focus-subtitle {
      font-size: 16px;
      color: #00ff00;
      margin-bottom: 24px;
      font-weight: bold;
    }
    
    .focus-domain {
      font-size: 14px;
      color: #ff6600;
      margin-bottom: 32px;
      padding: 8px 16px;
      border: 2px solid #ff6600;
      background: rgba(255, 102, 0, 0.1);
      display: inline-block;
    }
    
    .focus-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
    }
    
    .grind-btn {
      background: #000;
      border: 2px solid #fff;
      color: #fff;
      padding: 12px 20px;
      font-family: 'Press Start 2P', 'VT323', monospace;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.1s ease;
      text-transform: uppercase;
      min-width: 140px;
    }
    
    .grind-btn:hover:not(:disabled) {
      background: #333;
      box-shadow: 2px 2px 0px #666;
    }
    
    .grind-btn:active:not(:disabled) {
      transform: translate(1px, 1px);
      box-shadow: 1px 1px 0px #666;
    }
    
    .grind-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .grind-focus-overlay.light .grind-btn {
      background: #fff;
      border-color: #000;
      color: #000;
    }
    
    .grind-focus-overlay.light .grind-btn:hover:not(:disabled) {
      background: #e0e0e0;
      box-shadow: 2px 2px 0px #ccc;
    }
    
    .unblock-btn {
      background: #00ff00;
      color: #000;
      border-color: #00ff00;
    }
    
    .work-btn {
      background: #666;
      color: #fff;
      border-color: #666;
    }
    
    .focus-btn {
      background: #ff6600;
      color: #000;
      border-color: #ff6600;
    }
    
    .focus-stats {
      display: flex;
      justify-content: space-around;
      gap: 20px;
      font-size: 10px;
      color: #666;
    }
    
    .grind-focus-overlay.light .focus-stats {
      color: #999;
    }
    
    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    
    .stat-label {
      font-size: 8px;
      text-transform: uppercase;
    }
    
    .stat-value {
      font-size: 12px;
      font-weight: bold;
      color: #00ff00;
    }
    
    .grind-focus-overlay.light .stat-value {
      color: #00cc00;
    }
  `;
  
  document.head.appendChild(focusStyles);
  document.body.appendChild(overlay);
  
  // Add event listeners
  const unblockBtn = document.getElementById('grind-unblock-btn');
  const workBtn = document.getElementById('grind-work-btn');
  const focusSessionBtn = document.getElementById('grind-focus-session-btn');
  
  if (unblockBtn) {
    unblockBtn.addEventListener('click', () => {
      unblockSite(domain);
    });
  }
  
  if (focusSessionBtn) {
    focusSessionBtn.addEventListener('click', () => {
      startFocusSession();
    });
  }
  
  // Update time saved counter
  updateTimeSaved();
  
  console.log(`Focus overlay shown for ${domain} (${blockingLevel} mode)`);
}

function hideFocusOverlay() {
  const overlay = document.getElementById('grind-focus-overlay');
  const styles = document.getElementById('grind-focus-styles');
  
  if (overlay) {
    overlay.remove();
  }
  
  if (styles) {
    styles.remove();
  }
}

// Show blocking overlay (called from background script)
function showBlockingOverlay(domain, reason, blockingLevel) {
  console.log(`🚫 Showing blocking overlay for ${domain}: ${reason}`);
  console.log(`Blocking level:`, blockingLevel || 'strict');
  showFocusOverlay(domain, blockingLevel || 'strict');
}

// Hide blocking overlay (called from background script)
function hideBlockingOverlay() {
  console.log('Hiding blocking overlay');
  hideFocusOverlay();
}

function unblockSite(domain) {
  // Check if this site was auto-blocked due to time limit
  chrome.runtime.sendMessage({
    action: 'getDailyUsage',
    domain: domain
  }, (response) => {
    if (response && response.usage && response.usage.limitExceeded) {
      // This site was auto-blocked due to time limit - handle bypass
      console.log(`Time limit bypass detected for ${domain}`);
      
      chrome.runtime.sendMessage({
        action: 'bypassTimeLimit',
        domain: domain
      }, (bypassResponse) => {
        if (bypassResponse && bypassResponse.success) {
          hideBlockingOverlay();
          // Reload the page
          window.location.reload();
        }
      });
    } else {
      // Normal unblock (not time limit related)
      chrome.runtime.sendMessage({
        action: 'removeBlockedSite',
        domain: domain
      }, (response) => {
        if (response && response.success) {
          hideBlockingOverlay();
          // Reload the page
          window.location.reload();
        }
      });
    }
  });
}

function startFocusSession() {
  chrome.runtime.sendMessage({
    action: 'startFocusSession'
  }, (response) => {
    hideFocusOverlay();
    // Show focus session widget
    injectWidget({
      id: 'focus-session-widget',
      text: 'FOCUS SESSION ACTIVE',
      top: 20,
      left: 20
    });
    
    // Show focus session timer
    showFocusSessionTimer();
  });
}

function showFocusSessionTimer() {
  const timerWidget = document.createElement('div');
  timerWidget.id = 'focus-timer-widget';
  timerWidget.className = 'grind-extension-widget focus-timer';
  timerWidget.innerHTML = `
    <div class="timer-content">
      <div class="timer-label">FOCUS TIME</div>
      <div class="timer-display" id="focus-timer-display">25:00</div>
      <button id="end-focus-btn" class="timer-btn">END SESSION</button>
    </div>
  `;
  
  // Add timer styles
  const timerStyles = document.createElement('style');
  timerStyles.textContent = `
    .focus-timer {
      background: #000 !important;
      border: 2px solid #00ff00 !important;
      color: #00ff00 !important;
      min-width: 200px;
    }
    
    .timer-content {
      text-align: center;
    }
    
    .timer-label {
      font-size: 8px;
      margin-bottom: 8px;
    }
    
    .timer-display {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 12px;
      font-family: 'Press Start 2P', monospace;
    }
    
    .timer-btn {
      background: #ff6600;
      border: 2px solid #ff6600;
      color: #000;
      padding: 6px 12px;
      font-family: 'Press Start 2P', 'VT323', monospace;
      font-size: 8px;
      cursor: pointer;
      text-transform: uppercase;
    }
    
    .timer-btn:hover {
      background: #ff8833;
    }
  `;
  
  document.head.appendChild(timerStyles);
  document.body.appendChild(timerWidget);
  
  // Start countdown timer
  let timeLeft = 25 * 60; // 25 minutes in seconds
  const timerDisplay = document.getElementById('focus-timer-display');
  const endBtn = document.getElementById('end-focus-btn');
  
  const timer = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    timeLeft--;
    
    if (timeLeft < 0) {
      clearInterval(timer);
      timerDisplay.textContent = 'DONE!';
      endBtn.textContent = 'SESSION COMPLETE';
      endBtn.style.background = '#00ff00';
      endBtn.style.color = '#000';
    }
  }, 1000);
  
  endBtn.addEventListener('click', () => {
    clearInterval(timer);
    timerWidget.remove();
    timerStyles.remove();
    chrome.runtime.sendMessage({ action: 'endFocusSession' });
  });
}

function updateTimeSaved() {
  // Calculate time saved based on session data
  chrome.runtime.sendMessage({
    action: 'getSessionData'
  }, (response) => {
    if (response && response.totalTime) {
      const timeSaved = Math.round(response.totalTime / 60000); // Convert to minutes
      const timeSavedElement = document.getElementById('time-saved');
      if (timeSavedElement) {
        timeSavedElement.textContent = timeSaved;
      }
    }
  });
}

// Time progress bar functions
function injectTimeProgressBar() {
  // Check if site has time limit set
  chrome.runtime.sendMessage({
    action: 'getTimeLimit',
    domain: window.location.hostname
  }, (response) => {
    if (response && response.limit) {
      console.log(`Time limit found for ${window.location.hostname}, injecting progress bar`);
      createTimeProgressBar();
    } else {
      console.log(`No time limit set for ${window.location.hostname}`);
    }
  });
}

function createTimeProgressBar() {
  // Remove existing progress bar if any
  removeTimeProgressBar();
  
  // Create progress bar element
  const progressBar = document.createElement('div');
  progressBar.id = 'grind-time-bar';
  progressBar.className = 'grind-time-progress-bar';
  
  // Add progress bar styles
  const progressStyles = document.createElement('style');
  progressStyles.id = 'grind-time-bar-styles';
  progressStyles.textContent = `
    .grind-time-progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 4px;
      background: linear-gradient(90deg, #00ff00, #ff6600, #ff0000);
      z-index: 999999;
      transition: width 0.5s ease, background 0.3s ease;
      box-shadow: 0 0 10px currentColor;
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
    }
    
    .grind-time-progress-bar.warning {
      animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    
    .grind-time-progress-bar.exceeded {
      background: #666 !important;
      animation: none;
    }
  `;
  
  document.head.appendChild(progressStyles);
  document.body.appendChild(progressBar);
  
  console.log('Time progress bar injected');
}

function updateTimeProgressBar(percentage, timeToday, limit) {
  const progressBar = document.getElementById('grind-time-bar');
  if (!progressBar) {
    console.log('Progress bar not found, creating new one');
    createTimeProgressBar();
    return;
  }
  
  // Update width
  progressBar.style.width = `${Math.min(percentage, 100)}%`;
  
  // Update color based on percentage
  if (percentage >= 100) {
    progressBar.className = 'grind-time-progress-bar exceeded';
  } else if (percentage >= 90) {
    progressBar.className = 'grind-time-progress-bar warning';
  } else {
    progressBar.className = 'grind-time-progress-bar';
  }
  
  // Update background gradient based on percentage
  if (percentage < 70) {
    progressBar.style.background = 'linear-gradient(90deg, #00ff00, #00ff00)';
  } else if (percentage < 90) {
    progressBar.style.background = 'linear-gradient(90deg, #00ff00, #ff6600)';
  } else if (percentage < 100) {
    progressBar.style.background = 'linear-gradient(90deg, #ff6600, #ff0000)';
  } else {
    progressBar.style.background = '#666';
  }
  
  console.log(`Updated progress bar: ${percentage.toFixed(1)}%`);
}

function removeTimeProgressBar() {
  const progressBar = document.getElementById('grind-time-bar');
  const styles = document.getElementById('grind-time-bar-styles');
  
  if (progressBar) {
    progressBar.remove();
  }
  
  if (styles) {
    styles.remove();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}
