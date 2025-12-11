@echo off
echo ========================================
echo Restarting Vosk Server for Phrase Mode
echo ========================================
echo.

echo Step 1: Finding and stopping existing Vosk server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :2700 ^| findstr LISTENING') do (
    echo Found process on port 2700: PID %%a
    taskkill /F /PID %%a
)

echo.
echo Step 2: Waiting for port to be released...
timeout /t 2 /nobreak >nul

echo.
echo Step 3: Starting Vosk server with phrase mode support...
cd VoskServer
start "Vosk Server" python server.py --service-language english

echo.
echo ========================================
echo Vosk Server is starting...
echo Check the new window for startup logs
echo Look for: "PHRASE MATCHER initialized"
echo ========================================
echo.
pause
