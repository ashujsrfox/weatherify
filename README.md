# Weather App

A modern, responsive weather application built with vanilla HTML, CSS, and JavaScript that displays current weather conditions and a 5-day forecast for any city worldwide.

REQUEST- The project requires refinement and there are several features that can be added, therefore you can contribute to the project and make it more efficient.

## Features

- 🌤️ **Current Weather Display**: Shows temperature, weather conditions, and detailed metrics
- 📅 **5-Day Forecast**: Displays upcoming weather with icons and descriptions
- 🔍 **City Search**: Search for weather in any city with real-time autocomplete suggestions
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- 🎨 **Modern UI**: Clean, glassmorphic design with smooth animations
- ⚡ **Real-time Data**: Fetches live weather data from OpenWeatherMap API

## Live Demo

[View the live demo here](https://ashujsrfox.github.io/weatherify/)

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

## Project Structure

```
weather-app/
├── index.html          # Main HTML structure
├── style.css           # All styling and responsive design
├── script.js           # JavaScript functionality
└── README.md           # This file
```


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

Project Link: (https://ashujsrfox.github.io/weatherify/)
