/**
 * Query Interface Component
 * Handles user input, suggestions, and query submission
 */

class QueryInterface {
  constructor(app) {
    this.app = app;
    this.elements = {
      queryInput: document.getElementById('query-input'),
      submitButton: document.getElementById('submit-query'),
      charCount: document.getElementById('char-count'),
      suggestions: document.getElementById('query-suggestions'),
      btnText: document.querySelector('#submit-query .btn-text'),
      btnLoader: document.querySelector('#submit-query .btn-loader')
    };
    
    this.suggestions = [];
    this.maxLength = 1000;
    
    this.init();
  }

  /**
   * Initialize the query interface
   */
  init() {
    this.setupEventListeners();
    this.updateCharCount();
    this.updateSubmitButton();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Query input handlers
    this.elements.queryInput?.addEventListener('input', () => {
      this.updateCharCount();
      this.updateSubmitButton();
      this.handleInputChange();
    });

    this.elements.queryInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleSubmit();
      }
    });

    // Submit button handler
    this.elements.submitButton?.addEventListener('click', () => {
      this.handleSubmit();
    });

    // Auto-resize textarea
    this.elements.queryInput?.addEventListener('input', () => {
      this.autoResizeTextarea();
    });
  }

  /**
   * Handle input changes with debouncing
   */
  handleInputChange() {
    // Clear existing timeout
    if (this.inputTimeout) {
      clearTimeout(this.inputTimeout);
    }

    // Set new timeout for validation
    this.inputTimeout = setTimeout(() => {
      this.validateInput();
    }, 300);
  }

  /**
   * Auto-resize textarea based on content
   */
  autoResizeTextarea() {
    const textarea = this.elements.queryInput;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height based on scrollHeight, with min and max constraints
    const minHeight = 100; // 3 rows approximately
    const maxHeight = 200; // 6 rows approximately
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    
    textarea.style.height = newHeight + 'px';
  }

  /**
   * Update character count display
   */
  updateCharCount() {
    const input = this.elements.queryInput;
    const counter = this.elements.charCount;
    
    if (!input || !counter) return;

    const currentLength = input.value.length;
    counter.textContent = currentLength;

    // Update styling based on character count
    if (currentLength > this.maxLength * 0.9) {
      counter.style.color = '#ef4444'; // Red
    } else if (currentLength > this.maxLength * 0.7) {
      counter.style.color = '#f59e0b'; // Orange
    } else {
      counter.style.color = '#6b7280'; // Gray
    }
  }

  /**
   * Update submit button state
   */
  updateSubmitButton() {
    const input = this.elements.queryInput;
    const button = this.elements.submitButton;
    
    if (!input || !button) return;

    const query = input.value.trim();
    const isValid = query.length > 0 && query.length <= this.maxLength;
    
    button.disabled = !isValid || this.app.getState().isLoading;
  }

  /**
   * Validate input and show feedback
   */
  validateInput() {
    const input = this.elements.queryInput;
    if (!input) return;

    const query = input.value.trim();
    
    // Remove any existing validation classes
    input.classList.remove('error', 'warning');

    if (query.length > this.maxLength) {
      input.classList.add('error');
    } else if (query.length > this.maxLength * 0.9) {
      input.classList.add('warning');
    }
  }

  /**
   * Handle query submission
   */
  async handleSubmit() {
    const input = this.elements.queryInput;
    if (!input) return;

    const query = input.value.trim();
    
    if (!query) {
      this.showInputError('Please enter a question');
      return;
    }

    if (query.length > this.maxLength) {
      this.showInputError(`Question is too long (${query.length}/${this.maxLength} characters)`);
      return;
    }

    // Clear any error states
    this.clearInputError();

    // Process the query
    await this.app.processQuery(query);
  }

  /**
   * Load suggestions from the API or fallback
   */
  loadSuggestions(suggestions) {
    this.suggestions = suggestions;
    this.renderSuggestions();
  }

  /**
   * Render suggestion buttons
   */
  renderSuggestions() {
    const container = this.elements.suggestions;
    if (!container) return;

    container.innerHTML = '';

    this.suggestions.forEach((suggestion, index) => {
      const button = document.createElement('button');
      button.className = 'suggestion-item';
      button.textContent = suggestion;
      button.addEventListener('click', () => {
        this.selectSuggestion(suggestion);
      });

      // Add keyboard navigation
      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectSuggestion(suggestion);
        }
      });

      container.appendChild(button);
    });
  }

  /**
   * Select a suggestion
   */
  selectSuggestion(suggestion) {
    const input = this.elements.queryInput;
    if (!input) return;

    input.value = suggestion;
    input.focus();
    
    // Update UI state
    this.updateCharCount();
    this.updateSubmitButton();
    this.autoResizeTextarea();

    // Scroll to input
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Set loading state
   */
  setLoading(isLoading) {
    const button = this.elements.submitButton;
    const btnText = this.elements.btnText;
    const btnLoader = this.elements.btnLoader;
    
    if (!button) return;

    if (isLoading) {
      button.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnLoader) btnLoader.style.display = 'inline';
    } else {
      if (btnText) btnText.style.display = 'inline';
      if (btnLoader) btnLoader.style.display = 'none';
      this.updateSubmitButton(); // Re-evaluate button state
    }
  }

  /**
   * Show input error
   */
  showInputError(message) {
    const input = this.elements.queryInput;
    if (!input) return;

    input.classList.add('error');
    
    // Create or update error message
    let errorDiv = input.parentNode.querySelector('.input-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'input-error';
      errorDiv.style.color = '#ef4444';
      errorDiv.style.fontSize = '0.9rem';
      errorDiv.style.marginTop = '0.5rem';
      input.parentNode.appendChild(errorDiv);
    }
    
    errorDiv.textContent = message;
    
    // Auto-clear error after 5 seconds
    setTimeout(() => {
      this.clearInputError();
    }, 5000);
  }

  /**
   * Clear input error
   */
  clearInputError() {
    const input = this.elements.queryInput;
    if (!input) return;

    input.classList.remove('error', 'warning');
    
    const errorDiv = input.parentNode.querySelector('.input-error');
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  /**
   * Get current query
   */
  getCurrentQuery() {
    return this.elements.queryInput?.value?.trim() || '';
  }

  /**
   * Set query text
   */
  setQuery(query) {
    const input = this.elements.queryInput;
    if (!input) return;

    input.value = query;
    this.updateCharCount();
    this.updateSubmitButton();
    this.autoResizeTextarea();
  }

  /**
   * Clear query
   */
  clearQuery() {
    this.setQuery('');
  }

  /**
   * Focus on input
   */
  focus() {
    this.elements.queryInput?.focus();
  }

  /**
   * Add example queries for different user types
   */
  getExampleQueries() {
    return {
      personal: [
        'How will this affect my taxes as a middle-class family?',
        'What changes are there to child tax credits?',
        'How does this impact my retirement savings?'
      ],
      business: [
        'What changes are there for small business owners?',
        'How will this affect business tax deductions?',
        'What are the new rules for business expenses?'
      ],
      policy: [
        'What environmental programs are being cut or funded?',
        'How does this impact SNAP benefits?',
        'What defense spending changes are included?'
      ]
    };
  }

  /**
   * Show example queries for a specific category
   */
  showExampleQueries(category = 'personal') {
    const examples = this.getExampleQueries()[category] || [];
    this.loadSuggestions(examples);
  }
}