import sys
import os
from datetime import datetime, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import SessionLocal
from app.services.voice_calling_service import voice_calling_service
from app.services.permission_service import permission_service
from app.models.call_permission import CallPermission, PermissionStatus
from app.models.call_history import CallHistory, CallStatus
from app.models.student import Student, Parent
from app.models.attendance import AttendanceRecord, AttendanceStatus

def test_phase9():
    print("=== Testing Phase 9: Interactive AI Voice Calling Agent ===")

    with SessionLocal() as db:
        # Get students
        students = db.query(Student).all()
        assert len(students) >= 2, "Need at least 2 students for testing"
        st_unpermitted = students[0]
        st_permitted = students[1]

        today_str = datetime.now().strftime("%Y-%m-%d")

        # 1. Test Strict Permission Enforcement (Safety Gate)
        print(f"\n[1] Testing Permission Gate (Blocking Unpermitted Call)...")
        # Ensure st_unpermitted has NO active permission (revoke or expire it)
        perm1 = db.query(CallPermission).filter(CallPermission.student_id == st_unpermitted.id).first()
        if perm1:
            perm1.status = PermissionStatus.EXPIRED
            db.commit()

        blocked = False
        try:
            voice_calling_service.initiate_voice_call(student_id=st_unpermitted.id, db=db)
        except PermissionError as pe:
            blocked = True
            print(f" Correctly blocked with PermissionError: {pe}")

        assert blocked is True, "Voice calling service MUST reject calls without active 24h permission!"
        print(" >>> Permission safety gate verified: Unpermitted call was strictly blocked!")

        # 2. Grant Permission to second student and test successful voice call
        print(f"\n[2] Authorizing 24h Permission for Student #{st_permitted.id} ({st_permitted.full_name})...")
        parent2 = st_permitted.parent
        assert parent2 is not None

        permission_service.grant_manual_permission(
            parent_id=parent2.id,
            reason="Authorized consent for AI voice calling verification",
            db=db
        )

        # Set parent language to Hindi for testing multilingual capability
        parent2.preferred_language = "HI"
        db.commit()

        # 3. Test Multilingual Dialog Generation
        print("\n[3] Testing Multilingual Conversational Dialog Scripts (EN, HI, MR)...")
        for lang in ["EN", "HI", "MR"]:
            dialog = voice_calling_service.get_dialog_script(
                student_name=st_permitted.full_name,
                parent_name=parent2.full_name,
                language=lang,
                date_str=today_str
            )
            print(f" Dialog [{lang}]:")
            print(f"   Greeting: {dialog['greeting'][:50]}...")
            print(f"   Inquiry: {dialog['absence_inquiry'][:50]}...")
            print(f"   Sample Reasons: {dialog['sample_reasons']}")
            assert dialog["language"] == lang
            assert len(dialog["sample_reasons"]) > 0
        print(" >>> Multilingual dialog generation verified!")

        # 4. Test AI Voice Call Initiation & Progression
        print(f"\n[4] Initiating AI Voice Call for {st_permitted.full_name}...")
        call_res = voice_calling_service.initiate_voice_call(
            student_id=st_permitted.id,
            reason_category="स्वास्थ्य समस्या / बुखार",
            expected_return_date="2026-11-12",
            db=db
        )
        print(" Call dispatch outcome:", call_res)
        assert call_res["success"] is True
        assert call_res["status"] == "COMPLETED"
        assert call_res["duration_seconds"] > 0
        assert call_res["provider_call_id"].startswith("call_ai_")
        assert "स्वास्थ्य समस्या" in call_res["absence_reason_category"]
        print(" >>> AI voice call successfully placed and concluded!")

        # Verify database log in call_history
        logged_call = db.query(CallHistory).filter(CallHistory.id == call_res["call_id"]).first()
        assert logged_call is not None
        assert logged_call.status == CallStatus.COMPLETED
        assert logged_call.duration_seconds == call_res["duration_seconds"]
        assert logged_call.provider_call_id == call_res["provider_call_id"]
        print(f" Database record #{logged_call.id} confirmed: Duration = {logged_call.duration_seconds}s, Reason = {logged_call.absence_reason_category}")
        print(" >>> Call history persistence verified!")

        # 5. Test Outbound Call Queue Listing
        print("\n[5] Testing Absentee Call Queue...")
        # Ensure student is marked absent
        rec = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == st_permitted.id,
            AttendanceRecord.date == today_str
        ).first()
        if not rec:
            rec = AttendanceRecord(
                student_id=st_permitted.id,
                date=today_str,
                time=datetime.now().strftime("%H:%M:%S"),
                status=AttendanceStatus.ABSENT,
                verification_method="MANUAL_OVERRIDE"
            )
            db.add(rec)
            db.commit()

        queue = voice_calling_service.get_call_queue(db=db, target_date=today_str)
        print(f" Total absentees in queue: {len(queue)}")
        assert len(queue) > 0
        target_q = next((q for q in queue if q["student_id"] == st_permitted.id), None)
        assert target_q is not None
        assert target_q["is_permitted"] is True
        assert target_q["call_count_today"] >= 1
        print(f" Queue item verified: {target_q['student_name']} (Permitted = {target_q['is_permitted']}, Calls Today = {target_q['call_count_today']})")
        print(" >>> Call queue generation verified!")

        # 6. Test Call History Logs & Filtering
        print("\n[6] Testing Call History & Dialog Snippet Retrieval...")
        history = voice_calling_service.get_call_history(db=db, limit=10, status_filter="COMPLETED")
        assert len(history) > 0
        latest = history[0]
        print(f" Latest call log: ID={latest['provider_call_id']}, Student={latest['student_name']}, Reason={latest['absence_reason_category']}")
        print(f" Outcome snippet: {latest['parent_response_snippet']}")
        assert latest["student_id"] == st_permitted.id
        print(" >>> Call history retrieval verified!")

        # 7. Test Voice Calling Metrics
        print("\n[7] Testing Voice Analytics & KPIs...")
        metrics = voice_calling_service.get_voice_metrics(db=db)
        print(" Live metrics:", metrics)
        assert metrics["total_calls_today"] >= 1
        assert metrics["completed_calls"] >= 1
        assert metrics["average_duration_seconds"] > 0
        assert len(metrics["top_reasons"]) > 0
        print(f" Average call duration: {metrics['average_duration_seconds']}s")
        print(" >>> Voice analytics KPI engine verified!")

        print("\n=======================================================")
        print(" PHASE 9: ALL AI VOICE CALLING TESTS PASSED CLEANLY!  ")
        print("=======================================================")

if __name__ == "__main__":
    test_phase9()
