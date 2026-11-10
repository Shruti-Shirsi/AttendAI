@echo off
title Multi-Face Attendance System
color 0A

:MENU
cls
echo.
echo  =========================================================
echo    Multi-Face Attendance System  ^|  InsightFace ArcFace
echo  =========================================================
echo.
echo    [1]  Start Live Attendance    (main.py)
echo    [2]  Start Student Portal      (app.py)
echo    [3]  Start Admin Dashboard     (admin_dashboard.py)
echo    [4]  Re-encode Faces           (encode_faces.py)
echo    [5]  Exit
echo.
set /p choice="  Enter option (1-5): "

if "%choice%"=="1" goto RUN_MAIN
if "%choice%"=="2" goto RUN_STUDENT
if "%choice%"=="3" goto RUN_ADMIN
if "%choice%"=="4" goto RUN_ENCODE
if "%choice%"=="5" goto EXIT
echo.
echo  Invalid option. Try again.
timeout /t 1 >nul
goto MENU

REM ─────────────────────────────────────────────────────────
:RUN_MAIN
cls

REM Check venv
if not exist ".venv\Scripts\activate.bat" (
    color 0C
    echo.
    echo  [ERROR] Virtual environment not found!
    echo  Please run setup.bat first.
    echo.
    pause
    goto MENU
)

REM Check encodings file
if not exist "face_encodings.pkl" (
    color 0E
    echo.
    echo  [WARNING] face_encodings.pkl not found!
    echo  You must run option [4] (Encode Faces) first.
    echo.
    pause
    goto MENU
)

echo.
echo  =========================================================
echo    Starting Multi-Face Attendance System...
echo  =========================================================
echo.
echo  Press Q to quit   |   Press S for screenshot   |   Press R to reload

call .venv\Scripts\activate.bat
python main.py

echo.
echo  System stopped. Press any key to return to menu.
pause >nul
color 0A
goto MENU

REM ─────────────────────────────────────────────────────────
:RUN_STUDENT
cls

REM Check venv
if not exist ".venv\Scripts\activate.bat" (
    color 0C
    echo.
    echo  [ERROR] Virtual environment not found!
    echo  Please run setup.bat first.
    echo.
    pause
    goto MENU
)

echo.
echo  =========================================================
echo    Starting Smart Student Portal...
echo  =========================================================
echo.

call .venv\Scripts\activate.bat
python -m streamlit run app.py

echo.
echo  Portal stopped. Press any key to return to menu.
pause >nul
color 0A
goto MENU

REM ─────────────────────────────────────────────────────────
:RUN_ADMIN
cls

REM Check venv
if not exist ".venv\Scripts\activate.bat" (
    color 0C
    echo.
    echo  [ERROR] Virtual environment not found!
    echo  Please run setup.bat first.
    echo.
    pause
    goto MENU
)

echo.
echo  =========================================================
echo    Starting Admin Dashboard...
echo  =========================================================
echo.

call .venv\Scripts\activate.bat
python -m streamlit run admin_dashboard.py

echo.
echo  Dashboard stopped. Press any key to return to menu.
pause >nul
color 0A
goto MENU

REM ─────────────────────────────────────────────────────────
:RUN_ENCODE
cls
echo.
echo  =========================================================
echo    Encoding Faces from Dataset...
echo  =========================================================
echo.

if not exist ".venv\Scripts\activate.bat" (
    color 0C
    echo  [ERROR] Virtual environment not found!
    echo  Please run setup.bat first.
    echo.
    pause
    goto MENU
)

call .venv\Scripts\activate.bat
python encode_faces.py

echo.
echo  Press any key to return to menu.
pause >nul
color 0A
goto MENU

REM ─────────────────────────────────────────────────────────
:EXIT
echo.
echo  Goodbye!
timeout /t 1 >nul
exit
