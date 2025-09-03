document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('purchaseUpdateText');
  if (!container) return;
  const updates = Array.from(container.querySelectorAll('span'));
  let current = 0;
  function showUpdate(idx) {
    updates.forEach((el, i) => {
      el.classList.toggle('active', i === idx);
    });
  }
  if (updates.length) {
    showUpdate(0);
    setInterval(() => {
      current = (current + 1) % updates.length;
      showUpdate(current);
    }, 3500);
  }
});
