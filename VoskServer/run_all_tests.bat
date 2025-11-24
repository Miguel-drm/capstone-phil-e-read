@echo off
echo ======================================================================
echo   RUNNING ALL TESTS (No PyAudio Required)
echo ======================================================================
echo.

echo TEST 1: Connection Manager
echo ----------------------------------------------------------------------
python test_connection_manager.py
if %errorlevel% neq 0 (
    echo FAILED: Connection Manager Test
    pause
    exit /b 1
)
echo.

echo TEST 2: Language Detection
echo ----------------------------------------------------------------------
python test_language_detection.py
if %errorlevel% neq 0 (
    echo FAILED: Language Detection Test
    pause
    exit /b 1
)
echo.

echo TEST 3: Smart Mic Handler (Basic)
echo ----------------------------------------------------------------------
python test_smart_mic_basic.py
if %errorlevel% neq 0 (
    echo FAILED: Smart Mic Basic Test
    pause
    exit /b 1
)
echo.

echo TEST 4: Connection Diagnosis
echo ----------------------------------------------------------------------
python diagnose_connection.py
if %errorlevel% neq 0 (
    echo FAILED: Connection Diagnosis
    pause
    exit /b 1
)
echo.

echo ======================================================================
echo   ALL TESTS COMPLETED SUCCESSFULLY!
echo ======================================================================
echo.
echo Next steps:
echo   1. Rebuild frontend: cd frontend ^&^& npm run build
echo   2. Test in browser with microphone
echo   3. Verify speech recognition works
echo.
pause
