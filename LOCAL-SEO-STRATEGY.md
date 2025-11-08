# Local SEO Service Pages Implementation Plan

## Strategy: Service-Location URL Structure

### Primary Benefits
- **SEO Value:** Each page targets specific "service + location" keywords
- **User Intent:** Matches how people search ("leak detection Pretoria")
- **Authority Building:** Multiple pages targeting related keywords
- **Local Rankings:** Improved local search visibility

### URL Structure Plan

#### Leak Detection Service Locations
- `services/leak-detection-pretoria.html` - Main Pretoria targeting
- `services/leak-detection-johannesburg.html` - Johannesburg central
- `services/leak-detection-sandton.html` - Sandton business district
- `services/leak-detection-centurion.html` - Centurion area
- `services/leak-detection-fourways.html` - Fourways/Midrand
- `services/leak-detection-roodepoort.html` - West Rand area

#### Irrigation Service Locations
- `services/irrigation-pretoria.html`
- `services/irrigation-johannesburg.html`
- `services/irrigation-sandton.html`
- `services/irrigation-centurion.html`
- `services/irrigation-fourways.html`
- `services/irrigation-roodepoort.html`

#### Backup Water Systems Locations
- `services/backup-water-systems-pretoria.html`
- `services/backup-water-systems-johannesburg.html`
- (etc.)

#### Drain Unblocking Locations
- `services/drain-unblocking-pretoria.html`
- `services/drain-unblocking-johannesburg.html`
- (etc.)

### SEO Implementation Requirements

#### Meta Title Optimization
```html
<title>Leak Detection Services in Pretoria | Myriad Green</title>
<title>Professional Irrigation Installation Sandton | Myriad Green</title>
```

#### Meta Description Templates
```html
<meta name="description" content="Expert leak detection services in Pretoria. Electronic leak detection, pressure testing & thermal imaging. Call 087 760 0222 for same-day service in Pretoria & surrounding areas." />
```

#### H1 Heading Structure
```html
<h1>Professional Leak Detection Services in Pretoria</h1>
<h2>Why Choose Myriad Green for Leak Detection in Pretoria?</h2>
```

#### Local Schema Markup
```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Leak Detection Services",
  "provider": {
    "@type": "LocalBusiness",
    "name": "Myriad Green",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Pretoria",
      "addressRegion": "Gauteng",
      "addressCountry": "South Africa"
    }
  },
  "areaServed": "Pretoria"
}
```

### Content Strategy

#### Location-Specific Content Elements
1. **Local Service Areas:** "We service Pretoria East, Pretoria West, Brooklyn, Hatfield..."
2. **Local Landmarks:** "Near Menlyn Mall, University of Pretoria, Union Buildings..."
3. **Travel Time:** "45-minute response time within Pretoria metropolitan area"
4. **Local Challenges:** "Clay soil common in Pretoria requires specialized leak detection..."
5. **Case Studies:** "Recent successful leak detection project in Waterkloof..."

#### Keyword Targeting Per Page
**Primary Keywords:**
- leak detection Pretoria
- leak detection services Pretoria
- water leak detection Pretoria

**Secondary Keywords:**
- Pretoria leak detection company
- electronic leak detection Pretoria
- pipe leak detection Pretoria
- underground leak detection Pretoria

**Long-tail Keywords:**
- professional leak detection services in Pretoria
- same day leak detection Pretoria
- thermal imaging leak detection Pretoria

### Technical Implementation

#### Internal Linking Strategy
```html
<!-- From main service page -->
<a href="services/leak-detection-pretoria.html">Leak Detection in Pretoria</a>
<a href="services/leak-detection-johannesburg.html">Leak Detection in Johannesburg</a>

<!-- Cross-service linking -->
<a href="services/irrigation-pretoria.html">Irrigation Services in Pretoria</a>
```

#### Breadcrumb Structure
```html
Home > Services > Leak Detection > Pretoria
```

#### Canonical URLs
```html
<link rel="canonical" href="https://myriadgreen.co.za/services/leak-detection-pretoria.html" />
```

### File Organization

#### Directory Structure
```
services/
├── leak-detection.html (main service page)
├── leak-detection-pretoria.html
├── leak-detection-johannesburg.html
├── leak-detection-sandton.html
├── irrigation.html (main service page)
├── irrigation-pretoria.html
├── irrigation-johannesburg.html
└── ...
```

#### CSS Organization
```
css/
├── service-location-pages.css (shared styles)
├── local-seo-components.css (location-specific elements)
└── area-map-integration.css (Google Maps styling)
```

### Content Template Structure

#### Page Sections
1. **Hero Section** - Location-specific headline and CTA
2. **Service Overview** - Tailored to local needs
3. **Service Areas Map** - Interactive map showing coverage
4. **Local Testimonials** - Reviews from that specific area
5. **Emergency Contact** - Location-specific response times
6. **FAQ Section** - Local regulation and soil condition questions
7. **Related Services** - Cross-linking to other services in same area

### Automation Opportunities

#### Template-Based Generation
- Create base template for each service type
- Generate location variations with specific content blocks
- Maintain consistent structure while varying local content

#### Dynamic Content Blocks
- Location-specific emergency numbers
- Travel time calculations
- Local weather considerations
- Area-specific service challenges

### SEO Best Practices

#### Avoid Duplicate Content
- Unique content for each location (minimum 300-500 words unique)
- Different case studies and testimonials per location
- Varied service descriptions based on local conditions

#### Local Citations
- Consistent NAP (Name, Address, Phone) across all pages
- Location-specific Google My Business integration
- Local directory submissions for each area

#### Performance Optimization
- Shared CSS and JavaScript across location pages
- Optimized images with location-specific alt text
- Fast loading times for mobile users

This structure will significantly improve local SEO rankings and help capture location-specific search traffic.