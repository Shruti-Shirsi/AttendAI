from typing import List, Optional, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import require_teacher_or_admin
from app.services.whatsapp_service import whatsapp_service
from app.models.notification import Notification, NotificationStatus
from app.models.student import Student, Parent

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Communication"])

@router.post("/dispatch-approved")
def dispatch_approved_notifications(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Dispatches all teacher-approved absentee notifications to parents
    via Meta WhatsApp Business Platform.
    """
    result = whatsapp_service.dispatch_all_approved_notifications(db)
    return result

@router.post("/send-single/{notification_id}")
def send_single_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Sends an individual approved WhatsApp notification immediately.
    """
    try:
        return whatsapp_service.send_single_notification(notification_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ── Meta Webhook Verification (Handshake) ──
@router.get("/webhook")
def meta_webhook_verification(
    request: Request,
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    """
    Verifies Meta WhatsApp Webhook URL challenge during initial setup.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Webhook verification token mismatch.")

# ── Meta Inbound Webhook Event Listener ──
@router.post("/webhook")
async def meta_webhook_events(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Receives delivery receipts (SENT, DELIVERED, READ) and parent button clicks
    from Meta WhatsApp Business Platform.
    """
    try:
        payload = await request.json()
        result = whatsapp_service.handle_inbound_webhook(payload, db)
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ── Notifications History Feed ──
@router.get("/notifications")
def get_notification_history(
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="DELIVERED, SENT, READ, FAILED, ALL"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns communications history feed with parent details and delivery states.
    """
    query = db.query(Notification).join(Student)
    if date:
        query = query.filter(Notification.session_date == date)
    if status and status != "ALL":
        query = query.filter(Notification.status == status)

    records = query.order_by(Notification.id.desc()).limit(100).all()
    results = []

    for n in records:
        st = n.student
        pr = n.parent
        results.append({
            "id": n.id,
            "student_id": st.id if st else None,
            "student_name": st.full_name if st else "Student",
            "roll_number": st.roll_number if st else "",
            "class_name": st.class_cohort.name if (st and st.class_cohort) else "N/A",
            "parent_name": pr.full_name if pr else "Guardian",
            "whatsapp_number": n.recipient_phone,
            "recipient_phone": n.recipient_phone,
            "message_content": n.message_content,
            "message_preview": n.message_content,
            "language": n.language,
            "status": n.status.value,
            "approval_status": n.approval_status,
            "external_provider_id": n.external_provider_id,
            "session_date": n.session_date,
            "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            "created_at": n.created_at.isoformat() if n.created_at else None
        })

    return results

# ── WhatsApp Communication KPI Stats ──
@router.get("/stats")
def get_whatsapp_stats(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Calculates overall delivery rate, read rate, and dispatch statistics.
    """
    total = db.query(Notification).count()
    delivered = db.query(Notification).filter(
        Notification.status.in_([NotificationStatus.DELIVERED, NotificationStatus.READ])
    ).count()
    read_count = db.query(Notification).filter(Notification.status == NotificationStatus.READ).count()
    failed = db.query(Notification).filter(Notification.status == NotificationStatus.FAILED).count()
    approved_waiting = db.query(Notification).filter(
        Notification.approval_status == "APPROVED",
        Notification.status == NotificationStatus.PENDING
    ).count()

    delivery_rate = round((delivered / total * 100), 1) if total > 0 else 0.0
    read_rate = round((read_count / delivered * 100), 1) if delivered > 0 else 0.0

    return {
        "total_dispatched": total,
        "delivered_count": delivered,
        "read_count": read_count,
        "failed_count": failed,
        "approved_waiting_dispatch": approved_waiting,
        "delivery_rate_percentage": delivery_rate,
        "read_rate_percentage": read_rate
    }

