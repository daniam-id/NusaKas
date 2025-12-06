# PRD 1: Backend Core, Database & AI Service (v4.1)

## 1. Objective
Backend Monolith (Express.js) yang menyatukan API Server dan WhatsApp Client dalam satu runtime agar bisa saling komunikasi.

## 2. Tech Stack
- **Runtime:** Node.js (Express)
- **Database:** Supabase (PostgreSQL) - *Bypass Auth bawaan.*
- **Storage:** Supabase Storage (Bucket: `receipts`)
- **AI Engine:** Google Gemini 1.5 Flash
- **Security:** Custom JWT (JsonWebToken)
- **PDF Engine:** `puppeteer` atau `pdfkit`

## 3. Database Schema (Supabase SQL)
Jalankan di SQL Editor:

-- Enable UUID
create extension if not exists "uuid-ossp";

-- 1. Table: users (CUSTOM)
create table public.users (
id uuid default uuid_generate_v4() primary key,
wa_number text unique not null, -- Indexing otomatis karena unique
full_name text default 'Juragan',
created_at timestamptz default now()
);

-- 2. Table: otp_codes
create table public.otp_codes (
wa_number text primary key,
code text not null,
expires_at timestamptz not null
);

-- 3. Table: transactions
create table public.transactions (
id uuid default uuid_generate_v4() primary key,
user_id uuid references public.users(id) on delete cascade not null,

-- Smart ID Harian (Reset logic ada di code backend)
daily_id int,

type text check (type in ('INCOME', 'EXPENSE')) not null,
category text default 'Lainnya',
amount numeric not null,
description text,
transaction_date date default current_date,
proof_image_path text,
created_at timestamptz default now()
);

text

## 4. Environment Variables (.env)
Wajib ada:
PORT=3000
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_KEY=ey... (Service Role, BUKAN Anon)
GEMINI_API_KEY=AIza...
JWT_SECRET=rahasia_negara_123

text

## 5. API Contract (Backend -> Frontend)

### A. Auth (Public)
- `POST /api/auth/login`
  - Body: `{ "wa_number": "0812..." }`
  - Logic: Panggil `global.waSock.sendMessage()` untuk kirim OTP.
- `POST /api/auth/verify`
  - Body: `{ "wa_number": "0812...", "code": "1234" }`
  - Response: `{ "token": "ey...", "user": { ... } }`

### B. Data (Protected JWT)
- `GET /api/stats`
  - Return: `{ income: 5000, expense: 2000, balance: 3000 }`
- `GET /api/transactions`
  - Query: `?page=1&limit=10`
  - Return: `{ data: [{ id, daily_id, amount, ... }], meta: { ... } }`
- `GET /api/report/download`
  - Query: `?startDate=2025-12-01&endDate=2025-12-31`
  - Behavior: Generate PDF sesuai range tanggal -> Stream Download.

## 6. AI Service Logic
- `analyzeImage(buffer)`: Vision extraction.
- `parseCommand(text)`: NLP untuk deteksi intent (ADD_TRANSACTION vs DELETE_TRANSACTION).