@echo off
echo ========================================
echo Starting All Services
echo ========================================
echo.

REM Start Backend Server (Port 5000)
echo [1/4] Starting Backend Server...
start "Backend" cmd /k "cd backend\server && npm run dev"
timeout /t 2 /nobreak >nul

REM Start Vosk Server (Port 2700)
echo [2/4] Starting Vosk Server...
start "VoskServer" cmd /k "cd VoskServer && python server.py"
timeout /t 2 /nobreak >nul

REM Start Optimistic Reading Server (Port 2701)
echo [3/4] Starting Optimistic Reading Server...
start "Optimistic" cmd /k "cd VoskServer && python start_optimistic_server.py"
timeout /t 2 /nobreak >nul

REM Start Frontend (Port 5173 - Vite default)
echo [4/4] Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo All Services Started!
echo ========================================
echo.
echo Services Running:
echo   Backend:            http://localhost:5000
echo   Vosk Server:        ws://localhost:2700
echo   Optimistic Server:  ws://localhost:2701
echo   Frontend:           http://localhost:3000
echo.
echo ========================================
echo Open your browser to: http://localhost:3000
echo ========================================
echo.
echo Press any key to close this window...
echo (Services will continue running in separate windows)
pause >nul
