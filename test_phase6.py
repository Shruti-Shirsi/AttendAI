import sys
import os
from datetime import date

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import SessionLocal
from app.services.absentee_service import absentee_service
from app.models.notification import Notification

def test_phase6():
    print("=== Testing Phase 6: Automatic Absentee Identification & Approval Queue ===")

    today_str = date.today().strftime("%Y-%m-%d")

    with SessionLocal() as db:
        # 1. Test Compilation of absentees for Class 1
        print("\n[1] Testing Absentee Compilation...")
        comp_res = absentee_service.compile_daily_absentees(today_str, 1, db)
        print(f" Compilation result: Total = {comp_res['total_enrolled']}, Present = {comp_res['present_count']}, Absent = {comp_res['absent_count']}, Newly Queued = {comp_res['newly_queued']}")
        assert comp_res["absent_count"] > 0, "Should detect at least 1 absentee"

        # 2. Test Multilingual Message Template Generation
        print("\n[2] Testing Multilingual Absentee Message Formatting...")
        msg_en = absentee_service.get_localized_message("Rahul", "2026105", today_str, "TE-CSE-A", "EN")
        msg_hi = absentee_service.get_localized_message("Rahul", "2026105", today_str, "TE-CSE-A", "HI")
        msg_mr = absentee_service.get_localized_message("Rahul", "2026105", today_str, "TE-CSE-A", "MR")
        print(" EN:", msg_en[:70], "...")
        print(" HI:", msg_hi[:70], "...")
        print(" MR:", msg_mr[:70], "...")
        assert "ABSENT" in msg_en
        assert "अनुपस्थित" in msg_hi
        assert "गैरहजर" in msg_mr
        print(" >>> Multilingual message formatting verified!")

        # 3. Test Queue Fetching
        print("\n[3] Testing Absentee Queue Retrieval...")
        queue = absentee_service.get_absentee_queue(today_str, 1, "ALL", db)
        print(f" Retrieved {len(queue)} items from queue.")
        assert len(queue) > 0
        first_item = queue[0]
        print(f" First item: Student = {first_item['full_name']}, WhatsApp = {first_item['whatsapp_number']}, Lang = {first_item['preferred_language']}, Status = {first_item['approval_status']}")

        # 4. Test Single Approval
        print("\n[4] Testing Teacher Approval of Absentee Notification...")
        app_res = absentee_service.approve_notification(first_item["notification_id"], teacher_id=1, db=db)
        print(f" Approval result: Notification #{app_res['notification_id']} -> {app_res['approval_status']}")
        assert app_res["approval_status"] == "APPROVED"

        # 5. Test Excuse Student Exemption
        if len(queue) > 1:
            second_item = queue[1]
            print("\n[5] Testing Student Exemption / Excused Absence...")
            exc_res = absentee_service.excuse_student(second_item["notification_id"], teacher_id=1, reason="Medical Checkup", db=db)
            print(" Exemption result:", exc_res["message"])
            assert exc_res["success"] == True

        # 6. Test Bulk Approval
        remaining_ids = [q["notification_id"] for q in queue if q["approval_status"] == "PENDING_APPROVAL"]
        if remaining_ids:
            print(f"\n[6] Testing Bulk Approval for {len(remaining_ids)} remaining absentees...")
            bulk_res = absentee_service.bulk_approve_notifications(remaining_ids, teacher_id=1, db=db)
            print(" Bulk approval count:", bulk_res["approved_count"])
            assert bulk_res["approved_count"] == len(remaining_ids)

    print("\n=== ALL PHASE 6 TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_phase6()

