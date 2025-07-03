const express = require('express');
const queryProcessor = require('../services/queryProcessor');
const cacheService = require('../services/cacheService');
const llmService = require('../services/llmService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/query - Process user query
 */
router.post('/query', async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    
    // Validate query
    const validation = queryProcessor.validateQuery(query);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid query',
          details: validation.errors
        }
      });
    }
    
    // Log the query (truncated for privacy)
    logger.info(`API query received: ${query.substring(0, 100)}...`);
    
    // Process the query
    const result = await queryProcessor.processQuery(query, options);
    
    // Return the result
    res.json(result);
    
  } catch (error) {
    logger.error('Error processing query:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to process query',
        type: 'internal_error'
      }
    });
  }
});

/**
 * GET /api/query/suggestions - Get query suggestions
 */
router.get('/query/suggestions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const suggestions = queryProcessor.getQuerySuggestions(limit);
    
    res.json({
      success: true,
      suggestions
    });
    
  } catch (error) {
    logger.error('Error getting query suggestions:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get query suggestions'
      }
    });
  }
});

/**
 * GET /api/stats - Get system statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      queryProcessor: queryProcessor.getStats(),
      cache: cacheService.getStats(),
      llm: llmService.getStats(),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    logger.error('Error getting statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get statistics'
      }
    });
  }
});

/**
 * POST /api/validate - Validate query without processing
 */
router.post('/validate', (req, res) => {
  try {
    const { query } = req.body;
    const validation = queryProcessor.validateQuery(query);
    
    res.json({
      success: true,
      ...validation
    });
    
  } catch (error) {
    logger.error('Error validating query:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to validate query'
      }
    });
  }
});

/**
 * DELETE /api/cache - Clear cache (admin endpoint)
 */
router.delete('/cache', (req, res) => {
  try {
    // In a production system, you'd want authentication here
    const authHeader = req.headers.authorization;
    const adminKey = process.env.ADMIN_KEY;
    
    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized'
        }
      });
    }
    
    cacheService.clear();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
    
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to clear cache'
      }
    });
  }
});

/**
 * GET /api/cache - Get cache information (admin endpoint)
 */
router.get('/cache', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const adminKey = process.env.ADMIN_KEY;
    
    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Unauthorized'
        }
      });
    }
    
    const cacheInfo = {
      stats: cacheService.getStats(),
      queries: cacheService.getCachedQueries()
    };
    
    res.json({
      success: true,
      cache: cacheInfo
    });
    
  } catch (error) {
    logger.error('Error getting cache information:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get cache information'
      }
    });
  }
});

/**
 * GET /api/health - Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: true,
        documentParser: true, // We can assume it's healthy if we got this far
        cache: true,
        llm: false // Will be checked below
      }
    };
    
    // Check LLM service health (optional, might be slow)
    if (req.query.checkLLM === 'true') {
      try {
        health.services.llm = await llmService.healthCheck();
      } catch (error) {
        health.services.llm = false;
        health.warnings = ['LLM service health check failed'];
      }
    }
    
    // Overall health status
    const allServicesHealthy = Object.values(health.services).every(status => status === true);
    if (!allServicesHealthy) {
      health.status = 'degraded';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
    
  } catch (error) {
    logger.error('Error in health check:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/version - Get API version information
 */
router.get('/version', (req, res) => {
  const packageJson = require('../../../package.json');
  
  res.json({
    success: true,
    version: packageJson.version,
    name: packageJson.name,
    description: packageJson.description,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;