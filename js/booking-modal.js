// ✅ EmailJS init with error handling
try {
  emailjs.init("ONUJ8lbw4WfuQVpFf");
  window._emailjsReady = true;
} catch (e) {
  console.error("❌ EmailJS failed to initialize:", e);
  window._emailjsReady = false;
  window._emailjsError = e && e.message ? e.message : String(e);
}

// ✅ Firebase imports with error handling
let firebaseError;
window._firebaseError = null;

(async () => {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js");
    const {
      getFirestore,
      collection,
      query,
      where,
      getDocs,
      addDoc
    } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js");
    const { getAnalytics, logEvent } = await import("https://www.gstatic.com/firebasejs/9.6.10/firebase-analytics.js");

    // ✅ Firebase config (same as shop)
    const firebaseConfig = {
      apiKey: "AIzaSyDshdxstcCy5hqoN4PBOt0KjEtPP6F4ehU",
      authDomain: "myriad-green-booking.firebaseapp.com",
      projectId: "myriad-green-booking",
      storageBucket: "myriad-green-booking.appspot.com",
      messagingSenderId: "1045964317317",
      appId: "1:1045964317317:web:4d56dd1b99b7e06f27ffec",
      measurementId: "G-FVNSW4M4JN"
    };
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const analytics = getAnalytics(app);
    window._firebaseReady = true;
    window._firebase = { db, analytics, logEvent, collection, query, where, getDocs, addDoc };
  } catch (e) {
    console.error("❌ Firebase failed to initialize:", e);
    firebaseError = e;
    window._firebaseReady = false;
    window._firebaseError = e && e.message ? e.message : String(e);
  }
})();





// ✅ Export function for booking-modal-loader.js to call
export async function initBookingModal() {
  const form = document.getElementById("booking-form");
  const summaryBox = document.getElementById("booking-summary");
  const summaryFields = {
    name: document.getElementById("summary-name"),
    email: document.getElementById("summary-email"),
    phone: document.getElementById("summary-phone"),
    service: document.getElementById("summary-service"),
    datetime: document.getElementById("summary-datetime"),
    emergency: document.getElementById("summary-emergency"),
    hours: document.getElementById("summary-hours"),
    price: document.getElementById("summary-price"),
    message: document.getElementById("summary-message")
  };
  const serviceSelect = document.getElementById("service");
  const datetimeInput = document.getElementById("datetime");
  const emergencyCheckbox = document.getElementById("isEmergency");
  const hoursInput = document.getElementById("hours");
  let currentPrice = 0;
  const basePrices = {
    "Irrigation": 800,
    "Boreholes": 1200,
    "Plumbing": 700,
    "Electrical": 900,
    "Water Storage Tanks": 950,
    "Water Filtration": 1100,
    "Pumps": 850,
    "Landscaping": 1000,
    "Grey Water Systems": 950,
    "Rain Water Harvesting": 1050,
    "Waste Water Systems": 1150,
    "Leak Detection": 900,
    "Emergency Services": 1500,
    "Solar Installations": 2000,
    "Blocked Drainage": 800,
    "Gutter Solutions": 600,
    "Instant Lawn": 500,
    "Aggregates": 400,
    "Garden Substrates": 350,
    "Treefelling": 1200,
    "Coc Certificates": 650,
    "Gas Installations": 1300
  };
  function updatePrice() {
    const selectedService = serviceSelect ? serviceSelect.value : "";
    let price = basePrices[selectedService] || 0;
    let hours = hoursInput ? Math.max(1, parseInt(hoursInput.value) || 1) : 1;
    let multiplier = (emergencyCheckbox && emergencyCheckbox.checked) ? 2.25 : 1;
    price = price * hours * multiplier;
    currentPrice = price;
  }
  function updateSummary() {
    if (!summaryBox) return;
    summaryFields.name.textContent = form.name.value;
    summaryFields.email.textContent = form.email.value;
    summaryFields.phone.textContent = form.phone.value;
    summaryFields.service.textContent = serviceSelect.value;
    summaryFields.datetime.textContent = datetimeInput.value;
    summaryFields.emergency.textContent = emergencyCheckbox && emergencyCheckbox.checked ? "Yes" : "No";
    summaryFields.hours.textContent = hoursInput ? hoursInput.value : "1";
    summaryFields.price.textContent = currentPrice ? `R${currentPrice}` : "";
    summaryFields.message.textContent = form.message.value;
    summaryBox.style.display = "block";
  }
  if (form) {
    [form.name, form.email, form.phone, serviceSelect, datetimeInput, emergencyCheckbox, hoursInput, form.message].forEach(el => {
      if (el) el.addEventListener("input", () => { updatePrice(); updateSummary(); });
      if (el && el.tagName === "SELECT") el.addEventListener("change", () => { updatePrice(); updateSummary(); });
    });
    updatePrice();
    updateSummary();
    let errorBox = form.querySelector('.form-error-box');
    if (!errorBox) {
      errorBox = document.createElement('div');
      errorBox.className = 'form-error-box';
      errorBox.style.color = '#b91c1c';
      errorBox.style.background = '#fff8f1';
      errorBox.style.padding = '10px 16px';
      errorBox.style.margin = '10px 0';
      errorBox.style.borderRadius = '6px';
      errorBox.style.fontWeight = '600';
      errorBox.style.fontSize = '1rem';
      errorBox.style.display = 'none';
      form.prepend(errorBox);
    }
  form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      errorBox.textContent = '';
      const btn = form.querySelector("button[type='submit']");
      btn.disabled = true;
      btn.textContent = "Submitting…";
      const bookingData = {
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value,
        service: form.service.value,
        hours: hoursInput ? Math.max(1, parseInt(hoursInput.value) || 1) : 1,
        datetime: form.datetime.value,
        isEmergency: form.isEmergency ? form.isEmergency.checked : false,
        message: form.message ? form.message.value : "",
        price: currentPrice
      };
      ["name", "email", "phone", "service", "hours", "datetime", "message"].forEach(id => {
        const msg = form.querySelector(`#${id}-message`);
        if (msg) msg.textContent = "";
      });
      let hasError = false;
      if (!bookingData.name.trim()) {
        form.querySelector('#name-message').textContent = "Please enter your name.";
        hasError = true;
      }
      if (!bookingData.email.trim()) {
        form.querySelector('#email-message').textContent = "Please enter your email address.";
        hasError = true;
      } else if (!/^\S+@\S+\.\S+$/.test(bookingData.email)) {
        form.querySelector('#email-message').textContent = "Please enter a valid email address.";
        hasError = true;
      }
      if (!bookingData.phone.trim()) {
        form.querySelector('#phone-message').textContent = "Please enter your phone number.";
        hasError = true;
      }
      if (!bookingData.service.trim()) {
        form.querySelector('#service-message').textContent = "Please select a service.";
        hasError = true;
      }
      if (!bookingData.hours || bookingData.hours < 1) {
        form.querySelector('#hours-message').textContent = "Please enter the expected hours (minimum 1).";
        hasError = true;
      }
      if (!bookingData.datetime) {
        form.querySelector('#datetime-message').textContent = "Please select a date and time.";
        hasError = true;
      } else if (new Date(bookingData.datetime) < new Date()) {
        form.querySelector('#datetime-message').textContent = "You can't book a date in the past.";
        hasError = true;
      }
      if (hasError) {
        btn.disabled = false;
        btn.textContent = "Submit Booking";
        return;
      }
      // Stripe Checkout integration for booking fee/payment
      // Build a single-item cart that describes the booking
      const cartItem = {
        name: `Booking: ${bookingData.service}`,
        description: `Date: ${bookingData.datetime}; Hours: ${bookingData.hours}; Emergency: ${bookingData.isEmergency ? 'Yes' : 'No'}; Notes: ${bookingData.message || 'N/A'}`,
        price: bookingData.price,
        quantity: 1
      };

      // Detect backend API base (like checkout.js)
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

      try {
        // Respect booking modal's own Firebase rules: check slot availability before proceeding
        try {
          if (window._firebaseReady && window._firebase?.db) {
            const { db, collection, query, where, getDocs } = window._firebase;
            const q = query(collection(db, "bookings"), where("datetime", "==", bookingData.datetime));
            const snap = await getDocs(q);
            if (!snap.empty) {
              form.querySelector('#datetime-message').textContent = "That time slot is already booked. Please choose another.";
              btn.disabled = false;
              btn.textContent = "Submit Booking";
              return;
            }
          } else {
            console.warn("⚠️ Firebase not ready; skipping duplicate booking check");
          }
        } catch (checkErr) {
          console.warn("⚠️ Booking availability check failed:", checkErr);
        }

        // Create a pending booking record in the modal's Firestore (uses its own rules)
        let bookingId = null;
        try {
          if (window._firebaseReady && window._firebase?.db) {
            const { db, addDoc, collection } = window._firebase;
            const docRef = await addDoc(collection(db, 'bookings'), {
              name: bookingData.name,
              email: bookingData.email,
              phone: bookingData.phone,
              service: bookingData.service,
              hours: bookingData.hours,
              datetime: bookingData.datetime,
              isEmergency: bookingData.isEmergency,
              message: bookingData.message,
              price: bookingData.price,
              status: 'pending',
              created: new Date()
            });
            bookingId = docRef.id;
          }
        } catch (preSaveErr) {
          console.warn('⚠️ Failed to create pending booking:', preSaveErr);
        }

        // Optional: save basic client + booking cart snapshot to backend (best-effort)
        try {
          await fetch(`${API_BASE}/save-client-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: bookingData.name,
              email: bookingData.email,
              phone: bookingData.phone,
              address: 'Booking - via modal',
              cart: [cartItem]
            })
          });
        } catch (_) {}

        // Create Stripe checkout session through backend
        const resp = await fetch(`${API_BASE}/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: [cartItem],
            customerName: bookingData.name,
            customerPhone: bookingData.phone,
            customerEmail: bookingData.email,
            customerAddress: 'Booking - via modal',
            bookingId,
            bookingDateTime: bookingData.datetime,
            bookingHours: bookingData.hours,
            bookingEmergency: bookingData.isEmergency,
            bookingMessage: bookingData.message
          })
        });
        const data = await resp.json();
        if (resp.ok && data?.url) {
          window.location.href = data.url; // Redirect to Stripe
          return; // Stop further execution
        }
        throw new Error(data?.error || 'Failed to initiate Stripe checkout');
      } catch (err) {
        let msg = err && err.message ? err.message : "Something went wrong. Try again.";
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
        btn.disabled = false;
        btn.textContent = "Submit Booking";
      }
    });
  }
}