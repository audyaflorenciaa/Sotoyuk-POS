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
mkdir -p "$RELEASE_DIR/KasirPOS"

echo ""
echo "[2/5] Build frontend..."
cd frontend
npm install --silent 2>/dev/null || true
npx vite build
cd ..

echo ""
echo "[3/5] Copy project files..."
# Backend
cp -r backend "$RELEASE_DIR/KasirPOS/"
# Frontend dist only (no node_modules, no src)
mkdir -p "$RELEASE_DIR/KasirPOS/frontend"
cp -r frontend/dist "$RELEASE_DIR/KasirPOS/frontend/"
cp frontend/package.json "$RELEASE_DIR/KasirPOS/frontend/" 2>/dev/null || true
# Root files
cp start.sh "$RELEASE_DIR/KasirPOS/"
cp start.bat "$RELEASE_DIR/KasirPOS/"
cp start.ps1 "$RELEASE_DIR/KasirPOS/"
cp README_LOCAL.md "$RELEASE_DIR/KasirPOS/"
cp PANDUAN_DEPLOY.md "$RELEASE_DIR/KasirPOS/" 2>/dev/null || true
cp PANDUAN_TAILSCALE.md "$RELEASE_DIR/KasirPOS/" 2>/dev/null || true

echo ""
echo "[4/5] Clean unnecessary files..."
# Remove venv, pycache, node_modules from backend if any
find "$RELEASE_DIR/KasirPOS" -type d \( -name '.venv' -o -name 'venv' -o -name '__pycache__' -o -name 'node_modules' -o -name '.git' \) -prune -exec rm -rf {} + 2>/dev/null || true
find "$RELEASE_DIR/KasirPOS" -type f -name '*.pyc' -delete 2>/dev/null || true
find "$RELEASE_DIR/KasirPOS" -type f -name '.env' -delete 2>/dev/null || true

echo ""
echo "[5/5] Create archive..."
cd "$RELEASE_DIR"
zip -r "KasirPOS-v${VERSION}.zip" KasirPOS/

echo ""
echo "=========================================="
echo "  Release package created!"
echo ""
echo "  Location: $RELEASE_DIR/KasirPOS-v${VERSION}.zip"
echo "  Size:     $(du -h KasirPOS-v${VERSION}.zip | cut -f1)"
echo ""
echo "  User tinggal extract lalu jalankan:"
echo "    Windows: start.bat"
echo "    Linux:   ./start.sh"
echo "=========================================="
