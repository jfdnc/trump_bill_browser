/**
 * Text processing utilities for document parsing and query processing
 */

/**
 * Normalize text by removing extra whitespace and lowercasing
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
    .trim()                // Remove leading/trailing whitespace
    .toLowerCase();        // Convert to lowercase
}

/**
 * Extract keywords from text for search indexing
 * @param {string} text - Text to extract keywords from
 * @returns {Array<string>} Array of keywords
 */
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'among', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'among', 'a', 'an',
    'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'must', 'can', 'shall', 'this', 'that', 'these', 'those'
  ]);
  
  return normalizeText(text)
    .split(/\W+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter(word => !word.match(/^\d+$/)); // Remove pure numbers
}

/**
 * Truncate text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength = 200) {
  if (!text || typeof text !== 'string') return '';
  
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Clean HTML/XML tags from text
 * @param {string} text - Text with potential HTML/XML tags
 * @returns {string} Clean text
 */
function stripTags(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * Calculate similarity between two texts using simple word overlap
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} Similarity score between 0 and 1
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Generate a hash from text for caching keys
 * @param {string} text - Text to hash
 * @returns {string} Hash string
 */
function generateHash(text) {
  if (!text || typeof text !== 'string') return '';
  
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Highlight text matches in content
 * @param {string} content - Content to highlight
 * @param {Array<string>} terms - Terms to highlight
 * @returns {string} Content with highlighted terms
 */
function highlightMatches(content, terms) {
  if (!content || !terms || terms.length === 0) return content;
  
  let highlightedContent = content;
  
  terms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    highlightedContent = highlightedContent.replace(regex, `<mark>$&</mark>`);
  });
  
  return highlightedContent;
}

/**
 * Extract sentences containing specific terms
 * @param {string} text - Text to search
 * @param {Array<string>} terms - Terms to find
 * @param {number} maxSentences - Maximum sentences to return
 * @returns {Array<string>} Relevant sentences
 */
function extractRelevantSentences(text, terms, maxSentences = 3) {
  if (!text || !terms || terms.length === 0) return [];
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const relevantSentences = [];
  
  sentences.forEach(sentence => {
    const normalizedSentence = normalizeText(sentence);
    const matchCount = terms.reduce((count, term) => {
      return count + (normalizedSentence.includes(normalizeText(term)) ? 1 : 0);
    }, 0);
    
    if (matchCount > 0) {
      relevantSentences.push({
        sentence: sentence.trim(),
        matchCount
      });
    }
  });
  
  return relevantSentences
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, maxSentences)
    .map(item => item.sentence);
}

module.exports = {
  normalizeText,
  extractKeywords,
  truncateText,
  stripTags,
  calculateSimilarity,
  generateHash,
  highlightMatches,
  extractRelevantSentences
};