(() => {
  // Widget selectors for DOM queries
  const SELECTORS = {
    widget: '#weather-widget',
    heroTitle: '.weather-widget-title',
    heroIntro: '.weather-widget-intro'
  };

  // Simple in-memory cache for weather data (per page load)
  const weatherCache = {};

  // Weather widget SVG icon generator
  function svgFor(name) {
    switch (name) {
      case 'rain-light':
        return `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <g fill="currentColor">
    <circle cx="18" cy="20" r="7"/>
    <circle cx="28" cy="18" r="6"/>
    <rect x="12" y="20" width="24" height="9" rx="5"/>
  </g>
  <g stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.85">
    <line x1="18" y1="32" x2="15" y2="38"/>
    <line x1="24" y1="32" x2="21" y2="38"/>
    <line x1="30" y1="32" x2="27" y2="38"/>
  </g>
</svg>`;
      case 'rain-heavy':
        return `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <g fill="currentColor">
    <circle cx="18" cy="20" r="7"/>
    <circle cx="28" cy="18" r="6"/>
    <rect x="12" y="20" width="24" height="9" rx="5"/>
  </g>
  <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.95">
    <line x1="16" y1="31" x2="13" y2="39"/>
    <line x1="21" y1="31" x2="18" y2="39"/>
    <line x1="26" y1="31" x2="23" y2="39"/>
    <line x1="31" y1="31" x2="28" y2="39"/>
  </g>
</svg>`;
      case 'wind':
        return `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <g stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none">
    <path d="M8 18c6 0 10 0 14-2 3-2 6-2 8 0 2 2 1 5-2 6"/>
    <path d="M6 26c8 0 12 0 16-2 4-2 7-2 9 0 2 2 2 5-1 6"/>
    <path d="M10 34c6 0 9 0 12-2"/>
  </g>
</svg>`;
      case 'thunder':
        return `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <g fill="currentColor">
    <circle cx="18" cy="20" r="7"/>
    <circle cx="28" cy="18" r="6"/>
    <rect x="12" y="20" width="24" height="9" rx="5"/>
  </g>
  <polygon points="24,30 19,39 24,39 22,46 30,35 26,35 29,30" fill="currentColor"/>
</svg>`;
      case 'snow':
        return `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <g fill="currentColor">
    <circle cx="18" cy="20" r="7"/>
    <circle cx="28" cy="18" r="6"/>
    <rect x="12" y="20" width="24" height="9" rx="5"/>
  </g>
  <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <line x1="18" y1="32" x2="18" y2="38"/>
    <line x1="15" y1="35" x2="21" y2="35"/>
    <line x1="16" y1="33" x2="20" y2="37"/>
    <line x1="20" y1="33" x2="16" y2="37"/>
    <line x1="28" y1="32" x2="28" y2="38"/>
    <line x1="25" y1="35" x2="31" y2="35"/>
    <line x1="26" y1="33" x2="30" y2="37"/>
    <line x1="30" y1="33" x2="26" y2="37"/>
  </g>
</svg>`;
      case 'mist':
        return `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <g fill="currentColor">
    <circle cx="18" cy="20" r="7"/>
    <circle cx="28" cy="18" r="6"/>
    <rect x="12" y="20" width="24" height="9" rx="5"/>
  </g>
  <g stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.9">
    <line x1="12" y1="34" x2="36" y2="34"/>
    <line x1="14" y1="38" x2="34" y2="38"/>
  </g>
</svg>`;
      case 'hot':
        return `
<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <circle cx="24" cy="24" r="8" fill="currentColor" opacity="0.95"/>
  <g stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.85">
    <path d="M8 40c4-2 6-2 10 0M30 40c4-2 6-2 10 0" fill="none"/>
  </g>
</svg>`;
      default:
        return '';
    }
  }

  function iconNameFor(conditions, tempC, windKph, precipProb) {
    // Basic mapping for demo; expand as needed
    const c = (conditions || '').toLowerCase();
    if (c.includes('rain') || precipProb > 50) return 'rain-heavy';
    if (c.includes('drizzle')) return 'rain-light';
    if (c.includes('snow')) return 'snow';
    if (c.includes('thunder')) return 'thunder';
    if (c.includes('mist') || c.includes('fog')) return 'mist';
    if (c.includes('wind') || windKph > 30) return 'wind';
    if (tempC >= 32) return 'hot';
    if (c.includes('clear') || c.includes('sun')) return 'sun';
    return 'cloud';
  }

  function emojiFor(conditions, tempC, windKph, precipProb) {
    const c = (conditions || '').toLowerCase();
    if (c.includes('rain') || precipProb > 50) return '🌧️';
    if (c.includes('drizzle')) return '🌦️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('thunder')) return '⛈️';
    if (c.includes('mist') || c.includes('fog')) return '🌫️';
    if (c.includes('wind') || windKph > 30) return '💨';
    if (tempC >= 32) return '☀️';
    if (c.includes('clear') || c.includes('sun')) return '🌞';
    return '☁️';
  }

  // Service-specific advice function
  function chooseHeadline(suburb, w, service) {
    const c = (w.condition || '').toLowerCase();
    const t = w.tempC;
    if (service === 'Leak Detection') {
      if (c.includes('rain') || c.includes('drizzle') || w.precipProb >= 50) {
        return {
          h1: `Rainy Weather Leak Detection Advice for ${suburb}`,
          intro: `Heavy rain can reveal hidden leaks. Check for pooling water and monitor your meter.`
        };
      }
      if (t <= 12) {
        return {
          h1: `Cold Weather Leak Detection in ${suburb}`,
          intro: `Cold snaps can cause pipe bursts. Inspect for damp spots and listen for running water.`
        };
      }
      return {
        h1: `Leak Detection & Prevention in ${suburb}`,
        intro: `Regularly check for unexplained water usage and visible leaks.`
      };
    }
    if (service === 'Landscaping') {
      if (t >= 32) {
        return {
          h1: `Hot Weather Landscaping Tips for ${suburb}`,
          intro: `Mulch beds, shade plants, and water early to reduce stress.`
        };
      }
      if (c.includes('rain') || c.includes('drizzle') || w.precipProb >= 50) {
        return {
          h1: `Rainy Day Landscaping in ${suburb}`,
          intro: `Rain helps new plantings settle. Avoid working wet soil to prevent compaction.`
        };
      }
      return {
        h1: `Landscaping & Garden Care in ${suburb}`,
        intro: `Maintain healthy soil and prune regularly for best results.`
      };
    }
    // Default: Irrigation
    if (t >= 32) {
      return {
        h1: `Hot Weather Irrigation Tips for ${suburb}`,
        intro: `Water early morning or late evening to reduce evaporation.`
      };
    }
    if (c.includes('rain') || c.includes('drizzle') || w.precipProb >= 50) {
      return {
        h1: `Rainy Day Irrigation Advice for ${suburb}`,
        intro: `Skip watering after heavy rain to avoid overwatering.`
      };
    }
    return {
      h1: `Irrigation & Watering in ${suburb}`,
      intro: `Adjust schedules for seasonal changes and check for leaks.`
    };
  }

  // Helper to generate human-readable product advice with links
  function productAdviceSentence(products) {
    if (!products || !products.length) return '';
    // products: [{ name: 'RainSensor', url: '/shop/rainsensor' }, ...]
    const links = products.map((p, i) => {
      if (!p.url) return p.name;
      return `<a href="${p.url}" class="weather-product-link" target="_blank" rel="noopener">${p.name}</a>`;
    });
    if (links.length === 1) return `Consider installing ${links[0]}.`;
    if (links.length === 2) return `Consider installing ${links[0]} and ${links[1]}.`;
    return `Consider installing ${links.slice(0, -1).join(', ')}, and ${links[links.length - 1]}.`;
  }

  // Scenario-to-service/product mapping for Myriad Green
  const scenarioMap = {
    rain: [
      { type: "product", name: "RainSensor", url: "/shop/rainsensor" },
      { type: "service", name: "Rainwater Harvesting", url: "/services/rainwater-harvesting" },
      { type: "product", name: "Rainwater Tank", url: "/shop/rainwater-tank" }
    ],
    hot: [
      { type: "product", name: "Drip Irrigation Kit", url: "/shop/drip-irrigation-kit" },
      { type: "service", name: "Irrigation Installation, Maintenance & Repairs", url: "/services/irrigation" }
    ],
    leak: [
      { type: "service", name: "Leak Detection (Tracer Gas, Acoustic, Non-Invasive)", url: "/services/leak-detection" },
      { type: "product", name: "Leak Repair Kit", url: "/shop/leak-repair-kit" }
    ],
    blocked_drain: [
      { type: "service", name: "Drain Unblocking", url: "/services/drain-unblocking" },
      { type: "product", name: "Drain Unblocker", url: "/shop/drain-unblocker" }
    ],
    borehole: [
      { type: "service", name: "Borehole Repairs, Maintenance & Installations", url: "/services/borehole" },
      { type: "product", name: "Borehole Pump", url: "/shop/borehole-pump" }
    ],
    pump: [
      { type: "service", name: "Pumps", url: "/services/pumps" },
      { type: "product", name: "Booster Pump", url: "/shop/booster-pump" }
    ],
    filtration: [
      { type: "service", name: "Water Filtration", url: "/services/water-filtration" },
      { type: "product", name: "Water Filtration System", url: "/shop/water-filtration" }
    ],
    waste_water: [
      { type: "service", name: "Waste Water Systems", url: "/services/waste-water" },
      { type: "product", name: "Waste Water System Kit", url: "/shop/waste-water-system" }
    ],
    storage: [
      { type: "service", name: "Water Storage Solutions / Municipal Backup Services", url: "/services/water-storage" },
      { type: "product", name: "Water Storage Tank", url: "/shop/water-storage-tank" },
      { type: "product", name: "Municipal Backup Kit", url: "/shop/municipal-backup" }
    ],
    landscaping: [
      { type: "service", name: "Landscaping", url: "/services/landscaping" }
    ]
  };

  function getRecommendationsForScenario(scenario) {
    return scenarioMap[scenario] || [];
  }

  // Product mapping by weather, service, and trend
  const productMap = {
    rain: [
      { name: "RainSensor", url: "/shop/rainsensor" },
      { name: "Rainwater Tank", url: "/shop/rainwater-tank" }
    ],
    hot: [
      { name: "Smart Controller X1", url: "/shop/smart-controller-x1" },
      { name: "Drip Irrigation Kit", url: "/shop/drip-irrigation-kit" }
    ],
    leak: [
      { name: "Leak Repair Kit", url: "/shop/leak-repair-kit" }
    ],
    default: [
      { name: "Water Saving Kit", url: "/shop/water-saving-kit" }
    ]
  };

  function getProductsForScenario(weather, service, trend) {
    let products = [];
    const w = weather.toLowerCase();
    const s = (service || '').toLowerCase();
    if (w.includes("rain")) products = productMap.rain;
    else if (w.includes("hot")) products = productMap.hot;
    else if (s.includes("leak")) products = productMap.leak;
    else products = productMap.default;
    // Optionally, add trend-based logic here
    return products;
  }

  // Blended headline generator (updated usage)
  function generateBlendedHeadline({suburb, w, service, trendKeyword}) {
    // 1. Weather-specific headline
    let base = '';
    const c = (w.conditions || '').toLowerCase();
    const t = w.tempC;
    if (service === 'Leak Detection') {
      if (c.includes('rain') || c.includes('drizzle') || w.precipProb >= 50) {
        base = `Rainy Day Leak Detection in ${suburb}`;
      } else if (t <= 12) {
        base = `Cold Weather Leak Detection in ${suburb}`;
      } else {
        base = `Leak Detection & Prevention in ${suburb}`;
      }
    } else if (service === 'Landscaping') {
      if (t >= 32) {
        base = `Hot Weather Landscaping Tips for ${suburb}`;
      } else if (c.includes('rain') || c.includes('drizzle') || w.precipProb >= 50) {
        base = `Rainy Day Landscaping in ${suburb}`;
      } else {
        base = `Landscaping & Garden Care in ${suburb}`;
      }
    } else {
      // Default: Irrigation
      if (t >= 32) {
        base = `Hot Weather Irrigation Tips for ${suburb}`;
      } else if (c.includes('rain') || c.includes('drizzle') || w.precipProb >= 50) {
        base = `Rainy Day Irrigation Advice for ${suburb}`;
      } else {
        base = `Irrigation & Watering in ${suburb}`;
      }
    }
    // 2. Add Google Trends keyword if available
    let trend = trendKeyword ? ` – Trending: ${trendKeyword}` : '';
    // 3. Select best products for scenario
    const products = getProductsForScenario(w.conditions || '', service, trendKeyword);
    let prodSentence = products && products.length ? ' ' + productAdviceSentence(products) : '';
    // 4. Combine for human readability
    return `${base}${trend}.${prodSentence}`;
  }

  async function fetchWeather(suburb, country, units, apiBase = '') {
    // Caching logic
    const cacheKey = `${suburb}|${country}|${units}`;
    if (weatherCache[cacheKey]) {
      console.log('[fetchWeather] Using cached data for:', cacheKey, weatherCache[cacheKey]);
      return weatherCache[cacheKey];
    }
    console.log('[fetchWeather] No cache found, fetching fresh data for:', cacheKey);
    // 1) Current conditions
    const q = encodeURIComponent(`${suburb},${country}`);
    const base = (apiBase || '').replace(/\/$/, '');
    const url = `${base}/api/weather?city=${q}&units=${units}`;
    console.log('[WeatherWidget] Fetching weather from:', url);
    const current = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`weather not found: ${r.status}`);
      return r.json();
    });

    // Normalize
    // Already normalized by server
    const tempC = current?.tempC ?? null;
    const windKph = current?.windKph ?? null;
    const conditions = (current?.conditions || '').toLowerCase();

    // 2) Hourly precip probability (best effort)
    let precipProb = 0;
    // Server already computed precipProb; keep fallback if missing
    try {
      if (typeof current?.precipProb === 'number') {
        precipProb = current.precipProb;
      }
    } catch {}

    console.log('[WeatherWidget] API Response:', current);
    
    weatherCache[cacheKey] = {
      conditions,
      tempC: Number.isFinite(tempC) ? Math.round(tempC) : null,
      feelsLikeC: current?.feelsLikeC || tempC,
      humidity: current?.humidity || 0,
      pressure: current?.pressure || 0,
      visibility: current?.visibility || 0,
      windKph,
      precipProb,
      drought: false
    };
    
    console.log('[WeatherWidget] Processed data:', weatherCache[cacheKey]);
    
    // Add debug display to page
    const debugEl = document.getElementById('weather-debug') || document.createElement('div');
    debugEl.id = 'weather-debug';
    debugEl.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:white;padding:10px;border-radius:5px;font-family:monospace;font-size:12px;z-index:9999;';
    debugEl.innerHTML = `
      <strong>Weather Debug:</strong><br>
      Temp: ${weatherCache[cacheKey].tempC}°C<br>
      Source: ${current ? 'API' : 'Cache'}<br>
      Time: ${new Date().toLocaleTimeString()}
    `;
    if (!document.getElementById('weather-debug')) {
      document.body.appendChild(debugEl);
    }
    
    return weatherCache[cacheKey];
  }

  function updateHero(h1, intro, isHTML) {
    const tH1 = document.querySelector(SELECTORS.heroTitle);
    const tIntro = document.querySelector(SELECTORS.heroIntro);
    // Update widget headline
    if (tH1) {
      if (isHTML) tH1.innerHTML = h1;
      else tH1.textContent = h1;
      tH1.setAttribute('aria-live', 'polite');
      tH1.setAttribute('tabindex', '0');
    }
    if (tIntro) {
      tIntro.textContent = intro;
      tIntro.setAttribute('aria-live', 'polite');
      tIntro.setAttribute('tabindex', '0');
    }
    // Update main hero h1 if present
    const heroH1 = document.querySelector('h1[data-hero-title]');
    if (heroH1) {
      if (isHTML) heroH1.innerHTML = h1;
      else heroH1.textContent = h1;
      heroH1.setAttribute('aria-live', 'polite');
      heroH1.setAttribute('tabindex', '0');
    }
  }

  // Update enhanced weather widget
  function updateEnhancedWidget(el, suburb, w, headline) {
    // Check for new weather section structure first
    const newWeatherSection = el.querySelector('.weather-grid');
    if (newWeatherSection) {
      updateNewWeatherSection(el, suburb, w, headline);
      return;
    }

    // Fallback to original enhanced widget
    const enhancedWidget = el.querySelector('.enhanced-weather-widget');
    if (!enhancedWidget) return;

    // Update location
    const locationEl = enhancedWidget.querySelector('.weather-location span:last-child');
    if (locationEl) locationEl.textContent = suburb;

    // Update time
    const timeEl = enhancedWidget.querySelector('.weather-time span:last-child');
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();

    // Update weather icon
    const iconEl = enhancedWidget.querySelector('.weather-icon i');
    if (iconEl) {
      const iconClass = getWeatherIconClass(w.conditions, w.tempC);
      iconEl.className = iconClass;
    }

    // Update temperature
    const tempEl = enhancedWidget.querySelector('.current-temperature');
    if (tempEl) tempEl.textContent = Number.isFinite(w.tempC) ? `${w.tempC}°` : '--°';

    // Update description
    const descEl = enhancedWidget.querySelector('.weather-description');
    if (descEl) descEl.textContent = w.conditions || 'Unknown';

    // Update feels like
    const feelsLikeEl = enhancedWidget.querySelector('.feels-like');
    if (feelsLikeEl) {
      const feelsLike = w.feelsLikeC || w.tempC;
      feelsLikeEl.textContent = `Feels like ${feelsLike}°`;
    }

    // Update detail values
    const humidityEl = enhancedWidget.querySelector('[data-detail="humidity"] .detail-value');
    if (humidityEl) humidityEl.textContent = `${w.humidity || 0}%`;

    const windEl = enhancedWidget.querySelector('[data-detail="wind"] .detail-value');
    if (windEl) windEl.textContent = `${w.windKph || 0} km/h`;

    const pressureEl = enhancedWidget.querySelector('[data-detail="pressure"] .detail-value');
    if (pressureEl) pressureEl.textContent = `${w.pressure || 0} hPa`;

    const visibilityEl = enhancedWidget.querySelector('[data-detail="visibility"] .detail-value');
    if (visibilityEl) visibilityEl.textContent = `${w.visibility || 0} km`;

    // Update irrigation advice
    const adviceContent = enhancedWidget.querySelector('.advice-content');
    if (adviceContent) {
      const advice = generateIrrigationAdvice(w, suburb);
      adviceContent.innerHTML = advice.map(item => 
        `<div class="advice-item"><i class="fas fa-droplet"></i><span>${item}</span></div>`
      ).join('');
    }

    // Update last updated time
    const lastUpdatedEl = enhancedWidget.querySelector('.last-updated span:last-child');
    if (lastUpdatedEl) lastUpdatedEl.textContent = 'Just now';

    // Add refresh functionality
    const refreshBtn = enhancedWidget.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = () => refreshWeatherData(el, suburb);
    }
  }

  // Update function for new weather section structure
  function updateNewWeatherSection(el, suburb, w, headline) {
    console.log('[updateNewWeatherSection] Temperature data:', w.tempC, 'for suburb:', suburb);
    // Update location name
    const locationEl = el.querySelector('.location-name');
    if (locationEl) locationEl.textContent = suburb;

    // Update update time
    const updateTimeEl = el.querySelector('.update-time');
    if (updateTimeEl) {
      const now = new Date();
      updateTimeEl.textContent = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }

    // Update weather icon
    const iconEl = el.querySelector('.weather-icon-large i');
    if (iconEl) {
      const iconClass = getWeatherIconClass(w.conditions, w.tempC);
      iconEl.className = iconClass;
    }

    // Update temperature
    const tempValueEl = el.querySelector('.temp-value');
    if (tempValueEl) tempValueEl.textContent = Number.isFinite(w.tempC) ? w.tempC : '--';

    // Update weather condition
    const conditionEl = el.querySelector('.weather-condition');
    if (conditionEl) conditionEl.textContent = w.conditions || 'Unknown';

    // Update feels like
    const feelsLikeEl = el.querySelector('.feels-like-temp');
    if (feelsLikeEl) {
      const feelsLike = w.feelsLikeC || w.tempC;
      feelsLikeEl.textContent = `Feels like ${feelsLike}°C`;
    }

    // Update weather metrics
    const humidityEl = el.querySelector('.weather-metric[data-metric="humidity"] .metric-value');
    if (humidityEl) humidityEl.textContent = `${w.humidity || 0}%`;

    const windEl = el.querySelector('.weather-metric[data-metric="wind"] .metric-value');
    if (windEl) windEl.textContent = `${w.windKph || 0} km/h`;

    const pressureEl = el.querySelector('.weather-metric[data-metric="pressure"] .metric-value');
    if (pressureEl) pressureEl.textContent = `${w.pressure || 0} hPa`;

    const visibilityEl = el.querySelector('.weather-metric[data-metric="visibility"] .metric-value');
    if (visibilityEl) visibilityEl.textContent = `${w.visibility || 0} km`;

    // Update irrigation advice
    const adviceTextEl = el.querySelector('.advice-text');
    if (adviceTextEl) {
      const advice = generateIrrigationAdvice(w, suburb);
      adviceTextEl.textContent = advice.join('. ') + '.';
    }

    // Update last update time
    const lastUpdateEl = el.querySelector('.last-update');
    if (lastUpdateEl) lastUpdateEl.textContent = 'Updated just now';

    // Add refresh functionality
    const refreshBtn = el.querySelector('.weather-refresh-btn');
    if (refreshBtn) {
      refreshBtn.onclick = () => refreshWeatherData(el, suburb);
    }
  }

  // Get FontAwesome icon class for weather conditions
  function getWeatherIconClass(conditions, temp) {
    const c = (conditions || '').toLowerCase();
    if (c.includes('sun') || c.includes('clear')) return 'fas fa-sun';
    if (c.includes('cloud')) return 'fas fa-cloud';
    if (c.includes('rain')) return 'fas fa-cloud-rain';
    if (c.includes('storm') || c.includes('thunder')) return 'fas fa-bolt';
    if (c.includes('snow')) return 'fas fa-snowflake';
    if (c.includes('wind')) return 'fas fa-wind';
    if (c.includes('fog') || c.includes('mist')) return 'fas fa-smog';
    return 'fas fa-cloud-sun'; // default
  }

  // Generate irrigation advice based on weather
  function generateIrrigationAdvice(w, suburb) {
    const advice = [];
    const temp = w.tempC || 0;
    const conditions = (w.conditions || '').toLowerCase();
    const humidity = w.humidity || 0;
    const wind = w.windKph || 0;

    if (temp > 30) {
      advice.push('Water early morning (5-7 AM) to reduce evaporation');
      advice.push('Increase watering frequency for stressed plants');
    } else if (temp < 15) {
      advice.push('Reduce watering frequency in cool weather');
      advice.push('Water during warmest part of the day');
    }

    if (conditions.includes('rain')) {
      advice.push('Skip scheduled watering after heavy rain');
      advice.push('Check soil moisture before next watering cycle');
    } else if (humidity < 30) {
      advice.push('Low humidity increases water needs');
      advice.push('Consider mulching to retain soil moisture');
    }

    if (wind > 20) {
      advice.push('Windy conditions increase evaporation rates');
      advice.push('Use drip irrigation to minimize wind interference');
    }

    if (advice.length === 0) {
      advice.push('Maintain regular watering schedule');
      advice.push('Check soil moisture levels regularly');
    }

    return advice;
  }

  // Refresh weather data
  async function refreshWeatherData(el, suburb) {
    const refreshBtn = el.querySelector('.refresh-btn, .weather-refresh-btn');
    const enhancedWidget = el.querySelector('.enhanced-weather-widget');
    const newWeatherSection = el.querySelector('.weather-grid');
    
    if (refreshBtn) refreshBtn.disabled = true;
    if (enhancedWidget) enhancedWidget.classList.add('weather-loading');
    if (newWeatherSection) newWeatherSection.classList.add('weather-loading');

    try {
      // Clear cache for this location
      const cacheKey = `${suburb}|ZA|metric`;
      delete weatherCache[cacheKey];
      
      // Fetch fresh data with API base detection
      let apiBase = '';
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        apiBase = 'http://localhost:3000';
      }
      const w = await fetchWeather(suburb, 'ZA', 'metric', apiBase);
      const headline = generateBlendedHeadline({suburb, w, service: 'Irrigation'});
      
      updateEnhancedWidget(el, suburb, w, headline);
      
    } catch (error) {
      console.error('Failed to refresh weather:', error);
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
      if (enhancedWidget) enhancedWidget.classList.remove('weather-loading');
      if (newWeatherSection) newWeatherSection.classList.remove('weather-loading');
    }
  }

  function renderWidget(el, suburb, w, headline, theme) {
    console.log('[renderWidget] Temperature data:', w.tempC, 'for suburb:', suburb);
    const tempTxt = Number.isFinite(w.tempC) ? `${w.tempC}°C` : '--°C';
    const iconName = iconNameFor(w.conditions, w.tempC, w.windKph, w.precipProb);
    const svg = svgFor(iconName);
    const fallback = emojiFor(w.conditions, w.tempC, w.windKph, w.precipProb);
    const iconHTML = svg || fallback;
    const aria = `${(w.conditions || 'weather')}, ${tempTxt}`;
    const themeClass = theme ? ` theme-${theme}` : '';

    el.innerHTML = `
      <div class="weather-widget-card${themeClass}" role="region" aria-label="Weather and water advice" tabindex="0">
        <div class="weather-widget-header">
          <span class="weather-widget-icon" role="img" aria-label="${aria}">${iconHTML}</span>
          <span class="weather-widget-temp" aria-label="Temperature">${tempTxt}</span>
        </div>
        <div class="weather-widget-location" aria-label="Location">${suburb}</div>
        <div class="weather-widget-headline" aria-live="polite">${headline.h1}</div>
        <div class="weather-widget-solution">${headline.intro}</div>
        <div class="weather-widget-meta">Wind: ${w.windKph ?? '--'} km/h · Rain chance: ${Math.round(w.precipProb)}%</div>
      </div>
    `;

    // expose for SEO/meta rules
    window.__WEATHER__ = w;
    if (window.MRG_SEO?.init) {
      try { window.MRG_SEO.init({ pageType: 'service', serviceName: 'Irrigation' }); } catch {}
    }
  }

  function updateMetaTags(headline, suburb, service, w) {
    // Compose keywords and description
    const keywords = [
      service,
      suburb,
      w.conditions,
      `${w.tempC}C`,
      'weather',
      'advice',
      'solutions',
      'tips',
      'local',
      'South Africa',
      'Myriad Green'
    ].filter(Boolean).join(', ');
    const description = `${headline.h1} - ${headline.intro}`;
    // Update meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', keywords);
    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);
    // Update document title
    document.title = headline.h1;
  }

  async function init() {
    const el = document.querySelector(SELECTORS.widget);
    if (!el) {
      console.error('[WeatherWidget] Widget element not found:', SELECTORS.widget);
      return;
    }

    const suburb = el.getAttribute('data-suburb') || 'Johannesburg';
    const country = el.getAttribute('data-country') || 'ZA';
    const units = el.getAttribute('data-units') || 'metric';
    let service = el.getAttribute('data-service') || window.__SELECTED_SERVICE__ || 'Irrigation';
    let apiBase = el.getAttribute('data-api-base') || '';
    // Add products and trend keyword hooks
    let products = window.__SELECTED_PRODUCTS__ || [];
    let trendKeyword = window.__TREND_KEYWORD__ || '';
    if (!apiBase) {
      const host = window.location.hostname;
      const port = window.location.port;
      const isLocal = (host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host));
      if (isLocal && port !== '3000') {
        apiBase = 'http://localhost:3000';
      }
    }
    const theme = el.getAttribute('data-theme') || 'blue';
    const tone = el.getAttribute('data-tone') || 'soft';
    const accent = el.getAttribute('data-accent');
    const iconColor = el.getAttribute('data-icon');
    const bgStart = el.getAttribute('data-bg-start');
    const bgEnd = el.getAttribute('data-bg-end');
    const solidBg = el.getAttribute('data-bg');
    const radius = el.getAttribute('data-radius');
    const shadow = el.getAttribute('data-shadow');
    const border = el.getAttribute('data-border');

    el.innerHTML = `
      <div class="weather-widget-card is-loading" role="status" aria-live="polite">
        <div class="weather-widget-header">
          <span class="weather-widget-icon">⋯</span>
          <span class="weather-widget-temp">--°C</span>
        </div>
        <div class="weather-widget-location">${suburb}</div>
        <div class="weather-widget-headline">Checking local weather…</div>
        <div class="weather-widget-solution">One moment.</div>
      </div>
    `;

    // Helper to add theme/tone classes and apply variable overrides
    const applyVisuals = () => {
      const cardEl = el.querySelector('.weather-widget-card');
      if (!cardEl) return;
      // theme and tone classes
      if (theme) cardEl.classList.add(`theme-${theme}`);
      if (tone) cardEl.classList.add(`tone-${tone}`);

      // Inline style var overrides
      let styleVars = '';
      if (accent) styleVars += `--w-accent:${accent};`;
      if (bgStart && bgEnd) styleVars += `--w-card-bg:linear-gradient(180deg,${bgStart} 0%,${bgEnd} 100%);`;
      else if (solidBg) styleVars += `--w-card-bg:${solidBg};`;
      if (radius) styleVars += `--w-radius:${radius};`;
      if (shadow) styleVars += `--w-card-shadow:${shadow};`;
      if (border) styleVars += `--w-card-border:${border};`;
      if (iconColor) styleVars += `--w-icon-color:${iconColor};`;
      if (styleVars) cardEl.setAttribute('style', (cardEl.getAttribute('style') || '') + styleVars);
    };

    // Apply visuals to the loading state so theme/tone show immediately
    applyVisuals();

    try {
      const w = await fetchWeather(suburb, country, units, apiBase);
      const headlineHTML = generateBlendedHeadline({suburb, w, service, trendKeyword});
      const headline = { h1: headlineHTML, intro: '' };
      updateHero(headline.h1, headline.intro, true); // pass true for HTML injection
      renderWidget(el, suburb, w, headline, theme);
      
      // Update enhanced widget if present
      updateEnhancedWidget(el, suburb, w, headline);
      
      applyVisuals();
      updateMetaTags(headline, suburb, service, w);
    } catch (err) {
      console.error('[WeatherWidget] Error fetching or rendering weather:', err);
      el.innerHTML = `
        <div class="weather-widget-card is-error" role="alert">
          <div class="weather-widget-header">
            <span class="weather-widget-icon">⚠️</span>
            <span class="weather-widget-temp">--°C</span>
          </div>
          <div class="weather-widget-location">${suburb}</div>
          <div class="weather-widget-headline">Weather unavailable</div>
          <div class="weather-widget-solution">Could not fetch weather. Try again later.</div>
        </div>
      `;
      // Ensure themed/tone visuals still apply in error state
      applyVisuals();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
