from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_teacher_or_admin
from app.services.voice_calling_service import voice_calling_service

router = APIRouter(prefix="/voice", tags=["AI Voice Calling Agent"])

class InitiateCallRequest(BaseModel):
    reason_category: Optional[str] = None
    expected_return_date: Optional[str] = None

class BatchCallRequest(BaseModel):
    student_ids: Optional[List[int]] = None

@router.get("/queue")
def get_voice_call_queue(
    date: Optional[str] = Query(None, description="YYYY-MM-DD (Defaults to today)"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns absentees queue with permission readiness and prior attempt counters.
    """
    return voice_calling_service.get_call_queue(db=db, target_date=date)

@router.get("/script/{student_id}")
def get_dialog_preview(
    student_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Previews the localized conversational AI script in parent's preferred language (EN, HI, MR).
    """
    from app.models.student import Student
    st = db.query(Student).filter(Student.id == student_id).first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found")
    parent = st.parent
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found for student")

    return voice_calling_service.get_dialog_script(
        student_name=st.full_name,
        parent_name=parent.full_name,
        language=parent.preferred_language or "EN"
    )

@router.post("/initiate/{student_id}")
def initiate_call(
    student_id: int,
    payload: Optional[InitiateCallRequest] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Triggers an AI-powered WhatsApp voice call to the parent.
    Strictly blocked if calling permission is missing, expired, declined, or revoked.
    """
    reason = payload.reason_category if payload else None
    ret_date = payload.expected_return_date if payload else None

    try:
        result = voice_calling_service.initiate_voice_call(
            student_id=student_id,
            reason_category=reason,
            expected_return_date=ret_date,
            db=db
        )
        return result
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice calling dispatch failed: {str(e)}")

@router.post("/batch-call")
def batch_initiate_calls(
    payload: BatchCallRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Initiates AI voice calls in batch for all specified or permitted absentees.
    """
    queue = voice_calling_service.get_call_queue(db=db)
    target_ids = payload.student_ids or [q["student_id"] for q in queue if q["is_permitted"]]

    success_calls = []
    skipped_calls = []

    for sid in target_ids:
        try:
            res = voice_calling_service.initiate_voice_call(student_id=sid, db=db)
            success_calls.append(res)
        except PermissionError as pe:
            skipped_calls.append({"student_id": sid, "reason": str(pe)})
        except Exception as e:
            skipped_calls.append({"student_id": sid, "reason": str(e)})

    return {
        "dispatched_count": len(success_calls),
        "skipped_count": len(skipped_calls),
        "dispatched": success_calls,
        "skipped": skipped_calls
    }

@router.get("/history")
def get_call_history(
    status: Optional[str] = Query(None, description="COMPLETED, NO_ANSWER, FAILED, ALL"),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns call logs and conversational outcome snippets.
    """
    return voice_calling_service.get_call_history(db=db, limit=limit, status_filter=status)

@router.get("/metrics")
def get_voice_metrics(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns live calling KPIs: Total Calls, Average Duration, and Absence Reason Distribution.
    """
    return voice_calling_service.get_voice_metrics(db=db)

@router.post("/webhook")
async def provider_voice_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Webhook receiver for voice calling provider event callbacks.
    """
    try:
        payload = await request.json()
        print(f"[VoiceWebhook] Received provider event: {payload}")
        return {"status": "received"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

