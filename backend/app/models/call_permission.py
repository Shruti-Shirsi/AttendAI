import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class PermissionStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    ALLOWED = "ALLOWED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"
    WITHDRAWN = "WITHDRAWN"

class CallPermission(Base):
    __tablename__ = "call_permissions"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("parents.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    status = Column(Enum(PermissionStatus), default=PermissionStatus.REQUESTED, nullable=False)
    requested_at = Column(DateTime, default=datetime.utcnow)
    granted_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True) # Valid for 24 hours per AttendAI policy
    withdrawn_at = Column(DateTime, nullable=True)
    provider_reference = Column(String(255), nullable=True)

    parent = relationship("Parent", back_populates="permissions")
    student = relationship("Student")

