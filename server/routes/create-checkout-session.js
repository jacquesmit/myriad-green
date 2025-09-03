

const express = require("express");
const router = express.Router();
require('dotenv').config();

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'zar').toLowerCase();
const stripe = require('stripe')(STRIPE_SECRET || '');
const { getProvider } = require('../payments');
const admin = require('../firebase');
const axios = require('axios');
const nodemailer = require('nodemailer');

// Reuse initialized Firebase Admin from index.js
const db = admin.firestore();

// --- Helpers ---------------------------------------------------------------
const normalizeEmail = (email) => (email || '').trim().toLowerCase();

async function getOrCreateCustomer(db, { email, name, phone }) {
  const id = normalizeEmail(email);
  if (!id) return null;
  const ref = db.collection('customers').doc(id);
  const snap = await ref.get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  if (!snap.exists) {
    await ref.set({
      primaryEmail: id,
      name: name || '',
      phones: phone ? [String(phone)] : [],
      emails: id ? [id] : [],
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  } else {
    await ref.set({
      // keep latest seen details
      name: name || snap.get('name') || '',
      updatedAt: now,
    }, { merge: true });
  }
  return ref;
}

async function addEvent(parentRef, type, payload) {
  try {
    await parentRef.collection('events').add({
      type,
      payload: payload || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn('Event log failed:', e?.message || e);
  }
}

function buildMailTransport() {
  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_PASS || '').replace(/\s+/g, '');
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

async function sendMailFallback({ to, subject, html, text }) {
  try {
    const transporter = buildMailTransport();
    if (!transporter) return { ok: false, reason: 'No Gmail creds' };
    const from = process.env.COMPANY_EMAIL || process.env.GMAIL_USER || 'noreply@example.com';
    const info = await transporter.sendMail({ from, to, subject, html, text });
    console.log('📮 Fallback mail sent via Nodemailer:', info.messageId);
    return { ok: true };
  } catch (e) {
    console.warn('📮 Fallback mail failed:', e?.message || e);
    return { ok: false, reason: e?.message || String(e) };
  }
}

// POST /create-checkout-session
// Expects: { cart, customerName, customerPhone, customerEmail, customerAddress }
router.post("/", async (req, res) => {
  const { cart, customerName, customerPhone, customerEmail, customerAddress, bookingId } = req.body;

  try {
  // Ensure we have a cart
    // Validate cart
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Validate required customer fields (mirror checkout form)
    if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
      return res.status(400).json({ error: "Missing required customer details (name, email, phone, address)" });
    }

    // Format line items for Stripe (omit empty description)
    const lineItems = cart.map(item => {
      const productData = {
        name: item.name,
        // Stripe requires HTTPS image URLs; use a safe placeholder or omit
        images: ["https://via.placeholder.com/150"],
      };
      if (item.description && String(item.description).trim().length > 0) {
        productData.description = String(item.description);
      }
      return {
        price_data: {
          currency: STRIPE_CURRENCY,
          product_data: productData,
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      };
    });

    console.log("🛒 Line items:", JSON.stringify(lineItems, null, 2));
  const origin = req.headers.origin || process.env.BASE_URL;
  const isBooking = !!bookingId;

    // Resolve or create customer
    let customerRef = null;
    try {
      customerRef = await getOrCreateCustomer(db, { email: customerEmail, name: customerName, phone: customerPhone });
    } catch (e) {
      console.warn('Customer upsert skipped/failed:', e?.message || e);
    }

    // 1️⃣ Create a real Stripe session
    if (!STRIPE_SECRET) {
      return res.status(500).json({ error: 'Stripe not configured (missing STRIPE_SECRET_KEY)' });
    }
  const provider = getProvider('stripe');
  const { url, sessionId } = await provider.createCheckout({ cart, origin, isBooking, bookingId });

    // 2️⃣ Create/Upsert payment doc immediately (best-effort)
    const totalCents = cart.reduce((t, item) => t + Math.round(item.price * 100) * item.quantity, 0);
  const paymentRef = db.collection('payments').doc(sessionId);
    try {
      await paymentRef.set({
  sessionId,
        flow_type: isBooking ? 'booking' : 'order',
        bookingId: bookingId || '',
        customerEmail: customerEmail,
        customerName: customerName,
        currency: STRIPE_CURRENCY,
        amountTotal: totalCents,
        mode: 'payment',
        stripeStatus: 'created',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        customerRef: customerRef ? customerRef : null,
      }, { merge: true });
    } catch (e) {
      console.warn('Payments write failed:', e?.message || e);
    }

    // 3️⃣ Save order to Firestore (best-effort)
    let orderId = null;
    let orderRef = null;
    try {
      if (!isBooking) {
        orderRef = await db.collection('orders').add({
          cart,
          sessionId: sessionId,
          customerName,
          customerPhone,
          customerEmail,
          customerAddress,
          status: 'pending_payment',
          paymentRef: paymentRef,
          customerRef: customerRef ? customerRef : null,
          emailSent: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        orderId = orderRef.id;
        console.log(`🧾 Order saved with ID: ${orderId}`);
        // Link payment -> order
        try { await paymentRef.set({ orderRef, orderId }, { merge: true }); } catch (e) {}
        // Event: created
        try { await addEvent(orderRef, 'created', { sessionId: sessionId, amountTotal: totalCents, currency: STRIPE_CURRENCY }); } catch {}
      } else {
        console.log('🧾 Booking flow: skipping orders write (bookingId provided)');
      }
    } catch (e) {
      console.warn('Firestore save skipped/failed:', e?.message || e);
    }

  // 4️⃣ No need to update the session success_url; we pass sessionId via placeholder above
  console.log(`✅ Stripe session created: ${sessionId}`);

    // 5️⃣ Send email via EmailJS (best-effort; non-fatal)
  let emailSent = false;
  try {
      console.log("📧 Sending confirmation email...");
      const EMAILJS_USER = process.env.EMAILJS_USER_ID || process.env.EMAILJS_PUBLIC_KEY || '';
      const isBookingFlow = isBooking;
      // Choose customer template IDs with sensible fallbacks
      const templateId = isBookingFlow
        ? (process.env.EMAILJS_TEMPLATE_ID_BOOKING_CUSTOMER
            || process.env.EMAILJS_TEMPLATE_ID_BOOKING
            || process.env.EMAILJS_TEMPLATE_ID_CONTACT_US
            || process.env.EMAILJS_TEMPLATE_ID_CONFIRMATION_ORDER)
        : (process.env.EMAILJS_TEMPLATE_ID_CONFIRMATION_ORDER);
      const order_total = cart.reduce((t, item) => t + item.price * item.quantity, 0).toFixed(2);
      const COMPANY_NAME = process.env.COMPANY_NAME || "Myriad Green";
      const COMPANY_EMAIL = process.env.COMPANY_EMAIL || "irrigationsa@gmail.com";
      const COMPANY_PHONE = process.env.COMPANY_PHONE || "+27 12 345 6789";
      const template_params = isBookingFlow ? {
        // recipient
        to_email: customerEmail,
        email: customerEmail,
        // customer
        customer_name: customerName,
        customer_phone: customerPhone,
        // plain keys expected by template
        name: customerName,
        phone: customerPhone,
        service: cart?.[0]?.name?.replace(/^Booking:\s*/, '') || 'Consultation',
        datetime: (req.body?.bookingDateTime || ''),
        isEmergency: (req.body?.bookingEmergency ? 'Yes' : 'No'),
        hours: String(req.body?.bookingHours || ''),
        price: order_total,
        message: (req.body?.bookingMessage || ''),
        booking_id: (req.body?.bookingId || ''),
        current_year: new Date().getFullYear(),
        // compatible booking_* aliases
        booking_service: cart?.[0]?.name?.replace(/^Booking:\s*/, '') || 'Consultation',
        booking_datetime: (req.body?.bookingDateTime || ''),
        booking_hours: (req.body?.bookingHours || ''),
        booking_emergency: (req.body?.bookingEmergency ? 'Yes' : 'No'),
        booking_price: order_total,
        // company info
        company_name: COMPANY_NAME,
        company_email: COMPANY_EMAIL,
        company_phone: COMPANY_PHONE,
      } : {
        to_email: customerEmail,
        email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        order_summary: cart.map(item => `${item.quantity} x ${item.name}`).join(', '),
        order_total,
        company_name: COMPANY_NAME,
        company_email: COMPANY_EMAIL,
        company_phone: COMPANY_PHONE,
      };
      const payload = {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_USER,
        template_params,
      };
      const emailResp = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
        timeout: 6000,
        headers: {
          Origin: process.env.EMAILJS_ORIGIN || (req.headers.origin || 'http://localhost:3000'),
        },
      });
      console.log("📤 EmailJS response:", emailResp.status, emailResp.data);
      console.log("📤 Email sent successfully to:", customerEmail);
      emailSent = true;
    } catch (e) {
      console.warn("✉️ EmailJS failed:", e?.response?.status || e?.message || e);
      // Fallback via Nodemailer
      try {
        const subject = isBookingFlow
          ? `Booking received: ${cart?.[0]?.name?.replace(/^Booking:\s*/, '') || 'Consultation'}`
          : `Order confirmation`;
        const lines = isBookingFlow
          ? [
              `Hi ${customerName},`,
              `Thanks for your booking. Here are the details:`,
              `Service: ${cart?.[0]?.name?.replace(/^Booking:\s*/, '') || 'Consultation'}`,
              `Date/Time: ${req.body?.bookingDateTime || ''}`,
              `Hours: ${req.body?.bookingHours || ''}`,
              `Emergency: ${req.body?.bookingEmergency ? 'Yes' : 'No'}`,
              `Price: ${cart.reduce((t, i) => t + i.price * i.quantity, 0).toFixed(2)} ${STRIPE_CURRENCY.toUpperCase()}`,
              req.body?.bookingMessage ? `Message: ${req.body.bookingMessage}` : '',
              `Booking ID: ${req.body?.bookingId || ''}`
            ]
          : [
              `Hi ${customerName},`,
              `Thanks for your order. Summary:`,
              ...cart.map(i => `${i.quantity} x ${i.name} @ ${i.price}`),
              `Total: ${cart.reduce((t, i) => t + i.price * i.quantity, 0).toFixed(2)} ${STRIPE_CURRENCY.toUpperCase()}`,
            ];
        const html = `<div>${lines.filter(Boolean).map(l => `<p>${String(l)}</p>`).join('')}</div>`;
        const fb = await sendMailFallback({ to: customerEmail, subject, html, text: lines.join('\n') });
        if (fb.ok) emailSent = true;
      } catch {}
    }

    // 5b️⃣ Send an internal notification to the business inbox
  try {
      const notifyTo = (process.env.ORDER_NOTIFY_EMAIL || 'irrigationsa@gmail.com').trim();
      if (notifyTo) {
        console.log("📧 Sending internal notification to:", notifyTo);
        const EMAILJS_USER = process.env.EMAILJS_USER_ID || process.env.EMAILJS_PUBLIC_KEY || '';
        // Choose admin template IDs with sensible fallbacks
        const adminTemplateId = isBooking
          ? (process.env.EMAILJS_TEMPLATE_ID_BOOKING_ADMIN
              || process.env.EMAILJS_TEMPLATE_ID_BOOKING
              || process.env.EMAILJS_TEMPLATE_ID_CONTACT_US
              || process.env.EMAILJS_TEMPLATE_ID_CONFIRMATION_ORDER)
          : (process.env.EMAILJS_TEMPLATE_ID_ORDER_ADMIN
              || process.env.EMAILJS_TEMPLATE_ID_CONFIRMATION_ORDER);
        const COMPANY_NAME = process.env.COMPANY_NAME || "Myriad Green";
        const COMPANY_EMAIL = process.env.COMPANY_EMAIL || "irrigationsa@gmail.com";
        const COMPANY_PHONE = process.env.COMPANY_PHONE || "+27 12 345 6789";
        const adminParams = isBooking ? {
          // recipient
          to_email: notifyTo,
          email: notifyTo,
          // customer
          customer_name: customerName,
          customer_phone: customerPhone,
          // plain keys for admin template if desired
          name: customerName,
          phone: customerPhone,
          service: cart?.[0]?.name?.replace(/^Booking:\s*/, '') || 'Consultation',
          datetime: (req.body?.bookingDateTime || ''),
          isEmergency: (req.body?.bookingEmergency ? 'Yes' : 'No'),
          hours: String(req.body?.bookingHours || ''),
          price: cart.reduce((t, item) => t + item.price * item.quantity, 0).toFixed(2),
          message: (req.body?.bookingMessage || ''),
          booking_id: (req.body?.bookingId || ''),
          current_year: new Date().getFullYear(),
          // booking_* aliases
          booking_service: cart?.[0]?.name?.replace(/^Booking:\s*/, '') || 'Consultation',
          booking_datetime: (req.body?.bookingDateTime || ''),
          booking_hours: (req.body?.bookingHours || ''),
          booking_emergency: (req.body?.bookingEmergency ? 'Yes' : 'No'),
          booking_price: cart.reduce((t, item) => t + item.price * item.quantity, 0).toFixed(2),
          // company
          company_name: COMPANY_NAME,
          company_email: COMPANY_EMAIL,
          company_phone: COMPANY_PHONE,
        } : {
          to_email: notifyTo,
          email: notifyTo,
          customer_name: customerName,
          customer_phone: customerPhone,
          order_summary: cart.map(item => `${item.quantity} x ${item.name}`).join(', '),
          order_total: cart.reduce((t, item) => t + item.price * item.quantity, 0).toFixed(2),
          company_name: COMPANY_NAME,
          company_email: COMPANY_EMAIL,
          company_phone: COMPANY_PHONE,
        };
        const payloadAdmin = {
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: adminTemplateId,
          user_id: EMAILJS_USER,
          template_params: adminParams,
        };
        const adminResp = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payloadAdmin, {
          timeout: 6000,
          headers: {
            Origin: process.env.EMAILJS_ORIGIN || (req.headers.origin || 'http://localhost:3000'),
          },
        });
        console.log("📤 Admin EmailJS response:", adminResp.status, adminResp.data);
      }
    } catch (e) {
      console.warn("✉️ Admin EmailJS failed:", e?.response?.status || e?.message || e);
      // Fallback via Nodemailer to admin
      try {
        const notifyTo = (process.env.ORDER_NOTIFY_EMAIL || 'irrigationsa@gmail.com').trim();
        const subject = isBooking ? `New booking: ${cart?.[0]?.name?.replace(/^Booking:\s*/, '') || 'Consultation'}` : `New order`;
        const lines = isBooking ? [
          `Customer: ${customerName} (${customerPhone})`,
          `Email: ${customerEmail}`,
          `Service: ${cart?.[0]?.name?.replace(/^Booking:\s*/, '') || 'Consultation'}`,
          `Date/Time: ${req.body?.bookingDateTime || ''}`,
          `Hours: ${req.body?.bookingHours || ''}`,
          `Emergency: ${req.body?.bookingEmergency ? 'Yes' : 'No'}`,
          `Price: ${cart.reduce((t, i) => t + i.price * i.quantity, 0).toFixed(2)} ${STRIPE_CURRENCY.toUpperCase()}`,
          req.body?.bookingMessage ? `Message: ${req.body.bookingMessage}` : '',
          `Booking ID: ${req.body?.bookingId || ''}`,
        ] : [
          `Customer: ${customerName} (${customerPhone})`,
          `Email: ${customerEmail}`,
          `Items: ${cart.map(i => `${i.quantity} x ${i.name}`).join(', ')}`,
          `Total: ${cart.reduce((t, i) => t + i.price * i.quantity, 0).toFixed(2)} ${STRIPE_CURRENCY.toUpperCase()}`,
          `Session: ${'will be set after payment'}`,
        ];
        const html = `<div>${lines.filter(Boolean).map(l => `<p>${String(l)}</p>`).join('')}</div>`;
        await sendMailFallback({ to: notifyTo, subject, html, text: lines.join('\n') });
      } catch {}
    }

    // 6️⃣ Update order email status and events (best-effort)
    try {
      if (!isBooking && orderId) {
        const oref = db.collection('orders').doc(orderId);
        await oref.set({ emailSent, emailUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        if (emailSent) {
          try { await addEvent(oref, 'email_sent', { to: customerEmail }); } catch {}
        }
      }
    } catch (e) {
      console.warn('Firestore order email status update failed:', e?.message || e);
    }

  // ✅ Send back Stripe (or simulated) redirect URL
  res.json({ url });

  } catch (err) {
    // Handle errors and return a generic error message
    const details = {
      message: err?.message || 'unknown',
      type: err?.type || null,
      code: err?.code || null,
      param: err?.param || null,
    };
    console.error("❌ Error creating checkout session:", details);
    // Return non-sensitive details to help diagnose in dev
    res.status(500).json({ error: 'Checkout failed. Please try again.', ...details });
  }
});

// Export the router to be used in your main Express app
module.exports = router;
