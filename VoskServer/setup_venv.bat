@echo off
echo Setting up Python virtual environment for Vosk Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python not found. Please install Python 3.11 or later.
    echo     Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo Creating virtual environment...
python -m venv .venv
if errorlevel 1 (
    echo [!] Failed to create virtual environment
    pause
    exit /b 1
)

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo Installing required packages...
python -m pip install --upgrade pip
python -m pip install websockets vosk

if errorlevel 1 (
    echo [!] Failed to install packages
    pause
    exit /b 1
)

echo.
echo [✓] Virtual environment setup complete!
echo.
echo You can now run: run.bat
echo.
pause

