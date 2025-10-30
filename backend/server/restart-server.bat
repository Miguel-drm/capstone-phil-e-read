@echo off
echo Stopping existing server on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)
echo Starting new server...
npm start