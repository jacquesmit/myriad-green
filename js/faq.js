/**
 * Enhanced FAQ Section JavaScript
 * Interactive search, category filtering, and premium animations
 * Integrates with the gold premium styling system
 */

class FAQManager {
  constructor() {
    this.faqItems = [];
    this.searchInput = null;
    this.searchClearBtn = null;
    this.searchResults = null;
    this.categoryButtons = [];
    this.currentCategory = 'all';
    this.searchTerm = '';
    this.debounceTimer = null;

    this.init();
  }

  init() {
    console.log('FAQ Manager: Initializing...');
    this.cacheElements();
    this.bindEvents();
    this.initializeFAQItems();
    this.setupIntersectionObserver();
    console.log('FAQ Manager: Initialization complete');
  }

  cacheElements() {
    this.searchInput = document.querySelector('.faq__search-input');
    this.searchClearBtn = document.querySelector('.faq__search-clear');
    this.searchResults = document.querySelector('.faq__search-results');
    this.categoryButtons = document.querySelectorAll('.faq__category-btn');
    this.faqItems = document.querySelectorAll('.faq__item-wrapper');

    console.log('FAQ Manager: Elements cached', {
      searchInput: !!this.searchInput,
      searchClearBtn: !!this.searchClearBtn,
      searchResults: !!this.searchResults,
      categoryButtons: this.categoryButtons.length,
      faqItems: this.faqItems.length
    });
  }

  bindEvents() {
    // Search functionality
    if (this.searchInput) {
      this.searchInput.addEventListener('input', this.handleSearch.bind(this));
      this.searchInput.addEventListener('focus', this.handleSearchFocus.bind(this));
      this.searchInput.addEventListener('blur', this.handleSearchBlur.bind(this));
    }

    // Clear search button
    if (this.searchClearBtn) {
      this.searchClearBtn.addEventListener('click', this.clearSearch.bind(this));
    }

    // Category filtering
    this.categoryButtons.forEach(button => {
      button.addEventListener('click', this.handleCategoryFilter.bind(this));
    });

    // FAQ item interactions
    this.faqItems.forEach(item => {
      const details = item.querySelector('.faq__item');
      if (details) {
        details.addEventListener('toggle', this.handleFAQToggle.bind(this));
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', this.handleKeyboardNavigation.bind(this));
  }

  initializeFAQItems() {
    this.faqItems.forEach((item, index) => {
      // Add animation delay for staggered entrance
      item.style.animationDelay = `${index * 0.1}s`;

      // Set initial state
      item.setAttribute('data-visible', 'true');
      item.setAttribute('data-category', item.dataset.category || 'general');
    });
  }

  setupIntersectionObserver() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);

    this.faqItems.forEach(item => {
      observer.observe(item);
    });
  }

  handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    this.searchTerm = searchTerm;
    console.log('FAQ Manager: Search triggered', { searchTerm });

    // Debounce search for better performance
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.performSearch(searchTerm);
    }, 300);

    // Show/hide clear button
    this.toggleClearButton(searchTerm.length > 0);
  }

  performSearch(searchTerm) {
    console.log('FAQ Manager: Performing search', { searchTerm, currentCategory: this.currentCategory });
    let visibleCount = 0;

    this.faqItems.forEach(item => {
      const question = item.querySelector('.faq__question');
      const answer = item.querySelector('.faq__answer');
      const category = item.dataset.category || 'general';

      if (!question || !answer) return;

      const questionText = question.textContent.toLowerCase();
      const answerText = answer.textContent.toLowerCase();
      const categoryText = category.toLowerCase();

      // Check if item matches search term and current category filter
      const matchesSearch = !searchTerm ||
        questionText.includes(searchTerm) ||
        answerText.includes(searchTerm) ||
        categoryText.includes(searchTerm);

      const matchesCategory = this.currentCategory === 'all' ||
        category === this.currentCategory;

      const shouldShow = matchesSearch && matchesCategory;

      // Animate visibility change
      this.animateItemVisibility(item, shouldShow);

      if (shouldShow) {
        visibleCount++;
      }
    });

    console.log('FAQ Manager: Search results', { visibleCount, totalItems: this.faqItems.length });
    this.updateSearchResults(searchTerm, visibleCount);
  }

  animateItemVisibility(item, shouldShow) {
    if (shouldShow) {
      item.style.display = 'block';
      item.setAttribute('data-visible', 'true');

      // Stagger animation
      setTimeout(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, 50);
    } else {
      item.setAttribute('data-visible', 'false');

      // Animate out
      item.style.opacity = '0';
      item.style.transform = 'translateY(-20px)';

      setTimeout(() => {
        item.style.display = 'none';
      }, 300);
    }
  }

  handleCategoryFilter(event) {
    const button = event.currentTarget;
    const category = button.dataset.category || 'all';
    console.log('FAQ Manager: Category filter triggered', { category });

    // Update active button
    this.categoryButtons.forEach(btn => {
      btn.classList.remove('faq__category-btn--active');
    });
    button.classList.add('faq__category-btn--active');

    this.currentCategory = category;

    // Re-apply search with new category filter
    this.performSearch(this.searchTerm);

    // Add haptic feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  handleFAQToggle(event) {
    const details = event.currentTarget;
    const isOpen = details.open;

    // Close other FAQ items for better UX (optional)
    if (isOpen && this.shouldAutoClose()) {
      this.closeOtherFAQs(details);
    }

    // Track analytics if available
    if (window.gtag) {
      window.gtag('event', isOpen ? 'faq_expand' : 'faq_collapse', {
        event_category: 'engagement',
        event_label: details.querySelector('.faq__question').textContent
      });
    }

    // Add haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(isOpen ? 100 : 50);
    }
  }

  shouldAutoClose() {
    // Only auto-close on mobile devices for better UX
    return window.innerWidth <= 768;
  }

  closeOtherFAQs(currentDetails) {
    this.faqItems.forEach(item => {
      const details = item.querySelector('.faq__item');
      if (details && details !== currentDetails && details.open) {
        details.open = false;
      }
    });
  }

  clearSearch() {
    if (this.searchInput) {
      this.searchInput.value = '';
      this.searchTerm = '';
      this.performSearch('');
      this.toggleClearButton(false);
      this.searchInput.focus();
    }
  }

  toggleClearButton(show) {
    if (this.searchClearBtn) {
      this.searchClearBtn.style.display = show ? 'block' : 'none';
    }
  }

  updateSearchResults(searchTerm, visibleCount) {
    if (!this.searchResults) return;

    const resultCountSpan = document.getElementById('faq-result-count');
    if (!resultCountSpan) return;

    if (searchTerm.length > 0) {
      const totalItems = this.faqItems.length;
      resultCountSpan.textContent = `Showing ${visibleCount} of ${totalItems} FAQs for "${searchTerm}"`;
      this.searchResults.style.display = 'block';
    } else {
      this.searchResults.style.display = 'none';
    }
  }

  handleSearchFocus() {
    const searchWrapper = document.querySelector('.faq__search-wrapper');
    if (searchWrapper) {
      searchWrapper.classList.add('focused');
    }
  }

  handleSearchBlur() {
    const searchWrapper = document.querySelector('.faq__search-wrapper');
    if (searchWrapper) {
      searchWrapper.classList.remove('focused');
    }
  }

  handleKeyboardNavigation(event) {
    // ESC key to clear search
    if (event.key === 'Escape' && this.searchInput === document.activeElement) {
      this.clearSearch();
    }

    // Arrow keys for category navigation
    if (event.key.startsWith('Arrow') && this.categoryButtons.length > 0) {
      const currentIndex = Array.from(this.categoryButtons).findIndex(btn =>
        btn.classList.contains('faq__category-btn--active')
      );

      let newIndex = currentIndex;

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        newIndex = (currentIndex + 1) % this.categoryButtons.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        newIndex = currentIndex === 0 ? this.categoryButtons.length - 1 : currentIndex - 1;
      }

      if (newIndex !== currentIndex) {
        event.preventDefault();
        this.categoryButtons[newIndex].click();
        this.categoryButtons[newIndex].focus();
      }
    }
  }

  // Public API methods
  expandAll() {
    this.faqItems.forEach(item => {
      const details = item.querySelector('.faq__item');
      if (details && !details.open) {
        details.open = true;
      }
    });
  }

  collapseAll() {
    this.faqItems.forEach(item => {
      const details = item.querySelector('.faq__item');
      if (details && details.open) {
        details.open = false;
      }
    });
  }

  filterByCategory(category) {
    const button = Array.from(this.categoryButtons).find(btn =>
      btn.dataset.category === category
    );
    if (button) {
      button.click();
    }
  }

  search(term) {
    if (this.searchInput) {
      this.searchInput.value = term;
      this.handleSearch({ target: { value: term } });
    }
  }

  // Utility method to get FAQ statistics
  getStats() {
    const stats = {
      total: this.faqItems.length,
      visible: Array.from(this.faqItems).filter(item =>
        item.getAttribute('data-visible') === 'true'
      ).length,
      expanded: Array.from(this.faqItems).filter(item =>
        item.querySelector('.faq__item')?.open
      ).length,
      categories: {}
    };

    this.faqItems.forEach(item => {
      const category = item.dataset.category || 'general';
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    });

    return stats;
  }
}

// Initialize FAQ Manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('FAQ Manager: DOM Content Loaded, initializing FAQ Manager...');
  // Initialize the FAQ manager
  window.faqManager = new FAQManager();
  console.log('FAQ Manager: Global FAQ Manager created', { faqManager: window.faqManager });

  // Add CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    .faq__item-wrapper {
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .faq__item-wrapper.animate-in {
      opacity: 1;
      transform: translateY(0);
    }

    .faq__search-wrapper.focused {
      box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
    }

    @media (prefers-reduced-motion: reduce) {
      .faq__item-wrapper {
        transition: none;
        opacity: 1;
        transform: none;
      }
    }
  `;
  document.head.appendChild(style);

  // Add loading state handling
  const faqSection = document.querySelector('.section--faq');
  if (faqSection) {
    faqSection.classList.add('loaded');
    console.log('FAQ Manager: FAQ section loaded class added');
  }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FAQManager;
}