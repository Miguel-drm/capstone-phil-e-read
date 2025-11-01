@echo off
echo 🔄 Restarting Frontend to Pick Up New Backend Port
echo =================================================
echo.

echo 📋 Current backend configuration:
type frontend\.env.local
echo.

echo 🛑 Stopping current frontend server...
taskkill /f /im node.exe /fi "WINDOWTITLE eq 🌐 Versatile Frontend*" >nul 2>&1
taskkill /f /im node.exe /fi "WINDOWTITLE eq Frontend Server*" >nul 2>&1

echo ⏳ Waiting for cleanup...
timeout /t 2 /nobreak >nul

echo 🌐 Starting fresh frontend server...
cd frontend
start "🌐 Fresh Frontend" cmd /k "npm run dev"

echo.
echo ✅ Frontend restarted!
echo 📱 It will now connect to the backend on the correct port
echo 🔄 Refresh your browser to see the changes
echo.
pause