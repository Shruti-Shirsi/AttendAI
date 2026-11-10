from typing import List, Optional, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_teacher_or_admin
from app.services.absentee_service import absentee_service
from app.models.notification import Notification

router = APIRouter(prefix="/absentees", tags=["Absentee Queue"])

class CompileAbsenteesRequest(BaseModel):
    class_id: int
    date: Optional[str] = None

class BulkApproveRequest(BaseModel):
    notification_ids: List[int]

class ExcuseRequest(BaseModel):
    reason: Optional[str] = "Authorized Leave / Medical"

@router.post("/compile")
def compile_absentees(
    payload: CompileAbsenteesRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Scans the class attendance for the date and compiles any unnotified
    absent students into the teacher review and approval queue.
    """
    target_date = payload.date or date.today().strftime("%Y-%m-%d")
    result = absentee_service.compile_daily_absentees(
        date_str=target_date,
        class_id=payload.class_id,
        db=db
    )
    return result

@router.get("/queue")
def get_absentee_queue(
    date: Optional[str] = Query(None, description="Filter by date YYYY-MM-DD"),
    class_id: Optional[int] = Query(None, description="Filter by class ID"),
    approval_status: Optional[str] = Query(None, description="PENDING_APPROVAL, APPROVED, DISPATCHED, ALL"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Lists students in the absentee approval queue awaiting teacher sign-off.
    """
    return absentee_service.get_absentee_queue(
        date_str=date,
        class_id=class_id,
        approval_status=approval_status,
        db=db
    )

@router.post("/approve/{notification_id}")
def approve_absentee_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Approves a single absentee notification for parent WhatsApp dispatch.
    """
    try:
        return absentee_service.approve_notification(
            notification_id=notification_id,
            teacher_id=current_user.id,
            db=db
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/bulk-approve")
def bulk_approve_absentee_notifications(
    payload: BulkApproveRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Approves multiple selected absentee notifications in one click.
    """
    return absentee_service.bulk_approve_notifications(
        notification_ids=payload.notification_ids,
        teacher_id=current_user.id,
        db=db
    )

@router.post("/excuse/{notification_id}")
def excuse_absentee_student(
    notification_id: int,
    payload: ExcuseRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Excuses a student's absence, removes them from the notification queue,
    and updates their daily status in the digital register to EXCUSED.
    """
    try:
        return absentee_service.excuse_student(
            notification_id=notification_id,
            teacher_id=current_user.id,
            reason=payload.reason or "Excused",
            db=db
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/stats")
def get_absentee_queue_stats(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns summary counters of the absentee approval queue.
    """
    today_str = date.today().strftime("%Y-%m-%d")
    total_today = db.query(Notification).filter(
        Notification.session_date == today_str,
        Notification.message_type == "ABSENCE_NOTIFICATION"
    ).count()

    pending_approval = db.query(Notification).filter(
        Notification.session_date == today_str,
        Notification.approval_status == "PENDING_APPROVAL"
    ).count()

    approved_ready = db.query(Notification).filter(
        Notification.session_date == today_str,
        Notification.approval_status == "APPROVED"
    ).count()

    dispatched = db.query(Notification).filter(
        Notification.session_date == today_str,
        Notification.approval_status == "DISPATCHED"
    ).count()

    return {
        "today": today_str,
        "total_absentees_today": total_today,
        "pending_approval": pending_approval,
        "approved_ready": approved_ready,
        "dispatched": dispatched
    }

