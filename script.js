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
let sunTimeline = null;

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
