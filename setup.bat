@echo off
title Multi-Face Attendance System — First-Time Setup
color 0A

echo.
echo  =========================================================
echo    Multi-Face Attendance System — SETUP
echo  =========================================================
echo.

REM ── Check Python is installed ────────────────────────────
set "PYTHON_EXE=python"
python --version >nul 2>&1
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
        set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
        set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    ) else (
        color 0C
        echo  [ERROR] Python is NOT installed or not in PATH.
        echo.
        echo  Please install Python 3.9 - 3.11 from:
        echo    https://www.python.org/downloads/
        echo.
        echo  Make sure to tick "Add Python to PATH" during install.
        echo.
        pause
        exit /b 1
    )
)

echo  [1/4] Python found:
"%PYTHON_EXE%" --version
echo.

REM ── Create virtual environment ───────────────────────────
echo  [2/4] Creating virtual environment (.venv)...
if exist ".venv\" (
    echo       .venv already exists — skipping creation.
) else (
    "%PYTHON_EXE%" -m venv .venv
    if errorlevel 1 (
        color 0C
        echo  [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo       Done.
)
echo.

REM ── Activate and install packages ────────────────────────
echo  [3/4] Installing dependencies from requirements.txt...
echo       (This may take 2-5 minutes on first run)
echo.

call .venv\Scripts\activate.bat
pip install --upgrade pip --quiet
pip install -r requirements.txt

if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Dependency installation failed.
    echo  Check your internet connection and try again.
    pause
    exit /b 1
)
echo.

REM ── Check dataset folder ─────────────────────────────────
echo  [4/4] Checking dataset folder...
if not exist "dataset\" (
    mkdir dataset
    echo       Created empty 'dataset' folder.
    echo       Please add student sub-folders with face images inside it.
) else (
    echo       'dataset' folder found.
)
echo.

REM ── Done ─────────────────────────────────────────────────
color 0A
echo  =========================================================
echo    SETUP COMPLETE!
echo  =========================================================
echo.
echo  NEXT STEPS:
echo    1. Make sure 'dataset\' has one sub-folder per student
echo       (e.g. dataset\Prajakta\, dataset\Akhila\, etc.)
echo       with 10-20 face photos each.
echo.
echo    2. Double-click  encode.bat  to train face encodings.
echo.
echo    3. Double-click  run.bat     to start live attendance.
echo.
pause
