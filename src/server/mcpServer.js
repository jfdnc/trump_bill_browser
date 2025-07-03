const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const documentParser = require('./services/documentParser');
const textUtils = require('./utils/textUtils');
const logger = require('./utils/logger');

class DocumentMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'legislative-bill-query-server',
        version: '1.0.0',
        description: 'MCP server for querying legislative bill H.R. 1 (2025)'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_sections',
            description: 'Search for sections in the bill by keywords or phrases',
            inputSchema: {
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
            inputSchema: {
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
            inputSchema: {
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
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'search_financial_impact',
            description: 'Search for sections that mention financial impacts, costs, or budget items',
            inputSchema: {
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
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search_sections':
          return this.searchSections(request.params.arguments);
        case 'get_section_by_id':
          return this.getSectionById(request.params.arguments);
        case 'search_by_topic':
          return this.searchByTopic(request.params.arguments);
        case 'get_bill_overview':
          return this.getBillOverview(request.params.arguments);
        case 'search_financial_impact':
          return this.searchFinancialImpact(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async searchSections(args) {
    try {
      const { query, maxResults = 5 } = args;
      
      if (!query || typeof query !== 'string') {
        throw new Error('Query parameter is required and must be a string');
      }

      logger.info(`MCP: Searching sections for query: "${query}"`);

      // Get document data
      const documentData = documentParser.getDocumentData();
      if (!documentData || !documentData.sections) {
        throw new Error('Document data not available');
      }

      // Search sections using existing search functionality
      const searchResults = documentParser.searchSections(query, maxResults);
      
      // Format results for MCP response
      const formattedResults = searchResults.map(result => ({
        id: result.section.id,
        title: result.section.title,
        content: result.section.fullText,
        level: result.section.level,
        type: result.section.type,
        score: result.score,
        excerpt: textUtils.truncateText(result.section.fullText, 300)
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: query,
              results: formattedResults,
              totalFound: searchResults.length,
              message: searchResults.length > 0 
                ? `Found ${searchResults.length} sections matching "${query}"` 
                : `No sections found matching "${query}"`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('MCP search_sections error:', error);
      throw error;
    }
  }

  async getSectionById(args) {
    try {
      const { sectionId } = args;
      
      if (!sectionId || typeof sectionId !== 'string') {
        throw new Error('sectionId parameter is required and must be a string');
      }

      logger.info(`MCP: Getting section by ID: "${sectionId}"`);

      // Get document data
      const documentData = documentParser.getDocumentData();
      if (!documentData || !documentData.sections) {
        throw new Error('Document data not available');
      }

      const section = documentData.sections[sectionId];
      if (!section) {
        throw new Error(`Section with ID "${sectionId}" not found`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: section.id,
              title: section.title,
              content: section.fullText,
              level: section.level,
              type: section.type,
              parent: section.parent,
              children: section.children || []
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('MCP get_section_by_id error:', error);
      throw error;
    }
  }

  async searchByTopic(args) {
    try {
      const { topic, maxResults = 5 } = args;
      
      if (!topic || typeof topic !== 'string') {
        throw new Error('topic parameter is required and must be a string');
      }

      logger.info(`MCP: Searching by topic: "${topic}"`);

      // Map topics to search keywords
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

      // Search using the keywords
      const searchResults = documentParser.searchSections(searchQuery, maxResults);
      
      // Format results
      const formattedResults = searchResults.map(result => ({
        id: result.section.id,
        title: result.section.title,
        content: result.section.fullText,
        level: result.section.level,
        type: result.section.type,
        score: result.score,
        excerpt: textUtils.truncateText(result.section.fullText, 300),
        matchedKeywords: keywords.filter(keyword => 
          result.section.fullText.toLowerCase().includes(keyword.toLowerCase()) ||
          result.section.title.toLowerCase().includes(keyword.toLowerCase())
        )
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              topic: topic,
              searchKeywords: keywords,
              results: formattedResults,
              totalFound: searchResults.length,
              message: searchResults.length > 0 
                ? `Found ${searchResults.length} sections related to "${topic}"` 
                : `No sections found related to "${topic}"`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('MCP search_by_topic error:', error);
      throw error;
    }
  }

  async getBillOverview(args) {
    try {
      logger.info('MCP: Getting bill overview');

      // Get document data
      const documentData = documentParser.getDocumentData();
      if (!documentData) {
        throw new Error('Document data not available');
      }

      // Create overview
      const overview = {
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
        summary: 'H.R. 1 (2025) is a comprehensive legislative bill covering multiple policy areas including agriculture, defense, banking, energy, environment, and tax policy. The bill contains provisions that affect various aspects of government operations and citizen services.',
        documentStats: {
          totalSections: Object.keys(documentData.sections || {}).length,
          sectionTypes: this.getSectionTypes(documentData.sections || {}),
          estimatedWordCount: this.getEstimatedWordCount(documentData.sections || {})
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(overview, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('MCP get_bill_overview error:', error);
      throw error;
    }
  }

  async searchFinancialImpact(args) {
    try {
      const { impactType, maxResults = 5 } = args;
      
      if (!impactType || typeof impactType !== 'string') {
        throw new Error('impactType parameter is required and must be a string');
      }

      logger.info(`MCP: Searching for financial impact: "${impactType}"`);

      // Map impact types to search keywords
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

      // Search using the keywords
      const searchResults = documentParser.searchSections(searchQuery, maxResults);
      
      // Format results with financial context
      const formattedResults = searchResults.map(result => ({
        id: result.section.id,
        title: result.section.title,
        content: result.section.fullText,
        level: result.section.level,
        type: result.section.type,
        score: result.score,
        excerpt: textUtils.truncateText(result.section.fullText, 300),
        financialImpactType: impactType,
        matchedKeywords: keywords.filter(keyword => 
          result.section.fullText.toLowerCase().includes(keyword.toLowerCase()) ||
          result.section.title.toLowerCase().includes(keyword.toLowerCase())
        ),
        potentialNumbers: this.extractNumbers(result.section.fullText)
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              impactType: impactType,
              searchKeywords: keywords,
              results: formattedResults,
              totalFound: searchResults.length,
              message: searchResults.length > 0 
                ? `Found ${searchResults.length} sections with "${impactType}" financial impact` 
                : `No sections found with "${impactType}" financial impact`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('MCP search_financial_impact error:', error);
      throw error;
    }
  }

  // Helper methods
  getSectionTypes(sections) {
    const types = {};
    Object.values(sections).forEach(section => {
      const type = section.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  getEstimatedWordCount(sections) {
    let totalWords = 0;
    Object.values(sections).forEach(section => {
      if (section.fullText) {
        totalWords += section.fullText.split(/\s+/).length;
      }
    });
    return totalWords;
  }

  extractNumbers(text) {
    // Extract potential dollar amounts and numbers from text
    const dollarAmounts = text.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|trillion))?/gi) || [];
    const largeNumbers = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|trillion)\b/gi) || [];
    return [...dollarAmounts, ...largeNumbers];
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP server started and connected');
  }
}

module.exports = DocumentMCPServer;