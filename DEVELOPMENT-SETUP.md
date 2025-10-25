# 🚀 Development Setup - Myriad Green

## ⚠️ CRITICAL: Always Start BOTH Servers

For the full-stack application to work properly, you **MUST** run both servers simultaneously:

### 1. Backend Server (Node.js/Express)
```bash
# Terminal 1: Backend API Server
cd /path/to/myriad-green
node server/index.js
```
- **Port**: `3000`
- **Purpose**: Handles API requests, Stripe checkout, Firebase operations
- **Status Check**: `http://localhost:3000`

### 2. Frontend Server (Live Server)
```bash
# VS Code: Start Live Server extension
# Or manual static server on port 5501
```
- **Port**: `5501` (VS Code Live Server)
- **Purpose**: Serves static HTML/CSS/JS files
- **URL**: `http://localhost:5501`

## 🔍 Common Issues & Solutions

### "Failed to fetch" Error
**Cause**: Frontend (5501) can't reach Backend (3000)
**Solution**: Ensure both servers are running

### "Unable to connect to remote server"
**Cause**: Backend server not listening on port 3000
**Solutions**:
1. Check for uncaught exceptions killing the server
2. Verify environment variables in `.env`
3. Check Firebase credentials in `server/serviceAccountKey.json`

### Empty Description Stripe Error
**Fixed**: `stripeProvider.js` now only includes description if non-empty
```javascript
// ❌ WRONG (causes Stripe error)
description: item.description || '',

// ✅ CORRECT (only add if exists)
if (item.description && item.description.trim()) {
  productData.description = item.description.trim();
}
```

## 🏗️ Architecture Overview

### Checkout Flows
1. **Products Checkout** (Shopping Cart)
   - No `bookingId` in request
   - Success: `/thank-you-order.html`
   - Cancel: `/checkout.html`

2. **Bookings Checkout** (Service Appointments)
   - With `bookingId` in request
   - Success: `/thank-you.html?bookingId=...`
   - Cancel: `/booking-page.html`

### API Endpoints
- `POST /create-checkout-session` - Handles both product and booking checkouts
- `POST /save-client-data` - Saves customer information to Firestore
- `POST /stripe/webhook` - Handles Stripe webhook events

## 🔧 Environment Requirements

### Required Files
- `.env` - Environment variables (Stripe keys, Firebase config)
- `server/serviceAccountKey.json` - Firebase service account credentials

### Key Environment Variables
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_CURRENCY=zar
BASE_URL=http://localhost:3000
PORT=3000
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
```

## 📋 Pre-Development Checklist

Before starting development:

- [ ] Both servers running (3000 + 5501)
- [ ] `.env` file configured
- [ ] Firebase credentials in place
- [ ] Stripe test keys active
- [ ] CORS configured for localhost

## 🎯 Testing Checklist

- [ ] Add product to cart works
- [ ] Cart modal opens/closes
- [ ] Checkout form validation
- [ ] Stripe redirection successful
- [ ] Booking modal functionality
- [ ] Service appointment flow

---

**Remember**: Full-stack = Full servers. Always run both! 🚀