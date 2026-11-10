import asyncio
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_teacher_or_admin
from app.models.attendance import (
    AttendanceRecord,
    AttendanceStatus,
    VerificationMethod,
    AttendanceSession,
    SessionStatus
)
from app.models.student import Student
from app.models.class_model import ClassModel
from app.schemas.attendance import (
    AttendanceRecordCreate,
    AttendanceRecordResponse,
    AttendanceSessionCreate,
    AttendanceSessionResponse,
    FinalizeSessionResponse
)
from app.services.camera_service import camera_service
from app.services.attendance_engine import attendance_engine
from app.services.register_service import register_service
import io
import csv

router = APIRouter(prefix="/attendance", tags=["Attendance"])

class FrameProcessRequest(BaseModel):
    image_base64: str

# ── Live Video Stream (MJPEG) ──
@router.get("/video-feed")
def get_live_video_feed():
    """
    Streams the live annotated video feed with multi-face detection,
    spatial tracking IDs, student recognition labels, and HUD overlays.
    Renderable directly in HTML: <img src="/api/v1/attendance/video-feed" />
    """
    return StreamingResponse(
        camera_service.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# ── Process Single Frame (Browser Webcam Support) ──
@router.post("/process-frame")
def process_client_frame(payload: FrameProcessRequest):
    """
    Processes a frame captured from the client's browser webcam.
    Returns real-time face bounding boxes, track IDs, names, and confidences.
    """
    result = camera_service.process_browser_frame(payload.image_base64)
    return result

# ── Camera Hardware Status ──
@router.get("/camera-status")
def get_camera_status():
    """Returns the operational status of the computer vision camera pipeline."""
    return {
        "is_running": camera_service.is_running,
        "camera_index": camera_service.camera_index,
        "fps": round(camera_service.fps, 1),
        "recent_detections_count": len(camera_service.recent_detections)
    }

# ── Real-Time Detections Feed ──
@router.get("/recent-detections")
def get_recent_detections():
    """Returns the latest verified student detection events."""
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "detections": camera_service.recent_detections
    }

# ── Real-Time WebSocket Channel ──
@router.websocket("/ws/live")
async def websocket_live_attendance(websocket: WebSocket):
    """
    Bi-directional WebSocket for real-time live attendance telemetry:
    - Streams real-time detection events and FPS.
    - Accepts client browser webcam frames for low-latency processing.
    """
    await websocket.accept()
    try:
        while True:
            try:
                msg_text = await asyncio.wait_for(websocket.receive_text(), timeout=0.8)
                data = json.loads(msg_text)
                if data.get("type") == "frame" and "image_base64" in data:
                    res = camera_service.process_browser_frame(data["image_base64"])
                    await websocket.send_text(json.dumps({
                        "type": "detection_result",
                        "data": res
                    }))
                    continue
            except asyncio.TimeoutError:
                pass
            except json.JSONDecodeError:
                pass

            # Broadcast continuous heartbeat & recent detections
            telemetry = {
                "type": "telemetry",
                "fps": round(camera_service.fps, 1),
                "is_running": camera_service.is_running,
                "recent_detections": camera_service.recent_detections[:10],
                "timestamp": datetime.utcnow().isoformat()
            }
            await websocket.send_text(json.dumps(telemetry))
            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        print("[WebSocket] Client disconnected from /ws/live.")
    except Exception as e:
        print(f"[WebSocket ERROR] {e}")

# ── Attendance Session Management ──
@router.post("/sessions/start", response_model=AttendanceSessionResponse)
def start_attendance_session(
    session_in: AttendanceSessionCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """Starts a live biometric attendance session for a class cohort."""
    cohort = db.query(ClassModel).filter(ClassModel.id == session_in.class_id).first()
    if not cohort:
        raise HTTPException(status_code=404, detail="Class not found.")

    sess = attendance_engine.start_new_session(
        class_id=session_in.class_id,
        subject=session_in.subject or "General Attendance",
        user_id=current_user.id,
        db=db
    )
    
    total = len(cohort.students)
    today_str = date.today().strftime("%Y-%m-%d")
    present = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == sess.id,
        AttendanceRecord.date == today_str
    ).count()

    return AttendanceSessionResponse(
        id=sess.id,
        class_id=sess.class_id,
        class_name=cohort.name,
        subject=sess.subject,
        session_date=sess.session_date,
        status=sess.status,
        start_time=sess.start_time,
        end_time=sess.end_time,
        total_students=total,
        present_count=present,
        absent_count=max(0, total - present)
    )

@router.get("/sessions/active", response_model=Optional[AttendanceSessionResponse])
def get_active_attendance_session(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """Retrieves the currently running attendance session."""
    today_str = date.today().strftime("%Y-%m-%d")
    sess = db.query(AttendanceSession).filter(
        AttendanceSession.status == SessionStatus.ACTIVE,
        AttendanceSession.session_date == today_str
    ).order_by(AttendanceSession.id.desc()).first()

    if not sess:
        return None

    cohort = sess.class_cohort
    total = len(cohort.students) if cohort else 0
    present = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == sess.id,
        AttendanceRecord.date == today_str
    ).count()

    return AttendanceSessionResponse(
        id=sess.id,
        class_id=sess.class_id,
        class_name=cohort.name if cohort else f"Class #{sess.class_id}",
        subject=sess.subject or "General Attendance",
        session_date=sess.session_date,
        status=sess.status,
        start_time=sess.start_time,
        end_time=sess.end_time,
        total_students=total,
        present_count=present,
        absent_count=max(0, total - present)
    )

@router.post("/sessions/{session_id}/finalize", response_model=FinalizeSessionResponse)
def finalize_attendance_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Finalizes an attendance session:
    - Locks the attendance records
    - Automatically identifies absentees for parent WhatsApp notification queue
    """
    try:
        summary = attendance_engine.finalize_session(session_id=session_id, db=db)
        return summary
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ── Mark Attendance Record ──
@router.post("/mark", response_model=AttendanceRecordResponse)
def mark_attendance(
    record_in: AttendanceRecordCreate,
    db: Session = Depends(get_db)
):
    """
    Records verified attendance for a student.
    Enforces 1 record per student per day policy.
    """
    student = db.query(Student).filter(Student.id == record_in.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == record_in.student_id,
        AttendanceRecord.date == record_in.date
    ).first()

    if existing:
        return existing

    new_record = AttendanceRecord(
        student_id=record_in.student_id,
        session_id=record_in.session_id,
        date=record_in.date,
        time=record_in.time,
        status=record_in.status,
        confidence_score=record_in.confidence_score,
        verification_method=record_in.verification_method
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

# ── Today's Attendance Overview ──
@router.get("/today")
def get_today_attendance(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """Returns today's real-time attendance roll call."""
    today_str = date.today().strftime("%Y-%m-%d")
    records = db.query(AttendanceRecord).filter(AttendanceRecord.date == today_str).all()
    
    total_students = db.query(Student).filter(Student.is_active == True).count()
    present_count = len(records)
    absent_count = max(0, total_students - present_count)
    percentage = round((present_count / total_students * 100), 1) if total_students > 0 else 0.0

    return {
        "date": today_str,
        "total_enrolled": total_students,
        "present_today": present_count,
        "absent_today": absent_count,
        "attendance_percentage": percentage,
        "records": [
            {
                "id": r.id,
                "student_id": r.student_id,
                "student_name": r.student.full_name,
                "roll_number": r.student.roll_number,
                "time": r.time,
                "status": r.status.value,
                "confidence": r.confidence_score,
                "verification_method": r.verification_method.value
            }
            for r in records
        ]
    }

class AttendanceOverrideRequest(BaseModel):
    student_id: int
    date: str
    status: str
    reason: Optional[str] = "Teacher Manual Adjustment"

# ── Monthly Digital Register ──
@router.get("/register/monthly")
def get_monthly_attendance_register(
    class_id: int = Query(1, description="Class ID"),
    year: int = Query(2026, description="Year"),
    month: int = Query(11, description="Month (1-12)"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Returns the comprehensive Students x Days monthly register matrix
    with working day calculations, weekend tags, and 75% shortage detection.
    """
    matrix = register_service.get_monthly_register(class_id=class_id, year=year, month=month, db=db)
    return matrix

@router.put("/register/override")
def override_student_attendance(
    payload: AttendanceOverrideRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Allows instructors to manually override/correct a student's daily attendance.
    """
    try:
        rec = register_service.override_attendance(
            student_id=payload.student_id,
            date_str=payload.date,
            new_status=payload.status,
            reason=payload.reason,
            db=db
        )
        return {
            "success": True,
            "record_id": rec.id,
            "status": rec.status.value,
            "verification_method": rec.verification_method.value,
            "message": f"Attendance for student #{payload.student_id} updated to {payload.status}."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/register/export-csv")
def export_monthly_register_csv(
    class_id: int = Query(1),
    year: int = Query(2026),
    month: int = Query(11),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    """
    Generates and downloads a formatted CSV spreadsheet of the monthly class register.
    """
    matrix = register_service.get_monthly_register(class_id=class_id, year=year, month=month, db=db)
    num_days = matrix["days_in_month"]
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header: Roll No, Name, Day 1..N, Present, Absent, Attendance %
    header = ["Roll No", "Student Name"] + [f"D{d}" for d in range(1, num_days + 1)] + ["Total Present", "Total Absent", "Attendance %", "Shortage Warning"]
    writer.writerow(header)
    
    for s in matrix["students"]:
        row = [s["roll_number"], s["full_name"]]
        for d in range(1, num_days + 1):
            row.append(s["days"].get(d, "-"))
        row.append(s["total_present"])
        row.append(s["total_absent"])
        row.append(f"{s['attendance_percentage']}%")
        row.append("SHORTAGE (<75%)" if s["is_shortage"] else "OK")
        writer.writerow(row)
        
    output.seek(0)
    filename = f"Attendance_Register_{matrix['class_name']}_{matrix['month_name']}_{year}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

