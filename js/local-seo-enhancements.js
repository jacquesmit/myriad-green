/**
 * Local SEO Enhancements JavaScript
 * Provides dynamic functionality for location-specific service pages
 * Enhances user experience and SEO performance
 */

class LocalSEOEnhancements {
  constructor() {
    this.init();
  }

  init() {
    this.setupBusinessHours();
    this.setupFAQInteractions();
    this.setupLocationTracking();
    this.setupResponseTimeUpdater();
    this.setupPriceCalculator();
  }

  /**
   * Display current business hours and highlight current day
   */
  setupBusinessHours() {
    const businessHours = {
      'Monday': '07:00 - 17:00',
      'Tuesday': '07:00 - 17:00', 
      'Wednesday': '07:00 - 17:00',
      'Thursday': '07:00 - 17:00',
      'Friday': '07:00 - 17:00',
      'Saturday': '08:00 - 14:00',
      'Sunday': 'Emergency Only'
    };

    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const hoursElements = document.querySelectorAll('.hours-time');
    
    hoursElements.forEach(element => {
      const dayElement = element.parentNode.querySelector('.hours-day');
      if (dayElement && dayElement.textContent.trim() === currentDay) {
        element.classList.add('current-day');
      }
    });

    // Add "Open Now" or "Closed" indicator
    this.addOpenStatusIndicator(businessHours, currentDay);
  }

  /**
   * Add open/closed status indicator
   */
  addOpenStatusIndicator(businessHours, currentDay) {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const todayHours = businessHours[currentDay];
    
    let isOpen = false;
    if (todayHours && todayHours !== 'Emergency Only') {
      const [startTime, endTime] = todayHours.split(' - ');
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const openTime = startHour * 100 + startMin;
      const closeTime = endHour * 100 + endMin;
      
      isOpen = currentTime >= openTime && currentTime < closeTime;
    }

    // Create status indicator
    const statusIndicator = document.createElement('div');
    statusIndicator.className = `business-status ${isOpen ? 'open' : 'closed'}`;
    statusIndicator.innerHTML = `
      <i class="fas ${isOpen ? 'fa-clock' : 'fa-phone-alt'}"></i>
      <span>${isOpen ? 'Open Now' : '24/7 Emergency Service'}</span>
    `;

    // Add to hero section if it exists
    const heroSection = document.querySelector('.hero-benefits');
    if (heroSection) {
      heroSection.appendChild(statusIndicator);
    }
  }

  /**
   * Setup interactive FAQ section
   */
  setupFAQInteractions() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
      question.addEventListener('click', () => {
        const answer = question.nextElementSibling;
        const icon = question.querySelector('.faq-icon');
        const isExpanded = question.getAttribute('aria-expanded') === 'true';
        
        // Close all other FAQs
        faqQuestions.forEach(q => {
          if (q !== question) {
            q.setAttribute('aria-expanded', 'false');
            q.nextElementSibling.classList.remove('active');
          }
        });
        
        // Toggle current FAQ
        question.setAttribute('aria-expanded', !isExpanded);
        answer.classList.toggle('active');
        
        // Smooth scroll to question if opening
        if (!isExpanded) {
          setTimeout(() => {
            question.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest' 
            });
          }, 150);
        }
      });
    });
  }

  /**
   * Track user location and update response times
   */
  setupLocationTracking() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.updateResponseTimes(position.coords);
        },
        (error) => {
          console.log('Location access denied or unavailable');
        },
        {
          timeout: 5000,
          maximumAge: 300000 // 5 minutes
        }
      );
    }
  }

  /**
   * Update response times based on user location
   */
  updateResponseTimes(coords) {
    // Define service area coordinates (example: Pretoria center)
    const serviceCenter = {
      lat: -25.7479,
      lng: 28.2293
    };

    const distance = this.calculateDistance(
      coords.latitude, 
      coords.longitude,
      serviceCenter.lat,
      serviceCenter.lng
    );

    // Update response time displays
    const responseTimeElements = document.querySelectorAll('.response-time');
    responseTimeElements.forEach(element => {
      const baseTime = this.extractTimeFromText(element.textContent);
      const adjustedTime = this.adjustResponseTime(baseTime, distance);
      element.textContent = adjustedTime;
      
      // Update color based on time
      element.setAttribute('data-time', this.getTimeCategory(adjustedTime));
    });
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  /**
   * Extract time from response time text
   */
  extractTimeFromText(text) {
    const match = text.match(/(\d+)-(\d+)/);
    if (match) {
      return {
        min: parseInt(match[1]),
        max: parseInt(match[2])
      };
    }
    return { min: 30, max: 45 }; // default
  }

  /**
   * Adjust response time based on distance
   */
  adjustResponseTime(baseTime, distance) {
    let adjustment = 0;
    
    if (distance > 20) adjustment = 15; // Far areas
    else if (distance > 10) adjustment = 5; // Medium distance
    
    const newMin = baseTime.min + adjustment;
    const newMax = baseTime.max + adjustment;
    
    return `${newMin}-${newMax} min response`;
  }

  /**
   * Get time category for styling
   */
  getTimeCategory(timeText) {
    const maxTime = parseInt(timeText.match(/(\d+) min/)[1]);
    if (maxTime <= 35) return 'fast';
    if (maxTime <= 50) return 'medium';
    return 'slow';
  }

  /**
   * Setup dynamic response time updater
   */
  setupResponseTimeUpdater() {
    // Update response times every 15 minutes during business hours
    setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Only update during business hours (7 AM - 6 PM)
      if (currentHour >= 7 && currentHour < 18) {
        this.updateTrafficBasedTimes();
      }
    }, 15 * 60 * 1000);
  }

  /**
   * Update response times based on traffic patterns
   */
  updateTrafficBasedTimes() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    let trafficMultiplier = 1;
    
    // Rush hour adjustments
    if ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)) {
      trafficMultiplier = 1.3;
    }
    
    // Weekend adjustments
    if (currentDay === 0 || currentDay === 6) {
      trafficMultiplier = 0.9;
    }
    
    const responseElements = document.querySelectorAll('.response-time');
    responseElements.forEach(element => {
      const originalTime = element.dataset.originalTime || element.textContent;
      if (!element.dataset.originalTime) {
        element.dataset.originalTime = originalTime;
      }
      
      const baseTime = this.extractTimeFromText(originalTime);
      const adjustedMin = Math.round(baseTime.min * trafficMultiplier);
      const adjustedMax = Math.round(baseTime.max * trafficMultiplier);
      
      element.textContent = `${adjustedMin}-${adjustedMax} min response`;
      element.setAttribute('data-time', this.getTimeCategory(element.textContent));
    });
  }

  /**
   * Setup price calculator for location-specific services
   */
  setupPriceCalculator() {
    const priceElements = document.querySelectorAll('.price-indicator');
    
    priceElements.forEach(element => {
      element.addEventListener('click', () => {
        this.showPriceBreakdown(element);
      });
      
      // Make price indicators focusable and accessible
      element.setAttribute('tabindex', '0');
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', 'Click for detailed pricing breakdown');
      
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.showPriceBreakdown(element);
        }
      });
    });
  }

  /**
   * Show detailed price breakdown
   */
  showPriceBreakdown(priceElement) {
    const service = priceElement.closest('.service-item')?.querySelector('h3')?.textContent || 'Service';
    
    const breakdown = {
      'Electronic Acoustic Detection': {
        'Call-out fee': 'R250',
        'Basic detection (up to 1 hour)': 'R500',
        'Extended detection (per additional hour)': 'R300',
        'Report and recommendations': 'R200'
      },
      'Thermal Imaging Detection': {
        'Call-out fee': 'R300',
        'Thermal imaging service (up to 2 hours)': 'R700',
        'Extended service (per additional hour)': 'R400',
        'Detailed thermal report': 'R300'
      },
      'Pressure Testing': {
        'Call-out fee': 'R200',
        'System pressure test': 'R300',
        'Leak isolation testing': 'R200',
        'Compliance certificate': 'R150'
      }
    };
    
    const serviceKey = Object.keys(breakdown).find(key => 
      service.toLowerCase().includes(key.toLowerCase().split(' ')[0])
    ) || Object.keys(breakdown)[0];
    
    this.displayPriceModal(serviceKey, breakdown[serviceKey]);
  }

  /**
   * Display price breakdown modal
   */
  displayPriceModal(serviceName, priceBreakdown) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'price-modal-overlay';
    modal.innerHTML = `
      <div class="price-modal">
        <div class="price-modal-header">
          <h3>${serviceName} - Pricing Breakdown</h3>
          <button class="close-modal" aria-label="Close pricing breakdown">×</button>
        </div>
        <div class="price-modal-content">
          <div class="price-breakdown">
            ${Object.entries(priceBreakdown).map(([item, price]) => `
              <div class="price-item">
                <span class="price-item-name">${item}</span>
                <span class="price-item-cost">${price}</span>
              </div>
            `).join('')}
          </div>
          <div class="price-modal-footer">
            <p><strong>Note:</strong> Prices may vary based on complexity and location within service area.</p>
            <button class="btn btn-primary get-quote-btn">Get Accurate Quote</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup modal interactions
    const closeBtn = modal.querySelector('.close-modal');
    const getQuoteBtn = modal.querySelector('.get-quote-btn');
    
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    getQuoteBtn.addEventListener('click', () => {
      // Trigger booking modal with pre-filled service
      const bookingBtn = document.querySelector('.open-modal-btn');
      if (bookingBtn) {
        bookingBtn.click();
      }
      modal.remove();
    });
    
    // Focus management
    setTimeout(() => {
      closeBtn.focus();
    }, 100);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LocalSEOEnhancements();
});

// Add required CSS for price modal
const modalCSS = `
<style>
.price-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
}

.price-modal {
  background: white;
  border-radius: var(--border-radius-lg, 12px);
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.price-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.price-modal-header h3 {
  margin: 0;
  color: var(--color-gray-900, #111827);
  font-size: 1.25rem;
  font-weight: 600;
}

.close-modal {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-modal:hover {
  background: #f3f4f6;
}

.price-modal-content {
  padding: 1.5rem;
}

.price-breakdown {
  margin-bottom: 1.5rem;
}

.price-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.price-item:last-child {
  border-bottom: none;
}

.price-item-name {
  color: #4b5563;
}

.price-item-cost {
  font-weight: 600;
  color: var(--location-primary, #2d7a2d);
}

.price-modal-footer {
  border-top: 1px solid #e5e7eb;
  padding-top: 1.5rem;
  text-align: center;
}

.price-modal-footer p {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
}

.business-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-top: 0.5rem;
}

.business-status.open {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.business-status.closed {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

[data-theme="dark"] .price-modal {
  background: var(--color-gray-800, #1f2937);
  color: var(--color-gray-100, #f3f4f6);
}

[data-theme="dark"] .price-modal-header {
  border-color: var(--color-gray-600, #4b5563);
}

[data-theme="dark"] .price-item {
  border-color: var(--color-gray-600, #4b5563);
}

[data-theme="dark"] .price-modal-footer {
  border-color: var(--color-gray-600, #4b5563);
}

@media (max-width: 480px) {
  .price-modal {
    margin: 1rem;
    max-height: 90vh;
  }
  
  .price-modal-header,
  .price-modal-content {
    padding: 1rem;
  }
}
</style>
`;

// Inject modal CSS
document.head.insertAdjacentHTML('beforeend', modalCSS);