class CurrentWeather extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._weatherData = null;
        this._aqiData = null;
        this._unit = 'C';
        this._lang = 'en';
        this._isFavorite = false;
        this._sunTimer = null;
    }

    static get observedAttributes() {
        return ['lang', 'unit', 'is-favorite'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name === 'lang') {
            this._lang = newValue;
            this.updateTranslations();
        } else if (name === 'unit') {
            this._unit = newValue;
            this.updateUnit();
        } else if (name === 'is-favorite') {
            this._isFavorite = this.hasAttribute('is-favorite');
            this.updateFavoriteButton();
        }
    }

    get weatherData() { return this._weatherData; }
    set weatherData(val) {
        this._weatherData = val;
        this.render();
    }

    get aqiData() { return this._aqiData; }
    set aqiData(val) {
        this._aqiData = val;
        this.renderAqi();
    }

    connectedCallback() {
        this.render();
        this._sunTimer = setInterval(() => this.renderSunPosition(), 60000);
    }

    disconnectedCallback() {
        if (this._sunTimer) {
            clearInterval(this._sunTimer);
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

    getWindDirection(deg) {
        if (deg === undefined || deg === null) return '';
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(deg / 45) % 8;
        const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
        return `${directions[index]} ${arrows[index]}`;
    }

    getAqiCategory(aqi) {
        const value = Number(aqi);
        if (!Number.isFinite(value)) {
            return { label: 'Unknown', level: 0, badgeClass: '' };
        }
        switch (value) {
            case 1: return { label: 'Good', level: 1, badgeClass: 'aqi-1' };
            case 2: return { label: 'Fair', level: 2, badgeClass: 'aqi-2' };
            case 3: return { label: 'Moderate', level: 3, badgeClass: 'aqi-3' };
            case 4: return { label: 'Poor', level: 4, badgeClass: 'aqi-4' };
            case 5: return { label: 'Very Poor', level: 5, badgeClass: 'aqi-5' };
            default:
                if (value <= 50) return { label: 'Good', level: 1, badgeClass: 'aqi-1' };
                if (value <= 100) return { label: 'Fair', level: 2, badgeClass: 'aqi-2' };
                if (value <= 150) return { label: 'Moderate', level: 3, badgeClass: 'aqi-3' };
                if (value <= 200) return { label: 'Poor', level: 4, badgeClass: 'aqi-4' };
                return { label: 'Very Poor', level: 5, badgeClass: 'aqi-5' };
        }
    }

    getAqiHealthRecommendation(categoryLabel) {
        switch (categoryLabel) {
            case 'Good': return 'Enjoy outdoor activities. Sensitive groups may still consider monitoring.';
            case 'Fair': return 'Unusually sensitive individuals should reduce prolonged outdoor exertion.';
            case 'Moderate': return 'Consider reducing prolonged outdoor activities if you experience symptoms.';
            case 'Poor': return 'Limit outdoor activity; keep windows closed and consider an air purifier.';
            case 'Very Poor': return 'Avoid outdoor activity. Stay indoors and follow local health guidance.';
            default: return 'Air quality information is unavailable right now.';
        }
    }

    getShiftedDate(unixSeconds, timezoneOffsetSeconds) {
        return new Date((unixSeconds + timezoneOffsetSeconds) * 1000);
    }

    formatDateAtOffset(unixSeconds, timezoneOffsetSeconds) {
        const locale = this._lang === 'hi' ? 'hi-IN' : this._lang === 'es' ? 'es-ES' : this._lang === 'fr' ? 'fr-FR' : 'en-US';
        return this.getShiftedDate(unixSeconds, timezoneOffsetSeconds).toLocaleDateString(locale, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
    }

    formatTimeAtOffset(unixSeconds, timezoneOffsetSeconds) {
        const locale = this._lang === 'hi' ? 'hi-IN' : this._lang === 'es' ? 'es-ES' : this._lang === 'fr' ? 'fr-FR' : 'en-US';
        return this.getShiftedDate(unixSeconds, timezoneOffsetSeconds).toLocaleTimeString(locale, {
            hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
        });
    }

    getNextSunriseSeconds(todaySunrise, nowSeconds) {
        const daySeconds = 24 * 60 * 60;
        const daysAhead = Math.floor((nowSeconds - todaySunrise) / daySeconds) + 1;
        return todaySunrise + daysAhead * daySeconds;
    }

    formatDuration(seconds) {
        const totalMinutes = Math.max(0, Math.round(seconds / 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const hStr = this._lang === 'hi' ? 'घं' : 'h';
        const mStr = this._lang === 'hi' ? 'मि' : 'm';
        if (hours === 0) return `${minutes}${mStr}`;
        if (minutes === 0) return `${hours}${hStr}`;
        return `${hours}${hStr} ${minutes}${mStr}`;
    }

    render() {
        if (!this._weatherData) {
            this.shadowRoot.innerHTML = '';
            return;
        }

        const data = this._weatherData;
        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        const ICON_URL = 'https://openweathermap.org/img/wn';
        const iconCode = data.weather[0].icon;

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                }
                
                @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                @keyframes float { 0%, 100% { transform: translate(-50%, -50%) translateY(0); } 50% { transform: translate(-50%, -50%) translateY(-8px); } }
                @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }

                .weather-main {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    grid-template-rows: auto 1fr;
                    gap: 1.25rem;
                    width: 100%;
                    min-width: 0;
                    align-items: stretch;
                    margin-bottom: 24px;
                }
                .location-info {
                    grid-column: 1 / -1;
                    grid-row: 1;
                    animation: slideInLeft 0.6s ease-out;
                    width: 100%;
                    text-align: left;
                    position: relative;
                }
                .city-header-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    position: relative;
                }
                #city-name {
                    font-size: 26px;
                    font-weight: 700;
                    color: #2d3748;
                    margin: 0;
                    letter-spacing: -0.5px;
                    transition: color 0.4s ease;
                }
                .city-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .share-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 8px 14px;
                    border: 1.5px solid rgba(102, 126, 234, 0.3);
                    border-radius: 50px;
                    background: rgba(102, 126, 234, 0.08);
                    color: #2d3748;
                    font-family: inherit;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.3s ease, border-color 0.3s ease, transform 0.15s ease;
                    white-space: nowrap;
                }
                .share-btn:hover {
                    background: rgba(102, 126, 234, 0.15);
                    border-color: #667eea;
                    transform: translateY(-1px);
                }
                .favorite-btn {
                    border: none;
                    background: transparent;
                    color: #f59e0b;
                    font-size: 1.6rem;
                    line-height: 1;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                    padding: 0;
                }
                .favorite-btn:hover {
                    transform: scale(1.1);
                }
                .share-menu {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 36px;
                    width: min(220px, 100%);
                    padding: 12px;
                    border-radius: 18px;
                    background: white;
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    box-sizing: border-box;
                }
                .share-menu.hidden {
                    display: none;
                }
                .share-menu-item {
                    border: none;
                    background: transparent;
                    padding: 10px 12px;
                    border-radius: 10px;
                    font-family: inherit;
                    font-size: 14px;
                    font-weight: 600;
                    text-align: left;
                    cursor: pointer;
                    transition: background 0.2s ease;
                    color: #2d3748;
                }
                .share-menu-item:hover {
                    background: rgba(102, 126, 234, 0.14);
                }
                .share-status-text {
                    font-size: 12px;
                    color: #475569;
                    min-height: 18px;
                    padding: 0 4px;
                }
                #date {
                    font-size: 13px;
                    color: #718096;
                    font-weight: 500;
                    margin: 3px 0 0 0;
                    transition: color 0.4s ease;
                }

                .temperature-section {
                    grid-column: 1;
                    grid-row: 2;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 28px 26px;
                    background: linear-gradient(145deg, #f0f4ff 0%, #e8eeff 40%, #f5f0ff 100%);
                    border-radius: 24px;
                    animation: slideInLeft 0.6s ease-out 0.2s both;
                    border: 1px solid rgba(102, 126, 234, 0.15);
                    position: relative;
                    transition: background 0.4s ease, border-color 0.4s ease;
                    min-height: 220px;
                }
                .weather-icon {
                    width: 100px;
                    height: 100px;
                    animation: bounce 2s ease-in-out infinite;
                }
                .weather-icon img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.1));
                }
                .temperature {
                    display: flex;
                    align-items: flex-start;
                    gap: 5px;
                }
                #temp {
                    font-size: 64px;
                    font-weight: 300;
                    line-height: 1;
                    color: #2d3748;
                    letter-spacing: -2px;
                    transition: color 0.4s ease;
                }
                .unit {
                    font-size: 24px;
                    font-weight: 400;
                    color: #718096;
                    margin-top: 8px;
                    transition: color 0.4s ease;
                }
                #weather-desc {
                    font-size: 16px;
                    color: #718096;
                    text-transform: capitalize;
                    font-weight: 500;
                    margin: 0;
                    transition: color 0.4s ease;
                }
                .feels-like-main {
                    font-size: 14px;
                    color: #94a3b8;
                    font-weight: 500;
                    margin: 0;
                    transition: color 0.4s ease;
                }

                /* Sun Track Card */
                .sun-position-card {
                    grid-column: 2;
                    grid-row: 2;
                    background: linear-gradient(135deg, #fff7dd 0%, #fff2c5 100%);
                    border: 2px solid rgba(217, 119, 6, 0.2);
                    border-radius: 20px;
                    padding: 20px 24px;
                    transition: all 0.3s ease;
                    box-shadow: 0 10px 30px rgba(217, 119, 6, 0.1);
                    animation: slideInLeft 0.6s ease-out 0.1s both;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    box-sizing: border-box;
                }
                .sun-position-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 15px 40px rgba(217, 119, 6, 0.15);
                }
                .sun-position-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .sun-position-header h3 {
                    font-size: 14px;
                    font-weight: 700;
                    color: #7c4a03;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin: 0;
                }
                #sun-phase {
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    color: #b45309;
                    background: rgba(180, 83, 9, 0.1);
                    padding: 4px 10px;
                    border-radius: 6px;
                }
                .sun-track {
                    position: relative;
                    height: 50px;
                    margin-bottom: 15px;
                }
                .sun-track-line {
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    height: 6px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #f59e0b 0%, #facc15 50%, #f97316 100%);
                    opacity: 0.4;
                }
                .sun-track-marker {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(circle at 30% 30%, #fff9c4 0%, #fbbf24 55%, #f59e0b 100%);
                    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4), inset -2px -2px 5px rgba(0, 0, 0, 0.1);
                    animation: float 3s ease-in-out infinite;
                }
                .sun-icon {
                    font-size: 20px;
                    line-height: 1;
                }
                .sun-position-meta {
                    display: flex;
                    justify-content: space-between;
                    gap: 15px;
                    font-size: 12px;
                    color: #8a5a13;
                    font-weight: 500;
                }

                /* Details Grid */
                .weather-details {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
                    gap: 1rem;
                    animation: slideInLeft 0.6s ease-out 0.3s both;
                    width: 100%;
                }
                .detail-card {
                    background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                    border-radius: 16px;
                    padding: 18px 16px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s ease;
                    border: 1px solid rgba(102, 126, 234, 0.12);
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                }
                .detail-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, transparent 0%, rgba(102, 126, 234, 0.1) 100%);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .detail-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.1);
                    border-color: #667eea;
                }
                .detail-card:hover::before {
                    opacity: 1;
                }
                .detail-icon {
                    color: #667eea;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .detail-info {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    text-align: center;
                }
                .detail-label {
                    font-size: 11px;
                    color: #718096;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    font-weight: 600;
                    transition: color 0.4s ease;
                }
                .detail-value {
                    font-size: 16px;
                    font-weight: 700;
                    color: #2d3748;
                    transition: color 0.4s ease;
                }
                
                /* AQI Card Detail */
                #aqi-card {
                    grid-column: span 2;
                }
                .aqi-value {
                    font-size: 1.2rem;
                    font-weight: 800;
                    color: #1f2937;
                }
                .aqi-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 5px 12px;
                    border-radius: 999px;
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    white-space: nowrap;
                }
                .aqi-1 { background: #16a34a; }
                .aqi-2 { background: #fbbf24; color: #1f2937; }
                .aqi-3 { background: #f97316; }
                .aqi-4 { background: #dc2626; }
                .aqi-5 { background: #9333ea; }
                .aqi-pollutants,
                .aqi-recommendation {
                    font-size: 11px;
                    line-height: 1.5;
                    color: #475569;
                    margin-top: 6px;
                    text-align: center;
                    max-width: 320px;
                    overflow: hidden;
                    display: -webkit-box;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                    line-clamp: 2;
                }
                
                /* Compass Needle */
                .compass-container {
                    display: inline-block;
                    margin-left: 10px;
                    vertical-align: middle;
                }
                #wind-compass-icon {
                    transition: transform 0.5s ease-in-out;
                    fill: currentColor;
                }

                /* Dark mode scopes */
                :host-context(.dark-mode) #city-name, 
                :host-context(.dark-mode) #temp {
                    color: #f1f5f9;
                }
                :host-context(.dark-mode) #date, 
                :host-context(.dark-mode) #weather-desc, 
                :host-context(.dark-mode) .unit, 
                :host-context(.dark-mode) .feels-like-main,
                :host-context(.dark-mode) .detail-label {
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .temperature-section {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-color: rgba(100, 116, 139, 0.2);
                }
                :host-context(.dark-mode) .sun-position-card {
                    background: linear-gradient(135deg, #2a1f0a 0%, #1f1506 100%);
                    border-color: rgba(217, 119, 6, 0.3);
                }
                :host-context(.dark-mode) .sun-position-header h3 {
                    color: #fbbf24;
                }
                :host-context(.dark-mode) #sun-phase {
                    color: #fbbf24;
                    background: rgba(251, 191, 36, 0.1);
                }
                :host-context(.dark-mode) .sun-position-meta {
                    color: #d97706;
                }
                :host-context(.dark-mode) .share-btn {
                    color: #f8fafc;
                    border-color: rgba(148, 163, 184, 0.4);
                    background: rgba(102, 126, 234, 0.22);
                }
                :host-context(.dark-mode) .share-menu {
                    background: rgba(15, 23, 42, 0.96);
                    border-color: rgba(148, 163, 184, 0.24);
                    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
                }
                :host-context(.dark-mode) .share-menu-item {
                    background: rgba(255, 255, 255, 0.05);
                    color: #e2e8f0;
                }
                :host-context(.dark-mode) .share-menu-item:hover {
                    background: rgba(255, 255, 255, 0.12);
                }
                :host-context(.dark-mode) .share-status-text {
                    color: #cbd5e1;
                }
                :host-context(.dark-mode) .detail-card {
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-color: rgba(100, 116, 139, 0.2);
                }
                :host-context(.dark-mode) .detail-card:hover {
                    border-color: #667eea;
                    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
                }
                :host-context(.dark-mode) .detail-value,
                :host-context(.dark-mode) .aqi-value {
                    color: #f1f5f9;
                }
                :host-context(.dark-mode) .aqi-pollutants,
                :host-context(.dark-mode) .aqi-recommendation {
                    color: #94a3b8;
                }

                @media (max-width: 768px) {
                    .weather-main {
                        grid-template-columns: 1fr;
                        grid-template-rows: auto auto auto;
                    }
                    .temperature-section {
                        grid-column: 1;
                        grid-row: 2;
                    }
                    .sun-position-card {
                        grid-column: 1;
                        grid-row: 3;
                    }
                    .weather-details {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    #aqi-card {
                        grid-column: span 2;
                    }
                }
            </style>
            
            <div class="weather-main">
                <div class="location-info">
                    <div class="city-header-row">
                        <h2 id="city-name">${data.name}, ${data.sys.country}</h2>
                        <div class="city-header-actions">
                            <button id="share-btn" class="share-btn" type="button" aria-haspopup="true" aria-expanded="false">${t['share'] || 'Share'}</button>
                            <button id="favorite-btn" class="favorite-btn" type="button" aria-label="Toggle favorite" aria-pressed="${this._isFavorite}">
                                <span class="favorite-icon">${this._isFavorite ? '★' : '☆'}</span>
                            </button>
                        </div>
                    </div>
                    <div id="share-menu" class="share-menu hidden" role="menu" aria-label="Share weather options">
                        <button type="button" id="copy-link-btn" class="share-menu-item">${t['copyLink'] || 'Copy Link'}</button>
                        <button type="button" id="copy-summary-btn" class="share-menu-item">${t['copySummary'] || 'Copy Summary'}</button>
                        <span id="share-status-text" class="share-status-text" aria-live="polite"></span>
                    </div>
                    <p id="date">${this.formatDateAtOffset(Math.floor(Date.now() / 1000), data.timezone)}</p>
                </div>

                <div class="temperature-section">
                    <div class="weather-icon">
                        <img src="${ICON_URL}/${iconCode}@4x.png" alt="${data.weather[0].description}">
                    </div>
                    <div class="temperature">
                        <span id="temp">${this.toUnitNum(data.main.temp)}</span>
                        <span class="unit">${this.unitLabel()}</span>
                    </div>
                    <p id="weather-desc">${data.weather[0].description}</p>
                    <p id="feels-like-main" class="feels-like-main">${t['feelsLikeMain'] ? t['feelsLikeMain'].replace('--°', this.toUnit(data.main.feels_like)) : `Feels like ${this.toUnit(data.main.feels_like)}`}</p>
                </div>

                <div class="sun-position-card">
                    <div class="sun-position-header">
                        <h3>${t['sunPosition'] || 'Sun Position'}</h3>
                        <span id="sun-phase">--</span>
                    </div>
                    <div class="sun-track" aria-label="Sun position for searched location">
                        <div class="sun-track-line"></div>
                        <div class="sun-track-marker" id="sun-marker">
                            <span class="sun-icon">&#9728;</span>
                        </div>
                    </div>
                    <div class="sun-position-meta">
                        <span id="sun-progress">--</span>
                        <span id="solar-noon">--</span>
                    </div>
                </div>
            </div>

            <div class="weather-details">
                <div class="detail-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['feelsLike'] || 'Feels Like'}</span>
                        <span class="detail-value" id="feels-like">${this.toUnit(data.main.feels_like)}</span>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['humidity'] || 'Humidity'}</span>
                        <span class="detail-value" id="humidity">${data.main.humidity}%</span>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['windSpeed'] || 'Wind Speed'}</span>
                        <span class="detail-value" id="wind-speed">
                            ${Math.round(data.wind.speed * 3.6)} km/h ${this.getWindDirection(data.wind.deg)}
                            <div class="compass-container">
                                <svg id="wind-compass-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style="transform: rotate(${data.wind.deg || 0}deg);">
                                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
                                    <text x="12" y="6" font-size="5" font-weight="bold" text-anchor="middle">N</text>
                                    <polygon points="12,7 9,15 12,13 15,15" />
                                </svg>
                            </div>
                        </span>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['pressure'] || 'Pressure'}</span>
                        <span class="detail-value" id="pressure">${data.main.pressure} hPa</span>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['visibility'] || 'Visibility'}</span>
                        <span class="detail-value" id="visibility">${(data.visibility / 1000).toFixed(1)} km</span>
                    </div>
                </div>

                <div class="detail-card" id="aqi-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73L12 2 4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L12 22l8-4.27a2 2 0 0 0 1-1.73Z"></path>
                            <path d="M12 22V12"></path>
                            <path d="M21 8l-9 4-9-4"></path>
                        </svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['aqi'] || 'Air Quality (AQI)'}</span>
                        <span class="detail-value" style="display:flex; align-items:center; gap:10px;">
                            <span class="aqi-value" id="aqi-value">--</span>
                            <span class="aqi-badge" id="aqi-badge">--</span>
                        </span>
                        <span class="aqi-pollutants" id="aqi-pollutants">Pollutants --</span>
                        <span class="aqi-recommendation" id="aqi-recommendation">Recommendation --</span>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="9" x2="12" y2="2"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line></svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['sunrise'] || 'Sunrise'}</span>
                        <span class="detail-value" id="sunrise">${this.formatTimeAtOffset(data.sys.sunrise, data.timezone)}</span>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="2" x2="12" y2="9"></line><line x1="4.22" y1="13.78" x2="5.64" y2="12.36"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="12.36" x2="19.78" y2="13.78"></line><line x1="23" y1="22" x2="1" y2="22"></line></svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['sunset'] || 'Sunset'}</span>
                        <span class="detail-value" id="sunset">${this.formatTimeAtOffset(data.sys.sunset, data.timezone)}</span>
                    </div>
                </div>

                <div class="detail-card">
                    <div class="detail-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                    </div>
                    <div class="detail-info">
                        <span class="detail-label">${t['uvIndex'] || 'UV Index'}</span>
                        <span class="detail-value" id="uv-index">--</span>
                    </div>
                </div>
            </div>
        `;

        this.setupShareAndFavorite();
        this.renderSunPosition();
        this.renderAqi();
    }

    setupShareAndFavorite() {
        const shareBtn = this.shadowRoot.getElementById('share-btn');
        const shareMenu = this.shadowRoot.getElementById('share-menu');
        const copyLinkBtn = this.shadowRoot.getElementById('copy-link-btn');
        const copySummaryBtn = this.shadowRoot.getElementById('copy-summary-btn');
        const favoriteBtn = this.shadowRoot.getElementById('favorite-btn');

        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = shareMenu.classList.contains('hidden');
                shareMenu.classList.toggle('hidden', !isHidden);
                shareBtn.setAttribute('aria-expanded', String(isHidden));
            });
        }

        if (copyLinkBtn) {
            copyLinkBtn.addEventListener('click', async () => {
                const link = this.getShareableLink();
                const copied = await this.copyTextToClipboard(link);
                this.showShareStatus(copied ? 'Link copied!' : 'Failed to copy.');
                if (copied) setTimeout(() => this.toggleShareMenu(false), 900);
            });
        }

        if (copySummaryBtn) {
            copySummaryBtn.addEventListener('click', async () => {
                const summary = this.getShareSummary();
                const copied = await this.copyTextToClipboard(summary);
                this.showShareStatus(copied ? 'Summary copied!' : 'Failed to copy.');
                if (copied) setTimeout(() => this.toggleShareMenu(false), 900);
            });
        }

        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('toggle-favorite', {
                    detail: {
                        query: `${this._weatherData.name},${this._weatherData.sys.country}`,
                        label: `${this._weatherData.name}, ${this._weatherData.sys.country}`
                    },
                    bubbles: true,
                    composed: true
                }));
            });
        }

        document.addEventListener('click', (e) => {
            const path = e.composedPath();
            if (!path.includes(shareBtn) && !path.includes(shareMenu)) {
                this.toggleShareMenu(false);
            }
        });
    }

    toggleShareMenu(show) {
        const shareMenu = this.shadowRoot.getElementById('share-menu');
        const shareBtn = this.shadowRoot.getElementById('share-btn');
        if (shareMenu && shareBtn) {
            shareMenu.classList.toggle('hidden', !show);
            shareBtn.setAttribute('aria-expanded', String(show));
            if (!show) this.showShareStatus('');
        }
    }

    showShareStatus(msg) {
        const status = this.shadowRoot.getElementById('share-status-text');
        if (status) status.textContent = msg;
    }

    async copyTextToClipboard(text) {
        if (!text) return false;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {}
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        this.shadowRoot.appendChild(textarea);
        textarea.select();
        let success = false;
        try {
            success = document.execCommand('copy');
        } catch {
            success = false;
        }
        this.shadowRoot.removeChild(textarea);
        return success;
    }

    getShareableLink() {
        const city = `${this._weatherData.name},${this._weatherData.sys.country}`;
        const url = new URL(window.location.href);
        url.searchParams.set('city', city);
        url.searchParams.set('units', this._unit);
        return url.toString();
    }

    getShareSummary() {
        const description = this._weatherData.weather?.[0]?.description || '';
        const formattedDescription = description
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        const temperature = `${this.toUnitNum(this._weatherData.main.temp)}${this.unitLabel()}`;
        const humidityValue = this._weatherData.main.humidity !== undefined ? `${this._weatherData.main.humidity}%` : '--';
        const cityLabel = `${this._weatherData.name}, ${this._weatherData.sys.country}`;
        return `${cityLabel}: ${temperature}, Humidity ${humidityValue}, ${formattedDescription}`;
    }

    renderSunPosition() {
        if (!this._weatherData) return;
        
        const sunMarker = this.shadowRoot.getElementById('sun-marker');
        const sunPhase = this.shadowRoot.getElementById('sun-phase');
        const sunProgress = this.shadowRoot.getElementById('sun-progress');
        const solarNoon = this.shadowRoot.getElementById('solar-noon');
        if (!sunMarker || !sunPhase || !sunProgress || !solarNoon) return;

        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};

        const nowSeconds = Math.floor(Date.now() / 1000);
        const timezone = this._weatherData.timezone;
        const sunriseTime = this._weatherData.sys.sunrise;
        const sunsetTime = this._weatherData.sys.sunset;
        const daylight = Math.max(sunsetTime - sunriseTime, 1);
        const midpoint = sunriseTime + Math.floor(daylight / 2);
        let progress = 0;
        let phaseText = '';
        let progressText = '';

        if (nowSeconds <= sunriseTime) {
            phaseText = this._lang === 'hi' ? 'सूर्योदय से पहले' : 'Before sunrise';
            progressText = this._lang === 'hi' ? `सूर्योदय में ${this.formatDuration(sunriseTime - nowSeconds)}` : `${this.formatDuration(sunriseTime - nowSeconds)} until sunrise`;
            progress = 0;
        } else if (nowSeconds >= sunsetTime) {
            phaseText = this._lang === 'hi' ? 'सूर्यास्त के बाद' : 'After sunset';
            progressText = this._lang === 'hi' ? `सूर्योदय में ${this.formatDuration(this.getNextSunriseSeconds(sunriseTime, nowSeconds) - nowSeconds)}` : `${this.formatDuration(this.getNextSunriseSeconds(sunriseTime, nowSeconds) - nowSeconds)} until sunrise`;
            progress = 100;
        } else {
            progress = ((nowSeconds - sunriseTime) / daylight) * 100;
            phaseText = t['daylight'] || 'Daylight';
            progressText = this._lang === 'hi' ? `दिन का ${Math.round(progress)}% हिस्सा पूरा हुआ` : `${Math.round(progress)}% of daylight completed`;
        }

        sunMarker.style.left = `${Math.min(Math.max(progress, 0), 100)}%`;
        sunPhase.textContent = phaseText;
        sunProgress.textContent = progressText;
        
        const midpointLabel = this._lang === 'hi' ? 'सौर मध्यबिंदु' : this._lang === 'es' ? 'Mediodía solar' : this._lang === 'fr' ? 'Midi solaire' : 'Solar midpoint';
        solarNoon.textContent = `${midpointLabel} ${this.formatTimeAtOffset(midpoint, timezone)}`;
    }

    renderAqi() {
        const aqiCard = this.shadowRoot.getElementById('aqi-card');
        const aqiValueEl = this.shadowRoot.getElementById('aqi-value');
        const aqiBadgeEl = this.shadowRoot.getElementById('aqi-badge');
        const aqiPollutantsEl = this.shadowRoot.getElementById('aqi-pollutants');
        const aqiRecommendationEl = this.shadowRoot.getElementById('aqi-recommendation');

        if (!aqiCard) return;

        if (!this._aqiData || !Array.isArray(this._aqiData.list) || this._aqiData.list.length === 0) {
            aqiCard.classList.add('hidden');
            return;
        }

        aqiCard.classList.remove('hidden');

        const entry = this._aqiData.list[0];
        const aqi = entry?.main?.aqi;
        const pollutants = entry?.components || {};

        const { label, badgeClass } = this.getAqiCategory(aqi);

        if (aqiValueEl) aqiValueEl.textContent = Number.isFinite(Number(aqi)) ? String(aqi) : '--';

        if (aqiBadgeEl) {
            aqiBadgeEl.textContent = label;
            aqiBadgeEl.className = 'aqi-badge'; // Reset
            if (badgeClass) aqiBadgeEl.classList.add(badgeClass);
        }

        if (aqiPollutantsEl) {
            const parts = [];
            const add = (key, name) => {
                const v = pollutants[key];
                if (v !== undefined && v !== null) parts.push(`${name}: ${v}`);
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
            aqiRecommendationEl.textContent = `Recommendation: ${this.getAqiHealthRecommendation(label)}`;
        }
    }

    updateFavoriteButton() {
        const btn = this.shadowRoot.getElementById('favorite-btn');
        if (btn) {
            btn.setAttribute('aria-pressed', String(this._isFavorite));
            const icon = btn.querySelector('.favorite-icon');
            if (icon) icon.textContent = this._isFavorite ? '★' : '☆';
            btn.title = this._isFavorite ? 'Remove favorite' : 'Favorite';
        }
    }

    updateUnit() {
        // Redraw temperatures
        if (!this._weatherData) return;
        this.render();
    }

    updateTranslations() {
        if (!this._weatherData) return;
        this.render();
    }
}

customElements.define('current-weather', CurrentWeather);
