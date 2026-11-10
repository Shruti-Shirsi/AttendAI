from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String(100), unique=True, index=True, nullable=False) # e.g. "202604" or PRN
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    photo_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    class_cohort = relationship("ClassModel", back_populates="students")
    parent = relationship("Parent", back_populates="student", uselist=False, cascade="all, delete-orphan")
    embeddings = relationship("FaceEmbedding", back_populates="student", cascade="all, delete-orphan")
    attendance_records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")

    @property
    def is_enrolled(self) -> bool:
        return len(self.embeddings) > 0 if self.embeddings else False

    @property
    def embeddings_count(self) -> int:
        return len(self.embeddings) if self.embeddings else 0

    @property
    def class_name(self) -> str:
        return self.class_cohort.name if self.class_cohort else ""

class Parent(Base):
    __tablename__ = "parents"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    whatsapp_number = Column(String(50), index=True, nullable=False)
    email = Column(String(255), nullable=True)
    preferred_language = Column(String(10), default="EN") # "EN", "HI", "MR"
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="parent")
    permissions = relationship("CallPermission", back_populates="parent", cascade="all, delete-orphan")
    calls = relationship("CallHistory", back_populates="parent", cascade="all, delete-orphan")
