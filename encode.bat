@echo off
title Encoding Face Dataset — Please Wait
color 0B

echo.
echo  =========================================================
echo    Multi-Face Attendance System — ENCODE FACES
echo  =========================================================
echo.

REM ── Check venv exists ────────────────────────────────────
if not exist ".venv\Scripts\activate.bat" (
    color 0C
    echo  [ERROR] Virtual environment not found!
    echo  Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

REM ── Check dataset folder ─────────────────────────────────
if not exist "dataset\" (
    color 0C
    echo  [ERROR] 'dataset' folder not found!
    echo  Please create it and add student sub-folders with images.
    echo.
    pause
    exit /b 1
)

REM ── Activate venv and run encoder ────────────────────────
call .venv\Scripts\activate.bat

echo  Starting face encoding...
echo  (First run will download the AI model ~30 MB)
echo.

python encode_faces.py

if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Encoding failed. Check the error above.
    pause
    exit /b 1
)

echo.
color 0A
echo  =========================================================
echo    Encoding complete!  You can now run run.bat
echo  =========================================================
echo.
pause
