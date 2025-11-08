# CSS & JavaScript Files Backup - November 8, 2025

## Overview
This document details all CSS and JavaScript files backed up for the stable state restoration.

## Core CSS Files (Referenced in index.html)

### Foundation Styles
- **reset.css** - CSS reset and normalization
- **theme.css** - Theme variables, light/dark mode definitions
- **utilities.css** - Utility classes and helpers
- **main.css** - Core layout and base styles

### Component Styles
- **service-card-section-indx.css** - Service cards on index page
- **brands-partners-section.css** - Brand/partner display sections
- **clients-section.css** - Client showcase and testimonials
- **custom-inline-fixes.css** - Custom fixes and overrides
- **service-svg-wrapper.css** - SVG icon wrapper styling

### Interactive & Animation Styles
- **animations.css** - Site-wide animations and transitions
- **why-choose-us.css** - "Why choose us" section styling
- **how-it-works.css** - Process/workflow section styling
- **how-it-works-custom.css** - Custom workflow enhancements
- **our-key-services.css** - Key services section styling
- **gauteng-map-section.css** - Geographic service area styling

### Button Components
- **css/components/buttons/cart-view-btn.css** - Shopping cart view button
- **css/components/buttons/cart-checkout -btn.css** - Checkout button (note: space in filename)
- **css/components/buttons/floating-contact-bar.css** - Floating contact bar

## Redesigned Page Styles (Production Ready)

### Modern Page Designs
- **privacy-policy-modern.css** - Privacy policy page redesign
- **contact-redesign.css** - Contact page modern UX
- **checkout-redesign.css** - Checkout page conversion optimization
- **cookie-notice-redesign.css** - Cookie notice modern design

## JavaScript Files

### Core Functionality
- **main.js** - Core site functionality and interactions
- **site-init.js** - Site initialization, component injection system
- **privacy-policy-interactive.js** - Privacy policy interactive features

## File Dependencies

### Critical Dependencies (Index Page)
These files are essential for the stable index.html to function correctly:
1. **Core CSS Stack:** reset.css → theme.css → utilities.css → main.css
2. **Component CSS:** service-card-section-indx.css, brands-partners-section.css
3. **Fixes:** custom-inline-fixes.css (important for stability)
4. **JavaScript:** site-init.js, main.js

### Working Page Dependencies
Each redesigned page has its dedicated CSS:
- Privacy Policy: privacy-policy-modern.css + privacy-policy-interactive.js
- Contact: contact-redesign.css + contact-redesign.js (not backed up - may need restoration)
- Checkout: checkout-redesign.css
- Cookie Notice: cookie-notice-redesign.css

## Known Issues with Backup

### Missing Files
- **contact-redesign.js** - May need to be restored separately
- **about-page-redesign.css** - About page redesign styles
- **booking-page-redesign.css** - Booking page redesign styles

### Filename Issues
- **cart-checkout -btn.css** - Has space in filename, may cause URL issues
- Should be renamed to **cart-checkout-btn.css** for consistency

## CSS Architecture Notes

### What Works (Preserved in Backup)
- ✅ Clean separation between core styles and component styles
- ✅ Proper CSS variable usage in theme.css
- ✅ Responsive design patterns consistent across files
- ✅ No conflicting selectors between major components

### What to Avoid (Lessons Learned)
- ❌ Putting hero section styles in service-specific CSS files
- ❌ Cross-contamination between component stylesheets
- ❌ Inline styles that override external CSS
- ❌ Breaking the CSS cascade with overly specific selectors

## Restoration Instructions

### Complete CSS Restore
```bash
# Copy all CSS files back
cp -r backups/2025-11-08-stable-state/css/ ./

# Copy JavaScript files back  
cp -r backups/2025-11-08-stable-state/js/ ./
```

### Selective CSS Restore
```bash
# Core styles only
cp backups/2025-11-08-stable-state/css/{reset,theme,utilities,main}.css css/

# Component styles
cp backups/2025-11-08-stable-state/css/service-card-section-indx.css css/
cp backups/2025-11-08-stable-state/css/brands-partners-section.css css/
```

### Fix Filename Issue
```bash
# Rename the problematic file
mv "css/cart-checkout -btn.css" "css/cart-checkout-btn.css"

# Update index.html reference
# Change: /css/components/buttons/cart-checkout -btn.css
# To: /css/components/buttons/cart-checkout-btn.css
```

## Quality Assurance

### Post-Restore Testing
After restoring CSS files, verify:
- [ ] Index page loads without console errors
- [ ] All sections render correctly (hero, services, brands, clients)
- [ ] Responsive design works across breakpoints
- [ ] Theme toggle functions properly
- [ ] Booking modals trigger correctly
- [ ] Cart functionality works
- [ ] Animations and transitions are smooth

### Performance Checks
- [ ] CSS files load in correct order
- [ ] No duplicate or conflicting styles
- [ ] Clean CSS architecture without violations
- [ ] Proper fallbacks for CSS variables

This backup ensures all critical styling and functionality can be restored exactly as it was in the stable state, providing a reliable foundation for future development.