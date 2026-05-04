require('dotenv').config();

const express = require('express');
const path = require('path');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const PORT = Number(process.env.PORT) || 3000;

const app = express();

/**
 * Forwards query string to OpenWeatherMap, injecting appid from env (never from client).
 */
async function proxyOpenWeather(basePath, req, res) {
    if (!OPENWEATHER_API_KEY) {
        res.status(503).json({
            cod: 503,
            message: 'Server is not configured with OPENWEATHER_API_KEY. Copy .env.example to .env and add your key.'
        });
        return;
    }

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
    if (contentType) {
        res.setHeader('Content-Type', contentType);
    }
    res.status(upstream.status).send(body);
}

app.get('/api/weather', (req, res) => proxyOpenWeather('/data/2.5/weather', req, res));
app.get('/api/forecast', (req, res) => proxyOpenWeather('/data/2.5/forecast', req, res));
app.get('/api/geo', (req, res) => proxyOpenWeather('/geo/1.0/direct', req, res));

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Weatherify: http://localhost:${PORT}`);
    if (!OPENWEATHER_API_KEY) {
        console.warn('Set OPENWEATHER_API_KEY in .env (see .env.example).');
    }
});
