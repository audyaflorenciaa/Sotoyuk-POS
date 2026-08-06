# PANDUAN DEPLOY F&B POS KE SERVER PRODUKSI

## Daftar Isi

1. [Persiapan Server](#1-persiapan-server)
2. [Setup Backend](#2-setup-backend)
3. [Build Frontend](#3-build-frontend)
4. [Konfigurasi Aplikasi](#4-konfigurasi-aplikasi)
5. [Setup Systemd Service](#5-setup-systemd-service)
6. [Setup Nginx](#6-setup-nginx)
7. [Setup SSL (HTTPS)](#7-setup-ssl-https)
8. [Firewall](#8-firewall)
9. [Setup Awal Aplikasi](#9-setup-awal-aplikasi)
10. [Backup & Restore](#10-backup--restore)
11. [Perintah Penting](#11-perintah-penting)
12. [Troubleshooting](#12-troubleshooting)
13. [Checklist Go Live](#13-checklist-go-live)

---

## 1. Persiapan Server

### Kebutuhan Minimum

| Item | Minimum | Rekomendasi |
|------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 1 GB | 2 GB |
| Storage | 10 GB | 20 GB |
| CPU | 1 vCPU | 2 vCPU |

### Install Dependencies

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Python, Node.js, Nginx
sudo apt install -y python3 python3-pip python3-venv nodejs npm nginx

# Verifikasi
python3 --version    # minimal 3.10
node --version       # minimal 18
npm --version
nginx -v
```

---

## 2. Setup Backend

### Copy Project ke Server

```bash
# Dari komputer lokal
scp -r "/home/edi/Kasir Full/" user@IP_SERVER:/opt/kasir-pos

# Atau pakai git
cd /opt
git clone REPO_URL kasir-pos
```

### Setup Virtual Environment

```bash
cd /opt/kasir-pos/backend

# Buat virtual environment
python3 -m venv venv

# Aktifkan
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Build Frontend

```bash
cd /opt/kasir-pos/frontend

# Install dependencies
npm install

# Build untuk produksi
npx vite build

# Copy hasil build ke backend (agar bisa di-serve satu server)
cp -r dist/* ../backend/static/
```

---

## 4. Konfigurasi Aplikasi

### Buat File .env

```bash
cd /opt/kasir-pos/backend
nano .env
```

Isi file `.env`:

```env
# ============================================
# KONFIGURASI PRODUKSI F&B POS
# ============================================

# Nama Aplikasi
APP_NAME=KopiKita POS

# Environment
APP_ENV=production
DEBUG=false

# Secret Key (GANTI DENGAN YANG UNIK!)
# Generator: python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=hasil-random-generator-di-bawah-ini

# JWT
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Database
DATABASE_URL=sqlite:///./kasir.db

# API Prefix
API_PREFIX=/api

# CORS (domain frontend yang diizinkan)
CORS_ORIGINS=https://kasir.yourdomain.com,http://localhost:3000
```

### Generate SECRET_KEY

```bash
# Jalankan sekali untuk mendapatkan secret key
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy hasilnya dan tempel ke `SECRET_KEY` di file `.env`.

---

## 5. Setup Systemd Service

### Buat Service File

```bash
sudo nano /etc/systemd/system/kasir-pos.service
```

Isi file:

```ini
[Unit]
Description=F&B POS - KopiKita Cafe
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/kasir-pos/backend
Environment="PATH=/opt/kasir-pos/backend/venv/bin"
ExecStart=/opt/kasir-pos/backend/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Aktifkan Service

```bash
# Reload daemon
sudo systemctl daemon-reload

# Aktifkan saat boot
sudo systemctl enable kasir-pos

# Start service
sudo systemctl start kasir-pos

# Cek status
sudo systemctl status kasir-pos
```

---

## 6. Setup Nginx

### Buat Konfigurasi

```bash
sudo nano /etc/nginx/sites-available/kasir-pos
```

Isi file:

```nginx
# HTTP → redirect ke HTTPS
server {
    listen 80;
    server_name kasir.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name kasir.yourdomain.com;

    # SSL (akan diisi otomatis oleh Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/kasir.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kasir.yourdomain.com/privkey.pem;

    # Limit upload (gambar produk/logo)
    client_max_body_size 10M;

    # Static files (uploads)
    location /uploads/ {
        alias /opt/kasir-pos/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API + Frontend
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Aktifkan Site

```bash
# Buat symlink
sudo ln -s /etc/nginx/sites-available/kasir-pos /etc/nginx/sites-enabled/

# Hapus default config (opsional)
sudo rm /etc/nginx/sites-enabled/default

# Test konfigurasi
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## 7. Setup SSL (HTTPS)

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Dapatkan Sertifikat SSL

```bash
# Pastikan domain sudah pointing ke IP server
sudo certbot --nginx -d kasir.yourdomain.com

# Pilih opsi:
# 1. Redirect HTTP ke HTTPS (pilih 2)
```

### Auto-Renew SSL

```bash
# Test auto-renew
sudo certbot renew --dry-run

# Certbot sudah setup cron otomatis, cek:
sudo systemctl status certbot.timer
```

---

## 8. Firewall

```bash
# Buka port HTTP dan HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp    # SSH

# Aktifkan firewall
sudo ufw enable

# Cek status
sudo ufw status
```

---

## 9. Setup Awal Aplikasi

### Seed Database (Pertama Kali)

```bash
cd /opt/kasir-pos/backend
source venv/bin/activate

# Seed data awal
python3 seed.py --reset
```

Data yang di-seed:
- 2 cabang (Utama + Dago)
- 5 user (superadmin, admin, kasir per cabang)
- 5 kategori, 100 produk, 20 meja
- 10 customer, 5 voucher, 3 membership tier
- ~200 order sample

### Login Pertama

Buka browser: `https://kasir.yourdomain.com`

| Username | Password | Role |
|----------|----------|------|
| superadmin | superadmin | Superadmin |
| admin_utama | admin | Admin Cabang 1 |
| kasir_utama | kasir1 | Kasir Cabang 1 |
| admin_dago | admin | Admin Cabang 2 |
| kasir_dago | kasir1 | Kasir Cabang 2 |

### Setup Cabang Baru

1. Login sebagai **superadmin**
2. Buka menu **Cabang**
3. Klik **Tambah Cabang**
4. Isi nama dan alamat
5. Klik **Simpan**

### Buat User untuk Cabang Baru

1. Login sebagai **superadmin**
2. Buka menu **User**
3. Klik **Tambah User**
4. Isi username, nama, password
5. Pilih **Role** (admin/kasir)
6. Pilih **Cabang**
7. Klik **Simpan**

### Input Data

1. **Produk**: Menu Produk → Tambah Produk (SKU, nama, harga, diskon, stok)
2. **Meja**: Menu Meja → Tambah Meja (nomor, kapasitas)
3. **Setting**: Menu Setting → isi nama toko, alamat, pajak, logo

---

## 10. Backup & Restore

### Backup Manual

```bash
# Backup database
cp /opt/kasir-pos/backend/kasir.db /backup/kasir_$(date +%Y%m%d_%H%M).db

# Backup uploads
tar -czf /backup/uploads_$(date +%Y%m%d).tar.gz /opt/kasir-pos/backend/uploads/
```

### Auto Backup (Cron)

```bash
# Edit crontab
crontab -e

# Tambah baris berikut (backup jam 2 setiap hari):
0 2 * * * cp /opt/kasir-pos/backend/kasir.db /backup/kasir_$(date +\%Y\%m\%d).db
0 2 * * * tar -czf /backup/uploads_$(date +\%Y\%m\%d).tar.gz /opt/kasir-pos/backend/uploads/
```

### Restore Database

```bash
# Stop service
sudo systemctl stop kasir-pos

# Restore
cp /backup/kasir_20260804.db /opt/kasir-pos/backend/kasir.db

# Start service
sudo systemctl start kasir-pos
```

---

## 11. Perintah Penting

### Service Management

```bash
# Status
sudo systemctl status kasir-pos

# Start
sudo systemctl start kasir-pos

# Stop
sudo systemctl stop kasir-pos

# Restart
sudo systemctl restart kasir-pos

# Lihat log real-time
sudo journalctl -u kasir-pos -f

# Lihat log 100 baris terakhir
sudo journalctl -u kasir-pos -n 100
```

### Update Aplikasi

```bash
cd /opt/kasir-pos

# Pull kode terbaru
git pull

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Rebuild frontend
cd ../frontend
npm install
npx vite build
cp -r dist/* ../backend/static/

# Restart service
sudo systemctl restart kasir-pos
```

### Cek Database

```bash
cd /opt/kasir-pos/backend
source venv/bin/activate

# Masuk SQLite shell
sqlite3 kasir.db

# Contoh query
.tables                          # Lihat semua tabel
SELECT COUNT(*) FROM products;   # Jumlah produk
SELECT COUNT(*) FROM orders;     # Jumlah order
.quit                            # Keluar
```

---

## 12. Troubleshooting

### Masalah: Aplikasi Tidak Bisa Diakses

```bash
# Cek service status
sudo systemctl status kasir-pos

# Cek log
sudo journalctl -u kasir-pos -n 50

# Cek port
ss -tlnp | grep 8000
```

### Masalah: Error 502 Bad Gateway

```bash
# Pastikan backend jalan
sudo systemctl status kasir-pos

# Restart backend
sudo systemctl restart kasir-pos

# Cek nginx config
sudo nginx -t
```

### Masalah: Upload Gagal

```bash
# Cek permission folder uploads
ls -la /opt/kasir-pos/backend/uploads/

# Fix permission
sudo chown -R www-data:www-data /opt/kasir-pos/backend/uploads/
sudo chmod -R 755 /opt/kasir-pos/backend/uploads/
```

### Masalah: Database Locked

```bash
# Restart aplikasi
sudo systemctl restart kasir-pos

# Cek proses yang akses database
fuser /opt/kasir-pos/backend/kasir.db
```

### Masalah: SSL Expired

```bash
# Renew manual
sudo certbot renew

# Restart nginx
sudo systemctl restart nginx
```

---

## 13. Checklist Go Live

### Sebelum Deploy

- [ ] Ganti `SECRET_KEY` di `.env` dengan value random
- [ ] Ganti `server_name` di Nginx dengan domain asli
- [ ] Pastikan DNS domain sudah pointing ke IP server
- [ ] Seed database: `python3 seed.py --reset`
- [ ] Buat akun admin untuk setiap cabang
- [ ] Input data produk, meja, setting
- [ ] Upload logo toko

### Setelah Deploy

- [ ] Akses `https://domain.com` → login page muncul
- [ ] Login superadmin → dashboard tampil
- [ ] Buka menu Cabang → bisa CRUD
- [ ] Buka menu Produk → bisa tambah/edit
- [ ] Buka menu Setting → bisa simpan
- [ ] Login admin cabang → data terfilter
- [ ] Test POS → bisa transaksi
- [ ] Backup pertama kali berhasil
- [ ] SSL valid (icon gembok di browser)

### Monitoring

- [ ] Service auto-start saat server restart
- [ ] Backup cron jalan
- [ ] SSL auto-renew jalan
- [ ] Log tidak ada error

---

## Architecture

```
┌─────────────────────────────────────────┐
│              USER BROWSER               │
└──────────────────┬──────────────────────┘
                   │ HTTPS (port 443)
┌──────────────────▼──────────────────────┐
│              NGINX                       │
│  - Reverse Proxy                         │
│  - SSL Termination                       │
│  - Static Files (uploads)                │
└──────────────────┬──────────────────────┘
                   │ HTTP (port 8000)
┌──────────────────▼──────────────────────┐
│          UVICORN (FastAPI)               │
│  - API REST                              │
│  - Serve Frontend (SPA)                  │
│  - Auth (JWT)                            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│           SQLite DATABASE                │
│  - kasir.db                              │
│  - Auto-migration saat startup           │
└─────────────────────────────────────────┘
```

---

## Struktur File

```
/opt/kasir-pos/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   ├── core/          # Auth, deps, security
│   │   ├── models.py      # Database models
│   │   ├── schemas.py     # Pydantic schemas
│   │   └── main.py        # FastAPI app
│   ├── uploads/           # Gambar produk & logo
│   ├── static/            # Frontend build output
│   ├── seed.py            # Database seeder
│   ├── kasir.db           # SQLite database
│   ├── requirements.txt   # Python dependencies
│   └── .env               # Konfigurasi produksi
├── frontend/
│   ├── src/               # Source code React
│   ├── dist/              # Build output
│   └── package.json
├── run.sh                 # Startup script
└── PANDUAN_DEPLOY.md      # Dokumen ini
```

---

*Terakhir diperbarui: Agustus 2026*
