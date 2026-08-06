# POS-WarungKopi

Sistem Point of Sale (POS) lengkap untuk bisnis F&B (Food & Beverage) dengan dukungan multi-cabang, membership, thermal printer, dan dynamic theming.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.10+-yellow)
![React](https://img.shields.io/badge/react-18+-61dafb)

---

## Fitur Utama

### 🏪 Multi-Branch (Multi-Cabang)
- Satu sistem untuk banyak cabang
- Data terpisah per cabang (produk, stok, order, meja)
- Superadmin bisa akses semua cabang
- Admin hanya bisa akses cabangnya sendiri

### 🍽️ Manajemen Meja Real-Time
- Status meja: Kosong, Terisi, Reservasi, Bersihkan
- Warna-coded: Hijau (kosong), Merah (terisi), Kuning (reservasi), Biru (bersihkan)
- Kasir bisa pilih meja sebelum order
- Auto-update status setelah pembayaran

### 👥 Membership & Poin
- Daftar member dengan kode unik
- Poin reward setiap pembelian
- Redeem poin sebagai diskon
- Riwayat transaksi member

### 🖨️ Thermal Printer Support
- Print via Bluetooth (Web Bluetooth API)
- Print via WebUSB
- Support ESC/POS commands
- Auto-print setelah pembayaran

### 🎨 Dynamic Theming
- Ganti warna sidebar, primary, background via Settings
- Logo toko custom
- Nama toko dynamic di browser tab & receipt

### 📊 Laporan & Dashboard
- Pendapatan harian/mingguan/bulanan
- Produk terlaris
- Stok menipis alert
- Export laporan

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy, SQLite |
| Frontend | React 18, Vite, TailwindCSS |
| Auth | JWT Token |
| Printer | Web Bluetooth API, ESC/POS |
| Database | SQLite (bisa upgrade ke PostgreSQL) |

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm atau yarn

### 1. Clone Repository
```bash
git clone https://github.com/pedip78/POS-WarungKopi.git
cd POS-WarungKopi
```

### 2. Jalankan dengan Script Otomatis

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```cmd
start.bat
```

Script akan otomatis:
- Buat virtual environment Python
- Install dependencies backend & frontend
- Build frontend
- Seed database (kalau kosong)
- Start server di port 8000

### 3. Akses Aplikasi

Buka browser: **http://localhost:8000**

---

## Login Default

| Role | Username | Password | Akses |
|------|----------|----------|-------|
| Superadmin | `superadmin` | `superadmin` | Semua cabang |
| Admin | `admin_utama` | `admin` | Cabang utama |
| Kasir | `kasir_utama` | `kasir1` | Kasir cabang utama |
| Admin Dago | `admin_dago` | `admin` | Cabang Dago |
| Kasir Dago | `kasir_dago` | `kasir1` | Kasir cabang Dago |

> **PENTING:** Ganti password default setelah login pertama kali!

---

## Struktur Project

```
POS-WarungKopi/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── core/         # Auth, dependencies
│   │   ├── models.py     # Database models
│   │   ├── schemas.py    # Pydantic schemas
│   │   └── main.py       # FastAPI app
│   ├── uploads/          # Uploaded files
│   ├── seed.py           # Database seeder
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/        # React pages
│   │   ├── components/   # Reusable components
│   │   ├── utils/        # Helper functions
│   │   └── api.js        # API client
│   └── dist/             # Built files
├── start.sh              # Linux/Mac starter
├── start.bat             # Windows starter
├── start.ps1             # PowerShell starter
├── build-release.sh      # Build release package
├── PANDUAN_DEPLOY.md     # Deploy ke VPS
├── PANDUAN_TAILSCALE.md  # Multi-branch via Tailscale
└── README.md
```

---

## API Documentation

Setelah server jalan, akses dokumentasi API otomatis:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## Deployment

### Deploy ke VPS (DigitalOcean, AWS, etc)

Lihat panduan lengkap: **[PANDUAN_DEPLOY.md](PANDUAN_DEPLOY.md)**

Ringkasan:
```bash
# Di server
git clone https://github.com/pedip78/POS-WarungKopi.git
cd POS-WarungKopi
./start.sh
```

### Deploy Multi-Branch via Tailscale

Untuk menghubungkan banyak cabang tanpa IP public, pakai Tailscale VPN.

Lihat panduan: **[PANDUAN_TAILSCALE.md](PANDUAN_TAILSCALE.md)**

---

## Konfigurasi

### Environment Variables

Buat file `.env` di folder `backend/`:

```env
# Database
DATABASE_URL=sqlite:///./kasir.db

# JWT Secret (ganti dengan random string)
SECRET_KEY=your-super-secret-key-here

# App
APP_NAME=POS-WarungKopi
DEBUG=false

# Upload
UPLOAD_DIR=./uploads
```

### Settings via UI

Login sebagai **superadmin** → **Settings**:
- Nama toko & logo
- Alamat & telepon
- Footer receipt
- Warna tema (sidebar, primary, background)
- PPN (%)

---

## Development

### Backend Development

```bash
cd backend

# Buat virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Jalankan server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Jalankan dev server
npm run dev
```

Frontend dev server jalan di http://localhost:5173 (proxy ke backend 8000).

---

## Build Release Package

Untuk distribusi ke user tanpa perlu install dependencies:

```bash
chmod +x build-release.sh
./build-release.sh
```

Hasil: `release/POS-WarungKopi-vYYYYMMDD.zip`

User tinggal extract dan jalankan `start.sh` atau `start.bat`.

---

## Troubleshooting

### Port 8000 sudah dipakai
```bash
# Cek proses
lsof -i :8000

# Kill proses
kill -9 <PID>
```

### Database corrupt
```bash
# Backup dulu
cp backend/kasir.db backend/kasir.db.backup

# Reset database
rm backend/kasir.db
# Restart server, akan auto-seed
```

### Printer tidak terdeteksi
- Pastikan browser Chrome/Edge
- Pastikan printer support ESC/POS
- Coba pair printer via OS dulu

---

## Contributing

1. Fork repository
2. Buat branch fitur (`git checkout -b fitur-baru`)
3. Commit perubahan (`git commit -m 'Tambah fitur baru'`)
4. Push ke branch (`git push origin fitur-baru`)
5. Buat Pull Request

---

## License

MIT License - bebas digunakan untuk personal maupun komersial.

---

## Support

Kalau ada pertanyaan atau bug, buat issue di GitHub repository ini.

---

**Dibuat dengan ❤️ untuk UMKM Indonesia**
