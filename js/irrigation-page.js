// CTA Wiring — Irrigation Page (Book + Buy) — Safe & Minimal
(() => {
  window.__CTA_ROUTER_READY__ = false;

  const ready = (fn) =>
    document.readyState !== 'loading'
      ? fn()
      : document.addEventListener('DOMContentLoaded', fn);

  function fireAnalytics(detail){
    document.dispatchEvent(new CustomEvent('analytics:event',{ detail }));
    console.info('analytics:event', detail);
  }

  async function openBooking(btn){
    const service = btn.dataset.service || 'irrigation';        // default for this page
    const ctx = { service, source: location.pathname };
    const last = document.activeElement;

    btn.setAttribute('aria-busy','true');
    btn.disabled = true;

    try {
      if (window.BookingModal?.open) {
        await window.BookingModal.open(ctx);                     // preferred API
      } else {
        document.dispatchEvent(new CustomEvent('booking:open', { // fallback event
          detail: ctx
        }));
      }
    } finally {
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
      last && last.focus?.();
    }

    fireAnalytics({ type:'book', id: btn.id || null, service, page:'irrigation' });
  }

  function toCheckout(btn){
    const sku = btn.dataset.sku;
    fireAnalytics({ type:'buy', id: btn.id || null, sku, page:'irrigation' });

    if (window.App?.checkout?.start) {
      return window.App.checkout.start({ sku, source:'irrigation' });
    }
    if (typeof window.getCheckoutUrl === 'function') {
      return location.assign(window.getCheckoutUrl(sku));
    }
    return location.assign(`${location.origin}/checkout/?sku=${encodeURIComponent(sku)}`);
  }

  function onClick(e){
    const t = e.target.closest('.book-now[data-service], .buy-now[data-sku], a[href^="#"]');
    if (!t) return;

    // BOOK
    if (t.matches('.book-now')) {
      e.preventDefault();
      openBooking(t);
      return;
    }

    // BUY
    if (t.matches('.buy-now')) {
      e.preventDefault();
      toCheckout(t);
      return;
    }

    // Optional: smooth in-page anchors
    if (t.matches('a[href^="#"]')) {
      const id = t.getAttribute('href');
      const target = id && document.querySelector(id);
      if (target) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        reduce ? target.scrollIntoView()
               : target.scrollIntoView({behavior:'smooth', block:'start'});
        target.tabIndex ??= -1; target.focus({preventScroll:true});
        e.preventDefault();
      }
    }
  }

  function bind(){
    document.addEventListener('click', onClick, false);
    window.__CTA_ROUTER_READY__ = true;
    console.info('[cta:router] ready');
  }

  ready(bind);
  document.addEventListener('partials:ready', bind, { once:true }); // if CTAs ever arrive via partials
})();