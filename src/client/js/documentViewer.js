/**
 * Document Viewer Component
 * Handles document display, navigation, and highlighting
 */

class DocumentViewer {
  constructor(app) {
    this.app = app;
    this.elements = {
      viewer: document.getElementById('document-viewer'),
      showToc: document.getElementById('show-toc'),
      searchDoc: document.getElementById('search-doc'),
      documentSearch: document.getElementById('document-search'),
      docSearchInput: document.getElementById('doc-search-input'),
      docSearchBtn: document.getElementById('doc-search-btn'),
      closeSearch: document.getElementById('close-search'),
      tableOfContents: document.getElementById('table-of-contents'),
      tocContent: document.getElementById('toc-content')
    };
    
    this.documentStructure = null;
    this.currentSections = {};
    this.highlightedSections = [];
    this.searchResults = [];
    this.tocVisible = false;
    this.searchVisible = false;
    
    this.init();
  }

  /**
   * Initialize the document viewer
   */
  init() {
    this.setupEventListeners();
    this.showLoadingState();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Table of contents toggle
    this.elements.showToc?.addEventListener('click', () => {
      this.toggleTableOfContents();
    });

    // Document search toggle
    this.elements.searchDoc?.addEventListener('click', () => {
      this.toggleDocumentSearch();
    });

    // Search functionality
    this.elements.docSearchBtn?.addEventListener('click', () => {
      this.performDocumentSearch();
    });

    this.elements.docSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.performDocumentSearch();
      }
    });

    // Close search
    this.elements.closeSearch?.addEventListener('click', () => {
      this.hideDocumentSearch();
    });
  }

  /**
   * Load document structure
   */
  loadStructure(structure) {
    this.documentStructure = structure;
    this.renderTableOfContents();
    this.loadInitialContent();
  }

  /**
   * Show initial loading state
   */
  showLoadingState() {
    if (!this.elements.viewer) return;

    this.elements.viewer.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading bill content...</p>
      </div>
    `;
  }

  /**
   * Load initial document content
   */
  async loadInitialContent() {
    if (!this.documentStructure) return;

    try {
      // Load document metadata first
      const response = await fetch('/api/document/metadata');
      const data = await response.json();

      if (data.success) {
        this.renderDocumentOverview(data.metadata);
      } else {
        this.showError('Failed to load document metadata');
      }
    } catch (error) {
      console.error('Failed to load initial content:', error);
      this.showError('Failed to load document content');
    }
  }

  /**
   * Render document overview
   */
  renderDocumentOverview(metadata) {
    if (!this.elements.viewer) return;

    const overview = `
      <div class="document-overview">
        <div class="document-header">
          <h2>${metadata.title || 'H.R. 1 (2025)'}</h2>
          <div class="document-meta">
            <span class="meta-item">📅 ${metadata.date || 'July 1, 2025'}</span>
            <span class="meta-item">🏛️ ${metadata.congress || '119th Congress'}</span>
            <span class="meta-item">📊 ${metadata.statistics?.totalSections || 0} sections</span>
          </div>
        </div>
        
        <div class="document-description">
          <p>This is a comprehensive reconciliation bill covering multiple policy areas including agriculture, defense, banking, energy, environment, and tax policy.</p>
          <p><strong>To explore the bill:</strong></p>
          <ul>
            <li>Ask questions using the query interface on the left</li>
            <li>Browse the table of contents using the button above</li>
            <li>Search for specific terms using the search function</li>
          </ul>
        </div>

        <div class="quick-stats">
          <h3>Bill Overview</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-number">${metadata.statistics?.totalSections || 0}</span>
              <span class="stat-label">Total Sections</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">7</span>
              <span class="stat-label">Major Titles</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${metadata.statistics?.tocEntries || 0}</span>
              <span class="stat-label">TOC Entries</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.elements.viewer.innerHTML = overview;
  }

  /**
   * Toggle table of contents visibility
   */
  toggleTableOfContents() {
    const tocElement = this.elements.tableOfContents;
    if (!tocElement) return;

    this.tocVisible = !this.tocVisible;
    tocElement.style.display = this.tocVisible ? 'block' : 'none';

    // Update button text
    const button = this.elements.showToc;
    if (button) {
      button.textContent = this.tocVisible ? 'Hide Contents' : 'Table of Contents';
    }
  }

  /**
   * Render table of contents
   */
  renderTableOfContents() {
    const tocContent = this.elements.tocContent;
    if (!tocContent || !this.documentStructure?.toc) return;

    const toc = this.documentStructure.toc;
    let tocHtml = '';

    toc.forEach(entry => {
      const className = `toc-${entry.level}`;
      tocHtml += `
        <div class="toc-entry ${className}" data-section-id="${entry.id}">
          <span class="toc-title">${entry.title}</span>
        </div>
      `;
    });

    tocContent.innerHTML = tocHtml;

    // Add click handlers to TOC entries
    tocContent.querySelectorAll('.toc-entry').forEach(entry => {
      entry.addEventListener('click', () => {
        const sectionId = entry.getAttribute('data-section-id');
        this.navigateToSection(sectionId);
      });
    });
  }

  /**
   * Toggle document search visibility
   */
  toggleDocumentSearch() {
    const searchElement = this.elements.documentSearch;
    if (!searchElement) return;

    this.searchVisible = !this.searchVisible;
    searchElement.style.display = this.searchVisible ? 'flex' : 'none';

    if (this.searchVisible) {
      this.elements.docSearchInput?.focus();
    }
  }

  /**
   * Hide document search
   */
  hideDocumentSearch() {
    const searchElement = this.elements.documentSearch;
    if (!searchElement) return;

    this.searchVisible = false;
    searchElement.style.display = 'none';
  }

  /**
   * Perform document search
   */
  async performDocumentSearch() {
    const input = this.elements.docSearchInput;
    if (!input) return;

    const searchTerm = input.value.trim();
    if (!searchTerm) return;

    try {
      const response = await fetch(`/api/document/search/${encodeURIComponent(searchTerm)}`);
      const data = await response.json();

      if (data.success) {
        this.displaySearchResults(data.results, searchTerm);
      } else {
        this.showError('Search failed: ' + data.error?.message);
      }
    } catch (error) {
      console.error('Search failed:', error);
      this.showError('Search failed');
    }
  }

  /**
   * Display search results
   */
  displaySearchResults(results, searchTerm) {
    if (!this.elements.viewer) return;

    if (results.length === 0) {
      this.elements.viewer.innerHTML = `
        <div class="search-results">
          <h3>No Results Found</h3>
          <p>No sections found for "${searchTerm}"</p>
          <button class="btn btn-secondary" onclick="window.app.components.documentViewer.loadInitialContent()">
            Back to Overview
          </button>
        </div>
      `;
      return;
    }

    let resultsHtml = `
      <div class="search-results">
        <div class="search-header">
          <h3>Search Results for "${searchTerm}"</h3>
          <p>Found ${results.length} section(s)</p>
          <button class="btn btn-secondary" onclick="window.app.components.documentViewer.loadInitialContent()">
            Back to Overview
          </button>
        </div>
        <div class="search-results-list">
    `;

    results.forEach(result => {
      resultsHtml += `
        <div class="search-result-item" data-section-id="${result.id}">
          <div class="result-header">
            <h4>${result.title}</h4>
            <span class="result-score">Score: ${result.score}</span>
          </div>
          <div class="result-excerpt">${result.excerpt}</div>
          <button class="btn btn-small" onclick="window.app.components.documentViewer.loadSection('${result.id}')">
            View Full Section
          </button>
        </div>
      `;
    });

    resultsHtml += '</div></div>';
    this.elements.viewer.innerHTML = resultsHtml;
  }

  /**
   * Navigate to a specific section
   */
  async navigateToSection(sectionId) {
    this.scrollToSection(sectionId);
    await this.loadSection(sectionId);
  }

  /**
   * Load and display a specific section
   */
  async loadSection(sectionId) {
    if (!sectionId) return;

    try {
      const response = await fetch(`/api/document/section/${sectionId}?includeChildren=true`);
      const data = await response.json();

      if (data.success) {
        this.displaySection(data.section);
        this.currentSections[sectionId] = data.section;
      } else {
        this.showError('Failed to load section: ' + data.error?.message);
      }
    } catch (error) {
      console.error('Failed to load section:', error);
      this.showError('Failed to load section');
    }
  }

  /**
   * Display a section
   */
  displaySection(section) {
    if (!this.elements.viewer || !section) return;

    const sectionHtml = `
      <div class="section-display">
        <div class="section-header">
          <button class="btn btn-secondary back-btn" onclick="window.app.components.documentViewer.loadInitialContent()">
            ← Back to Overview
          </button>
          <div class="section-meta">
            <span class="section-type">${section.type}</span>
            <span class="section-id">ID: ${section.id}</span>
          </div>
        </div>
        
        <div class="section-content">
          <h2 class="section-title">${section.title}</h2>
          
          ${section.content ? `
            <div class="section-text">
              <h3>Summary</h3>
              <p>${section.content}</p>
            </div>
          ` : ''}
          
          <div class="section-full-text">
            <h3>Full Text</h3>
            <div class="full-text-content">${this.formatSectionText(section.fullText)}</div>
          </div>
          
          ${section.childSections && section.childSections.length > 0 ? `
            <div class="child-sections">
              <h3>Subsections</h3>
              ${section.childSections.map(child => `
                <div class="child-section" data-section-id="${child.id}">
                  <h4>${child.title}</h4>
                  <p>${this.truncateText(child.content, 200)}</p>
                  <button class="btn btn-small" onclick="window.app.components.documentViewer.loadSection('${child.id}')">
                    View Details
                  </button>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this.elements.viewer.innerHTML = sectionHtml;
  }

  /**
   * Format section text for display
   */
  formatSectionText(text) {
    if (!text) return '';

    // Convert line breaks to paragraphs
    return text.split('\n\n')
      .filter(p => p.trim().length > 0)
      .map(p => `<p>${p.trim()}</p>`)
      .join('');
  }

  /**
   * Truncate text to specified length
   */
  truncateText(text, maxLength = 200) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Highlight sections related to a query response
   */
  highlightSections(sectionIds) {
    this.highlightedSections = sectionIds;
    
    // If we're showing search results or a specific section, update highlighting
    if (this.elements.viewer) {
      const existingSections = this.elements.viewer.querySelectorAll('[data-section-id]');
      existingSections.forEach(element => {
        const id = element.getAttribute('data-section-id');
        if (sectionIds.includes(id)) {
          element.classList.add('highlighted');
        } else {
          element.classList.remove('highlighted');
        }
      });
    }
  }

  /**
   * Scroll to a section (smooth scroll if visible)
   */
  scrollToSection(sectionId) {
    const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionElement) {
      sectionElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Add temporary highlight
      sectionElement.classList.add('flash-highlight');
      setTimeout(() => {
        sectionElement.classList.remove('flash-highlight');
      }, 2000);
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (!this.elements.viewer) return;

    this.elements.viewer.innerHTML = `
      <div class="error-state">
        <h3>❌ Error</h3>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="window.app.components.documentViewer.loadInitialContent()">
          Try Again
        </button>
      </div>
    `;
  }

  /**
   * Get current document state
   */
  getState() {
    return {
      currentSections: this.currentSections,
      highlightedSections: this.highlightedSections,
      tocVisible: this.tocVisible,
      searchVisible: this.searchVisible
    };
  }

  /**
   * Clear all highlights
   */
  clearHighlights() {
    this.highlightedSections = [];
    
    const highlightedElements = this.elements.viewer?.querySelectorAll('.highlighted');
    highlightedElements?.forEach(element => {
      element.classList.remove('highlighted');
    });
  }
}