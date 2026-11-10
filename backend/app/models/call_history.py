import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class CallStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    INITIATED = "INITIATED"
    RINGING = "RINGING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    NO_ANSWER = "NO_ANSWER"
    FAILED = "FAILED"
    DECLINED = "DECLINED"
    PERMISSION_EXPIRED = "PERMISSION_EXPIRED"

class CallHistory(Base):
    __tablename__ = "call_history"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("parents.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    call_date = Column(DateTime, default=datetime.utcnow)
    attempt_number = Column(Integer, default=1)
    status = Column(Enum(CallStatus), nullable=False)
    duration_seconds = Column(Integer, default=0)
    absence_reason_category = Column(String(100), nullable=True) # e.g. "Medical / Illness", "Family Function", "Personal"
    parent_response_snippet = Column(Text, nullable=True)        # Dialogue outcome summary, NO audio recording
    provider_call_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    parent = relationship("Parent", back_populates="calls")
    student = relationship("Student")

