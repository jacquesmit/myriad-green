/**
 * Google Trends Widget Manager
 * Handles initialization, data fetching, and content updates for Google Trends integration
 * Designed for competitive intelligence and market insights
 *
 * @version 1.0.0
 * @author Myriad Green Development Team
 * @license MIT
 */

class TrendsWidgetManager {
    constructor(options = {}) {
        this.options = {
            // Default configuration
            keywords: [
                'irrigation systems Johannesburg',
                'smart irrigation Gauteng',
                'drip irrigation Pretoria',
                'sprinkler systems South Africa',
                'water saving irrigation',
                'automatic irrigation systems',
                'garden irrigation Johannesburg',
                'lawn irrigation Pretoria',
                'commercial irrigation Gauteng',
                'residential irrigation systems',
                'irrigation installation Johannesburg',
                'irrigation repair Pretoria',
                'rainbird irrigation systems',
                'hunter irrigation Gauteng',
                'wifi irrigation controller'
            ],
            region: 'ZA-GT', // Gauteng, South Africa
            timeframe: 'past_12_months',
            category: 0, // All categories
            updateInterval: 24 * 60 * 60 * 1000, // 24 hours - DISABLED FOR TESTING
            enablePeriodicUpdates: false, // Disable periodic updates for testing
            cacheExpiry: 6 * 60 * 60 * 1000, // 6 hours
            maxRetries: 3,
            retryDelay: 1000, // 1 second
            ...options
        };

        this.cache = new Map();
        this.isInitialized = false;
        this.updateTimer = null;
        this.retryCount = 0;

        this.init();
    }

    /**
     * Initialize the trends widget
     */
    async init() {
        try {
            console.log('🔍 Initializing Google Trends Widget...');

            // Check if widget should be hidden (admin mode)
            if (this.shouldHideWidget()) {
                this.hideWidget();
                return;
            }

            // Initialize widget container FIRST
            // Initialize widget container
            this.createWidgetContainer();
            console.log('📦 Widget container created');

            // Load cached data if available
            await this.loadCachedData();

            // Render widget if we have data
            if (this.cachedData && this.cachedData.data) {
                console.log('🎨 Rendering widget with cached data');
                this.renderWidget(this.cachedData.data);
            } else {
                console.log('⚠️ No cached data, showing loading state');
                this.showLoadingState();
            }

            // Start periodic updates (disabled for testing)
            this.startPeriodicUpdates();

            this.isInitialized = true;
            console.log('✅ Google Trends Widget initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Trends Widget:', error);
            this.handleError(error);
        }
    }

    /**
     * Check if widget should be hidden (admin/competitive intelligence mode)
     */
    shouldHideWidget() {
        // Check for admin query parameter or localStorage flag
        const urlParams = new URLSearchParams(window.location.search);
        const isAdmin = urlParams.get('admin') === 'true';
        const hideTrends = localStorage.getItem('hideTrendsWidget') === 'true';

        return isAdmin || hideTrends;
    }

    /**
     * Hide widget for competitive intelligence purposes
     */
    hideWidget() {
        const containers = document.querySelectorAll('.trends-widget-container');
        containers.forEach(container => {
            container.classList.add('trends-widget-container--hidden');
            container.setAttribute('aria-hidden', 'true');
        });

        console.log('🔒 Trends widget hidden for competitive intelligence');
    }

    /**
     * Create widget container if it doesn't exist
     */
    createWidgetContainer() {
        if (document.querySelector('.trends-widget-container')) {
            return; // Container already exists
        }

        const container = document.createElement('div');
        container.className = 'trends-widget-container';
        container.setAttribute('role', 'complementary');
        container.setAttribute('aria-label', 'Market Trends Insights');

        // Add loading state
        container.innerHTML = `
            <div class="trends-widget__loading">
                <div class="trends-widget__spinner"></div>
                <p>Analyzing market trends...</p>
            </div>
        `;

        // Insert after hero section or at the end of main content
        const heroSection = document.querySelector('#hero');
        const mainContent = document.querySelector('main');

        if (heroSection) {
            heroSection.insertAdjacentElement('afterend', container);
        } else if (mainContent) {
            mainContent.appendChild(container);
        }

        this.container = container;
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="trends-widget__loading">
                <div class="trends-widget__spinner"></div>
                <p>Analyzing market trends...</p>
            </div>
        `;
        console.log('⏳ Showing loading state');
    }

    /**
     * Load cached trends data
     */
    async loadCachedData() {
        try {
            const cachedData = localStorage.getItem('trendsWidgetData');
            if (cachedData) {
                const parsedData = JSON.parse(cachedData);
                const now = Date.now();

                // Check if cache is still valid
                if (now - parsedData.timestamp < this.options.cacheExpiry) {
                    this.cachedData = parsedData;
                    console.log('📦 Loaded cached trends data');
                    return;
                }
            }

            // Cache expired or doesn't exist
            await this.fetchTrendsData();

        } catch (error) {
            console.warn('⚠️ Failed to load cached data:', error);
            await this.fetchTrendsData();
        }
    }

    /**
     * Fetch trends data from Google Trends API
     */
    async fetchTrendsData() {
        try {
            console.log('📊 Fetching Google Trends data...');

            // Simulate API call (replace with actual Google Trends API)
            const trendsData = await this.mockTrendsAPI();

            // Cache the data
            const cacheData = {
                data: trendsData,
                timestamp: Date.now(),
                keywords: this.options.keywords.slice(0, 5) // Cache top 5 keywords
            };

            localStorage.setItem('trendsWidgetData', JSON.stringify(cacheData));
            this.cachedData = cacheData;

            console.log('✅ Trends data fetched and cached');

        } catch (error) {
            console.error('❌ Failed to fetch trends data:', error);
            throw error;
        }
    }

    /**
     * Mock Google Trends API (replace with actual implementation)
     * In production, this would use Google Trends API or similar service
     */
    async mockTrendsAPI() {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Generate mock trends data
        const trends = this.options.keywords.map((keyword, index) => ({
            keyword,
            trend: Math.floor(Math.random() * 100) + 1,
            change: (Math.random() - 0.5) * 20, // -10% to +10%
            volume: Math.floor(Math.random() * 100000) + 10000,
            isRising: Math.random() > 0.5
        }));

        // Sort by trend volume
        trends.sort((a, b) => b.volume - a.volume);

        return {
            topTrends: trends.slice(0, 5),
            risingKeywords: trends.filter(t => t.isRising).slice(0, 3),
            regionalData: {
                region: this.options.region,
                topSearches: trends.slice(0, 10)
            },
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Render trends widget content
     */
    renderWidget(data) {
        if (!this.container) return;

        const html = `
            <div class="trends-widget">
                <div class="trends-widget__header">
                    <h3 class="trends-widget__title">
                        <i class="fas fa-chart-line" aria-hidden="true"></i>
                        Market Trends Insights
                    </h3>
                    <div class="trends-widget__meta">
                        <span class="trends-widget__update-time">
                            Updated ${this.formatTimeAgo(data.lastUpdated)}
                        </span>
                        <button class="trends-widget__refresh" aria-label="Refresh trends data">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="trends-widget__content">
                    <div class="trends-widget__section">
                        <h4 class="trends-widget__section-title">🔥 Trending Now</h4>
                        <div class="trends-list">
                            ${data.topTrends.map(trend => this.renderTrendItem(trend)).join('')}
                        </div>
                    </div>

                    <div class="trends-widget__section">
                        <h4 class="trends-widget__section-title">📈 Rising Searches</h4>
                        <div class="trends-list trends-list--rising">
                            ${data.risingKeywords.map(trend => this.renderTrendItem(trend, true)).join('')}
                        </div>
                    </div>
                </div>

                <div class="trends-widget__footer">
                    <p class="trends-widget__disclaimer">
                        <i class="fas fa-info-circle" aria-hidden="true"></i>
                        Data sourced from Google Trends for market intelligence
                    </p>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    /**
     * Render individual trend item
     */
    renderTrendItem(trend, isRising = false) {
        const changeClass = trend.change >= 0 ? 'positive' : 'negative';
        const changeIcon = trend.change >= 0 ? '↗️' : '↘️';
        const risingBadge = isRising ? '<span class="trend-badge trend-badge--rising">🔥 Rising</span>' : '';

        return `
            <div class="trend-item ${isRising ? 'trend-item--rising' : ''}">
                <div class="trend-item__content">
                    <div class="trend-item__keyword">${trend.keyword}</div>
                    <div class="trend-item__stats">
                        <span class="trend-volume">${this.formatNumber(trend.volume)} searches</span>
                        <span class="trend-change trend-change--${changeClass}">
                            ${changeIcon} ${Math.abs(trend.change).toFixed(1)}%
                        </span>
                    </div>
                </div>
                ${risingBadge}
            </div>
        `;
    }

    /**
     * Attach event listeners to widget elements
     */
    attachEventListeners() {
        // Refresh button
        const refreshBtn = this.container.querySelector('.trends-widget__refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.handleRefresh());
        }

        // Trend items hover effects
        const trendItems = this.container.querySelectorAll('.trend-item');
        trendItems.forEach(item => {
            item.addEventListener('mouseenter', () => this.handleTrendHover(item, true));
            item.addEventListener('mouseleave', () => this.handleTrendHover(item, false));
        });
    }

    /**
     * Handle refresh button click
     */
    async handleRefresh() {
        const refreshBtn = this.container.querySelector('.trends-widget__refresh');
        if (refreshBtn) {
            refreshBtn.classList.add('refreshing');
            refreshBtn.disabled = true;
        }

        try {
            await this.fetchTrendsData();
            if (this.cachedData) {
                this.renderWidget(this.cachedData.data);
            }
        } catch (error) {
            console.error('❌ Refresh failed:', error);
            this.showError('Failed to refresh trends data');
        } finally {
            if (refreshBtn) {
                refreshBtn.classList.remove('refreshing');
                refreshBtn.disabled = false;
            }
        }
    }

    /**
     * Handle trend item hover effects
     */
    handleTrendHover(item, isHovering) {
        if (isHovering) {
            item.classList.add('trend-item--hovered');
        } else {
            item.classList.remove('trend-item--hovered');
        }
    }

    /**
     * Start periodic updates (disabled for testing)
     */
    startPeriodicUpdates() {
        if (!this.options.enablePeriodicUpdates) {
            console.log('🔄 Periodic updates disabled for testing');
            return;
        }

        this.updateTimer = setInterval(async () => {
            try {
                await this.fetchTrendsData();
                if (this.cachedData && this.container) {
                    this.renderWidget(this.cachedData.data);
                }
            } catch (error) {
                console.warn('⚠️ Periodic update failed:', error);
            }
        }, this.options.updateInterval);
    }

    /**
     * Handle errors gracefully
     */
    handleError(error) {
        console.error('Trends Widget Error:', error);

        if (this.container) {
            this.container.innerHTML = `
                <div class="trends-widget__error">
                    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                    <h3>Unable to Load Trends</h3>
                    <p>Please check your connection and try again later.</p>
                    <button class="trends-widget__retry" onclick="window.trendsWidget.retry()">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // Create temporary error toast
        const toast = document.createElement('div');
        toast.className = 'trends-toast trends-toast--error';
        toast.innerHTML = `
            <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    /**
     * Retry initialization
     */
    async retry() {
        if (this.retryCount >= this.options.maxRetries) {
            this.showError('Maximum retry attempts reached');
            return;
        }

        this.retryCount++;
        console.log(`🔄 Retrying trends widget initialization (attempt ${this.retryCount})`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * this.retryCount));

        await this.init();
    }

    /**
     * Utility: Format time ago
     */
    formatTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else {
            return `${diffDays}d ago`;
        }
    }

    /**
     * Utility: Format numbers
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * Cleanup method
     */
    destroy() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        if (this.container) {
            this.container.remove();
        }

        console.log('🗑️ Trends widget destroyed');
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if static trends widget already exists
    const staticTrendsWidget = document.querySelector('.trends__widget-container');
    if (staticTrendsWidget) {
        console.log('📊 Static trends widget found, skipping JavaScript initialization');
        return;
    }

    // Check if trends widget should be disabled entirely
    const disableTrends = localStorage.getItem('disableTrendsWidget') === 'true' ||
                         new URLSearchParams(window.location.search).get('disableTrends') === 'true';

    if (disableTrends) {
        console.log('🚫 Trends widget disabled via localStorage or URL parameter');
        return;
    }

    // Initialize trends widget
    window.trendsWidget = new TrendsWidgetManager();

    // Add to global scope for debugging
    if (typeof window !== 'undefined') {
        window.TrendsWidgetManager = TrendsWidgetManager;
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrendsWidgetManager;
}

console.log('📊 Trends Widget Manager loaded successfully');