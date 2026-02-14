@echo off
setlocal ENABLEDELAYEDEXPANSION

REM --- Configurable defaults ---
if not defined MODEL set "MODEL=C:\Users\Miguel\Downloads\vosk-model-tl-ph-generic-0.6"
if not defined PORT set "PORT=2700"

REM --- Paths ---
set "VENV_PY=%~dp0.venv\Scripts\python.exe"
set "SCRIPT=%~dp0server.py"

if not exist "%VENV_PY%" (
  echo [!] Could not find venv python at: %VENV_PY%
  echo     Create it first by running these commands in the VoskServer folder:
  echo     py -3.11 -m venv .venv
  echo     .venv\Scripts\activate
  echo     python -m pip install websockets vosk
  echo.
  echo     Or run: setup_venv.bat
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo [!] Could not find server script at: %SCRIPT%
  exit /b 1
)

echo Using MODEL=%MODEL%
echo Using PORT=%PORT%

"%VENV_PY%" "%SCRIPT%" --model "%MODEL%" --port %PORT%

endlocal
