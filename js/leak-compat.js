/**
 * Leak Detection Page — Compatibility Shim
 * Purpose: make the leak-detection HTML work with the site's existing
 * booking/subscription/testimonials/FAQ hooks without changing HTML.
 * Safe to keep or remove once you align class names 1:1.
 */
(function () {
  // 1) Booking hooks: map leak labels -> existing Irrigation labels expected by site JS
  document.querySelectorAll('.book-now[data-service]').forEach(function (btn) {
    var val = (btn.getAttribute('data-service') || '').toLowerCase();
    if (val.includes('leak') && val.includes('assessment')) {
      btn.setAttribute('data-service', 'Irrigation Assessment');
    } else if (val.includes('targeted') && val.includes('repair')) {
      btn.setAttribute('data-service', 'Irrigation Repair');
    } else if (val.includes('installation')) {
      btn.setAttribute('data-service', 'Irrigation Installation');
    } else if (val.includes('tune')) {
      btn.setAttribute('data-service', 'Irrigation Tune-up');
    }
  });

  // 2) Subscription hooks: add expected classes/plan codes
  var essential = document.querySelector('#plan-essential .pricing-card__cta, #plan-essential .subscribe-now');
  if (essential) {
    essential.classList.add('subscribe-now');
    essential.setAttribute('data-plan', 'IRR-ESSENTIAL');
  }

  var smart = document.querySelector('#plan-smart .pricing-card__cta, #plan-smart .subscribe-now');
  if (smart) {
    smart.classList.add('subscribe-now');
    smart.setAttribute('data-plan', 'IRR-SMART');
  }

  // 3) Testimonials alias: make grid double as "carousel" for CSS
  var tgrid = document.querySelector('.testimonials__grid');
  if (tgrid && !tgrid.classList.contains('testimonials__carousel')) {
    tgrid.classList.add('testimonials__carousel');
  }

  // 4) FAQ section: ensure modifier present so styles apply
  var faq = document.querySelector('#faq.section');
  if (faq && !faq.classList.contains('section--faq')) {
    faq.classList.add('section--faq');
  }

  // 5) Hero alias: if CSS expects .hero__inner, mirror it
  var heroGrid = document.querySelector('.hero__grid');
  if (heroGrid && !heroGrid.classList.contains('hero__inner')) {
    heroGrid.classList.add('hero__inner');
  }

  // 6) Why-us card alias -> existing .why-card styles (if present)
  document.querySelectorAll('.why-us-card').forEach(function (el) {
    if (!el.classList.contains('why-card')) el.classList.add('why-card');
  });

  // 7) Products: ensure product card alias for existing styles
  document.querySelectorAll('.products-grid .product-item').forEach(function (el) {
    if (!el.classList.contains('product-card')) el.classList.add('product-card');
  });
})();