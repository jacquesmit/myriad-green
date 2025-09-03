// ✅ Global: Detect correct relative path from page location
const path = window.location.pathname;
const basePath = path.includes('/services-pages/') ? '../../'
               : path.includes('/services/') ? '../'
               : path.includes('/blog/posts/') ? '../../'
               : path.includes('/blog/') ? '../'
               : '';

// ✅ Inject testimonial section + slider logic after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const testimonialContainer = document.getElementById('testimonial-irrigation');

  if (testimonialContainer) {
    const filePath = `${basePath}partials/testimonial-irrigation.html`;
    console.log(`📦 Loading testimonials from: ${filePath}`);

    fetch(filePath)
      .then(res => res.ok ? res.text() : Promise.reject(res.status))
      .then(html => {
        testimonialContainer.innerHTML = html;

        // ✅ Once injected, find and init slider
        const slides = testimonialContainer.querySelectorAll('.testimonial-slide');
        const next = testimonialContainer.querySelector('.testimonial-next');
        const prev = testimonialContainer.querySelector('.testimonial-prev');
        let current = 0;

        function showSlide(index) {
          slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
          });
        }

        if (next && prev && slides.length > 0) {
          next.addEventListener('click', () => {
            current = (current + 1) % slides.length;
            showSlide(current);
          });

          prev.addEventListener('click', () => {
            current = (current - 1 + slides.length) % slides.length;
            showSlide(current);
          });

          // ✅ Optional autoplay
          setInterval(() => {
            current = (current + 1) % slides.length;
            showSlide(current);
          }, 10000);

          showSlide(current);
        } else {
          console.warn("⚠️ Testimonial slider elements not found.");
        }
      })
      .catch(err => console.error('❌ Failed to load testimonial section:', err));
  } else {
    console.warn("❌ No #testimonial-irrigation container found on this page.");
  }
});
