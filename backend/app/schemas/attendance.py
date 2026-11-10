from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.models.attendance import AttendanceStatus, VerificationMethod, SessionStatus

class AttendanceRecordCreate(BaseModel):
    student_id: int
    session_id: Optional[int] = None
    date: str
    time: str
    status: AttendanceStatus = AttendanceStatus.PRESENT
    confidence_score: float = 1.0
    verification_method: VerificationMethod = VerificationMethod.FACIAL_BIOMETRIC

class AttendanceRecordResponse(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    date: str
    time: str
    status: AttendanceStatus
    confidence_score: float
    verification_method: VerificationMethod

    class Config:
        from_attributes = True

class AttendanceSessionCreate(BaseModel):
    class_id: int
    subject: Optional[str] = "General Attendance"

class AttendanceSessionResponse(BaseModel):
    id: int
    class_id: int
    class_name: Optional[str] = None
    subject: str
    session_date: str
    status: SessionStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    total_students: int = 0
    present_count: int = 0
    absent_count: int = 0

    class Config:
        from_attributes = True

class AbsenteeSummary(BaseModel):
    student_id: int
    roll_number: str
    full_name: str
    parent_name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    preferred_language: str = "EN"

class FinalizeSessionResponse(BaseModel):
    session_id: int
    class_name: str
    subject: str
    session_date: str
    status: str
    total_enrolled: int
    present_count: int
    absent_count: int
    attendance_rate: float
    absentees: List[AbsenteeSummary]
    message: str
