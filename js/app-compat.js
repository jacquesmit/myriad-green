(() => {
  /** Resolve native booking open function if the site already exposes one */
  function resolveNativeBookingOpen() {
    if (window.BookingModal && typeof window.BookingModal.open === 'function')
      return { fn: window.BookingModal.open, name: 'BookingModal.open' };
    if (window.Booking?.open && typeof window.Booking.open === 'function')
      return { fn: window.Booking.open, name: 'Booking.open' };
    if (window.Modal?.booking?.open && typeof window.Modal.booking.open === 'function')
      return { fn: window.Modal.booking.open, name: 'Modal.booking.open' };
    if (typeof window.openBookingModal === 'function')
      return { fn: window.openBookingModal, name: 'openBookingModal' };
    if (typeof window.showBookingModal === 'function')
      return { fn: window.showBookingModal, name: 'showBookingModal' };
    return null;
  }

  /** Minimal fallback dialog (only used if no native API exists) */
  function defineFallbackBookingOpen() {
    // Inject tiny scoped CSS for fallback ONLY
    if (!document.getElementById('bookingCompatCSS')) {
      const style = document.createElement('style');
      style.id = 'bookingCompatCSS';
      style.textContent = `
        .booking-compat-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);
          display:flex;align-items:center;justify-content:center;z-index:2000}
        .booking-compat-dialog{background:var(--color-surface,#fff);border-radius:12px;
          box-shadow:0 10px 30px rgba(0,0,0,.2);max-width:520px;width:92vw;
          padding:1rem 1.25rem;position:relative}
        .booking-compat-close{position:absolute;right:.5rem;top:.5rem;border:0;
          background:transparent;font-size:1.5rem;line-height:1;cursor:pointer}
        .booking-compat-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem}
      `;
      document.head.appendChild(style);
    }

    window.BookingModal = window.BookingModal || {};
    window.BookingModal.open = async function openBooking(ctx = {}) {
      const root = document.getElementById('booking-modal-root');
      if (!root) {
        console.warn('[booking:compat] #booking-modal-root missing');
        return;
      }
      const overlay = document.createElement('div');
      overlay.className = 'booking-compat-overlay';
      overlay.innerHTML = `
        <div class="booking-compat-dialog" role="dialog" aria-modal="true"
             aria-labelledby="bookingCompatTitle" tabindex="-1">
          <button class="booking-compat-close" aria-label="Close dialog">×</button>
          <h2 id="bookingCompatTitle">Book: ${ctx.service || 'Irrigation'}</h2>
          <p>We’ll confirm your ${ctx.service || 'service'} details shortly.</p>
          <div class="booking-compat-actions">
            <button class="btn btn-primary" id="bookingCompatConfirm">Confirm</button>
            <button class="btn btn-secondary" id="bookingCompatCancel">Cancel</button>
          </div>
        </div>`;
      root.appendChild(overlay);

      const dialog = overlay.querySelector('.booking-compat-dialog');
      const closeBtn = overlay.querySelector('.booking-compat-close');
      const btnConfirm = overlay.querySelector('#bookingCompatConfirm');
      const btnCancel = overlay.querySelector('#bookingCompatCancel');
      const lastFocused = document.activeElement;

      function focusables() {
        return [...overlay.querySelectorAll('button,[href],[tabindex]:not([tabindex="-1"])')];
      }
      function onKey(e) {
        if (e.key === 'Escape') return done();
        if (e.key !== 'Tab') return;
        const f = focusables(); if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? f.at(-1) : f[i - 1]) : (i === f.length - 1 ? f[0] : f[i + 1]);
        if (next) { e.preventDefault(); next.focus(); }
      }
      function done() {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        document.dispatchEvent(new CustomEvent('booking:close'));
        lastFocused && lastFocused.focus?.();
        resolver();
      }
      overlay.addEventListener('click', (e) => { if (e.target === overlay) done(); });
      closeBtn.addEventListener('click', done);
      btnCancel.addEventListener('click', done);
      btnConfirm.addEventListener('click', done);
      document.addEventListener('keydown', onKey);
      dialog.focus();

      let resolver;
      return new Promise(r => { resolver = r; });
    };

    window.__BOOKING_ADAPTER__ = { path: 'fallback' };
  }

  // ---- Init adapter: prefer native; fallback only if none found
  const native = resolveNativeBookingOpen();
  if (native) {
    window.BookingModal = window.BookingModal || {};
    window.BookingModal.open = async (ctx = {}) => native.fn.call(window, ctx);
    window.__BOOKING_ADAPTER__ = { path: 'native', api: native.name };
  } else {
    defineFallbackBookingOpen();
  }

  // Always route the event to the chosen opener
  document.addEventListener('booking:open', (e) => {
    if (window.BookingModal?.open) window.BookingModal.open(e.detail || {});
  });

  // Tiny notice for diagnostics
  try { console.info('[booking:adapter]', window.__BOOKING_ADAPTER__); } catch {}

  // ---- Checkout compat (no UI; only if site didn’t expose one) ----
  const app = (window.App = window.App || {}); app.checkout = app.checkout || {};
  if (typeof app.checkout.start !== 'function') {
    app.checkout.start = async function startCheckout({ sku, plan, source } = {}) {
      if (typeof window.getCheckoutUrl === 'function') {
        const id = sku || plan; return location.assign(window.getCheckoutUrl(id));
      }
      if (sku)  return location.assign(`${location.origin}/checkout/?sku=${encodeURIComponent(sku)}${source?`&source=${encodeURIComponent(source)}`:''}`);
      if (plan) return location.assign(`${location.origin}/subscribe/?plan=${encodeURIComponent(plan)}${source?`&source=${encodeURIComponent(source)}`:''}`);
    };
  }
})();