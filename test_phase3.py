import sys
import os
import cv2
import base64
import numpy as np

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.services.face_tracker import FaceTracker
from app.services.camera_service import camera_service

def test_phase3():
    print("=== Testing Phase 3: Live Detection, Tracking, and Vision Engine ===")

    # 1. Test FaceTracker spatial continuity
    print("\n[1] Testing Spatial Multi-Face Tracker (ByteTrack-style IoU)...")
    tracker = FaceTracker(max_misses=5, iou_threshold=0.25)
    
    # Frame 1: Two detected faces
    frame1_dets = [
        {"bbox": [100, 100, 120, 140], "student_id": 1, "name": "Akhila", "confidence": 92.5},
        {"bbox": [350, 120, 110, 130], "student_id": 4, "name": "Prajakta", "confidence": 95.0}
    ]
    tracks_f1 = tracker.update(frame1_dets)
    print(f" Frame 1: Assigned {len(tracks_f1)} tracks:")
    for t in tracks_f1:
        print(f"   Track #{t.track_id}: {t.name} (Conf: {t.confidence}%, BBox: {t.bbox})")
    assert len(tracks_f1) == 2
    tid_akhila = tracks_f1[0].track_id
    tid_praju = tracks_f1[1].track_id

    # Frame 2: Faces shifted slightly by 4-6 pixels (movement)
    frame2_dets = [
        {"bbox": [104, 102, 120, 140], "student_id": 1, "name": "Akhila", "confidence": 93.1},
        {"bbox": [355, 124, 110, 130], "student_id": 4, "name": "Prajakta", "confidence": 96.2}
    ]
    tracks_f2 = tracker.update(frame2_dets)
    print(f"\n Frame 2: Tracking continuity with motion:")
    for t in tracks_f2:
        print(f"   Track #{t.track_id}: {t.name} (Hits: {t.hits}, Misses: {t.misses})")
    assert tracks_f2[0].track_id == tid_akhila, "Track ID must remain persistent across frames!"
    assert tracks_f2[1].track_id == tid_praju, "Track ID must remain persistent across frames!"
    print(" >>> Spatial Face Tracker verified! Zero ID switching.")

    # 2. Test CameraService frame processing and HUD annotation
    print("\n[2] Testing Frame Annotation & HUD Pipeline...")
    dummy_frame = np.full((720, 1280, 3), (30, 30, 30), dtype=np.uint8)
    annotated, active_results = camera_service.process_cv2_frame(dummy_frame)
    print(f" Frame shape: {annotated.shape}, FPS: {camera_service.fps:.1f}")
    assert annotated.shape == (720, 1280, 3)

    # 3. Test Base64 Browser Frame API processor
    print("\n[3] Testing Browser Webcam Frame Processor...")
    _, encoded = cv2.imencode('.jpg', dummy_frame)
    b64_str = base64.b64encode(encoded).decode('utf-8')
    res = camera_service.process_browser_frame(b64_str)
    print(" Browser frame result keys:", list(res.keys()))
    assert "faces" in res
    assert "fps" in res
    assert "recent_detections" in res
    print(" >>> Browser Webcam Frame Processor verified!")

    print("\n=== ALL PHASE 3 COMPUTER VISION TESTS PASSED! ===")

if __name__ == "__main__":
    test_phase3()

