import os
import pandas as pd
from datetime import datetime
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.class_model import ClassModel
from app.models.student import Student, Parent
from app.models.attendance import AttendanceRecord, AttendanceStatus, VerificationMethod

SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STUDENT_DETAILS_FILE = os.path.join(SCRIPT_DIR, 'student_details.csv')
ATTENDANCE_FILE = os.path.join(SCRIPT_DIR, 'attendance.csv')

def run_seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    print("[1/4] Seeding Admin & Teacher User Accounts...")
    # Admin
    admin_user = db.query(User).filter(User.email == "admin@attendai.edu").first()
    if not admin_user:
        admin_user = User(
            email="admin@attendai.edu",
            hashed_password=get_password_hash("admin123"),
            full_name="Dr. Robert Vance (Director)",
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin_user)
        print("  -> Seeded Admin: admin@attendai.edu / admin123")

    # Teacher
    teacher_user = db.query(User).filter(User.email == "teacher@attendai.edu").first()
    if not teacher_user:
        teacher_user = User(
            email="teacher@attendai.edu",
            hashed_password=get_password_hash("teacher123"),
            full_name="Prof. Sarah Jenkins",
            role=UserRole.TEACHER,
            is_active=True
        )
        db.add(teacher_user)
        print("  -> Seeded Teacher: teacher@attendai.edu / teacher123")

    db.commit()

    print("[2/4] Seeding Default Academic Class Cohorts...")
    default_class = db.query(ClassModel).filter(ClassModel.name == "TE-CSE-A").first()
    if not default_class:
        default_class = ClassModel(
            name="TE-CSE-A",
            academic_year="TE",
            department="CSE",
            division="A"
        )
        db.add(default_class)
        db.commit()
        db.refresh(default_class)
        print("  -> Seeded Class: TE-CSE-A")

    print("[3/4] Seeding Enrolled Students from CSV...")
    if os.path.exists(STUDENT_DETAILS_FILE):
        df_students = pd.read_csv(STUDENT_DETAILS_FILE)
        for _, row in df_students.iterrows():
            prn = str(row['PRN']).strip()
            name = str(row['Name']).strip()
            email = str(row['Email']).strip() if pd.notna(row['Email']) else f"{prn}@student.attendai.edu"
            
            existing = db.query(Student).filter(Student.roll_number == prn).first()
            if not existing:
                student = Student(
                    roll_number=prn,
                    full_name=name,
                    email=email,
                    class_id=default_class.id
                )
                db.add(student)
                db.flush()

                # Add Parent Profile with default WhatsApp contact
                parent = Parent(
                    student_id=student.id,
                    full_name=f"Parent of {name}",
                    whatsapp_number="+919876543210",
                    email=f"parent.{prn}@example.com",
                    preferred_language="EN"
                )
                db.add(parent)
                print(f"  -> Seeded Student: {name} ({prn})")
        db.commit()

    print("[4/4] Seeding Attendance Logs from CSV...")
    if os.path.exists(ATTENDANCE_FILE):
        df_att = pd.read_csv(ATTENDANCE_FILE)
        student_cache = {s.full_name.lower(): s.id for s in db.query(Student).all()}
        
        seeded_logs = 0
        for _, row in df_att.iterrows():
            name = str(row['Name']).strip().lower()
            att_date = str(row['Date']).strip()
            att_time = str(row['Time']).strip()
            
            student_id = student_cache.get(name)
            if student_id:
                existing_record = db.query(AttendanceRecord).filter(
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.date == att_date
                ).first()
                if not existing_record:
                    record = AttendanceRecord(
                        student_id=student_id,
                        date=att_date,
                        time=att_time,
                        status=AttendanceStatus.PRESENT,
                        confidence_score=0.98,
                        verification_method=VerificationMethod.FACIAL_BIOMETRIC
                    )
                    db.add(record)
                    seeded_logs += 1
        db.commit()
        print(f"  -> Seeded {seeded_logs} verified attendance records.")

    db.close()
    print("\n✅ Seed completed successfully!")

if __name__ == "__main__":
    run_seed()

