// Add this temporarily to check for overflow on mobile
document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const html = document.documentElement;
  const allElements = document.querySelectorAll('*');
  
  allElements.forEach(el => {
    if (el.scrollWidth > html.clientWidth) {
      console.log('Overflow element:', el, 'Width:', el.scrollWidth);
    }
  });
});
