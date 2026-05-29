require('dotenv').config();

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const PORT = Number(process.env.PORT) || 5000;
const app = express();

// Rate limiter — 100 requests per 15 minutes per IP.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { cod: 429, message: 'Too many requests, please try again later.' }
});

app.use('/api/', apiLimiter);

/**
 * FREE API BYPASS LOGIC (Bina Sign-up Asli City Ka Data)
 */
async function proxyOpenWeather(basePath, req, res) {
    // Agar hum /api/weather par hain, toh wttr.in se real city data fetch karenge
    if (basePath === '/data/2.5/weather') {
        const city = req.query.q || 'New Delhi';
        
        try {
            // Free Public API call (No Key Required)
            const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
            if (!response.ok) throw new Error();
            const wttrData = await response.json();

            const currentCondition = wttrData.current_condition[0];
            const desc = currentCondition.weatherDesc[0].value;

            // wttr.in ke mausam ko OpenWeather ke format ('Clear', 'Rain', 'Clouds') mein map karte hain
            let mainCondition = 'Clouds';
            if (desc.includes('Clear') || desc.includes('Sunny')) mainCondition = 'Clear';
            else if (desc.includes('Rain') || desc.includes('Shower') || desc.includes('Drizzle')) mainCondition = 'Rain';
            else if (desc.includes('Snow') || desc.includes('Ice')) mainCondition = 'Snow';
            else if (desc.includes('Thunder')) mainCondition = 'Thunderstorm';

            // Frontend ko bilkul wahi format de rahe hain jo use chahiye
            const mockResponse = {
                name: city.charAt(0).toUpperCase() + city.slice(1),
                sys: { country: wttrData.nearest_area[0].country[0].value || 'IN' },
                main: {
                    temp: parseFloat(currentCondition.temp_C) + 273.15, // Kelvin mein convert kiya
                    feels_like: parseFloat(currentCondition.FeelsLikeC) + 273.15,
                    humidity: parseInt(currentCondition.humidity),
                    pressure: parseInt(currentCondition.pressure)
                },
                weather: [{
                    main: mainCondition,
                    description: desc,
                    icon: mainCondition === 'Clear' ? '01d' : mainCondition === 'Rain' ? '10d' : '03d'
                }],
                wind: { speed: parseFloat(currentCondition.windspeedKmph) / 3.6, deg: parseInt(currentCondition.winddirDegree) },
                visibility: parseInt(currentCondition.visibility) * 1000,
                timezone: 19800
            };

            res.status(200).json(mockResponse);
            return;
        } catch (error) {
            res.status(404).json({ cod: 404, message: 'City not found. Please check spelling.' });
            return;
        }
    }

    // Baaki endpoints ke liye empty mock formats de dete hain taaki frontend crash na ho
    if (basePath === '/data/2.5/air_pollution') {
        res.json({ list: [{ main: { aqi: 2 }, components: { pm2_5: 12, pm10: 20, no2: 10, o3: 30 } }] });
        return;
    }

    res.json({ list: [] });
}

app.get('/api/weather', (req, res) => proxyOpenWeather('/data/2.5/weather', req, res));
app.get('/api/forecast', (req, res) => proxyOpenWeather('/data/2.5/forecast', req, res));
app.get('/api/geo', (req, res) => proxyOpenWeather('/geo/1.0/direct', req, res));
app.get('/api/air-quality', (req, res) => proxyOpenWeather('/data/2.5/air_pollution', req, res));

app.use(express.static(path.join(__dirname, 'public')));

if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`Weatherify running without API Key: http://localhost:${PORT}`);
    });
}

module.exports = app;
