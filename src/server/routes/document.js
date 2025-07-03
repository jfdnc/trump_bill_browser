const express = require('express');
const documentParser = require('../services/documentParser');
const logger = require('../utils/logger');
const textUtils = require('../utils/textUtils');

const router = express.Router();

/**
 * GET /api/document/structure - Get document hierarchy and structure
 */
router.get('/structure', (req, res) => {
  try {
    const structure = documentParser.getDocumentStructure();
    
    res.json({
      success: true,
      ...structure
    });
    
  } catch (error) {
    logger.error('Error getting document structure:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get document structure'
      }
    });
  }
});

/**
 * GET /api/document/section/:id - Get specific section content
 */
router.get('/section/:id', (req, res) => {
  try {
    const { id } = req.params;
    const includeChildren = req.query.includeChildren === 'true';
    const highlight = req.query.highlight; // Terms to highlight
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Section ID is required'
        }
      });
    }
    
    const section = documentParser.getSection(id);
    
    if (!section) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Section not found'
        }
      });
    }
    
    // Prepare response
    let response = { ...section };
    
    // Highlight terms if requested
    if (highlight) {
      const terms = Array.isArray(highlight) ? highlight : [highlight];
      response.title = textUtils.highlightMatches(response.title, terms);
      response.content = textUtils.highlightMatches(response.content, terms);
      response.fullText = textUtils.highlightMatches(response.fullText, terms);
    }
    
    // Include children if requested
    if (includeChildren && section.children && section.children.length > 0) {
      response.childSections = section.children
        .map(childId => documentParser.getSection(childId))
        .filter(child => child !== null);
    }
    
    res.json({
      success: true,
      section: response
    });
    
  } catch (error) {
    logger.error('Error getting section:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get section'
      }
    });
  }
});

/**
 * GET /api/document/search/:term - Search document content
 */
router.get('/search/:term', (req, res) => {
  try {
    const { term } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const includeExcerpts = req.query.includeExcerpts !== 'false'; // Default to true
    
    if (!term || term.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Search term is required'
        }
      });
    }
    
    const searchResults = documentParser.searchSections(term, limit);
    
    // Format results
    const formattedResults = searchResults.map(result => {
      const formatted = {
        id: result.section.id,
        title: result.section.title,
        type: result.section.type,
        level: result.section.level,
        score: result.score
      };
      
      if (includeExcerpts) {
        // Extract relevant sentences
        const keywords = textUtils.extractKeywords(term);
        const relevantSentences = textUtils.extractRelevantSentences(
          result.section.fullText, 
          keywords, 
          2
        );
        
        formatted.excerpt = relevantSentences.join(' ') || 
          textUtils.truncateText(result.section.fullText, 200);
        
        // Highlight the search term
        formatted.excerpt = textUtils.highlightMatches(formatted.excerpt, keywords);
      }
      
      return formatted;
    });
    
    res.json({
      success: true,
      query: term,
      totalResults: formattedResults.length,
      results: formattedResults
    });
    
  } catch (error) {
    logger.error('Error searching document:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to search document'
      }
    });
  }
});

/**
 * GET /api/document/sections - Get multiple sections by IDs
 */
router.get('/sections', (req, res) => {
  try {
    const { ids } = req.query;
    
    if (!ids) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Section IDs are required (provide as ?ids=id1,id2,id3)'
        }
      });
    }
    
    const sectionIds = Array.isArray(ids) ? ids : ids.split(',');
    const sections = {};
    const notFound = [];
    
    sectionIds.forEach(id => {
      const section = documentParser.getSection(id.trim());
      if (section) {
        sections[id] = section;
      } else {
        notFound.push(id);
      }
    });
    
    res.json({
      success: true,
      sections,
      notFound: notFound.length > 0 ? notFound : undefined
    });
    
  } catch (error) {
    logger.error('Error getting multiple sections:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get sections'
      }
    });
  }
});

/**
 * GET /api/document/toc - Get table of contents
 */
router.get('/toc', (req, res) => {
  try {
    const maxLevel = req.query.maxLevel ? parseInt(req.query.maxLevel) : undefined;
    const structure = documentParser.getDocumentStructure();
    
    let toc = structure.toc;
    
    // Filter by level if requested
    if (maxLevel) {
      const levelOrder = ['title', 'subtitle', 'section', 'subsection', 'paragraph'];
      const maxLevelIndex = levelOrder.indexOf(maxLevel);
      
      if (maxLevelIndex !== -1) {
        toc = toc.filter(entry => {
          const entryLevelIndex = levelOrder.indexOf(entry.level);
          return entryLevelIndex !== -1 && entryLevelIndex <= maxLevelIndex;
        });
      }
    }
    
    res.json({
      success: true,
      toc,
      metadata: structure.metadata
    });
    
  } catch (error) {
    logger.error('Error getting table of contents:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get table of contents'
      }
    });
  }
});

/**
 * GET /api/document/metadata - Get document metadata
 */
router.get('/metadata', (req, res) => {
  try {
    const structure = documentParser.getDocumentStructure();
    const documentData = documentParser.getDocumentData();
    
    const metadata = {
      ...structure.metadata,
      statistics: {
        totalSections: Object.keys(documentData.sections).length,
        totalKeywords: Object.keys(documentData.searchIndex).length,
        tocEntries: structure.toc.length
      }
    };
    
    res.json({
      success: true,
      metadata
    });
    
  } catch (error) {
    logger.error('Error getting document metadata:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get document metadata'
      }
    });
  }
});

/**
 * GET /api/document/section/:id/context - Get section with surrounding context
 */
router.get('/section/:id/context', (req, res) => {
  try {
    const { id } = req.params;
    const contextSize = parseInt(req.query.contextSize) || 2; // Number of sibling sections
    
    const section = documentParser.getSection(id);
    if (!section) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Section not found'
        }
      });
    }
    
    const context = {
      section,
      parent: null,
      children: [],
      siblings: []
    };
    
    // Get parent section
    if (section.parentId) {
      context.parent = documentParser.getSection(section.parentId);
    }
    
    // Get child sections
    if (section.children && section.children.length > 0) {
      context.children = section.children
        .map(childId => documentParser.getSection(childId))
        .filter(child => child !== null);
    }
    
    // Get sibling sections (simplified - would need more complex logic for full implementation)
    // This is a basic implementation that gets sections at the same level
    const documentData = documentParser.getDocumentData();
    const allSections = Object.values(documentData.sections);
    
    context.siblings = allSections
      .filter(s => s.level === section.level && s.parentId === section.parentId && s.id !== section.id)
      .slice(0, contextSize);
    
    res.json({
      success: true,
      context
    });
    
  } catch (error) {
    logger.error('Error getting section context:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get section context'
      }
    });
  }
});

module.exports = router;