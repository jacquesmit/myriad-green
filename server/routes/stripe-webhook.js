// Stripe Webhook handler: updates payments + order/booking status
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const { getProvider } = require('../payments');
const admin = require('../firebase');

const db = admin.firestore();

// Export a function to be mounted with express.raw({ type: 'application/json' })
module.exports = async function stripeWebhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (webhookSecret) {
      const provider = getProvider('stripe');
      const raw = (req.rawBody && Buffer.isBuffer(req.rawBody)) ? req.rawBody : (Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})));
      event = provider.constructWebhookEvent({ rawBody: raw, signature: sig, secret: webhookSecret });
    } else {
      // Dev fallback: accept plain JSON (handle Buffer, string, or object)
      if (Buffer.isBuffer(req.body)) {
        event = JSON.parse(req.body.toString('utf8'));
      } else if (typeof req.body === 'string') {
        event = JSON.parse(req.body);
      } else {
        event = req.body;
      }
    }
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const sessionId = session.id;
        const amountTotal = session.amount_total ?? null;
        const currency = session.currency ?? null;
        // Update payments doc
        const paymentRef = db.collection('payments').doc(sessionId);
        await paymentRef.set({
          stripeStatus: 'completed',
          amountTotal: amountTotal ?? admin.firestore.FieldValue.delete(),
          currency: currency ?? admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        const paySnap = await paymentRef.get();
        const flowType = paySnap.exists ? paySnap.get('flow_type') : (session.metadata && session.metadata.flow_type);
        const bookingId = paySnap.exists ? paySnap.get('bookingId') : (session.metadata && session.metadata.bookingId);

        // Try to update order if linked
        const orderRef = paySnap.exists ? paySnap.get('orderRef') : null;
        if (orderRef) {
          try {
            await orderRef.set({ status: 'paid', paidAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            await orderRef.collection('events').add({ type: 'payment_succeeded', payload: { sessionId }, createdAt: admin.firestore.FieldValue.serverTimestamp() });
          } catch (e) {
            console.warn('Order status update failed:', e?.message || e);
          }
        }

        // If booking flow, try to update booking doc by known bookingId
        if (!orderRef && (flowType === 'booking' || bookingId)) {
          try {
            if (bookingId) {
              const bkRef = db.collection('bookings').doc(String(bookingId));
              await bkRef.set({
                status: 'confirmed',
                stripeSessionId: sessionId,
                paymentRef: paymentRef,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
              await bkRef.collection('events').add({ type: 'payment_succeeded', payload: { sessionId }, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            }
          } catch (e) {
            console.warn('Booking status update failed:', e?.message || e);
          }
        }

        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        const sessionId = session.id;
        try {
          await db.collection('payments').doc(sessionId).set({ stripeStatus: 'expired', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } catch (e) {
          console.warn('Payment expire update failed:', e?.message || e);
        }
        break;
      }
      default:
        // Ignore other events for now
        break;
    }

    res.json({ received: true });
  } catch (e) {
    console.error('Webhook handling error:', e?.message || e);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
