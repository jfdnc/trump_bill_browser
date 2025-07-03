# Legislative Bill Query System

A fast, accessible web application for querying and understanding H.R. 1 (2025) using AI-powered analysis.

## Features

🤖 **AI-Powered Analysis**: Ask questions about the bill in plain English  
📖 **Document Navigation**: Browse and search through 1,700+ page legislation  
⚡ **Fast Response Times**: Intelligent caching for sub-second responses  
📱 **Mobile Responsive**: Works on all devices  
🎯 **Section Highlighting**: Jump directly to relevant bill sections  
💡 **Smart Suggestions**: Example questions to get you started  

## Quick Start

### Prerequisites

- Node.js 18+ 
- NPM 9+
- Anthropic Claude API key

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd trump_bill
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## Environment Variables

Create a `.env` file with:

```env
# Required
ANTHROPIC_API_KEY=your_claude_api_key_here

# Optional
PORT=3000
NODE_ENV=development
CACHE_TTL=3600
CACHE_MAX_SIZE=100
ALLOWED_ORIGINS=http://localhost:3000
```

## Usage Examples

**Personal Questions:**
- "How will this affect my taxes as a middle-class family?"
- "What changes are there to child tax credits?"
- "How does this impact my small business?"

**Policy Questions:**
- "What environmental programs are being cut or funded?"
- "What defense spending changes are included?"
- "How does this affect SNAP benefits?"

**Business Questions:**
- "What are the new rules for business expenses?"
- "How will this affect business tax deductions?"
- "What changes are there for small business owners?"

## API Endpoints

### Query Endpoints
- `POST /api/query` - Process user questions
- `GET /api/query/suggestions` - Get example questions

### Document Endpoints  
- `GET /api/document/structure` - Get bill hierarchy
- `GET /api/document/section/:id` - Get specific section
- `GET /api/document/search/:term` - Search bill content

### System Endpoints
- `GET /api/health` - Health check
- `GET /api/stats` - System statistics
- `GET /api/version` - Version information

## Architecture Overview

**Frontend**: Vanilla JavaScript with minimal dependencies  
**Backend**: Node.js + Express  
**AI Integration**: Anthropic Claude API  
**Caching**: In-memory with semantic matching  
**Document Processing**: XML parsing with full-text search  

## Development

### Available Scripts

```bash
npm run dev      # Start development server with auto-reload
npm start        # Start production server
npm test         # Run tests (when implemented)
npm run lint     # Lint code (when configured)
```

## Testing

Try these test queries to verify functionality:

```javascript
// Basic tax question
"How will this affect my taxes?"

// Specific policy area
"What changes are there to SNAP benefits?"

// Business-focused
"What are the new rules for business expenses?"

// Complex scenario
"What implications are there for me as a mother of 3 who is an immigrant?"
```

## Cost Management

**Expected Monthly Costs** (moderate traffic):
- **API Costs**: $50-200 (Anthropic Claude)
- **Hosting**: $10-50 (Platform costs)
- **Total**: $60-250/month

**Cost Optimization Features**:
- Intelligent caching reduces API calls by 60-80%
- Semantic caching for similar queries
- Real-time cost monitoring

## Security

- Input validation and sanitization
- Rate limiting on API endpoints
- Secure API key management
- CORS configuration
- No personal data storage

---

**Disclaimer**: This tool provides helpful summaries of legislation, but always verify important information with official sources.
