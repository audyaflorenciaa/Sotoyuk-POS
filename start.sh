#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  F&B POS - KopiKita Cafe"
echo "  Local Installer / Starter"
echo "=========================================="

# Move to script directory
cd "$(dirname "$0")"

# Check Python
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
  echo "ERROR: Python belum terinstall."
  echo "Silakan install Python 3.10+ dari https://python.org/downloads"
  exit 1
fi

PYTHON=python3
if ! command -v python3 &>/dev/null; then
  PYTHON=python
fi

VENV_DIR="./backend/.venv"

echo ""
echo "[1/5] Setup Python virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
  $PYTHON -m venv "$VENV_DIR"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

echo ""
echo "[2/5] Install / update backend dependencies..."
pip install --upgrade pip -q
pip install -q -r backend/requirements.txt

echo ""
echo "[3/5] Build frontend (untuk development, sudah pre-built untuk release)..."
if command -v node &>/dev/null && command -v npm &>/dev/null; then
  cd frontend
  npm install --silent 2>/dev/null || true
  npx vite build 2>/dev/null || true
  cd ..
else
  echo "  Node.js tidak ditemukan. Menggunakan frontend/dist yang sudah ada."
fi

echo ""
echo "[4/5] Check / seed database..."
cd backend
if [ ! -f kasir.db ] || [ ! -s kasir.db ]; then
  echo "  Database kosong, seeding data awal..."
  python seed.py --reset
else
  echo "  Database sudah ada, skip seeding."
fi

echo ""
echo "[5/5] Starting server..."
PORT="${PORT:-8000}"
# Free port if occupied
fuser -k ${PORT}/tcp 2>/dev/null || true
sleep 1

LAN_IPS=$(hostname -I 2>/dev/null | awk '{print $1}')
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null | head -n1)

echo ""
echo "=========================================="
echo "  Server berjalan!"
echo ""
echo "  Buka browser di:"
echo "    http://localhost:${PORT}"
if [ -n "$LAN_IPS" ]; then
  echo ""
  echo "  Akses dari komputer lain (satu LAN):"
  echo "    http://${LAN_IPS}:${PORT}"
fi
if [ -n "$TAILSCALE_IP" ]; then
  echo ""
  echo "  Akses dari cabang via Tailscale:"
  echo "    http://${TAILSCALE_IP}:${PORT}"
fi
echo ""
echo "  Login default:"
echo "    superadmin / superadmin"
echo "    admin_utama / admin"
echo "    kasir_utama / kasir1"
echo "=========================================="
echo ""
echo "Tekan Ctrl+C untuk berhenti."
echo ""

python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
