/*==============================
  PROFESSIONAL CART MODAL
  Production-Ready JavaScript
==============================*/

/**
 * Cart Modal Manager
 * Handles shopping cart functionality with local storage persistence
 */

// DOM Element References
let cartModal = null;
let openBtn = null;
let closeBtn = null;
let cartList = null;
let cartTotal = null;
let badge = null;
let checkoutActions = null;

/**
 * Query and cache DOM element references
 */
function queryRefs() {
  cartModal = document.getElementById("cartModal");
  openBtn = document.getElementById("openCartBtn");
  closeBtn = document.getElementById("closeCartBtn");
  cartList = document.getElementById("cartItemsList");
  cartTotal = document.getElementById("cartTotal");
  badge = document.querySelector(".cart-badge");
  checkoutActions = document.querySelector('.checkout-actions');
}

/**
 * Ensure cart scaffold exists in DOM
 * Creates floating cart button and modal if not present
 */
function ensureCartScaffold() {
  // Inject floating button if missing
  if (!document.getElementById('openCartBtn')) {
    const btn = document.createElement('button');
    btn.id = 'openCartBtn';
    btn.className = 'floating-cart-btn';
    btn.setAttribute('aria-label', 'View shopping cart');
    btn.innerHTML = `
      <i class="fas fa-shopping-cart" aria-hidden="true"></i>
      <span class="cart-badge" id="cartCount">0</span>
    `;
    btn.addEventListener('click', openCartModal);
    document.body.appendChild(btn);
  }
  
  // Inject modal if missing
  if (!document.getElementById('cartModal')) {
    const modal = document.createElement('div');
    modal.id = 'cartModal';
    modal.className = 'cart-modal hidden';
    modal.innerHTML = `
      <div class="cart-modal-content" role="dialog" aria-modal="true" aria-labelledby="cart-modal-title">
        <button id="closeCartBtn" class="close-btn" aria-label="Close cart modal">&times;</button>
        <h2 id="cart-modal-title"><i class="fas fa-shopping-cart"></i>Your Cart</h2>
        <ul id="cartItemsList" class="cart-items-list" role="list"></ul>
        <p class="total" role="status">
          <span>Total:</span>
          <span>R <span id="cartTotal">0.00</span></span>
        </p>
        <div class="checkout-actions"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  queryRefs();

  // Close modal when clicking overlay
  if (cartModal) {
    cartModal.addEventListener('mousedown', (e) => {
      if (e.target === cartModal) {
        closeCartModal();
      }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !cartModal.classList.contains('hidden')) {
        closeCartModal();
      }
    });
  }
}

/**
 * Get cart from local storage
 * @returns {Array} Cart items array
 */
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch (e) {
    console.error('Error parsing cart from localStorage:', e);
    return [];
  }
}

/**
 * Save cart to local storage
 * @param {Array} cart - Cart items array
 */
function saveCart(cart) {
  try {
    localStorage.setItem('cart', JSON.stringify(cart));
  } catch (e) {
    console.error('Error saving cart to localStorage:', e);
  }
}

/**
 * Open cart modal
 */
function openCartModal() {
  const cart = getCart();
  
  if (cart.length === 0) {
    showEmptyCartMessage();
    return;
  }
  
  if (cartModal) {
    cartModal.classList.remove('hidden');
    renderCart();
    // Lock body scroll
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close cart modal
 */
function closeCartModal() {
  if (cartModal) {
    cartModal.classList.add('hidden');
    // Restore body scroll
    document.body.style.overflow = '';
  }
}

/**
 * Show empty cart message
 */
function showEmptyCartMessage() {
  const existingMsg = document.getElementById('empty-cart-message');
  if (existingMsg) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'empty-cart-message';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(26, 54, 93, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    padding: 1rem;
  `;
  
  const message = document.createElement('div');
  message.style.cssText = `
    background: var(--cart-modal-bg, #ffffff);
    color: var(--cart-text-primary, #1a365d);
    padding: 2.5rem 2rem;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    text-align: center;
    max-width: 440px;
    width: 100%;
  `;
  
  message.innerHTML = `
    <div class="cart-empty-state">
      <i class="fas fa-shopping-cart" aria-hidden="true"></i>
      <h3>Your Cart is Empty</h3>
      <p>Start shopping to add items to your cart.</p>
      <a href="/shop/" class="btn-primary">
        <i class="fas fa-store" aria-hidden="true"></i>
        Browse Products
      </a>
    </div>
  `;
  
  overlay.appendChild(message);
  document.body.appendChild(overlay);
  
  // Close on click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  // Close on Escape
  const closeOnEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', closeOnEscape);
    }
  };
  document.addEventListener('keydown', closeOnEscape);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  }, 3000);
}

/**
 * Render cart items and total
 */
function renderCart() {
  const cart = getCart();

  // Render cart items
  if (cartList) {
    cartList.innerHTML = '';
    
    if (cart.length === 0) {
      cartList.innerHTML = `
        <li class="cart-empty-state">
          <i class="fas fa-shopping-cart" aria-hidden="true"></i>
          <h3>Your cart is empty</h3>
          <p>Add some products to get started!</p>
        </li>
      `;
    } else {
      cart.forEach(item => {
        const li = document.createElement('li');
        li.setAttribute('role', 'listitem');
        li.innerHTML = `
          ${item.image ? `<img src="/${item.image}" alt="${escapeHtml(item.name)}" loading="lazy">` : ''}
          <div class="item-details">
            <h4 class="item-title">${escapeHtml(item.name)}</h4>
            ${item.description ? `<p class="item-desc">${escapeHtml(item.description)}</p>` : ''}
            <p class="item-qty">Quantity: ${item.quantity}</p>
          </div>
          <p class="item-price">R ${(item.price * item.quantity).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div class="cart-item-actions">
            <button type="button" 
                    onclick="updateQuantity('${item.id}', -1)" 
                    aria-label="Decrease quantity" 
                    title="Decrease quantity">
              <i class="fas fa-minus"></i>
            </button>
            <button type="button" 
                    onclick="updateQuantity('${item.id}', 1)" 
                    aria-label="Increase quantity" 
                    title="Increase quantity">
              <i class="fas fa-plus"></i>
            </button>
            <button type="button" 
                    class="remove-item" 
                    onclick="removeItem('${item.id}')" 
                    aria-label="Remove item" 
                    title="Remove item">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        `;
        cartList.appendChild(li);
      });
    }
  }

  // Render total
  if (cartTotal) {
    const total = cart.reduce((sum, item) => {
      return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
    }, 0);
    cartTotal.textContent = total.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Render action buttons
  renderCheckoutActions(cart);
  
  // Update badge
  renderBadge();
}

/**
 * Render checkout action buttons
 * @param {Array} cart - Cart items array
 */
function renderCheckoutActions(cart) {
  if (!checkoutActions) return;
  
  checkoutActions.innerHTML = '';
  const hasItems = cart.length > 0;

  // Checkout button
  const checkoutBtn = document.createElement('a');
  checkoutBtn.href = hasItems ? '/checkout.html' : '#';
  checkoutBtn.className = 'cart-checkout-btn';
  checkoutBtn.innerHTML = `
    <i class="fas fa-credit-card" aria-hidden="true"></i>
    Proceed to Checkout
  `;
  
  if (!hasItems) {
    checkoutBtn.setAttribute('aria-disabled', 'true');
    checkoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
    });
  }
  
  checkoutActions.appendChild(checkoutBtn);

  // Empty cart button
  const emptyBtn = document.createElement('button');
  emptyBtn.type = 'button';
  emptyBtn.className = 'cart-empty-btn';
  emptyBtn.disabled = !hasItems;
  emptyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Clear Cart
  `;
  
  emptyBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to empty your cart?')) {
      emptyCart();
    }
  });
  
  checkoutActions.appendChild(emptyBtn);
}

/**
 * Add product to cart
 * @param {Object} product - Product object with id, name, price, etc.
 */
function addToCart(product) {
  if (!product || !product.id) {
    console.error('Invalid product:', product);
    return;
  }
  
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      ...product,
      quantity: product.quantity || 1
    });
  }

  saveCart(cart);
  renderCart();
  
  // Auto-open cart to confirm addition
  if (cartModal) {
    openCartModal();
  }
}

/**
 * Update item quantity in cart
 * @param {string} id - Product ID
 * @param {number} delta - Change amount (+1 or -1)
 */
function updateQuantity(id, delta) {
  const cart = getCart();
  const item = cart.find(p => p.id === id);
  
  if (item) {
    item.quantity = (item.quantity || 1) + delta;
    
    if (item.quantity <= 0) {
      // Remove item if quantity reaches 0
      const filteredCart = cart.filter(p => p.id !== id);
      saveCart(filteredCart);
    } else {
      saveCart(cart);
    }
  }
  
  renderCart();
}

/**
 * Remove item from cart
 * @param {string} id - Product ID
 */
function removeItem(id) {
  const cart = getCart();
  const filteredCart = cart.filter(item => item.id !== id);
  saveCart(filteredCart);
  renderCart();
}

/**
 * Empty entire cart
 */
function emptyCart() {
  localStorage.removeItem('cart');
  renderCart();
  closeCartModal();
}

/**
 * Update cart badge with item count
 */
function renderBadge() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  if (badge) {
    badge.textContent = count;
  }
  
  // Show/hide floating button based on cart contents
  if (openBtn) {
    openBtn.style.display = count > 0 ? 'flex' : 'none';
  }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Handle "Add to Cart" button clicks (delegated event)
 */
document.addEventListener('click', (evt) => {
  const btn = evt.target.closest('.add-to-cart-btn');
  if (!btn) return;
  
  evt.preventDefault();
  
  const productCard = btn.closest('.product-card');
  const imgElement = btn.dataset.image || productCard?.querySelector('img')?.getAttribute('src') || '/images/placeholder.png';
  const image = imgElement.replace(/^\/+/, '');
  const description = btn.dataset.description || productCard?.querySelector('.description')?.textContent?.trim() || '';
  
  const product = {
    id: btn.dataset.sku || btn.dataset.id || `product-${Date.now()}`,
    name: btn.dataset.name || 'Unknown Product',
    price: parseFloat(btn.dataset.price) || 0,
    quantity: 1,
    image,
    description,
    sku: btn.dataset.sku || ''
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


/**
 * Handle inline cart button clicks (optional)
 */
const inlineCartBtn = document.getElementById('inlineCartBtn');
if (inlineCartBtn) {
  inlineCartBtn.addEventListener('click', openCartModal);
}

/**
 * Bind modal event listeners
 */
function bindShellEvents() {
  if (openBtn) {
    openBtn.addEventListener('click', openCartModal);
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeCartModal);
  }
}

/**
 * Initialize cart modal on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  // Ensure cart scaffold exists
  ensureCartScaffold();
  
  // Bind event listeners
  bindShellEvents();
  
  // Initial render
  renderBadge();
  renderCart();
});

/**
 * Expose functions to global scope for onclick handlers
 * (Required for dynamically generated buttons)
 */
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeItem = removeItem;
window.emptyCart = emptyCart;
