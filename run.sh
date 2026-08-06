#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  POS-WarungKopi"
echo "=========================================="

cd "$(dirname "$0")"

# Check prerequisites
command -v python3 &>/dev/null || { echo "Error: python3 not found"; exit 1; }
command -v node &>/dev/null || { echo "Error: node not found"; exit 1; }

# Backend deps
echo "[1/4] Installing backend dependencies..."
cd backend
pip install --break-system-packages -q -r requirements.txt

# Seed database (only if empty)
echo "[2/4] Checking database..."
if [ ! -f kasir.db ] || [ ! -s kasir.db ]; then
  echo "  Database kosong, seeding..."
  python3 seed.py --reset
else
  echo "  Database sudah ada, skip seeding."
fi

# Build frontend
echo "[3/4] Building frontend..."
cd ../frontend
npm install --silent 2>/dev/null
npx vite build
cd ..

# Start server
PORT="${PORT:-8000}"
echo "[4/4] Starting server on port ${PORT}..."
cd backend
# Free the port if occupied by a previous run
fuser -k ${PORT}/tcp 2>/dev/null || true
sleep 1
python3 -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} &
SERVER_PID=$!
cd ..

# Get LAN IPs
sleep 2
LAN_IPS=$(hostname -I 2>/dev/null | awk '{print $1}')

echo ""
echo "=========================================="
echo "  Server started!"
echo ""
echo "  Local:"
echo "    http://localhost:${PORT}"
echo "    http://localhost:${PORT}/docs"
echo ""
if [ -n "$LAN_IPS" ]; then
  echo "  Akses dari komputer lain (satu LAN):"
  echo "    http://${LAN_IPS}:${PORT}"
  echo ""
fi
echo "  Login:"
echo "    admin      / admin      (admin)"
echo "    kasir1     / kasir1     (kasir)"
echo "    superadmin / superadmin (superadmin)"
echo "=========================================="

wait $SERVER_PID 2>/dev/null