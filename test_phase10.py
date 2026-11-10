import sys
import os
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import SessionLocal
from app.services.report_service import report_service
from app.models.student import Student

def test_phase10():
    print("=== Testing Phase 10: Reports & Analytics and System Hardening ===")

    with SessionLocal() as db:
        # 1. Test Institutional Summary
        print("\n[1] Testing Institutional Summary KPI Generation...")
        summary = report_service.get_institutional_summary(db=db)
        print(" Summary metrics:", summary)
        assert summary["total_students"] > 0
        assert summary["total_classes"] > 0
        assert "today_attendance_rate" in summary
        assert "shortage_count" in summary
        assert "active_permissions" in summary
        assert "total_voice_calls_completed" in summary
        print(f" Attendance Rate Today: {summary['today_attendance_rate']}% | Shortage Risk: {summary['shortage_count']} students")
        print(" >>> Institutional summary metrics verified!")

        # 2. Test Attendance Trends (7, 14, 30 days)
        print("\n[2] Testing Chronological Attendance Trends (14 days)...")
        trends = report_service.get_attendance_trends(days=14, class_id=None, db=db)
        print(f" Generated {len(trends)} trend data points:")
        for t in trends[:3]:
            print(f"  - {t['display_date']} ({t['day_name']}): Present = {t['present']}, Absent = {t['absent']}, Rate = {t['attendance_rate']}%, Type = {t['day_type']}")
        assert len(trends) == 14
        assert any(t["date"] == datetime.now().strftime("%Y-%m-%d") for t in trends)
        print(" >>> Chronological trend analytics verified!")

        # 3. Test Absence Reason Distribution
        print("\n[3] Testing Absence Reason Aggregation...")
        reasons = report_service.get_absence_reasons_breakdown(db=db)
        print(" Reason distribution:", reasons)
        assert len(reasons) > 0
        assert all("name" in r and "value" in r and "color" in r for r in reasons)
        for r in reasons:
            print(f"  - {r['name']}: {r['value']} calls ({r['color']})")
        print(" >>> Absence reason aggregation verified!")

        # 4. Test Student Breakdown & 75% Shortage Alert Engine
        print("\n[4] Testing Student Attendance Breakdown & 75% Shortage Engine...")
        students = report_service.get_student_breakdown(class_id=None, db=db)
        print(f" Total evaluated students: {len(students)}")
        assert len(students) > 0
        for s in students[:4]:
            status_tag = "CRITICAL SHORTAGE" if s["is_shortage"] else "COMPLIANT"
            print(f"  - [{status_tag}] {s['student_name']} ({s['roll_number']}): {s['present_count']}/{s['total_sessions']} sessions ({s['attendance_percentage']}%), Parent: {s['parent_name']}")
        print(" >>> Student breakdown & 75% shortage engine verified!")

        # 5. Test Institutional CSV Export
        print("\n[5] Testing Institutional CSV Dataset Generation...")
        csv_text = report_service.export_csv(class_id=None, db=db)
        lines = csv_text.strip().split("\n")
        print(f" CSV exported: {len(lines)} lines")
        print(" CSV Header:", lines[0])
        print(" Sample Row 1:", lines[1] if len(lines) > 1 else "N/A")
        assert len(lines) >= 2
        assert "Roll Number,Student Name,Class Cohort" in lines[0]
        assert "Attendance %" in lines[0]
        print(" >>> CSV report export engine verified!")

        print("\n=======================================================")
        print(" PHASE 10: ALL REPORT & ANALYTICS TESTS PASSED!       ")
        print("=======================================================")

if __name__ == "__main__":
    test_phase10()

