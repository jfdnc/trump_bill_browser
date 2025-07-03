const documentParser = require('./documentParser');
const llmService = require('./llmService');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');
const textUtils = require('../utils/textUtils');

class QueryProcessor {
  constructor() {
    this.processingCount = 0;
  }

  /**
   * Process user query and return structured response
   * @param {string} query - User query
   * @param {Object} options - Processing options
   * @returns {Object} Structured response
   */
  async processQuery(query, options = {}) {
    try {
      this.processingCount++;
      const startTime = Date.now();
      
      logger.info(`Processing query #${this.processingCount}: ${query.substring(0, 100)}...`);
      
      // Validate input
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Query is required and must be a non-empty string');
      }
      
      const normalizedQuery = textUtils.normalizeText(query);
      
      // Check cache first
      const useCache = options.useCache !== false; // Default to true
      if (useCache) {
        const cachedResponse = cacheService.getWithSemantic(normalizedQuery, options.useSemantic !== false);
        if (cachedResponse) {
          logger.info(`Returning cached response for query #${this.processingCount}`);
          return {
            ...cachedResponse,
            fromCache: true,
            processingTime: Date.now() - startTime
          };
        }
      }
      
      // Process with LLM using MCP tools
      const llmResponse = await llmService.queryDocument(normalizedQuery);
      
      // Format final response
      const finalResponse = this.formatResponse(llmResponse, [], query);
      
      // Cache the response
      if (useCache) {
        cacheService.set(normalizedQuery, finalResponse);
      }
      
      const processingTime = Date.now() - startTime;
      logger.info(`Query #${this.processingCount} processed in ${processingTime}ms`);
      
      return {
        ...finalResponse,
        fromCache: false,
        processingTime
      };
      
    } catch (error) {
      logger.error(`Failed to process query #${this.processingCount}:`, error);
      
      // Return error response
      return {
        success: false,
        error: {
          message: error.message,
          type: 'processing_error'
        },
        query,
        processingTime: Date.now() - (this.startTime || Date.now())
      };
    }
  }

  /**
   * Identify relevant sections for the query
   * @param {string} query - Normalized query
   * @param {Object} options - Search options
   * @returns {Array} Array of relevant sections
   */
  identifyRelevantSections(query, options = {}) {
    const maxSections = options.maxSections || 5;
    const minScore = options.minScore || 0;
    
    // First try: keyword-based search
    const keywordResults = documentParser.searchSections(query, maxSections * 2);
    
    // Second try: semantic matching for better results
    const allSections = Object.values(documentParser.getDocumentData().sections);
    const semanticResults = this.performSemanticSearch(query, allSections, maxSections);
    
    // Combine and deduplicate results
    const combinedResults = this.combineSearchResults(keywordResults, semanticResults);
    
    // Filter by minimum score and limit results
    return combinedResults
      .filter(result => result.score >= minScore)
      .slice(0, maxSections)
      .map(result => result.section);
  }

  /**
   * Perform semantic search on sections
   * @param {string} query - Query text
   * @param {Array} sections - All document sections
   * @param {number} maxResults - Maximum results to return
   * @returns {Array} Array of scored sections
   */
  performSemanticSearch(query, sections, maxResults) {
    const results = [];
    
    sections.forEach(section => {
      // Calculate similarity scores
      const titleSimilarity = textUtils.calculateSimilarity(query, section.title) * 2; // Weight title higher
      const contentSimilarity = textUtils.calculateSimilarity(query, section.fullText);
      
      const combinedScore = titleSimilarity + contentSimilarity;
      
      if (combinedScore > 0) {
        results.push({
          section,
          score: combinedScore,
          titleSimilarity,
          contentSimilarity
        });
      }
    });
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Combine and deduplicate search results
   * @param {Array} keywordResults - Results from keyword search
   * @param {Array} semanticResults - Results from semantic search
   * @returns {Array} Combined and deduplicated results
   */
  combineSearchResults(keywordResults, semanticResults) {
    const resultMap = new Map();
    
    // Add keyword results
    keywordResults.forEach(result => {
      resultMap.set(result.section.id, {
        section: result.section,
        score: result.score,
        source: 'keyword'
      });
    });
    
    // Add semantic results, combining scores if already present
    semanticResults.forEach(result => {
      const existing = resultMap.get(result.section.id);
      if (existing) {
        // Combine scores from both methods
        existing.score = (existing.score + result.score) / 2;
        existing.source = 'combined';
      } else {
        resultMap.set(result.section.id, {
          section: result.section,
          score: result.score,
          source: 'semantic'
        });
      }
    });
    
    // Convert back to array and sort by score
    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Create response for queries with no results
   * @param {string} query - Original query
   * @returns {Object} No results response
   */
  createNoResultsResponse(query) {
    return {
      success: true,
      answer: `I couldn't find specific information in H.R. 1 (2025) that directly addresses your question: "${query}". This might be because:

1. The topic you're asking about may not be covered in this particular bill
2. The information might be in a section that wasn't matched by the search
3. The question might need to be phrased differently

You could try:
- Using different keywords related to your question
- Being more specific about what aspect you're interested in
- Asking about broader policy areas covered in the bill (agriculture, defense, banking, energy, environment, tax policy)`,
      sections: [],
      keyPoints: [
        'No specific sections found for this query',
        'Consider rephrasing the question',
        'H.R. 1 covers agriculture, defense, banking, energy, environment, and tax policy'
      ],
      implications: 'This query may not be addressed in the current bill, or may require different search terms.',
      confidence: 'low',
      query,
      relevantSections: []
    };
  }

  /**
   * Format the final response
   * @param {Object} llmResponse - Response from LLM service
   * @param {Array} relevantSections - Sections used for context (now empty with MCP)
   * @param {string} originalQuery - Original user query
   * @returns {Object} Formatted response
   */
  formatResponse(llmResponse, relevantSections, originalQuery) {
    return {
      success: true,
      answer: llmResponse.answer,
      sections: llmResponse.sections || [],
      keyPoints: llmResponse.keyPoints || [],
      implications: llmResponse.implications || '',
      confidence: llmResponse.confidence || 'medium',
      query: originalQuery,
      relevantSections: llmResponse.relevantSections || [],
      metadata: {
        ...llmResponse.metadata,
        sectionsAnalyzed: (llmResponse.relevantSections || []).length,
        queryType: this.classifyQuery(originalQuery),
        processingMethod: 'llm_with_mcp'
      }
    };
  }

  /**
   * Classify the type of query
   * @param {string} query - User query
   * @returns {string} Query classification
   */
  classifyQuery(query) {
    const normalizedQuery = textUtils.normalizeText(query);
    
    // Pattern matching for different query types
    if (normalizedQuery.match(/\b(tax|taxes|taxation|income|deduction|credit)\b/)) {
      return 'tax_related';
    }
    
    if (normalizedQuery.match(/\b(military|defense|security|armed forces)\b/)) {
      return 'defense_related';
    }
    
    if (normalizedQuery.match(/\b(environment|climate|green|emission|pollution)\b/)) {
      return 'environment_related';
    }
    
    if (normalizedQuery.match(/\b(agriculture|farm|food|snap|nutrition)\b/)) {
      return 'agriculture_related';
    }
    
    if (normalizedQuery.match(/\b(banking|finance|financial|housing)\b/)) {
      return 'banking_related';
    }
    
    if (normalizedQuery.match(/\b(energy|oil|gas|petroleum|renewable)\b/)) {
      return 'energy_related';
    }
    
    if (normalizedQuery.match(/\b(how will|impact|affect|implications?|consequences?)\b/)) {
      return 'impact_analysis';
    }
    
    if (normalizedQuery.match(/\b(what is|what does|define|explain)\b/)) {
      return 'definition_request';
    }
    
    return 'general_inquiry';
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  getStats() {
    return {
      processingCount: this.processingCount,
      cacheStats: cacheService.getStats(),
      llmStats: llmService.getStats()
    };
  }

  /**
   * Reset processing statistics
   */
  resetStats() {
    this.processingCount = 0;
    cacheService.clear();
    llmService.resetStats();
    logger.info('Query processor statistics reset');
  }

  /**
   * Get query suggestions based on document content
   * @param {number} limit - Number of suggestions to return
   * @returns {Array} Array of suggested queries
   */
  getQuerySuggestions(limit = 5) {
    const suggestions = [
      'How will this bill affect my taxes as a middle-class family?',
      'What changes are there for small business owners?',
      'How does this impact SNAP benefits and food assistance?',
      'What defense spending changes are included?',
      'How will this affect oil and gas development?',
      'What environmental programs are being cut or funded?',
      'How does this impact agricultural programs?',
      'What banking and financial reforms are included?',
      'How will this affect federal employee benefits?',
      'What changes are there to tax deductions?'
    ];
    
    return suggestions.slice(0, limit);
  }

  /**
   * Validate query before processing
   * @param {string} query - Query to validate
   * @returns {Object} Validation result
   */
  validateQuery(query) {
    const errors = [];
    
    if (!query) {
      errors.push('Query is required');
    }
    
    if (typeof query !== 'string') {
      errors.push('Query must be a string');
    }
    
    if (query && query.trim().length === 0) {
      errors.push('Query cannot be empty');
    }
    
    if (query && query.length > 1000) {
      errors.push('Query is too long (maximum 1000 characters)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
module.exports = new QueryProcessor();