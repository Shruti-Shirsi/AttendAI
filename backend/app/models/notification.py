import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("parents.id"), nullable=False, index=True)
    session_date = Column(String(20), index=True, nullable=True) # "YYYY-MM-DD"
    message_type = Column(String(50), default="ABSENCE_NOTIFICATION")
    channel = Column(String(20), default="WHATSAPP")
    recipient_phone = Column(String(50), nullable=False)
    message_content = Column(Text, nullable=False)
    language = Column(String(10), default="EN") # "EN", "HI", "MR"
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING)
    approval_status = Column(String(30), default="PENDING_APPROVAL") # "PENDING_APPROVAL", "APPROVED", "REJECTED", "DISPATCHED"
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    external_provider_id = Column(String(255), nullable=True)
    retry_count = Column(Integer, default=0)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")
    parent = relationship("Parent")
