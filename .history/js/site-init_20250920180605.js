document.addEventListener('DOMContentLoaded', () => {
  // Inject both bars and only show toggle when both are loaded
  const path = window.location.pathname;
  // Generic basePath resolver: works for any folder depth (/, /a/, /a/b/, /a/b/file.html)
  function computeBasePath(p) {
    try {
      const clean = p.replace(/\/+$/, ''); // trim trailing slashes
      const parts = clean.split('/').filter(Boolean);
      // If last segment looks like a file (has a dot), don't count it as a folder
      let depth = parts.length;
      if (depth > 0 && /\./.test(parts[parts.length - 1])) {
        depth -= 1;
      }
      return depth <= 0 ? '' : '../'.repeat(depth);
    } catch (_) {
      return '';
    }
  }
  const basePath = computeBasePath(path);
  // Weather/H1 enhancements for suburb and service pages
  ensureWeatherEnhancements();

  function ensureWeatherEnhancements() {
    try {
      // 1) Inject weather CSS if not present
      const hasWeatherCss = !![...document.styleSheets].find(s => {
        try { return s.href && /\/css\/weather-widget\.css($|\?)/.test(s.href); } catch { return false; }
      }) || !!document.querySelector('link[rel="stylesheet"][href$="weather-widget.css"]');
      if (!hasWeatherCss) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${basePath}css/weather-widget.css`;
        document.head.appendChild(link);
      }

      // 2) Ensure hero elements are taggable for weather-driven copy
      let heroTitle = document.querySelector('[data-hero-title]');
      let heroIntro = document.querySelector('[data-hero-intro]');
      if (!heroTitle) {
        // Prefer first H1 within main or hero
        heroTitle = document.querySelector('main h1, .hero-irrigation h1, .hero h1') || document.querySelector('h1');
        if (heroTitle) heroTitle.setAttribute('data-hero-title', '');
      }
      if (!heroIntro && heroTitle) {
        // Next paragraph after H1
        const p = heroTitle.closest('section, header, main')?.querySelector('p');
        if (p) p.setAttribute('data-hero-intro', '');
      }

      // 3) Inject a weather widget container if missing (irrigation/service pages only)
      const isIrrigationPage = /irrigation/i.test(document.title) || /\birrigation\b/i.test(document.body.textContent || '');
      let widget = document.querySelector('#weather-widget');
      if (!widget && isIrrigationPage) {
        // Detect suburb from <title>, patterns like: "Irrigation Annlin, Pretoria | ..." or "Irrigation in Eldoraigne, Centurion"
        const t = document.title || '';
        let suburb = 'Johannesburg';
        const m1 = t.match(/Irrigation\s+([^,|]+),\s*([^|]+)/i); // Irrigation Annlin, Pretoria |
        const m2 = t.match(/Irrigation\s+in\s+([^,|]+),\s*([^|]+)/i); // Irrigation in Wierda Park, Centurion
        if (m2) suburb = m2[1].trim();
        else if (m1) suburb = m1[1].trim();

        widget = document.createElement('div');
        widget.id = 'weather-widget';
        widget.className = 'weather-widget';
        widget.setAttribute('data-suburb', suburb);
        widget.setAttribute('data-country', 'ZA');
        widget.setAttribute('data-units', 'metric');
        widget.setAttribute('data-theme', 'xbox');
        widget.setAttribute('data-tone', 'solid');
        widget.setAttribute('data-icon', '#ffffff');

        // Place after hero H1 if available, else at top of main
        if (heroTitle && heroTitle.parentElement) {
          heroTitle.parentElement.insertBefore(widget, heroTitle.nextSibling);
        } else {
          const main = document.querySelector('main') || document.body;
          main.insertBefore(widget, main.firstChild);
        }
      }

      // 4) Load weather widget script if not present
      const hasWeatherScript = !!document.querySelector('script[src$="/js/weather-widget.js"], script[src*="weather-widget.js?"]');
      if (!hasWeatherScript) {
        const s = document.createElement('script');
        s.src = `${basePath}js/weather-widget.js`;
        s.defer = true;
        document.body.appendChild(s);
      }
    } catch (e) {
      console.warn('Weather enhancement skipped:', e);
    }
  }

  let barsLoaded = 0;
  let barsFailed = false;
  function checkBarsReady() {
    if (barsLoaded === 2 && !barsFailed) {
      // Both bars loaded, show nav toggle if hidden
      const toggleBtn = document.getElementById('toggle-floating-bars');
      if (toggleBtn) toggleBtn.style.display = '';
    } else if (barsFailed) {
      // Hide toggle if bars failed
      const toggleBtn = document.getElementById('toggle-floating-bars');
      if (toggleBtn) toggleBtn.style.display = 'none';
    }
  }

  // Inject Contact Bar
  fetch(`${basePath}partials/floating-contact-bar.html`)
    .then(r => {
      if (!r.ok) throw new Error('Contact bar failed to load');
      return r.text();
    })
    .then(html => {
      const oldBar = document.getElementById('floating-contact-bar');
      if (oldBar) oldBar.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      barsLoaded++;
      checkBarsReady();
    })
    .catch(() => { barsFailed = true; checkBarsReady(); });

  // Inject Social Bar
  fetch(`${basePath}partials/social-bar.html`)
    .then(r => {
      if (!r.ok) throw new Error('Social bar failed to load');
      return r.text();
    })
    .then(html => {
      const container = document.getElementById('site-social-bar');
      if (container) container.innerHTML = html;
      barsLoaded++;
      checkBarsReady();
    })
    .catch(() => { barsFailed = true; checkBarsReady(); });

  // ✅ Theme Detection
  const initialTheme = getInitialTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  function getInitialTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ✅ Floating label behavior for selects
  document.querySelectorAll('.form-group select').forEach(select => {
    select.addEventListener('change', () => {
      select.classList.toggle('selected', !!select.value);
    });

    // Initialize on load if already selected
    if (select.value) {
      select.classList.add('selected');
    }
  });

  // ✅ Back to Top
  const backToTopBtn = document.querySelector('.scroll-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      backToTopBtn.classList.toggle('show', window.scrollY > 200);
    });
    backToTopBtn.addEventListener('click', e => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ✅ Inject NAV
  const navContainer = document.getElementById('site-nav');
  if (navContainer) {
    fetch(`${basePath}partials/nav.html`)
      .then(r => r.text())
      .then(html => {
        navContainer.innerHTML = html;
        
        // Fix absolute paths in nav to work with current basePath
        if (basePath) {
          // Fix image sources
          navContainer.querySelectorAll('img[src^="/"]').forEach(img => {
            img.src = basePath + img.getAttribute('src').substring(1);
          });
          
          // Fix anchor hrefs (but preserve external links and fragments)
          navContainer.querySelectorAll('a[href^="/"]').forEach(link => {
            const href = link.getAttribute('href');
            if (!href.startsWith('//') && !href.includes(':')) {
              link.href = basePath + href.substring(1);
            }
          });
        }
        
        // Move the floating contact button outside nav/header for global float
        let contactBtn = navContainer.querySelector('.fixed-contact-btn');
        if (contactBtn) {
          document.body.appendChild(contactBtn);
        }
        const toggleBtn = document.getElementById('theme-toggle');
        const icon = toggleBtn?.querySelector('i');
        toggleBtn?.addEventListener('click', () => switchTheme(toggleBtn, icon));

        function switchTheme(btn, icon) {
          const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', theme);
          localStorage.setItem('theme', theme);
          icon?.classList.toggle('fa-moon', theme === 'light');
          icon?.classList.toggle('fa-sun', theme === 'dark');
        }
      });
  }

  // ✅ Footer Injection
  const footerContainer = document.getElementById('site-footer');
  if (footerContainer) {
    fetch(`${basePath}partials/footer.html`)
      .then(r => r.text())
      .then(html => footerContainer.innerHTML = html);
  }

  // ✅ Social Bar Injection
  const socialBarContainer = document.getElementById('site-social-bar');
  if (socialBarContainer) {
    fetch(`${basePath}partials/social-bar.html`)
      .then(r => r.text())
      .then(html => socialBarContainer.innerHTML = html);
  }

  // ✅ Services Swiper
  const servicesSection = document.getElementById('services');
  if (servicesSection) {
    fetch(`${basePath}partials/services.html`)
      .then(r => r.text())
      .then(html => {
        servicesSection.innerHTML = html;
        new Swiper('.mySwiper', {
          slidesPerView: 1,
          spaceBetween: 20,
          loop: true,
          autoplay: { delay: 4000 },
          pagination: { el: '.swiper-pagination', clickable: true },
          navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev'
          },
          breakpoints: {
            768: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
            1280: { slidesPerView: 4 }
          }
        });
        // Ensure anchor scroll after injection
        if (window.location.hash === '#services') {
          setTimeout(function() {
            var el = document.getElementById('services');
            if (el) {
              var offset = 0;
              var top = el.getBoundingClientRect().top + window.pageYOffset - offset;
              window.scrollTo({ top: top, behavior: 'smooth' });
            }
          }, 100);
        }
      });
  }

  // ✅ Inject Booking Modal + Trigger Setup
  const modalContainer = document.getElementById('booking-modal-container');
  if (modalContainer) {
    fetch(`${basePath}booking-modal.html`)
      .then(r => r.text())
      .then(html => {
        modalContainer.innerHTML = html;

        const script = document.createElement('script');
        script.type = 'module';
        script.src = `${basePath}js/booking-modal.js`;

        script.onload = () => {
          import(`${basePath}js/booking-modal.js`)
            .then(mod => {
              setupBookingButtons(mod.initBookingModal);
            })
            .catch(() => {
              setupBookingButtons(); // fallback
            });
        };

        script.onerror = () => {
          setupBookingButtons();
        };

        document.head.appendChild(script);
      });
  }

  // ✅ Setup Booking Buttons
  function setupBookingButtons(initCallback) {
    document.body.addEventListener("click", e => {
      const btn = e.target.closest(".book-service-btn, .service-book-btn, .book-now-button");
      if (!btn) return;

      e.preventDefault();
      const modal = document.getElementById("booking-modal");
      if (!modal) return;

      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";

      const service = btn.getAttribute("data-service");

      if (initCallback) initCallback();

      setTimeout(() => {
        const serviceField = modal.querySelector("#service");
        if (serviceField && service) {
          const exists = [...serviceField.options].some(opt => opt.value === service);
          if (exists) serviceField.value = service;
        }
      }, 150);
    });

    // Modal close logic
    document.body.addEventListener("click", e => {
      if (e.target.closest("#close-modal") || e.target.id === "booking-modal") {
        const modal = document.getElementById("booking-modal");
        if (modal) {
          modal.classList.add("hidden");
          document.body.style.overflow = "auto";
        }
      }
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        const modal = document.getElementById("booking-modal");
        if (modal && !modal.classList.contains("hidden")) {
          modal.classList.add("hidden");
          document.body.style.overflow = "auto";
        }
      }
    });
  }

 
  // ✅ Contact Form Handler with Redirect to Thank You Page
const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const formStatus = document.getElementById("form-status");
    formStatus.innerText = "Sending...";
    formStatus.style.color = "var(--text-muted)";

    const formData = new FormData(contactForm);
    try {
      const response = await fetch(contactForm.action, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        formStatus.innerText = "✅ Thanks for your message! We'll be in touch shortly.";
        formStatus.style.color = "var(--green)";
        contactForm.reset();
      } else {
        formStatus.innerText = "❌ Error sending message. Please try again.";
        formStatus.style.color = "#e63946";
      }
    } catch (error) {
      formStatus.innerText = "❌ Network error. Please check your connection.";
      formStatus.style.color = "#e63946";
    }
  });
}


  // ✅ FAQ Accordion Logic
  initFAQAccordion();
  function initFAQAccordion() {
    const items = document.querySelectorAll('.faq-item');
    items.forEach(item => {
      const btn = item.querySelector('.faq-question');
      const answer = item.querySelector('.faq-answer');
      const icon = item.querySelector('.faq-toggle-icon');

      btn.addEventListener('click', () => {
        const open = item.classList.contains('open');
        items.forEach(i => {
          i.classList.remove('open');
          i.querySelector('.faq-answer').style.maxHeight = null;
          i.querySelector('.faq-toggle-icon').classList.remove('fa-minus');
          i.querySelector('.faq-toggle-icon').classList.add('fa-plus');
        });
        if (!open) {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
          icon.classList.remove('fa-plus');
          icon.classList.add('fa-minus');
        }
      });
    });
  }

  // Floating Bars Toggle Button Logic
  // Wait for nav and bars to be present
  const navInterval = setInterval(() => {
    const toggleBtn = document.getElementById('toggle-floating-bars');
    const icon = document.getElementById('toggle-bars-icon');
    const contactBar = document.querySelector('.floating-contact-bar');
    const socialBar = document.getElementById('site-social-bar');
    if (toggleBtn && icon && contactBar && socialBar) {
      clearInterval(navInterval);
      function setBarsVisible(visible) {
        contactBar.style.display = visible ? '' : 'none';
        socialBar.style.display = visible ? '' : 'none';
        icon.className = visible ? 'fas fa-comments' : 'fas fa-comment-slash';
        icon.style.color = visible ? '#4caf50' : '#aaa';
      }
      let barsVisible = true;
      setBarsVisible(barsVisible);
      toggleBtn.addEventListener('click', function () {
        barsVisible = !barsVisible;
        setBarsVisible(barsVisible);
      });
    }
  }, 200);
  // End floating bars toggle logic
});
