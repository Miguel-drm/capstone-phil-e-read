@echo off
echo Killing Python server on port 2700...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :2700') do taskkill /F /PID %%a
echo Done!
