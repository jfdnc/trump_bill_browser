const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');
const logger = require('../utils/logger');
const textUtils = require('../utils/textUtils');

class DocumentParser {
  constructor() {
    this.documentData = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the document parser and load the XML file
   */
  async initialize() {
    try {
      logger.info('Initializing document parser...');
      
      const xmlPath = path.join(__dirname, '../../../docs/BILLS-119hr1eas.xml');
      const xmlContent = await fs.readFile(xmlPath, 'utf-8');
      
      logger.info('XML file loaded, parsing content...');
      
      const parser = new xml2js.Parser({
        explicitArray: true,
        trim: true,
        normalize: true,
        normalizeTags: true,
        explicitRoot: false,
        mergeAttrs: false
      });
      
      const parsedXml = await parser.parseStringPromise(xmlContent);
      
      logger.info('XML parsed, building document structure...');
      
      this.documentData = await this.buildDocumentStructure(parsedXml);
      this.isInitialized = true;
      
      logger.info(`Document parsing completed. Found ${Object.keys(this.documentData.sections).length} sections`);
      
    } catch (error) {
      logger.error('Failed to initialize document parser:', error);
      throw error;
    }
  }

  /**
   * Build searchable document structure from parsed XML
   */
  async buildDocumentStructure(parsedXml) {
    const sections = {};
    const hierarchy = {
      titles: [],
      subtitles: [],
      sections: []
    };
    const searchIndex = {};
    
    // Extract document metadata
    const metadata = this.extractMetadata(parsedXml);
    
    // Extract table of contents
    const toc = this.extractTableOfContents(parsedXml);
    
    // Process all sections using a simpler approach
    this.processSectionsSimple(parsedXml, sections);
    
    // Build search index
    this.buildSearchIndex(sections, searchIndex);
    
    logger.info(`Processed ${Object.keys(sections).length} sections`);
    
    return {
      sections,
      hierarchy,
      searchIndex,
      metadata,
      toc
    };
  }

  /**
   * Extract document metadata
   */
  extractMetadata(parsedXml) {
    const metadata = {};
    
    try {
      // Look for metadata in the parsed XML
      const findMetadata = (obj) => {
        if (obj && typeof obj === 'object') {
          if (obj.metadata && obj.metadata[0] && obj.metadata[0].dublincore) {
            const dc = obj.metadata[0].dublincore[0];
            if (dc['dc:title']) metadata.title = dc['dc:title'][0];
            if (dc['dc:publisher']) metadata.publisher = dc['dc:publisher'][0];
            if (dc['dc:date']) metadata.date = dc['dc:date'][0];
            if (dc['dc:language']) metadata.language = dc['dc:language'][0];
          }
          
          // Look for bill information
          if (obj['engrossed-amendment-form']) {
            const form = obj['engrossed-amendment-form'][0];
            if (form.congress) metadata.congress = form.congress[0];
            if (form.session) metadata.session = form.session[0];
            if (form['legis-num']) metadata.billNumber = form['legis-num'][0];
          }
          
          // Recursively search
          Object.values(obj).forEach(value => {
            if (Array.isArray(value)) {
              value.forEach(item => findMetadata(item));
            } else {
              findMetadata(value);
            }
          });
        }
      };
      
      findMetadata(parsedXml);
      
    } catch (error) {
      logger.warn('Failed to extract metadata:', error);
    }
    
    return metadata;
  }

  /**
   * Extract table of contents using a simpler approach
   */
  extractTableOfContents(parsedXml) {
    const toc = [];
    
    try {
      const findTocEntries = (obj) => {
        if (obj && typeof obj === 'object') {
          if (obj['toc-entry'] && Array.isArray(obj['toc-entry'])) {
            obj['toc-entry'].forEach(entry => {
              if (entry.$ && entry.$.level && entry.$.idref && entry._) {
                toc.push({
                  id: entry.$.idref,
                  level: entry.$.level,
                  title: entry._,
                  path: []
                });
              }
            });
          }
          
          // Recursively search
          Object.values(obj).forEach(value => {
            if (Array.isArray(value)) {
              value.forEach(item => findTocEntries(item));
            } else {
              findTocEntries(value);
            }
          });
        }
      };
      
      findTocEntries(parsedXml);
      
    } catch (error) {
      logger.warn('Failed to extract table of contents:', error);
    }
    
    return toc;
  }

  /**
   * Process sections using a simpler recursive approach
   */
  processSectionsSimple(obj, sections, parentId = null, level = 0) {
    if (!obj || typeof obj !== 'object') return;
    
    // Check if this object has section attributes
    if (obj.$ && obj.$.id) {
      const section = this.extractSectionDataSimple(obj, parentId, level);
      if (section) {
        sections[section.id] = section;
      }
    }
    
    // Recursively process all nested objects and arrays
    Object.entries(obj).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            // If this array item has an ID, process it as a section
            if (item.$ && item.$.id) {
              this.processSectionsSimple(item, sections, (obj.$ && obj.$.id) || parentId, level + 1);
            } else {
              this.processSectionsSimple(item, sections, parentId, level);
            }
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        this.processSectionsSimple(value, sections, (obj.$ && obj.$.id) || parentId, level);
      }
    });
  }

  /**
   * Extract section data with a simpler approach
   */
  extractSectionDataSimple(obj, parentId, level) {
    try {
      if (!obj || !obj.$ || !obj.$.id) {
        return null;
      }
      
      const id = obj.$.id;
      
      // Extract title/header
      let title = '';
      if (obj.header && Array.isArray(obj.header) && obj.header[0]) {
        title = typeof obj.header[0] === 'string' ? obj.header[0] : (obj.header[0]._ || '');
      } else if (obj.enum && Array.isArray(obj.enum) && obj.enum[0]) {
        title = typeof obj.enum[0] === 'string' ? obj.enum[0] : (obj.enum[0]._ || '');
      }
      
      // Extract content from text elements
      let content = '';
      if (obj.text && Array.isArray(obj.text)) {
        content = obj.text.map(t => this.extractTextContent(t)).join(' ');
      }
      
      // Extract all text content recursively
      const allText = this.extractAllTextRecursive(obj);
      
      return {
        id,
        type: (obj.$ && obj.$['section-type']) || 'section',
        title: textUtils.stripTags(title).trim(),
        content: textUtils.stripTags(content).trim(),
        fullText: textUtils.stripTags(allText).trim(),
        level,
        parentId,
        children: [],
        metadata: {
          sectionType: (obj.$ && obj.$['section-type']) || 'section',
          changed: (obj.$ && obj.$.changed) || null,
          displayStyle: (obj.$ && obj.$['reported-display-style']) || null
        }
      };
      
    } catch (error) {
      logger.warn('Failed to extract section data:', error);
      return null;
    }
  }

  /**
   * Extract text content from various XML structures
   */
  extractTextContent(element) {
    if (typeof element === 'string') {
      return element;
    }
    
    if (element && element._) {
      return element._;
    }
    
    if (Array.isArray(element)) {
      return element.map(item => this.extractTextContent(item)).join(' ');
    }
    
    return '';
  }

  /**
   * Extract all text content recursively
   */
  extractAllTextRecursive(obj) {
    let text = '';
    
    if (typeof obj === 'string') {
      return obj;
    }
    
    if (obj && obj._) {
      text += obj._ + ' ';
    }
    
    if (obj && typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        // Skip attributes
        if (key === '$') return;
        
        if (Array.isArray(value)) {
          value.forEach(item => {
            text += this.extractAllTextRecursive(item) + ' ';
          });
        } else if (typeof value === 'object' && value !== null) {
          text += this.extractAllTextRecursive(value) + ' ';
        } else if (typeof value === 'string') {
          text += value + ' ';
        }
      });
    }
    
    return text;
  }

  /**
   * Build search index from sections
   */
  buildSearchIndex(sections, searchIndex) {
    Object.entries(sections).forEach(([sectionId, section]) => {
      // Index title keywords
      const titleKeywords = textUtils.extractKeywords(section.title);
      const contentKeywords = textUtils.extractKeywords(section.fullText);
      
      const allKeywords = [...titleKeywords, ...contentKeywords];
      
      allKeywords.forEach(keyword => {
        if (!searchIndex[keyword]) {
          searchIndex[keyword] = [];
        }
        if (!searchIndex[keyword].includes(sectionId)) {
          searchIndex[keyword].push(sectionId);
        }
      });
    });
  }

  /**
   * Get document data
   */
  getDocumentData() {
    if (!this.isInitialized) {
      throw new Error('Document parser not initialized');
    }
    return this.documentData;
  }

  /**
   * Get section by ID
   */
  getSection(sectionId) {
    if (!this.isInitialized) {
      throw new Error('Document parser not initialized');
    }
    return this.documentData.sections[sectionId];
  }

  /**
   * Search sections by keyword
   */
  searchSections(query, limit = 10) {
    if (!this.isInitialized) {
      throw new Error('Document parser not initialized');
    }
    
    const keywords = textUtils.extractKeywords(query);
    const sectionScores = {};
    
    keywords.forEach(keyword => {
      const matchingSections = this.documentData.searchIndex[keyword] || [];
      matchingSections.forEach(sectionId => {
        sectionScores[sectionId] = (sectionScores[sectionId] || 0) + 1;
      });
    });
    
    // Sort by score and return top results
    const rankedSections = Object.entries(sectionScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([sectionId, score]) => ({
        section: this.documentData.sections[sectionId],
        score
      }));
    
    return rankedSections;
  }

  /**
   * Get document structure/hierarchy
   */
  getDocumentStructure() {
    if (!this.isInitialized) {
      throw new Error('Document parser not initialized');
    }
    
    return {
      hierarchy: this.documentData.hierarchy,
      toc: this.documentData.toc,
      metadata: this.documentData.metadata
    };
  }
}

// Export singleton instance
module.exports = new DocumentParser();