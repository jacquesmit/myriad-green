document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('.how-it-works');
  const cards = section.querySelectorAll('.step-card');
  const line = section.querySelector('.animated-progress-line');

  if (!section || cards.length === 0 || !line) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // ✅ Start animated line
        line.classList.add('animate');

        // ✅ Stagger card reveal (600ms apart)
        cards.forEach((card, index) => {
          setTimeout(() => card.classList.add('reveal'), 700 + index * 600);
        });

        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, {
    threshold: 0.4
  });

  observer.observe(section);
});
