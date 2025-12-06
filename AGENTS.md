# NusaKas Agent Guidelines

## Quick Reference

**Always consult all 3 PRD files before starting any work:**
- `PRD-1-Backend-Core.md` - Express.js + Supabase + AI architecture
- `PRD-2-WhatsApp-Bot.md` - Baileys integration and message handling  
- `PRD-3-Frontend-Dashboard.md` - React components and authentication

## Development Workflow

### Before Starting Work
```bash
# Check current project state
git status
cat PROGRESS.md

# Review all PRD files
cat prd/PRD-1-Backend-Core.md
cat prd/PRD-2-WhatsApp-Bot.md  
cat prd/PRD-3-Frontend-Dashboard.md
```

### Implementation Commands
```bash
# Backend development
npm init -y
npm install express @supabase/supabase-js jsonwebtoken @baileys/puppeteer pdfkit
npm install -D typescript @types/node @types/express @types/jsonwebtoken

# Frontend development  
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install react-router-dom axios

# Environment setup
cp .env.example .env.local
# Edit .env.local with actual values

# Database setup
# Run SQL schema from PRD-1-Backend-Core.md in Supabase SQL Editor
```

## Code Style & Patterns

### Backend Architecture
- **Monolith Pattern**: Single Express process hosting both API and WhatsApp bot
- **Global State**: WhatsApp socket stored in global variable accessible to API endpoints
- **Dependency Injection**: Inject Supabase client and AI service into controllers
- **Error Handling**: Always wrap async operations in try/catch blocks

### WhatsApp Bot Integration
```javascript
// Global socket export (wa.js)
module.exports = {
  sock: global.waSock
};

// Express app access (index.js)
const wa = require('./wa');
const sendOTP = async (number, code) => {
  if (wa.sock) {
    await wa.sock.sendMessage(`${number}@s.whatsapp.net`, {
      text: `Kode OTP NusaKas: ${code}`
    });
  }
};
```

### Frontend Patterns
- **Protected Routes**: JWT token validation before component rendering
- **State Management**: React Context for authentication state
- **API Integration**: Axios interceptors for automatic token refresh
- **Error Boundaries**: Comprehensive error handling with user-friendly messages

## Critical Rules

### ✅ **ALWAYS consult all 3 files before work**
- Read PRD-1-Backend-Core.md for API contracts and database schema
- Read PRD-2-WhatsApp-Bot.md for message handling and command processing  
- Read PRD-3-Frontend-Dashboard.md for UI components and authentication flow

### ✅ **MUST update PROGRESS.md before commits**
- Document completed features and changes made
- Include timestamps and component affected
- Mark blocked items and next steps

### ✅ **Maintain consistency with patterns**
- Follow established naming conventions (camelCase for variables, PascalCase for components)
- Use consistent error handling patterns across all components
- Maintain modular structure with clear separation of concerns

### ✅ **Document significant changes**
- Update technical_overview.md for architecture changes
- Comment complex logic in code
- Update environment variables documentation

## File Structure
```
NusaKas/
├── backend/
│   ├── src/
│   │   ├── controllers/     # API route handlers
│   │   ├── services/        # Business logic, AI, PDF
│   │   ├── models/          # Database schemas
│   │   ├── middleware/      # Auth, validation
│   │   └── wa.js           # WhatsApp bot integration
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route components
│   │   ├── hooks/         # Custom React hooks
│   │   └── services/      # API integration
│   └── package.json
├── prd/                    # Requirements documents
├── technical_overview.md   # Architecture documentation
├── PROGRESS.md            # Development tracking
└── AGENTS.md             # This file
```

## Testing Commands
```bash
# Backend testing
npm test                    # Run unit tests
npm run test:integration    # Run API endpoint tests
npm run test:whatsapp      # Test WhatsApp bot flows

# Frontend testing  
npm test                    # Run React component tests
npm run test:e2e           # End-to-end user workflows
npm run test:accessibility # A11y compliance checks

# Build verification
npm run build              # Production build
npm run lint               # Code quality checks
npm run type-check         # TypeScript validation
```

## Environment Management

### Development
```bash
# Backend environment
PORT=3000
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_key
JWT_SECRET=development_secret

# Frontend environment
VITE_API_URL=http://localhost:3000/api
```

### Production
```bash
# Update production environment variables
# Ensure WhatsApp session persistence
# Configure proper error logging
# Set up monitoring and alerts
```

## Security Guidelines

### Backend Security
- Never expose service role keys to frontend
- Validate all user inputs before database operations
- Implement rate limiting for API endpoints
- Secure WhatsApp session storage

### Frontend Security  
- Never store sensitive data in localStorage
- Implement proper XSS protection
- Use HTTPS for all API communications
- Validate JWT tokens on protected routes

### Database Security
- Use Supabase Row Level Security (RLS) policies
- Implement proper user isolation
- Validate file uploads before Supabase Storage
- Monitor database access patterns

## Common Tasks

### Adding New API Endpoint
1. Create controller in `backend/src/controllers/`
2. Add route in `backend/src/index.js`
3. Update PROGRESS.md
4. Add corresponding frontend service method
5. Test endpoint with Postman/curl

### Adding New WhatsApp Command
1. Update `backend/src/wa.js` message handler
2. Add NLP parsing logic for new command
3. Test with actual WhatsApp message
4. Update PRD documentation if needed
5. Add integration test

### Adding New Frontend Component
1. Create component in `frontend/src/components/`
2. Add proper TypeScript interfaces
3. Implement responsive design
4. Add accessibility attributes
5. Write component tests

## Troubleshooting

### WhatsApp Connection Issues
```bash
# Check session files
ls -la ~/.baileys/

# Restart WhatsApp connection
npm run restart:whatsapp

# View connection logs
npm run logs:whatsapp
```

### Database Connection Problems
```bash
# Test Supabase connection
node -e "const { createClient } = require('@supabase/supabase-js'); console.log('Connected')"

# Check environment variables
npm run env:check
```

### Frontend Build Issues
```bash
# Clear node modules and reinstall
rm -rf node_modules frontend/node_modules
npm install
cd frontend && npm install

# Clear Vite cache
rm -rf frontend/node_modules/.vite
```

## Success Metrics

- ✅ All 3 PRD requirements implemented
- ✅ End-to-end WhatsApp transaction flow working
- ✅ Frontend authentication and dashboard functional
- ✅ PDF report generation successful
- ✅ Proper error handling across all components
- ✅ Tests passing with >90% coverage
- ✅ Performance benchmarks met
