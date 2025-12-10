@echo off
echo ========================================
echo Starting Both Vosk Servers
echo ========================================
echo.

REM Start Original Vosk Server (Port 2700)
echo [1/2] Starting Vosk Server (Port 2700)...
start "VoskServer-2700" cmd /k "python server.py"
timeout /t 2 /nobreak >nul

REM Start Optimistic Reading Server (Port 2701)
echo [2/2] Starting Optimistic Reading Server (Port 2701)...
start "OptimisticServer-2701" cmd /k "python start_optimistic_server.py"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo Both Servers Started!
echo ========================================
echo.
echo   Vosk Server:        ws://localhost:2700
echo   Optimistic Server:  ws://localhost:2701
echo.
echo Press any key to close this window...
pause >nul
