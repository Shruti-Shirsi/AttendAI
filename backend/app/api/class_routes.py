from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import require_teacher_or_admin, require_admin
from app.models.class_model import ClassModel
from app.models.student import Student
from app.schemas.class_schema import ClassCreate, ClassUpdate, ClassResponse

router = APIRouter(prefix="/classes", tags=["Classes"])

@router.get("/", response_model=List[ClassResponse])
def list_classes(
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    classes = db.query(ClassModel).order_by(ClassModel.name).all()
    results = []
    for c in classes:
        cnt = db.query(Student).filter(Student.class_id == c.id, Student.is_active == True).count()
        results.append(ClassResponse(
            id=c.id,
            name=c.name,
            academic_year=c.academic_year,
            department=c.department,
            division=c.division,
            students_count=cnt
        ))
    return results

@router.post("/", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    class_in: ClassCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    if db.query(ClassModel).filter(ClassModel.name == class_in.name).first():
        raise HTTPException(status_code=400, detail="Class with this name already exists.")
    new_class = ClassModel(
        name=class_in.name,
        academic_year=class_in.academic_year,
        department=class_in.department,
        division=class_in.division
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return ClassResponse(
        id=new_class.id,
        name=new_class.name,
        academic_year=new_class.academic_year,
        department=new_class.department,
        division=new_class.division,
        students_count=0
    )

@router.put("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: int,
    class_in: ClassUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_teacher_or_admin)
):
    cls = db.query(ClassModel).filter(ClassModel.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found.")

    if class_in.name and class_in.name != cls.name:
        existing = db.query(ClassModel).filter(ClassModel.name == class_in.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Class with this name already exists.")
        cls.name = class_in.name

    if class_in.academic_year is not None:
        cls.academic_year = class_in.academic_year
    if class_in.department is not None:
        cls.department = class_in.department
    if class_in.division is not None:
        cls.division = class_in.division

    db.commit()
    db.refresh(cls)

    cnt = db.query(Student).filter(Student.class_id == cls.id, Student.is_active == True).count()
    return ClassResponse(
        id=cls.id,
        name=cls.name,
        academic_year=cls.academic_year,
        department=cls.department,
        division=cls.division,
        students_count=cnt
    )

@router.delete("/{class_id}", status_code=status.HTTP_200_OK)
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    cls = db.query(ClassModel).filter(ClassModel.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found.")

    # Check active students
    active_count = db.query(Student).filter(Student.class_id == class_id, Student.is_active == True).count()
    if active_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete class: {active_count} students are currently assigned to this cohort."
        )

    db.delete(cls)
    db.commit()
    return {"success": True, "message": f"Class '{cls.name}' deleted successfully."}
