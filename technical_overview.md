# NusaKas Technical Overview

## Project Architecture

NusaKas is a comprehensive organic fintech application built on a three-tier architecture with real-time WhatsApp integration.

### Core Components

**1. Backend Core (Express.js Monolith)**
- **Runtime**: Node.js with Express.js framework
- **Database**: Supabase PostgreSQL with custom schema (bypasses built-in auth)
- **Storage**: Supabase Storage bucket for receipt images
- **AI Engine**: Google Gemini 1.5 Flash for image analysis and NLP
- **Security**: Custom JWT implementation for authentication
- **PDF Generation**: Puppeteer or PDFKit for report generation
- **Responsibility**: API server, WhatsApp client, business logic processing

**2. WhatsApp Bot (Baileys)**
- **Client**: Baileys WhatsApp Web API
- **Integration**: Runs in same process as Express server
- **Features**: Auto-registration, transaction processing, AI-powered parsing
- **Responsibility**: Message handling, OTP delivery, command processing

**3. Frontend Dashboard (React/Vite)**
- **Framework**: React with Vite build system
- **Styling**: Solid theme (white/gray-50, no blurs)
- **Routing**: React Router with protected routes
- **Responsibility**: User interface, authentication, data visualization

### Component Interactions

**Data Flow**:
```
WhatsApp Message → Baileys Client → AI Analysis → Database → API → Frontend
```

**Control Flow**:
1. User sends WhatsApp message → Bot processes with AI → Stores in Supabase
2. Frontend requests data → API fetches from Supabase → Returns formatted response
3. Authentication flow → OTP sent via WhatsApp → JWT token issued
4. Report generation → Frontend triggers → PDF generated → Stream download

**API Communication**:
- **Public Endpoints**: `/api/auth/login`, `/api/auth/verify`
- **Protected Endpoints**: `/api/stats`, `/api/transactions`, `/api/report/download`
- **Authentication**: Custom JWT middleware (bypasses Supabase Auth)

### Database Schema

**users**: Custom user management with WhatsApp number as unique identifier
**otp_codes**: Temporary OTP storage for authentication
**transactions**: Financial records with daily ID tracking and AI-extracted metadata

### Deployment Architecture

**Runtime Environment**:
- Single Node.js process hosting both Express API and WhatsApp bot
- WhatsApp Web session persistence required
- Environment variables for API keys and database connections

**Build Process**:
- Backend: Standard Node.js deployment with dependency installation
- Frontend: Static build deployment serving React application
- Database: Supabase managed PostgreSQL with custom migrations

**Infrastructure Requirements**:
- Supabase project with service role access
- Google Gemini API key for AI services
- WhatsApp Web QR authentication capability
- Persistent storage for WhatsApp sessions

### Runtime Behavior

**Initialization Sequence**:
1. Express server starts
2. Supabase client connects with service role
3. WhatsApp bot connects to Baileys
4. Global socket state established for API access
5. API endpoints become available

**Request Processing**:
1. HTTP request received by Express
2. JWT authentication validation (if protected)
3. Business logic execution with Supabase integration
4. Response formatting and delivery
5. Error handling and logging

**WhatsApp Message Handling**:
1. Baileys receives message
2. Auto-registration check for new users
3. AI analysis for transaction data extraction
4. Database insertion with daily ID assignment
5. Confirmation message sent back

**Background Tasks**:
- WhatsApp connection monitoring and reconnection
- OTP code expiration cleanup
- Daily ID reset logic at midnight
- PDF report generation on demand

### Key Technical Features

**AI Integration**:
- Image vision analysis for receipt parsing
- Natural language processing for command interpretation
- Intelligent transaction categorization

**Security Measures**:
- Custom JWT implementation bypassing Supabase Auth
- Service role key isolation for backend operations
- Secure file upload handling with validation
- WhatsApp session security

**Performance Optimizations**:
- Shared socket state for efficient API-bot communication
- Paginated data responses for large transaction lists
- Cached AI responses where applicable
- Optimized database queries with proper indexing

### Error Handling Strategy

**WhatsApp Connection Issues**:
- Automatic reconnection attempts
- Message queuing during disconnection
- Graceful degradation of bot functionality

**AI Service Failures**:
- Fallback parsing mechanisms
- Manual override options
- Rate limiting and retry logic

**Database Connectivity**:
- Connection pooling
- Transaction rollback on failures
- Proper error response formatting

This architecture ensures seamless integration between all three components while maintaining high reliability and performance standards.
