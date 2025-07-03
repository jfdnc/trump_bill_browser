const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const textUtils = require('../utils/textUtils');

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour default
      maxKeys: parseInt(process.env.CACHE_MAX_SIZE) || 100,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false // Better performance, but be careful with object mutations
    });
    
    this.hitCount = 0;
    this.missCount = 0;
    
    // Log cache statistics periodically
    setInterval(() => {
      this.logStats();
    }, 300000); // Every 5 minutes
  }

  /**
   * Generate cache key from query
   * @param {string} query - User query
   * @returns {string} Cache key
   */
  generateKey(query) {
    const normalizedQuery = textUtils.normalizeText(query);
    return `query:${textUtils.generateHash(normalizedQuery)}`;
  }

  /**
   * Get cached response
   * @param {string} query - User query
   * @returns {Object|null} Cached response or null if not found
   */
  get(query) {
    const key = this.generateKey(query);
    const result = this.cache.get(key);
    
    if (result) {
      this.hitCount++;
      logger.debug(`Cache hit for query: ${query.substring(0, 50)}...`);
      return result;
    } else {
      this.missCount++;
      logger.debug(`Cache miss for query: ${query.substring(0, 50)}...`);
      return null;
    }
  }

  /**
   * Set cached response
   * @param {string} query - User query
   * @param {Object} response - Response to cache
   * @param {number} ttl - Time to live in seconds (optional)
   */
  set(query, response, ttl = null) {
    const key = this.generateKey(query);
    
    // Add metadata to cached response
    const cacheEntry = {
      ...response,
      cachedAt: new Date().toISOString(),
      query: query.substring(0, 100) // Store first 100 chars for debugging
    };
    
    const success = this.cache.set(key, cacheEntry, ttl);
    
    if (success) {
      logger.debug(`Cached response for query: ${query.substring(0, 50)}...`);
    } else {
      logger.warn(`Failed to cache response for query: ${query.substring(0, 50)}...`);
    }
    
    return success;
  }

  /**
   * Check if query is cached
   * @param {string} query - User query
   * @returns {boolean} True if cached
   */
  has(query) {
    const key = this.generateKey(query);
    return this.cache.has(key);
  }

  /**
   * Delete cached response
   * @param {string} query - User query
   * @returns {boolean} True if deleted
   */
  delete(query) {
    const key = this.generateKey(query);
    return this.cache.del(key) > 0;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.flushAll();
    this.hitCount = 0;
    this.missCount = 0;
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const keys = this.cache.keys();
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;
    
    return {
      size: keys.length,
      maxSize: this.cache.options.maxKeys,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: hitRate.toFixed(2) + '%',
      ttl: this.cache.options.stdTTL
    };
  }

  /**
   * Log cache statistics
   */
  logStats() {
    const stats = this.getStats();
    logger.info(`Cache stats - Size: ${stats.size}/${stats.maxSize}, Hit rate: ${stats.hitRate}, Hits: ${stats.hitCount}, Misses: ${stats.missCount}`);
  }

  /**
   * Get all cached queries (for debugging)
   * @returns {Array} Array of cached query info
   */
  getCachedQueries() {
    const keys = this.cache.keys();
    return keys.map(key => {
      const data = this.cache.get(key);
      return {
        key,
        query: data?.query || 'Unknown',
        cachedAt: data?.cachedAt || 'Unknown',
        ttl: this.cache.getTtl(key)
      };
    });
  }

  /**
   * Implement semantic caching - find similar queries
   * @param {string} query - User query
   * @param {number} threshold - Similarity threshold (0-1)
   * @returns {Object|null} Similar cached response or null
   */
  findSimilarQuery(query, threshold = 0.7) {
    const cachedQueries = this.getCachedQueries();
    
    for (const cached of cachedQueries) {
      const similarity = textUtils.calculateSimilarity(query, cached.query);
      if (similarity >= threshold) {
        logger.debug(`Found similar cached query (similarity: ${similarity.toFixed(2)}): ${cached.query}`);
        return this.cache.get(cached.key);
      }
    }
    
    return null;
  }

  /**
   * Cache with semantic lookup
   * @param {string} query - User query
   * @param {Object} response - Response to cache
   * @param {boolean} useSemantic - Whether to use semantic caching
   * @returns {Object|null} Cached response or null
   */
  getWithSemantic(query, useSemantic = true) {
    // First try exact match
    const exactMatch = this.get(query);
    if (exactMatch) {
      return exactMatch;
    }
    
    // If no exact match and semantic caching is enabled, try similar queries
    if (useSemantic) {
      const similarMatch = this.findSimilarQuery(query);
      if (similarMatch) {
        this.hitCount++; // Count as hit for stats
        return similarMatch;
      }
    }
    
    return null;
  }

  /**
   * Preload cache with common queries
   * @param {Array} commonQueries - Array of {query, response} objects
   */
  preloadCache(commonQueries) {
    logger.info(`Preloading cache with ${commonQueries.length} common queries`);
    
    commonQueries.forEach(({ query, response }) => {
      this.set(query, response);
    });
    
    logger.info('Cache preloading completed');
  }

  /**
   * Clean up expired entries manually
   */
  cleanup() {
    const beforeSize = this.cache.keys().length;
    
    // NodeCache automatically handles cleanup, but we can force it
    this.cache.keys().forEach(key => {
      // This will remove expired keys
      this.cache.get(key);
    });
    
    const afterSize = this.cache.keys().length;
    const removed = beforeSize - afterSize;
    
    if (removed > 0) {
      logger.info(`Cache cleanup removed ${removed} expired entries`);
    }
  }
}

// Export singleton instance
module.exports = new CacheService();