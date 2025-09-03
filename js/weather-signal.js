(function(){
  try {
    const w = document.getElementById('weather-widget');
    if (!w) return;
    const suburb = w.getAttribute('data-suburb') || '';
    const country = w.getAttribute('data-country') || '';
    // Expose a simple signal for other scripts
    window.__WEATHER_CONTEXT__ = { suburb, country };
  } catch(e) { /* noop */ }
})();
