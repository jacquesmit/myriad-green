const scrollBtn = document.querySelector('.scroll-to-top');

window.addEventListener('scroll', () => {
  if (window.scrollY > 300) {
    scrollBtn.classList.add('visible');
  } else {
    scrollBtn.classList.remove('visible');
  }
});

scrollBtn.addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

// Mobile Menu Toggle
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('show');      // Show/hide menu
  hamburger.classList.toggle('open');       // Animate into "X"
});

// Toggle dropdown menu on click (mobile-friendly)
document.querySelectorAll('.main-menu > li > a').forEach(link => {
  link.addEventListener('click', (e) => {
    const dropdown = link.nextElementSibling;

    // If there's a dropdown, toggle it
    if (dropdown && dropdown.classList.contains('main-menu-dropdown')) {
      e.preventDefault(); // Prevent navigation
      
      // Close other open dropdowns
      document.querySelectorAll('.main-menu-dropdown.show').forEach(open => {
        if (open !== dropdown) open.classList.remove('show');
      });

      // Toggle current dropdown
      dropdown.classList.toggle('show');
    }
  });
});
// Close dropdowns when clicking outside

document.addEventListener('click', (event) => {
  const dropdown = document.querySelector('.main-menu-dropdown');
  const navItem = document.querySelector('.main-menu > li');

  if (!navItem.contains(event.target)) {
    dropdown.classList.remove('show');
  }
});

const heroexlamation = document.querySelector('.gold-span');

heroexlamation.animate(
  [
    { transform: 'translateY(0)', opacity: 0 },
    { transform: 'translateY(-20px)', opacity: 1 },
    { transform: 'translateY(0)', opacity: 0 }
  ],
  {
    duration: 5000,
    iterations: Infinity
  }
);


const followBar = document.querySelector('.floating-follow-bar');
const footer = document.querySelector('footer');

window.addEventListener('scroll', () => {
  const footerTop = footer.getBoundingClientRect().top;
  const windowHeight = window.innerHeight;

  if (footerTop <= windowHeight) {
    followBar.style.display = 'none';
  } else {
    followBar.style.display = 'block';
  }
});

// FAQ Expansion Animation & Caret Toggle
const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach(item => {
  const questionBtn = item.querySelector('.faq-question');
  const answer = item.querySelector('.faq-answer');
  const caret = item.querySelector('.faq-toggle-icon');

  questionBtn.addEventListener('click', () => {
    // Toggle answer visibility with smooth animation
    if (answer.style.maxHeight) {
      answer.style.maxHeight = null;
      answer.style.opacity = 0;
      caret.classList.remove('open');
    } else {
      answer.style.maxHeight = answer.scrollHeight + 'px';
      answer.style.opacity = 1;
      caret.classList.add('open');
    }
  });
});




