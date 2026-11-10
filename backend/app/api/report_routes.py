from typing import List, Optional, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_teacher_or_admin
from app.services.report_service import report_service

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/summary")
def get_institutional_summary(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns high-level institutional attendance and parent communication KPIs.
    """
    return report_service.get_institutional_summary(db=db)

@router.get("/trends")
def get_attendance_trends(
    days: int = Query(14, ge=7, le=90, description="Number of past days (e.g. 7, 14, 30)"),
    class_id: Optional[int] = Query(None, description="Optional class filter"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns daily attendance trends with present/absent counts and compliance percentages.
    """
    return report_service.get_attendance_trends(days=days, class_id=class_id, db=db)

@router.get("/absence-reasons")
def get_absence_reasons(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns aggregated absence reason distribution captured via AI Voice Assistant.
    """
    return report_service.get_absence_reasons_breakdown(db=db)

@router.get("/students")
def get_students_breakdown(
    class_id: Optional[int] = Query(None, description="Optional class filter"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns per-student cumulative attendance records, shortage flags, and guardian contact info.
    """
    return report_service.get_student_breakdown(class_id=class_id, db=db)

@router.get("/export-csv")
def export_institutional_csv(
    class_id: Optional[int] = Query(None, description="Optional class filter"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Exports full institutional attendance register and communication audit as a CSV spreadsheet.
    """
    csv_content = report_service.export_csv(class_id=class_id, db=db)
    filename = f"attendai_institutional_report_{date.today().isoformat()}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
