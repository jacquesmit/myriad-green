(function(){
  try {
    const el = document.getElementById('page-h1');
    if (!el) return;
    // If a weather-driven override exists on body, use it
    const weatherH1 = document.documentElement && document.documentElement.dataset && document.documentElement.dataset.weatherH1;
    if (weatherH1) {
      el.textContent = weatherH1;
    }
  } catch(e) { /* noop */ }
})();
