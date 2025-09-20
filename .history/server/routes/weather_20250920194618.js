const express = require('express');
const router = express.Router();

// Ensure API key is present
const OWM_API_KEY = process.env.OWM_API_KEY;
if (!OWM_API_KEY) {
  console.warn('[weather route] Missing OWM_API_KEY in environment. Set it in your .env file.');
}

// Small helper to fetch JSON with basic error handling
async function getJSON(url) {
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) {
    throw new Error(`Request failed: ${res ? res.status : 'no response'}`);
  }
  return res.json();
}

// GET /api/weather?city=Johannesburg,ZA&units=metric
// or   /api/weather?lat=-26.2&lon=28.0&units=metric
router.get('/weather', async (req, res) => {
  try {
    if (!OWM_API_KEY) return res.status(500).json({ error: 'Server weather key not configured' });

    const { city, lat, lon, units = 'metric' } = req.query;

    let current;
    if (city) {
      const q = encodeURIComponent(city);
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${q}&units=${units}&appid=${OWM_API_KEY}`;
      current = await getJSON(url);
    } else if (lat && lon) {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${OWM_API_KEY}`;
      current = await getJSON(url);
    } else {
      return res.status(400).json({ error: 'Provide city or lat/lon' });
    }

    const tempC = current?.main?.temp ?? null;
    const feelsLikeC = current?.main?.feels_like ?? tempC;
    const humidity = current?.main?.humidity ?? 0;
    const pressure = current?.main?.pressure ?? 0;
    const visibility = current?.visibility ? Math.round(current.visibility / 1000) : 0; // Convert meters to km
    const windKph = Number.isFinite(current?.wind?.speed) ? Math.round(current.wind.speed * 3.6) : null;
    const conditions = (current?.weather?.[0]?.main || '').toLowerCase();

    // Best-effort precip probability via One Call
    let precipProb = 0;
    try {
      const { lat: clat, lon: clon } = current?.coord || {};
      if (Number.isFinite(clat) && Number.isFinite(clon)) {
        const oneCall = `https://api.openweathermap.org/data/2.5/onecall?lat=${clat}&lon=${clon}&exclude=minutely,daily,alerts&units=${units}&appid=${OWM_API_KEY}`;
        const oc = await getJSON(oneCall).catch(() => null);
        if (oc?.hourly?.length) {
          precipProb = Math.round(Math.max(...oc.hourly.slice(0, 6).map(h => (h.pop || 0) * 100)));
        }
      }
    } catch {}

    return res.json({
      conditions,
      tempC: Number.isFinite(tempC) ? Math.round(tempC) : null,
      windKph,
      precipProb,
      drought: false
    });
  } catch (err) {
    console.error('[weather route] Error:', err?.message);
    res.status(500).json({ error: 'Weather fetch failed' });
  }
});

module.exports = router;
