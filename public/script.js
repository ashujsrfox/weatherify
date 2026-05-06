// Weather and geocoding go through same-origin `/api/*` proxy (see server.js). No API key in the browser.
const API_BASE = '/api';
const ICON_URL = 'https://openweathermap.org/img/wn';
const DEGREE = '\u00B0';
let currentUnit = 'C';
let rawData = { current: null, forecast: null };
const unitElement = document.querySelector('.unit');

unitElement.textContent = unitLabel();

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
const searchBtn = document.getElementById('search-btn');
const weatherContainer = document.getElementById('weather-container');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');

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
const forecastGraph = document.getElementById('forecast-graph');
const forecastSummary = document.getElementById('forecast-summary');
const graphRange = document.getElementById('graph-range');
const trendsSummary = document.getElementById('trends-summary');
const trendChart = document.getElementById('trend-chart');
const trendStats = document.getElementById('trend-stats');
const trendChartLabel = document.getElementById('trend-chart-label');
const trendChartRange = document.getElementById('trend-chart-range');
const trendControls = document.querySelector('.trend-controls');
const saveCityBtn = document.getElementById('save-city-btn');
const compareToggleBtn = document.getElementById('compare-toggle-btn');
const citySort = document.getElementById('city-sort');
const cityCards = document.getElementById('city-cards');
const comparePanel = document.getElementById('compare-panel');
const compareCards = document.getElementById('compare-cards');
const compareCount = document.getElementById('compare-count');
let sunTimeline = null;
let dailyTrendData = [];
let selectedTrendMetric = 'avg';

const STORAGE_KEYS = {
    cities: 'weatherify-cities',
    cache: 'weatherify-city-cache',
    compare: 'weatherify-compare',
    sort: 'weatherify-city-sort'
};
const MAX_SAVED_CITIES = 20;
const CACHE_TTL_MS = 10 * 60 * 1000;

let savedCities = loadSavedCities();
let compareSelection = loadCompareSelection();
let selectedSort = loadSortPreference();
let compareMode = false;
const cityState = new Map();

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

if (citySort) {
    citySort.value = selectedSort;
    citySort.addEventListener('change', () => {
        selectedSort = citySort.value;
        localStorage.setItem(STORAGE_KEYS.sort, selectedSort);
        renderDashboard();
    });
}

if (compareToggleBtn) {
    compareToggleBtn.addEventListener('click', () => {
        compareMode = !compareMode;
        compareToggleBtn.setAttribute('aria-pressed', String(compareMode));
        compareToggleBtn.classList.toggle('is-active', compareMode);
        renderDashboard();
    });
}

if (saveCityBtn) {
    saveCityBtn.addEventListener('click', () => {
        if (!rawData.current) return;
        const city = buildCityFromCurrent(rawData.current);
        upsertSavedCity(city);
        syncSaveButton();
        renderDashboard();
        refreshCityData(city);
    });
}

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        hideSuggestions();
        handleSearch();
    }
});

// Autocomplete functionality
let debounceTimer;
cityInput.addEventListener('input', (e) => {
    hideError();
    const query = e.target.value.trim();
    searchBtn.disabled = query.length === 0;

    clearTimeout(debounceTimer);

    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    debounceTimer = setTimeout(() => fetchCitySuggestions(query), 300);
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        hideSuggestions();
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
    initDashboard();
    detectUserLocation();
});

function handleSearch() {
    const city = cityInput.value.trim();
    if (city) {
        fetchWeatherData(city);
    }
}

function initDashboard() {
    renderDashboard();
    refreshSavedCities();
}
function detectUserLocation() {
    if (!navigator.geolocation) {
        fetchWeatherData('London');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeatherByCoords(latitude, longitude);
        },
        () => {
            fetchWeatherData('London');
        }
    );
}

async function fetchWeatherByCoords(lat, lon) {
    showLoading();
    hideError();
    // hideWeather();

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
        localStorage.setItem('weatherify-last-data', JSON.stringify(rawData));
        updateUI(currentData);
        updateForecastUI(forecastData);
        // showWeather();
    } catch (error) {
        if (!navigator.onLine) {
            const cachedData = localStorage.getItem('weatherify-last-data');
            if (cachedData) {
                rawData = JSON.parse(cachedData);
                updateUI(rawData.current);
                updateForecastUI(rawData.forecast);
                // showWeather();
                showError('You are offline. Showing last known weather data.');
                hideLoading();
                return;
            }
        }
        fetchWeatherData('London');
    } finally {
        hideLoading();
    }
}
async function fetchWeatherData(city) {
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
        localStorage.setItem('weatherify-last-data', JSON.stringify(rawData));
        updateUI(currentData);
        updateForecastUI(forecastData);
        // showWeather();
    } catch (error) {
        console.error('Fetch error:', error);
        if (!navigator.onLine) {
            const cachedData = localStorage.getItem('weatherify-last-data');
            if (cachedData) {
                rawData = JSON.parse(cachedData);
                updateUI(rawData.current);
                updateForecastUI(rawData.forecast);
                // showWeather();
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
    humidity.textContent = `${data.main.humidity}%`;
    windSpeed.textContent = `${Math.round(data.wind.speed * 3.6)} km/h`;
    pressure.textContent = `${data.main.pressure} hPa`;
    visibility.textContent = `${(data.visibility / 1000).toFixed(1)} km`;

    sunrise.textContent = formatTimeAtOffset(data.sys.sunrise, data.timezone);
    sunset.textContent = formatTimeAtOffset(data.sys.sunset, data.timezone);

    updateSunPosition(data);
    updateDynamicBackground(data);

    syncSaveButton();
}

function updateForecastUI(forecastData) {
    if (!forecastContainer) {
        console.warn('Forecast container not found');
        return;
    }

    const chartData = forecastData.list.slice(0, 8);
    dailyTrendData = buildDailyTrendData(forecastData.list, forecastData.city?.timezone || 0);
    const dailyData = [];
    const seenDates = new Set();

    for (const item of forecastData.list) {
        const date = new Date(item.dt * 1000);
        const dateKey = date.toLocaleDateString('en-CA');
        const hour = date.getHours();

        if (!seenDates.has(dateKey) && hour >= 11 && hour <= 14) {
            seenDates.add(dateKey);
            dailyData.push(item);
        }

        if (dailyData.length >= 5) break;
    }

    forecastContainer.innerHTML = '';

    dailyData.forEach((day) => {
        const date = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const iconCode = day.weather[0].icon;
        const description = day.weather[0].description;

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-icon">
                <img src="${ICON_URL}/${iconCode}@2x.png" alt="${description}">
            </div>
            <div class="forecast-temp">${toUnit(day.main.temp)}</div>
            <div class="forecast-desc">${description}</div>
        `;

        forecastContainer.appendChild(card);
    });

    updateForecastSummary(chartData);
    renderForecastGraph(chartData);
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
    const values = trendData.map((day) => day[metric]);
    const lowValues = trendData.map((day) => day.low);
    const highValues = trendData.map((day) => day.high);
    const minValue = Math.floor(Math.min(...lowValues) - 1);
    const maxValue = Math.ceil(Math.max(...highValues) + 1);
    const range = Math.max(maxValue - minValue, 1);
    const barWidth = Math.min(58, innerWidth / trendData.length * 0.45);

    const getY = (value) => padding.top + ((maxValue - value) / range) * innerHeight;
    const points = trendData.map((day, index) => {
        const x = padding.left + (index * innerWidth) / Math.max(trendData.length - 1, 1);
        return {
            ...day,
            x,
            y: getY(day[metric]),
            value: day[metric]
        };
    });

    const baselineY = height - padding.bottom;
    const bars = points.map((point) => {
        const barHeight = Math.max(baselineY - point.y, 3);
        return `
            <g class="trend-bar-group">
                <rect x="${point.x - barWidth / 2}" y="${point.y}" width="${barWidth}" height="${barHeight}" rx="10" class="trend-bar"></rect>
                <line x1="${point.x}" y1="${getY(point.low)}" x2="${point.x}" y2="${getY(point.high)}" class="trend-range-line"></line>
                <circle cx="${point.x}" cy="${getY(point.high)}" r="4" class="trend-high-dot"></circle>
                <circle cx="${point.x}" cy="${getY(point.low)}" r="4" class="trend-low-dot"></circle>
            </g>
        `;
    }).join('');
    const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    const gridLines = [0, 0.5, 1].map((step) => {
        const y = padding.top + innerHeight * step;
        const value = Math.round(maxValue - range * step);
        return `
            <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="graph-grid-line"></line>
            <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="graph-axis-label">${value}${DEGREE}</text>
        `;
    }).join('');
    const labels = points.map((point) => `
        <g transform="translate(${point.x}, ${point.y})">
            <circle r="5" class="trend-line-point"></circle>
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

function renderForecastGraph(chartData) {
    if (!forecastGraph) return;

    if (!chartData.length) {
        forecastGraph.innerHTML = '';
        return;
    }

    const width = 640;
    const height = 240;
    const padding = { top: 24, right: 20, bottom: 42, left: 20 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const temps = chartData.map((item) => toUnitNum(item.main.temp));
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = Math.max(maxTemp - minTemp, 1);

    const points = chartData.map((item, index) => {
        const convertedTemp = toUnitNum(item.main.temp);
        const x = padding.left + (index * innerWidth) / Math.max(chartData.length - 1, 1);
        const y = padding.top + ((maxTemp - convertedTemp) / range) * innerHeight;

        return {
            x,
            y,
            temp: convertedTemp,
            label: new Date(item.dt * 1000).toLocaleTimeString('en-US', {
                hour: 'numeric'
            })
        };
    });

    const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    const areaPoints = [
        `${points[0].x},${height - padding.bottom}`,
        ...points.map((point) => `${point.x},${point.y}`),
        `${points[points.length - 1].x},${height - padding.bottom}`
    ].join(' ');

    const yGuides = [0, 0.5, 1].map((step) => {
        const y = padding.top + innerHeight * step;
        return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="graph-grid-line"></line>`;
    }).join('');

    const labels = points.map((point) => `
        <g transform="translate(${point.x}, ${point.y})">
            <circle r="5" class="graph-point"></circle>
            <text y="-14" text-anchor="middle" class="graph-point-label">${point.temp}${currentUnit === 'K' ? 'K' : DEGREE}</text>
            <text y="${height - padding.bottom - point.y + 24}" text-anchor="middle" class="graph-axis-label">${point.label}</text>
        </g>
    `).join('');

    forecastGraph.innerHTML = `
        ${yGuides}
        <polygon points="${areaPoints}" class="graph-area"></polygon>
        <polyline points="${polylinePoints}" class="graph-line"></polyline>
        ${labels}
    `;
}

function loadSavedCities() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.cities);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function persistSavedCities() {
    localStorage.setItem(STORAGE_KEYS.cities, JSON.stringify(savedCities));
}

function loadCompareSelection() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.compare);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function loadSortPreference() {
    return localStorage.getItem(STORAGE_KEYS.sort) || 'pinned';
}

function buildCityId({ name, country, lat, lon }) {
    const latKey = Number(lat).toFixed(3);
    const lonKey = Number(lon).toFixed(3);
    return `${name}|${country}|${latKey}|${lonKey}`;
}

function buildCityFromCurrent(data) {
    const city = {
        name: data.name,
        country: data.sys.country,
        state: data.state || '',
        lat: data.coord.lat,
        lon: data.coord.lon,
        pinned: false,
        addedAt: Date.now(),
        lastViewedAt: Date.now()
    };
    city.id = buildCityId(city);
    return city;
}

function upsertSavedCity(city) {
    const existingIndex = savedCities.findIndex((item) => item.id === city.id);
    if (existingIndex >= 0) {
        savedCities[existingIndex] = { ...savedCities[existingIndex], ...city };
    } else {
        if (savedCities.length >= MAX_SAVED_CITIES) {
            savedCities.pop();
        }
        savedCities.unshift(city);
    }
    persistSavedCities();
}

function removeSavedCity(cityId) {
    savedCities = savedCities.filter((city) => city.id !== cityId);
    compareSelection = compareSelection.filter((id) => id !== cityId);
    persistSavedCities();
    localStorage.setItem(STORAGE_KEYS.compare, JSON.stringify(compareSelection));
    syncSaveButton();
    renderDashboard();
}

function togglePinCity(cityId) {
    savedCities = savedCities.map((city) => {
        if (city.id !== cityId) return city;
        return { ...city, pinned: !city.pinned };
    });
    persistSavedCities();
    renderDashboard();
}

function toggleCompareCity(cityId) {
    if (compareSelection.includes(cityId)) {
        compareSelection = compareSelection.filter((id) => id !== cityId);
    } else {
        if (compareSelection.length >= 4) return;
        compareSelection = [...compareSelection, cityId];
    }
    localStorage.setItem(STORAGE_KEYS.compare, JSON.stringify(compareSelection));
    renderDashboard();
}

function getCityState(cityId) {
    if (!cityState.has(cityId)) {
        cityState.set(cityId, { status: 'idle', current: null, forecast: null, error: null });
    }
    return cityState.get(cityId);
}

function renderDashboard() {
    renderComparePanel();
    renderCityCards();
}

function renderComparePanel() {
    if (!comparePanel || !compareCards || !compareCount) return;

    comparePanel.classList.toggle('hidden', !compareMode);
    const filteredSelection = compareSelection.filter((id) => savedCities.some((city) => city.id === id));
    if (filteredSelection.length !== compareSelection.length) {
        compareSelection = filteredSelection;
        localStorage.setItem(STORAGE_KEYS.compare, JSON.stringify(compareSelection));
    }
    compareCount.textContent = compareSelection.length < 2
        ? 'Select 2-4 cities'
        : `Selected ${compareSelection.length} of 4`;

    if (!compareMode) {
        compareCards.innerHTML = '';
        return;
    }

    const selectedCities = savedCities.filter((city) => compareSelection.includes(city.id));
    compareCards.innerHTML = selectedCities.map((city) => renderCityCard(city, getCityState(city.id), true)).join('');
}

function renderCityCards() {
    if (!cityCards) return;

    const sortedCities = getSortedCities();
    if (!sortedCities.length) {
        cityCards.innerHTML = '<div class="city-empty">No saved cities yet. Search for a city and click Save.</div>';
        return;
    }

    cityCards.innerHTML = sortedCities.map((city) => renderCityCard(city, getCityState(city.id), false)).join('');

    cityCards.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const action = button.dataset.action;
            const cityId = button.closest('.city-card')?.dataset.cityId;
            if (!cityId) return;

            if (action === 'pin') togglePinCity(cityId);
            if (action === 'remove') removeSavedCity(cityId);
            if (action === 'compare') toggleCompareCity(cityId);
        });
    });

    cityCards.querySelectorAll('.city-card').forEach((card) => {
        card.addEventListener('click', () => {
            const cityId = card.dataset.cityId;
            const city = savedCities.find((item) => item.id === cityId);
            if (!city) return;
            fetchWeatherByCoords(city.lat, city.lon);
        });
    });
}

function renderCityCard(city, state, isCompare) {
    const isLoading = state.status === 'loading';
    const isError = state.status === 'error';
    const data = state.current;
    const forecast = state.forecast;
    const iconCode = data?.weather?.[0]?.icon;
    const description = data?.weather?.[0]?.description || '--';
    const tempValue = data ? toUnitNum(data.main.temp) : '--';
    const feelsValue = data ? toUnit(data.main.feels_like) : '--';
    const windValue = data ? `${Math.round(data.wind.speed * 3.6)} km/h` : '--';
    const trend = forecast ? buildTrendSummary(forecast.list || []) : null;
    const compareActive = compareSelection.includes(city.id);

    return `
        <article class="city-card" data-city-id="${city.id}">
            <div class="city-card-header">
                <div>
                    <div class="city-name">${city.name}, ${city.country}</div>
                    <div class="city-subtitle">${city.pinned ? 'Pinned' : 'Saved city'}</div>
                </div>
                ${isCompare ? '' : `
                    <div class="city-actions">
                        <button class="city-action-btn ${city.pinned ? 'is-active' : ''}" data-action="pin" type="button">Pin</button>
                        ${compareMode ? `<button class="city-action-btn ${compareActive ? 'is-active' : ''}" data-action="compare" type="button">Compare</button>` : ''}
                        <button class="city-action-btn" data-action="remove" type="button">Remove</button>
                    </div>
                `}
            </div>
            <div class="city-temp">
                ${iconCode ? `<img src="${ICON_URL}/${iconCode}@2x.png" alt="${description}">` : ''}
                ${tempValue}${currentUnit === 'K' ? 'K' : DEGREE}
            </div>
            <div class="city-card-metrics">
                <div class="city-metric"><span>Feels like</span><strong>${feelsValue}</strong></div>
                <div class="city-metric"><span>Wind</span><strong>${windValue}</strong></div>
                <div class="city-metric"><span>Condition</span><strong>${description}</strong></div>
                <div class="city-metric"><span>Updated</span><strong>${state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</strong></div>
            </div>
            <div class="city-trend">
                <span>24h trend</span>
                <span>${trend ? trend.label : '--'}</span>
            </div>
            ${isLoading ? '<div class="city-status city-loading">Loading...</div>' : ''}
            ${isError ? `<div class="city-status">${state.error || 'Unable to load city.'}</div>` : ''}
        </article>
    `;
}

function getSortedCities() {
    const pinned = savedCities.filter((city) => city.pinned);
    const others = savedCities.filter((city) => !city.pinned);
    const sorter = getSortComparator(selectedSort);

    pinned.sort(sorter);
    others.sort(sorter);

    return [...pinned, ...others];
}

function getSortComparator(sortKey) {
    if (sortKey === 'alpha') {
        return (a, b) => a.name.localeCompare(b.name);
    }

    if (sortKey === 'hottest' || sortKey === 'coldest') {
        return (a, b) => {
            const aState = getCityState(a.id);
            const bState = getCityState(b.id);
            const missingValue = sortKey === 'coldest' ? Infinity : -Infinity;
            const aTemp = aState.current?.main?.temp ?? missingValue;
            const bTemp = bState.current?.main?.temp ?? missingValue;
            return sortKey === 'hottest' ? bTemp - aTemp : aTemp - bTemp;
        };
    }

    if (sortKey === 'rain' || sortKey === 'alerts') {
        return (a, b) => {
            const aMetrics = getCityMetrics(getCityState(a.id));
            const bMetrics = getCityMetrics(getCityState(b.id));
            const aValue = sortKey === 'rain' ? aMetrics.rainRisk : aMetrics.alertScore;
            const bValue = sortKey === 'rain' ? bMetrics.rainRisk : bMetrics.alertScore;
            return bValue - aValue;
        };
    }

    return (a, b) => (b.addedAt || 0) - (a.addedAt || 0);
}

function getCityMetrics(state) {
    if (!state?.forecast?.list?.length) {
        return { rainRisk: -1, alertScore: -1 };
    }

    const windowList = state.forecast.list.slice(0, 8);
    const rainRisk = Math.max(...windowList.map((item) => item.pop ?? 0));
    const alertScore = windowList.some((item) => ['Thunderstorm', 'Tornado', 'Snow', 'Rain'].includes(item.weather?.[0]?.main)) ? 1 : 0;

    return { rainRisk, alertScore };
}

function buildTrendSummary(forecastList) {
    const windowList = forecastList.slice(0, 8);
    if (!windowList.length) return null;

    const temps = windowList.map((item) => item.main.temp);
    const first = temps[0];
    const last = temps[temps.length - 1];
    const delta = last - first;
    const direction = delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';
    const label = `${direction === 'up' ? '+' : direction === 'down' ? '' : ''}${Math.round(delta)}${DEGREE}`;

    return { label, min: Math.min(...temps), max: Math.max(...temps) };
}

function refreshSavedCities() {
    savedCities.forEach((city) => refreshCityData(city));
}

async function refreshCityData(city) {
    const state = getCityState(city.id);
    const cached = getCachedCityData(city.id);
    const now = Date.now();

    if (cached && now - cached.ts < CACHE_TTL_MS) {
        state.status = 'ready';
        state.current = cached.current;
        state.forecast = cached.forecast;
        state.updatedAt = cached.ts;
        renderDashboard();
        return;
    }

    state.status = 'loading';
    state.error = null;
    renderDashboard();

    try {
        const payload = await fetchCityPayload(city);
        state.status = 'ready';
        state.current = payload.current;
        state.forecast = payload.forecast;
        state.updatedAt = Date.now();
        setCachedCityData(city.id, payload);
    } catch (error) {
        if (cached) {
            state.status = 'ready';
            state.current = cached.current;
            state.forecast = cached.forecast;
            state.updatedAt = cached.ts;
        } else {
            state.status = 'error';
            state.error = 'Weather unavailable';
        }
    }

    renderDashboard();
}

async function fetchCityPayload(city) {
    const weatherUrl = `${API_BASE}/weather?lat=${city.lat}&lon=${city.lon}&units=standard`;
    const forecastUrl = `${API_BASE}/forecast?lat=${city.lat}&lon=${city.lon}&units=standard`;

    const [currentResponse, forecastResponse] = await Promise.all([
        fetchWithRetry(weatherUrl, 1),
        fetchWithRetry(forecastUrl, 1)
    ]);

    if (!currentResponse.ok || !forecastResponse.ok) {
        throw new Error('City request failed');
    }

    const current = await currentResponse.json();
    const forecast = await forecastResponse.json();

    if (!current?.name || !forecast?.list) {
        throw new Error('City payload incomplete');
    }

    return { current, forecast };
}

async function fetchWithRetry(url, retries) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Request failed');
        return response;
    } catch (error) {
        if (retries <= 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
        return fetchWithRetry(url, retries - 1);
    }
}

function getCachedCityData(cityId) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.cache);
        const parsed = stored ? JSON.parse(stored) : {};
        return parsed[cityId] || null;
    } catch {
        return null;
    }
}

function setCachedCityData(cityId, payload) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.cache);
        const parsed = stored ? JSON.parse(stored) : {};
        parsed[cityId] = { ts: Date.now(), current: payload.current, forecast: payload.forecast };
        localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify(parsed));
    } catch {
        // ignore cache write errors
    }
}

function syncSaveButton() {
    if (!saveCityBtn || !rawData.current) return;
    const city = buildCityFromCurrent(rawData.current);
    const exists = savedCities.some((item) => item.id === city.id);
    saveCityBtn.textContent = exists ? 'Saved' : 'Save current';
    saveCityBtn.disabled = exists;
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