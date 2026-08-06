@echo off
chcp 65001 >nul
echo ==========================================
echo   F&B POS - KopiKita Cafe
echo   Local Installer / Starter
echo ==========================================
echo.

REM Move to script directory
cd /d "%~dp0"

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: Python belum terinstall.
  echo Silakan install Python 3.10+ dari https://python.org/downloads
  echo Pastikan centang "Add Python to PATH" saat install.
  pause
  exit /b 1
)

set "VENV_DIR=%CD%\backend\.venv"

echo.
echo [1/5] Setup Python virtual environment...
if not exist "%VENV_DIR%" (
  python -m venv "%VENV_DIR%"
)

REM Activate venv
call "%VENV_DIR%\Scripts\activate.bat"

echo.
echo [2/5] Install / update backend dependencies...
python -m pip install --upgrade pip -q
pip install -q -r "backend\requirements.txt"

echo.
echo [3/5] Build frontend...
node --version >nul 2>&1
if errorlevel 1 (
  echo   Node.js tidak ditemukan. Menggunakan frontend\dist yang sudah ada.
) else (
  cd "frontend"
  call npm install --silent 2>nul
  call npx vite build 2>nul
  cd ..
)

echo.
echo [4/5] Check / seed database...
cd "backend"
if not exist "kasir.db" (
  echo   Database kosong, seeding data awal...
  python seed.py --reset
) else (
  echo   Database sudah ada, skip seeding.
)

echo.
echo [5/5] Starting server...
set PORT=8000
REM Kill process on port 8000 if any
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT%') do taskkill /F /PID %%a 2>nul

for /f "tokens=*" %%a in ('tailscale ip -4 2^>nul') do set TAILSCALE_IP=%%a

echo.
echo ==========================================
echo   Server berjalan!
echo.
echo   Buka browser di:
echo     http://localhost:%PORT%
if defined TAILSCALE_IP (
  echo.
  echo   Akses dari cabang via Tailscale:
  echo     http://%TAILSCALE_IP%:%PORT%
)
echo.
echo   Login default:
echo     superadmin / superadmin
echo     admin_utama / admin
echo     kasir_utama / kasir1
echo ==========================================
echo.
echo Tekan Ctrl+C untuk berhenti.
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port %PORT%
