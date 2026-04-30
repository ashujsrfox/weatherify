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
const locateBtn = document.getElementById('locate-btn'); // ✅ NEW
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
locateBtn.addEventListener('click', handleLocate); // ✅ NEW

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

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
        hideSuggestions();
    }
});

// ✅ AUTO LOAD (UPDATED)
window.addEventListener('DOMContentLoaded', () => {
    if (navigator.geolocation) {
        handleLocate();
    } else {
        fetchWeatherData('London');
    }
});

// 🔍 SEARCH
function handleSearch() {
    const city = cityInput.value.trim();
    if (city) {
        fetchWeatherData(city);
    }
}

// 📍 LOCATE ME FEATURE (CORE)
async function handleLocate() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported.");
        return;
    }

    showLoading();
    hideError();
    hideWeather();

    locateBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;

            try {
                const [currentResponse, forecastResponse] = await Promise.all([
                    fetch(`${API_BASE}/weather?lat=${latitude}&lon=${longitude}&units=metric`),
                    fetch(`${API_BASE}/forecast?lat=${latitude}&lon=${longitude}&units=metric`)
                ]);

                if (!currentResponse.ok) {
                    const err = await parseJsonSafe(currentResponse);
                    throw new Error(err?.message || "Weather fetch failed");
                }

                if (!forecastResponse.ok) {
                    const err = await parseJsonSafe(forecastResponse);
                    throw new Error(err?.message || "Forecast fetch failed");
                }

                const currentData = await currentResponse.json();
                const forecastData = await forecastResponse.json();

                updateUI(currentData);
                updateForecastUI(forecastData);
                showWeather();

            } catch (error) {
                console.error(error);
                showError(error.message);
            } finally {
                hideLoading();
                locateBtn.disabled = false;
            }
        },
        (error) => {
            if (error.code === error.PERMISSION_DENIED) {
                showError("Location permission denied.");
            } else {
                showError("Unable to retrieve location.");
            }

            hideLoading();
            locateBtn.disabled = false;
        }
    );
}

// 🌐 FETCH WEATHER (CITY)
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
            const err = await parseJsonSafe(currentResponse);
            throw new Error(err?.message || "City not found");
        }

        if (!forecastResponse.ok) {
            const err = await parseJsonSafe(forecastResponse);
            throw new Error(err?.message || "Forecast unavailable");
        }

        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();

        updateUI(currentData);
        updateForecastUI(forecastData);
        showWeather();

    } catch (error) {
        console.error(error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// ⚡ (REST OF YOUR CODE REMAINS SAME)
// 👉 No changes below this line (UI updates, graph, sun tracking, etc.)