// Weather and geocoding go through same-origin `/api/*` proxy (see server.js). No API key in the browser.
const API_BASE = '/api';
const ICON_URL = 'https://openweathermap.org/img/wn';
const DEGREE = '\u00B0';

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
let sunTimeline = null;
let dailyTrendData = [];
let selectedTrendMetric = 'avg';

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
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

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
    detectUserLocation();
});

function handleSearch() {
    const city = cityInput.value.trim();
    if (city) {
        fetchWeatherData(city);
    }
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
    hideWeather();

    try {
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`${API_BASE}/weather?lat=${lat}&lon=${lon}&units=metric`),
            fetch(`${API_BASE}/forecast?lat=${lat}&lon=${lon}&units=metric`)
        ]);

        if (!currentResponse.ok || !forecastResponse.ok) {
            throw new Error('Unable to fetch location weather');
        }

        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();

        updateUI(currentData);
        updateForecastUI(forecastData);
        showWeather();
    } catch (error) {
        fetchWeatherData('London');
    } finally {
        hideLoading();
    }
}
async function fetchWeatherData(city) {
    showLoading();
    hideError();
    hideWeather();

    try {
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`${API_BASE}/weather?q=${encodeURIComponent(city)}&units=metric`),
            fetch(`${API_BASE}/forecast?q=${encodeURIComponent(city)}&units=metric`)
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

        updateUI(currentData);
        updateForecastUI(forecastData);
        showWeather();
    } catch (error) {
        console.error('Fetch error:', error);
        showError(error.message || 'Unable to fetch weather data. Please try again.');
    } finally {
        hideLoading();
    }
}

function updateUI(data) {
    cityName.textContent = `${data.name}, ${data.sys.country}`;
    dateElement.textContent = formatDateAtOffset(Math.floor(Date.now() / 1000), data.timezone);

    tempElement.textContent = Math.round(data.main.temp);
    weatherDesc.textContent = data.weather[0].description;

    const iconCode = data.weather[0].icon;
    weatherIcon.innerHTML = `<img src="${ICON_URL}/${iconCode}@4x.png" alt="${data.weather[0].description}">`;

    feelsLike.textContent = `${Math.round(data.main.feels_like)}${DEGREE}C`;
    humidity.textContent = `${data.main.humidity}%`;
    windSpeed.textContent = `${Math.round(data.wind.speed * 3.6)} km/h`;
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
        const temp = Math.round(day.main.temp);
        const description = day.weather[0].description;

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-icon">
                <img src="${ICON_URL}/${iconCode}@2x.png" alt="${description}">
            </div>
            <div class="forecast-temp">${temp}${DEGREE}C</div>
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

    forecastSummary.textContent = `${trend} over the next 24 hours, ranging from ${Math.round(minTemp)}${DEGREE}C to ${Math.round(maxTemp)}${DEGREE}C.`;
    graphRange.textContent = `${Math.round(minTemp)}${DEGREE}C - ${Math.round(maxTemp)}${DEGREE}C`;
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
    const temps = chartData.map((item) => item.main.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = Math.max(maxTemp - minTemp, 1);

    const points = chartData.map((item, index) => {
        const x = padding.left + (index * innerWidth) / Math.max(chartData.length - 1, 1);
        const y = padding.top + ((maxTemp - item.main.temp) / range) * innerHeight;

        return {
            x,
            y,
            temp: Math.round(item.main.temp),
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
            <text y="-14" text-anchor="middle" class="graph-point-label">${point.temp}${DEGREE}</text>
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
    const DARK_CLASS = 'dark-mode';

    const toggleBtn = document.getElementById('theme-toggle');
    const icon = toggleBtn ? toggleBtn.querySelector('.toggle-icon') : null;
    const label = toggleBtn ? toggleBtn.querySelector('.toggle-label') : null;

    function applyTheme(isDark) {
        document.body.classList.toggle(DARK_CLASS, isDark);
        if (icon) icon.textContent = isDark ? '☀️' : '🌙';
        if (label) label.textContent = isDark ? 'Light' : 'Dark';
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

// ============================================================
// 💎 PREMIUM EFFECTS (Three.js, GSAP, Custom Cursor)
// ============================================================

(function initPremiumEffects() {
    // --- Custom Cursor ---
    const cursor = document.getElementById('custom-cursor');
    const cursorBlur = document.getElementById('cursor-blur');
    let mouseX = 0, mouseY = 0;
    let cursorX = 0, cursorY = 0;
    let blurX = 0, blurY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animateCursor() {
        // Smooth cursor tracking
        cursorX += (mouseX - cursorX) * 0.2;
        cursorY += (mouseY - cursorY) * 0.2;
        cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;

        // Smooth blur tracking (slower for liquid feel)
        blurX += (mouseX - blurX) * 0.05;
        blurY += (mouseY - blurY) * 0.05;
        cursorBlur.style.left = `${blurX}px`;
        cursorBlur.style.top = `${blurY}px`;

        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // Hover effects for interactive elements
    const interactives = document.querySelectorAll('button, input, .detail-card, .forecast-card');
    interactives.forEach(el => {
        el.addEventListener('mouseenter', () => {
            gsap.to(cursor, { scale: 4, opacity: 0.3, duration: 0.3 });
            gsap.to(cursorBlur, { scale: 1.5, opacity: 0.4, duration: 0.5 });
        });
        el.addEventListener('mouseleave', () => {
            gsap.to(cursor, { scale: 1, opacity: 1, duration: 0.3 });
            gsap.to(cursorBlur, { scale: 1, opacity: 0.15, duration: 0.5 });
        });
    });

    // --- Parallax Effect on App Container ---
    const appContainer = document.querySelector('.weather-app');
    document.addEventListener('mousemove', (e) => {
        if (!appContainer) return;
        const xPct = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
        const yPct = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
        
        gsap.to(appContainer, {
            rotationY: xPct * 5,
            rotationX: -yPct * 5,
            transformPerspective: 1000,
            duration: 1,
            ease: 'power2.out'
        });
    });

    // --- Three.js Background ---
    const canvas = document.getElementById('weather-bg');
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Particles
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 15;
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.02,
        color: 0x6366f1,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Floating Blobs (Abstract)
    const blobGeo = new THREE.SphereGeometry(2, 64, 64);
    const blobMat = new THREE.MeshPhongMaterial({
        color: 0x6366f1,
        shininess: 100,
        transparent: true,
        opacity: 0.1,
    });
    const blob = new THREE.Mesh(blobGeo, blobMat);
    scene.add(blob);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Animation Loop
    function animateThree() {
        requestAnimationFrame(animateThree);
        
        particlesMesh.rotation.y += 0.001;
        particlesMesh.rotation.x += 0.0005;

        // Follow mouse slightly
        particlesMesh.position.x += (mouseX / window.innerWidth - 0.5) * 0.1 - particlesMesh.position.x * 0.05;
        particlesMesh.position.y += -(mouseY / window.innerHeight - 0.5) * 0.1 - particlesMesh.position.y * 0.05;

        blob.rotation.z += 0.002;
        blob.position.x = Math.sin(Date.now() * 0.001) * 0.5;
        blob.position.y = Math.cos(Date.now() * 0.001) * 0.5;

        renderer.render(scene, camera);
    }
    animateThree();

    // Handle Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Update Background based on Weather
    window.updatePremiumBackground = function(weatherType, isNight) {
        let color = 0x6366f1; // Default
        
        if (weatherType.includes('clear')) {
            color = isNight ? 0x1e293b : 0xfbbf24;
        } else if (weatherType.includes('cloud')) {
            color = 0x94a3b8;
        } else if (weatherType.includes('rain') || weatherType.includes('drizzle')) {
            color = 0x3b82f6;
        } else if (weatherType.includes('snow')) {
            color = 0xffffff;
        } else if (weatherType.includes('thunder')) {
            color = 0x4f46e5;
        }

        gsap.to(particlesMaterial.color, {
            r: new THREE.Color(color).r,
            g: new THREE.Color(color).g,
            b: new THREE.Color(color).b,
            duration: 2
        });
        gsap.to(blobMat.color, {
            r: new THREE.Color(color).r,
            g: new THREE.Color(color).g,
            b: new THREE.Color(color).b,
            duration: 2
        });
    };
})();

// Hook into existing updateDynamicBackground
const originalUpdateDynamicBackground = updateDynamicBackground;
updateDynamicBackground = function(data) {
    originalUpdateDynamicBackground(data);
    if (window.updatePremiumBackground) {
        const weatherType = (data.weather?.[0]?.main || '').toLowerCase();
        const isNight = data.weather?.[0]?.icon?.includes('n');
        window.updatePremiumBackground(weatherType, isNight);
    }
    
    // Animate entrance of new data
    gsap.from('.weather-app > *', {
        opacity: 0,
        y: 20,
        stagger: 0.1,
        duration: 0.8,
        ease: 'power3.out',
        overwrite: true
    });
};