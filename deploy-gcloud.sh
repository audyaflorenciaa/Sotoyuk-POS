#!/bin/bash
# Deploy POS-WarungKopi ke Google Cloud Run (Gratis)
# Jalankan dari root repo: bash deploy-gcloud.sh

set -e

# ============ KONFIGURASI ============
PROJECT_ID="${GCLOUD_PROJECT:-pos-warungkopi}"
REGION="${GCLOUD_REGION:-asia-southeast1}"
SERVICE_NAME="pos-warungkopi"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "=== Sotoyuk - Deploy to Google Cloud Run ==="
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo ""

# ============ CEK GA INSTALL ============
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI tidak ditemukan."
    echo "Install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# ============ LOGIN ============
echo "1/5  Login ke Google Cloud..."
gcloud auth login --no-launch-browser 2>/dev/null || gcloud auth login

# ============ SET PROJECT ============
echo "2/5  Set project..."
gcloud config set project ${PROJECT_ID}

# ============ ENABLE API ============
echo "3/5  Enable APIs..."
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# ============ BUILD & PUSH ============
echo "4/5  Build & push image..."
gcloud builds submit --tag ${IMAGE_NAME} --dockerfile backend/Dockerfile .

# ============ DEPLOY ============
echo "5/5  Deploy ke Cloud Run..."

# Generate SECRET_KEY
SECRET_KEY=$(openssl rand -hex 32)

gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --port 8000 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 1 \
    --set-env-vars "APP_ENV=production,DEBUG=false,APP_NAME=Sotoyuk,SECRET_KEY=${SECRET_KEY}" \
    --set-env-vars "DATABASE_URL=sqlite:///./kasir.db"

# ============ DONE ============
URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo ""
echo "✅ Deploy berhasil!"
echo "🌐 URL: ${URL}"
echo ""
echo "Login:"
echo "  Superadmin: superadmin / superadmin"
echo "  Kasir      : kasir utama / kasir1"
echo ""
echo "⚠️  Catatan:"
echo "  - Database pakai SQLite (built-in, tanpa PostgreSQL)"
echo "  - Data reset saat container restart"
echo "  - Untuk PostgreSQL, tambahkan Cloud SQL (butu setup tambahan)"
