// Grind Extension - Enhanced Options Script
// Theme utility functions (inline to avoid importScripts issues)
class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.themeChangeCallbacks = [];
        this.systemThemeQuery = null;
        this.initThemeDetection();
    }
    
    initThemeDetection() {
        if (window.matchMedia) {
            this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.systemThemeQuery.addListener(this.handleSystemThemeChange.bind(this));
            this.currentTheme = this.systemThemeQuery.matches ? 'dark' : 'light';
        }
        this.loadThemePreference();
    }
    
    async loadThemePreference() {
        try {
            const result = await chrome.storage.sync.get(['theme']);
            if (result.theme) {
                this.currentTheme = result.theme;
            }
        } catch (error) {
            console.error('Error loading theme preference:', error);
        }
    }
    
    handleSystemThemeChange(event) {
        const systemTheme = event.matches ? 'dark' : 'light';
        chrome.storage.sync.get(['theme', 'autoSyncTheme'], (result) => {
            if (result.autoSyncTheme !== false) {
                this.setTheme(systemTheme, false);
            }
        });
    }
    
    async setTheme(theme, save = true) {
        if (theme !== 'dark' && theme !== 'light') {
            console.error('Invalid theme:', theme);
            return;
        }
        
        this.currentTheme = theme;
        this.applyThemeToDocument();
        
        if (save) {
            try {
                await chrome.storage.sync.set({ theme: theme });
            } catch (error) {
                console.error('Error saving theme:', error);
            }
        }
        
        this.notifyThemeChange(theme);
        console.log('Theme set to:', theme);
    }
    
    applyThemeToDocument() {
        const body = document.body;
        const html = document.documentElement;
        
        if (this.currentTheme === 'light') {
            body.classList.add('light');
            html.setAttribute('data-theme', 'light');
        } else {
            body.classList.remove('light');
            html.setAttribute('data-theme', 'dark');
        }
        
        this.updateThemeToggleButton();
    }
    
    updateThemeToggleButton() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = this.currentTheme === 'dark' ? '🌙' : '☀️';
            }
        }
    }
    
    async toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        await this.setTheme(newTheme);
    }
    
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    isDarkTheme() {
        return this.currentTheme === 'dark';
    }
    
    isLightTheme() {
        return this.currentTheme === 'light';
    }
    
    onThemeChange(callback) {
        this.themeChangeCallbacks.push(callback);
        return () => {
            const index = this.themeChangeCallbacks.indexOf(callback);
            if (index > -1) {
                this.themeChangeCallbacks.splice(index, 1);
            }
        };
    }
    
    notifyThemeChange(theme) {
        this.themeChangeCallbacks.forEach(callback => {
            try {
                callback(theme);
            } catch (error) {
                console.error('Error in theme change callback:', error);
            }
        });
    }
}

// Create global instance
const themeManager = new ThemeManager();

// DOM Elements - will be initialized after DOM loads
let elements = {};

// State
let currentSettings = {};
let hasUnsavedChanges = false;
let autoSaveEnabled = true;

// Default Settings
const defaultSettings = {
    // General Settings
    trackTimeEnabled: true,
    notificationsEnabled: true,
    darkModeEnabled: false,
    textSize: 'medium',
    autoSaveEnabled: true,
    
    // Privacy Settings
    excludeIncognito: false,
    excludeSystemPages: true,
    anonymizeData: false,
    
    // Site Blocking & Focus
    blockingEnabled: false,
    blockingLevel: 'custom',
    focusSessionDuration: 25,
    blockedSites: [],
    productiveSites: [],
    
    // Data Management
    dataRetentionPeriod: 30,
    exportFormat: 'json'
};

// Initialize DOM Elements
function initDOMElements() {
    console.log('Initializing DOM elements...');
    
    elements = {
        // Header
        themeToggle: document.getElementById('themeToggle'),
        autoSaveIndicator: document.getElementById('autoSaveIndicator'),
        
        // General Settings
        trackTimeEnabled: document.getElementById('trackTimeEnabled'),
        notificationsEnabled: document.getElementById('notificationsEnabled'),
        darkModeEnabled: document.getElementById('darkModeEnabled'),
        textSize: document.getElementById('textSize'),
        autoSaveEnabled: document.getElementById('autoSaveEnabled'),
        
        // Privacy Settings
        excludeIncognito: document.getElementById('excludeIncognito'),
        excludeSystemPages: document.getElementById('excludeSystemPages'),
        anonymizeData: document.getElementById('anonymizeData'),
        
        // Site Blocking & Focus
        blockingEnabled: document.getElementById('blockingEnabled'),
        blockingLevel: document.getElementById('blockingLevel'),
        focusSessionDuration: document.getElementById('focusSessionDuration'),
        
        // Blocked Sites
        blockedSitesList: document.getElementById('blockedSitesList'),
        newBlockedSiteInput: document.getElementById('newBlockedSiteInput'),
        addBlockedSiteBtn: document.getElementById('addBlockedSiteBtn'),
        importBlockedSitesBtn: document.getElementById('importBlockedSitesBtn'),
        exportBlockedSitesBtn: document.getElementById('exportBlockedSitesBtn'),
        clearBlockedSitesBtn: document.getElementById('clearBlockedSitesBtn'),
        
        // Productive Sites
        productiveSitesList: document.getElementById('productiveSitesList'),
        newProductiveSiteInput: document.getElementById('newProductiveSiteInput'),
        addProductiveSiteBtn: document.getElementById('addProductiveSiteBtn'),
        importProductiveSitesBtn: document.getElementById('importProductiveSitesBtn'),
        exportProductiveSitesBtn: document.getElementById('exportProductiveSitesBtn'),
        clearProductiveSitesBtn: document.getElementById('clearProductiveSitesBtn'),
        
        // Data Management
        dataRetentionPeriod: document.getElementById('dataRetentionPeriod'),
        exportFormat: document.getElementById('exportFormat'),
        exportAllDataBtn: document.getElementById('exportAllDataBtn'),
        importAllDataBtn: document.getElementById('importAllDataBtn'),
        importAllDataFile: document.getElementById('importAllDataFile'),
        clearAllDataBtn: document.getElementById('clearAllDataBtn'),
        resetAllSettingsBtn: document.getElementById('resetAllSettingsBtn'),
        
        // Statistics
        tabsTracked: document.getElementById('tabsTracked'),
        tabSwitchesTracked: document.getElementById('tabSwitchesTracked'),
        timeTracked: document.getElementById('timeTracked'),
        uniqueDomains: document.getElementById('uniqueDomains'),
        dataSize: document.getElementById('dataSize'),
        
        // Footer
        saveControls: document.getElementById('saveControls'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        cancelChangesBtn: document.getElementById('cancelChangesBtn'),
        unsavedIndicator: document.getElementById('unsavedIndicator')
    };
    
    // Debug: Check if Data Management buttons are found
    console.log('Data Management buttons found:');
    console.log('exportAllDataBtn:', !!elements.exportAllDataBtn);
    console.log('importAllDataBtn:', !!elements.importAllDataBtn);
    console.log('importAllDataFile:', !!elements.importAllDataFile);
    console.log('clearAllDataBtn:', !!elements.clearAllDataBtn);
    console.log('resetAllSettingsBtn:', !!elements.resetAllSettingsBtn);
    
    // Debug: Check if buttons exist in DOM
    console.log('All buttons in DOM:', document.querySelectorAll('button[id*="Data"], button[id*="Settings"]'));
}

// Initialize Options Page
document.addEventListener('DOMContentLoaded', () => {
    initOptions();
});

async function initOptions() {
    try {
        initDOMElements();
        // Load theme BEFORE applying it
        await themeManager.loadThemePreference();
        await loadSettings();
        await loadStatistics();
        setupEventListeners();
        applyTheme();
        updateAutoSaveIndicator();
        console.log('Options page initialized successfully');
    } catch (error) {
        console.error('Error initializing options:', error);
    }
}

// Load Settings
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(defaultSettings);
        currentSettings = { ...defaultSettings, ...result };
        
        // Apply settings to UI
        elements.trackTimeEnabled.checked = currentSettings.trackTimeEnabled;
        elements.notificationsEnabled.checked = currentSettings.notificationsEnabled;
        
        // Load theme and sync with checkbox
        const themeResult = await chrome.storage.sync.get(['theme']);
        const currentTheme = themeResult.theme || 'dark';
        elements.darkModeEnabled.checked = (currentTheme === 'dark');
        
        elements.textSize.value = currentSettings.textSize;
        elements.autoSaveEnabled.checked = currentSettings.autoSaveEnabled;
        
        // Load and apply autoSaveEnabled setting
        autoSaveEnabled = currentSettings.autoSaveEnabled !== false; // Default to true
        elements.autoSaveEnabled.checked = autoSaveEnabled;
        updateAutoSaveIndicator();
        
        // Apply text size
        applyTextSize(currentSettings.textSize);
        
        elements.excludeIncognito.checked = currentSettings.excludeIncognito;
        elements.excludeSystemPages.checked = currentSettings.excludeSystemPages;
        elements.anonymizeData.checked = currentSettings.anonymizeData;
        
        elements.blockingEnabled.checked = currentSettings.blockingEnabled;
        elements.blockingLevel.value = currentSettings.blockingLevel;
        elements.focusSessionDuration.value = currentSettings.focusSessionDuration;
        
        elements.dataRetentionPeriod.value = currentSettings.dataRetentionPeriod;
        elements.exportFormat.value = currentSettings.exportFormat;
        
        // Load sites lists
        await loadBlockedSites();
        await loadProductiveSites();
        
        autoSaveEnabled = currentSettings.autoSaveEnabled;
        updateAutoSaveIndicator();
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Load Blocked Sites
async function loadBlockedSites() {
    try {
        const result = await chrome.storage.sync.get(['blockedSites']);
        const blockedSites = result.blockedSites || [];
        updateBlockedSitesList(blockedSites);
    } catch (error) {
        console.error('Error loading blocked sites:', error);
    }
}

// Load Productive Sites
async function loadProductiveSites() {
    try {
        const result = await chrome.storage.sync.get(['productiveSites']);
        const productiveSites = result.productiveSites || [];
        updateProductiveSitesList(productiveSites);
    } catch (error) {
        console.error('Error loading productive sites:', error);
    }
}

// Update Blocked Sites List
function updateBlockedSitesList(sites) {
    elements.blockedSitesList.innerHTML = '';
    
    if (sites.length === 0) {
        elements.blockedSitesList.innerHTML = '<div class="no-sites">No blocked sites</div>';
        return;
    }
    
    sites.forEach(site => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        siteItem.innerHTML = `
            <span class="site-domain">${site}</span>
            <button class="site-remove" data-site="${site}">Remove</button>
        `;
        elements.blockedSitesList.appendChild(siteItem);
    });
}

// Update Productive Sites List
function updateProductiveSitesList(sites) {
    elements.productiveSitesList.innerHTML = '';
    
    if (sites.length === 0) {
        elements.productiveSitesList.innerHTML = '<div class="no-sites">No productive sites</div>';
        return;
    }
    
    sites.forEach(site => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        siteItem.innerHTML = `
            <span class="site-domain">${site}</span>
            <button class="site-remove" data-site="${site}">Remove</button>
        `;
        elements.productiveSitesList.appendChild(siteItem);
    });
}

// Load Statistics
async function loadStatistics() {
    try {
        const result = await chrome.storage.local.get(['websiteStats', 'sessionData']);
        const websiteStats = result.websiteStats || {};
        const sessionData = result.sessionData || {};
        
        // Calculate statistics
        const uniqueDomains = Object.keys(websiteStats).length;
        const totalTime = Object.values(websiteStats).reduce((sum, site) => sum + (site.timeSpent || 0), 0);
        const tabsOpened = sessionData.tabsOpened || 0;
        const tabSwitches = sessionData.tabSwitches || 0;
        
        // Calculate data size (approximate)
        const dataSize = JSON.stringify({ websiteStats, sessionData }).length;
        
        // Update UI
        if (elements.tabsTracked) elements.tabsTracked.textContent = tabsOpened;
        if (elements.tabSwitchesTracked) elements.tabSwitchesTracked.textContent = tabSwitches;
        if (elements.timeTracked) elements.timeTracked.textContent = formatTime(totalTime);
        if (elements.uniqueDomains) elements.uniqueDomains.textContent = uniqueDomains;
        if (elements.dataSize) elements.dataSize.textContent = formatDataSize(dataSize);
        
        console.log('Statistics loaded:', { tabsOpened, tabSwitches, totalTime, uniqueDomains, dataSize });
        
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

// Format Time
function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return `${seconds}s`;
    }
}

// Format Data Size
function formatDataSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
}

// Add visual feedback to button clicks
function addButtonClickFeedback(button, action) {
    if (!button) return;
    
    const originalText = button.textContent;
    const originalTransform = button.style.transform;
    
    // Add click animation
    button.addEventListener('click', function(e) {
        // Prevent multiple rapid clicks
        if (button.disabled) {
            e.preventDefault();
            return;
        }
        
        // Visual feedback
        button.style.transform = 'scale(0.95)';
        button.style.opacity = '0.8';
        
        // Reset after animation
        setTimeout(() => {
            button.style.transform = originalTransform;
            button.style.opacity = '1';
        }, 150);
    });
}

// Setup Data Management Buttons with Fallback
function setupDataManagementButtons() {
    console.log('Setting up Data Management buttons...');
    
    // Try multiple approaches to find and setup buttons
    const buttonIds = [
        'exportAllDataBtn',
        'importAllDataBtn', 
        'importAllDataFile',
        'clearAllDataBtn',
        'resetAllSettingsBtn'
    ];
    
    buttonIds.forEach(id => {
        let element = elements[id];
        
        // Fallback: try to find element directly if not in elements object
        if (!element) {
            element = document.getElementById(id);
            console.log(`Fallback: Found ${id}:`, !!element);
        }
        
        if (element) {
            elements[id] = element; // Update elements object
            console.log(`✅ ${id} found and ready`);
        } else {
            console.error(`❌ ${id} not found in DOM`);
        }
    });
    
    // Setup Export Data Button
    if (elements.exportAllDataBtn) {
        console.log('Adding export data button listener');
        elements.exportAllDataBtn.addEventListener('click', exportAllData);
        addButtonClickFeedback(elements.exportAllDataBtn);
        elements.exportAllDataBtn.style.cursor = 'pointer';
    } else {
        console.error('Export data button not found!');
        // Try fallback approach
        const exportBtn = document.querySelector('button[id="exportAllDataBtn"]');
        if (exportBtn) {
            console.log('Fallback: Found export button via querySelector');
            exportBtn.addEventListener('click', exportAllData);
            addButtonClickFeedback(exportBtn);
            elements.exportAllDataBtn = exportBtn;
        }
    }
    
    // Setup Import Data Button
    if (elements.importAllDataBtn) {
        console.log('Adding import data button listener');
        elements.importAllDataBtn.addEventListener('click', () => {
            console.log('Import button clicked');
            if (elements.importAllDataFile) {
                elements.importAllDataFile.click();
            }
        });
        addButtonClickFeedback(elements.importAllDataBtn);
        elements.importAllDataBtn.style.cursor = 'pointer';
    } else {
        console.error('Import data button not found!');
        // Try fallback approach
        const importBtn = document.querySelector('button[id="importAllDataBtn"]');
        if (importBtn) {
            console.log('Fallback: Found import button via querySelector');
            importBtn.addEventListener('click', () => {
                const fileInput = document.getElementById('importAllDataFile');
                if (fileInput) fileInput.click();
            });
            addButtonClickFeedback(importBtn);
            elements.importAllDataBtn = importBtn;
        }
    }
    
    // Setup Import File Input
    if (elements.importAllDataFile) {
        elements.importAllDataFile.addEventListener('change', importAllData);
    } else {
        const fileInput = document.getElementById('importAllDataFile');
        if (fileInput) {
            fileInput.addEventListener('change', importAllData);
            elements.importAllDataFile = fileInput;
        }
    }
    
    // Setup Clear All Data Button
    if (elements.clearAllDataBtn) {
        console.log('Adding clear data button listener');
        elements.clearAllDataBtn.addEventListener('click', clearAllData);
        addButtonClickFeedback(elements.clearAllDataBtn);
        elements.clearAllDataBtn.style.cursor = 'pointer';
    } else {
        console.error('Clear data button not found!');
        // Try fallback approach
        const clearBtn = document.querySelector('button[id="clearAllDataBtn"]');
        if (clearBtn) {
            console.log('Fallback: Found clear button via querySelector');
            clearBtn.addEventListener('click', clearAllData);
            addButtonClickFeedback(clearBtn);
            elements.clearAllDataBtn = clearBtn;
        }
    }
    
    // Setup Reset Settings Button
    if (elements.resetAllSettingsBtn) {
        console.log('Adding reset settings button listener');
        elements.resetAllSettingsBtn.addEventListener('click', resetAllSettings);
        addButtonClickFeedback(elements.resetAllSettingsBtn);
        elements.resetAllSettingsBtn.style.cursor = 'pointer';
    } else {
        console.error('Reset settings button not found!');
        // Try fallback approach
        const resetBtn = document.querySelector('button[id="resetAllSettingsBtn"]');
        if (resetBtn) {
            console.log('Fallback: Found reset button via querySelector');
            resetBtn.addEventListener('click', resetAllSettings);
            addButtonClickFeedback(resetBtn);
            elements.resetAllSettingsBtn = resetBtn;
        }
    }
    
    console.log('Data Management buttons setup complete');
}

// Setup Event Listeners
function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // General settings
    elements.trackTimeEnabled.addEventListener('change', handleSettingChange);
    elements.notificationsEnabled.addEventListener('change', handleSettingChange);
    elements.darkModeEnabled.addEventListener('change', async (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        await themeManager.setTheme(newTheme);
        handleSettingChange(e);
    });
    elements.textSize.addEventListener('change', handleSettingChange);
    elements.autoSaveEnabled.addEventListener('change', handleAutoSaveChange);
    
    // Privacy settings
    elements.excludeIncognito.addEventListener('change', handleSettingChange);
    elements.excludeSystemPages.addEventListener('change', handleSettingChange);
    elements.anonymizeData.addEventListener('change', handleSettingChange);
    
    // Site blocking settings
    elements.blockingEnabled.addEventListener('change', handleSettingChange);
    elements.blockingLevel.addEventListener('change', handleSettingChange);
    elements.focusSessionDuration.addEventListener('change', handleSettingChange);
    
    // Blocked sites
    elements.addBlockedSiteBtn.addEventListener('click', addBlockedSite);
    elements.newBlockedSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addBlockedSite();
    });
    elements.importBlockedSitesBtn.addEventListener('click', importBlockedSites);
    elements.exportBlockedSitesBtn.addEventListener('click', exportBlockedSites);
    elements.clearBlockedSitesBtn.addEventListener('click', clearBlockedSites);
    
    // Productive sites
    elements.addProductiveSiteBtn.addEventListener('click', addProductiveSite);
    elements.newProductiveSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addProductiveSite();
    });
    elements.importProductiveSitesBtn.addEventListener('click', importProductiveSites);
    elements.exportProductiveSitesBtn.addEventListener('click', exportProductiveSites);
    elements.clearProductiveSitesBtn.addEventListener('click', clearProductiveSites);
    
    // Data management
    if (elements.dataRetentionPeriod) {
        elements.dataRetentionPeriod.addEventListener('change', handleSettingChange);
    }
    if (elements.exportFormat) {
        elements.exportFormat.addEventListener('change', handleSettingChange);
    }
    
    // Setup Data Management buttons with fallback
    setupDataManagementButtons();
    
    // Footer controls
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.cancelChangesBtn.addEventListener('click', cancelChanges);
    
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sites = e.target.dataset.sites.split(',');
            const isProductive = e.target.classList.contains('productive');
            addPresetSites(sites, isProductive);
        });
    });
    
    // Site removal (delegated event listeners)
    elements.blockedSitesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('site-remove')) {
            removeBlockedSite(e.target.dataset.site);
        }
    });
    
    elements.productiveSitesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('site-remove')) {
            removeProductiveSite(e.target.dataset.site);
        }
    });
}

// Handle Setting Changes
function handleSettingChange(event) {
    hasUnsavedChanges = true;
    updateUnsavedIndicator();
    
    // Get the setting name from the element
    let settingName = 'Setting';
    if (event && event.target) {
        const element = event.target;
        settingName = element.id || element.name || 'Setting';
        
        // Convert camelCase to readable format
        settingName = settingName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
    
    // Show notification for setting change
    showNotification(`⚙️ ${settingName} changed`, 'info', 1500);
    
    // Apply text size if it changed
    if (event && event.target && event.target.id === 'textSize') {
        applyTextSize(event.target.value);
    }
    
    if (autoSaveEnabled) {
        saveSettings();
    }
}

// Handle Auto Save Change
async function handleAutoSaveChange() {
    autoSaveEnabled = elements.autoSaveEnabled.checked;
    updateAutoSaveIndicator();
    
    // Save the auto-save preference immediately
    await chrome.storage.sync.set({ autoSaveEnabled: autoSaveEnabled });
    
    if (autoSaveEnabled && hasUnsavedChanges) {
        saveSettings();
    }
}

// Toggle Theme
async function toggleTheme() {
    await themeManager.toggleTheme();
    // Update checkbox to match
    elements.darkModeEnabled.checked = themeManager.isDarkTheme();
}

// Apply Theme
function applyTheme() {
    themeManager.applyThemeToDocument();
}

// Apply Text Size
function applyTextSize(size = 'medium') {
    // Remove any existing text size classes
    document.body.className = document.body.className
        .replace(/text-(small|medium|large|extra-large)/g, '');
    
    // Add the new text size class
    document.body.classList.add(`text-${size}`);
    
    console.log('Text size applied:', size);
    console.log('Body classes:', document.body.className);
    console.log('Body font-size:', window.getComputedStyle(document.body).fontSize);
}

// Update Auto Save Indicator
function updateAutoSaveIndicator() {
    if (autoSaveEnabled) {
        elements.autoSaveIndicator.style.display = 'flex';
        elements.saveControls.style.display = 'none';
    } else {
        elements.autoSaveIndicator.style.display = 'none';
        if (hasUnsavedChanges) {
            elements.saveControls.style.display = 'flex';
        }
    }
}

// Update Unsaved Indicator
function updateUnsavedIndicator() {
    if (hasUnsavedChanges && !autoSaveEnabled) {
        elements.unsavedIndicator.style.display = 'flex';
        elements.saveControls.style.display = 'flex';
    } else {
        elements.unsavedIndicator.style.display = 'none';
        if (autoSaveEnabled) {
            elements.saveControls.style.display = 'none';
        }
    }
}

// Add Blocked Site
async function addBlockedSite() {
    const domain = elements.newBlockedSiteInput.value.trim();
    
    if (!domain || !isValidDomain(domain)) {
        showNotification('Please enter a valid domain', 'error');
        return;
    }
    
    try {
        const result = await chrome.storage.sync.get(['blockedSites']);
        const blockedSites = result.blockedSites || [];
        
        if (blockedSites.includes(domain)) {
            showNotification('Site is already blocked', 'warning');
            return;
        }
        
        blockedSites.push(domain);
        await chrome.storage.sync.set({ blockedSites });
        
        elements.newBlockedSiteInput.value = '';
        updateBlockedSitesList(blockedSites);
        showNotification(`🚫 Site blocked: ${domain}`, 'success', 3000);
        
    } catch (error) {
        console.error('Error adding blocked site:', error);
        showNotification('Error adding site', 'error');
    }
}

// Add Productive Site
async function addProductiveSite() {
    const domain = elements.newProductiveSiteInput.value.trim();
    
    if (!domain || !isValidDomain(domain)) {
        showNotification('Please enter a valid domain', 'error');
        return;
    }
    
    try {
        const result = await chrome.storage.sync.get(['productiveSites']);
        const productiveSites = result.productiveSites || [];
        
        if (productiveSites.includes(domain)) {
            showNotification('Site is already in productive list', 'warning');
            return;
        }
        
        productiveSites.push(domain);
        await chrome.storage.sync.set({ productiveSites });
        
        elements.newProductiveSiteInput.value = '';
        updateProductiveSitesList(productiveSites);
        showNotification(`✅ Productive site added: ${domain}`, 'success', 3000);
        
    } catch (error) {
        console.error('Error adding productive site:', error);
        showNotification('Error adding site', 'error');
    }
}

// Remove Blocked Site
async function removeBlockedSite(domain) {
    try {
        const result = await chrome.storage.sync.get(['blockedSites']);
        const blockedSites = result.blockedSites || [];
        const updatedSites = blockedSites.filter(site => site !== domain);
        
        await chrome.storage.sync.set({ blockedSites: updatedSites });
        updateBlockedSitesList(updatedSites);
        showNotification('Site removed from blocked list', 'success');
        
    } catch (error) {
        console.error('Error removing blocked site:', error);
        showNotification('Error removing site', 'error');
    }
}

// Remove Productive Site
async function removeProductiveSite(domain) {
    try {
        const result = await chrome.storage.sync.get(['productiveSites']);
        const productiveSites = result.productiveSites || [];
        const updatedSites = productiveSites.filter(site => site !== domain);
        
        await chrome.storage.sync.set({ productiveSites: updatedSites });
        updateProductiveSitesList(updatedSites);
        showNotification('Site removed from productive list', 'success');
        
    } catch (error) {
        console.error('Error removing productive site:', error);
        showNotification('Error removing site', 'error');
    }
}

// Add Preset Sites
async function addPresetSites(sites, isProductive = false) {
    try {
        const key = isProductive ? 'productiveSites' : 'blockedSites';
        const result = await chrome.storage.sync.get([key]);
        const currentSites = result[key] || [];
        
        const newSites = sites.filter(site => !currentSites.includes(site));
        
        if (newSites.length === 0) {
            showNotification('All sites are already added', 'warning');
            return;
        }
        
        const updatedSites = [...currentSites, ...newSites];
        await chrome.storage.sync.set({ [key]: updatedSites });
        
        if (isProductive) {
            updateProductiveSitesList(updatedSites);
        } else {
            updateBlockedSitesList(updatedSites);
        }
        
        showNotification(`${newSites.length} sites added`, 'success');
        
    } catch (error) {
        console.error('Error adding preset sites:', error);
        showNotification('Error adding sites', 'error');
    }
}

// Import Blocked Sites
function importBlockedSites() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const sites = Array.isArray(data) ? data : data.blockedSites || [];
            
            await chrome.storage.sync.set({ blockedSites: sites });
            updateBlockedSitesList(sites);
            showNotification('Blocked sites imported successfully', 'success');
            
        } catch (error) {
            console.error('Error importing blocked sites:', error);
            showNotification('Error importing sites', 'error');
        }
    };
    input.click();
}

// Export Blocked Sites
async function exportBlockedSites() {
    try {
        const result = await chrome.storage.sync.get(['blockedSites']);
        const blockedSites = result.blockedSites || [];
        
        const data = {
            blockedSites,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'grind-blocked-sites.json';
        a.click();
        
        URL.revokeObjectURL(url);
        showNotification('Blocked sites exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting blocked sites:', error);
        showNotification('Error exporting sites', 'error');
    }
}

// Clear Blocked Sites
async function clearBlockedSites() {
    if (!confirm('Are you sure you want to clear all blocked sites?')) return;
    
    try {
        await chrome.storage.sync.set({ blockedSites: [] });
        updateBlockedSitesList([]);
        showNotification('Blocked sites cleared', 'success');
        
    } catch (error) {
        console.error('Error clearing blocked sites:', error);
        showNotification('Error clearing sites', 'error');
    }
}

// Import Productive Sites
function importProductiveSites() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const sites = Array.isArray(data) ? data : data.productiveSites || [];
            
            await chrome.storage.sync.set({ productiveSites: sites });
            updateProductiveSitesList(sites);
            showNotification('Productive sites imported successfully', 'success');
            
        } catch (error) {
            console.error('Error importing productive sites:', error);
            showNotification('Error importing sites', 'error');
        }
    };
    input.click();
}

// Export Productive Sites
async function exportProductiveSites() {
    try {
        const result = await chrome.storage.sync.get(['productiveSites']);
        const productiveSites = result.productiveSites || [];
        
        const data = {
            productiveSites,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'grind-productive-sites.json';
        a.click();
        
        URL.revokeObjectURL(url);
        showNotification('Productive sites exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting productive sites:', error);
        showNotification('Error exporting sites', 'error');
    }
}

// Clear Productive Sites
async function clearProductiveSites() {
    if (!confirm('Are you sure you want to clear all productive sites?')) return;
    
    try {
        await chrome.storage.sync.set({ productiveSites: [] });
        updateProductiveSitesList([]);
        showNotification('Productive sites cleared', 'success');
        
    } catch (error) {
        console.error('Error clearing productive sites:', error);
        showNotification('Error clearing sites', 'error');
    }
}

// Export All Data
async function exportAllData() {
    try {
        // Add visual feedback
        if (elements.exportAllDataBtn) {
            elements.exportAllDataBtn.style.transform = 'scale(0.95)';
            elements.exportAllDataBtn.textContent = 'EXPORTING...';
            elements.exportAllDataBtn.disabled = true;
        }
        
        showNotification('Starting data export...', 'info', 2000);
        
        console.log('Starting data export...');
        const syncData = await chrome.storage.sync.get();
        const localData = await chrome.storage.local.get();
        
        const data = {
            sync: syncData,
            local: localData,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'grind-extension-data.json';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        showNotification('✅ Data exported successfully! File downloaded.', 'success', 4000);
        console.log('Data export completed');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('❌ Error exporting data: ' + error.message, 'error', 5000);
    } finally {
        // Reset button state
        if (elements.exportAllDataBtn) {
            elements.exportAllDataBtn.style.transform = 'scale(1)';
            elements.exportAllDataBtn.textContent = 'EXPORT DATA';
            elements.exportAllDataBtn.disabled = false;
        }
    }
}

// Import All Data
async function importAllData() {
    const file = elements.importAllDataFile.files[0];
    if (!file) {
        showNotification('⚠️ Please select a file to import', 'warning', 3000);
        return;
    }
    
    try {
        // Add visual feedback
        if (elements.importAllDataBtn) {
            elements.importAllDataBtn.style.transform = 'scale(0.95)';
            elements.importAllDataBtn.textContent = 'IMPORTING...';
            elements.importAllDataBtn.disabled = true;
        }
        
        showNotification('Starting data import...', 'info', 2000);
        
        console.log('Starting data import...');
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.sync) {
            await chrome.storage.sync.set(data.sync);
            console.log('Sync data imported');
        }
        
        if (data.local) {
            await chrome.storage.local.set(data.local);
            console.log('Local data imported');
        }
        
        // Reload settings and statistics
        await loadSettings();
        await loadStatistics();
        
        showNotification('✅ Data imported successfully! Settings and statistics updated.', 'success', 4000);
        console.log('Data import completed');
        
    } catch (error) {
        console.error('Error importing data:', error);
        showNotification('❌ Error importing data: ' + error.message, 'error', 5000);
    } finally {
        // Reset button state
        if (elements.importAllDataBtn) {
            elements.importAllDataBtn.style.transform = 'scale(1)';
            elements.importAllDataBtn.textContent = 'IMPORT DATA';
            elements.importAllDataBtn.disabled = false;
        }
        // Clear file input
        if (elements.importAllDataFile) {
            elements.importAllDataFile.value = '';
        }
    }
}

// Clear All Data
async function clearAllData() {
    if (!confirm('⚠️ Are you sure you want to clear ALL data? This cannot be undone!')) return;
    
    try {
        // Add visual feedback
        if (elements.clearAllDataBtn) {
            elements.clearAllDataBtn.style.transform = 'scale(0.95)';
            elements.clearAllDataBtn.textContent = 'CLEARING...';
            elements.clearAllDataBtn.disabled = true;
        }
        
        showNotification('⚠️ Clearing all data...', 'warning', 2000);
        
        console.log('Starting data clear...');
        await chrome.storage.local.clear();
        await chrome.storage.sync.clear();
        
        // Reset to defaults
        await chrome.storage.sync.set(defaultSettings);
        
        // Reload settings and statistics
        await loadSettings();
        await loadStatistics();
        
        showNotification('✅ All data cleared! Extension reset to defaults.', 'success', 4000);
        console.log('Data clear completed');
        
    } catch (error) {
        console.error('Error clearing data:', error);
        showNotification('❌ Error clearing data: ' + error.message, 'error', 5000);
    } finally {
        // Reset button state
        if (elements.clearAllDataBtn) {
            elements.clearAllDataBtn.style.transform = 'scale(1)';
            elements.clearAllDataBtn.textContent = 'CLEAR ALL DATA';
            elements.clearAllDataBtn.disabled = false;
        }
    }
}

// Reset All Settings
async function resetAllSettings() {
    if (!confirm('⚠️ Are you sure you want to reset all settings to defaults?')) return;
    
    try {
        // Add visual feedback
        if (elements.resetAllSettingsBtn) {
            elements.resetAllSettingsBtn.style.transform = 'scale(0.95)';
            elements.resetAllSettingsBtn.textContent = 'RESETTING...';
            elements.resetAllSettingsBtn.disabled = true;
        }
        
        showNotification('⚠️ Resetting settings to defaults...', 'warning', 2000);
        
        console.log('Starting settings reset...');
        await chrome.storage.sync.set(defaultSettings);
        
        // Reload settings
        await loadSettings();
        
        showNotification('✅ Settings reset to defaults! All preferences restored.', 'success', 4000);
        console.log('Settings reset completed');
        
    } catch (error) {
        console.error('Error resetting settings:', error);
        showNotification('❌ Error resetting settings: ' + error.message, 'error', 5000);
    } finally {
        // Reset button state
        if (elements.resetAllSettingsBtn) {
            elements.resetAllSettingsBtn.style.transform = 'scale(1)';
            elements.resetAllSettingsBtn.textContent = 'RESET SETTINGS';
            elements.resetAllSettingsBtn.disabled = false;
        }
    }
}

// Save Settings
async function saveSettings() {
    try {
        // Collect current settings
        const settings = {
            trackTimeEnabled: elements.trackTimeEnabled.checked,
            notificationsEnabled: elements.notificationsEnabled.checked,
            textSize: elements.textSize.value,
            autoSaveEnabled: elements.autoSaveEnabled.checked,
            
            excludeIncognito: elements.excludeIncognito.checked,
            excludeSystemPages: elements.excludeSystemPages.checked,
            anonymizeData: elements.anonymizeData.checked,
            
            blockingEnabled: elements.blockingEnabled.checked,
            blockingLevel: elements.blockingLevel.value,
            focusSessionDuration: parseInt(elements.focusSessionDuration.value),
            
            dataRetentionPeriod: parseInt(elements.dataRetentionPeriod.value),
            exportFormat: elements.exportFormat.value
        };
        
        await chrome.storage.sync.set(settings);
        currentSettings = { ...currentSettings, ...settings };
        
        hasUnsavedChanges = false;
        updateUnsavedIndicator();
        
        showNotification('Settings saved successfully', 'success');
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('Error saving settings', 'error');
    }
}

// Cancel Changes
function cancelChanges() {
    if (!confirm('Are you sure you want to cancel unsaved changes?')) return;
    
    // Reload settings from storage
    loadSettings();
    
    hasUnsavedChanges = false;
    updateUnsavedIndicator();
    
    showNotification('Changes cancelled', 'info');
}

// Utility Functions
function isValidDomain(domain) {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
}

function showNotification(message, type = 'info', duration = 3000) {
    // Check if notifications are enabled
    chrome.storage.sync.get(['notificationsEnabled']).then(settings => {
        if (settings.notificationsEnabled === false) {
            console.log('Notifications disabled, skipping:', message);
            return;
        }
        
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.grind-notification');
        existingNotifications.forEach(notif => notif.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `grind-notification notification-${type}`;
        
        // Create notification content
        const icon = getNotificationIcon(type);
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${message}</span>
            </div>
            <div class="notification-progress"></div>
        `;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '16px 20px',
            background: getNotificationColor(type, themeManager.isDarkTheme()),
            color: getNotificationTextColor(type, themeManager.isDarkTheme()),
            border: themeManager.isDarkTheme() ? '2px solid rgba(255, 255, 255, 0.2)' : '2px solid rgba(0, 0, 0, 0.2)',
            fontFamily: "'Press Start 2P', 'VT323', monospace",
            fontSize: '12px',
            zIndex: '10000',
            boxShadow: themeManager.isDarkTheme() ? '4px 4px 12px rgba(0, 0, 0, 0.5)' : '4px 4px 12px rgba(0, 0, 0, 0.3)',
            borderRadius: '4px',
            minWidth: '300px',
            maxWidth: '500px',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out'
        });
        
        // Style notification content
        const content = notification.querySelector('.notification-content');
        Object.assign(content.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        });
        
        // Style notification icon
        const iconEl = notification.querySelector('.notification-icon');
        Object.assign(iconEl.style, {
            fontSize: '16px'
        });
        
        // Style progress bar
        const progress = notification.querySelector('.notification-progress');
        Object.assign(progress.style, {
            position: 'absolute',
            bottom: '0',
            left: '0',
            height: '3px',
            background: getNotificationTextColor(type, themeManager.isDarkTheme()),
            width: '100%',
            transform: 'scaleX(1)',
            transformOrigin: 'left',
            transition: 'transform 0.1s linear'
        });
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Animate progress bar
        setTimeout(() => {
            progress.style.transform = 'scaleX(0)';
        }, 100);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    });
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '📢';
    }
}

function getNotificationColor(type, isDarkMode = true) {
    if (isDarkMode) {
        switch (type) {
            case 'success': return '#4ade80';
            case 'error': return '#f87171';
            case 'warning': return '#fbbf24';
            case 'info': return '#60a5fa';
            default: return '#6b7280';
        }
    } else {
        switch (type) {
            case 'success': return '#16a34a';
            case 'error': return '#dc2626';
            case 'warning': return '#d97706';
            case 'info': return '#2563eb';
            default: return '#4b5563';
        }
    }
}

function getNotificationTextColor(type, isDarkMode = true) {
    if (isDarkMode) {
        switch (type) {
            case 'success': return '#052e16';
            case 'error': return '#450a0a';
            case 'warning': return '#451a03';
            case 'info': return '#1e3a8a';
            default: return '#111827';
        }
    } else {
        return '#ffffff';
    }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                // Sync theme changes with checkbox
                if (changes.theme) {
                    const newTheme = changes.theme.newValue || 'dark';
                    elements.darkModeEnabled.checked = (newTheme === 'dark');
                }
                
                // Apply text size changes
                if (changes.textSize) {
                    applyTextSize(changes.textSize.newValue || 'medium');
                }
                
                // Reload settings if they changed externally
                loadSettings();
            } else if (namespace === 'local') {
        // Reload statistics if data changed
        loadStatistics();
    }
});
