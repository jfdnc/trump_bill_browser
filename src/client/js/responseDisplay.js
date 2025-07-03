/**
 * Response Display Component
 * Handles displaying AI responses with proper formatting and interactions
 */

class ResponseDisplay {
  constructor(app) {
    this.app = app;
    this.elements = {
      container: document.getElementById('response-container'),
      answer: document.getElementById('response-answer'),
      keyPoints: document.getElementById('key-points'),
      keyPointsList: document.getElementById('key-points-list'),
      implications: document.getElementById('implications'),
      implicationsText: document.getElementById('implications-text'),
      relevantSections: document.getElementById('relevant-sections'),
      sectionsList: document.getElementById('sections-list'),
      confidenceIndicator: document.getElementById('confidence-indicator'),
      processingTime: document.getElementById('processing-time')
    };
    
    this.currentResponse = null;
    this.init();
  }

  /**
   * Initialize the response display
   */
  init() {
    // Hide container initially
    if (this.elements.container) {
      this.elements.container.style.display = 'none';
    }
  }

  /**
   * Display a response from the API
   */
  displayResponse(response) {
    console.log('Displaying response:', response); // Debug log
    this.currentResponse = response;
    
    if (!this.elements.container) {
      console.error('Response container not found!'); // Debug log
      return;
    }

    // Show the container
    this.elements.container.style.display = 'block';
    
    // Show all elements that might have been hidden during loading
    if (this.elements.keyPoints) this.elements.keyPoints.style.display = 'block';
    if (this.elements.implications) this.elements.implications.style.display = 'block';
    if (this.elements.relevantSections) this.elements.relevantSections.style.display = 'block';
    if (this.elements.confidenceIndicator) this.elements.confidenceIndicator.style.display = 'block';
    if (this.elements.processingTime) this.elements.processingTime.style.display = 'block';
    
    // Display main answer
    this.displayAnswer(response.answer);
    
    // Display confidence indicator
    this.displayConfidence(response.confidence);
    
    // Display processing time
    this.displayProcessingTime(response.processingTime, response.fromCache);
    
    // Display key points
    this.displayKeyPoints(response.keyPoints);
    
    // Display implications
    this.displayImplications(response.implications);
    
    // Display relevant sections
    this.displayRelevantSections(response.relevantSections);
    
    // Scroll to response
    this.scrollToResponse();
  }

  /**
   * Display the main answer
   */
  displayAnswer(answer) {
    const element = this.elements.answer;
    if (!element || !answer) return;

    // Process the answer text for better formatting
    const formattedAnswer = this.formatAnswerText(answer);
    element.innerHTML = formattedAnswer;
  }

  /**
   * Format answer text with proper HTML
   */
  formatAnswerText(text) {
    if (!text) return '';

    // Convert line breaks to paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    
    return paragraphs.map(paragraph => {
      // Handle lists
      if (paragraph.includes('\n- ') || paragraph.includes('\n• ')) {
        const lines = paragraph.split('\n');
        const listItems = lines.filter(line => line.match(/^[•\-]\s/));
        const otherLines = lines.filter(line => !line.match(/^[•\-]\s/));
        
        let html = otherLines.join('<br>');
        if (listItems.length > 0) {
          const listHtml = '<ul>' + listItems.map(item => 
            `<li>${item.replace(/^[•\-]\s/, '')}</li>`
          ).join('') + '</ul>';
          html += listHtml;
        }
        return `<div class="answer-paragraph">${html}</div>`;
      }
      
      // Regular paragraphs
      return `<p class="answer-paragraph">${paragraph}</p>`;
    }).join('');
  }

  /**
   * Display confidence indicator
   */
  displayConfidence(confidence) {
    const element = this.elements.confidenceIndicator;
    if (!element) return;

    // Remove existing confidence classes
    element.classList.remove('confidence-high', 'confidence-medium', 'confidence-low');
    
    // Add appropriate class and text
    switch (confidence) {
      case 'high':
        element.classList.add('confidence-high');
        element.textContent = 'High Confidence';
        break;
      case 'medium':
        element.classList.add('confidence-medium');
        element.textContent = 'Medium Confidence';
        break;
      case 'low':
        element.classList.add('confidence-low');
        element.textContent = 'Low Confidence';
        break;
      default:
        element.classList.add('confidence-medium');
        element.textContent = 'Medium Confidence';
    }
  }

  /**
   * Display processing time
   */
  displayProcessingTime(processingTime, fromCache = false) {
    const element = this.elements.processingTime;
    if (!element) return;

    const timeInSeconds = (processingTime / 1000).toFixed(1);
    const cacheText = fromCache ? ' (cached)' : '';
    element.textContent = `${timeInSeconds}s${cacheText}`;
  }

  /**
   * Display key points
   */
  displayKeyPoints(keyPoints) {
    const section = this.elements.keyPoints;
    const list = this.elements.keyPointsList;
    
    if (!section || !list) return;

    if (!keyPoints || keyPoints.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = '';

    keyPoints.forEach(point => {
      const li = document.createElement('li');
      li.textContent = point;
      list.appendChild(li);
    });
  }

  /**
   * Display implications
   */
  displayImplications(implications) {
    const section = this.elements.implications;
    const text = this.elements.implicationsText;
    
    if (!section || !text) return;

    if (!implications || implications.trim().length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    text.textContent = implications;
  }

  /**
   * Display relevant sections
   */
  displayRelevantSections(sections) {
    const section = this.elements.relevantSections;
    const list = this.elements.sectionsList;
    
    if (!section || !list) return;

    if (!sections || sections.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = '';

    sections.forEach(sectionData => {
      const sectionDiv = this.createSectionReference(sectionData);
      list.appendChild(sectionDiv);
    });
  }

  /**
   * Create a section reference element
   */
  createSectionReference(sectionData) {
    const div = document.createElement('div');
    div.className = 'section-reference';
    div.setAttribute('data-section-id', sectionData.id);

    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = sectionData.title || `Section ${sectionData.id}`;

    const excerpt = document.createElement('div');
    excerpt.className = 'section-excerpt';
    excerpt.innerHTML = sectionData.excerpt || 'No excerpt available';

    div.appendChild(title);
    div.appendChild(excerpt);

    // Add click handler to navigate to section
    div.addEventListener('click', () => {
      this.navigateToSection(sectionData.id);
    });

    // Add keyboard navigation
    div.setAttribute('tabindex', '0');
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.navigateToSection(sectionData.id);
      }
    });

    return div;
  }

  /**
   * Navigate to a specific section
   */
  navigateToSection(sectionId) {
    this.app.navigateToSection(sectionId);
    
    // Visual feedback
    const sectionRef = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionRef) {
      sectionRef.classList.add('active');
      setTimeout(() => {
        sectionRef.classList.remove('active');
      }, 2000);
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.elements.container) return;

    // Show the container
    this.elements.container.style.display = 'block';
    
    // Clear existing content and show loading
    if (this.elements.answer) {
      this.elements.answer.innerHTML = `
        <div class="response-loading">
          <div class="loading-spinner"></div>
          <p>Analyzing the bill and preparing your answer...</p>
        </div>
      `;
    }
    
    // Hide other sections during loading
    if (this.elements.keyPoints) this.elements.keyPoints.style.display = 'none';
    if (this.elements.implications) this.elements.implications.style.display = 'none';
    if (this.elements.relevantSections) this.elements.relevantSections.style.display = 'none';
    if (this.elements.confidenceIndicator) this.elements.confidenceIndicator.style.display = 'none';
    if (this.elements.processingTime) this.elements.processingTime.style.display = 'none';

    this.scrollToResponse();
  }

  /**
   * Show error state
   */
  showError(error) {
    if (!this.elements.container) return;

    this.elements.container.style.display = 'block';
    this.elements.container.innerHTML = `
      <div class="response-error">
        <h3>❌ Analysis Failed</h3>
        <p>We encountered an error while analyzing your question:</p>
        <p class="error-message">${error}</p>
        <button class="btn btn-primary" onclick="window.app.components.queryInterface.focus()">
          Try Another Question
        </button>
      </div>
    `;

    this.scrollToResponse();
  }

  /**
   * Scroll to response container
   */
  scrollToResponse() {
    if (this.elements.container) {
      setTimeout(() => {
        this.elements.container.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  }

  /**
   * Hide response container
   */
  hide() {
    if (this.elements.container) {
      this.elements.container.style.display = 'none';
    }
  }

  /**
   * Export response data
   */
  exportResponse() {
    if (!this.currentResponse) return null;

    return {
      query: this.currentResponse.query,
      answer: this.currentResponse.answer,
      keyPoints: this.currentResponse.keyPoints,
      implications: this.currentResponse.implications,
      confidence: this.currentResponse.confidence,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Share response (stub for future implementation)
   */
  shareResponse() {
    const exportData = this.exportResponse();
    if (!exportData) return;

    // For now, copy to clipboard
    const shareText = `Question: ${exportData.query}\n\nAnswer: ${exportData.answer}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        // Show temporary feedback
        this.showTemporaryMessage('Response copied to clipboard!');
      });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showTemporaryMessage('Response copied to clipboard!');
    }
  }

  /**
   * Show temporary message
   */
  showTemporaryMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'temporary-message';
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }

  /**
   * Get current response
   */
  getCurrentResponse() {
    return this.currentResponse;
  }
}