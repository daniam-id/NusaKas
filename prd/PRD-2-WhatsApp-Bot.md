# PRD 2: WhatsApp Bot Interface (Baileys) (v4.1)

## 1. Objective
Bot WA berjalan di dalam process Express yang sama, sehingga bisa dipanggil oleh API Endpoint (untuk kirim OTP).

## 2. Implementation Strategy (Shared State)
- File `wa.js` harus meng-export variable `sock` (socket connection).
- Pada saat `index.js` start, jalankan `connectToWhatsApp()`.
- Simpan object socket ke global variable atau singleton pattern agar bisa diakses oleh `authController.js`.

## 3. Bot Logic Flow

### A. Auto-Register (On Message Upsert)
- Cek apakah pengirim ada di table `users`.
- Jika tidak: Insert ke `users` -> Reply Welcome Message.

### B. Transaction Handler
- **Input Gambar:** Download -> Upload Supabase -> AI Vision -> Insert DB (`daily_id` = max + 1).
- **Input Teks:** AI NLP -> Insert DB.
- **Output:** "✅ Masuk Bos! (#3) - Rp 50.000"

### C. Command Handler (NLP)
- **Format:** "Hapus #3", "Batal yang #3", "Edit #3 jadi 20rb".
- **Logic:**
  1. Regex match `#` + digit.
  2. Cari transaksi milik user ini dengan `daily_id` tersebut di tanggal hari ini.
  3. Lakukan Update/Delete.
  4. Reply Konfirmasi.

### D. Report Handler
- **Input:** "Laporan", "Rekap", "Cek Saldo".
- **Logic:** Hitung Income/Expense hari ini -> Reply Chat Text.
- **Input:** "Download PDF".
- **Logic:** Generate PDF (pake logic backend yg sama) -> Kirim Document Message.
