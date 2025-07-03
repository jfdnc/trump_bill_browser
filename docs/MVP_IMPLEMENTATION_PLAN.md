# Phase 1 MVP Implementation Plan

## Overview
This document outlines the specific implementation details for the Phase 1 MVP of the Legislative Bill Query System. The goal is to create a functional, minimal viable product that demonstrates core functionality within 2 weeks.

## MVP Scope Definition

### Core Features (Must Have)
1. **Document Loading**: Parse and index the XML bill
2. **Basic Query Interface**: Simple text input for questions
3. **LLM Integration**: Process queries using Claude API
4. **Document Display**: Show bill content with basic formatting
5. **Section Highlighting**: Highlight relevant sections in responses
6. **Basic Caching**: Cache recent queries to reduce API calls

### Nice-to-Have Features (Excluded from MVP)
- Advanced UI/UX polish
- Complex caching strategies
- Performance optimizations
- User analytics
- Mobile responsiveness (basic only)

## Technical Stack

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS Grid/Flexbox
- **Vanilla JavaScript**: No frameworks to minimize complexity
- **Fetch API**: For HTTP requests

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **xml2js**: XML parsing library
- **node-cache**: In-memory caching
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management

### External APIs
- **Anthropic Claude API**: LLM processing
- **Optional**: OpenAI API as fallback

## Project Structure

```
trump_bill/
├── docs/
│   ├── BILLS-119hr1eas.xml
│   ├── TECHNICAL_ARCHITECTURE.md
│   └── MVP_IMPLEMENTATION_PLAN.md
├── src/
│   ├── server/
│   │   ├── index.js                 # Main server file
│   │   ├── routes/
│   │   │   ├── api.js              # API routes
│   │   │   └── document.js         # Document serving routes
│   │   ├── services/
│   │   │   ├── documentParser.js   # XML parsing and indexing
│   │   │   ├── queryProcessor.js   # Query processing logic
│   │   │   ├── llmService.js       # LLM API integration
│   │   │   └── cacheService.js     # Caching logic
│   │   └── utils/
│   │       ├── textUtils.js        # Text processing utilities
│   │       └── logger.js           # Basic logging
│   └── client/
│       ├── index.html              # Main HTML file
│       ├── css/
│       │   └── styles.css          # Main stylesheet
│       └── js/
│           ├── main.js             # Main application logic
│           ├── documentViewer.js   # Document display logic
│           ├── queryInterface.js   # Query input handling
│           └── responseDisplay.js  # Response formatting
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Implementation Details

### 1. Document Parser Service (`documentParser.js`)

**Purpose**: Parse XML and create searchable data structure

**Key Functions**:
- `parseXmlDocument()`: Convert XML to JSON
- `createSectionIndex()`: Build section ID to content mapping
- `extractMetadata()`: Extract titles, sections, and hierarchy
- `buildSearchIndex()`: Create text search capabilities

**Data Structure**:
```javascript
{
  sections: {
    'id123': {
      id: 'id123',
      title: 'Section Title',
      content: 'Full text content...',
      level: 'section',
      parent: 'parentId',
      children: ['childId1', 'childId2']
    }
  },
  hierarchy: {
    titles: [...],
    subtitles: [...],
    sections: [...]
  },
  searchIndex: {
    'keyword': ['sectionId1', 'sectionId2']
  }
}
```

### 2. Query Processor Service (`queryProcessor.js`)

**Purpose**: Process user queries and prepare context for LLM

**Key Functions**:
- `processQuery(query)`: Main query processing pipeline
- `identifyRelevantSections(query)`: Find related document sections
- `buildContext(sections)`: Assemble context for LLM
- `formatResponse(llmResponse)`: Structure response for frontend

**Query Processing Pipeline**:
1. Normalize query text
2. Extract key terms and intent
3. Search document sections
4. Rank sections by relevance
5. Build context within token limits
6. Call LLM service
7. Format response with section references

### 3. LLM Service (`llmService.js`)

**Purpose**: Handle Claude API integration

**Key Functions**:
- `queryDocument(query, context)`: Send query to Claude
- `formatPrompt(query, context)`: Build effective prompts
- `parseResponse(response)`: Extract structured data from response
- `handleErrors(error)`: Manage API errors gracefully

**Prompt Template**:
```
You are analyzing a legislative bill to answer citizen questions.

Document Context:
{context}

User Question: {query}

Provide a clear, helpful response that:
1. Directly answers the question
2. Cites specific sections by ID
3. Explains implications in plain language
4. Highlights key impacts

Format your response as JSON:
{
  "answer": "Your detailed answer here",
  "sections": ["sectionId1", "sectionId2"],
  "keyPoints": ["point1", "point2"],
  "implications": "Summary of implications"
}
```

### 4. Cache Service (`cacheService.js`)

**Purpose**: Implement basic caching to reduce API calls

**Key Functions**:
- `get(key)`: Retrieve cached response
- `set(key, value, ttl)`: Store response with TTL
- `generateKey(query)`: Create consistent cache keys
- `clear()`: Clear cache (admin function)

**Cache Strategy**:
- **TTL**: 1 hour for query responses
- **Size**: 100 most recent queries
- **Key**: Hash of normalized query text
- **Eviction**: LRU (Least Recently Used)

### 5. Frontend Components

#### Main Application (`main.js`)
- Initialize application
- Handle routing and state management
- Coordinate between components

#### Document Viewer (`documentViewer.js`)
- Display bill content
- Handle section highlighting
- Manage scroll position and navigation

#### Query Interface (`queryInterface.js`)
- Handle user input
- Provide query suggestions
- Manage loading states

#### Response Display (`responseDisplay.js`)
- Format LLM responses
- Display section references
- Handle error states

## API Endpoints

### Document Endpoints
- `GET /api/document/structure` - Get document hierarchy
- `GET /api/document/section/:id` - Get specific section content
- `GET /api/document/search/:term` - Search document content

### Query Endpoints
- `POST /api/query` - Process user query
- `GET /api/query/suggestions` - Get query suggestions
- `DELETE /api/cache` - Clear cache (admin)

### Static Endpoints
- `GET /` - Serve main HTML page
- `GET /assets/*` - Serve static assets

## Database Schema (In-Memory)

### Document Data
```javascript
// Global document object
global.documentData = {
  sections: Map(),      // sectionId -> section data
  hierarchy: Object,    // document structure
  searchIndex: Map(),   // keyword -> section IDs
  metadata: Object      // document metadata
};
```

### Cache Data
```javascript
// Cache using node-cache
const cache = new NodeCache({ 
  stdTTL: 3600,        // 1 hour TTL
  maxKeys: 100         // Maximum 100 cached queries
});
```

## Environment Configuration

### Required Environment Variables
```
# LLM API Configuration
ANTHROPIC_API_KEY=your_api_key_here
CLAUDE_MODEL=claude-3-sonnet-20240229

# Server Configuration
PORT=3000
NODE_ENV=development

# Cache Configuration
CACHE_TTL=3600
CACHE_MAX_SIZE=100

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000
```

## Implementation Timeline

### Week 1: Core Backend
- **Day 1-2**: Project setup, document parser
- **Day 3-4**: Query processor, LLM service
- **Day 5**: Cache service, API endpoints
- **Day 6-7**: Testing and bug fixes

### Week 2: Frontend & Integration
- **Day 8-9**: HTML structure, basic CSS
- **Day 10-11**: JavaScript components
- **Day 12**: Integration and testing
- **Day 13**: UI polish and bug fixes
- **Day 14**: Final testing and deployment prep

## Testing Strategy

### Unit Tests
- Document parser functions
- Query processing logic
- Cache service operations
- Utility functions

### Integration Tests
- API endpoint responses
- LLM service integration
- End-to-end query processing

### Manual Testing
- User interface interactions
- Document display and highlighting
- Query response accuracy
- Performance under load

## Performance Targets

### Response Times
- Document loading: <1 second
- Query processing: <3 seconds
- Section highlighting: <500ms
- Cache hits: <100ms

### Resource Usage
- Memory usage: <512MB
- CPU usage: <50% during queries
- API calls: <1 per unique query (with caching)

## Security Considerations

### Input Validation
- Sanitize all user inputs
- Validate query length limits
- Prevent injection attacks

### API Security
- Rate limiting on API endpoints
- CORS configuration
- API key protection

### Data Protection
- No storage of personal data
- Secure API key management
- HTTPS in production

## Deployment Preparation

### Development Setup
1. Clone repository
2. Install dependencies (`npm install`)
3. Set up environment variables
4. Start development server (`npm run dev`)

### Production Deployment
- Environment: Railway, Render, or similar
- Build process: Simple asset bundling
- Environment variables: Secure configuration
- Monitoring: Basic uptime monitoring

## Success Criteria

### Functional Requirements
- [ ] Document loads and displays correctly
- [ ] Users can submit queries
- [ ] Relevant sections are highlighted
- [ ] Responses are accurate and helpful
- [ ] Cache reduces API calls

### Technical Requirements
- [ ] Response times meet targets
- [ ] Error handling works correctly
- [ ] Security measures are implemented
- [ ] Code is maintainable and documented

### User Experience
- [ ] Interface is intuitive
- [ ] Loading states are clear
- [ ] Errors are handled gracefully
- [ ] Results are easy to understand

## Next Steps After MVP

1. **Gather User Feedback**: Deploy MVP and collect usage data
2. **Performance Optimization**: Implement advanced caching strategies
3. **UI/UX Improvements**: Polish interface based on feedback
4. **Advanced Features**: Add features from Phase 2 roadmap
5. **Analytics**: Implement comprehensive usage tracking

This MVP will provide a solid foundation for iterative development and user feedback collection, while demonstrating the core value proposition of the legislative query system.