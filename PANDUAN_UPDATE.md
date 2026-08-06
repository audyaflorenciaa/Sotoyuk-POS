# PANDUAN UPDATE APLIKASI TANPA GANGGU PRODUKSI

## Strategi Update

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. BACKUP   │ ──▶ │  2. UPDATE   │ ──▶ │  3. RESTART  │
│  Database    │     │  Kode + Build│     │  < 10 detik  │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Estimasi downtime: 5-10 detik** (saat restart service saja)

---

## Cara 1: Update Manual (Recommended)

### Langkah-Langkah

```bash
# ============================================
# 1. MASUK KE SERVER
# ============================================
ssh user@IP_SERVER
cd /opt/kasir-pos

# ============================================
# 2. BACKUP DATABASE (WAJIB!)
# ============================================
sudo systemctl stop kasir-pos
cp backend/kasir.db /backup/kasir_$(date +%Y%m%d_%H%M).db
sudo systemctl start kasir-pos
echo "Backup selesai, aplikasi jalan kembali."

# ============================================
# 3. PULL KODE TERBARU
# ============================================
git pull origin main

# ============================================
# 4. UPDATE BACKEND
# ============================================
cd backend
source venv/bin/activate
pip install -r requirements.txt

# ============================================
# 5. REBUILD FRONTEND
# ============================================
cd ../frontend
npm install
npx vite build
cp -r dist/* ../backend/static/

# ============================================
# 6. RESTART APLIKASI (downtime ~5-10 detik)
# ============================================
cd ..
sudo systemctl restart kasir-pos

# ============================================
# 7. VERIFIKASI
# ============================================
sudo systemctl status kasir-pos
curl -s https://kasir.yourdomain.com/api/health
```

**Total waktu: ~2-5 menit, downtime hanya 5-10 detik saat restart.**

---

## Cara 2: Update dengan Maintenance Page

Untuk update besar yang butuh waktu lama:

### 1. Aktifkan Maintenance Mode

```bash
# Buat file maintenance flag
sudo touch /opt/kasir-pos/backend/.maintenance
```

### 2. Konfigurasi Nginx untuk Maintenance Page

```bash
sudo nano /etc/nginx/sites-available/kasir-pos
```

Tambahkan di block server utama:

```nginx
# Maintenance mode
location / {
    if (-f /opt/kasir-pos/backend/.maintenance) {
        return 503;
    }
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Maintenance page
error_page 503 @maintenance;
location @maintenance {
    root /opt/kasir-pos/backend/static;
    rewrite ^(.*)$ /maintenance.html break;
}
```

Buat halaman maintenance:

```bash
cat > /opt/kasir-pos/backend/static/maintenance.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>System Maintenance</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; background: #f8fafc; }
        h1 { color: #f59e0b; } p { color: #64748b; }
    </style>
</head>
<body>
    <h1>🔧 Sedang Maintenance</h1>
    <p>Aplikasi sedang diperbarui. Silakan coba lagi dalam beberapa menit.</p>
</body>
</html>
EOF
```

```bash
# Reload nginx
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Jalankan Update (Tanpa Terburu-buru)

```bash
# Backup
sudo systemctl stop kasir-pos
cp backend/kasir.db /backup/kasir_$(date +%Y%m%d_%H%M).db

# Update kode
git pull origin main
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install && npx vite build && cp -r dist/* ../backend/static/

# Restart
cd ..
sudo systemctl start kasir-pos

# Hapus maintenance mode
rm /opt/kasir-pos/backend/.maintenance
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Verifikasi

```bash
curl -s https://kasir.yourdomain.com/api/health
```

---

## Cara 3: Script Update Otomatis

Buat script `/opt/kasir-pos/update.sh`:

```bash
#!/bin/bash
set -e

echo "=========================================="
echo "  Update F&B POS"
echo "=========================================="

BACKUP_DIR="/backup"
APP_DIR="/opt/kasir-pos"
DATE=$(date +%Y%m%d_%H%M)

# 1. Backup
echo "[1/5] Backup database..."
sudo systemctl stop kasir-pos
mkdir -p $BACKUP_DIR
cp $APP_DIR/backend/kasir.db $BACKUP_DIR/kasir_$DATE.db
sudo systemctl start kasir-pos
echo "  Database backed up ke $BACKUP_DIR/kasir_$DATE.db"

# 2. Pull kode
echo "[2/5] Pull kode terbaru..."
cd $APP_DIR
git pull origin main

# 3. Update backend
echo "[3/5] Update backend..."
cd backend
source venv/bin/activate
pip install -q -r requirements.txt

# 4. Rebuild frontend
echo "[4/5] Rebuild frontend..."
cd ../frontend
npm install --silent 2>/dev/null
npx vite build
cp -r dist/* ../backend/static/

# 5. Restart
echo "[5/5] Restart aplikasi..."
cd ..
sudo systemctl restart kasir-pos

echo ""
echo "=========================================="
echo "  Update selesai!"
echo "  Backup: $BACKUP_DIR/kasir_$DATE.db"
echo "  Status: $(sudo systemctl is-active kasir-pos)"
echo "=========================================="
```

Jalankan update:

```bash
chmod +x /opt/kasir-pos/update.sh
/opt/kasir-pos/update.sh
```

---

## Rollback (Jika Update Gagal)

```bash
# 1. Stop aplikasi
sudo systemctl stop kasir-pos

# 2. Restore database dari backup
cp /backup/kasir_20260804_1200.db /opt/kasir-pos/backend/kasir.db

# 3. Kembalikan kode ke versi sebelumnya
cd /opt/kasir-pos
git log --oneline -5           # Lihat versi sebelumnya
git checkout COMMIT_HASH       # Kembalikan ke versi tertentu

# 4. Rebuild
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install && npx vite build && cp -r dist/* ../backend/static/

# 5. Restart
cd ..
sudo systemctl restart kasir-pos

echo "Rollback selesai!"
```

---

## Tips Update Aman

### Sebelum Update

| No | Checklist | Keterangan |
|----|-----------|------------|
| 1 | Backup database | `cp kasir.db /backup/` |
| 2 | Cek changelog | `git log --oneline -10` |
| 3 | Test di local | Jalankan di komputer lokal dulu |
| 4 | Pilih waktu sepi | Hindari jam ramai transaksi |

### Saat Update

| No | Tips | Keterangan |
|----|------|------------|
| 1 | Backup dulu | Selalu backup sebelum update |
| 2 | Stop service | Hentikan aplikasi saat update |
| 3 | Cek log | Pastikan tidak ada error setelah restart |

### Setelah Update

| No | Checklist | Keterangan |
|----|-----------|------------|
| 1 | Test login | Pastikan bisa login |
| 2 | Test transaksi | Coba buat order baru |
| 3 | Cek semua menu | Pastikan semua halaman jalan |
| 4 | Cek backup | Pastikan backup tersimpan |

---

## Jadwal Update Disarankan

| Jenis Update | Frekuensi | Waktu |
|--------------|-----------|-------|
| Security patch | Saat ada | Segera |
| Bug fix | Saat ada | Jam sepi (10-14) |
| Fitur baru | 1-2 minggu sekali | Akhir pekan |
| Major update | 1 bulan sekali | Malam hari |

---

## Monitoring Setelah Update

```bash
# Cek log error
sudo journalctl -u kasir-pos -p err -n 20

# Cek status service
sudo systemctl status kasir-pos

# Cek response time
curl -o /dev/null -s -w "Response: %{time_total}s\n" https://kasir.yourdomain.com/api/health

# Cek database size
ls -lh /opt/kasir-pos/backend/kasir.db
```

---

*Terakhir diperbarui: Agustus 2026*
