@echo off
title Pet-1 Submarine Cabin Bot
cd /d "%~dp0"
echo ================================================
echo   Task 1: Moodie Bot inside Submarine Cabin
echo   URL : http://127.0.0.1:5181
echo   Close this window to stop the server.
echo ================================================
echo.
start "" cmd /c "timeout /t 1 /nobreak >nul && start http://127.0.0.1:5181"
python -m http.server 5181 --bind 127.0.0.1 --directory dist
