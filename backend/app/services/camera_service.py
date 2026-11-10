import cv2
import time
import base64
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional, Generator, Tuple
from app.services.face_service import face_engine
from app.services.face_tracker import FaceTracker
from app.services.attendance_engine import attendance_engine

class CameraService:
    _instance = None

    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self.cap: Optional[cv2.VideoCapture] = None
        self.tracker = FaceTracker(max_misses=15, iou_threshold=0.25)
        self.is_running = False
        self.last_frame_time = time.time()
        self.fps = 0.0
        self.recent_detections: List[Dict[str, Any]] = []
        self.frame_skip = 2
        self.frame_count = 0
        self.cached_tracks = []

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = CameraService()
        return cls._instance

    def start_camera(self) -> bool:
        if self.cap is not None and self.cap.isOpened():
            return True
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                self.is_running = True
                print(f"[CameraService] Primary webcam opened at index {self.camera_index}.")
                return True
        except Exception as e:
            print(f"[CameraService ERROR] Opening camera failed: {e}")
        self.cap = None
        self.is_running = False
        return False

    def stop_camera(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.is_running = False
        print("[CameraService] Camera released.")

    def process_cv2_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """
        Runs YuNet multi-face detection, SFace 128-D embedding extraction,
        cosine similarity matching, and spatial face tracking.
        Annotates the frame with modern SaaS HUD and bounding boxes.
        """
        now = time.time()
        dt = now - self.last_frame_time
        self.last_frame_time = now
        if dt > 0:
            current_fps = 1.0 / dt
            self.fps = 0.9 * self.fps + 0.1 * current_fps if self.fps > 0 else current_fps

        self.frame_count += 1
        h, w = frame.shape[:2]

        if not face_engine.initialized or face_engine.detector is None:
            # Draw waiting status
            cv2.putText(frame, "Biometric Neural Engine Initializing...", (30, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 165, 255), 2)
            return frame, []

        detections = []
        # Process detection every N frames for ultra-high FPS
        if self.frame_count % self.frame_skip == 0:
            small = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
            sh, sw = small.shape[:2]
            face_engine.detector.setInputSize((sw, sh))
            _, faces = face_engine.detector.detect(small)

            if faces is not None and len(faces) > 0:
                for face in faces:
                    fx, fy, fw, fh = face[0] * 2, face[1] * 2, face[2] * 2, face[3] * 2
                    fx = max(0, int(fx))
                    fy = max(0, int(fy))
                    fw = min(int(fw), w - fx)
                    fh = min(int(fh), h - fy)

                    if fw <= 10 or fh <= 10:
                        continue

                    face_scaled = face.copy()
                    face_scaled[0:4] = [fx, fy, fw, fh]
                    for i in range(4, 14):
                        face_scaled[i] *= 2

                    name = "UNKNOWN"
                    student_id = None
                    confidence = 0.0

                    try:
                        aligned = face_engine.recognizer.alignCrop(frame, face_scaled)
                        feat = face_engine.recognizer.feature(aligned).flatten()
                        norm = np.linalg.norm(feat)
                        if norm > 0:
                            feat /= norm
                        match_res = face_engine.match_face(feat.tolist())
                        if match_res["match"]:
                            name = match_res["name"]
                            student_id = match_res["student_id"]
                            confidence = match_res["confidence"]
                        else:
                            confidence = match_res["confidence"]
                    except Exception:
                        pass

                    detections.append({
                        "bbox": [fx, fy, fw, fh],
                        "student_id": student_id,
                        "name": name,
                        "confidence": confidence
                    })

            self.cached_tracks = self.tracker.update(detections)
        else:
            # Use cached tracks from previous frame
            self.cached_tracks = list(self.tracker.tracks.values())

        # Render annotations on frame
        active_results = []
        known_count = 0

        for track in self.cached_tracks:
            bx, by, bw, bh = track.bbox
            is_known = (track.name != "UNKNOWN")
            att_status = "UNKNOWN"
            consec_frames = 0
            if is_known and track.student_id:
                known_count += 1
                att_res = attendance_engine.process_recognition_event(track.student_id, track.confidence, track.name)
                att_status = att_res.get("status", "VERIFYING")
                consec_frames = att_res.get("consecutive_frames", 0)
                if att_status in ("STAMPED_PRESENT", "ALREADY_PRESENT"):
                    color = (74, 222, 128)
                    label_text = f"#{track.track_id} {track.name} [PRESENT]"
                else:
                    color = (250, 140, 167)
                    label_text = f"#{track.track_id} {track.name} [{consec_frames}/5]"
            else:
                color = (68, 68, 239)
                label_text = f"#{track.track_id} Visitor"

            # Draw rounded corner brackets
            x1, y1 = bx, by
            x2, y2 = bx + bw, by + bh
            c_len = min(20, bw // 4, bh // 4)
            thick = 2

            # Top-left corner
            cv2.line(frame, (x1, y1), (x1 + c_len, y1), color, thick)
            cv2.line(frame, (x1, y1), (x1, y1 + c_len), color, thick)
            # Top-right corner
            cv2.line(frame, (x2, y1), (x2 - c_len, y1), color, thick)
            cv2.line(frame, (x2, y1), (x2, y1 + c_len), color, thick)
            # Bottom-left corner
            cv2.line(frame, (x1, y2), (x1 + c_len, y2), color, thick)
            cv2.line(frame, (x1, y2), (x1, y2 - c_len), color, thick)
            # Bottom-right corner
            cv2.line(frame, (x2, y2), (x2 - c_len, y2), color, thick)
            cv2.line(frame, (x2, y2), (x2, y2 - c_len), color, thick)

            # Floating identity badge
            font = cv2.FONT_HERSHEY_SIMPLEX
            f_scale = 0.45
            f_thick = 1
            (tw, th), baseline = cv2.getTextSize(label_text, font, f_scale, f_thick)
            
            # Badge background
            pill_y1 = max(0, y1 - th - 12)
            pill_y2 = pill_y1 + th + 10
            cv2.rectangle(frame, (x1, pill_y1), (x1 + tw + 14, pill_y2), (17, 28, 58), -1)
            cv2.rectangle(frame, (x1, pill_y1), (x1 + tw + 14, pill_y2), color, 1)
            cv2.putText(frame, label_text, (x1 + 7, pill_y2 - 6), font, f_scale, (255, 255, 255), f_thick, cv2.LINE_AA)

            result_item = {
                "track_id": track.track_id,
                "bbox": [bx, by, bw, bh],
                "student_id": track.student_id,
                "name": track.name,
                "confidence": round(track.confidence, 1),
                "status": "KNOWN" if is_known else "UNKNOWN",
                "attendance_status": att_status,
                "consecutive_frames": consec_frames
            }
            active_results.append(result_item)

            # Record detection in event log if newly verified
            if is_known and track.hits >= 3:
                self._record_detection_event(track)

        # Top HUD Bar
        hud_bg = np.zeros((45, w, 3), dtype=np.uint8)
        cv2.rectangle(hud_bg, (0, 0), (w, 45), (17, 28, 58), -1)
        frame[0:45, 0:w] = cv2.addWeighted(frame[0:45, 0:w], 0.3, hud_bg, 0.7, 0)
        cv2.putText(frame, "AttendAI LIVE", (15, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
        
        hud_info = f"FPS: {self.fps:.1f}  |  Faces in Frame: {len(self.cached_tracks)}  |  Identified: {known_count}"
        cv2.putText(frame, hud_info, (170, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (200, 220, 240), 1, cv2.LINE_AA)

        return frame, active_results

    def _record_detection_event(self, track):
        """Maintains the recent detections feed with deduplication."""
        now_str = datetime.now().strftime("%H:%M:%S")
        # Check if already recorded in last 5 seconds
        for item in self.recent_detections[:5]:
            if item["student_id"] == track.student_id:
                return

        event = {
            "student_id": track.student_id,
            "name": track.name,
            "confidence": round(track.confidence, 1),
            "time": now_str,
            "track_id": track.track_id
        }
        self.recent_detections.insert(0, event)
        if len(self.recent_detections) > 20:
            self.recent_detections.pop()

    def generate_mjpeg_stream(self) -> Generator[bytes, None, None]:
        """Yields continuous JPEG frames for HTTP multipart MJPEG streaming."""
        has_cam = self.start_camera()
        
        # If hardware camera unavailable, create placeholder test canvas with simulated AI feed
        dummy_frame_idx = 0

        while True:
            if has_cam and self.cap is not None:
                ret, frame = self.cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue
            else:
                # Synthetic canvas indicating camera status
                dummy_frame_idx += 1
                frame = np.full((720, 1280, 3), (17, 28, 58), dtype=np.uint8)
                cv2.putText(frame, "AttendAI Neural Vision Stream", (380, 320),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
                cv2.putText(frame, "Webcam hardware or Browser Stream Mode ready", (410, 370),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (148, 163, 184), 1, cv2.LINE_AA)
                cv2.circle(frame, (640, 240), 50, (99, 102, 241), -1)
                cv2.putText(frame, "⚡", (625, 255), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
                time.sleep(0.04)

            annotated_frame, _ = self.process_cv2_frame(frame)
            ret, jpeg = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ret:
                continue

            frame_bytes = jpeg.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    def process_browser_frame(self, b64_frame: str) -> Dict[str, Any]:
        """Processes a frame submitted from the browser webcam (via HTTP POST or WebSocket)."""
        if "," in b64_frame:
            b64_frame = b64_frame.split(",", 1)[1]
        
        raw_bytes = base64.b64decode(b64_frame)
        np_arr = np.frombuffer(raw_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"error": "Invalid frame data", "faces": []}

        _, active_results = self.process_cv2_frame(frame)

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "fps": round(self.fps, 1),
            "total_faces": len(active_results),
            "known_faces": sum(1 for r in active_results if r["status"] == "KNOWN"),
            "faces": active_results,
            "recent_detections": self.recent_detections[:10]
        }

camera_service = CameraService.get_instance()
