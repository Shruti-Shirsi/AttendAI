from typing import List, Optional, Dict, Any
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_teacher_or_admin
from app.services.permission_service import permission_service

router = APIRouter(prefix="/permissions", tags=["Calling Permission Management"])

class GrantPermissionRequest(BaseModel):
    reason: Optional[str] = "Manual teacher verification / Written consent"

@router.get("/")
def list_permissions(
    class_id: Optional[int] = Query(None, description="Filter by class cohort"),
    status: Optional[str] = Query(None, description="ALLOWED, REQUESTED, DECLINED, EXPIRED, WITHDRAWN, ALL"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    List all parent calling permissions with 24-hr countdown and expiration status.
    """
    return permission_service.list_permissions(class_id=class_id, status_filter=status, db=db)

@router.get("/stats")
def get_permission_statistics(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns high-level KPI counts for calling consent and compliance.
    """
    return permission_service.get_permission_stats(db=db)

@router.get("/eligible")
def list_call_eligible_absentees(
    date_str: Optional[str] = Query(None, alias="date", description="YYYY-MM-DD (Defaults to today)"),
    class_id: Optional[int] = Query(None, description="Filter by class cohort"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Cross-references daily absentees with active 24-hour ALLOWED parent permissions.
    """
    target_date = date_str or date.today().isoformat()
    return permission_service.get_call_eligible_absentees(date_str=target_date, class_id=class_id, db=db)

@router.post("/request/{parent_id}")
def request_permission(
    parent_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Dispatches an interactive WhatsApp calling consent prompt to the parent.
    """
    try:
        return permission_service.request_calling_permission(parent_id=parent_id, db=db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/grant/{parent_id}")
def grant_manual_permission(
    parent_id: int,
    payload: GrantPermissionRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Authorizes 24-hour calling permission manually based on physical/verbal parent consent.
    """
    try:
        return permission_service.grant_manual_permission(
            parent_id=parent_id,
            reason=payload.reason or "Authorized by Teacher",
            db=db
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/revoke/{parent_id}")
def revoke_permission(
    parent_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Revokes parent calling permission immediately (sets status to WITHDRAWN).
    """
    try:
        return permission_service.revoke_permission(parent_id=parent_id, db=db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

