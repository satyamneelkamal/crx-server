const express = require('express');
const cors = require('cors');
const util = require('util');
const app = express();
const port = 5001;

// Enable CORS and JSON parsing
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true
}));
app.use(express.json());

// Store the latest cricket data and right team config
let latestCricketData = null;
let rightTeamConfig = {
    name: "AUS",
    score: "140-9",
    overs: "31.5",
    logoUrl: "https://cricketvectors.akamaized.net/Teams/P.png?impolicy=default_web"
};

// Import Weather API functions
const { getWeatherData } = require('./services/api');

// Add weather configuration storage
let weatherConfig = {
  city: null
};

// Existing endpoints for cricket data
app.post('/update-data', (req, res) => {
    try {
        latestCricketData = req.body;
        
        // Use util.inspect for detailed object logging
        console.log('\nReceived new cricket data:', util.inspect(latestCricketData, {
            depth: null,
            colors: true,
            maxArrayLength: null,
            compact: false
        }));

        res.json({ success: true, message: 'Data updated successfully' });
    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/get-data', (req, res) => {
    res.json(latestCricketData || {});
});

// Endpoints for right team score
app.get('/get-right-team', (req, res) => {
    res.json(rightTeamConfig);
});

app.post('/update-right-team', (req, res) => {
    rightTeamConfig = req.body;
    console.log('Updated right team config:', rightTeamConfig);
    res.json({ success: true });
});

// Weather-related endpoints
app.post('/update-weather-config', (req, res) => {
    try {
        const { city } = req.body;
        if (!city) {
            return res.status(400).json({ success: false, message: 'City name is required' });
        }
        
        weatherConfig.city = city;
        console.log('Updated weather config:', weatherConfig);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating weather config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/get-weather-config', (req, res) => {
    res.json(weatherConfig);
});

app.get('/test-weather', async (req, res) => {
    try {
        const { city } = req.query;
        if (!city) {
            return res.status(400).json({ success: false, message: 'City name is required' });
        }

        const weatherData = await getWeatherData(city);
        if (!weatherData) {
            return res.status(404).json({ success: false, message: 'Weather data not found' });
        }

        res.json(weatherData);
    } catch (error) {
        console.error('Error fetching weather:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 