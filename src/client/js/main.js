/**
 * Main application controller
 * Coordinates between different components and manages global state
 */

class App {
  constructor() {
    this.state = {
      currentQuery: '',
      lastResponse: null,
      isLoading: false,
      documentStructure: null
    };
    
    this.components = {};
    this.apiBase = '/api';
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Initialize components
      this.components.queryInterface = new QueryInterface(this);
      this.components.documentViewer = new DocumentViewer(this);
      this.components.responseDisplay = new ResponseDisplay(this);
      
      // Setup global event listeners
      this.setupEventListeners();
      
      // Load initial data
      await this.loadDocumentStructure();
      await this.loadQuerySuggestions();
      
      // Show coffee toast after a delay
      setTimeout(() => {
        this.showCoffeeToast();
      }, 2000);
      
      console.log('Application initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.showError('Failed to initialize application', error.message);
    }
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Modal handlers
    this.setupModalHandlers();
    
    // Coffee toast handlers
    this.setupCoffeeToastHandlers();
    
    // Global error handler
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.showError('An unexpected error occurred', event.reason?.message || 'Unknown error');
    });
    
    // Global error handler for regular errors
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.showError('An unexpected error occurred', event.error?.message || 'Unknown error');
    });
  }

  /**
   * Setup modal event handlers
   */
  setupModalHandlers() {
    // About modal
    const aboutLink = document.getElementById('about-link');
    const aboutModal = document.getElementById('about-modal');
    const closeAbout = document.getElementById('close-about');
    
    aboutLink?.addEventListener('click', (e) => {
      e.preventDefault();
      aboutModal.style.display = 'flex';
    });
    
    closeAbout?.addEventListener('click', () => {
      aboutModal.style.display = 'none';
    });
    
    // Privacy modal
    const privacyLink = document.getElementById('privacy-link');
    const privacyModal = document.getElementById('privacy-modal');
    const closePrivacy = document.getElementById('close-privacy');
    
    privacyLink?.addEventListener('click', (e) => {
      e.preventDefault();
      privacyModal.style.display = 'flex';
    });
    
    closePrivacy?.addEventListener('click', () => {
      privacyModal.style.display = 'none';
    });
    
    // Error modal
    const errorModal = document.getElementById('error-modal');
    const closeError = document.getElementById('close-error');
    const dismissError = document.getElementById('dismiss-error');
    const retryBtn = document.getElementById('retry-btn');
    
    closeError?.addEventListener('click', () => {
      errorModal.style.display = 'none';
    });
    
    dismissError?.addEventListener('click', () => {
      errorModal.style.display = 'none';
    });
    
    retryBtn?.addEventListener('click', () => {
      errorModal.style.display = 'none';
      if (this.lastFailedAction) {
        this.lastFailedAction();
      }
    });
    
    // Close modals when clicking outside
    [aboutModal, privacyModal, errorModal].forEach(modal => {
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  /**
   * Setup coffee toast handlers
   */
  setupCoffeeToastHandlers() {
    const coffeeToast = document.getElementById('coffee-toast');
    const coffeeDonate = document.getElementById('coffee-donate');
    const coffeeDismiss = document.getElementById('coffee-dismiss');
    
    coffeeDonate?.addEventListener('click', () => {
      // Open donation link (stub for now)
      window.open('https://buymeacoffee.com/placeholder', '_blank');
      this.hideCoffeeToast();
    });
    
    coffeeDismiss?.addEventListener('click', () => {
      this.hideCoffeeToast();
      // Set localStorage to remember dismissal
      localStorage.setItem('coffee-dismissed', Date.now().toString());
    });
  }

  /**
   * Show coffee toast if not recently dismissed
   */
  showCoffeeToast() {
    const dismissed = localStorage.getItem('coffee-dismissed');
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    if (!dismissed || parseInt(dismissed) < oneDayAgo) {
      const coffeeToast = document.getElementById('coffee-toast');
      coffeeToast?.classList.add('show');
    }
  }

  /**
   * Hide coffee toast
   */
  hideCoffeeToast() {
    const coffeeToast = document.getElementById('coffee-toast');
    coffeeToast?.classList.remove('show');
  }

  /**
   * Load document structure from API
   */
  async loadDocumentStructure() {
    try {
      const response = await fetch(`${this.apiBase}/document/structure`);
      const data = await response.json();
      
      if (data.success) {
        this.state.documentStructure = data;
        this.components.documentViewer?.loadStructure(data);
      } else {
        throw new Error(data.error?.message || 'Failed to load document structure');
      }
      
    } catch (error) {
      console.error('Failed to load document structure:', error);
      // Don't show error for this - it's not critical for basic functionality
    }
  }

  /**
   * Load query suggestions from API
   */
  async loadQuerySuggestions() {
    try {
      const response = await fetch(`${this.apiBase}/query/suggestions`);
      const data = await response.json();
      
      if (data.success) {
        this.components.queryInterface?.loadSuggestions(data.suggestions);
      }
      
    } catch (error) {
      console.error('Failed to load query suggestions:', error);
      // Use fallback suggestions
      const fallbackSuggestions = [
        'How will this affect my taxes as a middle-class family?',
        'What changes are there for small business owners?',
        'How does this impact SNAP benefits?',
        'What defense spending changes are included?',
        'How will this affect oil and gas development?'
      ];
      this.components.queryInterface?.loadSuggestions(fallbackSuggestions);
    }
  }

  /**
   * Process a user query
   */
  async processQuery(query) {
    if (!query || query.trim().length === 0) {
      this.showError('Invalid Query', 'Please enter a question');
      return;
    }

    this.state.currentQuery = query;
    this.state.isLoading = true;
    
    try {
      // Show loading state
      this.components.queryInterface?.setLoading(true);
      this.components.responseDisplay?.showLoading();
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout
      
      const response = await fetch(`${this.apiBase}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      console.log('API Response:', data); // Debug log
      
      if (data.success) {
        console.log('Processing successful response...'); // Debug log
        this.state.lastResponse = data;
        
        console.log('Calling displayResponse with data:', data); // Debug log
        this.components.responseDisplay?.displayResponse(data);
        
        // Highlight relevant sections in document viewer
        if (data.sections && data.sections.length > 0) {
          this.components.documentViewer?.highlightSections(data.sections);
        }
        
        console.log('Response display completed'); // Debug log
      } else {
        console.error('API returned error:', data.error); // Debug log
        throw new Error(data.error?.message || 'Failed to process query');
      }
      
    } catch (error) {
      console.error('Failed to process query:', error);
      
      let errorMessage = error.message;
      if (error.name === 'AbortError') {
        errorMessage = 'Query timed out. The request took too long to complete. Please try again with a simpler question.';
      }
      
      this.showError('Query Processing Failed', errorMessage);
      this.lastFailedAction = () => this.processQuery(query);
    } finally {
      this.state.isLoading = false;
      this.components.queryInterface?.setLoading(false);
    }
  }

  /**
   * Show error modal
   */
  showError(title, message) {
    const errorModal = document.getElementById('error-modal');
    const errorMessage = document.getElementById('error-message');
    
    if (errorMessage) {
      errorMessage.textContent = message;
    }
    
    if (errorModal) {
      errorModal.style.display = 'flex';
    }
  }

  /**
   * Navigate to a specific section
   */
  navigateToSection(sectionId) {
    this.components.documentViewer?.scrollToSection(sectionId);
  }

  /**
   * Get current application state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update application state
   */
  setState(updates) {
    this.state = { ...this.state, ...updates };
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});