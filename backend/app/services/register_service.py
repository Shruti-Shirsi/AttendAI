import calendar
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.models.attendance import AttendanceRecord, AttendanceStatus, VerificationMethod
from app.models.student import Student
from app.models.class_model import ClassModel

class RegisterService:
    @staticmethod
    def get_monthly_register(class_id: int, year: int, month: int, db: Session) -> Dict[str, Any]:
        """
        Calculates the monthly digital register matrix:
        Students (rows) x Days of the Month (columns)
        """
        cohort = db.query(ClassModel).filter(ClassModel.id == class_id).first()
        class_name = cohort.name if cohort else f"Class #{class_id}"

        # Get days in month
        _, num_days = calendar.monthrange(year, month)
        today = date.today()
        prefix = f"{year:04d}-{month:02d}-"

        # Determine which days are working days vs weekends
        day_types = {}
        working_days = 0
        for day in range(1, num_days + 1):
            d_obj = date(year, month, day)
            # Sunday is 6
            is_weekend = (d_obj.weekday() == 6)
            is_future = (d_obj > today)
            
            day_types[day] = {
                "day": day,
                "weekday_name": d_obj.strftime("%a"),
                "is_weekend": is_weekend,
                "is_future": is_future
            }
            if not is_weekend and not is_future:
                working_days += 1

        # If in the future or no working days elapsed yet, set minimum working days for percentage calculation
        display_working_days = max(1, working_days)

        # Query all active students in this cohort
        students = db.query(Student).filter(
            Student.class_id == class_id,
            Student.is_active == True
        ).order_by(Student.roll_number.asc()).all()

        # Query all attendance records for this month
        student_ids = [s.id for s in students]
        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.date.like(f"{prefix}%"),
            AttendanceRecord.student_id.in_(student_ids)
        ).all()

        # Map (student_id, day_int) -> AttendanceRecord
        record_map = {}
        for r in records:
            try:
                d_int = int(r.date.split("-")[2])
                record_map[(r.student_id, d_int)] = r
            except Exception:
                continue

        student_rows = []
        total_class_present_days = 0
        students_with_shortage = 0

        for student in students:
            days_grid = {}
            present_count = 0
            absent_count = 0
            late_count = 0

            for day in range(1, num_days + 1):
                d_info = day_types[day]
                key = (student.id, day)

                if d_info["is_weekend"]:
                    days_grid[day] = "W"  # Weekend
                elif key in record_map:
                    rec = record_map[key]
                    if rec.status == AttendanceStatus.PRESENT:
                        days_grid[day] = "P"
                        present_count += 1
                    elif rec.status == AttendanceStatus.LATE:
                        days_grid[day] = "L"
                        late_count += 1
                        present_count += 1
                    elif rec.status == AttendanceStatus.EXCUSED:
                        days_grid[day] = "E"
                    else:
                        days_grid[day] = "A"
                        absent_count += 1
                elif d_info["is_future"]:
                    days_grid[day] = "-"  # Future day
                else:
                    days_grid[day] = "A"  # Unmarked past working day defaults to Absent
                    absent_count += 1

            total_attended = present_count
            pct = round((total_attended / display_working_days) * 100, 1) if display_working_days > 0 else 0.0
            is_shortage = (pct < 75.0)
            if is_shortage:
                students_with_shortage += 1

            total_class_present_days += total_attended

            student_rows.append({
                "student_id": student.id,
                "roll_number": student.roll_number,
                "full_name": student.full_name,
                "days": days_grid,
                "total_present": total_attended,
                "total_absent": absent_count,
                "total_late": late_count,
                "attendance_percentage": pct,
                "is_shortage": is_shortage
            })

        total_possible = len(students) * display_working_days
        class_avg = round((total_class_present_days / total_possible * 100), 1) if total_possible > 0 else 0.0

        return {
            "class_id": class_id,
            "class_name": class_name,
            "year": year,
            "month": month,
            "month_name": datetime(year, month, 1).strftime("%B"),
            "days_in_month": num_days,
            "working_days_elapsed": working_days,
            "days_metadata": list(day_types.values()),
            "total_students": len(students),
            "shortage_count": students_with_shortage,
            "class_average_percentage": class_avg,
            "students": student_rows
        }

    @staticmethod
    def override_attendance(
        student_id: int,
        date_str: str,
        new_status: str,
        reason: Optional[str],
        db: Session
    ) -> AttendanceRecord:
        """
        Allows authorized teachers to manually override a student's daily attendance.
        """
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError("Student not found")

        att_status = AttendanceStatus(new_status)

        existing = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.date == date_str
        ).first()

        now_time = datetime.now().strftime("%H:%M:%S")

        if existing:
            existing.status = att_status
            existing.verification_method = VerificationMethod.MANUAL_OVERRIDE
            db.commit()
            db.refresh(existing)
            return existing
        else:
            new_rec = AttendanceRecord(
                student_id=student_id,
                date=date_str,
                time=now_time,
                status=att_status,
                confidence_score=1.0,
                verification_method=VerificationMethod.MANUAL_OVERRIDE
            )
            db.add(new_rec)
            db.commit()
            db.refresh(new_rec)
            return new_rec

register_service = RegisterService()

