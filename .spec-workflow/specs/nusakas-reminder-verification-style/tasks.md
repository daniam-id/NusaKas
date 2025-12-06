# Implementation Tasks: NusaKas Reminder, Verification & Style Customization

**Spec Name**: nusakas-reminder-verification-style  
**Version**: 1.0  
**Date**: 2025-12-06  
**Status**: Ready for Implementation

## Implementation Overview

This document breaks down the design into atomic implementation tasks. Each task is designed to be completed by a specialized developer role, with clear file paths and requirement references. Tasks are ordered for optimal development flow and dependency management.

## Task 1: Database Schema Update
**Status**: `[x]` Completed  
**Priority**: High  
**Estimated Time**: 30 minutes  

### Role
Backend Developer specializing in database migrations and Supabase operations

### Task Description
Create and execute database migration scripts to extend the users table and create new pending_registrations table for OTP verification system.

### Files to Create
- `backend/sql/004_reminder_verification_style.sql` - Migration script
- `.spec-workflow/specs/nusakas-reminder-verification-style/Implementation Logs/task-1_timestamp_id.md` - Implementation log

### Requirements Implemented
- REQ-2.1: Extend users table dengan kolom reminder_time, operational_days, bot_style, use_emoji, onboarding_complete
- REQ-2.2: Create pending_registrations table untuk verifikasi OTP

### Implementation Details
1. **Extend users table**:
   ```sql
   ALTER TABLE public.users 
     ADD COLUMN reminder_time time DEFAULT '21:00:00',
     ADD COLUMN operational_days jsonb DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday"]',
     ADD COLUMN bot_style text DEFAULT 'santai' CHECK (bot_style IN ('formal', 'santai', 'semi-formal')),
     ADD COLUMN use_emoji boolean DEFAULT true,
     ADD COLUMN onboarding_complete boolean DEFAULT false;
   ```

2. **Create pending_registrations table**:
   ```sql
   CREATE TABLE public.pending_registrations (
     wa_number text PRIMARY KEY,
     otp_code text NOT NULL,
     created_at timestamptz DEFAULT now(),
     expires_at timestamptz DEFAULT (now() + interval '10 minutes')
   );
   ```

3. **Add indexes**:
   - `idx_pending_registrations_expires` on expires_at column
   - `idx_users_reminder_time` on reminder_time column

### Success Criteria
- Migration runs successfully in Supabase SQL Editor
- All columns are added with correct data types and defaults
- Check constraints validate bot_style values
- Indexes created for performance optimization
- Existing user data remains unaffected

### Leveraging Existing Code
- Follow existing migration patterns in `backend/sql/001_initial_schema.sql`
- Use consistent naming conventions
- Apply same indexing strategy as existing tables

---

## Task 2: Install Node-Cron Dependency
**Status**: `[x]` Completed  
**Priority**: High  
**Estimated Time**: 15 minutes  

### Role
Backend Developer specializing in Node.js dependency management

### Task Description  
Install and configure node-cron library for reminder scheduling functionality.

### Files to Modify
- `backend/package.json` - Add node-cron dependency
- `backend/package-lock.json` - Updated lock file

### Requirements Implemented
- REQ-3.2: Scheduler di backend menggunakan node-cron

### Implementation Details
1. **Install node-cron**:
   ```bash
   npm install node-cron
   npm install -D @types/node-cron
   ```

2. **Update package.json dependencies**:
   - Add `"node-cron": "^3.0.3"` to dependencies
   - Add `"@types/node-cron": "^3.0.11"` to devDependencies

### Success Criteria
- Dependencies installed successfully
- Package.json updated with correct versions
- No dependency conflicts
- Type definitions available for TypeScript

### Leveraging Existing Code
- Follow existing dependency pattern in package.json
- Use same version management approach as other dependencies

---

## Task 3: Create Core Services
**Status**: `[x]` Completed  
**Priority**: High  
**Estimated Time**: 2 hours  

### Role
Backend Developer specializing in TypeScript service architecture

### Task Description
Create new service classes for RegistrationService, SettingsService, FormatReplyService that follow existing patterns and integrate with current architecture.

### Files to Create
- `backend/src/services/registration.service.ts` - OTP verification logic
- `backend/src/services/settings.service.ts` - User settings management  
- `backend/src/services/format-reply.service.ts` - Message formatting
- `backend/src/services/reminder.service.ts` - Reminder scheduling
- `backend/src/types/index.ts` - Extend with new interfaces
- Update `backend/src/services/index.ts` - Export new services

### Requirements Implemented
- REQ-4.1: Verifikasi via link OTP dengan endpoint register
- REQ-7.1: Settings API endpoints
- REQ-5.2: Template balasan dinamis dengan formatReply
- REQ-3.2: Scheduler di backend

### Implementation Details
1. **RegistrationService**:
   ```typescript
   class RegistrationService {
     startVerification(wa_number: string): Promise<VerificationResult>;
     verifyOTP(wa_number: string, otp_code: string): Promise<VerificationResult>;
     cleanupExpiredRegistrations(): Promise<void>;
   }
   ```

2. **SettingsService**:
   ```typescript
   class SettingsService {
     getSettings(user_id: string): Promise<UserSettings>;
     updateSettings(user_id: string, settings: Partial<UserSettings>): Promise<UserSettings>;
     validateSettings(settings: Partial<UserSettings>): ValidationResult;
   }
   ```

3. **FormatReplyService**:
   ```typescript
   class FormatReplyService {
     formatMessage(user: User, intent: MessageIntent, payload: any): string;
     private formatByStyle(style: BotStyle, template: string, payload: any): string;
   }
   ```

4. **ReminderService**:
   ```typescript
   class ReminderService {
     startScheduler(): void;
     stopScheduler(): void;
     sendReminder(user: User): Promise<void>;
   }
   ```

### Success Criteria
- All services follow existing architectural patterns
- TypeScript interfaces properly defined
- Error handling consistent with existing services
- Integration with Supabase and existing patterns
- All methods properly documented

### Leveraging Existing Code
- Follow service patterns in `backend/src/services/`
- Use same Supabase integration pattern as `auth.service.ts`
- Apply same error handling pattern as existing services
- Extend types in same file structure as `types/index.ts`

---

## Task 4: Create New API Routes and Controllers
**Status**: `[x]` Completed  
**Priority**: High  
**Estimated Time**: 1.5 hours  

### Role  
Backend Developer specializing in Express.js API development

### Task Description
Create new API routes and controllers for registration and settings endpoints, following existing patterns and middleware.

### Files to Create
- `backend/src/routes/register.routes.ts` - Registration endpoints
- `backend/src/routes/settings.routes.ts` - Settings endpoints  
- `backend/src/controllers/register.controller.ts` - Registration logic
- `backend/src/controllers/settings.controller.ts` - Settings logic

### Files to Modify
- `backend/src/index.ts` - Add new route registrations
- Update `backend/src/routes/index.ts` if exists

### Requirements Implemented
- REQ-4.1: Endpoint POST /api/register/start
- REQ-7.1: GET /api/settings endpoint
- REQ-7.2: PUT /api/settings endpoint

### Implementation Details
1. **Registration Routes**:
   ```typescript
   POST /api/register/start - Start OTP verification
   ```

2. **Settings Routes**:
   ```typescript
   GET /api/settings - Get user settings (JWT required)
   PUT /api/settings - Update user settings (JWT required)
   ```

3. **Controller Methods**:
   - Input validation using existing validation middleware
   - JWT authentication for settings endpoints
   - Consistent response format with existing controllers
   - Error handling following existing patterns

### Success Criteria
- Routes follow existing Express.js patterns
- Controllers use same response format as existing controllers
- JWT authentication properly implemented for settings
- Input validation using existing middleware patterns
- Proper HTTP status codes and error responses

### Leveraging Existing Code
- Follow route patterns in `backend/src/routes/`
- Use controller structure from `auth.controller.ts`
- Apply middleware patterns from existing routes
- Integrate with existing authentication system

---

## Task 5: Extend WhatsApp Message Handler
**Status**: `[x]` Completed  
**Priority**: High  
**Estimated Time**: 2.5 hours  

### Role  
Backend Developer specializing in WhatsApp bot integration and message processing

### Task Description  
Extend existing WhatsApp message handler to support new intents: VERIFY_OTP, SET_REMINDER_TIME, SET_OPERATIONAL_DAYS, and onboarding flow.

### Files to Modify
- `backend/src/whatsapp/handlers/message.handler.ts` - Extend intent handling
- `backend/src/whatsapp/handlers/user.handler.ts` - Enhance user management
- `backend/src/services/ai.service.ts` - Extend CommandIntent type

### Requirements Implemented
- REQ-4.2: Handle pesan VERIFY <OTP> di bot WA
- REQ-5.1: Onboarding via WhatsApp untuk gaya bahasa
- REQ-6.1: Set reminder time via WA dengan natural language
- REQ-6.2: Set hari operasional via WA dengan natural language

### Implementation Details
1. **Extend AI Service CommandIntent**:
   ```typescript
   export type CommandIntent = 
     | { intent: 'VERIFY_OTP'; otpCode: string }
     | { intent: 'SET_REMINDER_TIME'; time: string }
     | { intent: 'SET_OPERATIONAL_DAYS'; days: string[] }
     | { intent: 'ONBOARDING_STYLE'; choice: number }
     | { intent: 'ONBOARDING_EMOJI'; choice: boolean }
     // ... existing intents
   ```

2. **Message Handler Extensions**:
   - Add VERIFY_OTP handling in message handler
   - Implement onboarding flow state management
   - Add settings change parsing
   - Integrate with new services

3. **User Handler Enhancements**:
   - Extend ensureUser to handle onboarding state
   - Add methods for user settings management
   - Implement fallback for new users

### Success Criteria
- VERIFY_OTP messages create/activate users properly
- Onboarding flow completes style and emoji selection
- Natural language settings changes work correctly
- All new intents integrate seamlessly with existing flow
- Error handling for unrecognized commands

### Leveraging Existing Code
- Follow message handler patterns in `message.handler.ts`
- Use same AI service integration pattern
- Apply same user management approach in `user.handler.ts`
- Maintain compatibility with existing intent handling

---

## Task 6: Implement Reminder Scheduler
**Status**: `[x]` Completed  
**Priority**: High  
**Estimated Time**: 2 hours  

### Role
Backend Developer specializing in background job processing and cron scheduling

### Task Description
Implement node-cron based reminder scheduler that runs every minute, checks for users needing reminders, and sends appropriate messages.

### Files to Create
- `backend/src/jobs/reminder.job.ts` - Cron job implementation
- `backend/src/utils/time-parser.util.ts` - Time parsing utilities
- `backend/src/utils/day-mapper.util.ts` - Day name mapping

### Files to Modify  
- `backend/src/index.ts` - Initialize scheduler on server start
- `backend/src/services/reminder.service.ts` - Complete implementation

### Requirements Implemented
- REQ-3.2: Cron job jalan setiap menit
- REQ-3.1: Pengingat harian dengan jam + hari operasional
- REQ-3.3: Format pesan reminder sesuai gaya bahasa

### Implementation Details
1. **Cron Job Implementation**:
   ```typescript
   // Run every minute
   cron.schedule('* * * * *', async () => {
     const currentTime = format(now(), 'HH:mm');
     const currentDay = getCurrentDay();
     
     const usersToRemind = await getUsersForReminder(currentTime, currentDay);
     
     for (const user of usersToRemind) {
       await sendReminder(user);
     }
   });
   ```

2. **Database Query**:
   ```sql
   SELECT id, wa_number, bot_style, use_emoji 
   FROM users
   WHERE to_char(reminder_time, 'HH24:MI') = to_char(now(), 'HH24:MI')
     AND operational_days ? lower(to_char(now(), 'day'))
   ```

3. **Message Formatting**:
   - Use FormatReplyService for personalized messages
   - Different templates for different bot styles
   - Conditional emoji inclusion

### Success Criteria
- Scheduler runs every minute without missing executions
- Correct users are identified for reminders
- Messages are formatted according to user preferences
- No duplicate reminders sent
- Graceful handling of WhatsApp connection failures

### Leveraging Existing Code
- Use existing WhatsApp socket from `whatsapp/index.ts`
- Integrate with FormatReplyService
- Follow same error handling patterns
- Apply logging conventions from existing code

---

## Task 7: Enhance AI Service for Natural Language Processing
**Status**: `[x]` Completed  
**Priority**: Medium  
**Estimated Time**: 2 hours  

### Role
Backend Developer specializing in AI integration and NLP

### Task Description
Enhance AI service to support natural language parsing for reminder time and operational days settings, including robust fallbacks for pattern matching.

### Files to Modify
- `backend/src/services/ai.service.ts` - Extend parsing capabilities

### Requirements Implemented
- REQ-6.1: Parse natural language untuk SET_REMINDER_TIME
- REQ-6.2: Parse natural language untuk SET_OPERATIONAL_DAYS

### Implementation Details
1. **Time Parsing Patterns**:
   - Support formats: "21:00", "21.00", "9", "9 malam", "08.30"
   - Convert to HH:mm:ss format
   - Handle 12-hour and 24-hour formats
   - Indonesian time expressions ("malam", "pagi", etc.)

2. **Day Parsing Patterns**:
   - Map Indonesian day names to English: "senin" → "monday"
   - Support range expressions: "Senin sampai Sabtu"
   - Handle exclusion patterns: "libur hari Minggu"
   - Parse comma-separated lists: "Senin, Rabu, Jumat"

3. **Enhanced Intent Recognition**:
   - Extend AI prompts for settings parsing
   - Add quick pattern matching for common formats
   - Provide confidence scores for parsing results

### Success Criteria
- Accurate parsing of various time formats
- Correct mapping of Indonesian day names
- Robust handling of edge cases and errors
- Fallback pattern matching when AI fails
- Integration with existing AI service architecture

### Leveraging Existing Code
- Extend existing CommandIntent type
- Use same AI prompting patterns
- Apply same error handling and fallbacks
- Maintain compatibility with existing parsing logic

---

## Task 8: Integration Testing and Validation
**Status**: `[x]` Completed  
**Priority**: Medium  
**Estimated Time**: 3 hours  

### Role
QA Engineer specializing in API testing and WhatsApp bot validation

### Task Description
Perform comprehensive testing of all new features including end-to-end flows, error scenarios, and integration points.

### Files to Create (Optional)
- `backend/tests/integration/` - Integration test files
- `backend/tests/unit/` - Unit tests for new services

### Requirements Implemented
All requirements validated through testing

### Implementation Details
1. **API Testing**:
   - POST /api/register/start with various phone number formats
   - GET /api/settings with proper authentication
   - PUT /api/settings with valid and invalid data
   - Error scenarios and edge cases

2. **WhatsApp Integration Testing**:
   - VERIFY OTP flow end-to-end
   - Onboarding completion scenarios
   - Settings change commands
   - Reminder message delivery

3. **Database Testing**:
   - Migration script execution
   - Data integrity validation
   - Index performance verification

### Success Criteria
- All API endpoints return correct responses
- WhatsApp flows complete successfully
- Reminders are sent at correct times
- Natural language parsing accuracy >90%
- Error handling works as expected
- Performance meets requirements

### Leveraging Existing Code
- Follow existing test patterns if tests exist
- Use same testing tools and frameworks
- Apply same validation approaches

---

## Implementation Order & Dependencies

### Phase 1: Foundation (Tasks 1-2)
**Prerequisites**: None  
**Parallel Execution**: Tasks 1 and 2 can run in parallel  

### Phase 2: Core Services (Task 3)  
**Prerequisites**: Tasks 1-2 completed  
**Dependencies**: Database schema, node-cron installed  

### Phase 3: API Layer (Task 4)
**Prerequisites**: Task 3 completed  
**Dependencies**: Core services implemented  

### Phase 4: WhatsApp Integration (Task 5)
**Prerequisites**: Task 3 completed  
**Dependencies**: Services available for integration  

### Phase 5: Background Jobs (Task 6)
**Prerequisites**: Tasks 3, 5 completed  
**Dependencies**: WhatsApp integration, services ready  

### Phase 6: AI Enhancement (Task 7)
**Prerequisites**: Task 5 completed  
**Dependencies**: WhatsApp handler extended  

### Phase 7: Testing & Validation (Task 8)
**Prerequisites**: Tasks 1-7 completed  
**Dependencies**: All features implemented  

## Success Metrics & Validation

Each task includes specific success criteria. Overall implementation success measured by:
- All 5 main requirements implemented and tested
- End-to-end flows working: Registration → Onboarding → Reminders
- Natural language settings changes working
- No regression in existing functionality
- Performance targets met (<2s response times, 95% reminder delivery)

---

**Ready for Implementation**: All tasks defined with clear roles, file paths, and success criteria.
