"""
encode_faces.py — Multi-Face Attendance System
Uses OpenCV built-in YuNet (detection) + SFace (recognition).
NO insightface / NO C++ Build Tools required.

Run once before main.py:
    py -3.11 encode_faces.py
"""

import os
import cv2
import pickle
import numpy as np
import urllib.request

# ── Configuration ───────────────────────────────────────────
SCRIPT_DIR     = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH   = os.path.join(SCRIPT_DIR, 'dataset')
ENCODINGS_FILE = os.path.join(SCRIPT_DIR, 'face_encodings.pkl')

YUNET_MODEL    = os.path.join(SCRIPT_DIR, 'face_detection_yunet.onnx')
SFACE_MODEL    = os.path.join(SCRIPT_DIR, 'face_recognition_sface.onnx')
YUNET_URL      = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL      = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

SKIP_DIRS = {'dataset', '.venv', '__pycache__', 'converted_tflite'}

# ── Helpers ─────────────────────────────────────────────────
def download_if_missing(url, path):
    if os.path.exists(path):
        return
    print(f"  Downloading {path} (please wait)...")
    try:
        urllib.request.urlretrieve(url, path)
        print(f"  Done.")
    except Exception as e:
        print(f"\n[ERROR] Could not download {path}: {e}")
        print("  Check your internet connection and try again.")
        raise SystemExit(1)

# ── Banner ───────────────────────────────────────────────────
print("=" * 55)
print("  Multi-Face Encoder — OpenCV YuNet + SFace")
print("=" * 55)
print("\n[1/3] Loading models (downloading if needed)...")

download_if_missing(YUNET_URL, YUNET_MODEL)
download_if_missing(SFACE_URL, SFACE_MODEL)

detector   = cv2.FaceDetectorYN.create(
    YUNET_MODEL, "", (320, 320), score_threshold=0.6, nms_threshold=0.3)
recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL, "")

print("[1/3] Models ready.\n")

# ── Scan dataset ─────────────────────────────────────────────
print(f"[2/3] Scanning dataset at:\n      {os.path.abspath(DATASET_PATH)}\n")

if not os.path.exists(DATASET_PATH):
    print(f"[ERROR] Dataset folder not found -> {DATASET_PATH}")
    raise SystemExit(1)

people = sorted([
    p for p in os.listdir(DATASET_PATH)
    if os.path.isdir(os.path.join(DATASET_PATH, p))
    and p.lower() not in SKIP_DIRS
])

if not people:
    print("[ERROR] No student sub-folders found inside dataset/")
    raise SystemExit(1)

print(f"Found {len(people)} students: {', '.join(people)}\n")

known_encodings, known_names = [], []
total_images = total_encoded = total_skipped = 0

for person in people:
    person_dir = os.path.join(DATASET_PATH, person)
    img_files  = [f for f in os.listdir(person_dir)
                  if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp'))]

    enc_ok = skipped = 0
    print(f"  Processing [{person}] — {len(img_files)} images...")

    for img_file in img_files:
        total_images += 1
        try:
            img = cv2.imread(os.path.join(person_dir, img_file))
            if img is None:
                skipped += 1
                continue

            h, w = img.shape[:2]
            detector.setInputSize((w, h))
            _, faces = detector.detect(img)

            if faces is None or len(faces) == 0:
                skipped += 1
                continue

            # Pick the largest face
            face    = max(faces, key=lambda f: float(f[2]) * float(f[3]))
            aligned = recognizer.alignCrop(img, face)
            emb     = recognizer.feature(aligned).flatten()

            norm = np.linalg.norm(emb)
            if norm > 0:
                emb /= norm

            known_encodings.append(emb)
            known_names.append(person)
            enc_ok += 1

        except Exception as e:
            print(f"    WARNING: {img_file} -> {e}")
            skipped += 1

    total_encoded += enc_ok
    total_skipped += skipped
    print(f"    [OK] Encoded: {enc_ok}  |  Skipped (no face): {skipped}")

# ── Save ──────────────────────────────────────────────────────
print(f"\n[3/3] Saving encodings to '{ENCODINGS_FILE}'...")

with open(ENCODINGS_FILE, 'wb') as f:
    pickle.dump({'encodings': known_encodings, 'names': known_names}, f)

print(f"\n{'=' * 55}")
print(f"  DONE!")
print(f"  Total images   : {total_images}")
print(f"  Encoded OK     : {total_encoded}")
print(f"  Skipped        : {total_skipped}")
print(f"  Saved to       : {ENCODINGS_FILE}")
print(f"{'=' * 55}")
print("\nYou can now run:  py -3.11 main.py\n")
