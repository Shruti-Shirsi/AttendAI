from typing import Optional, List
from pydantic import BaseModel

class ParentBase(BaseModel):
    full_name: str
    whatsapp_number: str
    email: Optional[str] = None
    preferred_language: str = "EN"

class ParentResponse(ParentBase):
    id: int

    class Config:
        from_attributes = True

class StudentBase(BaseModel):
    roll_number: str
    full_name: str
    email: str
    class_id: int
    photo_url: Optional[str] = None

class StudentCreate(StudentBase):
    parent: ParentBase

class StudentUpdate(BaseModel):
    roll_number: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    class_id: Optional[int] = None
    photo_url: Optional[str] = None
    is_active: Optional[bool] = None
    parent_name: Optional[str] = None
    parent_whatsapp: Optional[str] = None
    parent_language: Optional[str] = None

class StudentResponse(StudentBase):
    id: int
    is_active: bool
    class_name: Optional[str] = None
    is_enrolled: bool = False
    embeddings_count: int = 0
    parent: Optional[ParentResponse] = None

    class Config:
        from_attributes = True

class FaceEnrollImage(BaseModel):
    angle: Optional[str] = "front" # front, left, right, up, down
    image_base64: str              # data:image/jpeg;base64,... or raw base64

class StudentEnrollRequest(BaseModel):
    images: List[FaceEnrollImage]

class EnrollmentResponse(BaseModel):
    student_id: int
    student_name: str
    processed_count: int
    enrolled_count: int
    embeddings_total: int
    message: str
