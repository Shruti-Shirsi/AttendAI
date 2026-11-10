from pydantic import BaseModel
from typing import Optional

class ClassBase(BaseModel):
    name: str
    academic_year: str
    department: str
    division: str

class ClassCreate(ClassBase):
    pass

class ClassUpdate(BaseModel):
    name: Optional[str] = None
    academic_year: Optional[str] = None
    department: Optional[str] = None
    division: Optional[str] = None

class ClassResponse(ClassBase):
    id: int
    students_count: Optional[int] = 0

    class Config:
        from_attributes = True

