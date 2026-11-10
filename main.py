"""
main.py — Multi-Face Attendance System
Uses OpenCV built-in YuNet (detection) + SFace (recognition).
NO insightface / NO C++ Build Tools required.

Controls:
    Q  -> Quit
    S  -> Save screenshot
    R  -> Reload face encodings (hot-reload)
"""

import cv2
import pickle
import numpy as np
import os
import pandas as pd
import urllib.request
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ══════════════════════════════════════════════════════
#  CONFIGURATION
# ══════════════════════════════════════════════════════
SCRIPT_DIR           = os.path.dirname(os.path.abspath(__file__))
ENCODINGS_FILE       = os.path.join(SCRIPT_DIR, 'face_encodings.pkl')
STUDENT_DETAILS_FILE = os.path.join(SCRIPT_DIR, 'student_details.csv')
ATTENDANCE_FILE      = os.path.join(SCRIPT_DIR, 'attendance.csv')

TOTAL_WORKING_DAYS    = 30
# Cosine similarity threshold (SFace: >=0.35 is a confident match)
RECOGNITION_THRESHOLD = 0.35

# Model files (auto-downloaded ~37 MB on first run)
YUNET_MODEL          = os.path.join(SCRIPT_DIR, 'face_detection_yunet.onnx')
SFACE_MODEL          = os.path.join(SCRIPT_DIR, 'face_recognition_sface.onnx')
YUNET_URL            = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL            = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

# Email settings (leave SENDER_PASSWORD empty to disable)
SENDER_EMAIL    = "khabuleprajakta04@gmail.com"
SENDER_PASSWORD = ""   # <- Fill with Gmail App Password to enable

# Performance
FRAME_SKIP    = 2     # Process every Nth frame
DISPLAY_WIDTH = 960   # Output window width in pixels

COLORS = {
    'known'   : (0, 210, 80),
    'unknown' : (0,  60, 220),
}


# ══════════════════════════════════════════════════════
#  HELPER: DOWNLOAD MODELS
# ══════════════════════════════════════════════════════
def download_if_missing(url, path):
    if os.path.exists(path):
        return
    print(f"  Downloading {path} (please wait)...")
    try:
        urllib.request.urlretrieve(url, path)
        print(f"  Done.")
    except Exception as e:
        print(f"\n[ERROR] Could not download {path}: {e}")
        raise SystemExit(1)


# ══════════════════════════════════════════════════════
#  HELPER: EMAIL
# ══════════════════════════════════════════════════════
def send_email(student_name, student_email, current_date, current_time):
    if not SENDER_PASSWORD:
        return
    try:
        msg = MIMEMultipart()
        msg['From']    = SENDER_EMAIL
        msg['To']      = student_email
        msg['Subject'] = "[Attendance] Confirmed"
        body = (
            f"Dear {student_name},\n\n"
            f"Your attendance has been marked as PRESENT.\n\n"
            f"  Date : {current_date}\n"
            f"  Time : {current_time}\n\n"
            f"Thank you.\n"
        )
        msg.attach(MIMEText(body, 'plain'))
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, student_email, msg.as_string())
        server.quit()
        print(f"  [EMAIL] Sent to {student_name} ({student_email})")
    except Exception as e:
        print(f"  [EMAIL] Failed for {student_name}: {e}")


# ══════════════════════════════════════════════════════
#  HELPER: STUDENT DETAILS
# ══════════════════════════════════════════════════════
def load_student_details():
    if not os.path.exists(STUDENT_DETAILS_FILE):
        print(f"[WARN] '{STUDENT_DETAILS_FILE}' not found — email alerts disabled.")
        return {}
    df = pd.read_csv(STUDENT_DETAILS_FILE)
    return dict(zip(df['Name'], df['Email']))


# ══════════════════════════════════════════════════════
#  HELPER: ATTENDANCE
# ══════════════════════════════════════════════════════
def calculate_attendance_percentage(student_name):
    if not os.path.exists(ATTENDANCE_FILE):
        return 0.0, 0
    df = pd.read_csv(ATTENDANCE_FILE)
    days_present = df[df['Name'] == student_name]['Date'].nunique()
    percentage   = (days_present / TOTAL_WORKING_DAYS) * 100
    return percentage, days_present


"""
PATCH for main.py — Replace the mark_attendance() function and add API call.

Copy-paste this updated function into your existing main.py
to replace the old CSV-based mark_attendance() function.
"""

# ADD this import at the top of main.py:
import requests

# ── API Configuration ──────────────────────────────────────────
API_BASE_URL = "http://localhost:5000/api"   # Must match Node.js server port


# ── REPLACE the old mark_attendance() with this version ────────
def mark_attendance(name, student_details, marked_today):
    """
    Marks attendance via the Node.js/MySQL API instead of CSV.
    Falls back to CSV if the API is unreachable.
    """
    if name in marked_today:
        return

    now          = datetime.now()
    current_date = now.strftime('%Y-%m-%d')
    current_time = now.strftime('%H:%M:%S')

    # ── Try API first ──────────────────────────────
    try:
        response = requests.post(
            f"{API_BASE_URL}/attendance/mark",
            json={"name": name, "date": current_date, "time": current_time},
            timeout=3
        )
        data = response.json()

        if data.get("already_marked"):
            marked_today.add(name)
            return

        if data.get("success"):
            marked_today.add(name)
            pct    = data.get("attendance_percentage", 0)
            days   = data.get("days_present", 0)
            total  = data.get("total_working_days", 30)
            status = data.get("status", "")
            print(f"\n  [OK] Attendance marked (MySQL) -> {name}  [{current_time}]")
            print(f"     Days present: {days}/{total} ({pct:.1f}%)  {'[!] SHORT ATTENDANCE' if status == 'SHORTAGE' else '[OK]'}")

            # Send email if configured
            if name in student_details:
                send_email(name, student_details[name], current_date, current_time)
            return

    except requests.exceptions.ConnectionError:
        print(f"  [WARN] API unreachable — falling back to CSV for {name}")
    except Exception as e:
        print(f"  [WARN] API error: {e} — falling back to CSV for {name}")

    # ── CSV fallback (original logic) ─────────────
    if not os.path.exists(ATTENDANCE_FILE):
        with open(ATTENDANCE_FILE, 'w') as f:
            f.write('Name,Date,Time\n')

    import pandas as pd
    df = pd.read_csv(ATTENDANCE_FILE)
    if not df.empty:
        if not df[(df['Name'] == name) & (df['Date'] == current_date)].empty:
            marked_today.add(name)
            return

    with open(ATTENDANCE_FILE, 'a') as f:
        f.write(f'{name},{current_date},{current_time}\n')
    marked_today.add(name)

    print(f"\n  [OK] Attendance marked (CSV fallback) -> {name}  [{current_time}]")
    pct, days = calculate_attendance_percentage(name)
    print(f"     Days present: {days}/{TOTAL_WORKING_DAYS} ({pct:.1f}%)")

    if name in student_details:
        send_email(name, student_details[name], current_date, current_time)



# ══════════════════════════════════════════════════════
#  HELPER: LOAD ENCODINGS
# ══════════════════════════════════════════════════════
def load_encodings(path):
    if not os.path.exists(path):
        print(f"\n[ERROR] '{path}' not found!")
        print("  Please run:  py -3.11 encode_faces.py  first.\n")
        return [], []
    with open(path, 'rb') as f:
        data = pickle.load(f)
    enc   = np.array(data['encodings'], dtype=np.float32)
    names = data['names']
    print(f"[INFO] Loaded {len(names)} face embeddings for: {sorted(set(names))}")
    return enc, names


# ══════════════════════════════════════════════════════
#  HELPER: MATCHING (cosine similarity)
# ══════════════════════════════════════════════════════
def find_best_match(embedding, known_encodings, known_names):
    if len(known_encodings) == 0:
        return "UNKNOWN", 0.0

    similarities = np.dot(known_encodings, embedding)
    best_idx     = int(np.argmax(similarities))
    best_sim     = float(similarities[best_idx])

    if best_sim >= RECOGNITION_THRESHOLD:
        name       = known_names[best_idx]
        confidence = min(best_sim * 100.0, 100.0)
        return name, confidence
    return "UNKNOWN", 0.0


# ══════════════════════════════════════════════════════
#  OVERLAY HELPERS
# ══════════════════════════════════════════════════════
def draw_face_box(frame, x, y, w, h, name, confidence):
    is_known = (name != "UNKNOWN")
    color    = COLORS['known'] if is_known else COLORS['unknown']

    x1, y1, x2, y2 = int(x), int(y), int(x + w), int(y + h)
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

    clen, ct = 18, 3
    for cx, cy, dx, dy in [
        (x1, y1,  1,  1), (x2, y1, -1,  1),
        (x1, y2,  1, -1), (x2, y2, -1, -1),
    ]:
        cv2.line(frame, (cx, cy), (cx + dx * clen, cy), color, ct)
        cv2.line(frame, (cx, cy), (cx, cy + dy * clen), color, ct)

    label = f" {name} {confidence:.0f}% " if is_known else " UNKNOWN "
    font  = cv2.FONT_HERSHEY_DUPLEX
    (tw, th), _ = cv2.getTextSize(label, font, 0.6, 1)
    label_y = max(y1 - 10, th + 10)
    cv2.rectangle(frame, (x1, label_y - th - 8), (x1 + tw + 6, label_y + 4), color, cv2.FILLED)
    cv2.putText(frame, label, (x1 + 3, label_y), font, 0.6, (255, 255, 255), 1, cv2.LINE_AA)


def draw_status_bar(frame, total_faces, known_faces, fps):
    h, w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h - 36), (w, h), (20, 20, 20), cv2.FILLED)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
    txt = (f"  Faces: {total_faces}   Known: {known_faces}   FPS: {fps:.1f}"
           f"   [Q] Quit  [S] Screenshot  [R] Reload")
    cv2.putText(frame, txt, (8, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)


# ══════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════
def main():
    print("\n" + "=" * 55)
    print("  Multi-Face Attendance System  --  OpenCV SFace")
    print("=" * 55)

    # 1. Download models if needed
    print("\n[INFO] Checking models...")
    download_if_missing(YUNET_URL, YUNET_MODEL)
    download_if_missing(SFACE_URL, SFACE_MODEL)

    # 2. Initialise detector and recognizer
    print("[INFO] Loading face detector & recognizer...")
    detector   = cv2.FaceDetectorYN.create(
        YUNET_MODEL, "", (320, 320), score_threshold=0.6, nms_threshold=0.3)
    recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL, "")
    print("[INFO] Models ready.")

    # 3. Load student details
    student_details = load_student_details()

    # 4. Load pre-computed encodings
    known_encodings, known_names = load_encodings(ENCODINGS_FILE)
    if len(known_encodings) == 0:
        return

    # 5. Open webcam
    print("\n[INFO] Opening camera...")
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[ERROR] Cannot open camera. Check webcam connection.")
        return
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    print("[INFO] Camera ready.  Press Q to quit.\n")

    marked_today = set()
    frame_count  = 0
    fps = 0.0
    fps_timer  = datetime.now()
    fps_frames = 0
    last_results  = []
    screenshot_n  = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to read frame from camera.")
            break

        frame_count += 1
        fps_frames  += 1

        if fps_frames >= 30:
            elapsed    = (datetime.now() - fps_timer).total_seconds()
            fps        = fps_frames / elapsed if elapsed > 0 else 0
            fps_timer  = datetime.now()
            fps_frames = 0

        if frame_count % FRAME_SKIP == 0:
            last_results = []
            small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            sh, sw = small.shape[:2]
            detector.setInputSize((sw, sh))
            _, faces = detector.detect(small)

            if faces is not None:
                for face in faces:
                    x, y, w, h = face[0]*2, face[1]*2, face[2]*2, face[3]*2
                    x, y = max(0, int(x)), max(0, int(y))
                    w = min(int(w), frame.shape[1] - x)
                    h = min(int(h), frame.shape[0] - y)

                    # Scale face landmarks back for alignCrop
                    face_scaled = face.copy()
                    face_scaled[0:4] = [x, y, w, h]
                    for i in range(4, 14):
                        face_scaled[i] *= 2

                    try:
                        aligned = recognizer.alignCrop(frame, face_scaled)
                        emb     = recognizer.feature(aligned).flatten()
                        norm    = np.linalg.norm(emb)
                        if norm > 0:
                            emb /= norm
                    except Exception:
                        continue

                    name, conf = find_best_match(emb, known_encodings, known_names)
                    last_results.append((x, y, w, h, name, conf))

                    if name != "UNKNOWN":
                        mark_attendance(name, student_details, marked_today)

        known_count = 0
        for (x, y, w, h, name, conf) in last_results:
            draw_face_box(frame, x, y, w, h, name, conf)
            if name != "UNKNOWN":
                known_count += 1

        draw_status_bar(frame, len(last_results), known_count, fps)

        if DISPLAY_WIDTH > 0:
            scale = DISPLAY_WIDTH / frame.shape[1]
            disp  = cv2.resize(frame, (DISPLAY_WIDTH, int(frame.shape[0] * scale)))
        else:
            disp = frame

        cv2.imshow('Multi-Face Attendance System', disp)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            print("\n[INFO] Quit signal received.")
            break
        elif key == ord('s'):
            screenshot_n += 1
            fname = f"screenshot_{screenshot_n:03d}.jpg"
            cv2.imwrite(fname, frame)
            print(f"[INFO] Screenshot saved -> {fname}")
        elif key == ord('r'):
            print("[INFO] Reloading encodings...")
            known_encodings, known_names = load_encodings(ENCODINGS_FILE)
            marked_today.clear()
            print("[INFO] Encodings reloaded.")

    cap.release()
    cv2.destroyAllWindows()

    print("\n" + "=" * 55)
    print("  SESSION SUMMARY")
    print("=" * 55)
    if marked_today:
        print(f"  Students marked present ({len(marked_today)}):")
        for name in sorted(marked_today):
            pct, days = calculate_attendance_percentage(name)
            status = "[!] SHORT" if pct < 75.0 else "[OK]"
            print(f"    - {name:<15} {days}/{TOTAL_WORKING_DAYS} days  ({pct:.1f}%)  {status}")
    else:
        print("  No attendance marked this session.")
    print("=" * 55 + "\n")


if __name__ == '__main__':
    main()
