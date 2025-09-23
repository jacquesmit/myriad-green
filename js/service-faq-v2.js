/**
 * PRODUCTION-GRADE FAQ CARDS JAVASCRIPT v2.0
 * Bulletproof functionality for custom FAQ card implementation
 * Built for accessibility, performance, and cross-browser compatibility
 */

class ProductionFAQ {
  constructor() {
    this.init();
  }

  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    // Core elements
    this.faqList = document.getElementById('faq-list');
    this.searchInput = document.getElementById('faq-search');
    this.searchClear = document.querySelector('.faq__search-clear');
    this.searchResults = document.getElementById('faq-search-results');
    this.resultCount = document.getElementById('faq-result-count');
    this.categoryButtons = document.querySelectorAll('.faq__category-btn');
    
    // FAQ cards
    this.faqCards = document.querySelectorAll('.faq-card');
    this.faqToggleButtons = document.querySelectorAll('[data-faq-toggle]');
    
    // State management
    this.activeCategory = 'all';
    this.searchTerm = '';
    this.openCards = new Set();
    
    // Initialize features
    this.setupFAQToggle();
    this.setupSearch();
    this.setupCategoryFilter();
    this.setupKeyboardNavigation();
    this.setupAnalytics();
    
    // Initial state
    this.updateDisplay();
    
    console.log('Production FAQ v2.0 initialized successfully');
  }

  /**
   * FAQ Card Toggle Functionality
   * Replaces browser default details/summary behavior
   */
  setupFAQToggle() {
    this.faqToggleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleFAQCard(button);
      });
      
      // Keyboard support
      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggleFAQCard(button);
        }
      });
    });
  }

  toggleFAQCard(button) {
    const card = button.closest('.faq-card');
    const content = button.getAttribute('aria-controls');
    const contentElement = document.getElementById(content);
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    const cardId = content.replace('faq-content-', '');
    
    if (isExpanded) {
      // Close card
      this.closeFAQCard(card, button, contentElement, cardId);
    } else {
      // Open card
      this.openFAQCard(card, button, contentElement, cardId);
    }
    
    // Analytics tracking
    this.trackFAQInteraction(cardId, !isExpanded);
  }

  openFAQCard(card, button, contentElement, cardId) {
    // Update ARIA attributes
    button.setAttribute('aria-expanded', 'true');
    
    // Add visual state
    card.classList.add('is-expanded');
    
    // Smooth expand animation
    const height = contentElement.scrollHeight;
    contentElement.style.maxHeight = height + 'px';
    
    // Track open state
    this.openCards.add(cardId);
    
    // Scroll into view if needed (with offset for fixed headers)
    setTimeout(() => {
      const rect = card.getBoundingClientRect();
      const offset = 100; // Account for fixed navigation
      
      if (rect.top < offset) {
        const scrollTop = window.pageYOffset + rect.top - offset;
        window.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
      }
    }, 300);
  }

  closeFAQCard(card, button, contentElement, cardId) {
    // Update ARIA attributes
    button.setAttribute('aria-expanded', 'false');
    
    // Remove visual state
    card.classList.remove('is-expanded');
    
    // Smooth collapse animation
    contentElement.style.maxHeight = '0px';
    
    // Track closed state
    this.openCards.delete(cardId);
  }

  /**
   * Search Functionality
   */
  setupSearch() {
    if (!this.searchInput) return;
    
    // Search input handling
    this.searchInput.addEventListener('input', debounce((e) => {
      this.searchTerm = e.target.value.toLowerCase().trim();
      this.updateDisplay();
      this.updateSearchResults();
    }, 200));
    
    // Clear search
    if (this.searchClear) {
      this.searchClear.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchTerm = '';
        this.updateDisplay();
        this.updateSearchResults();
        this.searchInput.focus();
      });
    }
    
    // Search keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Focus search with Ctrl+F or Cmd+F (if not already focused)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && document.activeElement !== this.searchInput) {
        e.preventDefault();
        this.searchInput.focus();
      }
      
      // Clear search with Escape
      if (e.key === 'Escape' && document.activeElement === this.searchInput) {
        this.searchInput.value = '';
        this.searchTerm = '';
        this.updateDisplay();
        this.updateSearchResults();
      }
    });
  }

  updateSearchResults() {
    if (!this.searchResults || !this.resultCount) return;
    
    const visibleCards = Array.from(this.faqCards).filter(card => 
      card.style.display !== 'none'
    );
    
    const count = visibleCards.length;
    this.resultCount.textContent = count;
    
    if (this.searchTerm) {
      this.searchResults.style.display = 'block';
      this.searchResults.setAttribute('aria-live', 'polite');
    } else {
      this.searchResults.style.display = 'none';
    }
  }

  /**
   * Category Filtering
   */
  setupCategoryFilter() {
    this.categoryButtons.forEach(button => {
      button.addEventListener('click', () => {
        const category = button.getAttribute('data-category');
        this.setActiveCategory(category);
        
        // Update button states
        this.categoryButtons.forEach(btn => {
          btn.classList.remove('faq__category-btn--active');
          btn.setAttribute('aria-selected', 'false');
        });
        
        button.classList.add('faq__category-btn--active');
        button.setAttribute('aria-selected', 'true');
        
        this.updateDisplay();
        this.trackCategoryFilter(category);
      });
    });
  }

  setActiveCategory(category) {
    this.activeCategory = category;
  }

  /**
   * Display Update Logic
   */
  updateDisplay() {
    let visibleCount = 0;
    
    this.faqCards.forEach(card => {
      const category = card.getAttribute('data-category');
      const questionText = card.querySelector('.faq-card__question').textContent.toLowerCase();
      const answerText = card.querySelector('.faq-card__answer').textContent.toLowerCase();
      
      // Category filter
      const categoryMatch = this.activeCategory === 'all' || category === this.activeCategory;
      
      // Search filter
      const searchMatch = !this.searchTerm || 
        questionText.includes(this.searchTerm) || 
        answerText.includes(this.searchTerm);
      
      if (categoryMatch && searchMatch) {
        card.style.display = 'block';
        card.style.animation = `fadeInUp 0.4s ease ${visibleCount * 0.1}s both`;
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });
    
    // Update search results
    this.updateSearchResults();
    
    // Show/hide no results message
    this.handleNoResults(visibleCount);
  }

  handleNoResults(visibleCount) {
    let noResultsElement = document.querySelector('.faq__no-results');
    
    if (visibleCount === 0) {
      if (!noResultsElement) {
        noResultsElement = document.createElement('div');
        noResultsElement.className = 'faq__no-results';
        noResultsElement.innerHTML = `
          <div class="faq__no-results-content">
            <i class="fas fa-search" aria-hidden="true"></i>
            <h3>No questions found</h3>
            <p>Try adjusting your search terms or selecting a different category.</p>
            <button type="button" class="faq__reset-filters" onclick="productionFAQ.resetFilters()">
              Clear all filters
            </button>
          </div>
        `;
        this.faqList.appendChild(noResultsElement);
      }
      noResultsElement.style.display = 'block';
    } else if (noResultsElement) {
      noResultsElement.style.display = 'none';
    }
  }

  resetFilters() {
    // Reset search
    if (this.searchInput) {
      this.searchInput.value = '';
      this.searchTerm = '';
    }
    
    // Reset category
    this.activeCategory = 'all';
    this.categoryButtons.forEach(btn => {
      btn.classList.remove('faq__category-btn--active');
      btn.setAttribute('aria-selected', 'false');
    });
    
    const allButton = document.querySelector('[data-category="all"]');
    if (allButton) {
      allButton.classList.add('faq__category-btn--active');
      allButton.setAttribute('aria-selected', 'true');
    }
    
    this.updateDisplay();
  }

  /**
   * Keyboard Navigation
   */
  setupKeyboardNavigation() {
    // Arrow key navigation between FAQ cards
    this.faqToggleButtons.forEach((button, index) => {
      button.addEventListener('keydown', (e) => {
        let targetIndex;
        
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            targetIndex = (index + 1) % this.faqToggleButtons.length;
            this.faqToggleButtons[targetIndex].focus();
            break;
            
          case 'ArrowUp':
            e.preventDefault();
            targetIndex = index === 0 ? this.faqToggleButtons.length - 1 : index - 1;
            this.faqToggleButtons[targetIndex].focus();
            break;
            
          case 'Home':
            e.preventDefault();
            this.faqToggleButtons[0].focus();
            break;
            
          case 'End':
            e.preventDefault();
            this.faqToggleButtons[this.faqToggleButtons.length - 1].focus();
            break;
        }
      });
    });
  }

  /**
   * Analytics and Tracking
   */
  setupAnalytics() {
    // Track initial page load
    this.trackEvent('faq_page_loaded', {
      total_questions: this.faqCards.length,
      categories: Array.from(new Set(Array.from(this.faqCards).map(card => 
        card.getAttribute('data-category')
      )))
    });
  }

  trackFAQInteraction(questionId, isOpened) {
    this.trackEvent('faq_interaction', {
      question_id: questionId,
      action: isOpened ? 'opened' : 'closed',
      search_term: this.searchTerm,
      active_category: this.activeCategory
    });
  }

  trackCategoryFilter(category) {
    this.trackEvent('faq_category_filter', {
      category: category,
      search_term: this.searchTerm
    });
  }

  trackEvent(eventName, data) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, data);
    }
    
    // Custom analytics
    if (typeof analytics !== 'undefined') {
      analytics.track(eventName, data);
    }
    
    // Console logging for development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('FAQ Analytics:', eventName, data);
    }
  }

  /**
   * Public API Methods
   */
  openQuestion(questionId) {
    const button = document.getElementById(`faq-button-${questionId}`);
    if (button && button.getAttribute('aria-expanded') === 'false') {
      this.toggleFAQCard(button);
    }
  }

  closeAllQuestions() {
    this.faqToggleButtons.forEach(button => {
      if (button.getAttribute('aria-expanded') === 'true') {
        this.toggleFAQCard(button);
      }
    });
  }

  searchFor(term) {
    if (this.searchInput) {
      this.searchInput.value = term;
      this.searchTerm = term.toLowerCase().trim();
      this.updateDisplay();
      this.updateSearchResults();
    }
  }
}

/**
 * Utility Functions
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Initialize FAQ on page load
 */
let productionFAQ;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    productionFAQ = new ProductionFAQ();
  });
} else {
  productionFAQ = new ProductionFAQ();
}

/**
 * CSS Animations
 */
const faqAnimationCSS = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.faq__no-results {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--color-subheading);
}

.faq__no-results-content i {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.faq__no-results-content h3 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--color-heading);
}

.faq__no-results-content p {
  margin-bottom: 1.5rem;
  font-size: 1rem;
}

.faq__reset-filters {
  background: var(--gold-light);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.faq__reset-filters:hover {
  background: var(--gold-dark);
  transform: translateY(-2px);
}
`;

// Inject animation CSS
const style = document.createElement('style');
style.textContent = faqAnimationCSS;
document.head.appendChild(style);