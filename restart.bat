@echo off
taskkill /IM node.exe /F
timeout /t 3
start "" cmd /c "node ."
exit
