import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import SessionLocal
from app.services.register_service import register_service
from app.models.attendance import AttendanceRecord

def test_phase5():
    print("=== Testing Phase 5: Monthly Digital Class Register ===")

    with SessionLocal() as db:
        # 1. Test November 2026 register matrix
        print("\n[1] Testing Monthly Register Matrix Generation (Nov 2026)...")
        reg_nov = register_service.get_monthly_register(class_id=1, year=2026, month=11, db=db)
        print(f" Class: {reg_nov['class_name']}, Days in month: {reg_nov['days_in_month']}, Students: {reg_nov['total_students']}")
        assert reg_nov['days_in_month'] == 30
        assert len(reg_nov['students']) >= 8
        
        # Verify Sundays are marked W
        sun_days = [d['day'] for d in reg_nov['days_metadata'] if d['is_weekend']]
        print(f" Weekend days (Sundays): {sun_days}")
        assert len(sun_days) == 5  # Nov 2026 has 5 Sundays (1, 8, 15, 22, 29)

        first_st = reg_nov['students'][0]
        print(f" First student [{first_st['roll_number']}] {first_st['full_name']}: Attended = {first_st['total_present']}, Pct = {first_st['attendance_percentage']}%, Shortage = {first_st['is_shortage']}")
        for d in sun_days:
            assert first_st['days'][d] == 'W', f"Day {d} must be marked W (Weekend)"
        print(" >>> Matrix generation & weekend detection verified!")

        # 2. Test Teacher Manual Attendance Override
        print("\n[2] Testing Teacher Manual Attendance Override...")
        target_date = "2026-11-04"
        override_res = register_service.override_attendance(
            student_id=first_st['student_id'],
            date_str=target_date,
            new_status="EXCUSED",
            reason="Authorized inter-college symposium participation",
            db=db
        )
        print(f" Override saved: Record #{override_res.id}, Status: {override_res.status.value}, Method: {override_res.verification_method.value}")
        assert override_res.status.value == "EXCUSED"
        assert override_res.verification_method.value == "MANUAL_OVERRIDE"

        # Re-fetch matrix and verify cell is now 'E'
        updated_reg = register_service.get_monthly_register(class_id=1, year=2026, month=11, db=db)
        updated_st = [s for s in updated_reg['students'] if s['student_id'] == first_st['student_id']][0]
        assert updated_st['days'][4] == 'E', "Day 4 must now reflect E (Excused) status"
        print(" >>> Manual override verified in register matrix!")

    print("\n=== ALL PHASE 5 TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_phase5()

