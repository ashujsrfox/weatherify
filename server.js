require('dotenv').config();

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const NodeCache = require('node-cache');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
if (!OPENWEATHER_API_KEY) {
    console.error('CRITICAL ERROR: Server is not configured with OPENWEATHER_API_KEY. Copy .env.example to .env and add your key.');
    process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Cache for 5 mins

// Trust proxy for rate limiter to work behind load balancers/proxies
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Disabled for simplicity with local scripts/styles
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Serve static files before API routes
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Rate limiter — 100 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            cod: 429,
            message: 'Too many requests, please try again later.'
        });
    }
});

app.use('/api/', apiLimiter);

/**
 * Validates upstream JSON response
 */
function isValidJSON(text) {
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

/**
 * Forwards query string to OpenWeatherMap, injecting appid from env (never from client).
 */
async function proxyOpenWeather(basePath, req, res) {
    // Basic sanitization of query parameters to alphanumeric, spaces, and commas
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key === 'appid') continue;
        
        let sanitizedValue = String(value).replace(/[^\w\s,.-]/gi, ''); // sanitize query
        params.append(key, sanitizedValue);
    }
    params.set('appid', OPENWEATHER_API_KEY);

    const cacheKey = `${basePath}?${params.toString()}`;
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
        res.setHeader('Content-Type', cachedResponse.contentType);
        return res.status(cachedResponse.status).send(cachedResponse.body);
    }

    const url = `https://api.openweathermap.org${basePath}?${params.toString()}`;

    let upstream;
    try {
        // Implement timeout using AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        upstream = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
    } catch (err) {
        if (err.name === 'AbortError') {
            res.status(504).json({ cod: 504, message: 'Weather service request timed out.' });
        } else {
            res.status(502).json({ cod: 502, message: 'Weather service unreachable.' });
        }
        return;
    }

    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    if (!isValidJSON(body)) {
        res.status(502).json({ cod: 502, message: 'Invalid response from weather service.' });
        return;
    }

    // Cache successful responses
    if (upstream.status === 200) {
        cache.set(cacheKey, { status: upstream.status, body, contentType });
    }

    res.setHeader('Content-Type', contentType);
    res.status(upstream.status).send(body);
}

app.get('/api/weather', (req, res) => proxyOpenWeather('/data/2.5/weather', req, res));
app.get('/api/forecast', (req, res) => proxyOpenWeather('/data/2.5/forecast', req, res));
app.get('/api/geo', (req, res) => proxyOpenWeather('/geo/1.0/direct', req, res));

// Default to index.html for unknown routes (SPA behavior)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`Weatherify: http://localhost:${PORT}`);
});

// Graceful shutdown handling
function gracefulShutdown() {
    console.log('Received kill signal, shutting down gracefully');
    server.close(() => {
        console.log('Closed out remaining connections');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
