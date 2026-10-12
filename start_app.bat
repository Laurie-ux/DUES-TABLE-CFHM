@echo off
REM start_app.bat - start a simple HTTP server and open the app in the default browser
cd /d "%~dp0"
where python >nul 2>&1















pausestart "" http://localhost:8000timeout /t 1 >nulREM wait a moment then open default browser to the app)  )    exit /b 1    pause    echo Python not found. Please install Python 3 or open index.html directly in your browser.  ) else (    start "" python3 -m http.server 8000  where python3 >nul 2>&1
n  if %errorlevel%==0 () else (  start "" python -m http.server 8000nif %errorlevel%==0 (