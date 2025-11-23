console.log('Grind Extension popup dashboard loaded');

let themeToggle, levelBadge, xpFill, xpText, currentDomain, currentTime, currentVisits;
let galaxyCanvas, starCount, galaxyAge, constellationName, constellationProgress;
let tabsOpened, tabSwitches, totalSessionTime, focusTimer, timerMode, startTimer, pauseTimer, resetTimer;
let recentSitesList, blockedCount, addSiteBtn, challengeText, challengeProgress;
let challengeProgressText, challengeReward, streakValue, levelValue, xpValue;
let optionsBtn, helpBtn;

let currentTheme = 'dark';
let galaxyManager = null;
let focusTimerInterval = null;
let focusSessionData = null;
let userStats = {
    level: 1,
    xp: 0,
    streak: 0,
    totalXP: 0
};
let dailyChallenge = {
    type: 'block_sites',
    target: 5,
    progress: 0,
    reward: 50
};

function initDOMElements() {
    themeToggle = document.getElementById('themeToggle');
    levelBadge = document.getElementById('levelBadge');
    xpFill = document.getElementById('xpFill');
    xpText = document.getElementById('xpText');
    currentDomain = document.getElementById('currentDomain');
    currentTime = document.getElementById('currentTime');
    currentVisits = document.getElementById('currentVisits');
    galaxyCanvas = document.getElementById('galaxyCanvas');
    starCount = document.getElementById('starCount');
    galaxyAge = document.getElementById('galaxyAge');
    constellationName = document.getElementById('constellationName');
    constellationProgress = document.getElementById('constellationProgress');
    tabsOpened = document.getElementById('tabsOpened');
    tabSwitches = document.getElementById('tabSwitches');
    totalSessionTime = document.getElementById('totalSessionTime');
    focusTimer = document.getElementById('focusTimer');
    timerMode = document.getElementById('timerMode');
    startTimer = document.getElementById('startTimer');
    pauseTimer = document.getElementById('pauseTimer');
    resetTimer = document.getElementById('resetTimer');
    recentSitesList = document.getElementById('recentSitesList');
    blockedCount = document.getElementById('blockedCount');
    addSiteBtn = document.getElementById('addSiteBtn');
    challengeText = document.getElementById('challengeText');
    challengeProgress = document.getElementById('challengeProgress');
    challengeProgressText = document.getElementById('challengeProgressText');
    challengeReward = document.getElementById('challengeReward');
    streakValue = document.getElementById('streakValue');
    levelValue = document.getElementById('levelValue');
    xpValue = document.getElementById('xpValue');
    optionsBtn = document.getElementById('optionsBtn');
    helpBtn = document.getElementById('helpBtn');
}

async function initPopup() {
    console.log('Initializing popup dashboard');

    try {
        initDOMElements();

        setupEventListeners();

        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await chrome.storage.sync.get(['theme']);
        currentTheme = result.theme || 'dark';

        const textSizeResult = await chrome.storage.sync.get(['textSize']);
        const textSize = textSizeResult.textSize || 'medium';
        applyTextSize(textSize);

        await loadUserData();
        await loadCurrentTabInfo();
        await loadSessionStats();
        await loadFocusSession();
        await loadRecentSites();
        await loadBlockedSites();
        await loadDailyChallenge();

        try {
            await chrome.runtime.sendMessage({ action: 'checkAllTabsForBlocking' });
            console.log('Triggered immediate blocking check for all tabs');
        } catch (error) {
            console.error('Error triggering blocking check:', error);
        }

        await initGalaxy();

        setTimeout(() => {
            if (galaxyManager) {
                galaxyManager.setupEventListeners();
            }
        }, 100);

        setTimeout(() => {
            setupGalaxyControls();
        }, 500);

        setTimeout(() => {
            testPlanetRenderingWithDurations();
        }, 1000);

        applyTheme();

        startUpdateIntervals();

        console.log('Popup dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing popup:', error);
        if (currentDomain) {
            currentDomain.textContent = 'Error loading data';
        }
    }
}

async function loadUserData() {
    try {
        const result = await chrome.storage.local.get(['userStats', 'dailyChallenge']);

        if (result.userStats) {
            userStats = { ...userStats, ...result.userStats };
        }

        if (result.dailyChallenge) {
            dailyChallenge = { ...dailyChallenge, ...result.dailyChallenge };
        }

        updateUserDisplay();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function loadCurrentTabInfo() {
    try {
        console.log('Loading current tab information...');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Active tab found:', tab ? { id: tab.id, url: tab.url, title: tab.title } : 'No tab');

        if (tab && tab.url) {
            let domain;
            try {
                domain = new URL(tab.url).hostname;
                console.log('Extracted domain:', domain);
            } catch (urlError) {
                console.error('Error parsing URL:', tab.url, urlError);
                domain = 'invalid-url';
            }

            if (currentDomain) {
                currentDomain.textContent = domain;
                console.log('Set current domain display:', domain);
            }

            let websiteStats = null;
            try {
                websiteStats = await chrome.runtime.sendMessage({ action: 'getWebsiteStats' });
                console.log('Website stats received:', websiteStats);
                console.log('Looking for domain:', domain);
            } catch (statsError) {
                console.error('Error getting website stats:', statsError);
                websiteStats = {};
            }

            if (!websiteStats || typeof websiteStats !== 'object') {
                console.warn('Invalid website stats received, using empty object');
                websiteStats = {};
            }

            const siteData = websiteStats[domain];
            console.log('Site data for domain:', siteData);

            if (siteData && typeof siteData === 'object') {
                if (currentTime) {
                    const timeSpent = siteData.timeSpent || 0;
                    if (typeof timeSpent === 'number' && timeSpent >= 0) {
                        const minutes = Math.floor(timeSpent / 60000);
                        const seconds = Math.floor((timeSpent % 60000) / 1000);
                        currentTime.textContent = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
                        console.log('Set time display:', currentTime.textContent);
                    } else {
                        currentTime.textContent = '0s';
                        console.warn('Invalid timeSpent value:', timeSpent);
                    }
                }

                if (currentVisits) {
                    const visits = siteData.visits || 0;
                    if (typeof visits === 'number' && visits >= 0) {
                        currentVisits.textContent = visits.toString();
                        console.log('Set visits display:', visits);
                    } else {
                        currentVisits.textContent = '0';
                        console.warn('Invalid visits value:', visits);
                    }
                }
            } else {
                console.log('No site data found for domain, showing defaults');
                if (currentTime) currentTime.textContent = '0s';
                if (currentVisits) currentVisits.textContent = '0';
            }
        } else {
            console.log('No active tab or invalid tab URL');
            if (currentDomain) currentDomain.textContent = 'No active tab';
            if (currentTime) currentTime.textContent = '0s';
            if (currentVisits) currentVisits.textContent = '0';
        }

        console.log('Current tab info loading completed successfully');
    } catch (error) {
        console.error('Error loading current tab info:', error);
        console.error('Error stack:', error.stack);

        if (currentDomain) currentDomain.textContent = 'Error loading data';
        if (currentTime) currentTime.textContent = '0s';
        if (currentVisits) currentVisits.textContent = '0';

        showPopupNotification('Error loading tab information', 'error', 3000);
    }
}

async function loadSessionStats() {
    try {
        const sessionData = await chrome.runtime.sendMessage({ action: 'getSessionData' });

        tabsOpened.textContent = sessionData.tabsOpened || 0;
        tabSwitches.textContent = sessionData.tabSwitches || 0;
        totalSessionTime.textContent = `${Math.round((sessionData.totalTime || 0) / 60000)}m`;

        updateGalaxy();
    } catch (error) {
        console.error('Error loading session stats:', error);
    }
}

class GalaxyManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.stars = [];
        this.backgroundElements = [];
        this.galaxyCenter = { x: 200, y: 140 };
        this.zoom = 1;
        this.animationId = null;
        this.constellations = {
            'Orion': { required: 7, pattern: 'linear' },
            'Big Dipper': { required: 7, pattern: 'dipper' },
            'Cassiopeia': { required: 5, pattern: 'w' },
            'Pleiades': { required: 9, pattern: 'cluster' }
        };
        this.currentConstellation = 'Orion';
        this.firstSessionDate = null;

        this.generateBackgroundElements();
    }

    async init() {
        this.canvas = document.getElementById('galaxyCanvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.imageSmoothingQuality = 'low';

        await this.loadGalaxyData();
        this.setupEventListeners();
        this.startAnimation();
        this.updateGalaxyStats();
    }

    async loadGalaxyData() {
        try {
            const result = await chrome.storage.local.get(['galaxyData']);
            if (result.galaxyData) {
                this.stars = result.galaxyData.stars || [];
                this.galaxyCenter = result.galaxyData.center || { x: 150, y: 100 };
                this.firstSessionDate = result.galaxyData.firstSessionDate || null;
                this.currentConstellation = result.galaxyData.currentConstellation || 'Orion';
            }
        } catch (error) {
            console.error('Error loading galaxy data:', error);
        }
    }

    async saveGalaxyData() {
        try {
            await chrome.storage.local.set({
                galaxyData: {
                    stars: this.stars,
                    center: this.galaxyCenter,
                    firstSessionDate: this.firstSessionDate,
                    currentConstellation: this.currentConstellation,
                    lastUpdated: Date.now()
                }
            });
        } catch (error) {
            console.error('Error saving galaxy data:', error);
        }
    }

    generateNewStar(sessionDuration, sessionQuality = 'good') {
        const planetType = this.getPlanetType(sessionDuration);
        const uniquePlanet = this.generateUniquePlanet(planetType);

        const star = {
            id: Date.now() + Math.random(),
            x: this.galaxyCenter.x + (Math.random() - 0.5) * 160,
            y: this.galaxyCenter.y + (Math.random() - 0.5) * 120,
            radius: Math.max(72, Math.min(160, Math.floor(sessionDuration * 2.7))),
            planetType: planetType,
            primaryColor: uniquePlanet.primaryColor,
            secondaryColor: uniquePlanet.secondaryColor,
            accentColor: uniquePlanet.accentColor,
            pattern: uniquePlanet.pattern,
            features: uniquePlanet.features,
            textureVariant: uniquePlanet.textureVariant,
            rotation: Math.random() * 360,
            orbitRadius: Math.floor(Math.random() * 120) + 40,
            orbitSpeed: Math.random() * 0.0003 + 0.0001,
            orbitAngle: Math.random() * Math.PI * 2,
            createdAt: Date.now()
        };

        this.stars.push(star);

        if (!this.firstSessionDate) {
            this.firstSessionDate = Date.now();
        }

        this.saveGalaxyData();
        this.updateGalaxyStats();
        this.showStarCreationEffect(star);

        return star;
    }

    getPlanetType(sessionDuration) {
        if (sessionDuration >= 45) return 'ice';
        if (sessionDuration >= 35) return 'gas';
        if (sessionDuration >= 25) return 'earth';
        if (sessionDuration >= 15) return 'rocky';
        return 'asteroid';
    }

    generateUniquePlanet(planetType) {
        const uniqueColors = this.generateUniqueColorPalette(planetType);
        const patterns = this.getPlanetPatterns(planetType);
        const features = this.getPlanetFeatures(planetType);
        const planetSeed = Date.now() + Math.random() * 1000000;

        return {
            primaryColor: uniqueColors.primary,
            secondaryColor: uniqueColors.secondary,
            accentColor: uniqueColors.accent,
            pattern: patterns[Math.floor(Math.random() * patterns.length)],
            features: this.selectRandomFeatures(features, Math.floor(Math.random() * 3) + 1),
            textureVariant: Math.floor(Math.random() * 7),
            planetSeed: planetSeed,
            rotationSpeed: Math.random() * 0.02 + 0.01,
            atmosphere: this.generateAtmosphere(planetType),
            surfaceDetails: this.generateSurfaceDetails(planetType)
        };
    }

    generateAtmosphere(planetType) {
        const atmospheres = {
            asteroid: { density: 0, composition: 'none', weather: 'none' },
            rocky: { density: Math.random() * 0.3, composition: 'thin', weather: 'dust_storms' },
            earth: { density: Math.random() * 0.5 + 0.3, composition: 'nitrogen_oxygen', weather: 'clouds' },
            gas: { density: Math.random() * 0.4 + 0.6, composition: 'hydrogen_helium', weather: 'storms' },
            ice: { density: Math.random() * 0.3 + 0.2, composition: 'methane_nitrogen', weather: 'ice_crystals' }
        };
        return atmospheres[planetType];
    }

    generateSurfaceDetails(planetType) {
        const details = {
            asteroid: { craters: Math.floor(Math.random() * 5) + 1, roughness: Math.random() * 0.8 + 0.2 },
            rocky: { volcanoes: Math.floor(Math.random() * 3), canyons: Math.floor(Math.random() * 4) + 1 },
            earth: { continents: Math.floor(Math.random() * 6) + 2, oceans: Math.floor(Math.random() * 4) + 1 },
            gas: { bands: Math.floor(Math.random() * 8) + 3, storms: Math.floor(Math.random() * 5) + 1 },
            ice: { crystals: Math.floor(Math.random() * 10) + 5, cracks: Math.floor(Math.random() * 6) + 2 }
        };
        return details[planetType];
    }

    generateUniqueColorPalette(planetType) {
        const colorRanges = {
            asteroid: {
                hueRange: [0, 40],
                satRange: [0, 30],
                lightRange: [30, 60]
            },
            rocky: {
                hueRange: [0, 40],
                satRange: [40, 80],
                lightRange: [40, 70]
            },
            earth: {
                hueRange: [180, 240],
                satRange: [50, 90],
                lightRange: [45, 75]
            },
            gas: {
                hueRange: [20, 60],
                satRange: [60, 100],
                lightRange: [50, 80]
            },
            ice: {
                hueRange: [180, 220],
                satRange: [50, 100],
                lightRange: [70, 95]
            }
        };

        const range = colorRanges[planetType];
        const hue = range.hueRange[0] + Math.random() * (range.hueRange[1] - range.hueRange[0]);
        const sat = range.satRange[0] + Math.random() * (range.satRange[1] - range.satRange[0]);
        const light = range.lightRange[0] + Math.random() * (range.lightRange[1] - range.lightRange[0]);

        return {
            primary: `hsl(${hue}, ${sat}%, ${light}%)`,
            secondary: `hsl(${hue + 20}, ${sat - 15}%, ${light - 20}%)`,
            accent: `hsl(${hue - 25}, ${Math.min(sat + 20, 100)}%, ${Math.min(light + 15, 95)})`
        };
    }

    getPlanetPatterns(planetType) {
        const allPatterns = {
            asteroid: [
                'rough_surface',
                'crater_field',
                'irregular_shape',
                'angular_chunks',
                'dusty_surface',
                'metallic_veins',
                'impact_scars',
                'fractured_surface',
                'dust_clouds',
                'irregular_rotation'
            ],
            rocky: [
                'large_craters',
                'volcanic_surface',
                'dust_storms',
                'canyon_systems',
                'polar_caps',
                'impact_basins',
                'mountain_ranges',
                'lava_flows',
                'tectonic_activity',
                'sand_dunes',
                'dry_riverbeds',
                'volcanic_vents'
            ],
            earth: [
                'continents_oceans',
                'island_chains',
                'cloud_bands',
                'polar_ice',
                'tropical_zones',
                'desert_regions',
                'storm_systems',
                'forest_coverage',
                'mountain_chains',
                'river_systems',
                'coastal_regions',
                'seasonal_changes'
            ],
            gas: [
                'horizontal_bands',
                'storm_vortex',
                'ring_system',
                'diagonal_stripes',
                'swirl_patterns',
                'atmospheric_layers',
                'great_red_spot',
                'lightning_storms',
                'aurora_rings',
                'magnetic_field',
                'moon_shadows',
                'atmospheric_waves'
            ],
            ice: [
                'ice_crystals',
                'frozen_surface',
                'crack_patterns',
                'glacier_formations',
                'frost_coverage',
                'ice_caps',
                'crystalline_structure',
                'geysers',
                'subsurface_ocean',
                'frozen_methane',
                'ice_rings',
                'cryovolcanoes'
            ]
        };

        return allPatterns[planetType];
    }

    getPlanetFeatures(planetType) {
        const allFeatures = {
            asteroid: [
                'impact_marks', 'metal_deposits', 'dust_clouds', 'irregular_rotation',
                'metallic_core', 'surface_scars', 'dust_trails', 'angular_fragments',
                'impact_craters', 'metallic_veins', 'surface_roughness', 'dust_coating'
            ],
            rocky: [
                'active_volcano', 'dry_riverbeds', 'sand_dunes', 'tectonic_activity',
                'lava_flows', 'mountain_ranges', 'canyon_systems', 'polar_caps',
                'impact_basins', 'volcanic_vents', 'dust_storms', 'surface_cracks'
            ],
            earth: [
                'aurora', 'city_lights', 'hurricanes', 'seasonal_changes',
                'forest_coverage', 'river_systems', 'coastal_regions', 'mountain_chains',
                'desert_regions', 'tropical_zones', 'polar_ice', 'storm_systems',
                'island_chains', 'cloud_bands', 'continental_drift', 'ocean_currents'
            ],
            gas: [
                'lightning_storms', 'aurora_rings', 'magnetic_field', 'moon_shadows',
                'atmospheric_waves', 'storm_vortex', 'ring_system', 'great_red_spot',
                'horizontal_bands', 'swirl_patterns', 'atmospheric_layers', 'lightning_bolts',
                'magnetic_storms', 'aurora_borealis', 'atmospheric_pressure', 'gas_composition'
            ],
            ice: [
                'geysers', 'subsurface_ocean', 'frozen_methane', 'ice_rings',
                'cryovolcanoes', 'ice_crystals', 'crack_patterns', 'glacier_formations',
                'frost_coverage', 'ice_caps', 'crystalline_structure', 'frozen_surface',
                'ice_storms', 'methane_lakes', 'cryogenic_weather', 'ice_volcanoes'
            ]
        };

        return allFeatures[planetType];
    }

    selectRandomFeatures(features, count) {
        const shuffled = features.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    render() {
        if (!this.ctx) return;

        this.ctx.fillStyle = '#000011';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBackgroundElements();

        this.drawBackgroundStars();

        this.stars.forEach(planet => {
            this.updateStarOrbit(planet);
            this.drawPlanet(planet);
        });

        this.drawGalaxyCenter();
    }

    drawPlanet(planet) {
        const x = Math.floor(planet.x);
        const y = Math.floor(planet.y);
        const radius = Math.floor(planet.radius * this.zoom);

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(planet.rotation * Math.PI / 180);

        switch (planet.planetType) {
            case 'asteroid':
                this.drawSmallAsteroid(planet, radius);
                break;
            case 'rocky':
                this.drawRockyPlanet(planet, radius);
                break;
            case 'earth':
                this.drawEarthPlanet(planet, radius);
                break;
            case 'gas':
                this.drawGasGiant(planet, radius);
                break;
            case 'ice':
                this.drawIcePlanet(planet, radius);
                break;
            default:
                this.drawDefaultPlanet(planet, radius);
        }

        this.ctx.restore();
    }

    drawSmallAsteroid(planet, radius) {
        this.ctx.fillStyle = planet.primaryColor;
        this.drawPixelCircle(0, 0, radius, planet.primaryColor);

        this.ctx.fillStyle = planet.secondaryColor;
        for (let i = 0; i < 3; i++) {
            const tx = (Math.random() - 0.5) * radius;
            const ty = (Math.random() - 0.5) * radius;
            this.ctx.fillRect(tx, ty, 1, 1);
        }

        this.ctx.fillStyle = planet.accentColor;
        this.ctx.fillRect(-radius / 3, radius / 4, 1, 1);
        this.ctx.fillRect(radius / 4, -radius / 3, 1, 1);
    }

    drawRockyPlanet(planet, radius) {
        this.ctx.fillStyle = planet.primaryColor;
        this.drawPixelCircle(0, 0, radius, planet.primaryColor);

        this.ctx.fillStyle = planet.secondaryColor;
        this.drawVolcanicPattern(planet, radius);

        this.ctx.fillStyle = planet.accentColor;
        this.ctx.fillRect(-radius / 2, -radius / 3, radius, 1);
        this.ctx.fillRect(-radius / 3, radius / 3, radius * 2 / 3, 1);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(-radius / 3, -radius, radius * 2 / 3, 2);
        this.ctx.fillRect(-radius / 3, radius - 2, radius * 2 / 3, 2);
    }

    drawEarthPlanet(planet, radius) {
        this.ctx.fillStyle = planet.primaryColor;
        this.drawPixelCircle(0, 0, radius, planet.primaryColor);

        this.ctx.fillStyle = planet.secondaryColor;
        this.drawContinents(planet, radius);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(-radius / 2, -radius / 4, radius, 1);
        this.ctx.fillRect(-radius / 3, radius / 4, radius * 2 / 3, 1);

        this.ctx.fillStyle = '#FFFF00';
        for (let i = 0; i < 2; i++) {
            const lx = (Math.random() - 0.5) * radius;
            const ly = (Math.random() - 0.5) * radius;
            this.ctx.fillRect(lx, ly, 1, 1);
        }
    }

    drawGasGiant(planet, radius) {
        this.ctx.fillStyle = planet.primaryColor;
        this.drawPixelCircle(0, 0, radius, planet.primaryColor);

        this.ctx.fillStyle = planet.secondaryColor;
        this.drawHorizontalBands(planet, radius);

        this.ctx.fillStyle = planet.accentColor;
        this.drawStormVortex(planet, radius);

        this.ctx.fillStyle = planet.accentColor;
        this.ctx.fillRect(-radius - 1, -1, radius * 2 + 2, 1);
        this.ctx.fillRect(-radius - 2, 0, radius * 2 + 4, 1);

        this.ctx.fillStyle = '#FF4500';
        this.ctx.fillRect(-radius / 2, 0, radius / 3, radius / 4);
    }

    drawIcePlanet(planet, radius) {
        this.ctx.fillStyle = planet.primaryColor;
        this.drawPixelCircle(0, 0, radius, planet.primaryColor);

        this.ctx.fillStyle = planet.secondaryColor;
        this.drawIceCrystals(planet, radius);

        this.ctx.fillStyle = planet.accentColor;
        this.ctx.fillRect(-radius / 2, 0, radius, 1);
        this.ctx.fillRect(0, -radius / 2, 1, radius);

        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(-1, -radius / 2, 1, radius / 4);
        this.ctx.fillRect(1, -radius / 3, 1, radius / 5);

        this.ctx.fillStyle = '#B0E0E6';
        this.ctx.fillRect(-radius - 2, -1, radius * 2 + 4, 1);
        this.ctx.fillRect(-radius - 1, 0, radius * 2 + 2, 1);
    }

    drawDefaultPlanet(planet, radius) {
        this.ctx.fillStyle = planet.primaryColor;
        this.drawPixelCircle(0, 0, radius, planet.primaryColor);

        this.ctx.fillStyle = planet.secondaryColor;
        this.ctx.fillRect(-radius / 3, -radius / 3, radius * 2 / 3, 1);
        this.ctx.fillRect(-radius / 3, radius / 3, radius * 2 / 3, 1);
    }

    drawPixelCircle(cx, cy, radius, color) {
        this.ctx.fillStyle = color;

        const patterns = {
            1: [[0, 0]],
            2: [[0, 0], [1, 0], [0, 1], [1, 1]],
            3: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
            4: [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3]],
            5: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [1, 4], [2, 4], [3, 4]],
            6: [[2, 0], [3, 0], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [2, 4], [3, 4], [4, 4], [2, 5], [3, 5]],
            7: [[2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [2, 6], [3, 6], [4, 6]],
            8: [[3, 0], [4, 0], [2, 1], [3, 1], [4, 1], [5, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [2, 6], [3, 6], [4, 6], [5, 6], [3, 7], [4, 7]]
        };

        const pattern = patterns[radius] || this.generateCirclePattern(radius);
        pattern.forEach(([dx, dy]) => {
            this.ctx.fillRect(cx - radius + dx, cy - radius + dy, 1, 1);
        });
    }

    generateCirclePattern(radius) {
        const pattern = [];
        const center = radius;

        for (let y = 0; y < radius * 2; y++) {
            for (let x = 0; x < radius * 2; x++) {
                const dx = x - center;
                const dy = y - center;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= radius && distance > radius - 1) {
                    pattern.push([x, y]);
                }
            }
        }

        return pattern;
    }

    applyPlanetPattern(planet, radius) {
        this.ctx.fillStyle = planet.secondaryColor;

        switch (planet.pattern) {
            case 'horizontal_bands':
                this.drawHorizontalBands(planet, radius);
                break;
            case 'crater_field':
                this.drawCraters(planet, radius);
                break;
            case 'continents_oceans':
                this.drawContinents(planet, radius);
                break;
            case 'storm_vortex':
                this.drawStormVortex(planet, radius);
                break;
            case 'ice_crystals':
                this.drawIceCrystals(planet, radius);
                break;
            case 'volcanic_surface':
                this.drawVolcanic(planet, radius);
                break;
            case 'ring_system':
                this.drawRings(planet, radius);
                break;
            case 'rough_surface':
                this.drawRoughSurface(planet, radius);
                break;
            case 'dust_storms':
                this.drawDustStorms(planet, radius);
                break;
            case 'cloud_bands':
                this.drawCloudBands(planet, radius);
                break;
            case 'swirl_patterns':
                this.drawSwirlPatterns(planet, radius);
                break;
            case 'crack_patterns':
                this.drawCrackPatterns(planet, radius);
                break;
            default:
                this.drawDefaultPattern(planet, radius);
        }
    }

    drawPlanetFeature(feature, planet, radius) {
        this.ctx.fillStyle = planet.accentColor;

        switch (feature) {
            case 'great_red_spot':
                const spotSize = Math.floor(radius / 1.2);
                this.ctx.fillRect(-radius / 2, 0, spotSize, spotSize * 0.75);
                break;
            case 'polar_caps':
                this.ctx.fillStyle = '#FFFFFF';
                const capHeight = Math.floor(radius / 1.5);
                this.ctx.fillRect(-radius / 2, -radius, radius, capHeight);
                this.ctx.fillRect(-radius / 2, radius - capHeight, radius, capHeight);
                break;
            case 'city_lights':
                for (let i = 0; i < 20; i++) {
                    const lx = (Math.random() - 0.5) * radius;
                    const ly = (Math.random() - 0.5) * radius;
                    this.ctx.fillStyle = '#FFFF00';
                    const lightSize = Math.floor(radius / 5) + 4;
                    this.ctx.fillRect(lx, ly, lightSize, lightSize);
                }
                break;
            case 'aurora':
                this.ctx.fillStyle = '#00FF00';
                const auroraThickness = Math.floor(radius / 3) + 4;
                for (let i = 0; i < 8; i++) {
                    this.ctx.fillRect(-radius / 2 + i * 6, -radius / 2, auroraThickness, radius);
                }
                break;
            case 'lightning_storms':
                this.ctx.fillStyle = '#FFFFFF';
                const boltThickness = Math.floor(radius / 4) + 4;
                this.ctx.fillRect(radius / 3, -radius / 2, boltThickness, radius);
                this.ctx.fillRect(radius / 3 + boltThickness, -radius / 3, boltThickness, radius / 2);
                this.ctx.fillRect(radius / 3 + boltThickness * 2, -radius / 4, boltThickness, radius / 3);
                this.ctx.fillRect(radius / 3 + boltThickness * 3, -radius / 5, boltThickness, radius / 4);
                break;
            case 'ice_rings':
            case 'ring_system':
                this.ctx.fillStyle = planet.accentColor;
                const ringThickness = Math.floor(radius / 1.5);
                this.ctx.fillRect(-radius - 16, -ringThickness, radius * 2 + 32, ringThickness);
                this.ctx.fillRect(-radius - 24, 0, radius * 2 + 48, ringThickness);
                this.ctx.fillRect(-radius - 12, ringThickness * 2, radius * 2 + 24, ringThickness / 2);
                this.ctx.fillRect(-radius - 8, -ringThickness * 2, radius * 2 + 16, ringThickness / 3);
                break;
            case 'active_volcano':
                this.ctx.fillStyle = '#FF4500';
                const eruptionSize = Math.floor(radius / 2.5) + 4;
                this.ctx.fillRect(0, radius / 2, eruptionSize, radius / 3);
                this.ctx.fillRect(-eruptionSize / 2, radius / 2 - eruptionSize, eruptionSize, eruptionSize);
                this.ctx.fillRect(-eruptionSize / 4, radius / 2 - eruptionSize * 2, eruptionSize / 2, eruptionSize);
                break;
            case 'geysers':
                this.ctx.fillStyle = '#87CEEB';
                this.ctx.fillRect(-1, -radius / 2, 1, radius / 4);
                this.ctx.fillRect(1, -radius / 3, 1, radius / 5);
                break;
        }
    }

    applyTextureVariant(planet, radius) {
        const variant = planet.textureVariant;

        if (variant === 0) return;

        this.ctx.fillStyle = planet.accentColor;

        for (let i = 0; i < variant; i++) {
            const tx = (Math.random() - 0.5) * radius;
            const ty = (Math.random() - 0.5) * radius;
            this.ctx.fillRect(tx, ty, 1, 1);
        }
    }

    addPlanetGlow(planet, radius) {
        if (radius > 5) {
            this.ctx.fillStyle = planet.primaryColor + 'A0';
            this.drawPixelCircle(0, 0, radius + 12, planet.primaryColor + 'A0');

            this.ctx.fillStyle = planet.primaryColor + '70';
            this.drawPixelCircle(0, 0, radius + 20, planet.primaryColor + '70');

            if (radius > 30) {
                this.ctx.fillStyle = planet.primaryColor + '50';
                this.drawPixelCircle(0, 0, radius + 30, planet.primaryColor + '50');
            }

            if (radius > 60) {
                this.ctx.fillStyle = planet.primaryColor + '30';
                this.drawPixelCircle(0, 0, radius + 40, planet.primaryColor + '30');
            }
        }
    }

    drawHorizontalBands(planet, radius) {
        for (let i = -radius + 16; i < radius - 12; i += 20) {
            this.ctx.fillRect(-radius + 10, i, radius * 2 - 20, 10);
        }
    }

    drawCraters(planet, radius) {
        const craterCount = Math.floor(radius / 2);
        for (let i = 0; i < craterCount; i++) {
            const cx = (Math.random() - 0.5) * radius;
            const cy = (Math.random() - 0.5) * radius;
            const craterSize = Math.floor(radius / 3);
            this.ctx.fillRect(cx, cy, craterSize, craterSize);
        }
    }

    drawContinents(planet, radius) {
        const continentSize = Math.floor(radius * 0.8);
        this.ctx.fillRect(-radius / 2, -radius / 3, continentSize, continentSize / 2);
        this.ctx.fillRect(radius / 4, radius / 4, continentSize / 2, continentSize / 3);
        this.ctx.fillRect(-radius / 3, radius / 5, continentSize / 3, continentSize / 4);
        this.ctx.fillRect(radius / 6, -radius / 4, continentSize / 4, continentSize / 5);
        this.ctx.fillRect(-radius / 5, -radius / 6, continentSize / 5, continentSize / 6);
    }

    drawStormVortex(planet, radius) {
        for (let i = 0; i < radius; i += 10) {
            const angle = i * 0.1;
            const x = Math.cos(angle) * i;
            const y = Math.sin(angle) * i;
            const stormSize = Math.floor(radius / 3) + 4;
            this.ctx.fillRect(x, y, stormSize, stormSize);
        }
    }

    drawIceCrystals(planet, radius) {
        this.ctx.fillStyle = '#FFFFFF';
        const crystalSize = Math.floor(radius / 2) + 4;
        this.ctx.fillRect(-crystalSize, -radius / 2, crystalSize, crystalSize);
        this.ctx.fillRect(crystalSize, radius / 3, crystalSize, crystalSize);
        this.ctx.fillRect(-radius / 3, 0, crystalSize, crystalSize);
        this.ctx.fillRect(radius / 4, -radius / 4, crystalSize, crystalSize);
        this.ctx.fillRect(-radius / 6, radius / 6, crystalSize, crystalSize);
    }

    drawVolcanic(planet, radius) {
        this.ctx.fillStyle = '#FF4500';
        const lavaThickness = Math.floor(radius / 2.5) + 4;
        this.ctx.fillRect(-radius / 2, radius / 2, radius, lavaThickness);
        this.ctx.fillRect(radius / 3, radius / 3, radius / 2, lavaThickness);
        this.ctx.fillRect(-radius / 4, 0, radius / 3, lavaThickness);
        this.ctx.fillRect(radius / 5, -radius / 5, radius / 4, lavaThickness);
    }

    drawVolcanicPattern(planet, radius) {
        this.ctx.fillStyle = '#FF4500';
        this.ctx.fillRect(-radius / 2, radius / 2, radius, 1);
        this.ctx.fillRect(radius / 3, radius / 3, radius / 2, 1);

        this.ctx.fillStyle = '#FF6600';
        this.ctx.fillRect(0, radius / 2, 2, radius / 3);
    }

    drawRings(planet, radius) {
        this.ctx.fillStyle = planet.accentColor;
        this.ctx.fillRect(-radius - 1, -1, radius * 2 + 2, 1);
        this.ctx.fillRect(-radius - 2, 0, radius * 2 + 4, 1);
    }

    drawRoughSurface(planet, radius) {
        for (let i = 0; i < 3; i++) {
            const x = (Math.random() - 0.5) * radius;
            const y = (Math.random() - 0.5) * radius;
            this.ctx.fillRect(x, y, 1, 1);
        }
    }

    drawDustStorms(planet, radius) {
        this.ctx.fillStyle = planet.accentColor;
        this.ctx.fillRect(-radius / 2, -radius / 2, radius, 1);
        this.ctx.fillRect(-radius / 3, radius / 3, radius * 2 / 3, 1);
    }

    drawCloudBands(planet, radius) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(-radius / 2, -radius / 4, radius, 1);
        this.ctx.fillRect(-radius / 3, radius / 4, radius * 2 / 3, 1);
    }

    drawSwirlPatterns(planet, radius) {
        for (let i = 0; i < radius / 2; i += 2) {
            const angle = i * 0.3;
            const x = Math.cos(angle) * i;
            const y = Math.sin(angle) * i;
            this.ctx.fillRect(x, y, 1, 1);
        }
    }

    drawCrackPatterns(planet, radius) {
        this.ctx.fillStyle = '#B0E0E6';
        this.ctx.fillRect(-radius / 2, 0, radius, 1);
        this.ctx.fillRect(0, -radius / 2, 1, radius);
    }

    drawDefaultPattern(planet, radius) {
        this.ctx.fillRect(-radius / 3, -radius / 3, radius * 2 / 3, 1);
        this.ctx.fillRect(-radius / 3, radius / 3, radius * 2 / 3, 1);
    }

    drawBackgroundStars() {
        for (let i = 0; i < 20; i++) {
            const x = (i * 15) % this.canvas.width;
            const y = (i * 23) % this.canvas.height;

            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(x, y, 1, 1);

            if (Math.random() < 0.1) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(x + 1, y, 1, 1);
            }
        }
    }

    generateBackgroundElements() {
        for (let i = 0; i < 8; i++) {
            this.backgroundElements.push({
                type: 'asteroid',
                x: Math.random() * 400,
                y: Math.random() * 280,
                size: Math.floor(Math.random() * 3) + 1,
                speed: Math.random() * 0.8 + 0.2,
                angle: Math.random() * Math.PI * 2,
                rotation: Math.random() * 360,
                color: this.getAsteroidColor(),
                shape: this.getAsteroidShape()
            });
        }

        if (Math.random() < 0.4) {
            this.backgroundElements.push({
                type: 'comet',
                x: -20,
                y: Math.random() * 280,
                size: Math.floor(Math.random() * 2) + 2,
                speed: Math.random() * 1.5 + 1,
                tailLength: Math.floor(Math.random() * 15) + 15,
                color: this.getCometColor(),
                trajectory: Math.random() * Math.PI / 4 - Math.PI / 8
            });
        }

        for (let i = 0; i < 4; i++) {
            this.backgroundElements.push({
                type: 'nebula',
                x: Math.random() * 300,
                y: Math.random() * 280,
                radius: Math.floor(Math.random() * 40) + 25,
                color: this.getNebulaColor(),
                opacity: 0.05 + Math.random() * 0.25,
                shape: this.getNebulaShape(),
                driftSpeed: Math.random() * 0.3 + 0.1
            });
        }

        if (Math.random() < 0.3) {
            for (let i = 0; i < 5; i++) {
                this.backgroundElements.push({
                    type: 'meteor',
                    x: Math.random() * 300,
                    y: -10,
                    size: 1,
                    speed: Math.random() * 2 + 1,
                    angle: Math.random() * Math.PI / 6 + Math.PI / 12,
                    color: '#FF4500',
                    trail: Math.floor(Math.random() * 8) + 5
                });
            }
        }

        for (let i = 0; i < 15; i++) {
            this.backgroundElements.push({
                type: 'dust',
                x: Math.random() * 300,
                y: Math.random() * 280,
                size: 1,
                speed: Math.random() * 0.5 + 0.1,
                angle: Math.random() * Math.PI * 2,
                opacity: Math.random() * 0.3 + 0.1,
                twinkle: Math.random() * 0.02 + 0.01
            });
        }
    }

    getAsteroidColor() {
        const colors = ['#808080', '#A0522D', '#8B4513', '#696969', '#2F4F4F'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getAsteroidShape() {
        const shapes = ['irregular', 'angular', 'rounded', 'fractured'];
        return shapes[Math.floor(Math.random() * shapes.length)];
    }

    getCometColor() {
        const colors = ['#FFFFFF', '#87CEEB', '#B0E0E6', '#F0F8FF'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getNebulaShape() {
        const shapes = ['circular', 'elongated', 'irregular', 'spiral'];
        return shapes[Math.floor(Math.random() * shapes.length)];
    }

    getNebulaColor() {
        const colors = ['#4A0080', '#800080', '#400080', '#6000A0'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    drawBackgroundElements() {
        this.backgroundElements.forEach(element => {
            switch (element.type) {
                case 'asteroid':
                    this.drawDriftingAsteroid(element);
                    break;
                case 'comet':
                    this.drawComet(element);
                    break;
                case 'nebula':
                    this.drawNebula(element);
                    break;
                case 'meteor':
                    this.drawMeteor(element);
                    break;
                case 'dust':
                    this.drawDustParticle(element);
                    break;
            }
        });
    }

    drawDriftingAsteroid(asteroid) {
        this.ctx.fillStyle = asteroid.color;

        switch (asteroid.shape) {
            case 'irregular':
                this.ctx.fillRect(asteroid.x, asteroid.y, asteroid.size, asteroid.size);
                this.ctx.fillRect(asteroid.x + 1, asteroid.y, asteroid.size - 1, asteroid.size - 1);
                break;
            case 'angular':
                this.ctx.fillRect(asteroid.x, asteroid.y, asteroid.size, asteroid.size);
                this.ctx.fillRect(asteroid.x + 1, asteroid.y + 1, asteroid.size - 2, asteroid.size - 2);
                break;
            case 'rounded':
                this.ctx.fillRect(asteroid.x, asteroid.y, asteroid.size, asteroid.size);
                break;
            case 'fractured':
                this.ctx.fillRect(asteroid.x, asteroid.y, asteroid.size, asteroid.size);
                this.ctx.fillRect(asteroid.x + 1, asteroid.y, 1, asteroid.size);
                break;
            default:
                this.ctx.fillRect(asteroid.x, asteroid.y, asteroid.size, asteroid.size);
        }

        asteroid.x += Math.cos(asteroid.angle) * asteroid.speed;
        asteroid.y += Math.sin(asteroid.angle) * asteroid.speed;

        if (asteroid.x > 400) asteroid.x = 0;
        if (asteroid.y > 280) asteroid.y = 0;
        if (asteroid.x < 0) asteroid.x = 400;
        if (asteroid.y < 0) asteroid.y = 280;
    }

    drawMeteor(meteor) {
        this.ctx.fillStyle = meteor.color;
        this.ctx.fillRect(meteor.x, meteor.y, meteor.size, meteor.size);

        this.ctx.fillStyle = '#FF6600';
        for (let i = 1; i <= meteor.trail; i++) {
            this.ctx.fillRect(meteor.x - i, meteor.y, 1, 1);
        }

        meteor.x += Math.cos(meteor.angle) * meteor.speed;
        meteor.y += Math.sin(meteor.angle) * meteor.speed;

        if (meteor.x > 300 || meteor.y > 200) {
            const index = this.backgroundElements.indexOf(meteor);
            if (index > -1) {
                this.backgroundElements.splice(index, 1);
            }
        }
    }

    drawDustParticle(dust) {
        dust.opacity += dust.twinkle;
        if (dust.opacity > 0.4) dust.twinkle = -Math.abs(dust.twinkle);
        if (dust.opacity < 0.1) dust.twinkle = Math.abs(dust.twinkle);

        this.ctx.fillStyle = `rgba(255, 255, 255, ${dust.opacity})`;
        this.ctx.fillRect(dust.x, dust.y, dust.size, dust.size);

        dust.x += Math.cos(dust.angle) * dust.speed;
        dust.y += Math.sin(dust.angle) * dust.speed;

        if (dust.x > 300) dust.x = 0;
        if (dust.y > 200) dust.y = 0;
        if (dust.x < 0) dust.x = 300;
        if (dust.y < 0) dust.y = 200;
    }

    drawComet(comet) {
        this.ctx.fillStyle = comet.color;
        this.ctx.fillRect(comet.x, comet.y, comet.size, comet.size);

        this.ctx.fillStyle = '#87CEEB';
        for (let i = 1; i <= comet.tailLength; i++) {
            const opacity = 1 - (i / comet.tailLength);
            this.ctx.fillStyle = `rgba(135, 206, 235, ${opacity})`;
            this.ctx.fillRect(comet.x - i, comet.y, 1, 1);
        }

        comet.x += Math.cos(comet.trajectory) * comet.speed;
        comet.y += Math.sin(comet.trajectory) * comet.speed;

        if (comet.x > 400) {
            const index = this.backgroundElements.indexOf(comet);
            if (index > -1) {
                this.backgroundElements.splice(index, 1);
            }
        }
    }

    drawNebula(nebula) {
        switch (nebula.shape) {
            case 'circular':
                this.drawCircularNebula(nebula);
                break;
            case 'elongated':
                this.drawElongatedNebula(nebula);
                break;
            case 'irregular':
                this.drawIrregularNebula(nebula);
                break;
            case 'spiral':
                this.drawSpiralNebula(nebula);
                break;
            default:
                this.drawCircularNebula(nebula);
        }

        nebula.x += nebula.driftSpeed;
        if (nebula.x > 300) nebula.x = -nebula.radius;
    }

    drawCircularNebula(nebula) {
        this.ctx.fillStyle = nebula.color + Math.floor(nebula.opacity * 255).toString(16).padStart(2, '0');

        for (let i = 0; i < 3; i++) {
            const offsetX = (Math.random() - 0.5) * 10;
            const offsetY = (Math.random() - 0.5) * 10;
            this.ctx.fillRect(nebula.x + offsetX, nebula.y + offsetY, nebula.radius / 3, nebula.radius / 3);
        }
    }

    drawElongatedNebula(nebula) {
        this.ctx.fillStyle = nebula.color + Math.floor(nebula.opacity * 255).toString(16).padStart(2, '0');

        this.ctx.fillRect(nebula.x, nebula.y, nebula.radius, nebula.radius / 2);
        this.ctx.fillRect(nebula.x + nebula.radius / 2, nebula.y + nebula.radius / 4, nebula.radius / 2, nebula.radius / 4);
    }

    drawIrregularNebula(nebula) {
        this.ctx.fillStyle = nebula.color + Math.floor(nebula.opacity * 255).toString(16).padStart(2, '0');

        this.ctx.fillRect(nebula.x, nebula.y, nebula.radius / 2, nebula.radius);
        this.ctx.fillRect(nebula.x + nebula.radius / 2, nebula.y, nebula.radius / 2, nebula.radius / 2);
        this.ctx.fillRect(nebula.x, nebula.y + nebula.radius / 2, nebula.radius / 3, nebula.radius / 2);
    }

    drawSpiralNebula(nebula) {
        this.ctx.fillStyle = nebula.color + Math.floor(nebula.opacity * 255).toString(16).padStart(2, '0');

        for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2;
            const x = nebula.x + Math.cos(angle) * nebula.radius / 3;
            const y = nebula.y + Math.sin(angle) * nebula.radius / 3;
            this.ctx.fillRect(x, y, nebula.radius / 4, nebula.radius / 4);
        }
    }

    updateStarOrbit(planet) {
        if (planet.orbitRadius && planet.orbitSpeed && planet.orbitAngle !== undefined) {
            planet.orbitAngle += planet.orbitSpeed;

            const centerX = this.galaxyCenter.x;
            const centerY = this.galaxyCenter.y;

            planet.x = centerX + Math.cos(planet.orbitAngle) * planet.orbitRadius;
            planet.y = centerY + Math.sin(planet.orbitAngle) * planet.orbitRadius;

            if (planet.rotation !== undefined) {
                planet.rotation += 0.5;
                if (planet.rotation >= 360) planet.rotation -= 360;
            }
        }
    }

    drawGalaxyCenter() {
        const centerX = Math.floor(this.galaxyCenter.x);
        const centerY = Math.floor(this.galaxyCenter.y);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(centerX - 1, centerY - 1, 3, 3);

        this.ctx.fillStyle = '#ffffff80';
        this.ctx.fillRect(centerX - 2, centerY - 2, 5, 5);
    }

    showStarCreationEffect(star) {
        if (starCount) {
            starCount.style.transform = 'scale(1.2)';
            starCount.style.textShadow = '0 0 20px #00ffff';
            setTimeout(() => {
                starCount.style.transform = 'scale(1)';
                starCount.style.textShadow = '0 0 10px rgba(0, 255, 255, 0.8)';
            }, 500);
        }
    }

    updateGalaxyStats() {
        if (starCount) {
            starCount.textContent = `${this.stars.length} Stars`;
        }

        if (galaxyAge && this.firstSessionDate) {
            const daysSince = Math.floor((Date.now() - this.firstSessionDate) / (1000 * 60 * 60 * 24));
            galaxyAge.textContent = `${daysSince} Days Old`;
        }

        if (constellationName) {
            constellationName.textContent = this.currentConstellation;
        }

        if (constellationProgress) {
            const constellation = this.constellations[this.currentConstellation];
            const completed = Math.min(this.stars.length, constellation.required);
            constellationProgress.textContent = `${completed}/${constellation.required}`;
        }
    }

    setupEventListeners() {
        console.log('Setting up galaxy control event listeners...');

        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetViewBtn = document.getElementById('resetViewBtn');

        console.log('Galaxy control buttons found:', {
            zoomInBtn: !!zoomInBtn,
            zoomOutBtn: !!zoomOutBtn,
            resetViewBtn: !!resetViewBtn
        });

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                console.log('Zoom in clicked, current zoom:', this.zoom);
                this.zoom = Math.min(this.zoom * 1.2, 3);
                console.log('New zoom:', this.zoom);
            });
        } else {
            console.error('Zoom in button not found!');
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                console.log('Zoom out clicked, current zoom:', this.zoom);
                this.zoom = Math.max(this.zoom / 1.2, 0.5);
                console.log('New zoom:', this.zoom);
            });
        } else {
            console.error('Zoom out button not found!');
        }

        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                console.log('Reset view clicked');
                this.zoom = 1;
                this.galaxyCenter = { x: 200, y: 140 };
                console.log('View reset, zoom:', this.zoom, 'center:', this.galaxyCenter);
            });
        } else {
            console.error('Reset view button not found!');
        }

        console.log('Galaxy control event listeners setup complete');
    }

    startAnimation() {
        const animate = () => {
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

async function initGalaxy() {
    try {
        galaxyManager = new GalaxyManager();
        await galaxyManager.init();
        console.log('Galaxy system initialized');

        setTimeout(() => {
            if (galaxyManager) {
                galaxyManager.setupEventListeners();
            }
        }, 200);
    } catch (error) {
        console.error('Error initializing galaxy:', error);
    }
}

function updateGalaxy() {
    if (galaxyManager) {
        galaxyManager.updateGalaxyStats();
    }
}

function setupGalaxyControls() {
    console.log('Setting up galaxy controls manually...');

    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');

    if (zoomInBtn && galaxyManager) {
        zoomInBtn.onclick = () => {
            console.log('Manual zoom in clicked');
            galaxyManager.zoom = Math.min(galaxyManager.zoom * 1.2, 3);
        };
    }

    if (zoomOutBtn && galaxyManager) {
        zoomOutBtn.onclick = () => {
            console.log('Manual zoom out clicked');
            galaxyManager.zoom = Math.max(galaxyManager.zoom / 1.2, 0.5);
        };
    }

    if (resetViewBtn && galaxyManager) {
        resetViewBtn.onclick = () => {
            console.log('Manual reset view clicked');
            galaxyManager.zoom = 1;
            galaxyManager.galaxyCenter = { x: 150, y: 100 };
        };
    }
}

function testPlanetRenderingWithDurations() {
    console.log('=== PLANET RENDERING DURATION TEST ===');

    if (!galaxyManager) {
        console.log('GalaxyManager not initialized');
        return;
    }

    const testDurations = [10, 20, 30, 40, 50];
    const testResults = [];

    testDurations.forEach(duration => {
        console.log(`\nTesting ${duration} minute session:`);

        const planetType = galaxyManager.getPlanetType(duration);
        console.log(`  Duration: ${duration} min -> Planet Type: ${planetType}`);

        const testPlanet = galaxyManager.generateUniquePlanet(planetType);
        testResults.push({
            duration: duration,
            planetType: planetType,
            planet: testPlanet
        });

        console.log(`  Generated planet:`, {
            primaryColor: testPlanet.primaryColor,
            secondaryColor: testPlanet.secondaryColor,
            accentColor: testPlanet.accentColor,
            pattern: testPlanet.pattern,
            features: testPlanet.features,
            textureVariant: testPlanet.textureVariant
        });
    });

    console.log('\nPlanet Type Mapping Verification:');
    console.log('Asteroid (<15 min):', testResults.filter(r => r.planetType === 'asteroid').length);
    console.log('Rocky (15-24 min):', testResults.filter(r => r.planetType === 'rocky').length);
    console.log('Earth (25-34 min):', testResults.filter(r => r.planetType === 'earth').length);
    console.log('Gas (35-44 min):', testResults.filter(r => r.planetType === 'gas').length);
    console.log('Ice (45+ min):', testResults.filter(r => r.planetType === 'ice').length);

    console.log('\nCircular Shape Test:');
    testResults.forEach(result => {
        console.log(`${result.planetType} planet (${result.duration} min):`, {
            hasCircularBase: true,
            hasUniquePattern: !!result.planet.pattern,
            hasFeatures: result.planet.features.length > 0,
            hasTexture: result.planet.textureVariant >= 0
        });
    });

    console.log('\n=== END DURATION TEST ===');

    return testResults;
}

async function loadFocusSession() {
    try {
        const result = await chrome.storage.local.get(['focusSession']);
        focusSessionData = result.focusSession;

        if (focusSessionData && focusSessionData.active) {
            updateFocusTimer();
            if (startTimer) startTimer.disabled = true;
            if (pauseTimer) pauseTimer.disabled = false;
            if (timerMode) timerMode.textContent = 'FOCUS';

            if (!focusTimerInterval) {
                focusTimerInterval = setInterval(updateFocusTimer, 1000);
            }
        } else if (focusSessionData && focusSessionData.pausedTime !== undefined) {
            if (startTimer) startTimer.disabled = false;
            if (pauseTimer) {
                pauseTimer.disabled = false;
                pauseTimer.textContent = 'RESUME';
            }
            if (timerMode) timerMode.textContent = 'PAUSED';

            if (focusTimer && focusSessionData.pausedTime > 0) {
                const minutes = Math.floor(focusSessionData.pausedTime / 60000);
                const seconds = Math.floor((focusSessionData.pausedTime % 60000) / 1000);
                focusTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        } else {
            if (focusTimer) focusTimer.textContent = '00:00';
            if (startTimer) startTimer.disabled = false;
            if (pauseTimer) {
                pauseTimer.disabled = true;
                pauseTimer.textContent = 'PAUSE';
            }
            if (timerMode) timerMode.textContent = 'FOCUS';
        }
    } catch (error) {
        console.error('Error loading focus session:', error);
    }
}

function updateFocusTimer() {
    if (focusSessionData && focusSessionData.active) {
        const now = Date.now();
        const timeLeft = focusSessionData.endTime - now;

        if (timeLeft > 0) {
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            if (focusTimer) {
                focusTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        } else {
            if (focusTimer) focusTimer.textContent = '00:00';
            endFocusSession();
        }
    }
}

async function loadRecentSites() {
    try {
        if (!recentSitesList) {
            console.log('Recent sites list element not found');
            return;
        }

        let websiteStats = {};
        try {
            websiteStats = await chrome.runtime.sendMessage({ action: 'getWebsiteStats' });
            console.log('Website stats received:', websiteStats);
        } catch (error) {
            console.error('Error getting website stats:', error);
            websiteStats = {};
        }

        let timeLimits = {};
        let dailyUsage = {};

        try {
            timeLimits = await chrome.runtime.sendMessage({ action: 'getTimeLimits' });
            console.log('Time limits received:', timeLimits);
        } catch (error) {
            console.error('Error getting time limits:', error);
            timeLimits = {};
        }

        try {
            dailyUsage = await chrome.runtime.sendMessage({ action: 'getDailyUsage' });
            console.log('Daily usage received:', dailyUsage);
        } catch (error) {
            console.error('Error getting daily usage:', error);
            dailyUsage = {};
        }

        if (!websiteStats || typeof websiteStats !== 'object') {
            console.log('No website stats found, showing no sites message');
            recentSitesList.innerHTML = '<div class="no-sites">No recent sites</div>';
            return;
        }

        const safeTimeLimits = timeLimits && typeof timeLimits === 'object' ? timeLimits : {};
        const safeDailyUsage = dailyUsage && typeof dailyUsage === 'object' ? dailyUsage : {};

        console.log('Website stats keys:', Object.keys(websiteStats));

        const allSites = Object.entries(websiteStats)
            .map(([domain, stats]) => ({
                domain,
                timeSpent: stats.timeSpent || 0,
                category: stats.category || 'unknown',
                lastVisit: stats.lastVisit || 0,
                timeLimit: safeTimeLimits[domain] || null,
                dailyTime: safeDailyUsage[domain] || null
            }));

        console.log('All sites before filtering:', allSites);

        const recentSites = allSites
            .filter(site => site.timeSpent > 0)
            .sort((a, b) => b.lastVisit - a.lastVisit)
            .slice(0, 5);

        console.log('Recent sites after filtering:', recentSites);

        recentSitesList.innerHTML = '';

        if (recentSites.length === 0) {
            recentSitesList.innerHTML = '<div class="no-sites">No recent sites</div>';
            return;
        }

        recentSites.forEach(site => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';

            const totalMinutes = Math.round(site.timeSpent / 60000);
            const timeDisplay = totalMinutes > 0 ? `${totalMinutes}m` : '0m';

            const hasTimeLimit = site.timeLimit && site.timeLimit > 0;
            let timeLimitDisplay = '';
            let progressBar = '';

            if (hasTimeLimit) {
                const limitMinutes = Math.round(site.timeLimit / 60);
                const dailyMinutes = site.dailyTime ? Math.round(site.dailyTime.timeToday / 60000) : 0;
                const percentage = Math.min((site.dailyTime ? site.dailyTime.timeToday : 0) / site.timeLimit * 100, 100);

                timeLimitDisplay = `
                    <div class="time-limit-info">
                        <div class="time-limit-text">${dailyMinutes}m / ${limitMinutes}m</div>
                        <div class="time-limit-progress">
                            <div class="time-limit-bar" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                `;
            }

            siteItem.innerHTML = `
                <div class="site-info">
                    <div class="site-domain">${site.domain}</div>
                    <div class="site-details">${timeDisplay} • ${site.category}</div>
                    ${timeLimitDisplay}
                </div>
                <div class="site-actions">
                    ${hasTimeLimit ?
                    `<button class="edit-limit-btn" data-domain="${site.domain}" title="Edit time limit">⚙️</button>` :
                    `<button class="set-limit-btn" data-domain="${site.domain}" title="Set time limit">⏱️</button>`
                }
                    <button class="block-btn" data-domain="${site.domain}">BLOCK</button>
                </div>
            `;

            const blockBtn = siteItem.querySelector('.block-btn');
            const editLimitBtn = siteItem.querySelector('.edit-limit-btn');
            const setLimitBtn = siteItem.querySelector('.set-limit-btn');

            if (blockBtn) {
                blockBtn.addEventListener('click', () => {
                    blockSite(site.domain);
                });
            }

            if (editLimitBtn) {
                editLimitBtn.addEventListener('click', () => {
                    editTimeLimit(site.domain, site.timeLimit);
                });
            }

            if (setLimitBtn) {
                setLimitBtn.addEventListener('click', () => {
                    setTimeLimit(site.domain);
                });
            }

            recentSitesList.appendChild(siteItem);
        });
    } catch (error) {
        console.error('Error loading recent sites:', error);
    }
}

async function loadBlockedSites(retryCount = 0) {
    try {
        console.log(`Loading blocked sites count... (attempt ${retryCount + 1})`);

        if (!blockedCount) {
            console.log('Blocked count element not found');
            return;
        }

        let blockedSites = null;
        try {
            const messagePromise = chrome.runtime.sendMessage({ action: 'getBlockedSites' });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Message timeout')), 2000)
            );

            blockedSites = await Promise.race([messagePromise, timeoutPromise]);
            console.log('Blocked sites received from background:', blockedSites);
        } catch (messageError) {
            console.error('Error getting blocked sites from background:', messageError);

            if (retryCount === 0) {
                console.log('Retrying blocked sites load...');
                await new Promise(resolve => setTimeout(resolve, 500));
                return loadBlockedSites(1);
            }

            try {
                const result = await chrome.storage.sync.get(['blockedSites']);
                blockedSites = result.blockedSites || [];
                console.log('Blocked sites received from storage fallback:', blockedSites);
            } catch (storageError) {
                console.error('Error getting blocked sites from storage:', storageError);
                blockedSites = [];
            }
        }

        const sitesArray = Array.isArray(blockedSites) ? blockedSites : [];
        const count = sitesArray.length;

        blockedCount.textContent = `${count} sites blocked`;
        console.log(`Set blocked sites count: ${count}`);

        if (blockedCount) {
            blockedCount.style.opacity = '1';
            blockedCount.style.color = '';
        }
    } catch (error) {
        console.error('Error loading blocked sites:', error);
        if (blockedCount) {
            blockedCount.textContent = 'Error loading';
            blockedCount.style.color = '#ff0000';
        }
    }
}

async function loadDailyChallenge() {
    try {
        const result = await chrome.storage.local.get(['dailyChallenge']);
        if (result.dailyChallenge) {
            dailyChallenge = result.dailyChallenge;
        }

        updateDailyChallengeDisplay();
    } catch (error) {
        console.error('Error loading daily challenge:', error);
    }
}

function updateDailyChallengeDisplay() {
    challengeText.textContent = `Block ${dailyChallenge.target} distracting sites today`;
    challengeProgress.style.width = `${(dailyChallenge.progress / dailyChallenge.target) * 100}%`;
    challengeProgressText.textContent = `${dailyChallenge.progress}/${dailyChallenge.target}`;
    challengeReward.textContent = `Reward: +${dailyChallenge.reward} XP`;
}

function updateUserDisplay() {
    levelBadge.textContent = `LVL ${userStats.level}`;
    levelValue.textContent = userStats.level;
    streakValue.textContent = `${userStats.streak} days`;
    xpValue.textContent = userStats.xp;

    const xpForNextLevel = userStats.level * 100;
    const xpProgress = (userStats.xp % 100);
    const xpPercentage = (xpProgress / 100) * 100;

    xpFill.style.width = `${xpPercentage}%`;
    xpText.textContent = `${xpProgress}/100 XP`;
}

function setupEventListeners() {
    console.log('Setting up event listeners...');

    if (themeToggle) {
        console.log('Adding theme toggle listener');
        themeToggle.addEventListener('click', toggleTheme);
    } else {
        console.log('Theme toggle button not found');
    }

    if (startTimer) {
        console.log('Adding start timer listener');
        startTimer.addEventListener('click', startFocusTimer);
    } else {
        console.log('Start timer button not found');
    }

    if (pauseTimer) {
        console.log('Adding pause timer listener');
        pauseTimer.addEventListener('click', pauseFocusTimer);
    } else {
        console.log('Pause timer button not found');
    }

    if (resetTimer) {
        console.log('Adding reset timer listener');
        resetTimer.addEventListener('click', resetFocusTimer);
    } else {
        console.log('Reset timer button not found');
    }

    if (addSiteBtn) {
        console.log('Adding add site button listener');
        addSiteBtn.addEventListener('click', openAddSiteDialog);
    } else {
        console.log('Add site button not found');
    }

    if (optionsBtn) {
        console.log('Adding options button listener');
        optionsBtn.addEventListener('click', openOptions);
    } else {
        console.log('Options button not found');
    }

    if (helpBtn) {
        console.log('Adding help button listener');
        helpBtn.addEventListener('click', showHelp);
    } else {
        console.log('Help button not found');
    }

    console.log('Event listeners setup complete');
}

async function toggleTheme() {
    console.log('Theme toggle clicked, current theme:', currentTheme);
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    console.log('New theme:', currentTheme);

    try {
        await chrome.storage.sync.set({ theme: currentTheme });
        applyTheme();
        chrome.runtime.sendMessage({ action: 'setTheme', theme: currentTheme });
        console.log('Theme changed successfully');
    } catch (error) {
        console.error('Error changing theme:', error);
    }
}

function applyTextSize(size = 'medium') {
    document.body.className = document.body.className
        .replace(/text-(small|medium|large|extra-large)/g, '');

    document.body.classList.add(`text-${size}`);

    console.log('Text size applied:', size);
    console.log('Body classes:', document.body.className);
    console.log('Body font-size:', window.getComputedStyle(document.body).fontSize);
}

function applyTheme() {
    const body = document.body;

    if (currentTheme === 'light') {
        body.classList.add('light');
        if (themeToggle) {
            const themeIcon = themeToggle.querySelector('.theme-icon');
            if (themeIcon) themeIcon.textContent = '☀️';
        }
    } else {
        body.classList.remove('light');
        if (themeToggle) {
            const themeIcon = themeToggle.querySelector('.theme-icon');
            if (themeIcon) themeIcon.textContent = '🌙';
        }
    }
}

function showPopupNotification(message, type = 'info', duration = 2000) {
    chrome.storage.sync.get(['notificationsEnabled']).then(settings => {
        if (settings.notificationsEnabled === false) {
            console.log('Notifications disabled, skipping:', message);
            return;
        }

        const existingNotifications = document.querySelectorAll('.popup-notification');
        existingNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = `popup-notification notification-${type}`;

        const icon = getPopupNotificationIcon(type);
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            padding: '8px 12px',
            background: getPopupNotificationColor(type, currentTheme === 'dark'),
            color: getPopupNotificationTextColor(type, currentTheme === 'dark'),
            border: currentTheme === 'dark' ? '2px solid rgba(255, 255, 255, 0.2)' : '2px solid rgba(0, 0, 0, 0.2)',
            fontFamily: "'Press Start 2P', 'VT323', monospace",
            fontSize: '8px',
            zIndex: '10000',
            boxShadow: currentTheme === 'dark' ? '3px 3px 8px rgba(0, 0, 0, 0.5)' : '3px 3px 8px rgba(0, 0, 0, 0.3)',
            borderRadius: '2px',
            minWidth: '200px',
            maxWidth: '300px',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out'
        });

        const content = notification.querySelector('.notification-content');
        Object.assign(content.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

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

function getPopupNotificationIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '📢';
    }
}

function getPopupNotificationColor(type, isDarkMode = true) {
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

function getPopupNotificationTextColor(type, isDarkMode = true) {
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

async function startFocusTimer() {
    try {
        const result = await chrome.storage.local.get(['focusSession']);
        focusSessionData = result.focusSession;

        if (focusSessionData && focusSessionData.pausedTime !== undefined) {
            await resumeFocusTimer();
            return;
        }

        const settings = await chrome.storage.sync.get(['focusSessionDuration']);
        const duration = settings.focusSessionDuration || 25;

        const endTime = Date.now() + (duration * 60 * 1000);

        await chrome.storage.local.set({
            focusSession: {
                active: true,
                startTime: Date.now(),
                duration: duration * 60 * 1000,
                endTime: endTime
            }
        });

        focusSessionData = {
            active: true,
            startTime: Date.now(),
            duration: duration * 60 * 1000,
            endTime: endTime
        };

        if (startTimer) startTimer.disabled = true;
        if (pauseTimer) pauseTimer.disabled = false;
        if (timerMode) timerMode.textContent = 'FOCUS';

        focusTimerInterval = setInterval(updateFocusTimer, 1000);

        chrome.runtime.sendMessage({ action: 'startFocusSession' });
        showPopupNotification('⏰ Focus session started!', 'success', 2000);
        console.log('Focus timer started');
    } catch (error) {
        console.error('Error starting focus timer:', error);
        showPopupNotification('❌ Error starting timer', 'error', 3000);
    }
}

async function pauseFocusTimer() {
    try {
        if (focusSessionData && focusSessionData.active) {
            const timeLeft = focusSessionData.endTime - Date.now();

            await chrome.storage.local.set({
                focusSession: {
                    ...focusSessionData,
                    active: false,
                    pausedTime: timeLeft
                }
            });

            focusSessionData.active = false;
            focusSessionData.pausedTime = timeLeft;

            if (startTimer) startTimer.disabled = false;
            if (pauseTimer) {
                pauseTimer.disabled = false;
                pauseTimer.textContent = 'RESUME';
            }
            if (timerMode) timerMode.textContent = 'PAUSED';

            if (focusTimerInterval) {
                clearInterval(focusTimerInterval);
                focusTimerInterval = null;
            }

            chrome.runtime.sendMessage({ action: 'pauseFocusSession' });
            showPopupNotification('⏸️ Focus session paused', 'info', 2000);
            console.log('Focus timer paused');
        } else if (focusSessionData && focusSessionData.pausedTime !== undefined) {
            await resumeFocusTimer();
        }
    } catch (error) {
        console.error('Error pausing focus timer:', error);
        showPopupNotification('❌ Error pausing timer', 'error', 3000);
    }
}

async function resumeFocusTimer() {
    try {
        if (focusSessionData && focusSessionData.pausedTime !== undefined) {
            const newEndTime = Date.now() + focusSessionData.pausedTime;

            await chrome.storage.local.set({
                focusSession: {
                    ...focusSessionData,
                    active: true,
                    endTime: newEndTime,
                    pausedTime: undefined
                }
            });

            focusSessionData.active = true;
            focusSessionData.endTime = newEndTime;
            focusSessionData.pausedTime = undefined;

            if (startTimer) startTimer.disabled = true;
            if (pauseTimer) {
                pauseTimer.disabled = false;
                pauseTimer.textContent = 'PAUSE';
            }
            if (timerMode) timerMode.textContent = 'FOCUS';

            focusTimerInterval = setInterval(updateFocusTimer, 1000);

            chrome.runtime.sendMessage({ action: 'startFocusSession', isResume: true });
            showPopupNotification('▶️ Focus session resumed', 'success', 2000);
            console.log('Focus timer resumed');
        }
    } catch (error) {
        console.error('Error resuming focus timer:', error);
        showPopupNotification('❌ Error resuming timer', 'error', 3000);
    }
}

async function resetFocusTimer() {
    try {
        await chrome.storage.local.remove(['focusSession']);

        focusSessionData = null;
        if (focusTimer) focusTimer.textContent = '00:00';
        if (startTimer) startTimer.disabled = false;
        if (pauseTimer) pauseTimer.disabled = true;
        if (timerMode) timerMode.textContent = 'FOCUS';

        if (focusTimerInterval) {
            clearInterval(focusTimerInterval);
            focusTimerInterval = null;
        }

        chrome.runtime.sendMessage({ action: 'resetFocusSession' });
    } catch (error) {
        console.error('Error resetting focus timer:', error);
    }
}

async function endFocusSession() {
    try {
        const sessionDuration = focusSessionData ? focusSessionData.duration / 60000 : 25;

        await chrome.storage.local.remove(['focusSession']);

        focusSessionData = null;
        focusTimer.textContent = '00:00';
        startTimer.disabled = false;
        pauseTimer.disabled = true;
        timerMode.textContent = 'COMPLETE';

        if (focusTimerInterval) {
            clearInterval(focusTimerInterval);
            focusTimerInterval = null;
        }

        await awardXP(25);

        if (galaxyManager) {
            const sessionQuality = calculateSessionQuality();
            galaxyManager.generateNewStar(sessionDuration, sessionQuality);
        }

        chrome.runtime.sendMessage({ action: 'endFocusSession' });
    } catch (error) {
        console.error('Error ending focus session:', error);
    }
}

function calculateSessionQuality() {
    const random = Math.random();
    if (random > 0.8) return 'excellent';
    if (random > 0.6) return 'good';
    if (random > 0.3) return 'fair';
    return 'poor';
}

async function blockSite(domain) {
    try {
        console.log(`Attempting to block site: ${domain}`);

        const response = await chrome.runtime.sendMessage({
            action: 'addBlockedSite',
            domain: domain
        });

        if (response && response.success) {
            console.log(`Successfully blocked site: ${domain}`);

            showPopupNotification(`✅ Blocked ${domain}`, 'success', 2000);

            await loadBlockedSites();

            await updateDailyChallengeProgress();

            await loadRecentSites();
        } else {
            console.error('Failed to block site:', response);
            showPopupNotification(`❌ Failed to block ${domain}`, 'error', 3000);
        }
    } catch (error) {
        console.error('Error blocking site:', error);
        showPopupNotification(`❌ Error blocking ${domain}`, 'error', 3000);
    }
}

async function updateDailyChallengeProgress() {
    try {
        if (dailyChallenge.type === 'block_sites') {
            dailyChallenge.progress += 1;

            await chrome.storage.local.set({ dailyChallenge });
            updateDailyChallengeDisplay();

            if (dailyChallenge.progress >= dailyChallenge.target) {
                await awardXP(dailyChallenge.reward);
                await generateNewDailyChallenge();
            }
        }
    } catch (error) {
        console.error('Error updating daily challenge:', error);
    }
}

async function awardXP(amount) {
    try {
        userStats.xp += amount;
        userStats.totalXP += amount;

        const newLevel = Math.floor(userStats.totalXP / 100) + 1;
        if (newLevel > userStats.level) {
            userStats.level = newLevel;
        }

        await chrome.storage.local.set({ userStats });
        updateUserDisplay();

        console.log(`Awarded ${amount} XP`);
    } catch (error) {
        console.error('Error awarding XP:', error);
    }
}

async function generateNewDailyChallenge() {
    try {
        const challenges = [
            { type: 'block_sites', target: 5, reward: 50 },
            { type: 'focus_sessions', target: 3, reward: 75 },
            { type: 'productive_time', target: 120, reward: 100 }
        ];

        const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
        dailyChallenge = {
            ...randomChallenge,
            progress: 0
        };

        await chrome.storage.local.set({ dailyChallenge });
        updateDailyChallengeDisplay();
    } catch (error) {
        console.error('Error generating new challenge:', error);
    }
}

function openAddSiteDialog() {
    const domain = prompt('Enter domain to block (e.g., facebook.com):');
    if (domain && domain.trim()) {
        blockSite(domain.trim().toLowerCase());
    }
}

async function setTimeLimit(domain) {
    const minutes = prompt(`Set daily time limit for ${domain} (in minutes, 5-480):`);
    if (minutes && !isNaN(minutes)) {
        const limitMinutes = parseInt(minutes);
        if (limitMinutes >= 5 && limitMinutes <= 480) {
            const limitSeconds = limitMinutes * 60;

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'setTimeLimit',
                    domain: domain,
                    limitInSeconds: limitSeconds
                });

                if (response && response.success) {
                    showPopupNotification(`✅ Time limit set: ${limitMinutes}m for ${domain}`, 'success', 2000);
                    await loadRecentSites();
                } else {
                    showPopupNotification(`❌ Failed to set time limit for ${domain}`, 'error', 3000);
                }
            } catch (error) {
                console.error('Error setting time limit:', error);
                showPopupNotification(`❌ Error setting time limit for ${domain}`, 'error', 3000);
            }
        } else {
            showPopupNotification('❌ Time limit must be between 5 and 480 minutes', 'error', 3000);
        }
    }
}

async function editTimeLimit(domain, currentLimit) {
    const currentMinutes = Math.round(currentLimit / 60);
    const minutes = prompt(`Edit daily time limit for ${domain} (current: ${currentMinutes}m, enter 5-480):`);
    if (minutes && !isNaN(minutes)) {
        const limitMinutes = parseInt(minutes);
        if (limitMinutes >= 5 && limitMinutes <= 480) {
            const limitSeconds = limitMinutes * 60;

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'setTimeLimit',
                    domain: domain,
                    limitInSeconds: limitSeconds
                });

                if (response && response.success) {
                    showPopupNotification(`✅ Time limit updated: ${limitMinutes}m for ${domain}`, 'success', 2000);
                    await loadRecentSites();
                } else {
                    showPopupNotification(`❌ Failed to update time limit for ${domain}`, 'error', 3000);
                }
            } catch (error) {
                console.error('Error updating time limit:', error);
                showPopupNotification(`❌ Error updating time limit for ${domain}`, 'error', 3000);
            }
        } else {
            showPopupNotification('❌ Time limit must be between 5 and 480 minutes', 'error', 3000);
        }
    }
}

async function updateTimeChart() {
    try {
        console.log('Updating time chart and session statistics...');

        await loadSessionStats();

        updateGalaxy();

        console.log('Time chart updated successfully');
    } catch (error) {
        console.error('Error updating time chart:', error);
    }
}

function startUpdateIntervals() {
    setInterval(() => {
        if (focusSessionData && focusSessionData.active) {
            updateFocusTimer();
        }
    }, 1000);

    setInterval(async () => {
        try {
            await loadCurrentTabInfo();
        } catch (error) {
            console.error('Error refreshing current tab info:', error);
        }
    }, 2500);

    setInterval(async () => {
        try {
            await loadRecentSites();
        } catch (error) {
            console.error('Error refreshing recent sites:', error);
        }
    }, 7000);

    setInterval(updateTimeChart, 30000);
}

function openOptions() {
    chrome.runtime.openOptionsPage();
}

function showHelp() {
    alert('Grind Extension Dashboard Help:\n\n' +
        '• View your productivity score and time distribution\n' +
        '• Start focus sessions with the timer\n' +
        '• Block distracting sites from recent sites list\n' +
        '• Complete daily challenges for XP rewards\n' +
        '• Track your level, streak, and achievements\n' +
        '• Toggle theme with the moon/sun button');
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('Storage changed:', namespace, changes);

    if (namespace === 'sync') {
        if (changes.theme) {
            currentTheme = changes.theme.newValue || 'dark';
            applyTheme();
        }

        if (changes.textSize) {
            applyTextSize(changes.textSize.newValue || 'medium');
        }

        if (changes.blockedSites) {
            console.log('Blocked sites changed:', changes.blockedSites);
            loadBlockedSites();
        }

        if (changes.blockingEnabled) {
            console.log('Blocking enabled changed:', changes.blockingEnabled);
            loadBlockedSites();
        }
    } else if (namespace === 'local') {
        if (changes.userStats) {
            userStats = changes.userStats.newValue;
            updateUserDisplay();
        }

        if (changes.dailyChallenge) {
            dailyChallenge = changes.dailyChallenge.newValue;
            updateDailyChallengeDisplay();
        }

        if (changes.focusSession) {
            focusSessionData = changes.focusSession.newValue;
            if (focusSessionData && focusSessionData.active) {
                updateFocusTimer();
                if (startTimer) startTimer.disabled = true;
                if (pauseTimer) pauseTimer.disabled = false;
                if (timerMode) timerMode.textContent = 'FOCUS';

                if (!focusTimerInterval) {
                    focusTimerInterval = setInterval(updateFocusTimer, 1000);
                }
            } else if (focusSessionData && focusSessionData.pausedTime !== undefined) {
                if (startTimer) startTimer.disabled = false;
                if (pauseTimer) {
                    pauseTimer.disabled = false;
                    pauseTimer.textContent = 'RESUME';
                }
                if (timerMode) timerMode.textContent = 'PAUSED';

                if (focusTimerInterval) {
                    clearInterval(focusTimerInterval);
                    focusTimerInterval = null;
                }

                if (focusTimer && focusSessionData.pausedTime > 0) {
                    const minutes = Math.floor(focusSessionData.pausedTime / 60000);
                    const seconds = Math.floor((focusSessionData.pausedTime % 60000) / 1000);
                    focusTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            } else {
                if (startTimer) startTimer.disabled = false;
                if (pauseTimer) {
                    pauseTimer.disabled = true;
                    pauseTimer.textContent = 'PAUSE';
                }
                if (timerMode) timerMode.textContent = 'FOCUS';
                if (focusTimer) focusTimer.textContent = '00:00';

                if (focusTimerInterval) {
                    clearInterval(focusTimerInterval);
                    focusTimerInterval = null;
                }
            }
        }
    }
});

function testBasicFunctionality() {
    console.log('Testing basic functionality...');

    console.log('DOM Elements:', {
        themeToggle: !!themeToggle,
        startTimer: !!startTimer,
        pauseTimer: !!pauseTimer,
        resetTimer: !!resetTimer,
        addSiteBtn: !!addSiteBtn,
        optionsBtn: !!optionsBtn,
        helpBtn: !!helpBtn
    });

    if (themeToggle) {
        console.log('Theme toggle button found');
    }

    if (startTimer) {
        console.log('Start timer button found');
    }

    console.log('Basic functionality test complete');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        testBasicFunctionality();
        initPopup();
    });
} else {
    testBasicFunctionality();
    initPopup();
}
