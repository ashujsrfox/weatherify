// Weather and geocoding go through same-origin `/api/*` proxy (see server.js). No API key in the browser.
const API_BASE = '/api';
const ICON_URL = 'https://openweathermap.org/img/wn';
const DEGREE = '\u00B0';
const DEFAULT_CITY = 'New Delhi';

let currentUnit = 'C';
let rawData = { current: null, forecast: null, airQuality: null };

// AQI UI elements
const aqiCard = document.getElementById('aqi-card');
const aqiValueEl = document.getElementById('aqi-value');
const aqiBadgeEl = document.getElementById('aqi-badge');
const aqiPollutantsEl = document.getElementById('aqi-pollutants');
const aqiRecommendationEl = document.getElementById('aqi-recommendation');

function getAqiCategory(aqi) {
    const value = Number(aqi);
    if (!Number.isFinite(value)) {
        return { label: 'Unknown', level: 0, badgeClass: '' };
    }

    // OpenWeatherMap air pollution uses a 1-5 AQI index.
    switch (value) {
        case 1:
            return { label: 'Good', level: 1, badgeClass: 'aqi-1' };
        case 2:
            return { label: 'Fair', level: 2, badgeClass: 'aqi-2' };
        case 3:
            return { label: 'Moderate', level: 3, badgeClass: 'aqi-3' };
        case 4:
            return { label: 'Poor', level: 4, badgeClass: 'aqi-4' };
        case 5:
            return { label: 'Very Poor', level: 5, badgeClass: 'aqi-5' };
        default:
            if (value <= 50) return { label: 'Good', level: 1, badgeClass: 'aqi-1' };
            if (value <= 100) return { label: 'Fair', level: 2, badgeClass: 'aqi-2' };
            if (value <= 150) return { label: 'Moderate', level: 3, badgeClass: 'aqi-3' };
            if (value <= 200) return { label: 'Poor', level: 4, badgeClass: 'aqi-4' };
            return { label: 'Very Poor', level: 5, badgeClass: 'aqi-5' };
    }
}

function getAqiHealthRecommendation(categoryLabel) {
    switch (categoryLabel) {
        case 'Good':
            return 'Enjoy outdoor activities. Sensitive groups may still consider monitoring.';
        case 'Fair':
            return 'Unusually sensitive individuals should reduce prolonged outdoor exertion.';
        case 'Moderate':
            return 'Consider reducing prolonged outdoor activities if you experience symptoms.';
        case 'Poor':
            return 'Limit outdoor activity; keep windows closed and consider an air purifier.';
        case 'Very Poor':
            return 'Avoid outdoor activity. Stay indoors and follow local health guidance.';
        default:
            return 'Air quality information is unavailable right now.';
    }
}

function renderAqiUI(airPollution) {
    console.log('[AQI] renderAqiUI called with:', airPollution);
    
    if (!airPollution) {
        console.warn('[AQI] No airPollution data provided');
        if (aqiCard) aqiCard.classList.add('hidden');
        return;
    }

    if (!Array.isArray(airPollution.list)) {
        console.warn('[AQI] airPollution.list is not an array:', typeof airPollution.list, airPollution.list);
        if (aqiCard) aqiCard.classList.add('hidden');
        return;
    }

    if (airPollution.list.length === 0) {
        console.warn('[AQI] airPollution.list is empty');
        if (aqiCard) aqiCard.classList.add('hidden');
        return;
    }

    console.log('[AQI] Rendering AQI data');
    if (aqiCard) aqiCard.classList.remove('hidden');

    const entry = airPollution.list[0];
    console.log('[AQI] Entry:', entry);
    const aqi = entry?.main?.aqi;
    const pollutants = entry?.components || {};
    console.log('[AQI] AQI value:', aqi, 'Pollutants:', pollutants);

    const { label, badgeClass } = getAqiCategory(aqi);

    if (aqiValueEl) aqiValueEl.textContent = Number.isFinite(Number(aqi)) ? String(aqi) : '--';

    if (aqiBadgeEl) {
        aqiBadgeEl.textContent = label;
        aqiBadgeEl.classList.remove('aqi-1', 'aqi-2', 'aqi-3', 'aqi-4', 'aqi-5');
        if (badgeClass) aqiBadgeEl.classList.add(badgeClass);
    }

    if (aqiPollutantsEl) {
        // Show the most common pollutant components when available
        //
        const parts = [];
        const pm25 = pollutants.pm2_5;
        const pm10 = pollutants.pm10;
        const o3 = pollutants.o3;
        const no2 = pollutants.no2;
        const so2 = pollutants.so2;
        const co = pollutants.co;

        const add = (key, label) => {
            const v = pollutants[key];
            if (v === undefined || v === null) return;
            parts.push(`${label}: ${v}`);
        };

        add('pm2_5', 'PM2.5');
        add('pm10', 'PM10');
        add('o3', 'O₃');
        add('no2', 'NO₂');
        add('so2', 'SO₂');
        add('co', 'CO');

        aqiPollutantsEl.textContent = parts.length ? `Pollutants ${parts.join(' • ')}` : 'Pollutants --';
    }

    if (aqiRecommendationEl) {
        aqiRecommendationEl.textContent = `Recommendation: ${getAqiHealthRecommendation(label)}`;
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

function initUnitDisplay() {
    const unitElement = document.querySelector('.unit');
    if (unitElement) {
        unitElement.textContent = unitLabel();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUnitDisplay);
} else {
    initUnitDisplay();
}

function toUnit(kelvin) {
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
    if (currentUnit === 'C') return `${DEGREE}C`;
    if (currentUnit === 'F') return `${DEGREE}F`;
    return 'K';
}

async function parseJsonSafe(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

// DOM Elements
const cityInput = document.getElementById('city-input');
const clearBtn = document.getElementById('clear-btn');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const weatherContainer = document.getElementById('weather-container');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const noDataMessage = document.getElementById('no-data-message');

// Create suggestions dropdown
const suggestionsContainer = document.createElement('div');
suggestionsContainer.className = 'suggestions-container hidden';
cityInput.parentNode.insertBefore(suggestionsContainer, cityInput.nextSibling);

// Weather data elements
const cityName = document.getElementById('city-name');
const dateElement = document.getElementById('date');
const tempElement = document.getElementById('temp');
const weatherDesc = document.getElementById('weather-desc');
const weatherIcon = document.getElementById('weather-icon');
const feelsLike = document.getElementById('feels-like');
const humidity = document.getElementById('humidity');
const windSpeed = document.getElementById('wind-speed');
const pressure = document.getElementById('pressure');
const visibility = document.getElementById('visibility');
const sunrise = document.getElementById('sunrise');
const sunset = document.getElementById('sunset');
const sunPhase = document.getElementById('sun-phase');
const sunMarker = document.getElementById('sun-marker');
const sunProgress = document.getElementById('sun-progress');
const solarNoon = document.getElementById('solar-noon');
const forecastContainer = document.getElementById('forecast-container');
const temperatureChartCanvas = document.getElementById('temperature-chart');
const forecastSummary = document.getElementById('forecast-summary');
const graphRange = document.getElementById('graph-range');

const humidityPrecipChartCanvas = document.getElementById('humidity-precip-chart');
const humidityPrecipRange = document.getElementById('humidity-precip-range');
const hourlyMetricControls = document.querySelectorAll('.hourly-toggle');
let selectedHourlyMetric = 'humidity';

const trendsSummary = document.getElementById('trends-summary');
const trendChart = document.getElementById('trend-chart');
const trendStats = document.getElementById('trend-stats');
const trendChartLabel = document.getElementById('trend-chart-label');
const trendChartRange = document.getElementById('trend-chart-range');
const trendControls = document.querySelector('.trend-controls');
const historyDropdown = document.getElementById('history-dropdown');
const favoriteList = document.getElementById('favorite-list');
const recentList = document.getElementById('recent-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const favoriteToggleBtn = document.getElementById('favorite-btn');

const STORAGE_RECENT = 'weatherify-recent-cities';
const STORAGE_FAVORITES = 'weatherify-favorite-cities';
const MAX_RECENT_SEARCHES = 8;

let sunTimeline = null;
let dailyTrendData = [];
let selectedTrendMetric = 'avg';
let currentCityQuery = '';
let currentCityLabel = '';
let recentSearches = [];
let favoriteCities = [];

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

function renderHistory() {
    if (!historyDropdown) return;

    const favoriteMarkup = favoriteCities.map((item) => `
        <button type="button" class="history-button favorite-entry" data-query="${item.query}">
            <span>${item.label}</span>
            <span class="history-badge">★</span>
        </button>
    `).join('');

    const recentMarkup = recentSearches.map((item) => `
        <button type="button" class="history-button recent-entry" data-query="${item.query}">
            <span>${item.label}</span>
        </button>
    `).join('');

    const hasHistory = favoriteCities.length > 0 || recentSearches.length > 0;
    const emptyState = !hasHistory ? `
        <div class="history-empty">
            <p>No recent searches yet.</p>
            <small>Search a city and it will appear here for quick access.</small>
        </div>
    ` : '';

    const inner = historyDropdown.querySelector('.history-dropdown-inner');
    if (inner) {
        inner.innerHTML = `
            <div class="history-section">
                <div class="history-section-title">Favorites</div>
                <div id="favorite-list" class="history-list">${favoriteMarkup}</div>
            </div>
            <div class="history-section">
                <div class="history-section-title">Recent</div>
                <div id="recent-list" class="history-list">${recentMarkup}</div>
            </div>
            ${emptyState}
            <div class="history-actions">
                <button id="clear-history-btn" type="button" class="clear-history-btn ${recentSearches.length === 0 ? 'hidden' : ''}">Clear history</button>
            </div>
        `;
    }

    const newFavoriteList = document.getElementById('favorite-list');
    const newRecentList = document.getElementById('recent-list');
    const newClearHistoryBtn = document.getElementById('clear-history-btn');

    if (newFavoriteList) {
        newFavoriteList.addEventListener('click', handleHistoryClick);
    }
    if (newRecentList) {
        newRecentList.addEventListener('click', handleHistoryClick);
    }
    if (newClearHistoryBtn) {
        newClearHistoryBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            clearRecentHistory();
        });
    }
}

function updateFavoriteButton() {
    if (!favoriteToggleBtn) return;

    const active = favoriteCities.some((item) => normalizeCityKey(item.query) === normalizeCityKey(currentCityQuery));
    const icon = favoriteToggleBtn.querySelector('.favorite-icon');
    favoriteToggleBtn.setAttribute('aria-pressed', String(active));
    if (icon) icon.textContent = active ? '★' : '☆';
    favoriteToggleBtn.title = active ? 'Remove favorite' : 'Favorite';
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
    renderHistory();
}

function toggleFavoriteCity(entry) {
    if (!entry || !entry.query) return;

    const normalized = normalizeCityKey(entry.query);
    const existingIndex = favoriteCities.findIndex((item) => normalizeCityKey(item.query) === normalized);

    if (existingIndex >= 0) {
        favoriteCities.splice(existingIndex, 1);
    } else {
        favoriteCities.unshift(entry);
    }

    saveHistoryArray(STORAGE_FAVORITES, favoriteCities);
    updateFavoriteButton();
    renderHistory();
}

function clearRecentHistory() {
    recentSearches = [];
    saveHistoryArray(STORAGE_RECENT, recentSearches);
    renderHistory();
}

function handleHistoryClick(event) {
    const button = event.target.closest('button.history-button');
    if (!button) return;

    const query = button.dataset.query;
    if (!query) return;

    cityInput.value = query.replace(/,([A-Z]{2})$/, ', $1');
    clearBtn.classList.remove('hidden');
    cityInput.dispatchEvent(new Event('input', { bubbles: true }));
    hideSuggestions();
    closeHistoryDropdown();
    fetchWeatherData(query);
}

function openHistoryDropdown() {
    if (!historyDropdown) return;
    // Only show if user isn't typing and there is something to show
    const hasAny = (favoriteCities && favoriteCities.length) || (recentSearches && recentSearches.length);
    if (!hasAny) return;
    historyDropdown.classList.remove('hidden');
}

function closeHistoryDropdown() {
    if (!historyDropdown) return;
    historyDropdown.classList.add('hidden');
}

function initHistory() {
    recentSearches = loadHistoryArray(STORAGE_RECENT);
    favoriteCities = loadHistoryArray(STORAGE_FAVORITES);
    renderHistory();

    if (cityInput) {
        cityInput.addEventListener('focus', () => {
            if (!cityInput.value.trim()) {
                openHistoryDropdown();
            }
        });

        cityInput.addEventListener('input', () => {
            if (!cityInput.value.trim()) {
                if (favoriteCities.length || recentSearches.length) {
                    openHistoryDropdown();
                }
            } else {
                closeHistoryDropdown();
            }
        });
    }


    if (historyDropdown) {
        historyDropdown.addEventListener('click', handleHistoryClick);
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.classList.toggle('hidden', recentSearches.length === 0);
    }

    if (favoriteToggleBtn) {
        favoriteToggleBtn.addEventListener('click', () => {
            if (!currentCityQuery || !currentCityLabel) return;
            toggleFavoriteCity({ query: currentCityQuery, label: currentCityLabel });
        });
    }
}


function setCurrentCity(data) {
    currentCityLabel = `${data.name}, ${data.sys.country}`;
    currentCityQuery = `${data.name},${data.sys.country}`;
    updateFavoriteButton();

    // Record as recent search (prevent duplicates via addRecentSearch)
    addRecentSearch({ query: currentCityQuery, label: currentCityLabel });
}


// Unit toggle
document.querySelectorAll('.unit-btn').forEach(btn => {

    btn.addEventListener('click', () => {
        currentUnit = btn.dataset.unit;
        document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (rawData.current) {
            updateUI(rawData.current);
            updateForecastUI(rawData.forecast);
        }
    });
});

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        hideSuggestions();
        handleSearch();
    }
});

if (locationBtn) {
    locationBtn.addEventListener('click', () => {
        hideSuggestions();
        requestWeatherFromMyLocation();
    });
}

// Autocomplete functionality
let debounceTimer;
cityInput.addEventListener('input', (e) => {
    hideError();
    const query = e.target.value.trim();
    searchBtn.disabled = query.length === 0;
    clearBtn.classList.toggle('hidden', cityInput.value.length === 0);

    clearTimeout(debounceTimer);

    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    debounceTimer = setTimeout(() => fetchCitySuggestions(query), 300);
});

clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cityInput.value = '';
    cityInput.dispatchEvent(new Event('input', { bubbles: true }));
    cityInput.focus();
});

// Hide suggestions and history when clicking outside search controls
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        hideSuggestions();
    }
    if (!e.target.closest('.search-container')) {
        closeHistoryDropdown();
    }
});

if (trendControls) {
    trendControls.addEventListener('click', (event) => {
        const button = event.target.closest('[data-trend-metric]');
        if (!button) return;

        selectedTrendMetric = button.dataset.trendMetric;
        updateTrendToggleState();
        renderTrendChart(dailyTrendData);
    });
}

async function fetchCitySuggestions(query) {
    try {
        const url = `${API_BASE}/geo?q=${encodeURIComponent(query)}&limit=5`;
        const response = await fetch(url);

        if (!response.ok) return;

        const cities = await response.json();
        displaySuggestions(cities);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
    }
}

function displaySuggestions(cities) {
    if (cities.length === 0) {
        hideSuggestions();
        return;
    }

    suggestionsContainer.innerHTML = '';

    cities.forEach((city) => {
        const suggestion = document.createElement('div');
        suggestion.className = 'suggestion-item';
        suggestion.textContent = `${city.name}, ${city.state ? `${city.state}, ` : ''}${city.country}`;

        suggestion.addEventListener('click', () => {
            cityInput.value = city.name;
            clearBtn.classList.remove('hidden');
            hideSuggestions();
            fetchWeatherData(city.name);
        });

        suggestionsContainer.appendChild(suggestion);
    });

    suggestionsContainer.classList.remove('hidden');
}

function hideSuggestions() {
    suggestionsContainer.classList.add('hidden');
}

// Initialize with default city
window.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
            console.error('Service Worker registration failed:', err);
        });
    }
    initHistory();
    fetchWeatherData(DEFAULT_CITY);
});

function handleSearch() {
    const city = cityInput.value.trim();
    if (city) {
        fetchWeatherData(city);
    }
}
function getLocationErrorMessage(error) {
    if (!error) return 'Unable to get your location.';

    // GeolocationPositionError.PERMISSION_DENIED = 1
    if (error.code === 1) {
        return 'Location permission denied. Please enable location access in your browser settings.';
    }
    // GeolocationPositionError.POSITION_UNAVAILABLE = 2
    if (error.code === 2) {
        return 'Your location is unavailable right now.';
    }
    // GeolocationPositionError.TIMEOUT = 3
    if (error.code === 3) {
        return 'Timed out while trying to get your location. Please try again.';
    }

    return 'Unable to get your location.';
}

async function requestWeatherFromMyLocation() {
    if (locationBtn) locationBtn.disabled = true;

    if (!navigator.geolocation) {
        hideLoading();
        showError('Geolocation is not supported by your browser.');
        if (locationBtn) locationBtn.disabled = false;
        return;
    }

    // Ask for a position with a reasonable timeout for mobile UX.
    showLoading();
    hideError();

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeatherByCoords(latitude, longitude);
        },
        (error) => {
            hideLoading();
            showError(getLocationErrorMessage(error));

            // If offline, try cached last-known data.
            if (!navigator.onLine) {
                const cachedData = localStorage.getItem('weatherify-last-data');
                if (cachedData) {
                    rawData = JSON.parse(cachedData);
                    updateUI(rawData.current);
                    updateForecastUI(rawData.forecast);
                    showWeather();
                    showError('You are offline. Showing last known weather data.');
                }
            }

            if (locationBtn) locationBtn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
}

function detectUserLocation() {
    // Backwards-compatible wrapper for any existing callers.
    requestWeatherFromMyLocation();
}

async function fetchWeatherByCoords(lat, lon) {
    // Button disabling is handled by requestWeatherFromMyLocation.
    showLoading();
    hideError();
    // hideWeather();

    // Use the same units mode as the rest of the app (Kelvin -> handled by toUnit/toUnitNum)
    // so temperature conversion stays consistent.
    try {
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`${API_BASE}/weather?lat=${lat}&lon=${lon}&units=standard`),
            fetch(`${API_BASE}/forecast?lat=${lat}&lon=${lon}&units=standard`)
        ]);


        if (!currentResponse.ok || !forecastResponse.ok) {
            throw new Error('Unable to fetch location weather');
        }

        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();

        if (!currentData || !currentData.name || !currentData.sys || !forecastData || !forecastData.list) {
            throw new Error('Unable to fetch location weather');
        }

        rawData.current = currentData;
        rawData.forecast = forecastData;

        // Fetch AQI using resolved coordinates when available
        if (currentData?.coord?.lat !== undefined && currentData?.coord?.lon !== undefined) {
            try {
                console.log('[AQI] Fetching AQI for coordinates:', currentData.coord.lat, currentData.coord.lon);
                const airQuality = await fetchAirQualityByCoords(currentData.coord.lat, currentData.coord.lon);
                rawData.airQuality = airQuality;
                console.log('[AQI] Rendering AQI UI after fetch');
                renderAqiUI(airQuality);
            } catch (error) {
                console.error('[AQI] Error fetching/rendering AQI:', error);
                rawData.airQuality = null;
                if (aqiCard) aqiCard.classList.add('hidden');
            }
        } else {
            console.warn('[AQI] No coordinates available for AQI fetch');
        }

        localStorage.setItem('weatherify-last-data', JSON.stringify(rawData));
        updateUI(currentData);
        updateForecastUI(forecastData);
        showWeather();
        setCurrentCity(currentData);

    } catch (error) {
        if (!navigator.onLine) {
            const cachedData = localStorage.getItem('weatherify-last-data');
            if (cachedData) {
                rawData = JSON.parse(cachedData);
                updateUI(rawData.current);
                updateForecastUI(rawData.forecast);
                showWeather();
                showError('You are offline. Showing last known weather data.');
                hideLoading();
                return;
            }
        }
        fetchWeatherData(DEFAULT_CITY);
    } finally {
        hideLoading();
        if (locationBtn) locationBtn.disabled = false;
    }
}
async function fetchWeatherData(city) {
    // reset AQI section while fetching new data
    if (aqiCard) aqiCard.classList.add('hidden');

    showLoading();
    hideError();
    // hideWeather();

    try {
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`${API_BASE}/weather?q=${encodeURIComponent(city)}&units=standard`),
            fetch(`${API_BASE}/forecast?q=${encodeURIComponent(city)}&units=standard`)
        ]);

        if (!currentResponse.ok) {
            const errorData = await parseJsonSafe(currentResponse);
            throw new Error(errorData?.message || 'City not found');
        }
        if (!forecastResponse.ok) {
            const errorData = await parseJsonSafe(forecastResponse);
            throw new Error(errorData?.message || 'Forecast unavailable');
        }

        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();

        if (!currentData || !currentData.name || !currentData.sys || !forecastData || !forecastData.list) {
            throw new Error('City not found');
        }

        rawData.current = currentData;
        rawData.forecast = forecastData;

        if (currentData?.coord?.lat !== undefined && currentData?.coord?.lon !== undefined) {
            try {
                const airQuality = await fetchAirQualityByCoords(currentData.coord.lat, currentData.coord.lon);
                rawData.airQuality = airQuality;
                renderAqiUI(airQuality);
            } catch {
                rawData.airQuality = null;
                if (aqiCard) aqiCard.classList.add('hidden');
            }
        }

        localStorage.setItem('weatherify-last-data', JSON.stringify(rawData));
        updateUI(currentData);
        updateForecastUI(forecastData);
        showWeather();
        setCurrentCity(currentData);
    } catch (error) {
        console.error('Fetch error:', error);
        if (!navigator.onLine) {
            const cachedData = localStorage.getItem('weatherify-last-data');
            if (cachedData) {
                rawData = JSON.parse(cachedData);
                updateUI(rawData.current);
                updateForecastUI(rawData.forecast);
                showWeather();
                showError('You are offline. Showing last known weather data.');
                hideLoading();
                return;
            }
        }
        showError('City not found. Please check spelling and try again.');
    } finally {
        hideLoading();
    }
}

function updateUI(data) {
    cityName.textContent = `${data.name}, ${data.sys.country}`;
    dateElement.textContent = formatDateAtOffset(Math.floor(Date.now() / 1000), data.timezone);

    tempElement.textContent = toUnitNum(data.main.temp);
    // document.querySelector('.unit').textContent = unitLabel();
    weatherDesc.textContent = data.weather[0].description;

    const iconCode = data.weather[0].icon;
    weatherIcon.innerHTML = `<img src="${ICON_URL}/${iconCode}@4x.png" alt="${data.weather[0].description}">`;

    feelsLike.textContent = toUnit(data.main.feels_like);
    const feelsLikeMain = document.getElementById('feels-like-main');
    if (feelsLikeMain) feelsLikeMain.textContent = `Feels like ${toUnit(data.main.feels_like)}`;
    humidity.textContent = `${data.main.humidity}%`;
    const windDir = getWindDirection(data.wind.deg);
    windSpeed.textContent = `${Math.round(data.wind.speed * 3.6)} km/h ${windDir}`;
    pressure.textContent = `${data.main.pressure} hPa`;
    visibility.textContent = `${(data.visibility / 1000).toFixed(1)} km`;

    sunrise.textContent = formatTimeAtOffset(data.sys.sunrise, data.timezone);
    sunset.textContent = formatTimeAtOffset(data.sys.sunset, data.timezone);

    updateSunPosition(data);
    updateDynamicBackground(data);
}

function updateForecastUI(forecastData) {
    if (!forecastContainer) {
        console.warn('Forecast container not found');
        return;
    }

    const hourlyData = forecastData.list.slice(0, 8); // Next 24 hours (8 * 3 hours)
    dailyTrendData = buildDailyTrendData(forecastData.list, forecastData.city?.timezone || 0);

    forecastContainer.innerHTML = '';

    hourlyData.forEach((hour) => {
        const date = new Date(hour.dt * 1000);
        const timeString = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        const iconCode = hour.weather[0].icon;
        const description = hour.weather[0].description;

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-day">${timeString}</div>
            <div class="forecast-icon">
                <img src="${ICON_URL}/${iconCode}@2x.png" alt="${description}">
            </div>
            <div class="forecast-temp">${toUnit(hour.main.temp)}</div>
            <div class="forecast-desc">${description}</div>
        `;

        forecastContainer.appendChild(card);
    });

    updateForecastSummary(hourlyData);
    renderTemperatureChart(hourlyData);

    // Hourly humidity/precip chart
    const hoursAhead = 24;
    const hourlyPoints = buildHourlyPoints(forecastData.list, forecastData.city?.timezone || 0, hoursAhead);
    renderHumidityPrecipChart(hourlyPoints);

    updateWeatherTrends(dailyTrendData);
}

function updateForecastSummary(chartData) {
    if (!forecastSummary || !graphRange) return;

    if (!chartData.length) {
        forecastSummary.textContent = 'Forecast trend is unavailable right now.';
        graphRange.textContent = '--';
        return;
    }

    const temperatures = chartData.map((item) => item.main.temp);
    const firstTemp = temperatures[0];
    const lastTemp = temperatures[temperatures.length - 1];
    const minTemp = Math.min(...temperatures);
    const maxTemp = Math.max(...temperatures);
    const delta = lastTemp - firstTemp;
    const trend =
        delta > 1.5 ? 'Temperatures are expected to rise' :
        delta < -1.5 ? 'Temperatures are expected to cool down' :
        'Temperatures are expected to stay fairly steady';

    forecastSummary.textContent = `${trend} over the next 24 hours, ranging from ${toUnit(minTemp)} to ${toUnit(maxTemp)}.`;
    graphRange.textContent = `${toUnit(minTemp)} - ${toUnit(maxTemp)}`;
}

function buildDailyTrendData(forecastList, timezoneOffsetSeconds) {
    const groupedDays = new Map();

    forecastList.forEach((item) => {
        const localDate = getShiftedDate(item.dt, timezoneOffsetSeconds);
        const dateKey = localDate.toISOString().slice(0, 10);

        if (!groupedDays.has(dateKey)) {
            groupedDays.set(dateKey, {
                dateKey,
                dayLabel: localDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    timeZone: 'UTC'
                }),
                dateLabel: localDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC'
                }),
                temperatures: []
            });
        }

        groupedDays.get(dateKey).temperatures.push(item.main.temp);
    });

    return Array.from(groupedDays.values()).slice(0, 5).map((day) => {
        const high = Math.max(...day.temperatures);
        const low = Math.min(...day.temperatures);
        const avg = day.temperatures.reduce((total, temp) => total + temp, 0) / day.temperatures.length;

        return {
            ...day,
            high,
            low,
            avg
        };
    });
}

function updateWeatherTrends(trendData) {
    if (!trendsSummary || !trendStats || !trendChart) return;

    if (!trendData.length) {
        trendsSummary.textContent = 'Daily trend data is unavailable right now.';
        trendStats.innerHTML = '';
        trendChart.innerHTML = '';
        trendChartRange.textContent = '--';
        return;
    }

    const firstAverage = trendData[0].avg;
    const lastAverage = trendData[trendData.length - 1].avg;
    const averageDelta = lastAverage - firstAverage;
    const trendText =
        averageDelta > 1.5 ? 'Temperatures rising over the next few days.' :
        averageDelta < -1.5 ? 'Cooling trend expected over the next few days.' :
        'Weather remaining stable over the next few days.';
    const warmestDay = trendData.reduce((warmest, day) => day.high > warmest.high ? day : warmest, trendData[0]);
    const coolestDay = trendData.reduce((coolest, day) => day.low < coolest.low ? day : coolest, trendData[0]);

    trendsSummary.textContent = `${trendText} Warmest: ${warmestDay.dayLabel} at ${Math.round(warmestDay.high)}${DEGREE}C. Coolest: ${coolestDay.dayLabel} at ${Math.round(coolestDay.low)}${DEGREE}C.`;
    renderTrendStats(trendData);
    renderTrendChart(trendData);
}

function renderTrendStats(trendData) {
    if (!trendStats) return;

    trendStats.innerHTML = trendData.map((day) => `
        <div class="trend-stat-card">
            <div class="trend-stat-date">
                <span>${day.dayLabel}</span>
                <small>${day.dateLabel}</small>
            </div>
            <div class="trend-stat-values">
                <span><strong>${Math.round(day.high)}${DEGREE}C</strong> high</span>
                <span><strong>${Math.round(day.low)}${DEGREE}C</strong> low</span>
                <span><strong>${Math.round(day.avg)}${DEGREE}C</strong> avg</span>
            </div>
        </div>
    `).join('');
}

function updateTrendToggleState() {
    if (!trendControls) return;

    trendControls.querySelectorAll('[data-trend-metric]').forEach((button) => {
        button.classList.toggle('active', button.dataset.trendMetric === selectedTrendMetric);
    });
}

function renderTrendChart(trendData) {
    if (!trendChart) return;

    if (!trendData.length) {
        trendChart.innerHTML = '';
        return;
    }

    const metricLabels = {
        high: 'Daily High Temperature',
        low: 'Daily Low Temperature',
        avg: 'Daily Average Temperature'
    };
    const metricColors = {
        high: '#f97316',
        low: '#0ea5e9',
        avg: '#667eea'
    };
    const metric = selectedTrendMetric in metricLabels ? selectedTrendMetric : 'avg';
    const width = 760;
    const height = 280;
    const padding = { top: 46, right: 42, bottom: 48, left: 54 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const values = trendData.map((day) => toUnitNum(day[metric]));
    const lowValues = trendData.map((day) => toUnitNum(day.low));
    const highValues = trendData.map((day) => toUnitNum(day.high));
    const minValue = Math.floor(Math.min(...lowValues) - 1);
    const maxValue = Math.ceil(Math.max(...highValues) + 1);
    const range = Math.max(maxValue - minValue, 1);
    const barWidth = Math.min(58, innerWidth / trendData.length * 0.45);

    const getY = (value) => padding.top + ((maxValue - value) / range) * innerHeight;
    const points = trendData.map((day, index) => {
        const x = padding.left + (index * innerWidth) / Math.max(trendData.length - 1, 1);
        const convertedMetric = toUnitNum(day[metric]);
        const x = padding.left + xInset + (index * xSpan) / Math.max(trendData.length - 1, 1);
        return {
            ...day,
            x,
            y: getY(convertedMetric),
            value: convertedMetric,
            highConverted: toUnitNum(day.high),
            lowConverted: toUnitNum(day.low)
        };
    });

    const baselineY = height - padding.bottom;
    const bars = points.map((point) => {
        const barHeight = Math.max(baselineY - point.y, 3);
        return `
            <g class="trend-bar-group">
                <rect x="${point.x - barWidth / 2}" y="${point.y}" width="${barWidth}" height="${barHeight}" rx="10" class="trend-bar"></rect>
                <line x1="${point.x}" y1="${getY(point.lowConverted)}" x2="${point.x}" y2="${getY(point.highConverted)}" class="trend-range-line"></line>
                <circle cx="${point.x}" cy="${getY(point.highConverted)}" r="4" class="trend-high-dot"></circle>
                <circle cx="${point.x}" cy="${getY(point.lowConverted)}" r="4" class="trend-low-dot"></circle>
            </g>
        `;
    }).join('');
    const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    const gridLines = [0, 0.5, 1].map((step) => {
        const y = padding.top + innerHeight * step;
        const value = Math.round(maxValue - range * step);
        return `
            <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="graph-grid-line"></line>
            <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="graph-axis-label">${value}${currentUnit === 'K' ? 'K' : DEGREE}</text>
            <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="graph-axis-label">${toUnitNum(value)}${DEGREE}</text>
            <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="graph-axis-label">${value}${DEGREE}</text>
        `;
    }).join('');
    const labels = points.map((point) => `
        <g transform="translate(${point.x}, ${point.y})">
            <circle r="5" class="trend-line-point"></circle>
            <text y="-18" text-anchor="middle" class="graph-point-label trend-value-label">${Math.round(point.value)}${currentUnit === 'K' ? 'K' : DEGREE}</text>
            <text y="-18" text-anchor="middle" class="graph-point-label trend-value-label">${toUnitNum(point.value)}${DEGREE}</text>
            <text y="-18" text-anchor="middle" class="graph-point-label trend-value-label">${Math.round(point.value)}${DEGREE}</text>
            <text y="${height - padding.bottom - point.y + 28}" text-anchor="middle" class="graph-axis-label">${point.dayLabel}</text>
        </g>
    `).join('');

    trendChart.style.setProperty('--trend-color', metricColors[metric]);
    trendChart.innerHTML = `
        ${gridLines}
        ${bars}
        <polyline points="${linePoints}" class="trend-line"></polyline>
        ${labels}
    `;

    if (trendChartLabel) {
        trendChartLabel.textContent = metricLabels[metric];
    }

    if (trendChartRange) {
        trendChartRange.textContent = `${Math.round(Math.min(...values))}${unitLabel()} - ${Math.round(Math.max(...values))}${unitLabel()}`;
        trendChartRange.textContent = `${toUnit(Math.min(...values))} — ${toUnit(Math.max(...values))}`;
        trendChartRange.textContent = `${Math.round(Math.min(...values))}${DEGREE}C - ${Math.round(Math.max(...values))}${DEGREE}C`;
    }
}

function updateSunPosition(data) {
    if (!sunMarker || !sunPhase || !sunProgress || !solarNoon) return;

    sunTimeline = {
        timezone: data.timezone,
        sunrise: data.sys.sunrise,
        sunset: data.sys.sunset
    };

    renderSunPosition();
}

function updateDynamicBackground(data) {
    const body = document.body;
    const weatherType = (data.weather?.[0]?.main || '').toLowerCase();
    const isNight = data.weather?.[0]?.icon?.includes('n');
    const themeClasses = [
        'theme-clear-day',
        'theme-clear-night',
        'theme-clouds',
        'theme-rain',
        'theme-drizzle',
        'theme-thunderstorm',
        'theme-snow',
        'theme-mist',
        'theme-fog',
        'theme-haze'
    ];

    body.classList.remove(...themeClasses);

    if (weatherType === 'clear') {
        body.classList.add(isNight ? 'theme-clear-night' : 'theme-clear-day');
        return;
    }

    if (weatherType === 'clouds') {
        body.classList.add('theme-clouds');
        return;
    }

    if (weatherType === 'rain') {
        body.classList.add('theme-rain');
        return;
    }

    if (weatherType === 'drizzle') {
        body.classList.add('theme-drizzle');
        return;
    }

    if (weatherType === 'thunderstorm') {
        body.classList.add('theme-thunderstorm');
        return;
    }

    if (weatherType === 'snow') {
        body.classList.add('theme-snow');
        return;
    }

    if (weatherType === 'mist' || weatherType === 'fog' || weatherType === 'haze' || weatherType === 'smoke') {
        body.classList.add('theme-mist');
        return;
    }

    body.classList.add(isNight ? 'theme-clear-night' : 'theme-clear-day');
}

function renderSunPosition() {
    if (!sunTimeline || !sunMarker || !sunPhase || !sunProgress || !solarNoon) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const { timezone, sunrise, sunset } = sunTimeline;
    const daylight = Math.max(sunset - sunrise, 1);
    const midpoint = sunrise + Math.floor(daylight / 2);
    let progress = 0;
    let phaseText = '';
    let progressText = '';

    if (nowSeconds <= sunrise) {
        phaseText = 'Before sunrise';
        progressText = `${formatDuration(sunrise - nowSeconds)} until sunrise`;
        progress = 0;
    } else if (nowSeconds >= sunset) {
        phaseText = 'After sunset';
        progressText = `${formatDuration(getNextSunriseSeconds(sunrise, nowSeconds) - nowSeconds)} until sunrise`;
        progress = 100;
    } else {
        progress = ((nowSeconds - sunrise) / daylight) * 100;

        if (progress < 35) {
            phaseText = 'Morning sun';
        } else if (progress < 65) {
            phaseText = 'Near solar noon';
        } else {
            phaseText = 'Afternoon sun';
        }

        progressText = `${Math.round(progress)}% of daylight completed`;
    }

    sunMarker.style.left = `${Math.min(Math.max(progress, 0), 100)}%`;
    sunPhase.textContent = phaseText;
    sunProgress.textContent = progressText;
    solarNoon.textContent = `Solar midpoint ${formatTimeAtOffset(midpoint, timezone)}`;
}

function getShiftedDate(unixSeconds, timezoneOffsetSeconds) {
    return new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
}

function formatDateAtOffset(unixSeconds, timezoneOffsetSeconds) {
    return getShiftedDate(unixSeconds, timezoneOffsetSeconds).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    });
}

function formatTimeAtOffset(unixSeconds, timezoneOffsetSeconds) {
    return getShiftedDate(unixSeconds, timezoneOffsetSeconds).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    });
}

function getNextSunriseSeconds(todaySunrise, nowSeconds) {
    const daySeconds = 24 * 60 * 60;
    const daysAhead = Math.floor((nowSeconds - todaySunrise) / daySeconds) + 1;
    return todaySunrise + daysAhead * daySeconds;
}

function formatDuration(seconds) {
    const totalMinutes = Math.max(0, Math.round(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes}m`;
    }

    if (minutes === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
}

function renderTemperatureChart(hourlyData) {
    if (!temperatureChartCanvas) return;

    if (!hourlyData.length) {
        // Clear chart if no data
        if (window.temperatureChart) {
            window.temperatureChart.destroy();
        }
        return;
    }

    const labels = hourlyData.map(item => {
        const date = new Date(item.dt * 1000);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    });

    const temperatures = hourlyData.map(item => toUnitNum(item.main.temp));

    const data = {
        labels: labels,
        datasets: [{
            label: `Temperature (${unitLabel()})`,
            data: temperatures,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4
        }]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return value + (currentUnit === 'K' ? 'K' : DEGREE);
                        }
                    }
                }
            }
        }
    };

    if (window.temperatureChart) {
        window.temperatureChart.destroy();
    }
    window.temperatureChart = new Chart(temperatureChartCanvas, config);
}

function buildHourlyPoints(forecastList, timezoneOffsetSeconds, hoursAhead) {
    if (!Array.isArray(forecastList) || forecastList.length === 0) return [];

    const nowSeconds = Math.floor(Date.now() / 1000);
    const endSeconds = nowSeconds + hoursAhead * 60 * 60;

    // OpenWeather dt is in UTC seconds.
    const points = forecastList
        .slice()
        .sort((a, b) => a.dt - b.dt)
        .filter((item) => item?.dt >= nowSeconds - 3600 && item?.dt <= endSeconds);

    // Keep it compact (3-hour steps => ~8 points for 24h)
    return points.slice(0, 10).map((item) => {
        const localDate = getShiftedDate(item.dt, timezoneOffsetSeconds);
        return {
            raw: item,
            dt: item.dt,
            timeLabel: localDate.toLocaleTimeString('en-US', { hour: 'numeric' }),
            humidity: item.main?.humidity ?? null,
            precipProb: item.pop ?? null,
            precipAmount: item.rain?.['3h'] ?? null
        };
    });
}

function renderHumidityPrecipChart(hourlyPoints) {
    if (!humidityPrecipChartCanvas || !humidityPrecipRange) return;

    if (!hourlyPoints || hourlyPoints.length === 0) {
        if (window.humidityPrecipChart) {
            window.humidityPrecipChart.destroy();
        }
        humidityPrecipRange.textContent = '--';
        return;
    }

    const metric = selectedHourlyMetric;
    const labels = hourlyPoints.map(p => p.timeLabel);
    const values = hourlyPoints.map(p => {
        if (metric === 'humidity') {
            return p.humidity || 0;
        }
        return (p.precipProb || 0) * 100;
    });

    const data = {
        labels: labels,
        datasets: [{
            label: metric === 'humidity' ? 'Humidity (%)' : 'Precipitation Probability (%)',
            data: values,
            borderColor: metric === 'humidity' ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 99, 132, 1)',
            backgroundColor: metric === 'humidity' ? 'rgba(54, 162, 235, 0.2)' : 'rgba(255, 99, 132, 0.2)',
            fill: true,
            tension: 0.4
        }]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: metric === 'humidity' ? 100 : 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    };

    if (window.humidityPrecipChart) {
        window.humidityPrecipChart.destroy();
    }
    window.humidityPrecipChart = new Chart(humidityPrecipChartCanvas, config);

    // Update range label
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const suffix = metric === 'humidity' ? 'Humidity %' : 'Precip Probability %';
    humidityPrecipRange.textContent = `${minV}% - ${maxV}% (${suffix})`;
}

function getWindDirection(deg) {
    if (deg === undefined || deg === null) return '';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(deg / 45) % 8;
    const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    return `${directions[index]} ${arrows[index]}`;
}
function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showWeather() {
    weatherContainer.classList.remove('hidden');
}

function hideWeather() {
    weatherContainer.classList.add('hidden');
}

function showError(message) {
    if (message) {
        errorMessage.querySelector('p').textContent = message;
    }
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
// ===== STATE MANAGEMENT & VISIBILITY FUNCTIONS =====
function showWeather() {
    weatherContainer.classList.remove('hidden');
    if (noDataMessage) noDataMessage.classList.add('hidden');
    loading.classList.add('hidden');
}

function hideWeather() {
    weatherContainer.classList.add('hidden');
    loading.classList.add('hidden');
}

function showNoDataMessage() {
    weatherContainer.classList.add('hidden');
    if (noDataMessage) noDataMessage.classList.remove('hidden');
    loading.classList.add('hidden');
}

function showLoading() {
    weatherContainer.classList.add('hidden');
    if (noDataMessage) noDataMessage.classList.add('hidden');
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

// ===== GLOBAL UNIT UPDATE FUNCTION =====
function updateAllTemperatureDisplays() {
    // Update unit label globally
    const unitElements = document.querySelectorAll('.unit');
    unitElements.forEach(el => {
        el.textContent = unitLabel();
    });
    
    // Update all temperature-related elements if data exists
    if (rawData.current) {
        updateUI(rawData.current);
    }
    
    // Update forecast display with new units
    if (rawData.forecast) {
        updateForecastUI(rawData.forecast);
    }
}

setInterval(renderSunPosition, 60000);


// ============================================================
// ✅ ADDED: Dark Mode Toggle — Issue #14
// ============================================================
(function initDarkMode() {
    const STORAGE_KEY = 'weatherify-theme';
    const DARK_CLASS  = 'dark-mode';

    const toggleBtn = document.getElementById('theme-toggle');
    const icon      = toggleBtn ? toggleBtn.querySelector('.toggle-icon') : null;
    const label     = toggleBtn ? toggleBtn.querySelector('.toggle-label') : null;

    function applyTheme(isDark) {
        document.body.classList.toggle(DARK_CLASS, isDark);
        if (icon)      icon.textContent  = isDark ? '☀️' : '🌙';
        if (label)     label.textContent = isDark ? 'Light' : 'Dark';
        if (toggleBtn) toggleBtn.setAttribute('aria-pressed', String(isDark));
    }

    function getInitialPreference() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Apply before first paint to prevent flash
    applyTheme(getInitialPreference());

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isDark = !document.body.classList.contains(DARK_CLASS);
            applyTheme(isDark);
            localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
        });
    }

    // Follow OS preference changes only if user hasn't manually chosen
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem(STORAGE_KEY) === null) {
            applyTheme(e.matches);
        }
    });
})();







