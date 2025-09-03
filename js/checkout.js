document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("checkoutCartList");
  const totalEl = document.getElementById("checkoutCartTotal");
  const submitBtn = document.getElementById("submitOrderBtn");

  function renderCheckout() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    list.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
      const li = document.createElement("li");
      li.classList.add("checkout-item");

  // Use provided item.image or a tiny transparent PNG data URI to avoid 404s
  const productImage = (item.image || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=')
        .replace(/^\//, '')
        .replace(/ /g, '%20');

      li.innerHTML = `
        <img src="${productImage}" alt="${item.name}" class="checkout-item-img" />
        <article class="checkout-item-details">
          <h3 class="item-name">${item.name}</h3>
          <p class="item-desc">${item.description || "No description available."}</p>
          <p class="item-qty">Quantity: ${item.quantity}</p>
          <p class="item-price">Price: R${(item.price * item.quantity).toFixed(2)}</p>
          <button class="remove-from-checkout" data-index="${index}">Remove</button>
        </article>
      `;
      list.appendChild(li);
      total += item.price * item.quantity;
    });

    totalEl.textContent = total.toFixed(2);

    document.querySelectorAll(".remove-from-checkout").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        const cart = JSON.parse(localStorage.getItem("cart")) || [];
        cart.splice(idx, 1);
        localStorage.setItem("cart", JSON.stringify(cart));
        renderCheckout(); // re-render
      });
    });
  }

  renderCheckout();

  const checkoutForm = document.getElementById("checkoutForm");
  // Auto-detect API base: if on localhost and not port 3000, point to http://localhost:3000
  const detectApiBase = () => {
    const el = document.querySelector('[data-api-base]');
    const explicit = el?.getAttribute('data-api-base');
    if (explicit) return explicit.replace(/\/$/, '');
    const host = window.location.hostname;
    const port = window.location.port;
    const isLocal = (host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host));
    if (isLocal && port !== '3000') {
      return 'http://localhost:3000';
    }
    return '';
  };
  const API_BASE = detectApiBase();
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      const name = document.getElementById("clientName").value.trim();
      const email = document.getElementById("clientEmail").value.trim();
      const phone = document.getElementById("clientPhone").value.trim();
      const address = document.getElementById("clientAddress").value.trim();
      if (!name || !email || !phone) {
        alert("Name, email, and phone are required.");
        return;
      }
      try {
        // Save client data to backend (Firestore)

  await fetch(`${API_BASE}/save-client-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, address, cart }),
        });

        localStorage.setItem("lastOrderClient", JSON.stringify({ name, email, phone, address }));

        // Proceed to Stripe Checkout
  const response = await fetch(`${API_BASE}/create-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cart,
            customerName: name,
            customerPhone: phone,
            customerEmail: email,
            customerAddress: address,
          }),
        });

        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;  // ✅ This must redirect to Stripe
        } else {
          alert("Something went wrong while initiating checkout.");
        }
      } catch (err) {
        console.error("Checkout error:", err);
        alert("Checkout failed. Please try again.");
      }
    });
  }
});
