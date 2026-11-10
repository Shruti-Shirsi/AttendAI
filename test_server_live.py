import requests
import time
import subprocess
import sys
import os

print("=== Testing FastAPI Server Startup & Endpoints ===")
cmd = [
    os.path.join(os.path.dirname(__file__), ".venv", "Scripts", "python.exe"),
    "-m", "uvicorn", "app.main:app",
    "--app-dir", os.path.join(os.path.dirname(__file__), "backend"),
    "--host", "127.0.0.1",
    "--port", "8008"
]

proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
time.sleep(3)

try:
    # 1. Health check
    res = requests.get("http://127.0.0.1:8008/api/v1/health", timeout=5)
    print("Health response:", res.status_code, res.json())
    assert res.status_code == 200

    # 2. Login
    login_res = requests.post("http://127.0.0.1:8008/api/v1/auth/login", json={
        "email": "admin@attendai.edu",
        "password": "admin123"
    })
    print("Login response:", login_res.status_code)
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. List students
    students_res = requests.get("http://127.0.0.1:8008/api/v1/students/", headers=headers)
    print(f"Students endpoint: {students_res.status_code}, Found {len(students_res.json())} students.")
    assert students_res.status_code == 200

    # 4. List classes
    classes_res = requests.get("http://127.0.0.1:8008/api/v1/classes/", headers=headers)
    print(f"Classes endpoint: {classes_res.status_code}, Found {len(classes_res.json())} classes.")
    assert classes_res.status_code == 200

    print("\n>>> ALL LIVE FASTAPI ROUTES VERIFIED SUCCESSFULLY! <<<")
finally:
    proc.terminate()
    proc.kill()
