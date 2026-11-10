import base64
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_teacher_or_admin, require_admin
from app.models.student import Student, Parent
from app.models.face_embedding import FaceEmbedding
from app.schemas.student import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    StudentEnrollRequest,
    EnrollmentResponse
)
from app.services.face_service import face_engine

router = APIRouter(prefix="/students", tags=["Students"])

@router.get("/", response_model=List[StudentResponse])
def list_students(
    search: Optional[str] = Query(None, description="Search by name or roll number"),
    class_id: Optional[int] = Query(None, description="Filter by class ID"),
    enrolled_only: Optional[bool] = Query(None, description="Filter by enrollment status"),
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    query = db.query(Student).filter(Student.is_active == True)
    if class_id:
        query = query.filter(Student.class_id == class_id)
    if search:
        s_term = f"%{search}%"
        query = query.filter((Student.full_name.ilike(s_term)) | (Student.roll_number.ilike(s_term)))
    
    students = query.order_by(Student.roll_number.asc()).all()
    if enrolled_only is not None:
        if enrolled_only:
            students = [s for s in students if s.is_enrolled]
        else:
            students = [s for s in students if not s.is_enrolled]
            
    return students

@router.post("/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    student_in: StudentCreate,
    db: Session = Depends(get_db),
    current_admin = Depends(require_admin)
):
    # Verify unique roll number / email
    if db.query(Student).filter(Student.roll_number == student_in.roll_number).first():
        raise HTTPException(status_code=400, detail="Student with this Roll Number/PRN already exists.")
    if db.query(Student).filter(Student.email == student_in.email).first():
        raise HTTPException(status_code=400, detail="Student with this email already exists.")

    new_student = Student(
        roll_number=student_in.roll_number,
        full_name=student_in.full_name,
        email=student_in.email,
        class_id=student_in.class_id,
        photo_url=student_in.photo_url
    )
    db.add(new_student)
    db.flush()

    new_parent = Parent(
        student_id=new_student.id,
        full_name=student_in.parent.full_name,
        whatsapp_number=student_in.parent.whatsapp_number,
        email=student_in.parent.email,
        preferred_language=student_in.parent.preferred_language
    )
    db.add(new_parent)
    db.commit()
    db.refresh(new_student)
    return new_student

@router.get("/{student_id}", response_model=StudentResponse)
def get_student_by_id(
    student_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return student

@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    student_in: StudentUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if student_in.roll_number is not None and student_in.roll_number != student.roll_number:
        existing = db.query(Student).filter(Student.roll_number == student_in.roll_number).first()
        if existing:
            raise HTTPException(status_code=400, detail="Student with this Roll Number/PRN already exists.")
        student.roll_number = student_in.roll_number

    if student_in.full_name is not None:
        student.full_name = student_in.full_name
    if student_in.email is not None:
        student.email = student_in.email
    if student_in.class_id is not None:
        student.class_id = student_in.class_id
    if student_in.photo_url is not None:
        student.photo_url = student_in.photo_url
    if student_in.is_active is not None:
        student.is_active = student_in.is_active

    if student.parent:
        if student_in.parent_name is not None:
            student.parent.full_name = student_in.parent_name
        if student_in.parent_whatsapp is not None:
            student.parent.whatsapp_number = student_in.parent_whatsapp
        if student_in.parent_language is not None:
            student.parent.preferred_language = student_in.parent_language
    else:
        if student_in.parent_name or student_in.parent_whatsapp:
            new_parent = Parent(
                student_id=student.id,
                full_name=student_in.parent_name or "Parent",
                whatsapp_number=student_in.parent_whatsapp or "",
                preferred_language=student_in.parent_language or "EN"
            )
            db.add(new_parent)

    db.commit()
    db.refresh(student)
    return student

@router.delete("/{student_id}", status_code=status.HTTP_200_OK)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_admin = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    
    student.is_active = False # Safe soft-delete
    db.commit()
    return {"message": f"Student {student.full_name} deactivated successfully."}

@router.post("/{student_id}/enroll-faces", response_model=EnrollmentResponse)
def enroll_student_faces(
    student_id: int,
    enroll_data: StudentEnrollRequest,
    db: Session = Depends(get_db),
    current_admin = Depends(require_admin)
):
    student = db.query(Student).filter(Student.id == student_id, Student.is_active == True).first()
    if not student:
        raise HTTPException(status_code=404, detail="Active student not found.")

    processed = 0
    enrolled = 0

    for img_item in enroll_data.images:
        processed += 1
        try:
            b64_str = img_item.image_base64
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            raw_bytes = base64.b64decode(b64_str)
            emb, conf, bbox = face_engine.extract_embedding_from_bytes(raw_bytes)
            
            if emb is not None:
                new_face_embedding = FaceEmbedding(
                    student_id=student.id,
                    embedding_vector=json.dumps(emb),
                    model_architecture=f"YuNet-SFace-{img_item.angle or 'front'}",
                    quality_score=conf
                )
                db.add(new_face_embedding)
                enrolled += 1
        except Exception as e:
            print(f"[Enrollment Warning] Failed to process angle {img_item.angle}: {e}")

    db.commit()
    db.refresh(student)

    # Refresh in-memory embeddings for live recognition
    face_engine.reload_embeddings_from_db(db)

    return EnrollmentResponse(
        student_id=student.id,
        student_name=student.full_name,
        processed_count=processed,
        enrolled_count=enrolled,
        embeddings_total=student.embeddings_count,
        message=f"Successfully enrolled {enrolled} face angle(s) for {student.full_name}."
    )

@router.post("/sync-dataset", status_code=status.HTTP_200_OK)
def sync_dataset_to_database(
    db: Session = Depends(get_db),
    current_admin = Depends(require_admin)
):
    """Syncs existing dataset encodings (1,182 photos across 6 students) to PostgreSQL/SQLite."""
    result = face_engine.sync_dataset_to_database(db)
    return result
