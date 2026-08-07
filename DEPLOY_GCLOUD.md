# Deploy ke Google Cloud Run (Gratis, Tanpa Kartu Kredit)

## Kelebihan
- **Free tier:** 2 juta request/bulan, 360.000 GB-seconds memori
- **Tidak perlu kartu kredit** (hanya perlu akun Google/Gmail)
- **Server Singapore** — akses cepat dari Indonesia
- **Auto-scale to zero** — tidak ada biaya saat tidak dipakai
- **Docker support** — jalankan aplikasi langsung

## Langkah Deploy

### 1. Install Google Cloud CLI
```bash
# Linux/Mac
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Windows: download dari https://cloud.google.com/sdk/docs/install
```

### 2. Login & Set Project
```bash
gcloud auth login
gcloud config set project pos-warungkopi
```

> Jika belum punya project, buat di: https://console.cloud.google.com/projectcreate

### 3. Deploy dengan Script
```bash
# Dari root repo
bash deploy-gcloud.sh
```

Atau manual:
```bash
# Build & push image
gcloud builds submit --tag gcr.io/POS-WarungKopi/pos-app --dockerfile backend/Dockerfile .

# Deploy ke Cloud Run
gcloud run deploy pos-warungkopi \
    --image gcr.io/POS-WarungKopi/pos-app \
    --region asia-southeast1 \
    --platform managed \
    --allow-unauthenticated \
    --port 8000 \
    --memory 512Mi \
    --min-instances 0 \
    --max-instances 1 \
    --set-env-vars "APP_ENV=production,DEBUG=false,SECRET_KEY=$(openssl rand -hex 32),DATABASE_URL=sqlite:///./kasir.db"
```

### 4. Selesai
- URL: `https://pos-warungkopi-xxxx.run.app`
- Login:
  | Role | Username | Password |
  |------|----------|----------|
  | Superadmin | `superadmin` | `superadmin` |
  | Kasir | `kasir utama` | `kasir1` |

## Catatan

### Database
- Default pakai **SQLite** (built-in, tanpa setup)
- Data **reset saat container restart** (karena auto-scale to zero)
- Untuk **persistent database**, tambahkan Cloud SQL (butu setup tambahan, gratis untuk db-f1-micro)

### Biaya
- **Tidak ada biaya** untuk free tier usage
- Auto-scale to zero = tidak ada biaya saat tidak ada yang akses
- Jika melebihi free tier, baru dikenakan biaya (sangat kecil)

### Limitasi
- Max 180,000 vCPU-seconds/bulan (≈30 menit CPU time)
- Max 360,000 GB-seconds/bulan (≈60 menit dengan 1GB RAM)
- Cukup untuk demo/light usage

## Deploy dengan Cloud SQL (Persistent Database)

```bash
# Buat Cloud SQL instance (gratis db-f1-micro)
gcloud sql instances create pos-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=asia-southeast1 \
    --root-password=kasir

# Buat database
gcloud sql databases create kasir --instance=pos-db

# Connect Cloud SQL ke Cloud Run
gcloud run deploy pos-warungkopi \
    --image gcr.io/POS-WarungKopi/pos-app \
    --add-cloudsql-instances pos-warungkopi:asia-southeast1:pos-db \
    --set-env-vars "DATABASE_URL=postgresql+psycopg://kasir:kasir@/kasir?host=/cloudsql/POS-WarungKopi:asia-southeast1:pos-db" \
    --set-env-vars "CLOUD_SQL_CONNECTION=POS-WarungKopi:asia-southeast1:pos-db"
```
