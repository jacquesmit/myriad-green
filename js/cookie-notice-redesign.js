/**
 * MYRIAD GREEN - COOKIE NOTICE INTERACTIVE FUNCTIONALITY
 * Handles cookie preferences, theme integration, and enhanced UX
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize cookie notice functionality
    initializeCookieNotice();
    
    function initializeCookieNotice() {
        // Setup cookie preference toggles
        setupCookieToggles();
        
        // Setup action buttons
        setupActionButtons();
        
        // Setup smooth scrolling
        setupSmoothScrolling();
        
        // Setup reading progress indicator
        setupReadingProgress();
        
        // Load saved preferences
        loadCookiePreferences();
        
        console.log('Cookie notice functionality initialized');
    }
    
    /**
     * Setup cookie preference toggles
     */
    function setupCookieToggles() {
        const toggles = document.querySelectorAll('.cookie-toggle');
        
        toggles.forEach(toggle => {
            toggle.addEventListener('click', function() {
                const categoryId = this.dataset.category;
                const isActive = this.classList.contains('active');
                
                // Toggle the visual state
                this.classList.toggle('active');
                
                // Save preference
                saveCookiePreference(categoryId, !isActive);
                
                // Provide user feedback
                showToggleFeedback(this, !isActive);
            });
            
            // Keyboard accessibility
            toggle.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
            });
        });
    }
    
    /**
     * Setup action buttons
     */
    function setupActionButtons() {
        const acceptAllBtn = document.getElementById('accept-all-cookies');
        const customizeBtn = document.getElementById('customize-cookies');
        const savePreferencesBtn = document.getElementById('save-preferences');
        
        if (acceptAllBtn) {
            acceptAllBtn.addEventListener('click', function() {
                acceptAllCookies();
                showActionFeedback('All cookie preferences saved!');
            });
        }
        
        if (customizeBtn) {
            customizeBtn.addEventListener('click', function() {
                scrollToSection('cookie-categories');
            });
        }
        
        if (savePreferencesBtn) {
            savePreferencesBtn.addEventListener('click', function() {
                saveAllPreferences();
                showActionFeedback('Cookie preferences saved successfully!');
            });
        }
    }
    
    /**
     * Setup smooth scrolling for navigation
     */
    function setupSmoothScrolling() {
        const links = document.querySelectorAll('a[href^="#"]');
        
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                scrollToSection(targetId);
            });
        });
    }
    
    /**
     * Setup reading progress indicator
     */
    function setupReadingProgress() {
        const progressBar = document.createElement('div');
        progressBar.className = 'reading-progress';
        progressBar.innerHTML = '<div class="reading-progress-bar"></div>';
        document.body.appendChild(progressBar);
        
        // Add CSS for progress bar
        const style = document.createElement('style');
        style.textContent = `
            .reading-progress {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 4px;
                background: rgba(23, 106, 58, 0.1);
                z-index: 9999;
            }
            .reading-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #176a3a, #b6ffb0);
                width: 0%;
                transition: width 0.3s ease;
            }
        `;
        document.head.appendChild(style);
        
        // Update progress on scroll
        window.addEventListener('scroll', updateReadingProgress);
        updateReadingProgress(); // Initial call
    }
    
    /**
     * Update reading progress based on scroll position
     */
    function updateReadingProgress() {
        const scrollTop = window.pageYOffset;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        
        const progressBar = document.querySelector('.reading-progress-bar');
        if (progressBar) {
            progressBar.style.width = Math.min(scrollPercent, 100) + '%';
        }
    }
    
    /**
     * Accept all cookies
     */
    function acceptAllCookies() {
        const toggles = document.querySelectorAll('.cookie-toggle');
        const preferences = {};
        
        toggles.forEach(toggle => {
            const categoryId = toggle.dataset.category;
            toggle.classList.add('active');
            preferences[categoryId] = true;
        });
        
        // Save to localStorage
        localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
        localStorage.setItem('cookieConsentGiven', 'true');
        localStorage.setItem('cookieConsentDate', new Date().toISOString());
    }
    
    /**
     * Save individual cookie preference
     */
    function saveCookiePreference(categoryId, enabled) {
        let preferences = {};
        
        try {
            preferences = JSON.parse(localStorage.getItem('cookiePreferences') || '{}');
        } catch (e) {
            console.warn('Error parsing cookie preferences:', e);
        }
        
        preferences[categoryId] = enabled;
        localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
        
        console.log(`Cookie preference updated: ${categoryId} = ${enabled}`);
    }
    
    /**
     * Save all current preferences
     */
    function saveAllPreferences() {
        const toggles = document.querySelectorAll('.cookie-toggle');
        const preferences = {};
        
        toggles.forEach(toggle => {
            const categoryId = toggle.dataset.category;
            const isActive = toggle.classList.contains('active');
            preferences[categoryId] = isActive;
        });
        
        localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
        localStorage.setItem('cookieConsentGiven', 'true');
        localStorage.setItem('cookieConsentDate', new Date().toISOString());
        
        console.log('All cookie preferences saved:', preferences);
    }
    
    /**
     * Load saved cookie preferences
     */
    function loadCookiePreferences() {
        try {
            const preferences = JSON.parse(localStorage.getItem('cookiePreferences') || '{}');
            const toggles = document.querySelectorAll('.cookie-toggle');
            
            toggles.forEach(toggle => {
                const categoryId = toggle.dataset.category;
                if (preferences[categoryId] === true) {
                    toggle.classList.add('active');
                }
            });
            
            console.log('Cookie preferences loaded:', preferences);
        } catch (e) {
            console.warn('Error loading cookie preferences:', e);
        }
    }
    
    /**
     * Show toggle feedback animation
     */
    function showToggleFeedback(toggle, enabled) {
        const feedback = document.createElement('div');
        feedback.className = 'toggle-feedback';
        feedback.textContent = enabled ? 'Enabled' : 'Disabled';
        feedback.style.cssText = `
            position: absolute;
            top: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--cookie-primary);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            opacity: 0;
            animation: toggleFeedback 1s ease;
        `;
        
        // Add animation CSS if not exists
        if (!document.getElementById('toggle-feedback-styles')) {
            const style = document.createElement('style');
            style.id = 'toggle-feedback-styles';
            style.textContent = `
                @keyframes toggleFeedback {
                    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    50% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        toggle.style.position = 'relative';
        toggle.appendChild(feedback);
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 1000);
    }
    
    /**
     * Show action feedback message
     */
    function showActionFeedback(message) {
        // Remove existing feedback
        const existingFeedback = document.querySelector('.action-feedback');
        if (existingFeedback) {
            existingFeedback.remove();
        }
        
        // Create new feedback
        const feedback = document.createElement('div');
        feedback.className = 'action-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--cookie-primary);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(23, 106, 58, 0.3);
            z-index: 10000;
            font-weight: 500;
            opacity: 0;
            transform: translateX(100px);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(feedback);
        
        // Animate in
        setTimeout(() => {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translateX(0)';
        }, 100);
        
        // Animate out and remove
        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translateX(100px)';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }, 3000);
    }
    
    /**
     * Smooth scroll to section
     */
    function scrollToSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
    
    /**
     * Get cookie preference status
     */
    function getCookiePreference(categoryId) {
        try {
            const preferences = JSON.parse(localStorage.getItem('cookiePreferences') || '{}');
            return preferences[categoryId] || false;
        } catch (e) {
            console.warn('Error getting cookie preference:', e);
            return false;
        }
    }
    
    /**
     * Check if consent has been given
     */
    function hasConsentBeenGiven() {
        return localStorage.getItem('cookieConsentGiven') === 'true';
    }
    
    /**
     * Get consent date
     */
    function getConsentDate() {
        return localStorage.getItem('cookieConsentDate');
    }
    
    // Export functions for external use
    window.CookieNotice = {
        getCookiePreference,
        saveCookiePreference,
        hasConsentBeenGiven,
        getConsentDate,
        acceptAllCookies,
        saveAllPreferences
    };
});

/**
 * Theme integration - ensure cookie notice respects site theme
 */
document.addEventListener('themeChanged', function(e) {
    console.log('Theme changed to:', e.detail.theme);
    // Cookie notice will automatically adapt via CSS custom properties
});

/**
 * Handle back button with enhanced UX
 */
function enhancedGoBack() {
    // Add loading state
    const backBtn = document.querySelector('.back-button');
    if (backBtn) {
        backBtn.style.opacity = '0.6';
        backBtn.style.pointerEvents = 'none';
    }
    
    // Navigate back with fallback
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = '/';
    }
    
    // Reset button state after delay
    setTimeout(() => {
        if (backBtn) {
            backBtn.style.opacity = '1';
            backBtn.style.pointerEvents = 'auto';
        }
    }, 500);
}