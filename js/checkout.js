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
  
  // Initialize security measures
  initializeSecurity();
  
  // Initialize analytics
  initializeAnalytics();

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
      const agreeTcs = document.getElementById("agreeTcs").checked;
      
      // Clear previous error messages
      clearErrorMessages();
      
      // Sanitize inputs
      const sanitizedData = {
        name: sanitizeInput(name),
        email: sanitizeInput(email),
        phone: sanitizeInput(phone),
        address: sanitizeInput(address)
      };
      
      // Comprehensive validation
      const errors = validateForm(sanitizedData.name, sanitizedData.email, sanitizedData.phone, sanitizedData.address, agreeTcs, cart);
      
      if (errors.length > 0) {
        displayErrors(errors);
        return;
      }
      
      // Show loading state
      setLoadingState(true);
      clearErrorMessages();
      
      // Track checkout attempt
      trackEvent('checkout_attempt', {
        cart_value: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        cart_items: cart.length,
        customer_type: email.includes('@') ? 'returning' : 'new'
      });
      
      try {
        // Save client data to backend (Firestore)

  await fetch(`${API_BASE}/save-client-data`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-CSRF-Token": getCsrfToken(),
            "X-Session-ID": getSessionId()
          },
          body: JSON.stringify({ 
            name: sanitizedData.name, 
            email: sanitizedData.email, 
            phone: sanitizedData.phone, 
            address: sanitizedData.address, 
            cart: sanitizeCart(cart)
          }),
        });

        localStorage.setItem("lastOrderClient", JSON.stringify({ name, email, phone, address }));

        // Proceed to Stripe Checkout
  const response = await fetch(`${API_BASE}/create-checkout-session`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-CSRF-Token": getCsrfToken(),
            "X-Session-ID": getSessionId()
          },
          body: JSON.stringify({
            cart: sanitizeCart(cart),
            customerName: sanitizedData.name,
            customerPhone: sanitizedData.phone,
            customerEmail: sanitizedData.email,
            customerAddress: sanitizedData.address,
          }),
        });

        const data = await response.json();
        if (data.url) {
          // Track successful checkout initiation
          trackEvent('checkout_success', {
            cart_value: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            cart_items: cart.length,
            payment_method: 'stripe'
          });
          
          showSuccess("Redirecting to secure payment...");
          setTimeout(() => {
            window.location.href = data.url;  // ✅ This must redirect to Stripe
          }, 1000);
        } else {
          throw new Error("No checkout URL received from server");
        }
      } catch (err) {
        console.error("Checkout error:", err);
        
        // Track checkout failure
        trackEvent('checkout_error', {
          error_message: err.message || 'Unknown error',
          cart_value: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          cart_items: cart.length
        });
        
        setLoadingState(false);
        displayErrors([
          "Checkout failed. Please check your connection and try again.",
          err.message || "An unexpected error occurred."
        ]);
      }
    });
  }

  // Enhanced validation functions
  function validateForm(name, email, phone, address, agreeTcs, cart) {
    const errors = [];
    
    // Cart validation
    if (!cart || cart.length === 0) {
      errors.push("Your cart is empty. Please add items before checkout.");
    }
    
    // Name validation
    if (!name) {
      errors.push("Full name is required.");
    } else if (name.length < 2) {
      errors.push("Full name must be at least 2 characters.");
    } else if (!/^[a-zA-Z\s''-]+$/.test(name)) {
      errors.push("Full name can only contain letters, spaces, apostrophes, and hyphens.");
    }
    
    // Email validation
    if (!email) {
      errors.push("Email address is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Please enter a valid email address.");
    }
    
    // Phone validation
    if (!phone) {
      errors.push("Phone number is required.");
    } else if (!/^[\d\s\-\+\(\)]{10,15}$/.test(phone.replace(/\s/g, ''))) {
      errors.push("Please enter a valid phone number (10-15 digits).");
    }
    
    // Address validation
    if (!address) {
      errors.push("Address is required for delivery/service.");
    } else if (address.length < 10) {
      errors.push("Please provide a more complete address.");
    }
    
    // Terms and conditions validation
    if (!agreeTcs) {
      errors.push("You must agree to the Terms & Conditions to proceed.");
    }
    
    return errors;
  }
  
  function displayErrors(errors) {
    const errorContainer = document.getElementById('error-container') || createErrorContainer();
    errorContainer.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <strong>Please fix the following errors:</strong>
        <ul>
          ${errors.map(error => `<li>${error}</li>`).join('')}
        </ul>
      </div>
    `;
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  function clearErrorMessages() {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
      errorContainer.innerHTML = '';
    }
  }
  
  function createErrorContainer() {
    const container = document.createElement('div');
    container.id = 'error-container';
    container.className = 'error-container';
    
    const form = document.getElementById('checkoutForm');
    form.insertBefore(container, form.firstChild);
    
    return container;
  }
  
  function setLoadingState(isLoading) {
    const submitBtn = document.getElementById('submitOrderBtn');
    const form = document.getElementById('checkoutForm');
    
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        Processing Order...
      `;
      submitBtn.classList.add('loading');
      form.classList.add('submitting');
    } else {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit Order';
      submitBtn.classList.remove('loading');
      form.classList.remove('submitting');
    }
  }
  
  function showSuccess(message) {
    const successContainer = document.getElementById('success-container') || createSuccessContainer();
    successContainer.innerHTML = `
      <div class="success-message">
        <i class="fas fa-check-circle"></i>
        <strong>${message}</strong>
      </div>
    `;
  }
  
  function createSuccessContainer() {
    const container = document.createElement('div');
    container.id = 'success-container';
    container.className = 'success-container';
    
    const form = document.getElementById('checkoutForm');
    form.insertBefore(container, form.firstChild);
    
    return container;
  }
  
  // Security Functions
  function initializeSecurity() {
    // Generate session ID
    const sessionId = generateSessionId();
    document.getElementById('sessionId').value = sessionId;
    
    // In a real application, CSRF token would come from server
    // For now, generate a client-side token (server should validate)
    const csrfToken = generateCsrfToken();
    document.getElementById('csrfToken').value = csrfToken;
    
    // Add rate limiting
    setupRateLimiting();
  }
  
  function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>'"]/g, (char) => { // Escape HTML chars
        const htmlEntities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return htmlEntities[char] || char;
      });
  }
  
  function sanitizeCart(cart) {
    return cart.map(item => ({
      name: sanitizeInput(item.name || ''),
      description: sanitizeInput(item.description || ''),
      price: parseFloat(item.price) || 0,
      quantity: parseInt(item.quantity) || 1,
      image: sanitizeInput(item.image || '')
    }));
  }
  
  function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
  }
  
  function generateCsrfToken() {
    return 'csrf_' + Math.random().toString(36).substr(2, 32) + Date.now().toString(36);
  }
  
  function getCsrfToken() {
    return document.getElementById('csrfToken')?.value || '';
  }
  
  function getSessionId() {
    return document.getElementById('sessionId')?.value || '';
  }
  
  function setupRateLimiting() {
    let submitAttempts = 0;
    const maxAttempts = 5;
    const resetTime = 300000; // 5 minutes
    
    const originalSubmit = checkoutForm.onsubmit;
    checkoutForm.addEventListener('submit', function(e) {
      const now = Date.now();
      const lastAttempt = localStorage.getItem('lastSubmitAttempt');
      const attempts = parseInt(localStorage.getItem('submitAttempts') || '0');
      
      // Reset attempts if enough time has passed
      if (lastAttempt && (now - parseInt(lastAttempt)) > resetTime) {
        localStorage.removeItem('submitAttempts');
        localStorage.removeItem('lastSubmitAttempt');
        submitAttempts = 0;
      } else {
        submitAttempts = attempts;
      }
      
      if (submitAttempts >= maxAttempts) {
        e.preventDefault();
        displayErrors(['Too many attempts. Please wait 5 minutes before trying again.']);
        return false;
      }
      
      submitAttempts++;
      localStorage.setItem('submitAttempts', submitAttempts.toString());
      localStorage.setItem('lastSubmitAttempt', now.toString());
    });
  }
  
  // Analytics Functions
  function initializeAnalytics() {
    // Track page view
    trackEvent('checkout_page_view', {
      page_title: document.title,
      page_location: window.location.href,
      cart_items: (JSON.parse(localStorage.getItem("cart")) || []).length
    });
    
    // Track form interactions
    setupFormTracking();
    
    // Track cart abandonment
    setupAbandonmentTracking();
  }
  
  function trackEvent(eventName, parameters = {}) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, {
        ...parameters,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`
      });
    }
    
    // Console logging for development
    console.log('Analytics Event:', eventName, parameters);
    
    // Custom analytics endpoint (if available)
    try {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventName,
          parameters: parameters,
          timestamp: new Date().toISOString(),
          session_id: getSessionId()
        })
      }).catch(err => console.log('Analytics endpoint not available:', err.message));
    } catch (e) {
      // Analytics endpoint not available, continue silently
    }
  }
  
  function setupFormTracking() {
    const inputs = document.querySelectorAll('#checkoutForm input, #checkoutForm select, #checkoutForm textarea');
    
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        trackEvent('form_field_focus', {
          field_name: input.name || input.id,
          field_type: input.type
        });
      });
      
      input.addEventListener('blur', () => {
        if (input.value.trim()) {
          trackEvent('form_field_complete', {
            field_name: input.name || input.id,
            field_type: input.type
          });
        }
      });
    });
  }
  
  function setupAbandonmentTracking() {
    let abandonmentTimer;
    let isFormStarted = false;
    
    // Track when user starts filling form
    document.getElementById('checkoutForm').addEventListener('input', function() {
      if (!isFormStarted) {
        isFormStarted = true;
        trackEvent('checkout_form_started');
      }
      
      // Reset abandonment timer
      clearTimeout(abandonmentTimer);
      abandonmentTimer = setTimeout(() => {
        trackEvent('checkout_abandoned', {
          time_spent: Date.now() - performance.timing.navigationStart,
          form_completion: calculateFormCompletion()
        });
      }, 300000); // 5 minutes of inactivity
    });
    
    // Track when user leaves page
    window.addEventListener('beforeunload', function() {
      if (isFormStarted) {
        trackEvent('checkout_page_exit', {
          form_completion: calculateFormCompletion(),
          time_on_page: Date.now() - performance.timing.navigationStart
        });
      }
    });
  }
  
  function calculateFormCompletion() {
    const requiredFields = document.querySelectorAll('#checkoutForm input[required]');
    const completedFields = Array.from(requiredFields).filter(field => field.value.trim()).length;
    return Math.round((completedFields / requiredFields.length) * 100);
  }
});
