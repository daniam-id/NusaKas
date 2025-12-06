## Relevant Files

- `backend/src/index.js` - Main Express.js server entry point that initializes both API and WhatsApp bot in same process
- `backend/src/controllers/authController.js` - Handles login/verify OTP endpoints and WhatsApp integration for OTP delivery
- `backend/src/controllers/transactionController.js` - Manages transaction CRUD operations with pagination and daily ID tracking
- `backend/src/controllers/reportController.js` - Generates PDF reports using puppeteer/pdfkit for date range queries
- `backend/src/services/supabaseClient.js` - Supabase client configuration with service role for database operations
- `backend/src/services/aiService.js` - Google Gemini 1.5 Flash integration for image analysis and NLP parsing
- `backend/src/services/authService.js` - JWT token generation and validation logic (bypasses Supabase Auth)
- `backend/src/services/waService.js` - WhatsApp Baileys client management with shared socket state
- `backend/src/middleware/authMiddleware.js` - JWT validation middleware for protected routes
- `backend/src/middleware/validationMiddleware.js` - Input validation and sanitization for all API endpoints
- `backend/src/models/userModel.js` - Database operations for users table with WhatsApp number indexing
- `backend/src/models/transactionModel.js` - Transaction operations with daily ID reset logic
- `backend/src/models/otpModel.js` - OTP code storage and expiration management
- `backend/package.json` - Backend dependencies including Express, Supabase, Baileys, Gemini, PDF generation
- `backend/.env.example` - Environment variables template with all required API keys and URLs
- `frontend/src/App.tsx` - Main React application with routing configuration and protected routes
- `frontend/src/pages/Login.tsx` - OTP-based authentication flow with WhatsApp number input
- `frontend/src/pages/Dashboard.tsx` - Main dashboard with stats cards and transaction management table
- `frontend/src/pages/Reports.tsx` - Date range picker and PDF download interface
- `frontend/src/components/TransactionTable.tsx` - Transaction display with delete functionality
- `frontend/src/components/StatsCards.tsx` - Income, expense, and balance display components
- `frontend/src/components/OTPInput.tsx` - Reusable OTP input component for authentication
- `frontend/src/hooks/useAuth.ts` - Authentication state management and JWT token handling
- `frontend/src/services/api.ts` - Axios configuration and API endpoint wrappers
- `frontend/package.json` - Frontend dependencies including React, Vite, React Router, Axios
- `frontend/.env.example` - Frontend environment variables for API URL configuration
- `database/schema.sql` - Supabase database schema with users, otp_codes, and transactions tables
- `tests/backend/auth.test.js` - Authentication endpoint testing including OTP flow
- `tests/backend/transactions.test.js` - Transaction CRUD operations testing
- `tests/integration/whatsapp-bot.test.js` - End-to-end WhatsApp message processing testing
- `tests/integration/api-contract.test.js` - API contract verification between frontend and backend
- `tests/frontend/auth.test.tsx` - Authentication component testing
- `tests/frontend/dashboard.test.tsx` - Dashboard component and data display testing

### Notes

- Backend uses a monolithic architecture where Express.js API server and WhatsApp Baileys bot run in the same Node.js process for seamless communication
- All API endpoints must follow the contract specified in PRD-1-Backend-Core.md
- WhatsApp bot requires global socket state management accessible to API endpoints for OTP delivery
- Google Gemini AI is used for both image analysis (receipt parsing) and natural language processing (command interpretation)
- Custom JWT implementation bypasses Supabase built-in authentication as specified in requirements
- Frontend uses solid theme (white/gray-50) with no blur effects, as specified in PRD-3-Frontend-Dashboard.md
- Database daily ID tracking requires proper atomic operations and reset logic at midnight
- All test files should be placed alongside the code files they test, following the project structure established in AGENTS.md
- Use `npm test` to run all tests, or specify individual test files for targeted testing
- Environment variables must be configured before starting development, as specified in PROGRESS.md blockers

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:
- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Create and checkout a new branch for NusaKas implementation (`git checkout -b feature/nusakas-implementation`)
- [x] 1.0 Set up external service dependencies
  - [x] 1.1 Create Supabase project and obtain service role key for database operations
  - [x] 1.2 Set up Google Gemini 2.0 Flash API key for AI image analysis and NLP features
  - [x] 1.3 Configure development environment variables in `.env.local` files
  - [x] 1.4 Test external service connections (Supabase, Gemini API)
- [x] 2.0 Initialize backend core foundation
  - [x] 2.1 Create backend directory structure with proper organization
  - [x] 2.2 Initialize `package.json` with all required dependencies (Express, Supabase, Baileys, Gemini, PDF generation)
  - [x] 2.3 Set up TypeScript configuration for type safety
  - [x] 2.4 Create main Express.js server entry point (`index.ts`)
  - [x] 2.5 Configure basic middleware (CORS, JSON parsing, logging)
- [x] 3.0 Implement database schema and authentication
  - [x] 3.1 Run SQL schema migration in Supabase (users, otp_codes, transactions tables)
  - [x] 3.2 Create Supabase client configuration with service role access
  - [x] 3.3 Implement custom JWT authentication service (bypassing Supabase Auth)
  - [x] 3.4 Build JWT middleware for protected route validation
  - [x] 3.5 Create user authentication flow with OTP delivery via WhatsApp
- [x] 4.0 Build AI service integration (Google Gemini)
  - [x] 4.1 Create AI service wrapper for Google Gemini 2.0 Flash API
  - [x] 4.2 Implement image analysis function for receipt parsing and transaction extraction
  - [x] 4.3 Build NLP parsing function for command interpretation (ADD_TRANSACTION, DELETE_TRANSACTION)
  - [x] 4.4 Add error handling and rate limiting for AI service calls
  - [x] 4.5 Test AI service with sample receipts and text commands
- [x] 5.0 Implement core API endpoints
  - [x] 5.1 Build authentication endpoints (`/api/auth/login`, `/api/auth/verify`)
  - [x] 5.2 Create protected data endpoints (`/api/stats`, `/api/transactions`)
  - [x] 5.3 Implement PDF report generation endpoint (`/api/report/download`)
  - [x] 5.4 Add input validation middleware for all API endpoints
  - [x] 5.5 Implement proper error handling and response formatting
  - [x] 5.6 Add pagination and filtering for transaction listings
- [x] 6.0 Integrate WhatsApp bot functionality
  - [x] 6.1 Configure Baileys WhatsApp Web client with session persistence
  - [x] 6.2 Implement shared socket state management accessible by API endpoints
  - [x] 6.3 Create auto-registration flow for new users on first message
  - [x] 6.4 Build message processing pipeline (image download → AI analysis → database insert)
  - [x] 6.5 Implement command handlers for transaction CRUD operations
  - [x] 6.6 Add connection recovery logic and message queuing for stability
  - [ ] 6.7 Test WhatsApp bot with actual messages and verify API integration
- [ ] 7.0 Build frontend dashboard components
  - [ ] 7.1 Initialize React/Vite project with TypeScript support
  - [ ] 7.2 Set up React Router with protected route configuration
  - [ ] 7.3 Create OTP-based authentication flow components
  - [ ] 7.4 Build dashboard layout with stats cards (income, expense, balance)
  - [ ] 7.5 Implement transaction management table with delete functionality
  - [ ] 7.6 Create date range picker for report generation interface
  - [ ] 7.7 Add loading states, error handling, and responsive design
  - [ ] 7.8 Integrate with backend API endpoints using Axios interceptors
  - [ ] 7.9 Test frontend authentication flow and data display
- [ ] 8.0 Implement end-to-end integration testing
  - [ ] 8.1 Create unit tests for all backend controllers and services (>90% coverage)
  - [ ] 8.2 Build integration tests for API endpoints with Supabase database
  - [ ] 8.3 Implement WhatsApp bot end-to-end testing with message flows
  - [ ] 8.4 Create frontend component tests with React Testing Library
  - [ ] 8.5 Build API contract verification tests between frontend and backend
  - [ ] 8.6 Test critical user journeys (WhatsApp → Database → Frontend display)
  - [ ] 8.7 Validate security measures and authentication flows
  - [ ] 8.8 Performance testing for API response times and WhatsApp processing speed
- [ ] 9.0 Configure deployment and production setup
  - [ ] 9.1 Set up production environment configuration
  - [ ] 9.2 Configure WhatsApp session persistence for production deployment
  - [ ] 9.3 Implement proper logging and monitoring for all components
  - [ ] 9.4 Set up backup and recovery procedures for database and sessions
  - [ ] 9.5 Configure CI/CD pipeline with testing and deployment automation
  - [ ] 9.6 Create production-ready build processes for both frontend and backend
  - [ ] 9.7 Implement health checks and monitoring alerts
  - [ ] 9.8 Final production testing and deployment validation

### Critical Implementation Notes

- **Shared State Management**: The WhatsApp socket must be accessible to API endpoints for OTP delivery. Implement using global variables or singleton pattern.
- **WhatsApp Session Persistence**: Essential for production deployment - configure proper session storage and recovery mechanisms.
- **Database Daily ID Logic**: Implement atomic operations for daily ID tracking with proper reset mechanism at midnight.
- **AI Service Rate Limits**: Implement caching and batch processing for Google Gemini API calls to handle rate limiting.
- **Security Measures**: Ensure all file uploads are validated, JWT tokens are properly secured, and user data isolation is maintained.
- **Error Handling**: Comprehensive error handling across all components with graceful degradation and user-friendly messages.
