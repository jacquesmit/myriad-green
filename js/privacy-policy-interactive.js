/**
 * Privacy Policy - Modern Interactive Features
 * Enhances user experience with progressive loading and interaction feedback
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all interactive features
    initProgressBar();
    initSmoothScrolling();
    initTableOfContents();
    initAnimations();
    initAccessibilityEnhancements();
    // Note: Social bar and scroll-to-top handled by site-init.js
});

/**
 * Reading Progress Bar
 * Shows reading progress as user scrolls through the document
 */
function initProgressBar() {
    // Create progress bar element
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.setAttribute('aria-label', 'Reading progress');
    document.body.appendChild(progressBar);
    
    // Update progress on scroll
    function updateProgress() {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progressBar.style.width = Math.min(scrolled, 100) + '%';
    }
    
    // Throttled scroll handler for performance
    let ticking = false;
    function handleScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                updateProgress();
                ticking = false;
            });
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', handleScroll);
    updateProgress(); // Initial call
}

/**
 * Smooth Scrolling for Table of Contents
 * Enhances navigation experience with smooth scrolling
 */
function initSmoothScrolling() {
    const tocLinks = document.querySelectorAll('.toc-list a[href^="#"]');
    
    tocLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                // Add active state to clicked link
                tocLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                
                // Smooth scroll to target
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Update URL without jumping
                history.pushState(null, null, targetId);
                
                // Focus target for accessibility
                setTimeout(() => {
                    targetElement.focus({ preventScroll: true });
                }, 500);
            }
        });
    });
}

/**
 * Enhanced Table of Contents
 * Highlights current section and provides visual feedback
 */
function initTableOfContents() {
    const sections = document.querySelectorAll('.content-card[id]');
    const tocLinks = document.querySelectorAll('.toc-list a');
    
    if (sections.length === 0 || tocLinks.length === 0) return;
    
    // Create intersection observer for section highlighting
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove active class from all links
                tocLinks.forEach(link => link.classList.remove('active'));
                
                // Add active class to current section link
                const activeLink = document.querySelector(`.toc-list a[href="#${entry.target.id}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }, {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0.1
    });
    
    // Observe all sections
    sections.forEach(section => observer.observe(section));
}

/**
 * Progressive Animation System
 * Reveals content as user scrolls for better engagement
 */
function initAnimations() {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
        // Skip animations for users who prefer reduced motion
        document.querySelectorAll('.content-card').forEach(card => {
            card.style.opacity = '1';
            card.style.transform = 'none';
        });
        return;
    }
    
    // Initialize cards as hidden
    const cards = document.querySelectorAll('.content-card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
    });
    
    // Create intersection observer for animations
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
                
                // Unobserve after animation
                animationObserver.unobserve(card);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    // Observe all cards
    cards.forEach(card => animationObserver.observe(card));
}

/**
 * Accessibility Enhancements
 * Improves keyboard navigation and screen reader experience
 */
function initAccessibilityEnhancements() {
    // Skip link for keyboard users
    createSkipLink();
    
    // Enhanced focus management
    enhanceFocusManagement();
    
    // Keyboard shortcuts
    initKeyboardShortcuts();
}

/**
 * Create skip link for keyboard navigation
 */
function createSkipLink() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Skip to main content';
    skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--primary-color, #2c7a2c);
        color: white;
        padding: 8px;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 600;
        z-index: 10000;
        transition: top 0.3s ease;
    `;
    
    skipLink.addEventListener('focus', () => {
        skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * Enhanced focus management for better keyboard navigation
 */
function enhanceFocusManagement() {
    // Add focus indicators for interactive elements
    const focusableElements = document.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
    
    focusableElements.forEach(element => {
        element.addEventListener('focus', function() {
            this.setAttribute('data-focus', 'true');
        });
        
        element.addEventListener('blur', function() {
            this.removeAttribute('data-focus');
        });
    });
    
    // Handle focus trapping in modals (if any)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close any open modals or return focus to main content
            const activeElement = document.activeElement;
            if (activeElement && activeElement.closest('.modal')) {
                document.querySelector('.privacy-policy-container').focus();
            }
        }
    });
}

/**
 * Keyboard shortcuts for enhanced navigation
 */
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Alt + H: Go to top (Home)
        if (e.altKey && e.key === 'h') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.querySelector('.privacy-hero h1').focus();
        }
        
        // Alt + T: Focus table of contents
        if (e.altKey && e.key === 't') {
            e.preventDefault();
            const toc = document.querySelector('.toc-card h3');
            if (toc) {
                toc.scrollIntoView({ behavior: 'smooth' });
                toc.focus();
            }
        }
        
        // Alt + C: Focus contact section
        if (e.altKey && e.key === 'c') {
            e.preventDefault();
            const contact = document.querySelector('#contact-us');
            if (contact) {
                contact.scrollIntoView({ behavior: 'smooth' });
                contact.focus();
            }
        }
    });
}

/**
 * Print functionality enhancement
 */
function initPrintEnhancements() {
    // Add print button
    const printButton = document.createElement('button');
    printButton.innerHTML = '<i class="fas fa-print"></i> Print Policy';
    printButton.className = 'print-button';
    printButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--primary-color, #2c7a2c);
        color: white;
        border: none;
        padding: 12px 16px;
        border-radius: 50px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-weight: 600;
        transition: all 0.3s ease;
        z-index: 1000;
    `;
    
    printButton.addEventListener('click', () => {
        window.print();
    });
    
    printButton.addEventListener('mouseenter', () => {
        printButton.style.transform = 'scale(1.05)';
        printButton.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
    });
    
    printButton.addEventListener('mouseleave', () => {
        printButton.style.transform = 'scale(1)';
        printButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    
    document.body.appendChild(printButton);
}

// Initialize print enhancements
document.addEventListener('DOMContentLoaded', initPrintEnhancements);

// Add CSS for enhanced states
const style = document.createElement('style');
style.textContent = `
    .toc-list a.active {
        background: var(--primary-color, #2c7a2c) !important;
        color: white !important;
        transform: translateX(10px) !important;
    }
    
    .toc-list a.active span {
        background: white !important;
        color: var(--primary-color, #2c7a2c) !important;
    }
    
    [data-focus="true"] {
        outline: 3px solid var(--primary-color, #2c7a2c) !important;
        outline-offset: 2px !important;
    }
    
    @media print {
        .progress-bar,
        .print-button,
        .skip-link {
            display: none !important;
        }
    }
`;
document.head.appendChild(style);

// Note: Social bar and scroll-to-top functionality are handled by site-init.js
// which loads the partials and sets up the interactive behaviors