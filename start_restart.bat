@echo off
taskkill /IM node.exe /F >nul 2>&1
timeout /t 3 >nul
start "" cmd /c "node ."
exit
