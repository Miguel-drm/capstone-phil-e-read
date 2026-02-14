@echo off
setlocal enabledelayedexpansion
echo.
echo 🚀 Phil-E-Read Ultimate Versatile Startup
echo ==========================================
echo.

echo 📊 Checking system compatibility...

:: Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

:: Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found! Please install npm first.
    pause
    exit /b 1   
)

echo ✅ Node.js and npm are available
echo.

echo 🔍 Checking system status...
node check-system-status.cjs

echo.
echo 🎯 Starting servers with automatic port detection...
echo.

echo [1/2] 🔧 Starting Versatile Backend Server...
echo      → Will automatically find available port (5000-5020, 8000-8010, 3010-3020)
echo      → Will auto-configure frontend to connect to selected port
cd backend\server
start "🔧 Versatile Backend" cmd /k "node versatile-backend.js"

echo ⏳ Waiting for backend to initialize and configure frontend...
timeout /t 5 /nobreak >nul

echo.
echo [2/2] 🌐 Starting Versatile Frontend Server...
echo      → Will automatically find available port (3000, 3001, 3002, 3003, etc.)
echo      → Will automatically connect to backend on detected port
cd ..\..\frontend
start "🌐 Versatile Frontend" cmd /k "npm run dev"

echo.
echo 🎉 SUCCESS! Both servers are starting with FULL PORT VERSATILITY!
echo ================================================================
echo.
echo 🔧 Backend Features:
echo    • Automatic port detection (5000→5020, 8000→8010, 3010→3020)
echo    • Auto-configures frontend connection
echo    • Graceful fallback if preferred ports are busy
echo.
echo 🌐 Frontend Features:
echo    • Vite automatically tries ports: 3000→3001→3002→3003→etc.
echo    • Automatically connects to backend's detected port
echo    • No manual configuration needed
echo.
echo 📱 Compatibility:
echo    ✅ Works with ANY available port combination
echo    ✅ Handles port conflicts automatically
echo    ✅ Updates configuration dynamically
echo    ✅ No manual port management needed
echo.
echo 🎮 Usage:
echo    • Both servers will find their own available ports
echo    • Frontend automatically connects to backend
echo    • Check the terminal windows for actual port numbers
echo    • System works on ports 3000-3020, 5000-5020, 8000-8020
echo.
echo ✨ Your system is now 100%% PORT-VERSATILE! ✨
echo.
pause