class ForecastList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._forecastData = null;
        this._trendData = [];
        this._unit = 'C';
        this._lang = 'en';
        this._selectedHourlyMetric = 'humidity'; // humidity or precip
        this._selectedTrendMetric = 'avg'; // avg, high, low
        this._tempChart = null;
        this._humidityPrecipChart = null;
    }

    static get observedAttributes() {
        return ['lang', 'unit'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name === 'lang') {
            this._lang = newValue;
            this.updateTranslationsAndRedraw();
        } else if (name === 'unit') {
            this._unit = newValue;
            this.updateUnitAndRedraw();
        }
    }

    get forecastData() { return this._forecastData; }
    set forecastData(val) {
        this._forecastData = val;
        if (val) {
            this._trendData = this.buildDailyTrendData(val.list, val.city?.timezone || 0);
            this.render();
        }
    }

    connectedCallback() {
        this.render();
    }

    disconnectedCallback() {
        this.destroyCharts();
    }

    destroyCharts() {
        if (this._tempChart) {
            this._tempChart.destroy();
            this._tempChart = null;
        }
        if (this._humidityPrecipChart) {
            this._humidityPrecipChart.destroy();
            this._humidityPrecipChart = null;
        }
    }

    toUnit(kelvin) {
        const DEGREE = '\u00B0';
        if (this._unit === 'C') return `${Math.round(kelvin - 273.15)}${DEGREE}C`;
        if (this._unit === 'F') return `${Math.round((kelvin - 273.15) * 9 / 5 + 32)}${DEGREE}F`;
        return `${Math.round(kelvin)}K`;
    }

    toUnitNum(kelvin) {
        if (this._unit === 'C') return Math.round(kelvin - 273.15);
        if (this._unit === 'F') return Math.round((kelvin - 273.15) * 9 / 5 + 32);
        return Math.round(kelvin);
    }

    unitLabel() {
        const DEGREE = '\u00B0';
        if (this._unit === 'C') return `${DEGREE}C`;
        if (this._unit === 'F') return `${DEGREE}F`;
        return 'K';
    }

    getShiftedDate(unixSeconds, timezoneOffsetSeconds) {
        return new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
    }

    buildHourlyPoints(forecastList, timezoneOffsetSeconds, hoursAhead) {
        if (!Array.isArray(forecastList) || forecastList.length === 0) return [];
        const nowSeconds = Math.floor(Date.now() / 1000);
        const endSeconds = nowSeconds + hoursAhead * 60 * 60;
        const locale = this._lang === 'hi' ? 'hi-IN' : this._lang === 'es' ? 'es-ES' : this._lang === 'fr' ? 'fr-FR' : 'en-US';

        const points = forecastList
            .slice()
            .sort((a, b) => a.dt - b.dt)
            .filter((item) => item?.dt >= nowSeconds - 3600 && item?.dt <= endSeconds);

        return points.slice(0, 10).map((item) => {
            const localDate = this.getShiftedDate(item.dt, timezoneOffsetSeconds);
            return {
                raw: item,
                dt: item.dt,
                timeLabel: localDate.toLocaleTimeString(locale, { hour: 'numeric' }),
                humidity: item.main?.humidity ?? null,
                precipProb: item.pop ?? null,
                precipAmount: item.rain?.['3h'] ?? null
            };
        });
    }

    buildDailyTrendData(forecastList, timezoneOffsetSeconds) {
        const groupedDays = new Map();
        const locale = this._lang === 'hi' ? 'hi-IN' : this._lang === 'es' ? 'es-ES' : this._lang === 'fr' ? 'fr-FR' : 'en-US';

        forecastList.forEach((item) => {
            const localDate = this.getShiftedDate(item.dt, timezoneOffsetSeconds);
            const dateKey = localDate.toISOString().slice(0, 10);

            if (!groupedDays.has(dateKey)) {
                groupedDays.set(dateKey, {
                    dateKey,
                    dayLabel: localDate.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }),
                    dateLabel: localDate.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }),
                    temperatures: []
                });
            }
            groupedDays.get(dateKey).temperatures.push(item.main.temp);
        });

        return Array.from(groupedDays.values()).slice(0, 5).map((day) => {
            const high = Math.max(...day.temperatures);
            const low = Math.min(...day.temperatures);
            const avg = day.temperatures.reduce((total, temp) => total + temp, 0) / day.temperatures.length;
            return { ...day, high, low, avg };
        });
    }

    render() {
        if (!this._forecastData) {
            this.shadowRoot.innerHTML = '';
            return;
        }

        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                }

                @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes popIn { 0% { opacity: 0; transform: scale(0); } 100% { opacity: 1; transform: scale(1); } }

                .forecast-section {
                    animation: slideInRight 0.6s ease-out 0.2s both;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    margin-bottom: 24px;
                }
                .hourly-toggle-row {
                    display: flex;
                    gap: 8px;
                    margin: 0 0 12px 0;
                    flex-wrap: wrap;
                }
                .hourly-toggle {
                    border: none;
                    border-radius: 12px;
                    padding: 9px 14px;
                    background: #edf2f7;
                    color: #718096;
                    cursor: pointer;
                    font: inherit;
                    font-size: 13px;
                    font-weight: 700;
                    transition: all 0.2s ease;
                }
                .hourly-toggle:hover {
                    color: #4c51bf;
                    background: rgba(255, 255, 255, 0.72);
                }
                .hourly-toggle.active {
                    color: white;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    box-shadow: 0 6px 18px rgba(102, 126, 234, 0.25);
                }
                .forecast-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #2d3748;
                    letter-spacing: -0.5px;
                    transition: color 0.4s ease;
                    margin: 0 0 4px 0;
                }
                .forecast-subtitle {
                    font-size: 13px;
                    line-height: 1.6;
                    color: #718096;
                    transition: color 0.4s ease;
                    margin: 0 0 16px 0;
                }
                .forecast-graph-card {
                    background: linear-gradient(180deg, #eef4ff 0%, #f8fbff 100%);
                    border: 2px solid rgba(102, 126, 234, 0.15);
                    border-radius: 20px;
                    padding: 22px;
                    transition: all 0.3s ease;
                    box-sizing: border-box;
                    margin-bottom: 12px;
                }
                .forecast-graph-card:hover {
                    border-color: #667eea;
                    box-shadow: 0 15px 40px rgba(102, 126, 234, 0.1);
                }
                .graph-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 15px;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #667eea;
                }
                .graph-wrapper {
                    width: 100%;
                    height: 240px;
                    position: relative;
                }
                .forecast-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 14px;
                    margin-top: 14px;
                    margin-bottom: 24px;
                }
                .forecast-card {
                    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                    border-radius: 16px;
                    padding: 18px 14px;
                    text-align: center;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(102, 126, 234, 0.12);
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                }
                .forecast-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, transparent 0%, rgba(102, 126, 234, 0.1) 100%);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .forecast-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.1);
                    border-color: #667eea;
                }
                .forecast-card:hover::before {
                    opacity: 1;
                }
                .forecast-day {
                    font-size: 13px;
                    font-weight: 700;
                    color: #667eea;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .forecast-icon {
                    width: 45px;
                    height: 45px;
                    margin: 0 auto 10px;
                    transition: transform 0.3s ease;
                }
                .forecast-card:hover .forecast-icon {
                    transform: scale(1.1) rotate(5deg);
                }
                .forecast-icon img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .forecast-temp {
                    font-size: 16px;
                    font-weight: 700;
                    color: #2d3748;
                    margin-bottom: 4px;
                    transition: color 0.4s ease;
                }
                .forecast-desc {
                    font-size: 12px;
                    color: #718096;
                    text-transform: capitalize;
                    transition: color 0.4s ease;
                }

                /* Weather Trends */
                .weather-trends-section {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    animation: slideUp 0.6s ease-out 0.25s both;
                    width: 100%;
                    margin-bottom: 24px;
                }
                .trends-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                    align-items: center;
                }
                .trend-controls {
                    display: inline-flex;
                    gap: 6px;
                    padding: 5px;
                    background: #edf2f7;
                    border: 1px solid rgba(226, 232, 240, 0.9);
                    border-radius: 14px;
                    flex-shrink: 0;
                }
                .trend-toggle {
                    border: none;
                    border-radius: 10px;
                    padding: 9px 14px;
                    background: transparent;
                    color: #718096;
                    cursor: pointer;
                    font: inherit;
                    font-size: 13px;
                    font-weight: 700;
                    transition: all 0.2s ease;
                }
                .trend-toggle:hover {
                    color: #4c51bf;
                    background: rgba(255, 255, 255, 0.72);
                }
                .trend-toggle.active {
                    color: white;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    box-shadow: 0 6px 18px rgba(102, 126, 234, 0.25);
                }
                .trends-layout {
                    display: grid;
                    grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.8fr);
                    gap: 18px;
                    align-items: stretch;
                }
                .trend-chart-card {
                    background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
                    border: 2px solid rgba(102, 126, 234, 0.15);
                    border-radius: 20px;
                    padding: 22px;
                    transition: all 0.3s ease;
                    box-sizing: border-box;
                }
                .trend-chart-card:hover {
                    border-color: #667eea;
                    box-shadow: 0 15px 40px rgba(102, 126, 234, 0.1);
                }
                .trend-chart-wrapper {
                    height: 280px;
                    width: 100%;
                }
                #trend-chart {
                    --trend-color: #667eea;
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                }
                .trend-bar {
                    fill: rgba(102, 126, 234, 0.18);
                    stroke: rgba(102, 126, 234, 0.45);
                    stroke-width: 1;
                    transition: all 0.25s ease;
                }
                .trend-bar-group:hover .trend-bar {
                    fill: rgba(102, 126, 234, 0.28);
                }
                .trend-range-line {
                    stroke: rgba(45, 55, 72, 0.22);
                    stroke-width: 3;
                    stroke-linecap: round;
                }
                .trend-high-dot {
                    fill: #f97316;
                    stroke: white;
                    stroke-width: 2;
                    opacity: 0.9;
                }
                .trend-low-dot {
                    fill: #0ea5e9;
                    stroke: white;
                    stroke-width: 2;
                    opacity: 0.9;
                }
                .trend-line {
                    fill: none;
                    stroke: var(--trend-color);
                    stroke-width: 4;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-dasharray: 1000;
                    stroke-dashoffset: 0; /* Animated or static */
                }
                .trend-line-point {
                    fill: white;
                    stroke: var(--trend-color);
                    stroke-width: 3;
                    animation: popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                .trend-value-label {
                    paint-order: stroke;
                    stroke: #f8fbff;
                    stroke-width: 5px;
                    stroke-linejoin: round;
                }
                .graph-grid-line {
                    stroke: rgba(102, 126, 234, 0.15);
                    stroke-width: 1;
                    stroke-dasharray: 5 5;
                }
                .graph-axis-label {
                    fill: #718096;
                    font-size: 11px;
                    font-weight: 600;
                }
                .graph-point-label {
                    fill: #2d3748;
                    font-size: 12px;
                    font-weight: 700;
                }

                .trend-stats {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                }
                .trend-stat-card {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 14px;
                    padding: 16px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                    border: 1px solid rgba(102, 126, 234, 0.12);
                    transition: all 0.25s ease;
                    box-sizing: border-box;
                }
                .trend-stat-card:hover {
                    transform: translateY(-3px);
                    border-color: #667eea;
                    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
                }
                .trend-stat-date {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    min-width: 58px;
                }
                .trend-stat-date span {
                    color: #667eea;
                    font-size: 13px;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .trend-stat-date small {
                    color: #718096;
                    font-size: 12px;
                    font-weight: 600;
                }
                .trend-stat-values {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                    gap: 8px 12px;
                    font-size: 12px;
                    color: #718096;
                }
                .trend-stat-values strong {
                    color: #2d3748;
                }

                /* Dark mode scopes */
                :host-context(.dark-mode) .forecast-graph-card {
                    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
                    border-color: rgba(102, 126, 234, 0.2);
                }
                :host-context(.dark-mode) .forecast-title {
                    color: #f1f5f9;
                }
                :host-context(.dark-mode) .forecast-subtitle,
                :host-context(.dark-mode) .forecast-desc {
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .forecast-card {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-color: rgba(100, 116, 139, 0.2);
                }
                :host-context(.dark-mode) .forecast-card:hover {
                    border-color: #667eea;
                    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
                }
                :host-context(.dark-mode) .forecast-temp {
                    color: #f1f5f9;
                }
                :host-context(.dark-mode) .trend-controls {
                    background: rgba(30, 41, 59, 0.9);
                    border-color: rgba(100, 116, 139, 0.2);
                }
                :host-context(.dark-mode) .trend-toggle {
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .trend-toggle:hover {
                    color: #a5b4fc;
                    background: rgba(102, 126, 234, 0.15);
                }
                :host-context(.dark-mode) .hourly-toggle {
                    background: rgba(30, 41, 59, 0.9);
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .hourly-toggle.active {
                    color: white;
                }
                :host-context(.dark-mode) .trend-chart-card {
                    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
                    border-color: rgba(102, 126, 234, 0.2);
                }
                :host-context(.dark-mode) .trend-stat-card {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-color: rgba(100, 116, 139, 0.2);
                }
                :host-context(.dark-mode) .trend-stat-card:hover {
                    border-color: #667eea;
                }
                :host-context(.dark-mode) .trend-stat-values strong {
                    color: #f1f5f9;
                }
                :host-context(.dark-mode) .trend-stat-date span {
                    color: #a5b4fc;
                }
                :host-context(.dark-mode) .trend-stat-date small {
                    color: #64748b;
                }
                :host-context(.dark-mode) .trend-value-label {
                    stroke: #0f172a;
                }
                :host-context(.dark-mode) .graph-point-label {
                    fill: #f1f5f9;
                }
                :host-context(.dark-mode) .graph-axis-label {
                    fill: #94a3b8;
                }

                @media (max-width: 1024px) {
                    .trends-layout {
                        grid-template-columns: 1fr;
                    }
                }
                @media (max-width: 768px) {
                    .forecast-container {
                        grid-template-columns: repeat(3, 1fr);
                    }
                    .trends-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 12px;
                    }
                    .trend-controls {
                        width: 100%;
                    }
                    .trend-toggle {
                        flex: 1;
                        text-align: center;
                    }
                }
            </style>

            <div class="forecast-section">
                <!-- Temperature Chart Card -->
                <div class="forecast-graph-card">
                    <div class="graph-header">
                        <span>${t['next24Hours'] || 'Next 24 Hours'}</span>
                        <span id="graph-range">--</span>
                    </div>
                    <div class="graph-wrapper">
                        <canvas id="temperature-chart" aria-label="Temperature forecast chart"></canvas>
                    </div>
                </div>

                <!-- Humidity / Precip Chart Card -->
                <div class="forecast-graph-card">
                    <div class="graph-header">
                        <span>${t['humidityPrecip'] || 'Humidity & Precip (Next 24 Hours)'}</span>
                        <span id="humidity-precip-range">--</span>
                    </div>
                    <div class="hourly-toggle-row" role="group" aria-label="Hourly humidity and precipitation display">
                        <button type="button" class="hourly-toggle ${this._selectedHourlyMetric === 'humidity' ? 'active' : ''}" data-hourly-metric="humidity">${t['humidity'] || 'Humidity'}</button>
                        <button type="button" class="hourly-toggle ${this._selectedHourlyMetric === 'precip' ? 'active' : ''}" data-hourly-metric="precip">${t['precip'] || 'Precip'}</button>
                    </div>
                    <div class="graph-wrapper" style="height: 220px;">
                        <canvas id="humidity-precip-chart" aria-label="Humidity and precipitation forecast chart"></canvas>
                    </div>
                </div>

                <!-- 24-Hour Forecast cards -->
                <div>
                    <h3 class="forecast-title">${t['forecast24h'] || '24-Hour Forecast'}</h3>
                    <p class="forecast-subtitle" id="forecast-summary">${t['forecastDesc'] || 'Upcoming weather trend will appear here.'}</p>
                    <div class="forecast-container" id="forecast-container">
                        <!-- Hourly forecast cards -->
                    </div>
                </div>
            </div>

            <!-- Weather Trends Section -->
            <section class="weather-trends-section" aria-labelledby="weather-trends-title">
                <div class="trends-header">
                    <div>
                        <h3 class="forecast-title" id="weather-trends-title">${t['weatherTrends'] || 'Weather Trends'}</h3>
                        <p class="forecast-subtitle" id="trends-summary">${t['trendsDesc'] || 'Daily temperature insights will appear here.'}</p>
                    </div>
                    <div class="trend-controls" aria-label="Choose trend metric">
                        <button class="trend-toggle ${this._selectedTrendMetric === 'avg' ? 'active' : ''}" type="button" data-trend-metric="avg">${t['avg'] || 'Avg'}</button>
                        <button class="trend-toggle ${this._selectedTrendMetric === 'high' ? 'active' : ''}" type="button" data-trend-metric="high">${t['high'] || 'High'}</button>
                        <button class="trend-toggle ${this._selectedTrendMetric === 'low' ? 'active' : ''}" type="button" data-trend-metric="low">${t['low'] || 'Low'}</button>
                    </div>
                </div>

                <div class="trends-layout">
                    <div class="trend-chart-card">
                        <div class="graph-header">
                            <span id="trend-chart-label">${t['avgTemp'] || 'Average Temperature'}</span>
                            <span id="trend-chart-range">--</span>
                        </div>
                        <div class="trend-chart-wrapper">
                            <svg id="trend-chart" viewBox="0 0 760 280" preserveAspectRatio="none" aria-label="Daily temperature trend chart">
                                <!-- Trend chart rendered by JS -->
                            </svg>
                        </div>
                    </div>

                    <div class="trend-stats" id="trend-stats">
                        <!-- Daily trend stats -->
                    </div>
                </div>
            </section>
        `;

        this.setupToggles();
        this.renderHourlyForecastCards();
        this.renderCharts();
        this.renderWeatherTrends();
    }

    setupToggles() {
        const hourlyToggles = this.shadowRoot.querySelectorAll('.hourly-toggle');
        hourlyToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                this._selectedHourlyMetric = btn.dataset.hourlyMetric;
                hourlyToggles.forEach(b => b.classList.toggle('active', b === btn));
                this.renderHumidityPrecipChart();
            });
        });

        const trendToggles = this.shadowRoot.querySelectorAll('[data-trend-metric]');
        trendToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                this._selectedTrendMetric = btn.dataset.trendMetric;
                trendToggles.forEach(b => b.classList.toggle('active', b === btn));
                this.renderTrendChart();
            });
        });
    }

    renderHourlyForecastCards() {
        const container = this.shadowRoot.getElementById('forecast-container');
        if (!container) return;

        const timezoneOffsetSeconds = this._forecastData.city?.timezone || 0;
        const locale = this._lang === 'hi' ? 'hi-IN' : this._lang === 'es' ? 'es-ES' : this._lang === 'fr' ? 'fr-FR' : 'en-US';
        const ICON_URL = 'https://openweathermap.org/img/wn';

        const hoursAhead = 24;
        const nowSeconds = Math.floor(Date.now() / 1000);
        const endSeconds = nowSeconds + hoursAhead * 60 * 60;
        const points = this._forecastData.list
            .slice()
            .sort((a, b) => a.dt - b.dt)
            .filter((item) => item?.dt >= nowSeconds - 3600 && item?.dt <= endSeconds)
            .slice(0, 10);

        container.innerHTML = points.map(item => {
            const localDate = this.getShiftedDate(item.dt, timezoneOffsetSeconds);
            const timeLabel = localDate.toLocaleTimeString(locale, { hour: 'numeric', hour12: true });
            const iconCode = item.weather[0].icon;
            const temp = this.toUnitNum(item.main.temp);
            const desc = item.weather[0].description;

            return `
                <div class="forecast-card">
                    <div class="forecast-day">${timeLabel}</div>
                    <div class="forecast-icon">
                        <img src="${ICON_URL}/${iconCode}.png" alt="${desc}">
                    </div>
                    <div class="forecast-temp">${temp}${this.unitLabel()}</div>
                    <div class="forecast-desc">${desc}</div>
                </div>
            `;
        }).join('');
    }

    renderCharts() {
        this.destroyCharts();
        this.renderTemperatureChart();
        this.renderHumidityPrecipChart();
    }

    renderTemperatureChart() {
        const canvas = this.shadowRoot.getElementById('temperature-chart');
        if (!canvas) return;

        const timezoneOffsetSeconds = this._forecastData.city?.timezone || 0;
        const hoursAhead = 24;
        const nowSeconds = Math.floor(Date.now() / 1000);
        const endSeconds = nowSeconds + hoursAhead * 60 * 60;
        const hourlyData = this._forecastData.list
            .slice()
            .sort((a, b) => a.dt - b.dt)
            .filter((item) => item?.dt >= nowSeconds - 3600 && item?.dt <= endSeconds)
            .slice(0, 10);

        if (!hourlyData.length) return;

        const locale = this._lang === 'hi' ? 'hi-IN' : this._lang === 'es' ? 'es-ES' : this._lang === 'fr' ? 'fr-FR' : 'en-US';
        const labels = hourlyData.map(item => {
            const date = new Date(item.dt * 1000);
            return date.toLocaleTimeString(locale, { hour: 'numeric', hour12: true });
        });

        const temperatures = hourlyData.map(item => this.toUnitNum(item.main.temp));

        const minTemp = Math.min(...temperatures);
        const maxTemp = Math.max(...temperatures);
        const graphRange = this.shadowRoot.getElementById('graph-range');
        if (graphRange) graphRange.textContent = `${minTemp}${this.unitLabel()} - ${maxTemp}${this.unitLabel()}`;

        // Set summary
        const forecastSummary = this.shadowRoot.getElementById('forecast-summary');
        if (forecastSummary) {
            const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
            const trend = temperatures[temperatures.length - 1] > temperatures[0]
                ? (this._lang === 'hi' ? 'तापमान में बढ़ोतरी होगी' : 'Temperatures are expected to rise')
                : (this._lang === 'hi' ? 'तापमान में गिरावट होगी' : 'Temperatures are expected to fall');
            forecastSummary.textContent = `${trend} (${minTemp}${this.unitLabel()} - ${maxTemp}${this.unitLabel()}).`;
        }

        const data = {
            labels: labels,
            datasets: [{
                label: `Temperature (${this.unitLabel()})`,
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
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: { callback: (value) => value + this.unitLabel() }
                    }
                }
            }
        };

        if (window.Chart) {
            this._tempChart = new window.Chart(canvas, config);
        }
    }

    renderHumidityPrecipChart() {
        const canvas = this.shadowRoot.getElementById('humidity-precip-chart');
        const rangeEl = this.shadowRoot.getElementById('humidity-precip-range');
        if (!canvas || !rangeEl) return;

        const timezoneOffsetSeconds = this._forecastData.city?.timezone || 0;
        const hourlyPoints = this.buildHourlyPoints(this._forecastData.list, timezoneOffsetSeconds, 24);

        if (hourlyPoints.length === 0) {
            rangeEl.textContent = '--';
            return;
        }

        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        const metric = this._selectedHourlyMetric;
        const labels = hourlyPoints.map(p => p.timeLabel);
        const values = hourlyPoints.map(p => {
            if (metric === 'humidity') return p.humidity || 0;
            return (p.precipProb || 0) * 100;
        });

        const data = {
            labels: labels,
            datasets: [{
                label: metric === 'humidity' ? `${t['humidity'] || 'Humidity'} (%)` : `${t['precip'] || 'Precipitation'} (%)`,
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
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { callback: (value) => value + '%' }
                    }
                }
            }
        };

        if (this._humidityPrecipChart) {
            this._humidityPrecipChart.destroy();
        }

        if (window.Chart) {
            this._humidityPrecipChart = new window.Chart(canvas, config);
        }

        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        rangeEl.textContent = `${minV}% - ${maxV}%`;
    }

    renderWeatherTrends() {
        const trendStatsEl = this.shadowRoot.getElementById('trend-stats');
        const trendsSummaryEl = this.shadowRoot.getElementById('trends-summary');
        if (!trendStatsEl || !this._trendData.length) return;

        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};

        // Render stats cards
        trendStatsEl.innerHTML = this._trendData.map(day => `
            <div class="trend-stat-card">
                <div class="trend-stat-date">
                    <span>${day.dayLabel}</span>
                    <small>${day.dateLabel}</small>
                </div>
                <div class="trend-stat-values">
                    <span><strong>${this.toUnitNum(day.high)}${this.unitLabel()}</strong> ${t['high'] ? t['high'].toLowerCase() : 'high'}</span>
                    <span><strong>${this.toUnitNum(day.low)}${this.unitLabel()}</strong> ${t['low'] ? t['low'].toLowerCase() : 'low'}</span>
                    <span><strong>${this.toUnitNum(day.avg)}${this.unitLabel()}</strong> ${t['avg'] ? t['avg'].toLowerCase() : 'avg'}</span>
                </div>
            </div>
        `).join('');

        // Update summary text
        const avgs = this._trendData.map(day => this.toUnitNum(day.avg));
        const overallAvg = Math.round(avgs.reduce((sum, v) => sum + v, 0) / avgs.length);
        if (trendsSummaryEl) {
            trendsSummaryEl.textContent = this._lang === 'hi' 
                ? `अगले 5 दिनों का औसत तापमान लगभग ${overallAvg}${this.unitLabel()} रहेगा।`
                : `Average temperature over the next 5 days will be around ${overallAvg}${this.unitLabel()}.`;
        }

        this.renderTrendChart();
    }

    renderTrendChart() {
        const trendChart = this.shadowRoot.getElementById('trend-chart');
        const labelEl = this.shadowRoot.getElementById('trend-chart-label');
        const rangeEl = this.shadowRoot.getElementById('trend-chart-range');
        if (!trendChart || !this._trendData.length) return;

        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        const metricLabels = {
            high: t['high'] || 'Daily High Temperature',
            low: t['low'] || 'Daily Low Temperature',
            avg: t['avgTemp'] || 'Daily Average Temperature'
        };
        const metricColors = {
            high: '#f97316',
            low: '#0ea5e9',
            avg: '#667eea'
        };
        const metric = this._selectedTrendMetric;
        const width = 760;
        const height = 280;
        const padding = { top: 46, right: 42, bottom: 48, left: 54 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;
        const values = this._trendData.map((day) => this.toUnitNum(day[metric]));
        const lowValues = this._trendData.map((day) => this.toUnitNum(day.low));
        const highValues = this._trendData.map((day) => this.toUnitNum(day.high));
        const minValue = Math.floor(Math.min(...lowValues) - 1);
        const maxValue = Math.ceil(Math.max(...highValues) + 1);
        const range = Math.max(maxValue - minValue, 1);
        const barWidth = Math.min(58, innerWidth / this._trendData.length * 0.45);

        const getY = (value) => padding.top + ((maxValue - value) / range) * innerHeight;
        const points = this._trendData.map((day, index) => {
            const x = padding.left + (index * innerWidth) / Math.max(this._trendData.length - 1, 1);
            const val = this.toUnitNum(day[metric]);
            return { ...day, x, y: getY(val), value: val };
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
                <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="graph-axis-label">${value}${this.unitLabel()}</text>
            `;
        }).join('');
        const labels = points.map((point) => `
            <g transform="translate(${point.x}, ${point.y})">
                <circle r="5" class="trend-line-point"></circle>
                <text y="-18" text-anchor="middle" class="graph-point-label trend-value-label">${Math.round(point.value)}${this.unitLabel()}</text>
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

        if (labelEl) labelEl.textContent = metricLabels[metric];
        if (rangeEl) rangeEl.textContent = `${Math.round(Math.min(...values))}${this.unitLabel()} - ${Math.round(Math.max(...values))}${this.unitLabel()}`;
    }

    updateUnitAndRedraw() {
        if (!this._forecastData) return;
        this._trendData = this.buildDailyTrendData(this._forecastData.list, this._forecastData.city?.timezone || 0);
        this.render();
    }

    updateTranslationsAndRedraw() {
        if (!this._forecastData) return;
        this._trendData = this.buildDailyTrendData(this._forecastData.list, this._forecastData.city?.timezone || 0);
        this.render();
    }
}

customElements.define('forecast-list', ForecastList);
