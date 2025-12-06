# Requirements Document: NusaKas Reminder, Verification & Style Customization

**Spec Name**: nusakas-reminder-verification-style  
**Version**: 1.0  
**Date**: 2025-12-06  
**Status**: Draft  

## Executive Summary

Implementasi fitur reminder otomatis, verifikasi akun via OTP WhatsApp, kustomisasi gaya bahasa bot, dan pengaturan via WhatsApp untuk platform NusaKas (asisten pembukuan UMKM). Fitur ini akan mengubah NusaKas menjadi asisten pribadi yang lebih fleksibel dengan personalisasi tinggi.

## Problem Statement

User UMKM saat ini harus:
- Sering lupa mencatat transaksi harian
- Sulit mengatur pola kerja dan reminder 
- Butuh verifikasi akun yang lebih mudah dari web ke WhatsApp
- Mau customize cara bot berkomunikasi (formal/santai)
- Ingin ubah pengaturan reminder langsung dari WhatsApp

## User Stories

### Feature 1: Automatic Daily Reminders
**As a** small business owner  
**I want to** receive daily financial reminders at my preferred time and days  
**So that** I never forget to record my transactions  

**Acceptance Criteria**:
- [ ] User dapat set reminder jam tertentu (default 21:00)
- [ ] User dapat pilih hari operasional (default Senin-Sabtu)  
- [ ] System kirim reminder otomatis sesuai jadwal user
- [ ] Format reminder mengikuti preferensi gaya bahasa user

### Feature 2: WhatsApp OTP Verification  
**As a** new user registering on web  
**I want to** verify my account via WhatsApp link  
**So that** I don't need to manually open WhatsApp and remember verification codes  

**Acceptance Criteria**:
- [ ] Website generate OTP link untuk WhatsApp
- [ ] User klik link → WhatsApp terbuka otomatis dengan kode verifikasi
- [ ] Bot verifikasi OTP dan buat akun user
- [ ] OTP expired dalam 10 menit
- [ ] User mendapat konfirmasi verifikasi sukses

### Feature 3: Bot Style Customization
**As a** business owner with specific communication preferences  
**I want to** customize how the bot communicates with me  
**So that** I feel comfortable and the interaction feels natural  

**Acceptance Criteria**:
- [ ] User dapat pilih gaya bahasa: formal, santai, atau semi-formal
- [ ] User dapat toggle penggunaan emoji
- [ ] Bot otomatis mulai onboarding setelah verifikasi
- [ ] Format semua pesan bot mengikuti preferensi user

### Feature 4: WhatsApp Settings Management
**As a** busy business owner  
**I want to** change reminder settings directly from WhatsApp  
**So that** I can quickly adjust when I'm on mobile  

**Acceptance Criteria**:
- [ ] User dapat ubah jam reminder dengan perintah natural language
- [ ] User dapat ubah hari operasional dengan perintah natural language
- [ ] Bot support berbagai format waktu dan hari Indonesia
- [ ] Bot berikan konfirmasi perubahan dengan style user

### Feature 5: Web Settings API
**As a** web dashboard user  
**I want to** manage reminder settings from the web interface  
**So that** I can use full features both on mobile and desktop  

**Acceptance Criteria**:
- [ ] GET /api/settings return current reminder settings
- [ ] PUT /api/settings update reminder, days, style, emoji preference
- [ ] API security menggunakan JWT authentication
- [ ] API validate input data

## Technical Requirements

### Database Changes
1. **Extend users table**:
   - `reminder_time time DEFAULT '21:00:00'`
   - `operational_days jsonb DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday"]'`  
   - `bot_style text DEFAULT 'santai'`
   - `use_emoji boolean DEFAULT true`
   - `onboarding_complete boolean DEFAULT false`

2. **New pending_registrations table**:
   - `wa_number text primary key`
   - `otp_code text not null`
   - `created_at timestamptz DEFAULT now()`
   - `expires_at timestamptz DEFAULT (now() + interval '10 minutes')`

### Backend Dependencies
- Install `node-cron` untuk scheduler reminder
- Create new API routes: `/api/register/*`, `/api/settings`
- Extend WhatsApp message handler dengan intent parsing
- Create helper functions untuk formatReply, time parsing, day mapping

### External Integrations
- **WhatsApp Baileys**: Send reminder messages, receive verification, parse settings commands
- **Supabase**: Database operations untuk users dan pending_registrations
- **AI Service**: Parse natural language untuk SET_REMINDER_TIME dan SET_OPERATIONAL_DAYS

## Success Metrics

1. **Reminder Delivery**: >95% reminder messages delivered successfully
2. **OTP Verification**: <30 second average time from web to verified WhatsApp account
3. **User Adoption**: >80% users complete onboarding dan set preferences dalam 24 jam pertama
4. **Settings Change**: User dapat ubah reminder settings dalam 2 command WhatsApp
5. **Error Rate**: <5% failed verification attempts due to expired/invalid OTP

## Non-Functional Requirements

### Performance
- Reminder scheduler tidak impact performance API lain
- OTP verification response <2 detik
- Settings update reflect within 1 menit

### Security  
- OTP codes tidak predictable (4-6 digit random)
- JWT authentication untuk settings endpoints
- Rate limiting untuk verification attempts
- Clean up expired OTP data periodically

### Usability
- Natural language parsing intuitif untuk settings
- Fallback responses untuk command yang tidak dimengerti
- Progressive onboarding (tidak overwhelm user)

## Constraints & Assumptions

### Constraints
- Existing NusaKas architecture harus tetap monolith Express + Baileys
- Jangan ubah struktur file besar yang sudah ada
- Maintain backward compatibility dengan fitur existing

### Assumptions
- User sudah familiar dengan WhatsApp
- WhatsApp connection stabil untuk reminder delivery
- Database Supabase tetap primary storage
- AI service (Gemini) tetap digunakan untuk intent parsing

## Dependencies

### Technical Dependencies
- Existing WhatsApp Baileys integration
- Supabase database dengan users table
- Current AI service untuk intent parsing
- JWT authentication system

### External Dependencies  
- WhatsApp Web connection untuk bot
- Gemini AI API untuk natural language processing
- node-cron library untuk scheduler

## Out of Scope

- Push notifications outside WhatsApp
- Advanced analytics untuk reminder effectiveness
- Group chat support untuk reminder
- Multi-user reminder coordination
- Integration dengan accounting software lain

## Risks & Mitigations

### Risk: WhatsApp connection instability
**Mitigation**: Implement reconnection logic dan fallback reminder queue

### Risk: Natural language parsing inaccuracies  
**Mitigation**: Simple pattern matching as backup, clear help messages

### Risk: User confusion during onboarding
**Mitigation**: Clear step-by-step guidance, default fallback values

### Risk: Database schema changes affecting existing data
**Mitigation**: Careful migration scripts, comprehensive testing

## Acceptance Testing Strategy

1. **Unit Tests**: All helper functions, parsers, database operations
2. **Integration Tests**: End-to-end reminder flow, OTP verification flow  
3. **User Acceptance Testing**: Real WhatsApp scenarios dengan actual users
4. **Performance Testing**: Load testing untuk reminder scheduler
5. **Security Testing**: OTP generation randomness, JWT validation

---

**Next Phase**: Proceed to Design phase to define technical architecture and implementation approach.
