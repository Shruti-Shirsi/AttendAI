@echo off
title AttendAI - Real-Time Multi-Face Attendance System
color 0B
cls

echo ====================================================================
echo             ATTENDAI - SMARTER ATTENDANCE, SAFER TOMORROW
echo              Production AI Biometrics & Parent Communication
echo ====================================================================
echo.
echo  [1] Start Both Backend and Frontend (Recommended)
echo  [2] Start FastAPI Backend Server Only  (Port 8000)
echo  [3] Start React Vite Frontend Only     (Port 5173)
echo  [4] Run Automated Verification Tests
echo  [5] Exit
echo.
set /p choice="Enter your choice [1-5]: "

if "%choice%"=="1" goto start_both
if "%choice%"=="2" goto start_backend
if "%choice%"=="3" goto start_frontend
if "%choice%"=="4" goto run_tests
if "%choice%"=="5" goto exit_script

:start_both
echo.
echo Launching AttendAI Backend (FastAPI)...
start "AttendAI - FastAPI Backend (Port 8000)" cmd /k "cd /d "%~dp0" && .venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"
timeout /t 3 /nobreak >nul
echo Launching AttendAI Frontend (React Vite)...
start "AttendAI - React Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo.
echo ====================================================================
echo AttendAI is launching!
echo  - Frontend URL : http://localhost:5173
echo  - Backend API  : http://127.0.0.1:8000/docs
echo.
echo  Default Login:
echo    Admin   : admin@attendai.edu   / admin123
echo    Teacher : teacher@attendai.edu / teacher123
echo ====================================================================
pause
exit

:start_backend
echo.
echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
cd /d "%~dp0"
.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
pause
exit

:start_frontend
echo.
echo Starting React Vite Frontend on http://localhost:5173 ...
cd /d "%~dp0frontend"
npm run dev
pause
exit

:run_tests
echo.
echo Running AttendAI System Diagnostics (All 10 Modules)...
cd /d "%~dp0"
.venv\Scripts\python.exe test_all.py
pause
exit

:exit_script
exit
