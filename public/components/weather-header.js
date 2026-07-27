class WeatherHeader extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._lang = 'en';
        this._theme = 'light';
        this._unit = 'C';
    }

    static get observedAttributes() {
        return ['lang', 'theme', 'unit'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name === 'lang') {
            this._lang = newValue;
            this.updateTranslations();
        } else if (name === 'theme') {
            this._theme = newValue;
            this.updateTheme();
        } else if (name === 'unit') {
            this._unit = newValue;
            this.updateUnit();
        }
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
                header {
                    text-align: left;
                    margin-bottom: 28px;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto auto auto;
                    column-gap: 14px;
                    row-gap: 18px;
                    align-items: center;
                }
                h1 {
                    font-size: 36px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    margin: 0;
                    letter-spacing: -0.5px;
                    line-height: 1.1;
                }
                .language-toggle {
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 20px;
                    padding: 6px 12px;
                    color: inherit;
                    font-family: inherit;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    outline: none;
                    backdrop-filter: blur(5px);
                    transition: background 0.3s ease;
                }
                .language-toggle option {
                    color: #000;
                }
                .theme-toggle {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border: 1.5px solid rgba(102, 126, 234, 0.3);
                    border-radius: 50px;
                    background: rgba(102, 126, 234, 0.08);
                    color: #2d3748;
                    font-family: inherit;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                    flex-shrink: 0;
                    transition: background 0.3s ease, border-color 0.3s ease, color 0.3s ease, transform 0.15s ease, box-shadow 0.3s ease;
                    user-select: none;
                }
                .theme-toggle:hover {
                    background: rgba(102, 126, 234, 0.15);
                    border-color: #667eea;
                    transform: translateY(-1px);
                }
                .theme-toggle:active {
                    transform: translateY(0);
                }
                .toggle-icon {
                    font-style: normal;
                    font-size: 16px;
                    transition: transform 0.4s ease;
                    line-height: 1;
                }
                .unit-toggle {
                    display: flex;
                    border: 1.5px solid rgba(102, 126, 234, 0.3);
                    border-radius: 50px;
                    overflow: hidden;
                    flex-shrink: 0;
                }
                .unit-btn {
                    padding: 8px 14px;
                    border: none;
                    background: transparent;
                    color: #718096;
                    font-family: inherit;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s ease, color 0.2s ease;
                }
                .unit-btn:not(:last-child) {
                    border-right: 1.5px solid rgba(102, 126, 234, 0.2);
                }
                .unit-btn.active {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .unit-btn:not(.active):hover {
                    background: rgba(102, 126, 234, 0.1);
                    color: #667eea;
                }
                
                /* Dark Mode Scopes */
                :host-context(.dark-mode) .theme-toggle {
                    background: rgba(251, 191, 36, 0.08);
                    border-color: rgba(251, 191, 36, 0.3);
                    color: #fbbf24;
                }
                :host-context(.dark-mode) .theme-toggle:hover {
                    background: rgba(251, 191, 36, 0.15);
                    border-color: #fbbf24;
                }
                :host-context(.dark-mode) .toggle-icon {
                    transform: rotate(20deg);
                }
                :host-context(.dark-mode) .unit-toggle {
                    border-color: rgba(100, 116, 139, 0.4);
                }
                :host-context(.dark-mode) .unit-btn {
                    color: #94a3b8;
                }
                :host-context(.dark-mode) .unit-btn:not(:last-child) {
                    border-right-color: rgba(100, 116, 139, 0.3);
                }
                :host-context(.dark-mode) .unit-btn:not(.active):hover {
                    background: rgba(102, 126, 234, 0.15);
                    color: #a5b4fc;
                }

                @media (max-width: 768px) {
                    header {
                        grid-template-columns: minmax(0, 1fr) auto auto;
                        grid-template-areas:
                            "title title title"
                            "lang theme units";
                        row-gap: 12px;
                    }
                    h1 {
                        grid-area: title;
                        font-size: 28px;
                        text-align: center;
                    }
                    .language-toggle {
                        grid-area: lang;
                        width: 100%;
                    }
                    .theme-toggle {
                        grid-area: theme;
                        width: 100%;
                        justify-content: center;
                    }
                    .unit-toggle {
                        grid-area: units;
                        width: 100%;
                        justify-content: center;
                    }
                    .unit-btn {
                        flex: 1;
                        text-align: center;
                    }
                }
            </style>
            <header>
                <h1 id="app-title">${t['appTitle'] || 'Weatherify ⛅'}</h1>
                
                <select id="language-toggle" class="language-toggle" aria-label="Select language">
                    <option value="en">EN</option>
                    <option value="hi">HI</option>
                    <option value="es">ES</option>
                    <option value="fr">FR</option>
                </select>

                <button id="theme-toggle" class="theme-toggle" aria-label="Toggle dark mode" aria-pressed="false">
                    <span class="toggle-icon" aria-hidden="true">🌙</span>
                    <span class="toggle-label">${this._theme === 'dark' ? (t['themeLight'] || 'Light') : (t['themeDark'] || 'Dark')}</span>
                </button>
                
                <div class="unit-toggle" role="group" aria-label="Temperature unit">
                    <button class="unit-btn ${this._unit === 'C' ? 'active' : ''}" data-unit="C">°C</button>
                    <button class="unit-btn ${this._unit === 'F' ? 'active' : ''}" data-unit="F">°F</button>
                    <button class="unit-btn ${this._unit === 'K' ? 'active' : ''}" data-unit="K">K</button>
                </div>
            </header>
        `;
        
        this.shadowRoot.getElementById('language-toggle').value = this._lang;
        this.updateThemeEffects();
    }

    setupEventListeners() {
        const langToggle = this.shadowRoot.getElementById('language-toggle');
        langToggle.addEventListener('change', (e) => {
            const lang = e.target.value;
            this.dispatchEvent(new CustomEvent('lang-change', {
                detail: { lang },
                bubbles: true,
                composed: true
            }));
        });

        const themeToggle = this.shadowRoot.getElementById('theme-toggle');
        themeToggle.addEventListener('click', () => {
            const newTheme = this._theme === 'dark' ? 'light' : 'dark';
            this.dispatchEvent(new CustomEvent('theme-change', {
                detail: { theme: newTheme },
                bubbles: true,
                composed: true
            }));
        });

        const unitButtons = this.shadowRoot.querySelectorAll('.unit-btn');
        unitButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const unit = btn.dataset.unit;
                this.dispatchEvent(new CustomEvent('unit-change', {
                    detail: { unit },
                    bubbles: true,
                    composed: true
                }));
            });
        });
    }

    updateTranslations() {
        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        const titleEl = this.shadowRoot.getElementById('app-title');
        if (titleEl) titleEl.textContent = t['appTitle'] || 'Weatherify ⛅';
        
        const langToggle = this.shadowRoot.getElementById('language-toggle');
        if (langToggle) langToggle.value = this._lang;

        const labelEl = this.shadowRoot.querySelector('.toggle-label');
        if (labelEl) {
            labelEl.textContent = this._theme === 'dark' ? (t['themeLight'] || 'Light') : (t['themeDark'] || 'Dark');
        }
    }

    updateTheme() {
        const t = window.translations?.[this._lang] || window.translations?.['en'] || {};
        const labelEl = this.shadowRoot.querySelector('.toggle-label');
        if (labelEl) {
            labelEl.textContent = this._theme === 'dark' ? (t['themeLight'] || 'Light') : (t['themeDark'] || 'Dark');
        }
        this.updateThemeEffects();
    }

    updateThemeEffects() {
        const themeToggle = this.shadowRoot.getElementById('theme-toggle');
        if (themeToggle) {
            const isDark = this._theme === 'dark';
            themeToggle.setAttribute('aria-pressed', String(isDark));
            themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
            themeToggle.title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
            const icon = themeToggle.querySelector('.toggle-icon');
            if (icon) icon.textContent = isDark ? '☀️' : '🌙';
        }
    }

    updateUnit() {
        const buttons = this.shadowRoot.querySelectorAll('.unit-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === this._unit);
        });
    }
}

customElements.define('weather-header', WeatherHeader);
