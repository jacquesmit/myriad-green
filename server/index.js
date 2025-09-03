// Load environment variables from .env
require('dotenv').config();

// Import modules
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require('./firebase'); // Unified Firebase Admin init
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');


// Route imports
const createCheckoutSession = require('./routes/create-checkout-session');
const stripeWebhookHandler = require('./routes/stripe-webhook');
const calendarRoute = require('./routes/calendar');
const weatherRoute = require('./routes/weather');
const orderRoute = require('./routes/order');
const trendsRoute = require('./routes/trends');

const app = express();

// Prefer strong ETags globally
app.set('etag', 'strong');

// Append SWR hints for GET responses that already define Cache-Control
app.use((req, res, next) => {
  if (req.method === 'GET') {
    const existing = res.get('Cache-Control');
    if (existing && !/stale-while-revalidate/i.test(existing)) {
      res.set('Cache-Control', existing + ', stale-while-revalidate=60, stale-if-error=600');
    }
  }
  next();
});

// Enable CORS for local dev (localhost + private LAN IPs)
app.use((req, res, next) => {
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      try {
        const u = new URL(origin);
        const host = u.hostname;
        const isLocalHost = host === 'localhost' || host === '127.0.0.1';
        const isLan = /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
        if (isLocalHost || isLan) return callback(null, true);
      } catch {}
      return callback(new Error('CORS not allowed for origin: ' + origin));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })(req, res, (err) => {
    if (err) return res.status(403).json({ error: err.message });
    next();
  });
});

// Basic error handler (JSON)
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Middleware
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }));

// URL normalization for shop product pages BEFORE static handling
// 301 redirect /shop/:slug.html -> /shop/:slug
app.get('/shop/:slug.html', (req, res) => {
  res.redirect(301, `/shop/${req.params.slug}`);
});
// 301 redirect /shop/:slug/ -> /shop/:slug (but skip if it's a real directory with index.html)
app.get('/shop/:slug/', (req, res, next) => {
  try {
    const slug = req.params.slug;
    const dirPath = path.join(__dirname, '..', 'shop', slug);
    const indexFile = path.join(dirPath, 'index.html');
    if (fs.existsSync(indexFile)) {
      // It's a directory section like /shop/irrigation/ — let static serve it to avoid loops
      return next();
    }
    return res.redirect(301, `/shop/${slug}`);
  } catch {
    return res.redirect(301, `/shop/${req.params.slug}`);
  }
});

// 301 redirect irrigation products legacy .html to folder canonical
// e.g. /irrigation/area/suburb/irrigation-products.html -> /irrigation/area/suburb/irrigation-products/
app.get(/^\/irrigation\/([^/]+)\/([^/]+)\/irrigation-products\.html$/i, (req, res, next) => {
  try {
    const m = req.path.match(/^\/irrigation\/([^/]+)\/([^/]+)\/irrigation-products\.html$/i);
    if (m) {
      const area = m[1];
      const suburb = m[2];
      const indexPath = path.join(__dirname, '..', 'irrigation', area, suburb, 'irrigation-products', 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.redirect(301, `/irrigation/${area}/${suburb}/irrigation-products/`);
      }
      // No folder canonical exists; fall through to static .html
      return next();
    }
  } catch {}
  return next();
});

// 301 redirect irrigation keyword pages legacy .html to folder canonical
// e.g. /irrigation/:area/:suburb/sprinkler-repair.html -> /irrigation/:area/:suburb/sprinkler-repair/
app.get(/^\/irrigation\/([^/]+)\/([^/]+)\/([a-z0-9-]+)\.html$/i, (req, res, next) => {
  try {
    const m = req.path.match(/^\/irrigation\/([^/]+)\/([^/]+)\/([a-z0-9-]+)\.html$/i);
    if (m) {
      const area = m[1];
      const suburb = m[2];
      const keyword = m[3];
      const indexPath = path.join(__dirname, '..', 'irrigation', area, suburb, keyword, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.redirect(301, `/irrigation/${area}/${suburb}/${keyword}/`);
      }
      return next();
    }
  } catch {}
  return next();
});

// 301 redirects for other verticals' legacy keyword .html to folder canonical (only if folder exists)
// Verticals: boreholes, pumps, water-storage-tanks, rain-water-harvesting, water-filtration, leak-detection, landscaping, grey-water-systems, waste-water-systems
app.get(/^\/(boreholes|pumps|water-storage-tanks|rain-water-harvesting|water-filtration|leak-detection|landscaping|grey-water-systems|waste-water-systems)\/([^/]+)\/([^/]+)\/([a-z0-9-]+)\.html$/i, (req, res, next) => {
  try {
    const [ , vertical, area, suburb, keyword ] = req.params;
    const indexPath = path.join(__dirname, '..', vertical, area, suburb, keyword, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.redirect(301, `/${vertical}/${area}/${suburb}/${keyword}/`);
    }
    return next();
  } catch {}
  return next();
});

// 🔧 Serve static files (HTML, CSS, etc.) from repo root with SWR headers
app.use(express.static(path.join(__dirname, '../'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const existing = res.getHeader('Cache-Control');
    if (existing) {
      const ex = String(existing);
      if (!/stale-while-revalidate/i.test(ex)) {
        res.setHeader('Cache-Control', ex + ', stale-while-revalidate=60, stale-if-error=600');
      }
    } else {
      const isHtml = /\.html$/i.test(filePath);
      const base = isHtml ? 'public, max-age=0' : 'public, max-age=86400, immutable';
      res.setHeader('Cache-Control', base + ', stale-while-revalidate=60, stale-if-error=600');
    }

    // Strong ETag for HTML files (fingerprint of content)
    if (/\.html$/i.test(filePath)) {
      try {
        const buf = fs.readFileSync(filePath);
        const h = crypto.createHash('sha256').update(buf).digest('hex');
        res.setHeader('ETag', '"' + h + '"');
      } catch {}
    }
  }
})); // ← this is where thank-you-order.html must be

// ✅ Use shared Firebase Admin instance
const db = admin.firestore();


// ✅ Mount checkout session route
app.use('/create-checkout-session', createCheckoutSession);

// ✅ Stripe webhook (must use raw body) — mount BEFORE any body parsers for safety
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    await stripeWebhookHandler(req, res);
  } catch (e) {
    next(e);
  }
});

// ✅ Mount calendar route for Google Calendar integration
app.use('/api', calendarRoute);
app.use('/api', weatherRoute);
app.use('/order', orderRoute);
app.use('/api/trends', trendsRoute);

// SEO + Caching: extensionless shop routes with strong ETag and Last-Modified
app.get('/shop/:slug', (req, res, next) => {
  try {
    const slug = req.params.slug;
    const file = path.join(__dirname, '..', 'shop', `${slug}.html`);
    if (!fs.existsSync(file)) return next();

    // Canonical (strip query)
    const canonical = `/shop/${slug}`;
    res.set('Link', `<${canonical}>; rel=canonical`);

    // Product meta hook: include version to invalidate cache on price/stock change
    const metaPath = path.join(__dirname, '..', 'data', 'product-meta.json');
    let version = '';
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {};
        version = (meta[slug] && (meta[slug].version || meta[slug].updatedAt || '')) || '';
      } catch {}
    }

    // Compute strong ETag from file content + version
    const content = fs.readFileSync(file);
    const hash = crypto
      .createHash('sha256')
      .update(content)
      .update(String(version))
      .digest('hex');
    const etag = '"' + hash + '"';

    // Last-Modified from file mtime (fallback)
    const stat = fs.statSync(file);
    const lastModified = stat.mtime.toUTCString();

    // Headers: short TTL + SWR for snappy reloads
    res.set('ETag', etag);
    res.set('Last-Modified', lastModified);
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60, stale-if-error=600');

    // Conditional requests: ETag first, then Last-Modified
    const inm = req.headers['if-none-match'];
    if (inm) {
      const tags = inm.split(',').map(s => s.trim());
      const match = tags.some(t => t.replace(/^W\//, '') === etag);
      if (match) {
        return res.status(304).end();
      }
    }
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince) {
      const since = new Date(ifModifiedSince).getTime();
      if (!Number.isNaN(since) && stat.mtime.getTime() <= since) {
        return res.status(304).end();
      }
    }

    // Send body when changed
    res.type('html').send(content);
  } catch (err) {
    return next(err);
  }
});

// Optional route — save extra client info to Firestore
app.post('/save-client-data', async (req, res) => {
  try {
    const { name, email, phone, address, cart } = req.body;

    if (!name || !email || !phone || !address || !cart) {
      return res.status(400).json({ error: 'Missing required fields (name, email, phone, address, cart)' });
    }

    const clientData = {
      name,
      email,
      phone,
      address,
      cart,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('clients').add(clientData);
    res.status(200).json({ message: 'Client data saved successfully', id: docRef.id });
  } catch (error) {
    console.error('Error saving client data:', error);
    res.status(500).json({ error: 'Failed to save client data' });
  }
});

// 🔥 Start the backend server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
});
