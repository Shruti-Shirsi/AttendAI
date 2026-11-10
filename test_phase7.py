import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import SessionLocal
from app.services.whatsapp_service import whatsapp_service
from app.models.notification import Notification, NotificationStatus
from app.models.call_permission import CallPermission, PermissionStatus
from app.models.student import Parent

def test_phase7():
    print("=== Testing Phase 7: WhatsApp Parent Notification System ===")

    with SessionLocal() as db:
        # 1. Test Single WhatsApp Message Dispatch
        print("\n[1] Testing WhatsApp Message Gateway...")
        send_res = whatsapp_service.send_whatsapp_message(
            to_phone="+919876543210",
            message_text="AttendAI Alert: Student marked absent.",
            student_name="Akhila",
            roll_number="202601",
            date_str="2026-11-10",
            language="EN"
        )
        print(" Gateway dispatch response:", send_res)
        assert send_res["success"] == True
        assert send_res["message_id"].startswith("wamid.")
        print(" >>> WhatsApp gateway dispatch verified!")

        # 2. Test Dispatch of All Approved Notifications from Database
        print("\n[2] Testing Bulk Dispatch of Approved Absentee Queue...")
        # Reset at least 2 notifications to APPROVED and PENDING for test repeatability
        db.query(Notification).filter(Notification.id.in_([1, 2])).update({
            "approval_status": "APPROVED",
            "status": NotificationStatus.PENDING
        }, synchronize_session=False)
        db.commit()

        dispatch_res = whatsapp_service.dispatch_all_approved_notifications(db)
        print(" Dispatch metrics:", dispatch_res)
        assert dispatch_res["dispatched_count"] > 0, "Should dispatch approved notifications"

        # Check DB state
        dispatched_in_db = db.query(Notification).filter(
            Notification.approval_status == "DISPATCHED"
        ).count()
        print(f" Total dispatched records in database: {dispatched_in_db}")
        assert dispatched_in_db > 0

        sample_notif = db.query(Notification).filter(
            Notification.approval_status == "DISPATCHED"
        ).first()
        print(f" Sample dispatched record #{sample_notif.id}: Status = {sample_notif.status.value}, WAMID = {sample_notif.external_provider_id}, Sent At = {sample_notif.sent_at}")
        assert sample_notif.status in (NotificationStatus.DELIVERED, NotificationStatus.SENT)
        assert sample_notif.external_provider_id is not None
        print(" >>> Bulk WhatsApp dispatch and DB state transitions verified!")

        # 3. Test Inbound Meta Webhook Status Receipts & Parent Interactive Button Clicks
        print("\n[3] Testing Inbound Webhook Receipts (Read Receipt)...")
        wamid_test = sample_notif.external_provider_id
        webhook_read_payload = {
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "statuses": [
                                    {
                                        "id": wamid_test,
                                        "status": "read",
                                        "timestamp": "1731245000"
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }
        res_read = whatsapp_service.handle_inbound_webhook(webhook_read_payload, db)
        print(" Webhook read response:", res_read)
        db.refresh(sample_notif)
        assert sample_notif.status == NotificationStatus.READ, "Status must transition to READ on webhook receipt"
        print(" >>> Read receipt webhook verified! Notification marked READ.")

        # 4. Test Inbound Parent Interactive Button Click: 'btn_allow_call'
        print("\n[4] Testing Parent Interactive Button Reply ('Allow Voice Call')...")
        parent = db.query(Parent).first()
        assert parent is not None
        parent_phone = parent.whatsapp_number.replace("+", "").replace(" ", "")

        webhook_button_payload = {
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "messages": [
                                    {
                                        "from": parent_phone,
                                        "id": "wamid.TEST_REPLY_123",
                                        "type": "interactive",
                                        "interactive": {
                                            "type": "button_reply",
                                            "button_reply": {
                                                "id": "btn_allow_call",
                                                "title": "Allow Voice Call"
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        }
        res_btn = whatsapp_service.handle_inbound_webhook(webhook_button_payload, db)
        print(" Webhook button response:", res_btn)
        assert res_btn["call_permissions_granted"] == 1

        # Verify CallPermission created in DB
        perm = db.query(CallPermission).filter(CallPermission.parent_id == parent.id).first()
        assert perm is not None
        assert perm.status == PermissionStatus.ALLOWED
        print(f" >>> Calling permission verified in DB: Parent #{parent.id} -> {perm.status.value} (Expires: {perm.expires_at})")

    print("\n=== ALL PHASE 7 TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_phase7()
