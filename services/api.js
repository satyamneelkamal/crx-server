import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// Cache object to store weather data and timestamp
let weatherCache = {
    data: null,
    timestamp: null,
    city: null
};

// Function to check if cache is expired (older than 1 minute)
const isCacheExpired = () => {
    if (!weatherCache.timestamp) return true;
    const now = Date.now();
    const cacheAge = now - weatherCache.timestamp;
    return cacheAge > 60000; // 60000 ms = 1 minute
};

export const getWeatherData = async (city) => {
    try {
        // If we have cached data for the same city and it's not expired, return it
        if (
            weatherCache.data && 
            weatherCache.city === city && 
            !isCacheExpired()
        ) {
            console.log('Returning cached weather data');
            return weatherCache.data;
        }

        // If cache is expired or different city, fetch new data
        console.log('Fetching fresh weather data');
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Update cache
        weatherCache = {
            data: data,
            timestamp: Date.now(),
            city: city
        };

        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        // If there's an error fetching new data and we have cached data, return it
        if (weatherCache.data && weatherCache.city === city) {
            console.log('Returning cached data due to fetch error');
            return weatherCache.data;
        }
        throw error;
    }
};

// Optional: Function to manually clear cache
export const clearWeatherCache = () => {
    weatherCache = {
        data: null,
        timestamp: null,
        city: null
    };
};