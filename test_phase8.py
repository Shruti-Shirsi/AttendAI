import sys
import os
from datetime import datetime, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import SessionLocal
from app.services.permission_service import permission_service, PermissionService
from app.models.call_permission import CallPermission, PermissionStatus
from app.models.student import Parent, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus

def test_phase8():
    print("=== Testing Phase 8: WhatsApp Calling Permission Management ===")

    with SessionLocal() as db:
        # Fetch first test parent
        parent = db.query(Parent).first()
        assert parent is not None, "At least one parent must exist in database"
        print(f"\n[1] Testing Calling Permission Request for Parent #{parent.id} ({parent.full_name})...")

        req_res = permission_service.request_calling_permission(parent.id, db)
        print(" Permission request response:", req_res)
        assert req_res["success"] is True
        assert req_res["status"] == "REQUESTED"
        assert req_res["whatsapp_message_id"].startswith("wamid.")
        print(" >>> Consent prompt successfully dispatched via WhatsApp!")

        # Verify DB state
        perm = db.query(CallPermission).filter(CallPermission.parent_id == parent.id).first()
        assert perm is not None
        assert perm.status == PermissionStatus.REQUESTED
        print(f" Database state verified: Status = {perm.status.value}, ReqAt = {perm.requested_at}")

        # 2. Testing Manual Teacher Authorization (24-Hour Scope)
        print(f"\n[2] Testing Manual Teacher 24-Hour Authorization...")
        grant_res = permission_service.grant_manual_permission(
            parent_id=parent.id,
            reason="Signed physical permission slip on institutional file",
            db=db
        )
        print(" Manual grant response:", grant_res)
        assert grant_res["success"] is True
        assert grant_res["status"] == "ALLOWED"
        assert "expires_at" in grant_res

        # Verify expires_at is approximately now + 24 hours
        db.refresh(perm)
        assert perm.status == PermissionStatus.ALLOWED
        diff = perm.expires_at - datetime.utcnow()
        hours_valid = diff.total_seconds() / 3600.0
        print(f" Permission validity remaining: {hours_valid:.2f} hours (Target ~ 24h)")
        assert 23.5 <= hours_valid <= 24.5
        print(" >>> 24-hour validity window verified!")

        # 3. Testing Permission Listing and Filtering
        print(f"\n[3] Testing Permission Listing & Countdown Calculation...")
        all_perms = permission_service.list_permissions(class_id=None, status_filter="ALL", db=db)
        print(f" Total guardians listed: {len(all_perms)}")
        assert len(all_perms) >= 1

        allowed_perms = permission_service.list_permissions(class_id=None, status_filter="ALLOWED", db=db)
        print(f" Allowed guardians listed: {len(allowed_perms)}")
        assert any(p["parent_id"] == parent.id for p in allowed_perms)

        target_item = next(p for p in allowed_perms if p["parent_id"] == parent.id)
        assert target_item["status"] == "ALLOWED"
        assert target_item["remaining_hours"] > 23.0
        print(f" Guardian #{parent.id} verified with {target_item['remaining_hours']}h countdown.")
        print(" >>> Listing & countdown calculations verified!")

        # 4. Testing 24-Hour Expiration Housekeeping
        print(f"\n[4] Testing Expiration Logic...")
        # Artificially age the permission to 25 hours ago
        perm.expires_at = datetime.utcnow() - timedelta(hours=1)
        db.commit()

        expired_count = PermissionService.cleanup_expired_permissions(db)
        print(f" Cleaned up {expired_count} expired permissions.")
        db.refresh(perm)
        assert perm.status == PermissionStatus.EXPIRED
        print(f" Successfully transitioned aged permission to EXPIRED: status = {perm.status.value}")

        # Re-grant for remaining tests
        permission_service.grant_manual_permission(parent.id, "Active consent for live testing", db)

        # 5. Testing Call-Eligible Absentees Query
        print(f"\n[5] Testing Call-Eligible Absentees Cross-Referencing...")
        today_str = datetime.now().strftime("%Y-%m-%d")

        # Ensure student has an ABSENT attendance record for today
        st = parent.student
        rec = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == st.id,
            AttendanceRecord.date == today_str
        ).first()
        if rec:
            rec.status = AttendanceStatus.ABSENT
        else:
            rec = AttendanceRecord(
                student_id=st.id,
                date=today_str,
                status=AttendanceStatus.ABSENT,
                source="TEST_SYSTEM"
            )
            db.add(rec)
        db.commit()

        eligible = permission_service.get_call_eligible_absentees(today_str, class_id=None, db=db)
        print(f" Found {len(eligible)} call-eligible absentees:")
        for el in eligible:
            print(f"  - {el['student_name']} (Roll: {el['roll_number']}), Guardian: {el['parent_name']} ({el['whatsapp_number']}), Remaining: {el['remaining_hours']}h")
        assert any(e["student_id"] == st.id for e in eligible)
        print(" >>> Call-eligible absentees verification succeeded!")

        # 6. Testing Permission Revocation (Setting WITHDRAWN)
        print(f"\n[6] Testing Permission Revocation...")
        revoke_res = permission_service.revoke_permission(parent.id, db)
        print(" Revoke response:", revoke_res)
        assert revoke_res["success"] is True
        assert revoke_res["status"] == "WITHDRAWN"

        db.refresh(perm)
        assert perm.status == PermissionStatus.WITHDRAWN
        assert perm.withdrawn_at is not None

        # Verify parent is NO LONGER call-eligible
        eligible_after_revoke = permission_service.get_call_eligible_absentees(today_str, class_id=None, db=db)
        assert not any(e["student_id"] == st.id for e in eligible_after_revoke)
        print(" >>> Revocation verified: student immediately excluded from eligible calling list!")

        # 7. Testing Permission Statistics
        print(f"\n[7] Testing KPI Statistics Summary...")
        # Grant another student's parent permission so stats have allowed count > 0
        parents = db.query(Parent).all()
        if len(parents) > 1:
            permission_service.grant_manual_permission(parents[1].id, "Testing active consent", db)

        stats = permission_service.get_permission_stats(db)
        print(" Live permission stats:", stats)
        assert stats["total_parents"] > 0
        assert "allowed" in stats
        assert "compliance_rate" in stats
        print(f" Compliance rate: {stats['compliance_rate']}%")
        print(" >>> Statistics engine verified!")

        print("\n=======================================================")
        print(" PHASE 8: ALL CALLING PERMISSION TESTS PASSED CLEANLY! ")
        print("=======================================================")

if __name__ == "__main__":
    test_phase8()

