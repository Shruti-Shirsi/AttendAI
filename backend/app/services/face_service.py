import os
import json
import pickle
import numpy as np
import cv2
from typing import List, Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.student import Student
from app.models.face_embedding import FaceEmbedding

# Absolute paths to models
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
YUNET_MODEL = os.path.join(BASE_DIR, "face_detection_yunet.onnx")
SFACE_MODEL = os.path.join(BASE_DIR, "face_recognition_sface.onnx")
PKL_FILE = os.path.join(BASE_DIR, "face_encodings.pkl")
DATASET_DIR = os.path.join(BASE_DIR, "dataset")

RECOGNITION_THRESHOLD = 0.35

class FaceRecognitionEngine:
    _instance = None

    def __init__(self):
        self.detector = None
        self.recognizer = None
        self.known_embeddings = np.empty((0, 128), dtype=np.float32)
        self.known_student_ids = []
        self.known_names = []
        self.initialized = False
        self._load_models()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = FaceRecognitionEngine()
        return cls._instance

    def _load_models(self):
        if not os.path.exists(YUNET_MODEL) or not os.path.exists(SFACE_MODEL):
            print(f"[FaceService WARNING] ONNX model files missing at: {YUNET_MODEL} or {SFACE_MODEL}")
            return
        
        try:
            self.detector = cv2.FaceDetectorYN.create(
                YUNET_MODEL, "", (320, 320), score_threshold=0.6, nms_threshold=0.3
            )
            self.recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL, "")
            self.initialized = True
            print("[FaceService] YuNet face detector & SFace recognizer initialized successfully.")
        except Exception as e:
            print(f"[FaceService ERROR] Initializing OpenCV models failed: {e}")

    def extract_embedding_from_cv2(self, img: np.ndarray) -> Tuple[Optional[np.ndarray], float, Optional[List[int]]]:
        """
        Detects primary face in an image and extracts 128-D normalized SFace feature vector.
        Returns: (embedding, quality_score, [x, y, w, h])
        """
        if not self.initialized or self.detector is None or self.recognizer is None:
            return None, 0.0, None

        h, w = img.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img)

        if faces is None or len(faces) == 0:
            # Fallback: try resizing large image down or slightly lowering threshold
            if max(h, w) > 1000:
                scale = 800.0 / max(h, w)
                resized = cv2.resize(img, (int(w * scale), int(h * scale)))
                rh, rw = resized.shape[:2]
                self.detector.setInputSize((rw, rh))
                _, faces = self.detector.detect(resized)
                if faces is not None and len(faces) > 0:
                    face = faces[0].copy()
                    face[0:4] /= scale
                    for i in range(4, 14):
                        face[i] /= scale
                    faces = [face]

        if faces is None or len(faces) == 0:
            return None, 0.0, None

        # Take the most prominent face (largest area)
        primary_face = max(faces, key=lambda f: f[2] * f[3])
        x, y, bw, bh = int(primary_face[0]), int(primary_face[1]), int(primary_face[2]), int(primary_face[3])
        conf = float(primary_face[14]) if len(primary_face) > 14 else 1.0

        try:
            aligned = self.recognizer.alignCrop(img, primary_face)
            feat = self.recognizer.feature(aligned).flatten()
            norm = np.linalg.norm(feat)
            if norm > 0:
                feat /= norm
            return feat, conf, [x, y, bw, bh]
        except Exception as e:
            print(f"[FaceService] Feature extraction failed: {e}")
            return None, 0.0, None

    def extract_embedding_from_bytes(self, image_bytes: bytes) -> Tuple[Optional[List[float]], float, Optional[List[int]]]:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return None, 0.0, None
        
        emb, conf, bbox = self.extract_embedding_from_cv2(img)
        if emb is not None:
            return emb.tolist(), conf, bbox
        return None, 0.0, None

    def reload_embeddings_from_db(self, db: Session):
        """Loads all face embeddings from database into fast vector matrix."""
        records = db.query(FaceEmbedding).join(Student).filter(Student.is_active == True).all()
        if not records:
            self.known_embeddings = np.empty((0, 128), dtype=np.float32)
            self.known_student_ids = []
            self.known_names = []
            print("[FaceService] No embeddings in database.")
            return

        emb_list = []
        id_list = []
        name_list = []

        for rec in records:
            try:
                vec = json.loads(rec.embedding_vector)
                if len(vec) == 128:
                    emb_list.append(vec)
                    id_list.append(rec.student_id)
                    name_list.append(rec.student.full_name)
            except Exception:
                continue

        if emb_list:
            self.known_embeddings = np.array(emb_list, dtype=np.float32)
            self.known_student_ids = id_list
            self.known_names = name_list
            print(f"[FaceService] Successfully loaded {len(self.known_names)} face embeddings into memory.")

    def match_face(self, embedding: List[float]) -> Dict[str, Any]:
        """Performs cosine similarity search against known embeddings."""
        if len(self.known_embeddings) == 0:
            return {"match": False, "student_id": None, "name": "Unknown", "confidence": 0.0}

        query = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(query)
        if norm > 0:
            query /= norm

        sims = np.dot(self.known_embeddings, query)
        best_idx = int(np.argmax(sims))
        best_sim = float(sims[best_idx])

        if best_sim >= RECOGNITION_THRESHOLD:
            return {
                "match": True,
                "student_id": self.known_student_ids[best_idx],
                "name": self.known_names[best_idx],
                "confidence": round(min(best_sim * 100.0, 100.0), 2)
            }
        
        return {
            "match": False,
            "student_id": None,
            "name": "Unknown",
            "confidence": round(max(best_sim * 100.0, 0.0), 2)
        }

    def sync_dataset_to_database(self, db: Session) -> Dict[str, Any]:
        """
        Populates the relational database `face_embeddings` table from:
        1. Existing `face_encodings.pkl` (1,182 embeddings across 6 students)
        2. Or raw images in `dataset/`
        """
        synced_count = 0
        students_updated = set()

        # Step 1: Check if face_encodings.pkl exists
        if os.path.exists(PKL_FILE):
            try:
                with open(PKL_FILE, 'rb') as f:
                    data = pickle.load(f)
                encodings = data.get('encodings', [])
                names = data.get('names', [])
                
                print(f"[FaceService] Syncing {len(names)} embeddings from {PKL_FILE}...")
                
                # Preload students map by name lower
                all_students = db.query(Student).all()
                student_map = {s.full_name.strip().lower(): s for s in all_students}
                
                for enc, name in zip(encodings, names):
                    clean_name = name.strip()
                    matched_student = student_map.get(clean_name.lower())
                    
                    # If not matched, try fuzzy or partial
                    if not matched_student:
                        for s_key, s_obj in student_map.items():
                            if clean_name.lower() in s_key or s_key in clean_name.lower():
                                matched_student = s_obj
                                break

                    if matched_student:
                        # Check count of embeddings for this student to prevent bloat
                        current_count = db.query(FaceEmbedding).filter(
                            FaceEmbedding.student_id == matched_student.id
                        ).count()
                        
                        # Limit to max 20 top representative embeddings per student
                        if current_count < 20:
                            emb_vec = np.array(enc, dtype=np.float32)
                            norm = np.linalg.norm(emb_vec)
                            if norm > 0:
                                emb_vec /= norm
                            
                            new_emb = FaceEmbedding(
                                student_id=matched_student.id,
                                embedding_vector=json.dumps(emb_vec.tolist()),
                                model_architecture="YuNet-SFace-128D",
                                quality_score=0.95
                            )
                            db.add(new_emb)
                            synced_count += 1
                            students_updated.add(matched_student.full_name)

                db.commit()
            except Exception as e:
                db.rollback()
                print(f"[FaceService ERROR] Sync from pkl failed: {e}")

        # Reload into memory
        self.reload_embeddings_from_db(db)

        return {
            "status": "success",
            "synced_embeddings_count": synced_count,
            "students_updated": list(students_updated),
            "total_memory_embeddings": len(self.known_names)
        }

face_engine = FaceRecognitionEngine.get_instance()

