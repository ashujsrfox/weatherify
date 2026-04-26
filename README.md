# Weather App

A modern, responsive weather application built with vanilla HTML, CSS, and JavaScript that displays current weather conditions and a 5-day forecast for any city worldwide.

## Features

- 🌤️ **Current Weather Display**: Shows temperature, weather conditions, and detailed metrics
- 📅 **5-Day Forecast**: Displays upcoming weather with icons and descriptions
- 🔍 **City Search**: Search for weather in any city with real-time autocomplete suggestions
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- 🎨 **Modern UI**: Clean, glassmorphic design with smooth animations
- ⚡ **Real-time Data**: Fetches live weather data from OpenWeatherMap API

## Live Demo

[View the live demo here](https://ashujsrfox.github.io/weather-app/)

## Technologies Used

- **HTML5**: Semantic markup structure
- **CSS3**: Modern styling with:
  - Flexbox and Grid layouts
  - CSS animations and transitions
  - Glassmorphism effects
  - Responsive design principles
- **JavaScript (ES6+)**: Core functionality with:
  - Async/await for API calls
  - DOM manipulation
  - Event handling
  - Debounced input for autocomplete

## API Integration

This app uses the **OpenWeatherMap API** for weather data:

- **Current Weather API**: `/data/2.5/weather`
- **5-Day Forecast API**: `/data/2.5/forecast`
- **Geocoding API**: `/geo/1.0/direct` (for city autocomplete)

### Getting an API Key

1. Visit [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Navigate to the API keys section
4. Copy your API key
5. Replace the placeholder in `script.js`

## Project Structure

```
weather-app/
├── index.html          # Main HTML structure
├── style.css           # All styling and responsive design
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/ashujsrfox/weather-app.git
   cd weather-app
   ```

2. **Add your API Key**
   - Open `script.js`
   - Replace the placeholder API key with your OpenWeatherMap API key:
   ```javascript
   const API_KEY = 'your_api_key_here';
   ```

3. **Run locally**
   - Open `index.html` in your web browser, or
   - Use a local server:
   ```bash
   # Using Python
   python -m http.server 8080
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8080
   ```

4. **Access the app**
   - Open `http://localhost:8080` in your browser

## Usage

1. **Search for a city**: Type the city name in the search box
2. **Autocomplete suggestions**: As you type, city suggestions will appear
3. **View weather data**: Current weather displays immediately
4. **5-day forecast**: Scroll horizontally to see upcoming weather

## Key Features Explained

### Weather Data Display
- **Temperature**: Current temperature in Celsius
- **Weather Description**: Text description of current conditions
- **Weather Icon**: Visual representation of weather conditions
- **Detailed Metrics**: Humidity, wind speed, pressure, visibility, sunrise/sunset

### 5-Day Forecast
- Shows weather for the next 5 days
- Each day displays: day name, weather icon, temperature, and description
- Horizontal scrollable design for mobile compatibility

### Search & Autocomplete
- Real-time city suggestions as you type
- Debounced input to reduce API calls
- Click on suggestions or press Enter to search

### Responsive Design
- **Desktop**: Full-width layout with all details visible
- **Tablet**: Optimized spacing and font sizes
- **Mobile**: Stacked layout with touch-friendly interactions

## Browser Compatibility

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+

## Performance Optimizations

- **Debounced Search**: Reduces API calls during typing
- **Parallel API Requests**: Fetches current and forecast data simultaneously
- **Efficient DOM Updates**: Minimal DOM manipulation
- **Optimized Images**: Uses appropriate icon sizes for different contexts

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

- [ ] Weather alerts and notifications
- [ ] Location-based weather detection
- [ ] Multiple unit systems (Fahrenheit, Kelvin)
- [ ] Weather maps integration
- [ ] Dark mode toggle
- [ ] Weather history and trends
- [ ] Air quality index display

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenWeatherMap](https://openweathermap.org/) for providing the weather API
- Weather icons provided by [OpenWeatherMap](https://openweathermap.org/weather-conditions)
- Glassmorphism design inspiration from modern UI trends

## Contact

Created by [Your Name] - [your.email@example.com]

Project Link: [https://github.com/ashujsrfox/weather-app](https://github.com/ashujsrfox/weather-app)
