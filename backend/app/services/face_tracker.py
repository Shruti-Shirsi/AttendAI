import math
from typing import List, Dict, Optional, Tuple, Any

def compute_iou(boxA: List[int], boxB: List[int]) -> float:
    # box format: [x, y, w, h]
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
    yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])

    interW = max(0, xB - xA)
    interH = max(0, yB - yA)
    interArea = interW * interH

    boxAArea = boxA[2] * boxA[3]
    boxBArea = boxB[2] * boxB[3]
    unionArea = float(boxAArea + boxBArea - interArea)

    if unionArea <= 0:
        return 0.0
    return interArea / unionArea

class TrackedFace:
    def __init__(self, track_id: int, bbox: List[int], student_id: Optional[int], name: str, confidence: float):
        self.track_id = track_id
        self.bbox = bbox  # [x, y, w, h]
        self.student_id = student_id
        self.name = name
        self.confidence = confidence
        self.hits = 1
        self.misses = 0
        self.history_names: Dict[str, int] = {name: 1}
        self.max_confidence = confidence

    @property
    def center(self) -> Tuple[float, float]:
        return (self.bbox[0] + self.bbox[2] / 2.0, self.bbox[1] + self.bbox[3] / 2.0)

    def update(self, bbox: List[int], student_id: Optional[int], name: str, confidence: float):
        self.bbox = bbox
        self.hits += 1
        self.misses = 0
        self.confidence = confidence
        if confidence > self.max_confidence:
            self.max_confidence = confidence

        # Update identity voting
        self.history_names[name] = self.history_names.get(name, 0) + 1
        # Identity is the most frequently recognized known name
        known_candidates = {k: v for k, v in self.history_names.items() if k != "UNKNOWN"}
        if known_candidates:
            best_known = max(known_candidates.items(), key=lambda item: item[1])
            self.name = best_known[0]
            if student_id is not None:
                self.student_id = student_id
        else:
            self.name = "UNKNOWN"

    def mark_missed(self):
        self.misses += 1

class FaceTracker:
    def __init__(self, max_misses: int = 15, iou_threshold: float = 0.25):
        self.max_misses = max_misses
        self.iou_threshold = iou_threshold
        self.next_track_id = 1
        self.tracks: Dict[int, TrackedFace] = {}

    def update(self, detections: List[Dict[str, Any]]) -> List[TrackedFace]:
        """
        detections: List of dicts with:
          - 'bbox': [x, y, w, h]
          - 'student_id': Optional[int]
          - 'name': str
          - 'confidence': float
        """
        if not detections:
            # All existing tracks missed
            for track in list(self.tracks.values()):
                track.mark_missed()
                if track.misses > self.max_misses:
                    del self.tracks[track.track_id]
            return list(self.tracks.values())

        if not self.tracks:
            # Register all as new tracks
            for det in detections:
                tid = self.next_track_id
                self.next_track_id += 1
                self.tracks[tid] = TrackedFace(
                    tid, det['bbox'], det.get('student_id'), det['name'], det['confidence']
                )
            return list(self.tracks.values())

        # Associate existing tracks with detections via IoU matching
        track_ids = list(self.tracks.keys())
        matched_tracks = set()
        matched_dets = set()

        # Compute IoU matrix
        iou_pairs = []
        for t_idx, tid in enumerate(track_ids):
            track = self.tracks[tid]
            for d_idx, det in enumerate(detections):
                iou = compute_iou(track.bbox, det['bbox'])
                if iou >= self.iou_threshold:
                    iou_pairs.append((iou, tid, d_idx))

        # Sort pairs by highest IoU first
        iou_pairs.sort(key=lambda x: x[0], reverse=True)

        for iou, tid, d_idx in iou_pairs:
            if tid in matched_tracks or d_idx in matched_dets:
                continue
            det = detections[d_idx]
            self.tracks[tid].update(
                det['bbox'], det.get('student_id'), det['name'], det['confidence']
            )
            matched_tracks.add(tid)
            matched_dets.add(d_idx)

        # Unmatched tracks count as missed
        for tid in track_ids:
            if tid not in matched_tracks:
                self.tracks[tid].mark_missed()
                if self.tracks[tid].misses > self.max_misses:
                    del self.tracks[tid]

        # Unmatched detections become new tracks
        for d_idx, det in enumerate(detections):
            if d_idx not in matched_dets:
                tid = self.next_track_id
                self.next_track_id += 1
                self.tracks[tid] = TrackedFace(
                    tid, det['bbox'], det.get('student_id'), det['name'], det['confidence']
                )

        return list(self.tracks.values())

