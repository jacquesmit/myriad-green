// services-swiper.js

// Wait for DOM
document.addEventListener('DOMContentLoaded', function() {
  const swiper = new Swiper('.services-swiper', {
    loop: true,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false,
    },
    slidesPerView: 4,
    spaceBetween: 8,
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
    breakpoints: {
      320: { slidesPerView: 1 },
      768: { slidesPerView: 2 },
      1024: { slidesPerView: 3 },
    },
  });

  // pause on hover
  const container = document.querySelector('.services-swiper');
  container.addEventListener('mouseenter', () => swiper.autoplay.stop());
  container.addEventListener('mouseleave', () => swiper.autoplay.start());
});

