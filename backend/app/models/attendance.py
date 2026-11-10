import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    EXCUSED = "EXCUSED"
    PENDING = "PENDING"

class VerificationMethod(str, enum.Enum):
    FACIAL_BIOMETRIC = "FACIAL_BIOMETRIC"
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"

class SessionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    FINALIZED = "FINALIZED"

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    session_date = Column(String(20), index=True, nullable=False) # "YYYY-MM-DD"
    subject = Column(String(100), default="General Attendance")
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.ACTIVE)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    class_cohort = relationship("ClassModel", back_populates="sessions")
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    date = Column(String(20), index=True, nullable=False) # "YYYY-MM-DD"
    time = Column(String(20), nullable=False)             # "HH:MM:SS"
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.PRESENT, nullable=False)
    confidence_score = Column(Float, default=1.0)
    verification_method = Column(Enum(VerificationMethod), default=VerificationMethod.FACIAL_BIOMETRIC)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="attendance_records")
    session = relationship("AttendanceSession", back_populates="records")

    __table_args__ = (
        UniqueConstraint('student_id', 'date', name='uq_student_daily_attendance'),
    )

