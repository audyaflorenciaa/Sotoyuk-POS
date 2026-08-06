# F&B POS - KopiKita Cafe
# Local Installer / Starter (PowerShell)

Write-Host "=========================================="
Write-Host "  F&B POS - KopiKita Cafe"
Write-Host "  Local Installer / Starter"
Write-Host "=========================================="

# Move to script directory
Set-Location $PSScriptRoot

# Check Python
try {
    $python = Get-Command python | Select-Object -ExpandProperty Source
} catch {
    Write-Host "ERROR: Python belum terinstall." -ForegroundColor Red
    Write-Host "Silakan install Python 3.10+ dari https://python.org/downloads"
    Write-Host "Pastikan centang 'Add Python to PATH' saat install."
    Read-Host "Tekan Enter untuk keluar"
    exit 1
}

$venvDir = Join-Path $PWD "backend\.venv"

Write-Host ""
Write-Host "[1/5] Setup Python virtual environment..."
if (-not (Test-Path $venvDir)) {
    & $python -m venv "$venvDir"
}

# Activate venv
$activate = Join-Path $venvDir "Scripts\Activate.ps1"
& "$activate"

Write-Host ""
Write-Host "[2/5] Install / update backend dependencies..."
python -m pip install --upgrade pip -q
pip install -q -r "backend\requirements.txt"

Write-Host ""
Write-Host "[3/5] Build frontend..."
try {
    $node = Get-Command node -ErrorAction Stop
    Set-Location "frontend"
    npm install --silent 2>$null
    npx vite build 2>$null
    Set-Location ..
} catch {
    Write-Host "  Node.js tidak ditemukan. Menggunakan frontend\dist yang sudah ada."
}

Write-Host ""
Write-Host "[4/5] Check / seed database..."
Set-Location "backend"
$dbPath = Join-Path $PWD "kasir.db"
if (-not (Test-Path $dbPath)) {
    Write-Host "  Database kosong, seeding data awal..."
    python seed.py --reset
} else {
    Write-Host "  Database sudah ada, skip seeding."
}

Write-Host ""
Write-Host "[5/5] Starting server..."
$PORT = if ($env:PORT) { $env:PORT } else { 8000 }
# Kill process on port if any
$proc = Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($proc) {
    Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

$tailscaleIp = $null
try {
    $tailscaleIp = (tailscale ip -4 2>$null | Select-Object -First 1).Trim()
} catch {}

Write-Host ""
Write-Host "=========================================="
Write-Host "  Server berjalan!"
Write-Host ""
Write-Host "  Buka browser di:"
Write-Host "    http://localhost:$PORT"
if ($tailscaleIp) {
    Write-Host ""
    Write-Host "  Akses dari cabang via Tailscale:"
    Write-Host "    http://$tailscaleIp`:$PORT"
}
Write-Host ""
Write-Host "  Login default:"
Write-Host "    superadmin / superadmin"
Write-Host "    admin_utama / admin"
Write-Host "    kasir_utama / kasir1"
Write-Host "=========================================="
Write-Host ""
Write-Host "Tekan Ctrl+C untuk berhenti."
Write-Host ""

python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
