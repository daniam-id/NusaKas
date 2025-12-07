# 🏛️ NusaKas — Aplikasi Manajemen Kas UMKM Berbasis AI

[![TypeScript](https://img.shields.io/badge/TypeScript-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

**NusaKas** adalah aplikasi manajemen kas modern untuk UMKM Indonesia dengan fitur:
- 📱 **WhatsApp Bot** — Catat transaksi langsung dari chat
- 🤖 **AI-Powered** — Analisis struk otomatis dengan Google Gemini
- 📊 **Dashboard Real-time** — Pantau keuangan dari mana saja
- 📄 **Laporan PDF** — Generate laporan keuangan otomatis

---

## ✨ Fitur Utama & Cara Penggunaan

### 📱 WhatsApp Bot — Catat Transaksi via Chat

**Setup Pertama:**
1. Buka terminal backend → akan muncul QR Code
2. Buka WhatsApp HP → Settings → Linked Devices
3. Scan QR Code dengan HP
4. Bot siap digunakan!

**Cara Pakai Bot:**

**Catat Pemasukan:**
```
User: "Pemasukan 150000 dari penjualan bakso"
Bot: "✅ Pemasukan Rp150.000 dicatat sebagai 'penjualan bakso'
     💰 Total pemasukan hari ini: Rp150.000"
```

**Catat Pengeluaran:**
```
User: "Beli bahan baku 75000"
Bot: "✅ Pengeluaran Rp75.000 dicatat sebagai 'pembelian bahan baku'
     💸 Total pengeluaran hari ini: Rp75.000"
```

**Upload Struk Belanja:**
1. Kirim foto struk ke chat WhatsApp
2. Bot akan extract: toko, tanggal, item, total
3. Otomatis kategorisasi: makanan, transport, operasional
4. Saran: "Struk ini terlihat seperti belanja warung, dikategorikan 'operasional'"

### 🤖 AI-Powered Analysis — Smart Insights

**Analisis Struk Otomatis:**
- OCR recognition: toko, tanggal, items
- Smart categorization: makanan, transport, operasional
- Duplicate detection: cegah double entry
- Health insights: "Pengeluaran minggu ini naik 25%"

**Natural Language Processing:**
```
User: "Beli minyak goreng, gula, dan kopi total 45000"
Bot: "✅ Dikategorikan sebagai: kebutuhan rumah tangga
     📊 Rata-rata belanja kebutuhan rumah tangga: Rp35.000"
```

**Financial Health Check:**
```
User: "Analisis keuangan bulan ini"
Bot: "📈 Laporan AI:
     • Pemasukan: Rp2.500.000 (+10% dari bulan lalu)
     • Pengeluaran: Rp1.800.000 (-5% dari bulan lalu)
     • Sisa: Rp700.000
     •💡 Tips: Pengeluaran operational bisa dikurangi 15%"
```

### 📊 Dashboard Real-time — Monitor Keuangan

**Akses Dashboard:**
1. Buka http://localhost:3001
2. Login dengan nomor WhatsApp yang terdaftar
3. Dashboard otomatis menampilkan data terbaru

**Fitur Dashboard:**
- **Grafik Real-time:** Pemasukan vs Pengeluaran per hari
- **Summary Cards:** Total bulan ini, rata-rata harian
- **Filter Periode:** Harian, mingguan, bulanan
- **Export Data:** Download CSV/Excel
- **Reminders:** Notifikasi remind keuangan

### 📄 Laporan PDF — Generate Laporan Otomatis

**Generate Laporan:**
```
User: "Laporan bulanan"
Bot: "📄 Generating laporan PDF...
     ✅ Laporan siap! [Link download]
     
     📋 Laporan包含:
     • Ringkasan pemasukan & pengeluaran
     • Grafik per kategori
     • Top 10 transaksi terbesar
     • AI Insights & rekomendasi"
```

**Custom Report:**
```
User: "Laporan mulai 1 Des sampai 31 Des"
Bot: "✅ Laporan custom periode generated
     📊 Period: 1-31 Des 2025
     💰 Net profit: Rp450.000
     📈 AI: Tren bagus, tetap konsisten!"
```

### 🔐 Registration Flow — Multi-Platform

**Daftar via Web:**
1. Buka http://localhost:3001/register
2. Input nomor WhatsApp
3. Verifikasi OTP via WhatsApp
4. Lengkapi data: nama toko, pemilik, PIN
5. Akun siap!

**Daftar via WhatsApp:**
1. Kirim "DAFTAR" ke bot
2. Ikuti panduan: nama toko, pemilik, PIN
3. Verifikasi via WhatsApp
4. Auto-create session

**Hybrid Flow (Web ↔ WhatsApp):**
- Mulai di web → lanjutkan via WhatsApp
- Mulai via WhatsApp → lanjutkan di web
- Data tersinkronisasi otomatis

---

## 📸 Screenshot Aplikasi

### WhatsApp Bot Interaksi
![WhatsApp Chat](../screenshots/WhatsApp%20Image%202025-12-07%20at%2023.17.13.jpeg)

*Contoh interaksi dengan WhatsApp bot untuk pencatatan transaksi*

### Dashboard Real-time
![Dashboard](../screenshots/WhatsApp%20Image%202025-12-07%20at%2023.23.46.jpeg)

*Tampilan dashboard dengan grafik dan statistik real-time*

### AI Analysis - Struk Belanja
![AI Analysis](../screenshots/WhatsApp%20Image%202025-12-07%20at%2023.23.53.jpeg)

*Contoh analisis struk belanja dengan AI untuk ekstraksi data otomatis*

### Registration Flow
![Registration](../screenshots/WhatsApp%20Image%202025-12-07%20at%2023.24.25(1).jpeg)

*Step-by-step registrasi multi-platform (Web & WhatsApp)*

### Transaction History
![Transaction History](../screenshots/WhatsApp%20Image%202025-12-07%20at%2023.24.44.jpeg)

*View riwayat transaksi dan analisis data*

---

Pastikan sudah terinstall:

| Software | Versi | Cek Versi |
|----------|-------|-----------|
| Node.js | >= 20 | `node -v` |
| npm | >= 10 | `npm -v` |
| Git | any | `git --version` |

**API Keys yang dibutuhkan:**
- [Supabase](https://supabase.com) — Database & Auth
- [Google AI Studio](https://aistudio.google.com/app/apikey) — Gemini API

---

## 🚀 Instalasi — Step by Step

### 1. Clone Repository

```bash
git clone https://github.com/daniam-id/NusaKas.git
cd NusaKas
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Setup Environment Variables

#### Frontend (.env di root folder)
```bash
cp .env.example .env
```

Edit file `.env`:
```env
# Supabase (Frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# API Configuration
VITE_USE_LOCAL_API=true
```

#### Backend (backend/.env)
```bash
cp .env.example backend/.env
```

Edit file `backend/.env`:
```env
# Server
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# JWT (generate random string min 32 karakter)
JWT_SECRET=your_jwt_secret_key_minimum_32_characters

# WhatsApp Session
WA_SESSION_PATH=.wa-session
```

### 4. Setup Database

Jalankan SQL migrations di Supabase SQL Editor:
1. Buka [Supabase Dashboard](https://supabase.com/dashboard)
2. Pilih project → SQL Editor
3. Jalankan file-file di folder `backend/sql/` secara berurutan:
   - `001_initial_schema.sql`
   - `002_add_wa_number.sql`
   - `003_fix_users_table.sql`
   - `004_reminder_verification_style.sql`

### 5. Jalankan Aplikasi

**Opsi A: Jalankan terpisah (2 terminal)**

Terminal 1 — Backend:
```bash
cd backend
npm run dev
```

Terminal 2 — Frontend:
```bash
npm run dev
```

**Opsi B: Jalankan bersamaan (1 terminal)**
```bash
npm run dev:both
```

### 6. Akses Aplikasi

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:3000 |
| Health Check | http://localhost:3000/health |

### 7. Setup WhatsApp Bot (Pertama Kali)

1. Buka terminal backend, akan muncul **QR Code**
2. Buka WhatsApp di HP → Settings → Linked Devices
3. Scan QR Code
4. Bot siap digunakan!

---

## 🐳 Menjalankan dengan Docker (Opsional)

```bash
# Build dan jalankan
docker compose up -d --build

# Lihat logs
docker logs -f nusakas-backend

# Stop
docker compose down
```

---

## 📁 Struktur Proyek

```
NusaKas/
├── backend/                 # Express.js API + WhatsApp Bot
│   ├── src/
│   │   ├── controllers/     # API handlers
│   │   ├── services/        # Business logic
│   │   ├── whatsapp/        # WhatsApp bot handlers
│   │   └── index.ts         # Entry point
│   └── sql/                 # Database migrations
├── components/              # React components
├── pages/                   # Page components
├── services/                # Frontend API services
├── App.tsx                  # Root component
└── docker-compose.yml       # Docker configuration
```

---

## 🔧 Environment Variables

### Frontend
| Variable | Keterangan | Wajib |
|----------|------------|-------|
| `VITE_SUPABASE_URL` | URL project Supabase | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase | ✅ |
| `VITE_USE_LOCAL_API` | `true` untuk development | ✅ |

### Backend
| Variable | Keterangan | Wajib |
|----------|------------|-------|
| `SUPABASE_URL` | URL project Supabase | ✅ |
| `SUPABASE_SERVICE_KEY` | Service role key | ✅ |
| `GEMINI_API_KEY` | Google AI API key | ✅ |
| `JWT_SECRET` | Secret untuk JWT (min 32 char) | ✅ |
| `PORT` | Port backend (default: 3000) | ❌ |
| `NODE_ENV` | `development` / `production` | ❌ |

---

## 🧪 Scripts

```bash
# Development
npm run dev           # Frontend (port 3001)
npm run dev:alt       # Frontend alternatif (port 3002)
npm run dev:backend   # Backend only
npm run dev:both      # Frontend + Backend

# Build
npm run build         # Build frontend
```

---

## 🐛 Troubleshooting

### Port sudah digunakan
```bash
# Kill process di port 3001
kill -9 $(lsof -t -i :3001)
```

### WhatsApp QR tidak muncul
```bash
# Hapus session lama
rm -rf backend/.wa-session/*
# Restart backend
```

### CORS Error
Pastikan `VITE_USE_LOCAL_API=true` di file `.env`

---

## 👥 Tim Pengembang

- **daniam-id** — Fullstack Developer
  
  [GitHub](https://github.com/daniam-id)

---

## 📄 Lisensi

MIT License — Silakan gunakan dan modifikasi sesuai kebutuhan.
