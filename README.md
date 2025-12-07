# 🏛️ NusaKas — Aplikasi Manajemen Kas Modern Berbasis AI

[![TypeScript](https://img.shields.io/badge/TypeScript-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**NusaKas** adalah aplikasi manajemen kas modern yang dirancang untuk membantu UMKM, organisasi, maupun bisnis pribadi di Indonesia dalam mengelola transaksi keuangan dengan cepat, rapi, dan cerdas.
Dengan integrasi **Google Gemini AI**, NusaKas mampu memberikan insight keuangan otomatis sehingga pengguna dapat mengambil keputusan lebih baik.

---

# ✨ Fitur Utama

### 💰 1. Pencatatan Transaksi

* Tambah pemasukan & pengeluaran
* Kategori fleksibel sesuai kebutuhan
* Mendukung catatan / deskripsi transaksi

### 📊 2. Dashboard Analitik Real-Time

* Grafik pemasukan/pengeluaran
* Ringkasan bulanan & tahunan
* Insight otomatis dari AI

### 🤖 3. AI Assistant (Google Gemini)

* Analisis transaksi secara otomatis
* Saran kesehatan keuangan
* Menjawab pertanyaan terkait keuangan usaha

### 🧾 4. Laporan Keuangan

* Rekap otomatis per hari/bulan/tahun
* Format terstruktur & siap presentasi

### 🔐 5. Keamanan Data

* Environment-based API keys
* Struktur project aman & modular

### 📱 6. Responsive Design

* Tampilan optimal di PC, tablet, maupun mobile

  

# 🧩 Prerequisites (Wajib Dipenuhi Sebelum Instalasi)

Sebelum menjalankan NusaKas, pastikan perangkat Anda telah memiliki:

### **1. Node.js (versi 16 atau lebih baru)**

Unduh di: [https://nodejs.org/](https://nodejs.org/)
Cek versi:

```bash
node -v
```

### **2. Package Manager**

Pilih salah satu:

* **npm** (sudah termasuk dalam Node.js)
* atau **yarn**
  Cek versi:

  ```bash
  npm -v
  yarn -v
  ```

### **3. Gemini API Key**

Aplikasi menggunakan Google Gemini untuk fitur AI.
Buat API key melalui:

🔗 [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### **4. Git**

Diperlukan untuk cloning repository.

```bash
git --version
```

### **5. (Opsional) Docker & Docker Compose**

Jika ingin menjalankan aplikasi menggunakan container:

* Docker Desktop / Docker CLI
* Docker Compose sudah termasuk dalam versi modern Docker

# 🚀 Instalasi — Langkah Demi Langkah

## **1. Clone Repository**

```bash
git clone https://github.com/daniam-id/NusaKas.git
cd NusaKas
```

## **2. Install Dependencies**

> Menggunakan npm

```bash
npm install
```

> Atau menggunakan yarn

```bash
yarn install
```

## **3. Siapkan Environment Variables**

1. Salin file template:

   ```bash
   cp .env.example .env.local
   ```
2. Edit file `.env.local` lalu isi:

   ```env
   GEMINI_API_KEY=masukkan_api_key_anda
   ```

> **Catatan:** API key bisa dibuat di Google AI Studio.

## **4. Jalankan Aplikasi dalam Mode Development**

```bash
npm run dev
```

Jika berhasil, akan muncul URL seperti:

```
http://localhost:5173
```

## **5. Build untuk Production**

```bash
npm run build
```

## **6. Preview Build**

```bash
npm run preview
```

---

# 🐳 Menjalankan dengan Docker (Opsional)

```bash
docker-compose up -d
```

Hentikan container:

```bash
docker-compose down
```

---

# 📁 Struktur Proyek

```
NusaKas/
├── backend/               # API & service backend
├── components/            # Reusable React components
├── context/               # State management (Context API)
├── pages/                 # Halaman utama aplikasi
├── public/images/         # Asset gambar
├── services/              # Service & API handler
├── prd/                   # Product documentation
├── scripts/               # Build/deploy scripts
├── types.ts               # TypeScript type definitions
├── App.tsx                # Root application file
├── index.tsx              # Entry point
└── docker-compose.yml     # Docker configuration
```

---

# 🛠️ Tech Stack

### **Frontend**

* React 18
* TypeScript
* Vite
* TailwindCSS (opsional, jika digunakan)

### **AI**

* Google Gemini API
* NLP & AI agent orchestration

### **Backend**

* Node.js
* Express (atau setup backend lain sesuai folder backend/)

### **DevOps**

* Docker & Docker Compose

---

# 🔧 Environment Variables

| Variable         | Fungsi                 | Wajib    |
| ---------------- | ---------------------- | -------- |
| `GEMINI_API_KEY` | Kunci API Gemini AI    | ✔ Yes    |
| `VITE_API_URL`   | URL Backend (jika ada) | Optional |
| `VITE_APP_NAME`  | Nama aplikasi          | Optional |

---

# 🧪 Scripts Tersedia

```bash
npm run dev          # Jalankan development server
npm run build        # Build untuk production
npm run preview      # Preview hasil build
npm run test         # Menjalankan unit test
npm run lint         # Mengecek linting
npm run lint:fix     # Memperbaiki linting otomatis
npm run format       # Format code dengan Prettier
```

---

# 🐛 Troubleshooting

### ❗ *Error*: "GEMINI_API_KEY is not set"

Pastikan:

* File `.env.local` sudah dibuat
* Isi `GEMINI_API_KEY` benar dan masih aktif

### ❗ Port 5173 Sudah Digunakan

Edit `vite.config.ts`:

```ts
export default defineConfig({
  server: {
    port: 3000
  }
})
```

---

# 👥 Developer

* **daniam-id** — Fullstack Developer & Founder NusaKas
  [https://github.com/daniam-id](https://github.com/daniam-id)
* **NadifFijri28** — Co-Founder NusaKas
  [https://github.com/NadifFijri28](https://github.com/NadifFijri28)
---

# ⭐ Dukung Proyek Ini

Jika kamu merasa terbantu, jangan lupa **beri ⭐ di GitHub!**

---

# Dokumentasi Foto
## Tampilan Web Login
![Alt Text](https://github.com/daniam-id/NusaKas/blob/main/SS/WhatsApp%20Image%202025-12-07%20at%2023.17.17_6e1dc31f.jpg)
![Alt Text](https://github.com/daniam-id/NusaKas/blob/main/SS/WhatsApp%20Image%202025-12-07%20at%2023.23.57_636cbaa1.jpg)
![Alt Text](https://github.com/daniam-id/NusaKas/blob/main/SS/WhatsApp%20Image%202025-12-07%20at%2023.24.29_a66752d4.jpg)
![Alt Text](https://github.com/daniam-id/NusaKas/blob/main/SS/WhatsApp%20Image%202025-12-07%20at%2023.24.48_80fb887e.jpg)

## Respons Bot WA
![Alt Text](https://github.com/daniam-id/NusaKas/blob/main/SS/WhatsApp%20Image%202025-12-07%20at%2023.23.46_7aeffaf8.jpg)
