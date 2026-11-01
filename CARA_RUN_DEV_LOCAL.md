# Cara Menjalankan POS-WarungKopi (Mode Development Lokal)

Setup ini menjalankan **backend** dan **frontend** terpisah supaya bisa edit kode
dengan hot-reload. Backend = FastAPI (Python), Frontend = React + Vite.

## Prasyarat (sudah terpasang di mesin ini)
- Python 3.12 (dipakai lewat `py -3.12`)
- Node.js v24 + npm

## Struktur Port
- Backend  : http://localhost:8001  (API di `/api`)
- Frontend : http://localhost:5173  (dev server, proxy `/api` -> 8001)

> Catatan: `frontend/vite.config.js` mem-proxy `/api` ke port **8001**,
> jadi backend harus dijalankan di port 8001 saat mode development.

---

## 1. Menjalankan Backend

Dari folder `backend/`:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

- `--reload` = auto-restart saat kode backend diubah.
- Database SQLite ada di `backend/kasir.db` (sudah di-seed).

### (Jika perlu) buat ulang virtual environment
```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### (Jika perlu) reset + seed ulang database
```powershell
cd backend
.\.venv\Scripts\python.exe seed.py --reset
```

---

## 2. Menjalankan Frontend

Buka terminal baru. Dari folder `frontend/`:

```powershell
cd frontend
npm install        # cukup sekali, atau saat dependency berubah
npm run dev
```

Lalu buka browser: **http://localhost:5173**

---

## 3. Login Default

| Username      | Password   | Role              |
|---------------|------------|-------------------|
| superadmin    | superadmin | Superadmin        |
| admin_utama   | admin      | Admin Cabang 1    |
| kasir_utama   | kasir1     | Kasir Cabang 1    |
| admin_dago    | admin      | Admin Cabang 2    |
| kasir_dago    | kasir1     | Kasir Cabang 2    |

---

## Alternatif: Mode "All-in-One" (1 server, port 8000)

Script `start.ps1` build frontend lalu serve-nya langsung dari backend di port 8000.
Cocok untuk demo/produksi lokal, tapi tidak hot-reload. Perlu izin execution policy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\start.ps1
```

Lalu buka http://localhost:8000

---

## Troubleshooting

- **Port 8001/5173 terpakai**: tutup proses lama, atau ubah port backend dan
  sesuaikan `target` proxy di `frontend/vite.config.js`.
- **`python` menunjuk versi lama (3.8)**: project butuh Python 3.10+.
  Gunakan `py -3.12` atau langsung `.\.venv\Scripts\python.exe`.
- **DB error / data aneh**: jalankan ulang `seed.py --reset`.
