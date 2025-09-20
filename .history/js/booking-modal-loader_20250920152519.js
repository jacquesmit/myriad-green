document.addEventListener("DOMContentLoaded", () => {
  const modalContainer = document.getElementById("booking-modal-container");
  if (!modalContainer) {
    console.error("❌ Modal container not found!");
    return;
  }
  console.log("🔄 Loading booking modal...");
  fetch("/booking-modal.html")
    .then(res => res.text())
    .then(async html => {
      modalContainer.innerHTML = html;
      console.log("✅ Modal HTML loaded");
      // Dynamically import and initialize the advanced modal logic
      try {
        const module = await import("./booking-modal.js");
        if (module && typeof module.initBookingModal === "function") {
          module.initBookingModal();
          console.log("✅ Advanced booking modal initialized");
        } else {
          console.error("❌ initBookingModal not found in booking-modal.js");
        }
      } catch (err) {
        console.error("❌ Failed to load advanced booking modal:", err);
      }
      // Modal open/close logic
      const modal = document.getElementById('booking-modal');
      const closeBtn = document.getElementById('close-modal');
      // Event delegation for open-modal-btn
      document.addEventListener('click', (e) => {
        if (e.target.closest('.open-modal-btn') && modal) {
          modal.classList.remove('hidden');
          modal.setAttribute('aria-hidden', 'false');
        }
      });
      if (modal && closeBtn) {
        closeBtn.addEventListener('click', () => {
          modal.classList.add('hidden');
          modal.setAttribute('aria-hidden', 'true');
        });
      }
      // Optional: close modal on outside click
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
          }
        });
      }
      document.addEventListener('click', (e) => {
        const bookBtn = e.target.closest('.book-now-button');
        const modal = document.getElementById('booking-modal');
        if (bookBtn && modal) {
          // Find the service name from the card
          const card = bookBtn.closest('.service-card');
          let serviceTitle = card ? card.querySelector('.service-title')?.textContent.trim() : '';
          // Explicit mapping for known mismatches
          const serviceMap = {
            'Irrigation Leak Repair': 'Irrigation',
            'Drain Unblocking': 'Blocked Drainage',
            'Leak Detection': 'Leak Detection'
          };
          const mappedService = serviceMap[serviceTitle] || serviceTitle;
          // Open modal
          modal.classList.remove('hidden');
          modal.setAttribute('aria-hidden', 'false');
          // Autofill service field
          setTimeout(() => {
            const serviceField = document.getElementById('service');
            if (serviceField && mappedService) {
              for (let opt of serviceField.options) {
                if (opt.textContent.trim().toLowerCase() === mappedService.toLowerCase()) {
                  serviceField.value = opt.value;
                  serviceField.dispatchEvent(new Event('change', { bubbles: true }));
                  break;
                }
              }
            }
            serviceField && serviceField.focus();
          }, 100);
            // Update weather widget advice dynamically
            const widget = document.getElementById('weather-widget');
            if (widget) {
              widget.setAttribute('data-service', mappedService);
              if (typeof window.__SELECTED_SERVICE__ !== 'undefined') {
                window.__SELECTED_SERVICE__ = mappedService;
              } else {
                window.__SELECTED_SERVICE__ = mappedService;
              }
              // Re-initialize weather widget
              if (typeof window !== 'undefined' && typeof window.weatherWidgetInit === 'function') {
                window.weatherWidgetInit();
              } else {
                // fallback: reload the widget script (will call init)
                const oldScript = document.querySelector('script[src*="weather-widget.js"]');
                if (oldScript) {
                  const newScript = document.createElement('script');
                  newScript.src = oldScript.src + '?reload=' + Date.now();
                  newScript.defer = true;
                  oldScript.parentNode.replaceChild(newScript, oldScript);
                }
              }
            }
        }
      });
    })
    .catch(error => {
      console.error('❌ Error loading booking modal:', error);
    });
});