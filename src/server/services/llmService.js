const axios = require('axios');
const logger = require('../utils/logger');
const textUtils = require('../utils/textUtils');

class LLMService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
    
    if (!this.apiKey) {
      logger.error('ANTHROPIC_API_KEY not found in environment variables');
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    
    this.requestCount = 0;
    this.totalTokens = 0;
  }

  /**
   * Query the document using Claude API with MCP tools
   * @param {string} query - User query
   * @returns {Object} Structured response from Claude
   */
  async queryDocument(query) {
    try {
      this.requestCount++;
      
      const prompt = this.formatMCPPrompt(query);
      
      logger.debug(`Sending query to Claude API with MCP tools (request #${this.requestCount})`);
      
      const response = await this.makeApiCall(prompt);
      const parsedResponse = this.parseResponse(response);
      
      // Track token usage
      if (response.usage) {
        this.totalTokens += response.usage.input_tokens + response.usage.output_tokens;
        logger.debug(`Token usage - Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}, Total: ${this.totalTokens}`);
      }
      
      return parsedResponse;
      
    } catch (error) {
      logger.error('Failed to query document:', error);
      throw error;
    }
  }

  /**
   * Format prompt for MCP-enabled Claude API
   * @param {string} query - User query
   * @returns {string} Formatted prompt
   */
  formatMCPPrompt(query) {
    return `You are an expert analyst helping citizens understand legislation. You are analyzing H.R. 1 (2025), a comprehensive bill covering multiple policy areas including agriculture, defense, banking, energy, environment, and tax policy.

You have access to MCP tools that allow you to query the document directly. IMPORTANT: To avoid rate limits, limit yourself to 3-4 tool calls maximum. Use these tools efficiently:

- search_sections: Search for sections by keywords or phrases  
- search_by_topic: Search for sections related to specific policy topics (tax, defense, agriculture, energy, environment, banking, healthcare, education, immigration, housing)
- search_financial_impact: Search for financial impacts, costs, or budget items
- get_section_by_id: Get a specific section by its ID (use sparingly)
- get_bill_overview: Get a high-level overview of the bill (use if needed for context)

USER QUESTION: ${query}

Please efficiently use 2-3 MCP tools to gather the most relevant information, then provide your response. Be strategic - start with topic searches rather than general searches.

Format your final response as JSON with this structure:
{
  "answer": "Your comprehensive answer here",
  "sections": ["array", "of", "relevant", "section", "ids"],
  "keyPoints": ["array", "of", "key", "takeaways"],
  "implications": "Summary of what this means for the user",
  "confidence": "high/medium/low based on available information"
}

Start with the most relevant tool call for this question.`;
  }


  /**
   * Make API call to Claude with MCP tools
   * @param {string} prompt - Formatted prompt
   * @returns {Object} API response
   */
  async makeApiCall(prompt) {
    const payload = {
      model: this.model,
      max_tokens: 3000, // Increased for complete responses
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      tools: [
        {
          name: 'search_sections',
          description: 'Search for sections in the bill by keywords or phrases',
          input_schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query - keywords or phrases to find relevant sections'
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                default: 5
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_section_by_id',
          description: 'Get a specific section by its ID',
          input_schema: {
            type: 'object',
            properties: {
              sectionId: {
                type: 'string',
                description: 'The ID of the section to retrieve'
              }
            },
            required: ['sectionId']
          }
        },
        {
          name: 'search_by_topic',
          description: 'Search for sections related to specific policy topics',
          input_schema: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Policy topic to search for',
                enum: ['tax', 'defense', 'agriculture', 'energy', 'environment', 'banking', 'healthcare', 'education', 'immigration', 'housing']
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                default: 5
              }
            },
            required: ['topic']
          }
        },
        {
          name: 'get_bill_overview',
          description: 'Get a high-level overview of the bill structure and main topics',
          input_schema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'search_financial_impact',
          description: 'Search for sections that mention financial impacts, costs, or budget items',
          input_schema: {
            type: 'object',
            properties: {
              impactType: {
                type: 'string',
                description: 'Type of financial impact to search for',
                enum: ['appropriation', 'funding', 'cost', 'budget', 'spending', 'revenue', 'tax_change']
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                default: 5
              }
            },
            required: ['impactType']
          }
        }
      ]
    };
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000 // 60 second timeout for MCP operations
    };
    
    try {
      const response = await axios.post(this.baseUrl, payload, config);
      
      // Handle tool calls if present
      if (response.data.content && response.data.content.some(item => item.type === 'tool_use')) {
        return await this.handleToolCallsRecursively(response.data, payload, config);
      }
      
      return response.data;
    } catch (error) {
      if (error.response) {
        // API error response
        logger.error('Claude API error:', error.response.data);
        
        // Handle rate limiting specifically
        if (error.response.data.error?.type === 'rate_limit_error') {
          throw new Error('Service temporarily busy due to rate limits. Please try again in a moment.');
        }
        
        throw new Error(`Claude API error: ${error.response.data.error?.message || 'Unknown error'}`);
      } else if (error.request) {
        // Network error
        logger.error('Network error calling Claude API:', error.message);
        throw new Error('Network error connecting to Claude API');
      } else {
        // Other error
        logger.error('Unexpected error:', error.message);
        throw new Error('Unexpected error calling Claude API');
      }
    }
  }

  /**
   * Handle tool calls with simpler approach to avoid API errors
   * @param {Object} response - Response with tool calls
   * @param {Object} originalPayload - Original payload
   * @param {Object} config - Request config
   * @returns {Object} Final response
   */
  async handleToolCallsRecursively(response, originalPayload, config) {
    let currentResponse = response;
    let conversationHistory = [...originalPayload.messages];
    let iterationCount = 0;
    const maxIterations = 3;
    
    while (currentResponse.content && 
           currentResponse.content.some(item => item.type === 'tool_use') && 
           iterationCount < maxIterations) {
      
      logger.debug(`Tool call iteration ${iterationCount + 1}/${maxIterations}`);
      
      // Execute tool calls for current response
      const toolResults = await this.executeToolCalls(currentResponse);
      
      // Add assistant message with tool calls
      conversationHistory.push({
        role: 'assistant',
        content: currentResponse.content
      });
      
      // Add user message with tool results
      conversationHistory.push({
        role: 'user',
        content: toolResults
      });
      
      // Validate message pairing
      const lastAssistantMsg = conversationHistory[conversationHistory.length - 2];
      const lastUserMsg = conversationHistory[conversationHistory.length - 1];
      
      if (lastAssistantMsg && lastAssistantMsg.role === 'assistant') {
        const toolUses = lastAssistantMsg.content.filter(item => item.type === 'tool_use');
        const toolResults = lastUserMsg.content.filter ? lastUserMsg.content.filter(item => item.type === 'tool_result') : [];
        
        logger.debug(`Message pair validation: ${toolUses.length} tool_use, ${toolResults.length} tool_result`);
        
        if (toolUses.length !== toolResults.length) {
          logger.error(`Tool use/result mismatch: ${toolUses.length} vs ${toolResults.length}`);
        }
      }
      
      // Make next request
      const nextPayload = {
        ...originalPayload,
        messages: conversationHistory
      };
      
      logger.debug(`Making request ${iterationCount + 1} with ${conversationHistory.length} messages`);
      const nextResponse = await axios.post(this.baseUrl, nextPayload, config);
      
      currentResponse = nextResponse.data;
      iterationCount++;
    }
    
    // If we hit max iterations and still have tool calls, execute them first then force a final response
    if (iterationCount >= maxIterations && 
        currentResponse.content && 
        currentResponse.content.some(item => item.type === 'tool_use')) {
      
      logger.warn(`Hit max iterations with pending tool calls, executing them before forcing final response`);
      
      // Execute the pending tool calls
      const finalToolResults = await this.executeToolCalls(currentResponse);
      
      // Add assistant message with tool calls
      conversationHistory.push({
        role: 'assistant',
        content: currentResponse.content
      });
      
      // Add user message with tool results (required)
      conversationHistory.push({
        role: 'user',
        content: finalToolResults
      });
      
      // Now force final response with complete conversation history
      conversationHistory.push({
        role: 'user',
        content: [{
          type: 'text',
          text: 'Based on all the information gathered from the tools above, please provide your final JSON response using this exact format: {"answer": "comprehensive answer", "sections": ["relevant section IDs"], "keyPoints": ["key takeaways"], "implications": "what this means", "confidence": "high/medium/low"}'
        }]
      });
      
      const finalPayload = {
        ...originalPayload,
        messages: conversationHistory
      };
      
      const finalResponse = await axios.post(this.baseUrl, finalPayload, config);
      return finalResponse.data;
    }
    
    return currentResponse;
  }

  /**
   * Execute tool calls and return results
   * @param {Object} response - Response with tool calls
   * @returns {Array} Tool results
   */
  async executeToolCalls(response) {
    const toolCalls = response.content.filter(item => item.type === 'tool_use');
    const toolResults = [];
    
    for (const toolCall of toolCalls) {
      try {
        logger.debug(`Executing tool: ${toolCall.name} with input:`, toolCall.input);
        
        let result;
        switch (toolCall.name) {
          case 'search_sections':
            result = await this.executeSearchSections(toolCall.input);
            break;
          case 'get_section_by_id':
            result = await this.executeGetSectionById(toolCall.input);
            break;
          case 'search_by_topic':
            result = await this.executeSearchByTopic(toolCall.input);
            break;
          case 'get_bill_overview':
            result = await this.executeGetBillOverview(toolCall.input);
            break;
          case 'search_financial_impact':
            result = await this.executeSearchFinancialImpact(toolCall.input);
            break;
          default:
            result = { error: `Unknown tool: ${toolCall.name}` };
        }
        
        toolResults.push({
          tool_use_id: toolCall.id,
          type: 'tool_result',
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
        
      } catch (error) {
        logger.error(`Error executing tool ${toolCall.name}:`, error);
        toolResults.push({
          tool_use_id: toolCall.id,
          type: 'tool_result',
          content: JSON.stringify({ error: error.message })
        });
      }
    }
    
    // Validate that we have a tool_result for every tool_use
    const toolUseIds = toolCalls.map(call => call.id);
    const toolResultIds = toolResults.map(result => result.tool_use_id);
    
    for (const toolUseId of toolUseIds) {
      if (!toolResultIds.includes(toolUseId)) {
        logger.error(`Missing tool_result for tool_use_id: ${toolUseId}`);
        // Add a fallback result
        toolResults.push({
          tool_use_id: toolUseId,
          type: 'tool_result',
          content: JSON.stringify({ error: 'Tool execution failed' })
        });
      }
    }
    
    logger.debug(`Executed ${toolCalls.length} tool calls, generated ${toolResults.length} results`);
    return toolResults;
  }


  /**
   * Execute search_sections tool
   */
  async executeSearchSections(input) {
    const documentParser = require('./documentParser');
    const textUtils = require('../utils/textUtils');
    const { query, maxResults = 3 } = input; // Reduce default results
    
    const documentData = documentParser.getDocumentData();
    if (!documentData || !documentData.sections) {
      throw new Error('Document data not available');
    }

    const searchResults = documentParser.searchSections(query, Math.min(maxResults, 3));
    
    return {
      query: query,
      results: searchResults.map(result => ({
        id: result.section.id,
        title: result.section.title,
        content: textUtils.truncateText(result.section.fullText, 300), // More aggressive truncation
        level: result.section.level,
        type: result.section.type,
        score: result.score,
        excerpt: textUtils.truncateText(result.section.fullText, 200)
      })),
      totalFound: searchResults.length
    };
  }

  /**
   * Execute get_section_by_id tool
   */
  async executeGetSectionById(input) {
    const documentParser = require('./documentParser');
    const textUtils = require('../utils/textUtils');
    const { sectionId } = input;
    
    const documentData = documentParser.getDocumentData();
    if (!documentData || !documentData.sections) {
      throw new Error('Document data not available');
    }

    const section = documentData.sections[sectionId];
    if (!section) {
      throw new Error(`Section with ID "${sectionId}" not found`);
    }

    return {
      id: section.id,
      title: section.title,
      content: textUtils.truncateText(section.fullText, 600), // More aggressive truncation
      level: section.level,
      type: section.type,
      parent: section.parent,
      children: section.children || []
    };
  }

  /**
   * Execute search_by_topic tool
   */
  async executeSearchByTopic(input) {
    const documentParser = require('./documentParser');
    const textUtils = require('../utils/textUtils');
    const { topic, maxResults = 3 } = input; // Reduce default results
    
    const topicKeywords = {
      'tax': ['tax', 'taxes', 'taxation', 'income', 'deduction', 'credit', 'revenue', 'IRS'],
      'defense': ['defense', 'military', 'armed forces', 'national security', 'pentagon', 'veteran'],
      'agriculture': ['agriculture', 'farm', 'farming', 'food', 'SNAP', 'nutrition', 'USDA', 'crop'],
      'energy': ['energy', 'oil', 'gas', 'petroleum', 'renewable', 'solar', 'wind', 'coal'],
      'environment': ['environment', 'climate', 'EPA', 'pollution', 'emission', 'green', 'conservation'],
      'banking': ['banking', 'finance', 'financial', 'bank', 'credit', 'loan', 'mortgage'],
      'healthcare': ['health', 'medical', 'medicare', 'medicaid', 'hospital', 'insurance', 'doctor'],
      'education': ['education', 'school', 'student', 'teacher', 'university', 'college', 'learning'],
      'immigration': ['immigration', 'immigrant', 'border', 'visa', 'citizenship', 'deportation'],
      'housing': ['housing', 'home', 'rent', 'mortgage', 'affordable housing', 'HUD']
    };

    const keywords = topicKeywords[topic.toLowerCase()] || [topic];
    const searchQuery = keywords.join(' OR ');

    const searchResults = documentParser.searchSections(searchQuery, Math.min(maxResults, 3));
    
    return {
      topic: topic,
      searchKeywords: keywords,
      results: searchResults.map(result => ({
        id: result.section.id,
        title: result.section.title,
        content: textUtils.truncateText(result.section.fullText, 250), // More aggressive truncation
        level: result.section.level,
        type: result.section.type,
        score: result.score,
        excerpt: textUtils.truncateText(result.section.fullText, 200)
      })),
      totalFound: searchResults.length
    };
  }

  /**
   * Execute get_bill_overview tool
   */
  async executeGetBillOverview(input) {
    const documentParser = require('./documentParser');
    const documentData = documentParser.getDocumentData();
    if (!documentData) {
      throw new Error('Document data not available');
    }

    return {
      title: documentData.title || 'H.R. 1 (2025)',
      totalSections: Object.keys(documentData.sections || {}).length,
      structure: documentData.structure || 'Structure not available',
      mainTopics: [
        'Agriculture and Food Policy',
        'Defense and National Security',
        'Banking and Financial Services',
        'Energy and Natural Resources',
        'Environmental Protection',
        'Tax Policy and Revenue'
      ],
      summary: 'H.R. 1 (2025) is a comprehensive legislative bill covering multiple policy areas including agriculture, defense, banking, energy, environment, and tax policy.'
    };
  }

  /**
   * Execute search_financial_impact tool
   */
  async executeSearchFinancialImpact(input) {
    const documentParser = require('./documentParser');
    const textUtils = require('../utils/textUtils');
    const { impactType, maxResults = 3 } = input; // Reduce default results
    
    const impactKeywords = {
      'appropriation': ['appropriation', 'appropriated', 'appropriates', 'funds available'],
      'funding': ['funding', 'funded', 'fund', 'allocated', 'allocation'],
      'cost': ['cost', 'costs', 'expense', 'expenditure', 'budget'],
      'budget': ['budget', 'budgeted', 'budgetary', 'fiscal'],
      'spending': ['spending', 'spend', 'expenditure', 'outlay'],
      'revenue': ['revenue', 'income', 'receipts', 'collections'],
      'tax_change': ['tax increase', 'tax decrease', 'tax rate', 'tax reform', 'tax credit', 'tax deduction']
    };

    const keywords = impactKeywords[impactType.toLowerCase()] || [impactType];
    const searchQuery = keywords.join(' OR ');

    const searchResults = documentParser.searchSections(searchQuery, Math.min(maxResults, 3));
    
    return {
      impactType: impactType,
      searchKeywords: keywords,
      results: searchResults.map(result => ({
        id: result.section.id,
        title: result.section.title,
        content: textUtils.truncateText(result.section.fullText, 250), // More aggressive truncation
        level: result.section.level,
        type: result.section.type,
        score: result.score,
        excerpt: textUtils.truncateText(result.section.fullText, 200)
      })),
      totalFound: searchResults.length
    };
  }

  /**
   * Parse Claude response
   * @param {Object} response - Raw API response
   * @returns {Object} Parsed response
   */
  parseResponse(response) {
    try {
      if (!response.content || response.content.length === 0) {
        throw new Error('Invalid response format from Claude API');
      }
      
      // Find the text content (skip tool_use items)
      const textContent = response.content.find(item => item.type === 'text');
      if (!textContent) {
        throw new Error('No text content found in Claude response');
      }
      
      const content = textContent.text;
      logger.debug('Parsing response content:', content);
      
      // Try to parse as JSON
      let parsedContent;
      try {
        // Try to extract JSON if it's embedded in text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          parsedContent = JSON.parse(content);
        }
      } catch (jsonError) {
        // If JSON parsing fails, create a structured response
        logger.warn('Failed to parse Claude response as JSON, creating structured response');
        logger.debug('Raw content that failed to parse:', content);
        
        // Try to extract useful information from the text
        const lines = content.split('\n').filter(line => line.trim());
        let answer = content;
        let keyPoints = [];
        let implications = 'Based on the analysis provided above.';
        
        // Look for bullet points or numbered lists
        const bulletPoints = lines.filter(line => line.match(/^[\-\*\d\.]\s/));
        if (bulletPoints.length > 0) {
          keyPoints = bulletPoints.map(point => point.replace(/^[\-\*\d\.]\s/, '').trim());
          answer = lines.filter(line => !line.match(/^[\-\*\d\.]\s/)).join('\n\n');
        }
        
        parsedContent = {
          answer: answer.trim() || content,
          sections: [],
          keyPoints: keyPoints.slice(0, 5), // Limit key points
          implications: implications,
          confidence: 'medium'
        };
      }
      
      // Validate required fields
      const requiredFields = ['answer', 'sections', 'keyPoints', 'implications'];
      const missingFields = requiredFields.filter(field => !parsedContent[field]);
      
      if (missingFields.length > 0) {
        logger.warn(`Claude response missing fields: ${missingFields.join(', ')}`);
        
        // Fill in missing fields with defaults
        if (!parsedContent.answer) parsedContent.answer = content;
        if (!parsedContent.sections) parsedContent.sections = [];
        if (!parsedContent.keyPoints) parsedContent.keyPoints = [];
        if (!parsedContent.implications) parsedContent.implications = 'See full response for implications';
        if (!parsedContent.confidence) parsedContent.confidence = 'medium';
      }
      
      return {
        ...parsedContent,
        metadata: {
          model: this.model,
          requestId: response.id,
          usage: response.usage,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      logger.error('Failed to parse Claude response:', error);
      logger.debug('Full response object:', JSON.stringify(response, null, 2));
      throw new Error('Failed to parse Claude response');
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      totalTokens: this.totalTokens,
      model: this.model,
      averageTokensPerRequest: this.requestCount > 0 ? Math.round(this.totalTokens / this.requestCount) : 0
    };
  }

  /**
   * Health check for the service
   * @returns {boolean} True if service is healthy
   */
  async healthCheck() {
    try {
      const testPrompt = 'Test prompt for health check';
      const payload = {
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: testPrompt }]
      };
      
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 10000 // 10 second timeout for health check
      };
      
      await axios.post(this.baseUrl, payload, config);
      return true;
    } catch (error) {
      logger.error('LLM service health check failed:', error.message);
      return false;
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.requestCount = 0;
    this.totalTokens = 0;
    logger.info('LLM service statistics reset');
  }
}

// Export singleton instance
module.exports = new LLMService();