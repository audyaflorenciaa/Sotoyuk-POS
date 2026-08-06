# Panduan Instalasi Lokal F&B POS

Aplikasi ini bisa dijalankan langsung di komputer lokal (Windows / Linux / Mac) tanpa Docker.

## Cara Termudah

### 1. Download / Siapkan Folder Aplikasi

Pastikan folder berisi:
```
Kasir Full/
├── backend/
│   ├── app/
│   ├── seed.py
│   ├── requirements.txt
│   └── ...
├── frontend/
│   └── dist/          <-- sudah di-build (untuk rilis)
├── start.bat          <-- Windows
├── start.ps1          <-- Windows (PowerShell)
├── start.sh           <-- Linux / Mac
└── README_LOCAL.md    <-- file ini
```

### 2. Install Python

- **Windows**: Download dari [https://python.org/downloads](https://python.org/downloads)
  - Pilih **Python 3.10+**
  - Centang **"Add Python to PATH"** saat install
- **Linux**: biasanya sudah ada, jika belum:
  ```bash
  sudo apt update
  sudo apt install python3 python3-venv python3-pip
  ```
- **Mac**:
  ```bash
  brew install python3
  ```

### 3. Jalankan Aplikasi

#### Windows (Recommended)

1. Klik kanan file `start.bat` → **Run as administrator**
2. Atau buka PowerShell, masuk ke folder, lalu jalankan:
   ```powershell
   .\start.ps1
   ```
   Jika error execution policy, jalankan dulu:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

#### Linux / Mac

1. Buka Terminal
2. Masuk ke folder aplikasi:
   ```bash
   cd "Kasir Full"
   ```
3. Jalankan:
   ```bash
   ./start.sh
   ```
   Jika permission denied:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

### 4. Buka Aplikasi

Setelah muncul tulisan **"Server berjalan!"**, buka browser:
```
http://localhost:8000
```

### 5. Login Default

| Username | Password | Role |
|----------|----------|------|
| superadmin | superadmin | Superadmin |
| admin_utama | admin | Admin Cabang 1 |
| kasir_utama | kasir1 | Kasir Cabang 1 |
| admin_dago | admin | Admin Cabang 2 |
| kasir_dago | kasir1 | Kasir Cabang 2 |

## Fitur

- Server berjalan di port **8000** (bisa diubah via environment variable `PORT`)
- Database SQLite tersimpan di `backend/kasir.db`
- File upload (gambar produk/logo) tersimpan di `backend/uploads/`
- Frontend di-serve langsung dari backend (tidak perlu Nginx untuk lokal)

## Port Berubah

Jika port 8000 sudah terpakai, jalankan dengan port lain:

**Windows (PowerShell):**
```powershell
$env:PORT=8080; .\start.ps1
```

**Linux / Mac:**
```bash
PORT=8080 ./start.sh
```

Lalu buka:
```
http://localhost:8080
```

## Update Aplikasi

Jika ada versi baru:

1. Ganti file backend & frontend
2. Jalankan ulang `start.bat` / `start.sh`
3. Script akan otomatis install dependency baru dan rebuild jika perlu

## Troubleshooting

### Windows: "python is not recognized"

- Install ulang Python
- Pastikan centang **"Add Python to PATH"**
- Restart Command Prompt / PowerShell

### Windows: "execution of scripts is disabled"

Jalankan di PowerShell sebagai Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Database Rusak / Ingin Reset

Hapus file `backend/kasir.db`, lalu jalankan ulang script. Database akan di-seed ulang.

### Port Sudah Terpakai

Script sudah otomatis menutup proses di port 8000. Jika masih bermasalah, ganti port:
```bash
PORT=8080 ./start.sh
```

## Arsitektur Lokal

```
User Browser
    |
    | http://localhost:8000
    v
FastAPI (Python)  <-- API + Frontend
    |
    v
SQLite (backend/kasir.db)
    |
    v
Uploads (backend/uploads/)
```

## Catatan

- Untuk produksi server (cloud/VPS), gunakan panduan `PANDUAN_DEPLOY.md`
- Untuk development (edit kode), jalankan backend & frontend terpisah
