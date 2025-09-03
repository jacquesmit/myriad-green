// Stripe provider implementing a tiny contract used by our routes.
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'zar').toLowerCase();

module.exports = {
  name: 'stripe',

  async createCheckout({ cart, origin, isBooking, bookingId }) {
    const lineItems = cart.map((item) => ({
      price_data: {
        currency: STRIPE_CURRENCY,
        product_data: {
          name: item.name,
          description: item.description || '',
          images: ['https://via.placeholder.com/150'],
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: isBooking
        ? `${origin}/thank-you.html?bookingId=${encodeURIComponent(bookingId || '')}&sessionId={CHECKOUT_SESSION_ID}`
        : `${origin}/thank-you-order.html?sessionId={CHECKOUT_SESSION_ID}`,
      cancel_url: isBooking ? `${origin}/booking-page.html` : `${origin}/checkout.html`,
      metadata: { flow_type: isBooking ? 'booking' : 'order', bookingId: bookingId || '' },
    });

    return { url: session.url, sessionId: session.id };
  },

  constructWebhookEvent({ rawBody, signature, secret }) {
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    return event;
  },
};
