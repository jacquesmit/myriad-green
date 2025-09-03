// Placeholder to avoid 404s if referenced by legacy pages.
// You can implement a real theme toggle later.
(function(){
  window.toggleTheme = function(next){
    const html = document.documentElement;
    const cur = html.getAttribute('data-theme') || 'light';
    const nextTheme = next || (cur === 'light' ? 'dark' : 'light');
    html.setAttribute('data-theme', nextTheme);
  };
})();
