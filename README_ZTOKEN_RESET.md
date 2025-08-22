# 🪙 ZToken Daily Reset System

## 📌 Overview
Sistem reset otomatis ZToken harian yang berjalan setiap hari pada pukul **18:00 WIB (Waktu Indonesia Barat)**.

## ⚙️ Logika Reset
1. **Kondisi 1**: ZToken < 25 → Reset menjadi 25
2. **Kondisi 2**: ZToken = 25 → Tidak ada perubahan
3. **Kondisi 3**: ZToken > 25 → Tetap tidak berubah

## 🗄️ Database Schema

### Tables
- **`ztoken_reset_log`**: Menyimpan log reset harian
- **`profiles`**: Tabel pemain dengan kolom `ztoken`

### Functions
- **`reset_daily_ztoken()`**: Fungsi utama untuk reset harian
- **`manual_ztoken_reset()`**: Fungsi untuk reset manual
- **`get_ztoken_reset_status()`**: Mendapatkan status reset
- **`should_run_daily_reset()`**: Mengecek apakah reset perlu dijalankan
- **`get_wib_time()`**: Mendapatkan waktu WIB saat ini

## 🚀 Implementation

### 1. Database Migration
File: `supabase/migrations/20250115120000_daily_ztoken_reset.sql`
- Membuat tabel dan fungsi yang diperlukan
- Mengatur timezone ke Asia/Jakarta (WIB)
- Menambahkan logging untuk tracking

### 2. Frontend Components
File: `src/components/ZTokenResetStatus.tsx`
- Modal untuk melihat status reset
- Tombol manual reset untuk testing
- Real-time status monitoring

### 3. Utility Functions
File: `src/utils/ztokenScheduler.ts`
- Helper functions untuk manajemen reset
- Type definitions
- Time formatting utilities

## 📅 Scheduling Options

### Option 1: Server-Side Cron Job (Recommended)
```bash
# Crontab entry for 18:00 WIB daily
0 18 * * * curl -X POST "https://your-app.com/api/ztoken-reset"
```

### Option 2: Supabase Edge Function
```typescript
// Edge function yang dipanggil oleh cron service
export default async function handler(req: Request) {
  const { data } = await supabase.rpc('reset_daily_ztoken');
  return new Response(JSON.stringify(data));
}
```

### Option 3: External Scheduler Service
- **Vercel Cron**: Untuk aplikasi yang di-deploy di Vercel
- **GitHub Actions**: Menggunakan scheduled workflows
- **AWS EventBridge**: Untuk infrastruktur AWS

## 🔧 Usage

### Automatic Reset
```sql
-- Dipanggil oleh scheduler setiap hari jam 18:00 WIB
SELECT reset_daily_ztoken();
```

### Manual Reset (Testing)
```sql
-- Untuk testing atau reset manual
SELECT manual_ztoken_reset();
```

### Check Status
```sql
-- Melihat status reset saat ini
SELECT get_ztoken_reset_status();
```

### Frontend Usage
```typescript
import { getZTokenResetStatus, performDailyZTokenReset } from '../utils/ztokenScheduler';

// Get current status
const status = await getZTokenResetStatus();

// Perform reset
const result = await performDailyZTokenReset();
```

## 📊 Monitoring

### Reset Logs
```sql
-- Melihat history reset
SELECT * FROM ztoken_reset_log ORDER BY reset_date DESC;
```

### Current Status
- Waktu WIB saat ini
- Waktu reset berikutnya
- Jumlah pemain dengan ZToken < 25
- Status apakah reset diperlukan

## 🛡️ Security
- Fungsi database menggunakan `SECURITY DEFINER`
- RLS (Row Level Security) aktif pada semua tabel
- Logging semua operasi reset
- Validasi timezone dan waktu

## 🧪 Testing

### Manual Testing
1. Buka modal "ZToken Reset Status" di lobby
2. Klik tombol "Manual Reset Sekarang"
3. Periksa log dan status setelah reset

### Database Testing
```sql
-- Test reset function
SELECT manual_ztoken_reset();

-- Check affected users
SELECT COUNT(*) FROM profiles WHERE ztoken < 25;

-- View logs
SELECT * FROM ztoken_reset_log;
```

## 📝 Notes
- Sistem menggunakan timezone `Asia/Jakarta` untuk WIB
- Reset hanya mempengaruhi pemain yang tidak di-ban
- Log reset disimpan untuk audit dan monitoring
- Sistem mencegah reset ganda dalam satu hari
- Frontend menampilkan countdown ke reset berikutnya

## 🔄 Maintenance
- Monitor log reset secara berkala
- Periksa performa fungsi database
- Update scheduler jika ada perubahan infrastruktur
- Backup data sebelum perubahan besar