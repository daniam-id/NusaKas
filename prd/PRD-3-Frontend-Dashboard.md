# PRD 3: Web Dashboard - React Frontend (v4.1)

## 1. Objective
Dashboard React (Vite) Solid Clean Theme dengan Login OTP WA & Filter Tanggal Laporan.

## 2. Page Specs

### A. Login Page (`/login`)
- **Style:** Minimalist Center Card.
- **Input:** Phone Number (Format: 08...).
- **Flow:**
  1. User input nomor -> Klik "Kirim Kode".
  2. Input berubah jadi "Masukkan OTP".
  3. User cek WA -> Masukkan OTP -> Redirect Dashboard.

### B. Dashboard (`/`)
- **Header:** "Halo, [Nama User]".
- **Stats:** 3 Kartu (Masuk, Keluar, Saldo).
- **Table:**
  - Kolom: `ID (#)`, `Tanggal`, `Ket`, `Kategori`, `Nominal`, `Bukti`.
  - Badge Status (Income/Expense).
  - Tombol Delete (Tong sampah) di tiap baris -> Call API Delete.

### C. Report Modal / Section
- **UI:** Date Range Picker (Start - End).
- **Action:** Tombol "Download PDF".
- **Logic:** `window.open('/api/report/download?startDate=...&endDate=...')`.

## 3. UX Details
- **Loading State:** Tampilkan Skeleton saat fetch data.
- **Error State:** Jika token expired (401) -> Auto redirect ke Login.
- **Theme:** Solid White & Gray-50 (No Blurs).
