import os
import time
from datetime import datetime, date
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.attendance import (
    AttendanceSession,
    AttendanceRecord,
    AttendanceStatus,
    VerificationMethod,
    SessionStatus
)
from app.models.student import Student
from app.models.class_model import ClassModel

CSV_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "attendance.csv"
)

REQUIRED_CONSECUTIVE_FRAMES = 5
CONFIDENCE_THRESHOLD = 35.0

class AttendanceEngine:
    _instance = None

    def __init__(self):
        self.consecutive_hits: Dict[int, int] = {}       # student_id -> count of consecutive frames
        self.last_seen_time: Dict[int, float] = {}        # student_id -> last timestamp seen
        self.stamped_today: set = set()                   # set of student_ids stamped today
        self.active_session_id: Optional[int] = None
        self._init_daily_cache()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = AttendanceEngine()
        return cls._instance

    def _init_daily_cache(self):
        """Pre-loads today's existing attendance records into the daily stamped cache."""
        try:
            today_str = date.today().strftime("%Y-%m-%d")
            with SessionLocal() as db:
                records = db.query(AttendanceRecord.student_id).filter(
                    AttendanceRecord.date == today_str
                ).all()
                self.stamped_today = {r[0] for r in records}
                print(f"[AttendanceEngine] Loaded {len(self.stamped_today)} students already stamped for {today_str}.")

                # Find any active session
                active = db.query(AttendanceSession).filter(
                    AttendanceSession.status == SessionStatus.ACTIVE,
                    AttendanceSession.session_date == today_str
                ).order_by(AttendanceSession.id.desc()).first()
                if active:
                    self.active_session_id = active.id
                    print(f"[AttendanceEngine] Found active session #{active.id} for class #{active.class_id}.")
        except Exception as e:
            print(f"[AttendanceEngine Warning] Could not init daily cache: {e}")

    def process_recognition_event(self, student_id: int, confidence: float, student_name: str) -> Dict[str, Any]:
        """
        Processes recognition result for a student in a frame:
        - Tracks consecutive frames
        - When threshold reached (5 frames), automatically stamps attendance!
        """
        now = time.time()
        self.last_seen_time[student_id] = now

        # If already stamped today, return instantly
        if student_id in self.stamped_today:
            return {
                "student_id": student_id,
                "name": student_name,
                "status": "ALREADY_PRESENT",
                "consecutive_frames": REQUIRED_CONSECUTIVE_FRAMES,
                "verified": True
            }

        # Check confidence criteria
        if confidence >= CONFIDENCE_THRESHOLD:
            current_hits = self.consecutive_hits.get(student_id, 0) + 1
            self.consecutive_hits[student_id] = current_hits
        else:
            # Low confidence resets counter
            self.consecutive_hits[student_id] = 0
            current_hits = 0

        # Check if verified across K consecutive frames
        if current_hits >= REQUIRED_CONSECUTIVE_FRAMES:
            stamp_res = self._stamp_attendance(student_id, confidence, student_name)
            return {
                "student_id": student_id,
                "name": student_name,
                "status": "STAMPED_PRESENT",
                "consecutive_frames": current_hits,
                "verified": True,
                "details": stamp_res
            }

        return {
            "student_id": student_id,
            "name": student_name,
            "status": "VERIFYING",
            "consecutive_frames": current_hits,
            "required_frames": REQUIRED_CONSECUTIVE_FRAMES,
            "verified": False
        }

    def cleanup_unseen_students(self):
        """Resets consecutive hits for students who have walked out of the camera view (>1.5s)."""
        now = time.time()
        for sid, last_t in list(self.last_seen_time.items()):
            if now - last_t > 1.5:
                self.consecutive_hits[sid] = 0

    def _stamp_attendance(self, student_id: int, confidence: float, student_name: str) -> Dict[str, Any]:
        """Atomically inserts attendance record into Database and CSV mirror."""
        today_str = date.today().strftime("%Y-%m-%d")
        now_time_str = datetime.now().strftime("%H:%M:%S")

        with SessionLocal() as db:
            # Re-check unique constraint
            existing = db.query(AttendanceRecord).filter(
                AttendanceRecord.student_id == student_id,
                AttendanceRecord.date == today_str
            ).first()

            if existing:
                self.stamped_today.add(student_id)
                return {"success": True, "already_existed": True, "record_id": existing.id}

            # If no active session, auto-link to or create default session
            session_id = self.active_session_id
            if not session_id:
                student = db.query(Student).filter(Student.id == student_id).first()
                class_id = student.class_id if student else 1
                default_session = AttendanceSession(
                    class_id=class_id,
                    session_date=today_str,
                    subject="General Attendance",
                    status=SessionStatus.ACTIVE
                )
                db.add(default_session)
                db.flush()
                session_id = default_session.id
                self.active_session_id = session_id

            new_record = AttendanceRecord(
                student_id=student_id,
                session_id=session_id,
                date=today_str,
                time=now_time_str,
                status=AttendanceStatus.PRESENT,
                confidence_score=round(confidence, 1),
                verification_method=VerificationMethod.FACIAL_BIOMETRIC
            )
            db.add(new_record)
            db.commit()
            db.refresh(new_record)

            self.stamped_today.add(student_id)

        # Mirror to CSV file for legacy tool compatibility
        self._write_csv_record(student_name, today_str, now_time_str)

        print(f"[AttendanceEngine] ✓ Confirmed attendance: {student_name} (ID: {student_id}) at {now_time_str} (Conf: {confidence:.1f}%)")
        return {"success": True, "record_id": new_record.id, "time": now_time_str}

    def _write_csv_record(self, name: str, cur_date: str, cur_time: str):
        try:
            # Check if file has header
            has_header = False
            if os.path.exists(CSV_FILE):
                with open(CSV_FILE, 'r') as f:
                    first_line = f.readline()
                    if 'Name' in first_line or 'name' in first_line:
                        has_header = True

            with open(CSV_FILE, 'a') as f:
                if not has_header and os.path.getsize(CSV_FILE) == 0:
                    f.write('Name,Date,Time\n')
                f.write(f'{name},{cur_date},{cur_time}\n')
        except Exception as e:
            print(f"[AttendanceEngine CSV Warning] Failed to mirror to CSV: {e}")

    def start_new_session(self, class_id: int, subject: str, user_id: Optional[int], db: Session) -> AttendanceSession:
        today_str = date.today().strftime("%Y-%m-%d")

        # Finalize any previously active session for this class
        prev_sessions = db.query(AttendanceSession).filter(
            AttendanceSession.class_id == class_id,
            AttendanceSession.status == SessionStatus.ACTIVE
        ).all()
        for ps in prev_sessions:
            ps.status = SessionStatus.FINALIZED
            ps.end_time = datetime.utcnow()

        new_sess = AttendanceSession(
            class_id=class_id,
            session_date=today_str,
            subject=subject,
            status=SessionStatus.ACTIVE,
            created_by_user_id=user_id
        )
        db.add(new_sess)
        db.commit()
        db.refresh(new_sess)

        self.active_session_id = new_sess.id
        return new_sess

    def finalize_session(self, session_id: int, db: Session) -> Dict[str, Any]:
        session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
        if not session:
            raise ValueError("Session not found")

        session.status = SessionStatus.FINALIZED
        session.end_time = datetime.utcnow()
        db.commit()

        if self.active_session_id == session_id:
            self.active_session_id = None

        # Fetch class cohort students
        all_students = db.query(Student).filter(
            Student.class_id == session.class_id,
            Student.is_active == True
        ).all()

        # Present student IDs in this date
        present_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.date == session.session_date,
            AttendanceRecord.status == AttendanceStatus.PRESENT
        ).all()
        present_sids = {r.student_id for r in present_records}

        absentees = []
        for s in all_students:
            if s.id not in present_sids:
                absentees.append({
                    "student_id": s.id,
                    "roll_number": s.roll_number,
                    "full_name": s.full_name,
                    "parent_name": s.parent.full_name if s.parent else None,
                    "whatsapp_number": s.parent.whatsapp_number if s.parent else None,
                    "preferred_language": s.parent.preferred_language if s.parent else "EN"
                })

        total = len(all_students)
        present_count = total - len(absentees)
        rate = round((present_count / total * 100), 1) if total > 0 else 0.0

        return {
            "session_id": session.id,
            "class_name": session.class_cohort.name if session.class_cohort else f"Class #{session.class_id}",
            "subject": session.subject or "General Attendance",
            "session_date": session.session_date,
            "status": "FINALIZED",
            "total_enrolled": total,
            "present_count": present_count,
            "absent_count": len(absentees),
            "attendance_rate": rate,
            "absentees": absentees,
            "message": f"Session finalized successfully. {len(absentees)} absentee(s) identified."
        }

attendance_engine = AttendanceEngine.get_instance()

