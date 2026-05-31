require('dotenv').config();

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const LRUCache = require('./cache');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const PORT = Number(process.env.PORT) || 5000;

const app = express();

// Initialize LRU cache store with a maximum capacity of 1000 items
const cacheStore = new LRUCache(1000);

// Periodically prune expired items every 5 minutes to keep memory usage low
setInterval(() => cacheStore.prune(), 5 * 60 * 1000);

/**
 * Normalizes query parameters alphabetically and downcases values to ensure deterministic cache keys.
 * Handles both arrays and single values.
 */
function generateCacheKey(basePath, query) {
    const normalizedQuery = {};
    const sortedKeys = Object.keys(query).sort();
    
    for (const key of sortedKeys) {
        if (key === 'appid') continue; // Skip API key to keep the cache key clean and anonymous
        
        const value = query[key];
        if (value === undefined || value === null) continue;

        const normalizedKey = key.toLowerCase();
        
        if (Array.isArray(value)) {
            normalizedQuery[normalizedKey] = value
                .map((v) => String(v).trim().toLowerCase())
                .sort();
        } else {
            normalizedQuery[normalizedKey] = String(value).trim().toLowerCase();
        }
    }
    
    return `${basePath}:${JSON.stringify(normalizedQuery)}`;
}

/**
 * Returns cache TTL in milliseconds based on the endpoint path.
 */
function getTTL(basePath) {
    if (basePath.includes('/weather')) {
        return 10 * 60 * 1000; // Current Weather: 10 minutes
    }
    if (basePath.includes('/forecast')) {
        return 30 * 60 * 1000; // Forecast: 30 minutes
    }
    if (basePath.includes('/geo/')) {
        return 24 * 60 * 60 * 1000; // Geocoding: 24 hours
    }
    if (basePath.includes('/air_pollution')) {
        return 10 * 60 * 1000; // Air Quality: 10 minutes
    }
    return 10 * 60 * 1000; // Default: 10 minutes
}

/**
 * Rate limiter — 100 requests per 15 minutes per IP.
 * Applied to all /api/ routes to protect the OpenWeatherMap API key
 * from exhaustion by malicious actors or rogue scripts.
 * *****
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                  // max requests per windowMs per IP
    standardHeaders: true,     // return rate-limit info in RateLimit-* headers
    legacyHeaders: false,      // disable X-RateLimit-* headers
    message: { cod: 429, message: 'Too many requests, please try again later.' }
});

app.use('/api/', apiLimiter);

/**
 * Forwards query string to OpenWeatherMap, injecting appid from env (never from client).
 * Caches results to reduce upstream load and reduce response latency.
 */
async function proxyOpenWeather(basePath, req, res) {
    if (!OPENWEATHER_API_KEY) {
        res.status(503).json({
            cod: 503,
            message: 'Server is not configured with OPENWEATHER_API_KEY. Copy .env.example to .env and add your key.'
        });
        return;
    }

    // Generate normalized cache key
    const cacheKey = generateCacheKey(basePath, req.query);

    // Attempt cache hit
    const cachedResponse = cacheStore.get(cacheKey);
    if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        if (cachedResponse.contentType) {
            res.setHeader('Content-Type', cachedResponse.contentType);
        }
        res.status(cachedResponse.status).send(cachedResponse.body);
        return;
    }

    // Build upstream parameters
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key === 'appid') continue;
        if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, String(v)));
        } else if (value !== undefined) {
            params.append(key, String(value));
        }
    }
    params.set('appid', OPENWEATHER_API_KEY);

    const url = `https://api.openweathermap.org${basePath}?${params.toString()}`;

    let upstream;
    try {
        upstream = await fetch(url);
    } catch {
        res.status(502).json({ cod: 502, message: 'Weather service unreachable.' });
        return;
    }

    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type');
    const status = upstream.status;

    // Cache successful responses with normal TTL.
    // Cache failures with extremely short TTL (5 seconds) to prevent cache poisoning
    // while shielding the upstream API from rapid retries.
    if (status >= 200 && status < 300) {
        const ttl = getTTL(basePath);
        cacheStore.set(cacheKey, { status, body, contentType }, ttl);
    } else {
        cacheStore.set(cacheKey, { status, body, contentType }, 5000);
    }

    res.setHeader('X-Cache', 'MISS');
    if (contentType) {
        res.setHeader('Content-Type', contentType);
    }
    res.status(status).send(body);
}

app.get('/api/weather', (req, res) => proxyOpenWeather('/data/2.5/weather', req, res));
app.get('/api/forecast', (req, res) => proxyOpenWeather('/data/2.5/forecast', req, res));
app.get('/api/geo', (req, res) => proxyOpenWeather('/geo/1.0/direct', req, res));
app.get('/api/air-quality', (req, res) => proxyOpenWeather('/data/2.5/air_pollution', req, res));


app.use(express.static(path.join(__dirname, 'public')));

if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`Weatherify: http://localhost:${PORT}`);
        if (!OPENWEATHER_API_KEY) {
            console.warn('Set OPENWEATHER_API_KEY in .env (see .env.example).');
        }
    });
}

module.exports = app;
