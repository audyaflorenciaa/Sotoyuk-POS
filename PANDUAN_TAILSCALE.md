# Panduan Deploy Multi-Cabang via Tailscale

Panduan ini untuk setup F&B POS multi-cabang dengan **1 server lokal** di pusat/kantor utama, dan cabang-cabang lain mengakses via **Tailscale VPN**.

## Konsep

```
┌─────────────────┐      Tailscale Network      ┌─────────────────┐
│   Server Lokal  │  ════════════════════════►  │   Cabang A      │
│   (HQ / Pusat)  │      http://100.x.x.x:8000  │   PC / Tablet   │
│                 │                             │                 │
│  ┌───────────┐  │                             │  ┌───────────┐  │
│  │ FastAPI   │  │                             │  │ Browser   │  │
│  │ + SQLite  │  │                             │  │           │  │
│  └───────────┘  │                             │  └───────────┘  │
└─────────────────┘                             └─────────────────┘
         │
         │                               ┌─────────────────┐
         │                               │   Cabang B      │
         └──────────────────────────────►│   PC / Tablet   │
                                         └─────────────────┘
```

Semua cabang **memakai 1 database** di server pusat. Tidak perlu cloud/VPS.

---

## 1. Install Tailscale

### Server Pusat (Windows/Linux/Mac)

Download dan install: [https://tailscale.com/download](https://tailscale.com/download)

Login dengan akun yang sama untuk semua device.

```bash
# Linux
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Windows: install .exe, lalu login via browser
```

### Perangkat Cabang

Install Tailscale di setiap PC/tablet cabang, login ke **tailnet yang sama**.

---

## 2. Jalankan Server di Pusat

### Windows

1. Extract `KasirPOS-vXXXX.zip`
2. Klik kanan `start.bat` → **Run as administrator**
3. Tunggu sampai muncul "Server berjalan!"

### Linux/Mac

```bash
cd KasirPOS
./start.sh
```

Pastikan script bind ke `0.0.0.0` (sudah default) supaya bisa diakses dari Tailscale interface.

---

## 3. Dapatkan Tailscale IP Server

### Windows (PowerShell)

```powershell
tailscale ip -4
```

Contoh output:
```
100.64.123.45
```

### Linux/Mac

```bash
tailscale ip -4
```

Catat IP ini. Ini adalah alamat server yang diakses cabang.

---

## 4. Akses dari Cabang

Buka browser di PC/tablet cabang, masukkan:

```
http://100.64.123.45:8000
```

Ganti `100.64.123.45` dengan Tailscale IP server.

---

## 5. Setup Cabang di Aplikasi

1. Login sebagai **superadmin**
2. Buka menu **Cabang** → **Tambah Cabang**
3. Buat user admin/kasir untuk cabang tersebut
4. Pilih cabang saat login

---

## 6. Keamanan

### Tailscale ACL

Tailscale default memakai **default ACL** yang mengizinkan semua device di tailnet saling akses. Untuk POS, ini bisa diterima.

Untuk lebih amat, bisa batasi akses cabang hanya ke port 8000 server:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["group:cabang"],
      "dst": ["100.64.123.45:8000"]
    }
  ]
}
```

### Autentikasi Aplikasi

Walaupun via Tailscale, aplikasi tetap punya login JWT. Pastikan password superadmin kuat.

---

## 7. Catatan Penting

### Server Harus Selalu Online

Karena semua cabang terhubung ke server pusat, server harus selalu menyala:
- Pakai PC/laptop dedicated
- Atau mini PC (Intel NUC, Raspberry Pi 4/5, Beelink)
- Setting auto-login dan auto-run script

### Backup Otomatis

Di server pusat, tambahkan cron backup:

```bash
# Backup setiap hari jam 2 pagi
0 2 * * * cp /path/to/KasirPOS/backend/kasir.db /backup/kasir_$(date +\%Y\%m\%d).db
0 2 * * * tar -czf /backup/uploads_$(date +\%Y\%m\%d).tar.gz /path/to/KasirPOS/backend/uploads/
```

### Koneksi Internet Cabang

Cabang butuh internet untuk Tailscale. Kalau internet putus, POS tidak bisa dipakai di cabang.

Solusi alternatif kalau internet sering putus:
- Setup server lokal di tiap cabang (database terpisah)
- Sinkronisasi data via API periodik
- Ini lebih kompleks, pertimbangkan cloud VPS kalau koneksi tidak stabil

### Port

Default port **8000**. Kalau port 8000 terpakai, ganti saat menjalankan script:

**Windows PowerShell:**
```powershell
$env:PORT=8080; .\start.ps1
```

**Linux/Mac:**
```bash
PORT=8080 ./start.sh
```

Cabang akses:
```
http://100.64.123.45:8080
```

---

## 8. Setup Auto-Start (Windows)

Agar server jalan otomatis saat Windows restart:

1. Buat shortcut `start.bat`
2. Tekan `Win + R` → ketik `shell:startup`
3. Copy shortcut ke folder Startup
4. Atau gunakan Task Scheduler dengan "Run whether user is logged on or not"

---

## 9. Setup Auto-Start (Linux)

Buat systemd service:

```bash
sudo nano /etc/systemd/system/kasir-pos.service
```

Isi:
```ini
[Unit]
Description=F&B POS Local Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/KasirPOS/backend
ExecStart=/home/ubuntu/KasirPOS/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Aktifkan:
```bash
sudo systemctl daemon-reload
sudo systemctl enable kasir-pos
sudo systemctl start kasir-pos
```

---

## 10. Troubleshooting

### Cabang tidak bisa akses

1. Cek Tailscale status di server:
   ```bash
   tailscale status
   ```
2. Cek server jalan:
   ```bash
   curl http://localhost:8000
   ```
3. Cek firewall Windows/Linux blok port 8000
4. Pastikan server bind `0.0.0.0`, bukan `127.0.0.1`

### Tailscale IP berubah

Tailscale IP biasanya tetap untuk setiap device. Kalau berubah, bisa set static IP via Tailscale admin console.

### Performa lambat

- Koneksi upload di server pusat harus cukup
- Untuk 3-5 cabang, koneksi 10 Mbps upload cukup
- Banyak gambar produk besar bisa lambat, kompres gambar produk

---

*Dengan Tailscale, POS multi-cabang bisa jalan di server lokal tanpa perlu VPS/cloud.*
