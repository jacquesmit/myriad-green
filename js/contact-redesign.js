/**
 * MYRIAD GREEN - MODERN CONTACT PAGE JAVASCRIPT
 * Enhanced form functionality with validation and UX improvements
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // Get form elements
    const contactForm = document.getElementById('modern-contact-form');
    const submitButton = document.getElementById('submit-btn');
    const statusMessage = document.getElementById('form-status-message');
    
    // Form validation patterns
    const validationPatterns = {
        name: /^[a-zA-Z\s]{2,50}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^[\+]?[0-9\s\-\(\)]{10,15}$/,
        company: /^[a-zA-Z0-9\s\.\-\_]{2,100}$/
    };
    
    // Initialize form functionality
    initializeForm();
    
    function initializeForm() {
        // Add event listeners for real-time validation
        addValidationListeners();
        
        // Add form submission handler
        if (contactForm) {
            contactForm.addEventListener('submit', handleFormSubmission);
        }
        
        // Initialize floating labels
        initializeFloatingLabels();
        
        // Add enhanced UX features
        addEnhancedUX();
        
        console.log('Contact form initialized successfully');
    }
    
    function addValidationListeners() {
        const inputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');
        
        inputs.forEach(input => {
            // Real-time validation on blur
            input.addEventListener('blur', function() {
                validateField(this);
            });
            
            // Clear validation on focus
            input.addEventListener('focus', function() {
                clearFieldValidation(this);
            });
            
            // Update floating labels on input
            input.addEventListener('input', function() {
                updateFloatingLabel(this);
            });
        });
    }
    
    function validateField(field) {
        const fieldContainer = field.closest('.input-field');
        const fieldName = field.name;
        const fieldValue = field.value.trim();
        
        // Clear previous validation
        clearFieldValidation(field);
        
        // Skip validation for optional fields if empty
        if (!fieldValue && !field.hasAttribute('required')) {
            return true;
        }
        
        // Required field validation
        if (field.hasAttribute('required') && !fieldValue) {
            showFieldError(fieldContainer, 'This field is required');
            return false;
        }
        
        // Pattern validation
        if (fieldValue && validationPatterns[fieldName]) {
            if (!validationPatterns[fieldName].test(fieldValue)) {
                const errorMessage = getErrorMessage(fieldName);
                showFieldError(fieldContainer, errorMessage);
                return false;
            }
        }
        
        // Special validation for select fields
        if (field.type === 'select-one' && field.value === '') {
            showFieldError(fieldContainer, 'Please select an option');
            return false;
        }
        
        // Field is valid
        showFieldSuccess(fieldContainer);
        return true;
    }
    
    function getErrorMessage(fieldName) {
        const messages = {
            name: 'Please enter a valid name (2-50 characters, letters only)',
            email: 'Please enter a valid email address',
            phone: 'Please enter a valid phone number',
            company: 'Please enter a valid company name'
        };
        
        return messages[fieldName] || 'Please enter a valid value';
    }
    
    function showFieldError(container, message) {
        container.classList.add('error');
        container.classList.remove('valid');
        
        // Show error icon
        const errorIcon = container.querySelector('.validation-error');
        if (errorIcon) {
            errorIcon.style.opacity = '1';
            errorIcon.style.transform = 'scale(1)';
        }
        
        // Add error message if not exists
        let errorMsg = container.querySelector('.field-error-message');
        if (!errorMsg) {
            errorMsg = document.createElement('div');
            errorMsg.className = 'field-error-message';
            errorMsg.style.cssText = `
                color: var(--emergency-red);
                font-size: 0.875rem;
                margin-top: 0.5rem;
                opacity: 0;
                transform: translateY(-10px);
                transition: all 0.3s ease;
            `;
            container.appendChild(errorMsg);
        }
        
        errorMsg.textContent = message;
        setTimeout(() => {
            errorMsg.style.opacity = '1';
            errorMsg.style.transform = 'translateY(0)';
        }, 10);
    }
    
    function showFieldSuccess(container) {
        container.classList.add('valid');
        container.classList.remove('error');
        
        // Show success icon
        const successIcon = container.querySelector('.validation-success');
        if (successIcon) {
            successIcon.style.opacity = '1';
            successIcon.style.transform = 'scale(1)';
        }
        
        // Remove error message
        const errorMsg = container.querySelector('.field-error-message');
        if (errorMsg) {
            errorMsg.style.opacity = '0';
            errorMsg.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                errorMsg.remove();
            }, 300);
        }
    }
    
    function clearFieldValidation(field) {
        const container = field.closest('.input-field');
        container.classList.remove('error', 'valid');
        
        // Hide validation icons
        const validationIcons = container.querySelectorAll('.validation-success, .validation-error');
        validationIcons.forEach(icon => {
            icon.style.opacity = '0';
            icon.style.transform = 'scale(0.8)';
        });
    }
    
    function initializeFloatingLabels() {
        const inputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');
        
        inputs.forEach(input => {
            updateFloatingLabel(input);
            
            // Handle autofill
            setTimeout(() => {
                updateFloatingLabel(input);
            }, 100);
        });
    }
    
    function updateFloatingLabel(input) {
        const label = input.nextElementSibling;
        if (!label || !label.classList.contains('floating-label')) return;
        
        const hasValue = input.value.trim() !== '' || input.type === 'select-one' && input.value !== '';
        const isFocused = document.activeElement === input;
        
        if (hasValue || isFocused) {
            label.style.transform = 'translateY(-2.5rem) translateX(-0.5rem) scale(0.85)';
            label.style.color = 'var(--primary-green)';
            label.style.fontWeight = '500';
        } else {
            label.style.transform = '';
            label.style.color = 'var(--text-light)';
            label.style.fontWeight = '';
        }
    }
    
    function addEnhancedUX() {
        // Auto-format phone number
        const phoneInput = document.querySelector('input[name="phone"]');
        if (phoneInput) {
            phoneInput.addEventListener('input', function() {
                formatPhoneNumber(this);
            });
        }
        
        // Add smooth scrolling to form
        const formButtons = document.querySelectorAll('.cta-form');
        formButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const form = document.querySelector('.contact-form-section');
                if (form) {
                    form.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        // Add click to call functionality
        const phoneButtons = document.querySelectorAll('.cta-phone');
        phoneButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                // Allow default behavior for tel: links
                if (this.href && this.href.startsWith('tel:')) {
                    return;
                }
                
                e.preventDefault();
                window.location.href = 'tel:0877600222';
            });
        });
    }
    
    function formatPhoneNumber(input) {
        let value = input.value.replace(/\D/g, '');
        
        if (value.startsWith('27')) {
            // South African number starting with country code
            value = value.substring(0, 11);
            if (value.length > 2) {
                value = '+27 ' + value.substring(2);
            }
        } else if (value.startsWith('0')) {
            // Local South African number
            value = value.substring(0, 10);
            if (value.length > 3) {
                value = value.substring(0, 3) + ' ' + value.substring(3);
            }
            if (value.length > 7) {
                value = value.substring(0, 7) + ' ' + value.substring(7);
            }
        }
        
        input.value = value;
    }
    
    async function handleFormSubmission(e) {
        e.preventDefault();
        
        // Show loading state
        setButtonLoading(true);
        hideStatusMessage();
        
        try {
            // Validate all fields
            const isValid = validateAllFields();
            
            if (!isValid) {
                showStatusMessage('Please correct the errors above and try again.', 'error');
                setButtonLoading(false);
                return;
            }
            
            // Prepare form data
            const formData = new FormData(contactForm);
            
            // Submit to Formspree
            const response = await fetch('https://formspree.io/f/xgvwqeow', {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                // Success
                showStatusMessage('Thank you for your message! We\'ll get back to you within 24 hours.', 'success');
                resetForm();
                
                // Track form submission (if analytics available)
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'form_submit', {
                        'event_category': 'Contact',
                        'event_label': 'Contact Form'
                    });
                }
            } else {
                // Handle form errors
                const data = await response.json();
                if (data.errors) {
                    showStatusMessage('There was an issue with your submission. Please try again.', 'error');
                } else {
                    showStatusMessage('Something went wrong. Please try again or call us directly.', 'error');
                }
            }
        } catch (error) {
            console.error('Form submission error:', error);
            showStatusMessage('Something went wrong. Please try again or call us directly.', 'error');
        }
        
        setButtonLoading(false);
    }
    
    function validateAllFields() {
        const inputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    function setButtonLoading(loading) {
        if (!submitButton) return;
        
        if (loading) {
            submitButton.disabled = true;
            submitButton.classList.add('loading');
            
            const btnContent = submitButton.querySelector('.btn-content');
            const btnIcon = submitButton.querySelector('.btn-icon');
            const btnText = submitButton.querySelector('.btn-text');
            
            if (btnIcon) {
                btnIcon.className = 'btn-icon fas fa-spinner';
            }
            if (btnText) {
                btnText.textContent = 'Sending...';
            }
        } else {
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            
            const btnIcon = submitButton.querySelector('.btn-icon');
            const btnText = submitButton.querySelector('.btn-text');
            
            if (btnIcon) {
                btnIcon.className = 'btn-icon fas fa-paper-plane';
            }
            if (btnText) {
                btnText.textContent = 'Send Message';
            }
        }
    }
    
    function showStatusMessage(message, type) {
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = `form-status-message ${type}`;
        statusMessage.style.opacity = '1';
        statusMessage.style.transform = 'translateY(0)';
        
        // Auto-hide success messages after 10 seconds
        if (type === 'success') {
            setTimeout(() => {
                hideStatusMessage();
            }, 10000);
        }
    }
    
    function hideStatusMessage() {
        if (!statusMessage) return;
        
        statusMessage.style.opacity = '0';
        statusMessage.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            statusMessage.className = 'form-status-message';
            statusMessage.textContent = '';
        }, 300);
    }
    
    function resetForm() {
        if (!contactForm) return;
        
        // Reset form fields
        contactForm.reset();
        
        // Clear all validation states
        const inputFields = document.querySelectorAll('.input-field');
        inputFields.forEach(field => {
            field.classList.remove('valid', 'error');
            
            const errorMsg = field.querySelector('.field-error-message');
            if (errorMsg) {
                errorMsg.remove();
            }
        });
        
        // Reset floating labels
        initializeFloatingLabels();
        
        // Scroll to top of form
        setTimeout(() => {
            contactForm.scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
        }, 500);
    }
    
    // Handle service area map interaction
    function initializeMap() {
        const mapContainer = document.querySelector('.map-container iframe');
        if (!mapContainer) return;
        
        // Add loading state
        const mapWrapper = mapContainer.parentElement;
        mapWrapper.style.position = 'relative';
        
        const loadingDiv = document.createElement('div');
        loadingDiv.innerHTML = `
            <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--surface);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.125rem;
                color: var(--text-secondary);
                z-index: 1;
            ">
                <i class="fas fa-map-marker-alt" style="margin-right: 0.5rem;"></i>
                Loading map...
            </div>
        `;
        
        mapWrapper.appendChild(loadingDiv);
        
        // Hide loading when map loads
        mapContainer.addEventListener('load', function() {
            loadingDiv.style.opacity = '0';
            setTimeout(() => {
                loadingDiv.remove();
            }, 300);
        });
    }
    
    // Initialize map
    initializeMap();
    
    // Handle emergency contact button pulse animation
    const emergencyBtn = document.querySelector('.cta-emergency');
    if (emergencyBtn) {
        setInterval(() => {
            emergencyBtn.style.animation = 'none';
            setTimeout(() => {
                emergencyBtn.style.animation = 'pulse 2s infinite';
            }, 10);
        }, 10000); // Pulse every 10 seconds
    }
    
    // Add keyboard navigation enhancements
    document.addEventListener('keydown', function(e) {
        // Escape key to close any modals or reset form focus
        if (e.key === 'Escape') {
            const focusedElement = document.activeElement;
            if (focusedElement && focusedElement.classList.contains('form-input', 'form-select', 'form-textarea')) {
                focusedElement.blur();
            }
        }
        
        // Enter key on CTA buttons
        if (e.key === 'Enter' && e.target.classList.contains('cta-button')) {
            e.target.click();
        }
    });
    
    // Intersection Observer for animations
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                }
            });
        }, observerOptions);
        
        // Observe animated elements
        const animatedElements = document.querySelectorAll('.contact-card, .service-item, .modern-contact-form');
        animatedElements.forEach(el => {
            el.style.animationPlayState = 'paused';
            observer.observe(el);
        });
    }
    
    // Console message for developers
    console.log('%c🌱 Myriad Green Contact Form', 'color: #00A651; font-size: 16px; font-weight: bold;');
    console.log('Contact form enhanced with modern UX and validation');
    
});

// Utility functions available globally
window.MyriadGreenContact = {
    scrollToForm: function() {
        const form = document.querySelector('.contact-form-section');
        if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },
    
    callPhone: function() {
        window.location.href = 'tel:0877600222';
    },
    
    sendEmail: function() {
        window.location.href = 'mailto:info@myriadgreen.co.za';
    }
};