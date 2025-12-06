# PRD 4 – Reminder, Verifikasi Link OTP, Gaya Bahasa Bot & Pengaturan via WA

## 1. Tujuan Fitur
Menambah lapisan “asisten pribadi” pada NusaKas:
1. Pengingat catatan keuangan harian yang fleksibel (jam + hari operasional).
2. Verifikasi akun via link OTP dari website ke bot WhatsApp.
3. Personalisasi gaya bahasa dan emoji bot.
4. Semua pengaturan utama (jam pengingat & hari operasional) bisa diubah lewat **Web dan WhatsApp**.

***

## 2. Perubahan Database

### 2.1 Tabel `users` (Extend)

```sql
alter table public.users 
  add column if not exists reminder_time time default '21:00:00', -- jam pengingat harian
  add column if not exists operational_days jsonb default '["monday","tuesday","wednesday","thursday","friday","saturday"]',
  add column if not exists bot_style text default 'santai', -- 'formal' | 'santai' | 'semi-formal'
  add column if not exists use_emoji boolean default true,
  add column if not exists onboarding_complete boolean default false;
```

### 2.2 Tabel `pending_registrations` (Verifikasi Link OTP Web → WA)

```sql
create table if not exists public.pending_registrations (
  wa_number text primary key,           -- 628xxx
  otp_code text not null,              -- kode pendek, misal 4–6 digit
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '10 minutes')
);
```

***

## 3. Fitur 1 – Pengingat Harian & Hari Operasional

### 3.1 Konsep

- User memilih:
  - **Jam pengingat** (per user, default 21:00).
  - **Hari operasional** (default Senin–Sabtu).
- Di jam + hari yang cocok, bot kirim pesan pengingat via WA agar user mengirim catatan keuangan hari itu.

### 3.2 Scheduler di Backend

Gunakan `node-cron` (atau scheduler lain) di backend Express:

- Cron job jalan **setiap menit**:
  1. Ambil waktu dan hari saat ini:
     - `current_time` (format `HH:mm`).
     - `current_day` (string `'monday' | 'tuesday' | ...`).
  2. Query pengguna yang perlu diingatkan:
     ```sql
     select id, wa_number, bot_style, use_emoji 
     from users
     where to_char(reminder_time, 'HH24:MI') = to_char(now(), 'HH24:MI')
       and operational_days ? lower(to_char(now(), 'day'));
     ```
  3. Untuk setiap user yang lolos, kirim pesan WA lewat instance Baileys.

### 3.3 Format Pesan Reminder (Tergantung Gaya Bahasa)

Contoh:

- `bot_style = 'santai', use_emoji = true`  
  "Bos, udah catat pemasukan/pengeluaran hari ini belum? Jangan sampe lupa ya 💸"
- `bot_style = 'formal'`  
  "Bapak/Ibu, apakah transaksi hari ini sudah dicatat? Mohon lakukan pencatatan sebelum toko tutup."

***

## 4. Fitur 2 – Verifikasi via Link OTP (Web → WhatsApp → Bot)

### 4.1 Alur di Website

1. **Endpoint:** `POST /api/register/start`
   - Body: `{ "wa_number": "08xxxx" }`
   - Backend:
     - Normalisasi ke `628xxxx`.
     - Generate `otp_code` (4–6 digit).
     - Simpan ke `pending_registrations`.
     - Kembalikan JSON:
       ```json
       {
         "wa_link": "https://wa.me/6281234567890?text=VERIFY%207788"
       }
       ```

2. Frontend:
   - Tampilkan tombol "Verifikasi via WhatsApp" yang membuka `wa_link`.

3. User klik link → WA terbuka dengan teks otomatis `VERIFY 7788`, user tinggal kirim.

### 4.2 Alur di Bot WA

Pada handler pesan:

1. Jika menerima pesan dengan pola `VERIFY <OTP>`:
   - Ambil nomor pengirim (`wa_number`) & `otp`.
   - Cek `pending_registrations`:
     - Jika tidak ada/expired → balas gagal.
     - Jika valid:
       - Jika user belum ada di `users`, buat record baru.
       - Hapus entri dari `pending_registrations`.
       - Balas: verifikasi sukses + ajak user lanjut onboarding gaya bahasa.
2. Setelah verifikasi, `onboarding_complete` masih `false` sampai user jawab preferensi gaya bahasa (lihat Fitur 3).

***

## 5. Fitur 3 – Kustomisasi Gaya Bahasa Bot

### 5.1 Onboarding via WhatsApp

Begitu user terverifikasi untuk pertama kali:

1. Bot kirim:
   > "Mau NusaKas ngomongnya gimana nih?  
   > 1️⃣ Formal (Bapak/Ibu)  
   > 2️⃣ Santai (Bos)  
   > 3️⃣ Semi-formal (Mas/Mbak)  
   > Tulis angka 1, 2, atau 3."

2. Setelah user pilih:
   - Simpan ke `users.bot_style`.

3. Bot tanya lanjutan:
   > "Pakai emoji nggak? (Ya/Tidak)"

4. Jawaban:
   - `Ya` → `use_emoji = true`
   - `Tidak` → `use_emoji = false`

5. Set `onboarding_complete = true`.

Jika user skip/gak jawab jelas, fallback ke: `bot_style='santai'`, `use_emoji=true`.

### 5.2 Template Balasan Dinamis

Buat helper `formatReply(user, intent, payload)`:

- **Intent Example: `TRANSACTION_RECORDED`**
  - `formal`:  
    "Transaksi sebesar Rp {amount} telah berhasil dicatat dalam sistem."
  - `santai`:  
    "Sip bos, Rp {amount} udah gue catet ya! {emoji}"
  - `semi-formal`:  
    "Baik, transaksi Rp {amount} sudah tercatat, Mas/Mbak."

`emoji` diisi jika `user.use_emoji === true`.

Helper ini dipakai di:
- Konfirmasi transaksi baru.
- Konfirmasi edit/hapus.
- Reminder harian.

***

## 6. Fitur 4 – Pengaturan Reminder & Hari Operasional via WhatsApp

Selain lewat Web, user bisa mengatur jadwal langsung dari chat WA.

### 6.1 Set Reminder Time via WA

**Contoh kalimat yang harus didukung:**
- "Set pengingat jam 9 malam"
- "Ganti jam pengingat ke 21:30"
- "Ingetin tiap jam 8 malam ya"

**Langkah:**
1. Bot deteksi intent `SET_REMINDER_TIME`.
2. Ekstrak jam dari teks:
   - Support format: `21:00`, `21.00`, `9`, `9 malam`, `08.30`.
3. Konversi ke `HH:mm:ss`.
4. Update `users.reminder_time`.
5. Balas konfirmasi dengan style user.

### 6.2 Set Hari Operasional via WA

**Contoh kalimat yang harus didukung:**
- "Tokoku buka tiap hari"
- "Hari operasional: Senin sampai Sabtu"
- "Tokoku libur hari Minggu"
- "Saya buka Senin Rabu Jumat aja"

**Langkah:**
1. Bot deteksi intent `SET_OPERATIONAL_DAYS`.
2. Mapping teks hari Indonesia ke key English:
   - senin → `"monday"`, selasa → `"tuesday"`, dst.
3. Bentuk array JSON lalu simpan ke `users.operational_days`.
4. Balas ringkasan:
   - "Oke bos, pengingat cuma dikirim saat: Senin, Rabu, Jumat."
   - Versi formal jika `bot_style='formal'`.

***

## 7. Endpoint Tambahan (untuk Web Settings)

Frontend Web juga bisa mengubah pengaturan yang sama.

### 7.1 `GET /api/settings`
- Return:
  ```json
  {
    "reminder_time": "21:00:00",
    "operational_days": ["monday","tuesday","wednesday","thursday","friday","saturday"],
    "bot_style": "santai",
    "use_emoji": true
  }
  ```

### 7.2 `PUT /api/settings`
- Body (subset boleh):
  ```json
  {
    "reminder_time": "20:30:00",
    "operational_days": ["monday","tuesday","wednesday","thursday","friday"],
    "bot_style": "formal",
    "use_emoji": false
  }
  ```
- Backend update table `users` sesuai JWT `user_id`.