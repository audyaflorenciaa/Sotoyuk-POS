# Deploy ke Koyeb (Gratis, Tanpa Kartu Kredit)

## Prasyarat
- Akun GitHub (repo `pedip78/POS-WarungKopi` sudah terpush)
- Akun Koyeb (daftar di https://app.koyeb.com — bisa pakai GitHub login)

## Langkah Deploy

### 1. Buat PostgreSQL Database di Koyeb
- Klik **Databases** → **Create Database**
- Name: `pos-db`
- Plan: **Free**
- Catat **Database URL** (format: `postgres://xxx:xxx@xxx.koyeb.com:5432/xxx`)

### 2. Buat Service
- Klik **Services** → **Create Service**
- Pilih **Git** → connect repo `pedip78/POS-WarungKopi`
- Setting:
  - **Name:** `pos-warungkopi`
  - **Branch:** `main`
  - **Build Command:**
    ```
    docker build -f backend/Dockerfile -t pos-app .
    ```
    Atau jika pakai **Dockerfile detection:**
  - **Dockerfile:** `./backend/Dockerfile`
  - **Port:** `8000`
  - **Plan:** Free

### 3. Environment Variables
Tambahkan di tab **Environment**:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(paste Database URL dari langkah 1)* |
| `SECRET_KEY` | *(klik generate atau isi random string panjang)* |
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `APP_NAME` | `POS Warung Kopi` |

### 4. Deploy
- Klik **Deploy**
- Tunggu build & deploy (~3-5 menit)
- Akses di: `https://pos-warungkopi-xxx.koyeb.app`

### 5. Login
| Role | Username | Password |
|------|----------|----------|
| Superadmin | `superadmin` | `superadmin` |
| Kasir | `kasir utama` | `kasir1` |

## Catatan
- Koyeb Free Tier: 1 service, 512MB RAM, 1GB disk
- Service bisa sleep setelah idle → boot ulang otomatis
- Jika lambat, mungkin karena server Koyeb di Eropa/US
