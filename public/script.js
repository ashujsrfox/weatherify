// Weather and geocoding go through same-origin `/api/*` proxy (see server.js). No API key in the browser.
const API_BASE = '/api';
const DEFAULT_CITY = 'New Delhi';

let currentUnit = 'C';
let rawData = { current: null, forecast: null, airQuality: null };
let currentLang = localStorage.getItem('weatherify-lang') || 'en';
let currentTheme = localStorage.getItem('weatherify-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

let currentCityQuery = '';
let currentCityLabel = '';
let recentSearches = [];
let favoriteCities = [];

const STORAGE_RECENT = 'weatherify-recent-cities';
const STORAGE_FAVORITES = 'weatherify-favorite-cities';
const MAX_RECENT_SEARCHES = 8;

// DOM Components references
let appHeader, appSearch, mainWeather, dailyForecast, weatherMapComponent, weatherContainer, spinnerLoading;

function getShiftedDate(unixSeconds, timezoneOffsetSeconds) {
    return new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
}

// i18n
function applyTheme(theme) {
    currentTheme = theme;
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark-mode', isDark);
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('weatherify-theme', theme);
    if (appHeader) appHeader.setAttribute('theme', theme);
}

function initUnitDisplay() {
    if (appHeader) appHeader.setAttribute('unit', currentUnit);
}

function toUnit(kelvin) {
    const DEGREE = '\u00B0';
    if (currentUnit === 'C') return `${Math.round(kelvin - 273.15)}${DEGREE}C`;
    if (currentUnit === 'F') return `${Math.round((kelvin - 273.15) * 9 / 5 + 32)}${DEGREE}F`;
    return `${Math.round(kelvin)}K`;
}

function toUnitNum(kelvin) {
    if (currentUnit === 'C') return Math.round(kelvin - 273.15);
    if (currentUnit === 'F') return Math.round((kelvin - 273.15) * 9 / 5 + 32);
    return Math.round(kelvin);
}

function unitLabel() {
    const DEGREE = '\u00B0';
    if (currentUnit === 'C') return `${DEGREE}C`;
    if (currentUnit === 'F') return `${DEGREE}F`;
    return 'K';
}

function normalizeCityKey(city) {
    return city.trim().toLowerCase();
}

function loadHistoryArray(key) {
    try {
        const stored = localStorage.getItem(key);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveHistoryArray(key, entries) {
    localStorage.setItem(key, JSON.stringify(entries));
}

function initHistory() {
    recentSearches = loadHistoryArray(STORAGE_RECENT);
    favoriteCities = loadHistoryArray(STORAGE_FAVORITES);

    if (appSearch) {
        appSearch.favorites = favoriteCities;
        appSearch.recent = recentSearches;
    }
}

function updateFavoriteButton() {
    if (!mainWeather) return;
    const isFav = favoriteCities.some((item) => normalizeCityKey(item.query) === normalizeCityKey(currentCityQuery));
    if (isFav) {
        mainWeather.setAttribute('is-favorite', '');
    } else {
        mainWeather.removeAttribute('is-favorite');
    }
}

function createCityEntry(data) {
    const label = `${data.name}, ${data.sys.country}`;
    const query = `${data.name},${data.sys.country}`;
    return { query, label };
}

function addRecentSearch(entry) {
    if (!entry || !entry.query) return;

    const normalized = normalizeCityKey(entry.query);
    recentSearches = recentSearches.filter((item) => normalizeCityKey(item.query) !== normalized);
    recentSearches.unshift(entry);

    if (recentSearches.length > MAX_RECENT_SEARCHES) {
        recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
    }

    saveHistoryArray(STORAGE_RECENT, recentSearches);
    if (appSearch) appSearch.recent = recentSearches;
}

function toggleFavoriteCity(entry) {
    if (!entry || !entry.query) return;

    const normalized = normalizeCityKey(entry.query);
    const existsIndex = favoriteCities.findIndex((item) => normalizeCityKey(item.query) === normalized);

    if (existsIndex > -1) {
        favoriteCities.splice(existsIndex, 1);
    } else {
        favoriteCities.push(entry);
    }

    saveHistoryArray(STORAGE_FAVORITES, favoriteCities);
    if (appSearch) appSearch.favorites = favoriteCities;
    updateFavoriteButton();
}

function clearRecentHistory() {
    recentSearches = [];
    saveHistoryArray(STORAGE_RECENT, recentSearches);
    if (appSearch) appSearch.recent = recentSearches;
}

function setCurrentCity(data) {
    currentCityLabel = `${data.name}, ${data.sys.country}`;
    currentCityQuery = `${data.name},${data.sys.country}`;
    updateFavoriteButton();
    updateUrlParams(currentCityQuery, currentUnit);
    addRecentSearch({ query: currentCityQuery, label: currentCityLabel });
    
    // update search input value
    if (appSearch) appSearch.setInputValue(currentCityLabel);
}

function updateUrlParams(city, units, replaceState = true) {
    try {
        const url = new URL(window.location.href);
        if (city) {
            url.searchParams.set('city', city);
        } else {
            url.searchParams.delete('city');
        }
        if (units) {
            url.searchParams.set('units', units);
        } else {
            url.searchParams.delete('units');
        }
        if (replaceState) {
            window.history.replaceState({}, '', url);
        }
    } catch {
        // ignore
    }
}

function setCurrentUnit(unit) {
    if (!['C', 'F', 'K'].includes(unit)) return;
    currentUnit = unit;
    if (appHeader) appHeader.setAttribute('unit', unit);
    updateUrlParams(currentCityQuery || undefined, currentUnit);
    if (rawData.current) {
        if (mainWeather) {
            mainWeather.setAttribute('unit', unit);
            mainWeather.setWeatherData(rawData.current, rawData.airQuality, currentUnit, currentLang, isFavorite(currentCityQuery));
        }
        if (dailyForecast) {
            dailyForecast.setAttribute('unit', unit);
            dailyForecast.forecastData = rawData.forecast;
        }
    }
}

function isFavorite(cityQuery) {
    return favoriteCities.some((item) => normalizeCityKey(item.query) === normalizeCityKey(cityQuery));
}

// Dynamic backgrounds based on weather type
function updateDynamicBackground(data) {
    const body = document.body;
    const weatherType = (data.weather?.[0]?.main || '').toLowerCase();
    const isNight = data.weather?.[0]?.icon?.includes('n');
    const themeClasses = [
        'theme-clear-day', 'theme-clear-night', 'theme-clouds', 'theme-rain',
        'theme-drizzle', 'theme-thunderstorm', 'theme-snow', 'theme-mist',
        'theme-fog', 'theme-haze'
    ];

    body.classList.remove(...themeClasses);

    if (weatherType === 'clear') body.classList.add(isNight ? 'theme-clear-night' : 'theme-clear-day');
    else if (weatherType === 'clouds') body.classList.add('theme-clouds');
    else if (weatherType === 'rain') body.classList.add('theme-rain');
    else if (weatherType === 'drizzle') body.classList.add('theme-drizzle');
    else if (weatherType === 'thunderstorm') body.classList.add('theme-thunderstorm');
    else if (weatherType === 'snow') body.classList.add('theme-snow');
    else if (['mist', 'fog', 'haze', 'smoke'].includes(weatherType)) body.classList.add('theme-mist');
    else body.classList.add(isNight ? 'theme-clear-night' : 'theme-clear-day');
}

function setWeatherBackground(condition) {
    const body = document.body;
    switch (condition.toLowerCase()) {
        case "clear":
            body.style.background = "linear-gradient(to right, #f7b267, #f77f00)";
            break;
        case "clouds":
            body.style.background = "linear-gradient(to right, #bdc3c7, #2c3e50)";
            break;
        case "rain":
            body.style.background = "linear-gradient(to right, #3a7bd5, #3a6073)";
            break;
        case "drizzle":
            body.style.background = "linear-gradient(to right, #89f7fe, #66a6ff)";
            break;
        case "snow":
            body.style.background = "linear-gradient(to right, #e6dada, #274046)";
            break;
        case "thunderstorm":
            body.style.background = "linear-gradient(to right, #141e30, #243b55)";
            break;
        default:
            body.style.background = "linear-gradient(to right, #89f7fe, #66a6ff)";
    }
}

function showLoading() {
    if (appSearch) appSearch.setAttribute('loading', '');
    if (spinnerLoading) spinnerLoading.classList.remove('hidden');
}

function hideLoading() {
    if (appSearch) appSearch.removeAttribute('loading');
    if (spinnerLoading) spinnerLoading.classList.add('hidden');
}

function showWeather() {
    if (weatherContainer) weatherContainer.classList.remove('hidden');
    if (appSearch) appSearch.removeAttribute('welcome');
}

function hideWeather() {
    if (weatherContainer) weatherContainer.classList.add('hidden');
    if (appSearch) appSearch.setAttribute('welcome', '');
}

function showError(message) {
    if (appSearch) {
        appSearch.setAttribute('error', message || 'City not found. Please check spelling and try again.');
    }
}

function hideError() {
    if (appSearch) {
        appSearch.removeAttribute('error');
    }
}

async function fetchAirQualityByCoords(lat, lon) {
    const url = `${API_BASE}/air-quality?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Air quality fetch failed: ${response.status}`);
    }
    return response.json();
}

async function fetchWeatherByCoords(lat, lon) {
    showLoading();
    hideError();
    hideWeather();

    try {
        const currentUrl = `${API_BASE}/weather?lat=${lat}&lon=${lon}&lang=${currentLang}`;
        const forecastUrl = `${API_BASE}/forecast?lat=${lat}&lon=${lon}&lang=${currentLang}`;

        const [currentRes, forecastRes] = await Promise.all([
            fetch(currentUrl),
            fetch(forecastUrl)
        ]);

        if (!currentRes.ok || !forecastRes.ok) {
            throw new Error('Coordinate geocoding weather lookup failed');
        }

        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        let aqiData = null;
        try {
            aqiData = await fetchAirQualityByCoords(lat, lon);
        } catch (e) {
            console.warn('AQI fetch failed:', e);
        }

        rawData = { current: currentData, forecast: forecastData, airQuality: aqiData };

        setCurrentCity(currentData);
        updateDynamicBackground(currentData);
        setWeatherBackground(currentData.weather[0].main);

        if (mainWeather) {
            mainWeather.setAttribute('unit', currentUnit);
            mainWeather.setWeatherData(currentData, aqiData, currentUnit, currentLang, isFavorite(currentCityQuery));
        }

        if (dailyForecast) {
            dailyForecast.setAttribute('unit', currentUnit);
            dailyForecast.forecastData = forecastData;
        }

        if (weatherMapComponent) {
            weatherMapComponent.setMapCoords(lat, lon, currentData.name);
        }

        showWeather();
    } catch (err) {
        console.error(err);
        showError(currentLang === 'hi' ? 'मौसम का डेटा प्राप्त करने में विफल।' : 'Failed to retrieve weather data.');
    } finally {
        hideLoading();
    }
}

async function fetchWeatherData(city) {
    if (!city) return;
    
    showLoading();
    hideError();
    hideWeather();

    try {
        const currentUrl = `${API_BASE}/weather?q=${encodeURIComponent(city)}&lang=${currentLang}`;
        const forecastUrl = `${API_BASE}/forecast?q=${encodeURIComponent(city)}&lang=${currentLang}`;

        const [currentRes, forecastRes] = await Promise.all([
            fetch(currentUrl),
            fetch(forecastUrl)
        ]);

        if (!currentRes.ok) {
            const errorData = await currentRes.json().catch(() => null);
            throw new Error(errorData?.message || 'City not found');
        }
        if (!forecastRes.ok) {
            throw new Error('Forecast fetch failed');
        }

        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        let aqiData = null;
        try {
            aqiData = await fetchAirQualityByCoords(currentData.coord.lat, currentData.coord.lon);
        } catch (e) {
            console.warn('AQI fetch failed:', e);
        }

        rawData = { current: currentData, forecast: forecastData, airQuality: aqiData };

        setCurrentCity(currentData);
        updateDynamicBackground(currentData);
        setWeatherBackground(currentData.weather[0].main);

        if (mainWeather) {
            mainWeather.setAttribute('unit', currentUnit);
            mainWeather.setWeatherData(currentData, aqiData, currentUnit, currentLang, isFavorite(currentCityQuery));
        }

        if (dailyForecast) {
            dailyForecast.setAttribute('unit', currentUnit);
            dailyForecast.forecastData = forecastData;
        }

        if (weatherMapComponent) {
            weatherMapComponent.setMapCoords(currentData.coord.lat, currentData.coord.lon, currentData.name);
        }

        showWeather();
    } catch (err) {
        console.error(err);
        showError(currentLang === 'hi' ? 'शहर नहीं मिला। कृपया पुनः प्रयास करें।' : 'City not found. Please try again.');
    } finally {
        hideLoading();
    }
}

function getLocationErrorMessage(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return currentLang === 'hi' ? 'उपयोगकर्ता ने स्थान का अनुरोध अस्वीकार कर दिया।' : 'User denied the request for Geolocation.';
        case error.POSITION_UNAVAILABLE:
            return currentLang === 'hi' ? 'स्थान की जानकारी अनुपलब्ध है।' : 'Location information is unavailable.';
        case error.TIMEOUT:
            return currentLang === 'hi' ? 'स्थान प्राप्त करने का समय समाप्त हो गया।' : 'The request to get user location timed out.';
        default:
            return currentLang === 'hi' ? 'एक अज्ञात त्रुटि हुई।' : 'An unknown error occurred.';
    }
}

async function requestWeatherFromMyLocation() {
    if (!navigator.geolocation) {
        showError(currentLang === 'hi' ? 'आपके ब्राउज़र द्वारा जियोलोकेशन समर्थित नहीं है।' : 'Geolocation is not supported by your browser.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            await fetchWeatherByCoords(latitude, longitude);
        },
        (error) => {
            console.warn('[Geolocation] Error:', error);
            showError(getLocationErrorMessage(error));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
}

// Wire components together using CustomEvents
function setupComponentListeners() {
    // 1. Language change
    appHeader.addEventListener('lang-change', (e) => {
        currentLang = e.detail.lang;
        localStorage.setItem('weatherify-lang', currentLang);
        
        // Propagate to other components
        [appHeader, appSearch, mainWeather, dailyForecast, weatherMapComponent].forEach(el => {
            if (el) el.setAttribute('lang', currentLang);
        });

        if (currentCityQuery) {
            fetchWeatherData(currentCityQuery);
        } else {
            fetchWeatherData(DEFAULT_CITY);
        }
    });

    // 2. Theme change
    appHeader.addEventListener('theme-change', (e) => {
        applyTheme(e.detail.theme);
    });

    // 3. Unit change
    appHeader.addEventListener('unit-change', (e) => {
        setCurrentUnit(e.detail.unit);
    });

    // 4. City selection from search suggestion or history
    appSearch.addEventListener('city-select', (e) => {
        fetchWeatherData(e.detail.city);
    });

    // 5. Use My Location button clicked
    appSearch.addEventListener('location-request', () => {
        requestWeatherFromMyLocation();
    });

    // 6. Clear history clicked
    appSearch.addEventListener('clear-history', () => {
        clearRecentHistory();
    });

    // 7. Favorite toggle inside weather detail card
    mainWeather.addEventListener('toggle-favorite', (e) => {
        toggleFavoriteCity({ query: e.detail.query, label: e.detail.label });
    });
}

// Initial startup
window.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
            console.error('Service Worker registration failed:', err);
        });
    }

    // Resolve component elements
    appHeader = document.getElementById('app-header');
    appSearch = document.getElementById('app-search');
    mainWeather = document.getElementById('main-weather');
    dailyForecast = document.getElementById('daily-forecast');
    weatherMapComponent = document.getElementById('weather-map-component');
    weatherContainer = document.getElementById('weather-container');
    spinnerLoading = document.getElementById('spinner-loading');

    // Initialize themes, history, units
    applyTheme(currentTheme);
    initHistory();
    initUnitDisplay();

    // Propagate initial states to components
    [appHeader, appSearch, mainWeather, dailyForecast, weatherMapComponent].forEach(el => {
        if (el) el.setAttribute('lang', currentLang);
    });
    if (appHeader) appHeader.setAttribute('theme', currentTheme);
    if (appHeader) appHeader.setAttribute('unit', currentUnit);
    if (mainWeather) mainWeather.setAttribute('unit', currentUnit);
    if (dailyForecast) dailyForecast.setAttribute('unit', currentUnit);

    // Setup component observers and listeners
    setupComponentListeners();

    // Load initial weather
    const params = new URLSearchParams(window.location.search);
    const sharedUnits = params.get('units')?.toUpperCase();
    const sharedCity = params.get('city');

    if (sharedUnits) {
        setCurrentUnit(sharedUnits);
    }

    if (sharedCity) {
        fetchWeatherData(sharedCity);
    } else {
        fetchWeatherData(DEFAULT_CITY);
    }
});
