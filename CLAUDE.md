# Legislative Bill Query System - Development Context

## Project Overview
A full-stack web application that allows users to query H.R. 1 (2025) using natural language. The system uses Claude AI with Model Context Protocol (MCP) tools to provide intelligent responses about the 1.7MB XML legislative document.

## Architecture
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript (no frameworks)
- **LLM Integration**: Claude API with custom MCP tools
- **Document Processing**: XML parsing with section indexing
- **Caching**: Multi-level caching for performance

## Current Status ✅
**MAJOR BREAKTHROUGH**: Successfully resolved critical tool_use/tool_result pairing issues that were causing Claude API errors. The system now properly handles multi-turn tool conversations and provides structured responses.

### What's Working:
- ✅ XML document parsing (6300 sections)
- ✅ MCP tool integration with 5 custom tools
- ✅ Multi-turn tool conversations
- ✅ Frontend/backend communication
- ✅ Response parsing and display
- ✅ Error handling and rate limit management
- ✅ Token optimization strategies

### Recent Fixes Applied:
1. **Tool Call Flow**: Fixed critical issue where tool_use blocks weren't paired with tool_result blocks
2. **Message History**: Implemented proper conversation flow without breaking API requirements
3. **Response Parsing**: Enhanced JSON extraction from Claude responses
4. **Frontend Display**: Fixed loading state management and response rendering
5. **Rate Limiting**: Added protections against token/rate limit issues

## Technical Details

### MCP Tools Implemented:
1. `search_sections` - Search by keywords/phrases (max 3 results, 300 char content)
2. `search_by_topic` - Search by policy topics (tax, defense, agriculture, etc.)
3. `search_financial_impact` - Search for budget/financial impacts
4. `get_section_by_id` - Retrieve specific sections (600 char content)
5. `get_bill_overview` - High-level bill structure

### Key Architecture Decisions:
- **Tool Call Limits**: Max 3 iterations to prevent rate limiting
- **Content Truncation**: Aggressive truncation (250-600 chars) for token efficiency
- **No MCP Server**: Direct tool execution in LLM service for simplicity
- **Conversation Flow**: Linear message history with proper tool_use/tool_result pairing

### File Structure:
```
src/
├── server/
│   ├── index.js                 # Main server
│   ├── services/
│   │   ├── documentParser.js    # XML parsing and indexing
│   │   ├── llmService.js        # Claude API + MCP tools ⭐ CRITICAL FILE
│   │   ├── queryProcessor.js    # Query orchestration
│   │   └── cacheService.js      # Multi-level caching
│   ├── routes/
│   │   ├── api.js              # Query endpoints
│   │   └── document.js         # Document endpoints
│   └── utils/
│       ├── logger.js           # Logging
│       └── textUtils.js        # Text processing
├── client/
│   ├── index.html              # Main UI
│   ├── css/styles.css          # Styling
│   └── js/
│       ├── main.js             # App controller
│       ├── queryInterface.js   # Query input handling
│       ├── responseDisplay.js  # Response rendering ⭐ KEY FOR UI
│       └── documentViewer.js   # Document navigation
└── docs/
    ├── BILLS-119hr1eas.xml     # Source document (1.7MB)
    ├── TECHNICAL_ARCHITECTURE.md
    └── MVP_IMPLEMENTATION_PLAN.md
```

## Current Issues & Next Steps

### Known Issues:
1. **Response Quality**: May need prompt refinement for better answers
2. **Performance**: Could optimize caching strategies further
3. **UI Polish**: Response formatting could be improved
4. **Error UX**: Better user feedback for various error states

### Immediate Next Steps:
1. **Test and refine prompts** for better response quality
2. **Optimize token usage** further if hitting limits
3. **Improve response formatting** in frontend
4. **Add more robust error handling**

### Future Enhancements:
- Document highlighting and navigation
- Query history and bookmarking
- Export functionality
- Mobile responsiveness improvements
- Advanced search filters

## Development Notes

### Critical Code Sections:
- `llmService.js:handleToolCallsRecursively()` - Core tool conversation logic
- `responseDisplay.js:displayResponse()` - Frontend response rendering
- `documentParser.js` - Document indexing and search

### Environment Setup:
```bash
# Required environment variables
ANTHROPIC_API_KEY=your_key_here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
NODE_ENV=development
PORT=3000

# Start development
npm run dev
```

### Testing Commands:
```bash
# Start server
npm start

# Test query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How will this bill affect my taxes?"}'
```

## Lessons Learned

### Tool_Use/Tool_Result Pairing:
- Claude API requires STRICT pairing of tool_use and tool_result blocks
- Every tool_use in assistant message must have corresponding tool_result in next user message
- Cannot modify message history without breaking this pairing
- Must execute pending tools before forcing final responses

### Token Management:
- Aggressive content truncation is necessary for complex documents
- Limit tool call iterations to prevent exponential token growth
- Balance between information quality and token efficiency

### Error Handling:
- Rate limits hit quickly with complex tool conversations
- Frontend timeout handling is critical for UX
- Proper error messages improve user experience significantly

## Success Metrics
- ✅ System processes queries without API errors
- ✅ Responses are generated within reasonable time (5-15 seconds)
- ✅ Frontend properly displays structured responses
- ✅ Tool calls provide relevant document information
- ✅ Caching reduces repeated processing

---

**Last Updated**: July 3, 2025
**Status**: Working system with room for optimization
**Next Session Focus**: Response quality improvement and UI polish