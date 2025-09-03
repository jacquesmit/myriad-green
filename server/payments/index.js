// Minimal payment provider factory. Currently returns Stripe provider.
// This creates a small seam so we can swap/add providers later with minimal changes.
module.exports.getProvider = function getProvider(name = 'stripe') {
  switch ((name || 'stripe').toLowerCase()) {
    case 'stripe':
    default:
      // Lazy-require to avoid loading when not needed
      return require('./stripeProvider');
  }
};
