// server.js
const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;
const API_PROVIDER = process.env.WEATHER_PROVIDER || 'open-meteo'; // 'open-meteo' or 'openweather' or 'weatherapi'
const API_KEY = process.env.WEATHER_API_KEY || ''; // used for providers that need keys
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || '600000'); // 10 min

const cache = new Map(); // simple in-memory cache

function makeCacheKey(lat, lon) {
  return `${lat},${lon}`;
}

async function fetchFromOpenMeteo(lat, lon) {
  // example: current weather
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const r = await axios.get(url, { timeout: 5000 });
  return r.data;
}

async function fetchFromOpenWeather(lat, lon) {
  // expects API_KEY set
  const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&units=metric&exclude=minutely&appid=${API_KEY}`;
  const r = await axios.get(url, { timeout: 5000 });
  return r.data;
}

async function fetchFromWeatherAPI(lat, lon) {
  // WeatherAPI can use q=lat,lon
  const url = `http://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${lat},${lon}`;
  const r = await axios.get(url, { timeout: 5000 });
  return r.data;
}

async function getWeather(lat, lon) {
  const key = makeCacheKey(lat, lon);
  const now = Date.now();
  if (cache.has(key)) {
    const { ts, data } = cache.get(key);
    if (now - ts < CACHE_TTL_MS) {
      return { data, cached: true };
    }
  }

  let data;
  if (API_PROVIDER === 'open-meteo') {
    data = await fetchFromOpenMeteo(lat, lon);
  } else if (API_PROVIDER === 'openweather') {
    data = await fetchFromOpenWeather(lat, lon);
  } else if (API_PROVIDER === 'weatherapi') {
    data = await fetchFromWeatherAPI(lat, lon);
  } else {
    throw new Error('Unknown provider');
  }

  cache.set(key, { ts: now, data });
  return { data, cached: false };
}

app.get('/weather', async (req, res) => {
  try {
    const lat = req.query.lat;
    const lon = req.query.lon;
    if (!lat || !lon) return res.status(400).json({ error: 'Provide lat and lon query params' });

    const result = await getWeather(lat, lon);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`weather app listening on ${PORT}, provider=${API_PROVIDER}`);
});

