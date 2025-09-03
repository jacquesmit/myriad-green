// 🌟 Dynamic DOM refs (allow late injection)
let cartModal = document.getElementById("cartModal");
let openBtn = document.getElementById("openCartBtn");
let closeBtn = document.getElementById("closeCartBtn");
let cartList = document.getElementById("cartItemsList");
let cartTotal = document.getElementById("cartTotal");
let badge = document.querySelector(".cart-badge");
let checkoutActions = document.querySelector('.checkout-actions');

function queryRefs() {
  cartModal = document.getElementById("cartModal");
  openBtn = document.getElementById("openCartBtn");
  closeBtn = document.getElementById("closeCartBtn");
  cartList = document.getElementById("cartItemsList");
  cartTotal = document.getElementById("cartTotal");
  badge = document.querySelector(".cart-badge");
  checkoutActions = document.querySelector('.checkout-actions');
}

function ensureCartScaffold() {
  // Inject floating button if missing
  if (!document.getElementById('openCartBtn')) {
    const btn = document.createElement('button');
    btn.id = 'openCartBtn';
    btn.className = 'floating-cart-btn';
    btn.setAttribute('aria-label', 'View cart');
    btn.innerHTML = '<i class="fas fa-shopping-cart"></i><span class="cart-badge" id="cartCount">0</span>';
    btn.addEventListener('click', () => {
      const cart = JSON.parse(localStorage.getItem('cart')) || [];
      if (cart.length === 0) {
        // Show a friendly message with a link to shop
        const msg = document.createElement('div');
        msg.style.position = 'fixed';
        msg.style.top = '50%';
        msg.style.left = '50%';
        msg.style.transform = 'translate(-50%, -50%)';
        msg.style.background = '#fff';
        msg.style.color = '#222';
        msg.style.padding = '2em 2.5em';
        msg.style.borderRadius = '12px';
        msg.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';
        msg.style.zIndex = '10001';
        msg.style.textAlign = 'center';
        msg.innerHTML = `
          <h3>Your cart is empty</h3>
          <p>Please add a product to your cart.<br>
          Or <a href='/shop/' style='color:#2563eb;text-decoration:underline;'>visit our shop</a> if you need more products.</p>
          <button style='margin-top:1.5em;padding:0.7em 2em;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;' id='closeCartMsgBtn'>Close</button>
        `;
        document.body.appendChild(msg);
        document.getElementById('closeCartMsgBtn').onclick = () => {
          msg.remove();
        };
        return;
      }
      cartModal.classList.remove('hidden');
      renderCart();
    });
    document.body.appendChild(btn);
  }
  // Inject modal if missing
  if (!document.getElementById('cartModal')) {
    const wrapper = document.createElement('div');
    wrapper.id = 'cartModal';
    wrapper.className = 'cart-modal hidden';
    wrapper.innerHTML = `
      <div class="cart-modal-content">
        <button id="closeCartBtn" class="close-btn" aria-label="Close cart">&times;</button>
        <h2>Your Cart</h2>
        <ul id="cartItemsList" class="cart-items-list"></ul>
        <p class="total">Total: R<span id="cartTotal">0.00</span></p>
        <div class="checkout-actions"></div>
      </div>`;
    document.body.appendChild(wrapper);
  }
  queryRefs();

  // Add click-to-close for modal overlay
  if (cartModal) {
    cartModal.addEventListener('mousedown', function(e) {
      // Only close if clicking the overlay, not the modal content or its children
      if (e.target === cartModal) {
        cartModal.classList.add('hidden');
      }
    });
  }
}

// Optional inline button
const inlineCartBtn = document.getElementById('inlineCartBtn');
if (inlineCartBtn) {
  inlineCartBtn.addEventListener('click', () => {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
      // Show a friendly message with a link to shop
      const msg = document.createElement('div');
      msg.style.position = 'fixed';
      msg.style.top = '50%';
      msg.style.left = '50%';
      msg.style.transform = 'translate(-50%, -50%)';
      msg.style.background = '#fff';
      msg.style.color = '#222';
      msg.style.padding = '2em 2.5em';
      msg.style.borderRadius = '12px';
      msg.style.boxShadow = '0 8px 32px rgba(0,0,0,0.18)';
      msg.style.zIndex = '10001';
      msg.style.textAlign = 'center';
      msg.innerHTML = `
        <h3>Your cart is empty</h3>
        <p>Please add a product to your cart.<br>
        Or <a href='/shop/' style='color:#2563eb;text-decoration:underline;'>visit our shop</a> if you need more products.</p>
        <button style='margin-top:1.5em;padding:0.7em 2em;background:#2563eb;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;' id='closeCartMsgBtn'>Close</button>
      `;
      document.body.appendChild(msg);
      document.getElementById('closeCartMsgBtn').onclick = () => {
        msg.remove();
      };
      return;
    }
    cartModal.classList.remove('hidden');
    renderCart();
  });
}

// 🔄 Render cart
function renderCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  // Render list
  if (cartList) {
    cartList.innerHTML = "";
    cart.forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = `
        ${item.name} (x${item.quantity})
        <div>
          <button onclick="updateQuantity('${item.id}', -1)">➖</button>
          <button onclick="updateQuantity('${item.id}', 1)">➕</button>
          <button class="remove-item" onclick="removeItem('${item.id}')">🗑️</button>
        </div>
      `;
      cartList.appendChild(li);
    });
  }

  // Render total
  if (cartTotal) {
    const total = cart.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    cartTotal.textContent = total.toFixed(2);
  }

  // Render actions (Proceed to Checkout / Empty cart)
  if (checkoutActions) {
    checkoutActions.innerHTML = '';

    const hasItems = cart.length > 0;

    const goBtn = document.createElement('a');
    goBtn.href = hasItems ? '/checkout.html' : '#';
    goBtn.className = 'cart-checkout-btn';
    goBtn.textContent = 'Proceed to Checkout';
    if (!hasItems) {
      goBtn.setAttribute('aria-disabled', 'true');
      goBtn.style.pointerEvents = 'none';
      goBtn.style.opacity = '0.5';
      goBtn.addEventListener('click', (e) => {
        e.preventDefault();
        alert('You cannot proceed to checkout with an empty cart.');
      });
    }
    checkoutActions.appendChild(goBtn);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'cart-empty-btn';
    clearBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="vertical-align:middle;">
        <path d="M7 10V7a5 5 0 0110 0v3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="3" y="10" width="18" height="11" rx="2" fill="#ff4d4f" stroke="#fff" stroke-width="2"/>
      </svg>
      Empty Cart
    `;
    clearBtn.disabled = !hasItems;
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem('cart');
      renderCart();
      renderBadge();
      if (cartModal) {
        cartModal.classList.add('hidden');
      }
    });
    checkoutActions.appendChild(clearBtn);
  }

  renderBadge();
}

// 🛒 Add to cart logic — 🔥 image injected
function addToCart(product) {
  let cart = JSON.parse(localStorage.getItem('cart')) || [];
  const existing = cart.find(item => item.id === product.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push(product);
  }

  localStorage.setItem('cart', JSON.stringify(cart));
  renderCart();
  // Auto-open the cart to confirm the add
  if (cartModal) {
    cartModal.classList.remove('hidden');
  }
}

// ➕➖ Quantity logic
function updateQuantity(id, delta) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const item = cart.find(p => p.id === id);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(p => p.id !== id);
    }
  }
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}

// ❌ Remove item
function removeItem(id) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart = cart.filter(item => item.id !== id);
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}

// 🔢 Badge
function renderBadge() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) badge.textContent = count;
  // Hide or show floating cart button
  if (openBtn) {
    if (count > 0) {
      openBtn.style.display = '';
    } else {
      openBtn.style.display = 'none';
    }
  }
}

// 🟩 Add-to-cart: delegate to catch dynamic content as well
document.addEventListener('click', (evt) => {
  const btn = evt.target.closest('.add-to-cart-btn');
  if (!btn) return;
  const productCard = btn.closest('.product-card');
  const rawSrc = productCard?.querySelector('img')?.getAttribute('src') || 'images/placeholder.png';
  const image = rawSrc.replace(/^\//, '');
  const description = productCard?.querySelector('.description')?.textContent?.trim() || '';
  const product = {
    id: btn.dataset.id,
    name: btn.dataset.name,
    price: parseFloat(btn.dataset.price),
    quantity: 1,
    image,
    description,
  };
  addToCart(product);
});

// 🛍️ Buy Now: add single item then go straight to checkout
document.addEventListener('click', (evt) => {
  const buy = evt.target.closest('.buy-now-btn');
  if (!buy) return;
  const card = buy.closest('.product-card');
  const rawSrc = card?.querySelector('img')?.getAttribute('src') || 'images/placeholder.png';
  const image = rawSrc.replace(/^\//, '');
  const description = card?.querySelector('.description')?.textContent?.trim() || '';
  const item = {
    id: buy.dataset.id,
    name: buy.dataset.name,
    price: parseFloat(buy.dataset.price),
    quantity: 1,
    image,
    description,
  };
  // Replace cart with just this item for a true “buy now” feel
  localStorage.setItem('cart', JSON.stringify([item]));
  renderBadge();
  window.location.href = '/checkout.html';
});


// 🔄 Open/close modal
// Empty cart logic for floating button
const emptyCartBtn = document.getElementById('emptyCartBtn');
if (emptyCartBtn) {
  emptyCartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.removeItem('cart');
    renderCart();
    renderBadge();
  });
}

function bindShellEvents() {
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      cartModal?.classList.toggle('hidden');
      renderCart();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      cartModal?.classList.add('hidden');
    });
  }
  if (cartModal) {
    cartModal.addEventListener('click', (e) => {
      if (e.target === cartModal) {
        cartModal.classList.add('hidden');
      }
    });
  }
}

// On page load, hide cart button if cart is empty
document.addEventListener('DOMContentLoaded', () => {
  // Ensure modal + button exist everywhere
  ensureCartScaffold();
  bindShellEvents();
  renderBadge();
  renderCart();
});
