#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  Build Release Package - F&B POS"
echo "=========================================="

cd "$(dirname "$0")"

RELEASE_DIR="./release"
VERSION=$(date +%Y%m%d)

echo ""
echo "[1/5] Clean old release..."
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR/POS-WarungKopi"

echo ""
echo "[2/5] Build frontend..."
cd frontend
npm install --silent 2>/dev/null || true
npx vite build
cd ..

echo ""
echo "[3/5] Copy project files..."
# Backend
cp -r backend "$RELEASE_DIR/POS-WarungKopi/"
# Frontend dist only (no node_modules, no src)
mkdir -p "$RELEASE_DIR/POS-WarungKopi/frontend"
cp -r frontend/dist "$RELEASE_DIR/POS-WarungKopi/frontend/"
cp frontend/package.json "$RELEASE_DIR/POS-WarungKopi/frontend/" 2>/dev/null || true
# Root files
cp start.sh "$RELEASE_DIR/POS-WarungKopi/"
cp start.bat "$RELEASE_DIR/POS-WarungKopi/"
cp start.ps1 "$RELEASE_DIR/POS-WarungKopi/"
cp README_LOCAL.md "$RELEASE_DIR/POS-WarungKopi/"
cp PANDUAN_DEPLOY.md "$RELEASE_DIR/POS-WarungKopi/" 2>/dev/null || true
cp PANDUAN_TAILSCALE.md "$RELEASE_DIR/POS-WarungKopi/" 2>/dev/null || true

echo ""
echo "[4/5] Clean unnecessary files..."
# Remove venv, pycache, node_modules from backend if any
find "$RELEASE_DIR/POS-WarungKopi" -type d \( -name '.venv' -o -name 'venv' -o -name '__pycache__' -o -name 'node_modules' -o -name '.git' \) -prune -exec rm -rf {} + 2>/dev/null || true
find "$RELEASE_DIR/POS-WarungKopi" -type f -name '*.pyc' -delete 2>/dev/null || true
find "$RELEASE_DIR/POS-WarungKopi" -type f -name '.env' -delete 2>/dev/null || true

echo ""
echo "[5/5] Create archive..."
cd "$RELEASE_DIR"
zip -r "POS-WarungKopi-v${VERSION}.zip" POS-WarungKopi/

echo ""
echo "=========================================="
echo "  Release package created!"
echo ""
echo "  Location: $RELEASE_DIR/POS-WarungKopi-v${VERSION}.zip"
echo "  Size:     $(du -h POS-WarungKopi-v${VERSION}.zip | cut -f1)"
echo ""
echo "  User tinggal extract lalu jalankan:"
echo "    Windows: start.bat"
echo "    Linux:   ./start.sh"
echo "=========================================="
