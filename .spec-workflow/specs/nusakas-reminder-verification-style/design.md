# Design Document: NusaKas Reminder, Verification & Style Customization

**Spec Name**: nusakas-reminder-verification-style  
**Version**: 1.0  
**Date**: 2025-12-06  
**Status**: Draft  

## Architecture Overview

Implementation follows NusaKas' existing **monolith pattern** - single Express server hosting both API endpoints and WhatsApp bot. Design extends current architecture without breaking existing patterns while adding new functionality modules.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Express.js Server                     │
├─────────────────────────────────────────────────────────┤
│  API Routes              │  WhatsApp Bot                 │
│  ├─ /api/auth/*          │  ├─ Message Handler           │
│  ├─ /api/transactions    │  ├─ Command Parser            │
│  ├─ /api/stats           │  ├─ Intent Processing         │
│  ├─ /api/report          │  └─ Response Formatter        │
│  ├─ /api/register/*  [NEW]                                │
│  └─ /api/settings   [NEW]                                │
├─────────────────────────────────────────────────────────┤
│  Services Layer                                     │
│  ├─ AI Service (Gemini)  │  Database (Supabase)         │
│  ├─ Auth Service         │  ├─ users (extended)         │
│  ├─ Transaction Service  │  ├─ pending_registrations    │
│  ├─ Reminder Service [NEW]                             │
│  ├─ Settings Service [NEW]                             │
│  └─ Format Reply Service [NEW]                         │
├─────────────────────────────────────────────────────────┤
│  Background Scheduler [NEW]                            │
│  ├─ node-cron (every minute)                           │
│  └─ Reminder Queue                                      │
└─────────────────────────────────────────────────────────┘
```

## Database Design

### 1. Extend users table
```sql
ALTER TABLE public.users 
  ADD COLUMN reminder_time time DEFAULT '21:00:00',
  ADD COLUMN operational_days jsonb DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday"]',
  ADD COLUMN bot_style text DEFAULT 'santai' CHECK (bot_style IN ('formal', 'santai', 'semi-formal')),
  ADD COLUMN use_emoji boolean DEFAULT true,
  ADD COLUMN onboarding_complete boolean DEFAULT false;
```

### 2. New pending_registrations table
```sql
CREATE TABLE public.pending_registrations (
  wa_number text PRIMARY KEY,
  otp_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '10 minutes')
);
CREATE INDEX idx_pending_registrations_expires ON public.pending_registrations(expires_at);
```

## API Design

### New Endpoints

#### 1. Registration API (`/api/register`)
```
POST /api/register/start
├── Purpose: Start OTP verification flow from web
├── Input: { wa_number: "08xxxx" }
├── Output: { wa_link: "https://wa.me/628xxx?text=VERIFY%207788" }
└── Process: Generate OTP, save to pending_registrations, return WhatsApp link
```

#### 2. Settings API (`/api/settings`) 
```
GET /api/settings
├── Purpose: Get current user settings
├── Auth: JWT required
└── Output: { reminder_time, operational_days, bot_style, use_emoji }

PUT /api/settings  
├── Purpose: Update user settings
├── Auth: JWT required
├── Input: { reminder_time?, operational_days?, bot_style?, use_emoji? }
└── Process: Validate input, update users table
```

## Component Architecture

### 1. New Services

#### ReminderService
```typescript
class ReminderService {
  private cron: NodeCron;
  
  startScheduler(): void;  // Start node-cron job
  stopScheduler(): void;   // Stop scheduler
  sendReminder(user: User, customMessage?: string): Promise<void>;
  getPendingReminders(): Promise<User[]>;
}
```

#### RegistrationService
```typescript
class RegistrationService {
  startVerification(wa_number: string): Promise<VerificationResult>;
  verifyOTP(wa_number: string, otp_code: string): Promise<VerificationResult>;
  cleanupExpiredRegistrations(): Promise<void>;
}
```

#### SettingsService
```typescript
class SettingsService {
  getSettings(user_id: string): Promise<UserSettings>;
  updateSettings(user_id: string, settings: Partial<UserSettings>): Promise<UserSettings>;
  validateSettings(settings: Partial<UserSettings>): ValidationResult;
}
```

#### FormatReplyService
```typescript
class FormatReplyService {
  formatMessage(user: User, intent: MessageIntent, payload: any): string;
  private formatByStyle(style: BotStyle, template: string, payload: any): string;
  private addEmoji(text: string, intent: MessageIntent): string;
}
```

### 2. Extended Components

#### WhatsApp Message Handler
```typescript
// Extend existing message.handler.ts with new intents:
- VERIFY_OTP: Handle "VERIFY <code>" messages
- SET_REMINDER_TIME: Parse natural language for time setting
- SET_OPERATIONAL_DAYS: Parse natural language for day setting
- ONBOARDING_START: Start style preference collection
- ONBOARDING_STYLE: Handle style selection (1/2/3)
- ONBOARDING_EMOJI: Handle emoji preference (Ya/Tidak)
```

#### AI Service Enhancement
```typescript
// Extend CommandIntent type:
- VERIFY_OTP
- SET_REMINDER_TIME  
- SET_OPERATIONAL_DAYS
- ONBOARDING_CHOICE
```

## Message Flow Design

### 1. Reminder Flow
```
Scheduler (every minute)
  ↓
Query users WHERE reminder_time = now AND current_day IN operational_days
  ↓
For each user:
  → Format reminder message using FormatReplyService
  → Send via WhatsApp socket
  → Log reminder sent
```

### 2. OTP Verification Flow
```
Web Registration
  ↓
POST /api/register/start
  ↓
Generate random OTP (4-6 digits)
  ↓
Save to pending_registrations
  ↓
Return WhatsApp link with embedded OTP
  ↓
User clicks link → WhatsApp opens with text "VERIFY <OTP>"
  ↓
Bot receives message → Extract OTP
  ↓
Validate against pending_registrations
  ↓
Create user if new, mark onboarding as incomplete
  ↓
Start onboarding flow
```

### 3. Onboarding Flow
```
After successful verification:
  ↓
Send style selection message
  ↓
User replies (1/2/3) → Store bot_style
  ↓
Send emoji preference message  
  ↓
User replies (Ya/Tidak) → Store use_emoji
  ↓
Set onboarding_complete = true
  ↓
Send welcome + quick start guide
```

### 4. Settings Change Flow
```
User sends natural language command:
- "Set reminder jam 9 malam"
- "Tokoku buka Senin sampai Sabtu"
  ↓
AI parses intent + extracts entities
  ↓
Validate extracted values
  ↓
Update database
  ↓
Send confirmation using user's style
```

## Error Handling Strategy

### 1. Graceful Degradation
- If WhatsApp socket unavailable → queue reminders for later
- If AI parsing fails → use simple pattern matching as fallback
- If database operations fail → return user-friendly error messages
- If OTP expired → suggest requesting new one

### 2. Rate Limiting
- Registration attempts: 3 per hour per phone number
- Settings changes: 10 per hour per user
- AI requests: reuse existing rate limit (30/minute)

### 3. Validation
- Phone number normalization
- Time format validation (HH:mm)
- Day name mapping (Indonesia → English)
- Emoji preference boolean validation

## Security Design

### 1. Data Protection
- OTP codes: 4-6 digit random numbers (no sequential patterns)
- JWT authentication for all settings endpoints
- Input sanitization for natural language processing
- Database RLS policies for user data isolation

### 2. Session Management
- Clean up expired pending_registrations daily
- WhatsApp session persistence (existing mechanism)
- No sensitive data in logs

### 3. API Security
- CORS configuration for web dashboard
- Request size limits
- Input validation schemas

## Performance Considerations

### 1. Database Optimization
- Index on reminder_time for efficient queries
- Index on pending_registrations.expires_at
- JSONB indexing for operational_days

### 2. Caching Strategy
- In-memory cache for user settings (5-minute TTL)
- Rate limit state in-memory (existing pattern)

### 3. Background Processing
- Reminder scheduler runs in separate cron job
- Database cleanup runs hourly via cron
- Non-blocking WhatsApp message sending

## Testing Strategy

### 1. Unit Tests
- FormatReplyService: All style combinations
- SettingsService: Validation logic
- ReminderService: Time/day logic
- RegistrationService: OTP generation/validation

### 2. Integration Tests  
- End-to-end reminder flow
- OTP verification from web to WhatsApp
- Natural language parsing accuracy
- Settings update persistence

### 3. Mock Testing
- WhatsApp socket mock for bot testing
- Supabase client mock for database testing
- AI service mock for intent parsing

## Migration Strategy

### 1. Database Migration
```sql
-- Run as separate migration script
-- Safe to run on existing database
-- No breaking changes to existing data
```

### 2. Code Deployment
- Add new services without affecting existing routes
- Gradual feature rollout via feature flags (if needed)
- Maintain backward compatibility

### 3. Environment Updates
- Install node-cron dependency
- No new environment variables required
- Existing Supabase connection reused

## Implementation Priority

### Phase 1: Core Infrastructure
1. Database migration scripts
2. Basic services (Registration, Settings, FormatReply)
3. New API endpoints
4. WhatsApp message handler extensions

### Phase 2: Reminder System  
1. ReminderService implementation
2. node-cron scheduler setup
3. Integration with WhatsApp sending

### Phase 3: AI Integration
1. Enhanced intent parsing for settings commands
2. Natural language processing improvements
3. Error handling and fallbacks

### Phase 4: Polish & Testing
1. Comprehensive testing suite
2. Performance optimization
3. Documentation and error messages

## Dependencies & Integration

### New Dependencies
- `node-cron`: For reminder scheduler
- No changes to existing dependencies

### Integration Points
- **Supabase**: Extended schema + RLS policies
- **Baileys**: Reuse existing WhatsApp socket
- **AI Service**: Enhanced intent parsing  
- **JWT Auth**: Existing authentication system

### External APIs
- No new external API dependencies
- All functionality within existing infrastructure

---

**Next Phase**: Convert this design into atomic implementation tasks for systematic execution.
