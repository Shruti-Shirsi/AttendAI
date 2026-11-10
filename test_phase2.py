import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from app.core.database import SessionLocal
from app.models.student import Student
from app.models.face_embedding import FaceEmbedding
from app.services.face_service import face_engine

def test_phase2():
    print("=== Testing Phase 2: Student Management & Face Enrollment ===")
    with SessionLocal() as db:
        students = db.query(Student).all()
        print(f"Total students currently in DB: {len(students)}")
        for s in students:
            print(f" - [{s.roll_number}] {s.full_name} | Class: {s.class_cohort.name if s.class_cohort else 'N/A'} | Enrolled: {s.is_enrolled} ({s.embeddings_count} vectors)")

        print("\n--> Running sync_dataset_to_database()...")
        res = face_engine.sync_dataset_to_database(db)
        print("Sync result:", res)

        print("\n--> Verifying updated students in DB:")
        updated_students = db.query(Student).all()
        for s in updated_students:
            print(f" - [{s.roll_number}] {s.full_name} | Enrolled: {s.is_enrolled} ({s.embeddings_count} vectors) | Parent: {s.parent.full_name if s.parent else 'N/A'} ({s.parent.preferred_language if s.parent else ''})")

        total_embeddings = db.query(FaceEmbedding).count()
        print(f"\nTotal face embeddings now persisted in DB: {total_embeddings}")
        assert total_embeddings > 0, "No embeddings persisted!"
        print("\n=== PHASE 2 BACKEND TEST PASSED! ===")

if __name__ == "__main__":
    test_phase2()

