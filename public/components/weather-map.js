class WeatherMap extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._lang = 'en';
        this._lat = null;
        this._lon = null;
        this._cityName = '';
        this._mapInstance = null;
        this._mapMarker = null;
        this._activeWeatherLayer = null;
    }

    static get observedAttributes() {
        return ['lang'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name === 'lang') {
            this._lang = newValue;
            this.updateTranslations();
        }
    }

    setMapCoords(lat, lon, cityName) {
        this._lat = lat;
        this._lon = lon;
        this._cityName = cityName;
        this.initOrUpdateMap();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
            <style>
                :host {
                    display: block;
                    width: 100%;
                }
                @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

                .weather-map-section {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    animation: slideUp 0.6s ease-out 0.3s both;
                    margin-top: 10px;
                    margin-bottom: 24px;
                }
                .forecast-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #2d3748;
                    letter-spacing: -0.5px;
                    transition: color 0.4s ease;
                    margin: 0;
                }
                .forecast-subtitle {
                    font-size: 13px;
                    line-height: 1.6;
                    color: #718096;
                    transition: color 0.4s ease;
                    margin: 4px 0 0 0;
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
                .map-card {
                    background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
                    border: 2px solid rgba(102, 126, 234, 0.15);
                    border-radius: 20px;
                    padding: 12px;
                    transition: all 0.3s ease;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
                    position: relative;
                    z-index: 1;
                    box-sizing: border-box;
                }
                .map-card:hover {
                    border-color: #667eea;
                    box-shadow: 0 15px 40px rgba(102, 126, 234, 0.15);
                }
                #weather-map {
                    height: 350px;
                    width: 100%;
                    border-radius: 16px;
                    z-index: 1;
                }

                /* Dark mode scopes */
                :host-context(.dark-mode) .forecast-title {
                    color: #f1f5f9;
                }
                :host-context(.dark-mode) .forecast-subtitle {
                    color: #94a3b8;
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
                :host-context(.dark-mode) .map-card {
                    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
                    border-color: rgba(102, 126, 234, 0.2);
                }
                :host-context(.dark-mode) .map-card:hover {
                    border-color: #667eea;
                }

                /* Leaflet Zoom buttons & Popups inside Shadow DOM */
                :host-context(.dark-mode) .leaflet-control-zoom a {
                    background-color: #1e293b;
                    color: #e2e8f0;
                    border-color: #334155;
                }
                :host-context(.dark-mode) .leaflet-control-zoom a:hover {
                    background-color: #334155;
                }
                :host-context(.dark-mode) .leaflet-popup-content-wrapper,
                :host-context(.dark-mode) .leaflet-popup-tip {
                    background-color: #1e293b;
                    color: #f1f5f9;
                    box-shadow: 0 3px 14px rgba(0,0,0,0.4);
                }

                @media (max-width: 768px) {
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
            
            <section class="weather-map-section" aria-labelledby="weather-map-title">
                <div class="trends-header">
                    <div>
                        <h3 class="forecast-title" id="weather-map-title">${t['interactiveMap'] || 'Interactive Map'}</h3>
                        <p class="forecast-subtitle" id="map-summary">${t['mapDesc'] || 'Live spatial weather patterns.'}</p>
                    </div>
                    <div class="trend-controls map-layer-controls" aria-label="Choose map layer">
                        <button class="trend-toggle active" type="button" data-layer="base">${t['mapBase'] || 'Base'}</button>
                        <button class="trend-toggle" type="button" data-layer="precipitation">${t['mapRain'] || 'Rain'}</button>
                        <button class="trend-toggle" type="button" data-layer="clouds">${t['mapClouds'] || 'Clouds'}</button>
                    </div>
                </div>

                <div class="map-card glass-panel">
                    <div id="weather-map"></div>
                </div>
            </section>
        `;

        this.setupLayerControls();
        this.initOrUpdateMap();
    }

    setupLayerControls() {
        const controls = this.shadowRoot.querySelectorAll('.map-layer-controls .trend-toggle');
        controls.forEach(btn => {
            btn.addEventListener('click', (e) => {
                controls.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const layerType = btn.dataset.layer;
                this.updateWeatherLayer(layerType);
            });
        });
    }

    initOrUpdateMap() {
        const mapElement = this.shadowRoot.getElementById('weather-map');
        if (!mapElement || this._lat === null || this._lon === null) return;

        const L = window.L;
        if (!L) return;

        if (!this._mapInstance) {
            this._mapInstance = L.map(mapElement).setView([this._lat, this._lon], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(this._mapInstance);
            this._mapMarker = L.marker([this._lat, this._lon]).addTo(this._mapInstance);
        } else {
            this._mapInstance.setView([this._lat, this._lon], 10);
            this._mapMarker.setLatLng([this._lat, this._lon]);
        }
        this._mapMarker.bindPopup(`<b>${this._cityName}</b>`).openPopup();
    }

    updateWeatherLayer(layerType) {
        const L = window.L;
        if (!L || !this._mapInstance) return;

        if (this._activeWeatherLayer) {
            this._mapInstance.removeLayer(this._activeWeatherLayer);
            this._activeWeatherLayer = null;
        }

        let layerUrl = '';
        if (layerType === 'precipitation') {
            layerUrl = 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=MOCK_KEY';
        } else if (layerType === 'clouds') {
            layerUrl = 'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=MOCK_KEY';
        }

        if (layerUrl && layerType !== 'base') {
            // Keep the code disabled as in original codebase
            // this._activeWeatherLayer = L.tileLayer(layerUrl, { opacity: 0.6 }).addTo(this._mapInstance);
        }
    }

    updateTranslations() {
        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        
        const titleEl = this.shadowRoot.getElementById('weather-map-title');
        if (titleEl) titleEl.textContent = t['interactiveMap'] || 'Interactive Map';

        const summaryEl = this.shadowRoot.getElementById('map-summary');
        if (summaryEl) summaryEl.textContent = t['mapDesc'] || 'Live spatial weather patterns.';

        const controls = this.shadowRoot.querySelectorAll('.map-layer-controls .trend-toggle');
        controls.forEach(btn => {
            const layer = btn.dataset.layer;
            if (layer === 'base') btn.textContent = t['mapBase'] || 'Base';
            else if (layer === 'precipitation') btn.textContent = t['mapRain'] || 'Rain';
            else if (layer === 'clouds') btn.textContent = t['mapClouds'] || 'Clouds';
        });
    }
}

customElements.define('weather-map', WeatherMap);
