from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class ClassModel(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False) # e.g. "TE-CSE-A"
    academic_year = Column(String(50), nullable=False)                 # "FE", "SE", "TE", "BE"
    department = Column(String(100), nullable=False)                  # "CSE", "AI&DS", "IT"
    division = Column(String(20), nullable=False)                     # "A", "B", "C"
    created_at = Column(DateTime, default=datetime.utcnow)

    students = relationship("Student", back_populates="class_cohort", cascade="all, delete-orphan")
    sessions = relationship("AttendanceSession", back_populates="class_cohort")

