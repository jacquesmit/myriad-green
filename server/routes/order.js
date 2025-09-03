
// This route handles fetching order details from Firestore by Stripe session ID.
// It is used to look up order/payment info after a Stripe checkout.

const express = require('express');
const router = express.Router();
const admin = require('../firebase');
const db = admin.firestore();
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_SECRET ? require('stripe')(STRIPE_SECRET) : null;

function toIso(ts) {
  try { return ts && typeof ts.toDate === 'function' ? ts.toDate().toISOString() : null; } catch { return null; }
}
function fromDaysAgo(days) { return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)); }

// GET /order/:sessionId - Fetch order details by sessionId
// Example: GET /order/sess_12345
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`Fetching order with sessionId: ${sessionId}`);

    // Query Firestore for the order with the given sessionId
    const ordersRef = db.collection('orders');
    const snapshot = await ordersRef.where('sessionId', '==', sessionId).get();

    if (snapshot.empty) {
      // No order found for this sessionId
      console.error(`No order found for sessionId: ${sessionId}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    // Assuming sessionId is unique, fetch the first matching document
    const order = snapshot.docs[0].data();
    console.log(`Order fetched successfully:`, order);
    res.json(order);
  } catch (error) {
    // Handle errors and return a generic error message
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /order/last - Return last N Firestore orders + optional Stripe latest session date
router.get('/last/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    const snap = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const orders = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAtIso: toIso(d.get('createdAt')) }));

    let stripeLatest = null;
    if (stripe) {
      try {
        const sessions = await stripe.checkout.sessions.list({ limit: 1 });
        const s = sessions.data[0];
        if (s) stripeLatest = { id: s.id, created: new Date(s.created * 1000).toISOString(), status: s.status };
      } catch (e) {
        // non-fatal
      }
    }
    res.json({ count: orders.length, stripeLatest, orders });
  } catch (e) {
    console.error('Error fetching last orders:', e);
    res.status(500).json({ error: 'Failed to fetch last orders' });
  }
});

// GET /order/reconcile?days=7 - Match Stripe sessions to Firestore orders
router.get('/reconcile', async (req, res) => {
  try {
    if (!stripe) return res.status(200).json({ error: 'Stripe not configured', matched: [], missingInFirestore: [], missingInStripe: [] });

    const days = Math.min(parseInt(req.query.days || '14', 10), 90);
    const since = fromDaysAgo(days);

    // 1) Pull recent Firestore orders
    const fsSnap = await db.collection('orders')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(since))
      .orderBy('createdAt', 'desc')
      .get();
    const fsOrders = fsSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        sessionId: data.sessionId || null,
        createdAtIso: toIso(data.createdAt),
        customerName: data.customerName || null,
        customerEmail: data.customerEmail || null,
        cart: Array.isArray(data.cart) ? data.cart : [],
      };
    });

    // 2) Pull recent Stripe checkout sessions
  const stripeSessions = [];
    let startingAfter = undefined;
    // paginate a few pages to cover the window (each page max 100)
    for (let i = 0; i < 3; i++) {
    const page = await stripe.checkout.sessions.list({ limit: 100, starting_after: startingAfter });
      for (const s of page.data) {
        const created = new Date(s.created * 1000);
        if (created >= since) {
      stripeSessions.push({ id: s.id, createdIso: created.toISOString(), status: s.status, amount_total: s.amount_total, currency: s.currency, customer_details: s.customer_details || null });
        }
      }
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1].id;
    }

    // 3) Indexing and matching by sessionId
    const fsBySession = new Map(fsOrders.filter(o => o.sessionId).map(o => [o.sessionId, o]));
    const stripeById = new Map(stripeSessions.map(s => [s.id, s]));

  const matched = [];
    const missingInFirestore = [];
    for (const s of stripeSessions) {
      const o = fsBySession.get(s.id);
      if (o) {
        const fsTotal = Array.isArray(o.cart) ? o.cart.reduce((t, it) => t + (Number(it.price || 0) * Number(it.quantity || 1)), 0) : 0;
        const stripeTotal = typeof s.amount_total === 'number' ? (s.amount_total / 100) : null;
        matched.push({
          sessionId: s.id,
          firestoreId: o.id,
          stripeCreated: s.createdIso,
          firestoreCreated: o.createdAtIso,
          status: s.status,
          totals: { firestoreZAR: fsTotal, stripeAmount: stripeTotal, stripeCurrency: s.currency || 'zar', amountMismatch: (stripeTotal != null) ? Math.abs(fsTotal - stripeTotal) > 0.01 : null }
        });
      }
      else missingInFirestore.push({ sessionId: s.id, stripeCreated: s.createdIso, status: s.status });
    }

    const missingInStripe = fsOrders
      .filter(o => o.sessionId && !stripeById.has(o.sessionId))
      .map(o => ({ sessionId: o.sessionId, firestoreId: o.id, firestoreCreated: o.createdAtIso }));

    res.json({
      windowDays: days,
      totals: { firestore: fsOrders.length, stripe: stripeSessions.length, matched: matched.length },
      matched,
      missingInFirestore,
      missingInStripe,
    });
  } catch (e) {
    console.error('Error reconciling orders:', e);
    res.status(500).json({ error: 'Failed to reconcile orders' });
  }
});

// Export the router to be used in your main Express app
module.exports = router;