import sys
import os
from datetime import date

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import SessionLocal
from app.models.attendance import AttendanceRecord, AttendanceSession, SessionStatus
from app.models.student import Student
from app.services.attendance_engine import attendance_engine

def test_phase4():
    print("=== Testing Phase 4: Automatic Attendance Engine ===")

    today_str = date.today().strftime("%Y-%m-%d")

    with SessionLocal() as db:
        # Get a test student
        student = db.query(Student).filter(Student.is_active == True).first()
        assert student is not None, "Need at least 1 active student"
        sid = student.id
        sname = student.full_name
        print(f"Testing with student: [{student.roll_number}] {sname} (ID: {sid})")

        # 1. Clean previous record for this student today to ensure clean test
        db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == sid,
            AttendanceRecord.date == today_str
        ).delete()
        db.commit()

        if sid in attendance_engine.stamped_today:
            attendance_engine.stamped_today.remove(sid)
        attendance_engine.consecutive_hits[sid] = 0

        # 2. Test Consecutive-Frame Verification (K=5)
        print("\n[1] Testing Consecutive-Frame Verification (Frames 1 to 4)...")
        for f in range(1, 5):
            res = attendance_engine.process_recognition_event(sid, 92.5, sname)
            print(f" Frame {f}: Status = {res['status']}, Hits = {res['consecutive_frames']}")
            assert res["status"] == "VERIFYING", f"Frame {f} should be VERIFYING"
            assert not res["verified"], "Should not be verified before 5 frames"

        # Frame 5: Should trigger automatic stamping!
        print("\n[2] Testing Frame 5 (Auto-Stamping Trigger)...")
        res5 = attendance_engine.process_recognition_event(sid, 94.0, sname)
        print(f" Frame 5: Status = {res5['status']}, Verified = {res5['verified']}")
        assert res5["status"] == "STAMPED_PRESENT"
        assert res5["verified"] == True

        # Verify record exists in DB
        rec = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == sid,
            AttendanceRecord.date == today_str
        ).first()
        assert rec is not None, "Record must be saved in database"
        print(f" >>> Record verified in DB: ID #{rec.id}, Time: {rec.time}, Status: {rec.status.value}")

        # Frame 6: Test Duplicate Prevention
        print("\n[3] Testing Duplicate Prevention (Frame 6)...")
        res6 = attendance_engine.process_recognition_event(sid, 95.0, sname)
        print(f" Frame 6: Status = {res6['status']}, Verified = {res6['verified']}")
        assert res6["status"] == "ALREADY_PRESENT"

        records_count = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == sid,
            AttendanceRecord.date == today_str
        ).count()
        assert records_count == 1, "Must enforce strictly 1 record per student per day"
        print(" >>> Duplicate prevention verified! Exactly 1 record per student per day.")

        # 3. Test Session Lifecycle (Start -> Active -> Finalize)
        print("\n[4] Testing Attendance Session Lifecycle...")
        new_sess = attendance_engine.start_new_session(
            class_id=student.class_id,
            subject="Algorithms & Neural Vision",
            user_id=1,
            db=db
        )
        print(f" Started session #{new_sess.id} for class #{new_sess.class_id}: {new_sess.subject}")
        assert new_sess.status == SessionStatus.ACTIVE

        # Finalize Session
        print("\n[5] Finalizing Session & Calculating Absentees...")
        summary = attendance_engine.finalize_session(session_id=new_sess.id, db=db)
        print(f" Session Summary: Total = {summary['total_enrolled']}, Present = {summary['present_count']}, Absent = {summary['absent_count']}")
        print(f" Absentees identified for WhatsApp queue: {len(summary['absentees'])}")
        assert summary["status"] == "FINALIZED"
        assert summary["total_enrolled"] == summary["present_count"] + summary["absent_count"]
        print(" >>> Session lifecycle & absentee compiler verified!")

    print("\n=== ALL PHASE 4 TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_phase4()

