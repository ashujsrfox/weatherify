class WeatherSearch extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._lang = 'en';
        this._loading = false;
        this._error = '';
        this._welcome = true;
        this._favorites = [];
        this._recent = [];
        this._debounceTimer = null;
    }

    static get observedAttributes() {
        return ['lang', 'loading', 'error', 'welcome'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name === 'lang') {
            this._lang = newValue;
            this.updateTranslations();
        } else if (name === 'loading') {
            this._loading = this.hasAttribute('loading');
            this.updateLoadingState();
        } else if (name === 'error') {
            this._error = newValue || '';
            this.updateErrorState();
        } else if (name === 'welcome') {
            this._welcome = this.hasAttribute('welcome');
            this.updateWelcomeState();
        }
    }

    get favorites() { return this._favorites; }
    set favorites(val) {
        this._favorites = val || [];
        this.renderHistory();
    }

    get recent() { return this._recent; }
    set recent(val) {
        this._recent = val || [];
        this.renderHistory();
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                }
                .search-container {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    position: relative;
                }
                .search-box {
                    display: flex;
                    gap: 12px;
                    width: 100%;
                    position: relative;
                    flex-shrink: 0;
                }
                .search-input-wrap {
                    flex: 1;
                    position: relative;
                    min-width: 0;
                }
                #city-input {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 14px 40px 14px 20px;
                    border: 2px solid #e2e8f0;
                    border-radius: 14px;
                    font-size: 16px;
                    font-family: inherit;
                    outline: none;
                    transition: all 0.3s ease;
                    background: rgba(255, 255, 255, 0.8);
                    color: inherit;
                }
                #city-input:focus {
                    border-color: #667eea;
                    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15);
                    background: white;
                    transform: translateY(-2px);
                }
                #city-input::placeholder {
                    color: #cbd5e0;
                }
                .clear-btn {
                    position: absolute;
                    top: 50%;
                    right: 10px;
                    transform: translateY(-50%);
                    width: 32px;
                    height: 32px;
                    padding: 0;
                    border: none;
                    border-radius: 10px;
                    background: transparent;
                    color: #64748b;
                    font-size: 22px;
                    line-height: 1;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s ease, background 0.2s ease;
                }
                .clear-btn.hidden {
                    display: none;
                }
                .clear-btn:hover {
                    color: #475569;
                    background: rgba(100, 116, 139, 0.12);
                }
                #search-btn {
                    width: 3.5rem;
                    min-width: 3.5rem;
                    height: 3.5rem;
                    flex-shrink: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 0.875rem;
                    cursor: pointer;
                    color: white;
                    transition: transform 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    box-shadow: 0 0.25rem 0.9375rem rgba(102, 126, 234, 0.3);
                }
                #search-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none !important;
                    box-shadow: none !important;
                }
                #search-btn:not(:disabled):hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.5);
                }
                #search-btn:not(:disabled):active {
                    transform: translateY(-1px);
                }
                .location-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(102, 126, 234, 0.1);
                    border: 1.5px solid rgba(102, 126, 234, 0.2);
                    padding: 10px 18px;
                    border-radius: 14px;
                    color: #4f46e5;
                    font-family: inherit;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.25s ease;
                    white-space: nowrap;
                }
                .location-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                    transform: translateY(-1.5px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
                }
                .location-btn:active {
                    transform: translateY(0);
                }
                .location-icon {
                    font-size: 16px;
                }
                .location-label {
                    font-size: 14px;
                }
                .suggestions-container {
                    position: absolute;
                    top: calc(100% + 12px);
                    left: 0;
                    right: 0;
                    background: white;
                    border-radius: 14px;
                    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.2);
                    max-height: 300px;
                    overflow-y: auto;
                    z-index: 1000;
                    display: block;
                    transition: background 0.4s ease;
                }
                .suggestions-container.hidden {
                    display: none;
                }
                .suggestion-item {
                    padding: 14px 20px;
                    cursor: pointer;
                    border-bottom: 1px solid #f0f0f0;
                    transition: all 0.2s ease;
                    font-size: 15px;
                    color: #2d3748;
                }
                .suggestion-item:last-child {
                    border-bottom: none;
                }
                .suggestion-item:hover {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding-left: 24px;
                }
                .suggestion-item:first-child {
                    border-radius: 14px 14px 0 0;
                }
                .suggestion-item:last-child {
                    border-radius: 0 0 14px 14px;
                }
                
                /* Error Message */
                #error-message {
                    color: #ef4444;
                    font-size: 14px;
                    margin-top: 8px;
                    display: block;
                }
                #error-message.hidden {
                    display: none;
                }

                /* History Dropdown */
                .history-dropdown {
                    margin-top: 18px;
                    background: #eef2ff;
                    border: 1px solid #c7d2fe;
                    border-radius: 22px;
                    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
                    padding: 20px;
                    width: 100%;
                    box-sizing: border-box;
                    overflow: hidden;
                    display: block;
                }
                .history-dropdown.hidden {
                    display: none;
                }
                .history-panel-header {
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(99, 102, 241, 0.15);
                }
                .history-panel-header h2 {
                    margin: 0;
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #1e293b;
                }
                .history-panel-header p {
                    margin: 8px 0 0;
                    color: #475569;
                    font-size: 0.95rem;
                    line-height: 1.45;
                }
                .history-dropdown-inner {
                    display: grid;
                    gap: 14px;
                }
                .history-section {
                    display: grid;
                    gap: 10px;
                }
                .history-section-title {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #334155;
                }
                .history-list {
                    display: grid;
                    gap: 8px;
                    max-height: 160px;
                    overflow-y: auto;
                    padding-right: 4px;
                }
                .history-button {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 12px 14px;
                    border-radius: 14px;
                    border: 1px solid #e2e8f0;
                    background: #f8fafc;
                    color: #0f172a;
                    font-size: 0.95rem;
                    text-align: left;
                    cursor: pointer;
                    transition: background 0.2s ease, transform 0.2s ease;
                    font-family: inherit;
                }
                .history-button:hover {
                    transform: translateX(2px);
                    background: #e2e8f0;
                }
                .history-badge {
                    font-size: 0.9rem;
                    color: #ca8a04;
                }
                .history-empty {
                    padding: 18px;
                    border-radius: 16px;
                    background: #f8fafc;
                    color: #475569;
                    border: 1px dashed #cbd5e0;
                    text-align: center;
                }
                .history-empty p {
                    font-weight: 600;
                    margin: 0;
                }
                .history-actions {
                    display: flex;
                    justify-content: flex-end;
                    padding-top: 8px;
                }
                .clear-history-btn {
                    border: 1px solid #cbd5e0;
                    background: #ffffff;
                    color: #475569;
                    border-radius: 12px;
                    padding: 10px 16px;
                    cursor: pointer;
                    transition: background 0.2s ease, color 0.2s ease;
                    font-family: inherit;
                    font-weight: 500;
                }
                .clear-history-btn.hidden {
                    display: none;
                }
                .clear-history-btn:hover {
                    background: #f8fafc;
                }

                /* Welcome & Skeleton States */
                .no-data-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: #718096;
                }
                .no-data-message.hidden {
                    display: none;
                }
                .no-data-message h2 {
                    font-size: 22px;
                    font-weight: 700;
                    color: #2d3748;
                    margin-bottom: 8px;
                    transition: color 0.4s ease;
                }
                .skeleton-loader {
                    padding: 20px;
                }
                .skeleton-loader.hidden {
                    display: none;
                }
                .skeleton-text, .skeleton-card {
                    background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite;
                    border-radius: 8px;
                }
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .skeleton-text {
                    height: 20px;
                    margin-bottom: 8px;
                }

                /* Dark Mode overrides via host-context */
                :host-context(.dark-mode) #city-input {
                    background: rgba(30, 41, 59, 0.7);
                    border-color: rgba(100, 116, 139, 0.4);
                    color: #f1f5f9;
                }
                :host-context(.dark-mode) #city-input:focus {
                    border-color: #818cf8;
                    box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.2);
                    background: #1e293b;
                }
                :host-context(.dark-mode) .clear-btn {
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .clear-btn:hover {
                    color: #f1f5f9;
                    background: rgba(148, 163, 184, 0.15);
                }
                :host-context(.dark-mode) .location-btn {
                    background: rgba(129, 140, 248, 0.08);
                    border-color: rgba(129, 140, 248, 0.3);
                    color: #a5b4fc;
                }
                :host-context(.dark-mode) .location-btn:hover {
                    background: #4f46e5;
                    color: white;
                    border-color: #4f46e5;
                }
                :host-context(.dark-mode) .suggestions-container {
                    background: #1e293b;
                    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.4);
                }
                :host-context(.dark-mode) .suggestion-item {
                    border-bottom-color: #334155;
                    color: #e2e8f0;
                }
                :host-context(.dark-mode) .history-dropdown {
                    background: #1e1b4b;
                    border-color: rgba(99, 102, 241, 0.3);
                    box-shadow: 0 24px 60px rgba(0,0,0,0.4);
                }
                :host-context(.dark-mode) .history-panel-header h2 {
                    color: #e2e8f0;
                }
                :host-context(.dark-mode) .history-panel-header p {
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .history-section-title {
                    color: #cbd5e1;
                }
                :host-context(.dark-mode) .history-button {
                    background: #0f172a;
                    border-color: #1e293b;
                    color: #e2e8f0;
                }
                :host-context(.dark-mode) .history-button:hover {
                    background: #1e293b;
                }
                :host-context(.dark-mode) .history-empty {
                    background: #0f172a;
                    border-color: #334155;
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .clear-history-btn {
                    background: #1e293b;
                    border-color: #334155;
                    color: #e2e8f0;
                }
                :host-context(.dark-mode) .clear-history-btn:hover {
                    background: #334155;
                }
                :host-context(.dark-mode) .no-data-message {
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .no-data-message h2 {
                    color: #f1f5f9;
                }
                :host-context(.dark-mode) .skeleton-text, :host-context(.dark-mode) .skeleton-card {
                    background: linear-gradient(90deg, #1e293b 25%, #2d3748 50%, #1e293b 75%);
                    background-size: 200% 100%;
                }

                @media (max-width: 768px) {
                    .search-box {
                        flex-direction: column;
                        gap: 8px;
                    }
                    #search-btn {
                        width: 100%;
                        height: 3rem;
                    }
                    .location-btn {
                        width: 100%;
                        justify-content: center;
                    }
                }
            </style>
            
            <div class="search-container">
                <div class="search-box">
                    <div class="search-input-wrap">
                        <input type="text" id="city-input" autocomplete="off" placeholder="${t['searchPlaceholder'] || 'Enter city name...'}">
                        <button type="button" id="clear-btn" class="clear-btn hidden" aria-label="Clear search">&times;</button>
                    </div>
                    <button id="search-btn" disabled aria-label="Search for city weather">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
                    </button>
                    <button id="location-btn" type="button" class="location-btn" aria-label="Use my location for weather">
                        <span class="location-icon" aria-hidden="true">📍</span>
                        <span class="location-label">${t['useMyLocation'] || 'Use My Location'}</span>
                    </button>
                </div>
                
                <div id="error-message" class="hidden">
                    <p>${this._error || (t['cityNotFound'] || 'City not found. Please check spelling and try again.')}</p>
                </div>

                <div id="suggestions-dropdown" class="suggestions-container hidden"></div>

                <div id="history-dropdown" class="history-dropdown hidden" aria-label="Recent searches and favorites">
                    <div class="history-panel-header">
                        <h2>${t['savedCities'] || 'Saved Cities'}</h2>
                        <p>${t['savedCitiesDesc'] || 'Quickly reopen favorite cities or recent searches.'}</p>
                    </div>
                    <div class="history-dropdown-inner">
                        <!-- Filled by JS -->
                    </div>
                </div>

                <div id="no-data-message" class="no-data-message">
                    <h2>${t['welcomeTitle'] || 'Welcome to Weatherify ⛅'}</h2>
                    <p>${t['welcomeDesc'] || 'Search for a city to view its weather forecast'}</p>
                </div>

                <!-- SKELETON LOADER -->
                <div id="loading" class="skeleton-loader hidden">
                    <div class="skeleton-text" style="width: 150px; height: 24px; margin-bottom: 8px;"></div>
                    <div class="skeleton-text" style="width: 100px; height: 16px; margin-bottom: 20px;"></div>
                    <div class="skeleton-card" style="width: 100%; height: 220px; border-radius: 20px;"></div>
                </div>
            </div>
        `;
        
        this.renderHistory();
        this.updateLoadingState();
        this.updateErrorState();
        this.updateWelcomeState();
    }

    setupEventListeners() {
        const cityInput = this.shadowRoot.getElementById('city-input');
        const clearBtn = this.shadowRoot.getElementById('clear-btn');
        const searchBtn = this.shadowRoot.getElementById('search-btn');
        const locationBtn = this.shadowRoot.getElementById('location-btn');

        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.hideSuggestions();
                this.handleSearchSubmit();
            }
        });

        cityInput.addEventListener('focus', () => {
            if (!cityInput.value.trim()) {
                this.openHistoryDropdown();
            }
        });

        cityInput.addEventListener('input', (e) => {
            this.setAttribute('error', ''); // Clear error state on input
            const query = e.target.value.trim();
            searchBtn.disabled = query.length === 0;
            clearBtn.classList.toggle('hidden', cityInput.value.length === 0);

            clearTimeout(this._debounceTimer);

            if (query.length < 2) {
                this.hideSuggestions();
                if (!query) {
                    this.openHistoryDropdown();
                } else {
                    this.closeHistoryDropdown();
                }
                return;
            }

            this.closeHistoryDropdown();
            this._debounceTimer = setTimeout(() => this.fetchCitySuggestions(query), 300);
        });

        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cityInput.value = '';
            cityInput.dispatchEvent(new Event('input', { bubbles: true }));
            cityInput.focus();
        });

        searchBtn.addEventListener('click', () => this.handleSearchSubmit());

        if (locationBtn) {
            locationBtn.addEventListener('click', () => {
                this.hideSuggestions();
                this.dispatchEvent(new CustomEvent('location-request', {
                    bubbles: true,
                    composed: true
                }));
            });
        }

        // Handle clicking outside suggestions/history
        document.addEventListener('click', (e) => {
            const path = e.composedPath();
            if (!path.includes(this)) {
                this.hideSuggestions();
                this.closeHistoryDropdown();
            }
        });
    }

    handleSearchSubmit() {
        const cityInput = this.shadowRoot.getElementById('city-input');
        const city = cityInput.value.trim();
        if (city) {
            this.dispatchEvent(new CustomEvent('city-select', {
                detail: { city },
                bubbles: true,
                composed: true
            }));
        }
    }

    async fetchCitySuggestions(query) {
        try {
            const url = `/api/geo?q=${encodeURIComponent(query)}&limit=5&lang=${this._lang}`;
            const response = await fetch(url);
            if (!response.ok) return;

            const cities = await response.json();
            this.displaySuggestions(cities);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }

    displaySuggestions(cities) {
        const container = this.shadowRoot.getElementById('suggestions-dropdown');
        if (!container) return;

        if (cities.length === 0) {
            this.hideSuggestions();
            return;
        }

        container.innerHTML = '';

        cities.forEach((city) => {
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion-item';
            
            const localName = city.local_names && city.local_names[this._lang] ? city.local_names[this._lang] : city.name;
            const text = `${localName}, ${city.state ? `${city.state}, ` : ''}${city.country}`;
            suggestion.textContent = text;

            suggestion.addEventListener('click', () => {
                const cityInput = this.shadowRoot.getElementById('city-input');
                const clearBtn = this.shadowRoot.getElementById('clear-btn');
                
                cityInput.value = localName;
                clearBtn.classList.remove('hidden');
                this.hideSuggestions();

                this.dispatchEvent(new CustomEvent('city-select', {
                    detail: { city: localName },
                    bubbles: true,
                    composed: true
                }));
            });

            container.appendChild(suggestion);
        });

        container.classList.remove('hidden');
    }

    hideSuggestions() {
        const container = this.shadowRoot.getElementById('suggestions-dropdown');
        if (container) container.classList.add('hidden');
    }

    openHistoryDropdown() {
        const dropdown = this.shadowRoot.getElementById('history-dropdown');
        if (dropdown && (this._favorites.length || this._recent.length)) {
            dropdown.classList.remove('hidden');
        }
    }

    closeHistoryDropdown() {
        const dropdown = this.shadowRoot.getElementById('history-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }

    renderHistory() {
        const dropdown = this.shadowRoot.getElementById('history-dropdown');
        if (!dropdown) return;

        const inner = dropdown.querySelector('.history-dropdown-inner');
        if (!inner) return;

        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};

        const favoriteMarkup = this._favorites.map((item) => `
            <button type="button" class="history-button favorite-entry" data-query="${item.query}">
                <span>${item.label}</span>
                <span class="history-badge">★</span>
            </button>
        `).join('');

        const recentMarkup = this._recent.map((item) => `
            <button type="button" class="history-button recent-entry" data-query="${item.query}">
                <span>${item.label}</span>
            </button>
        `).join('');

        const hasHistory = this._favorites.length > 0 || this._recent.length > 0;
        const noRecentText = t['recent'] ? `No ${t['recent'].toLowerCase()} searches yet.` : 'No recent searches yet.';

        const emptyState = !hasHistory ? `
            <div class="history-empty">
                <p>${noRecentText}</p>
            </div>
        ` : '';

        inner.innerHTML = `
            <div class="history-section">
                <div class="history-section-title">${t['favorites'] || 'Favorites'}</div>
                <div class="history-list favorite-list-container">${favoriteMarkup}</div>
            </div>
            <div class="history-section">
                <div class="history-section-title">${t['recent'] || 'Recent'}</div>
                <div class="history-list recent-list-container">${recentMarkup}</div>
            </div>
            ${emptyState}
            <div class="history-actions">
                <button type="button" class="clear-history-btn ${this._recent.length === 0 ? 'hidden' : ''}">${t['clearHistory'] || 'Clear history'}</button>
            </div>
        `;

        // Add event listeners inside history list
        inner.querySelectorAll('.history-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const query = btn.dataset.query;
                this.closeHistoryDropdown();
                
                // Also set the input value
                const cityInput = this.shadowRoot.getElementById('city-input');
                const clearBtn = this.shadowRoot.getElementById('clear-btn');
                const searchBtn = this.shadowRoot.getElementById('search-btn');
                if (cityInput) {
                    cityInput.value = btn.querySelector('span').textContent;
                    if (clearBtn) clearBtn.classList.remove('hidden');
                    if (searchBtn) searchBtn.disabled = false;
                }

                this.dispatchEvent(new CustomEvent('city-select', {
                    detail: { city: query },
                    bubbles: true,
                    composed: true
                }));
            });
        });

        const clearBtn = inner.querySelector('.clear-history-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('clear-history', {
                    bubbles: true,
                    composed: true
                }));
            });
        }
    }

    updateLoadingState() {
        const loadingEl = this.shadowRoot.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.toggle('hidden', !this._loading);
        }
    }

    updateErrorState() {
        const errorEl = this.shadowRoot.getElementById('error-message');
        if (errorEl) {
            const p = errorEl.querySelector('p');
            if (this._error) {
                p.textContent = this._error;
                errorEl.classList.remove('hidden');
            } else {
                errorEl.classList.add('hidden');
            }
        }
    }

    updateWelcomeState() {
        const welcomeEl = this.shadowRoot.getElementById('no-data-message');
        if (welcomeEl) {
            welcomeEl.classList.toggle('hidden', !this._welcome);
        }
    }

    updateTranslations() {
        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        
        // placeholder
        const cityInput = this.shadowRoot.getElementById('city-input');
        if (cityInput) cityInput.placeholder = t['searchPlaceholder'] || 'Enter city name...';

        // location label
        const locationLabel = this.shadowRoot.querySelector('.location-label');
        if (locationLabel) locationLabel.textContent = t['useMyLocation'] || 'Use My Location';

        // welcome message
        const welcomeEl = this.shadowRoot.getElementById('no-data-message');
        if (welcomeEl) {
            const h2 = welcomeEl.querySelector('h2');
            const p = welcomeEl.querySelector('p');
            h2.textContent = t['welcomeTitle'] || 'Welcome to Weatherify ⛅';
            p.textContent = t['welcomeDesc'] || 'Search for a city to view its weather forecast';
        }

        // history headers
        this.renderHistory();
    }
    
    // Public method to set input value
    setInputValue(val) {
        const cityInput = this.shadowRoot.getElementById('city-input');
        const clearBtn = this.shadowRoot.getElementById('clear-btn');
        const searchBtn = this.shadowRoot.getElementById('search-btn');
        if (cityInput) {
            cityInput.value = val;
            if (clearBtn) clearBtn.classList.toggle('hidden', !val);
            if (searchBtn) searchBtn.disabled = !val;
        }
    }
}

customElements.define('weather-search', WeatherSearch);
