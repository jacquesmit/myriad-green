// Google Trends API integration for Node.js
// Uses 'google-trends-api' npm package
const express = require('express');
const router = express.Router();
const googleTrends = require('google-trends-api');

// GET /api/trends?keyword=irrigation&geo=ZA
router.get('/', async (req, res) => {
  const keyword = req.query.keyword || 'irrigation';
  const geo = req.query.geo || 'ZA';
  try {
    const results = await googleTrends.dailyTrends({
      geo,
    });
    // Parse top trending keyword for the day
    const dayTrends = results.default.trendingSearchesDays?.[0]?.trendingSearches || [];
    let topTrend = '';
    if (dayTrends.length) {
      // Find a trend matching the keyword, else use the top one
      topTrend = dayTrends.find(t => t.title.query.toLowerCase().includes(keyword.toLowerCase()))?.title.query || dayTrends[0].title.query;
    }
    res.json({ trend: topTrend });
  } catch (err) {
    console.error('[Trends API] Error:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

module.exports = router;
