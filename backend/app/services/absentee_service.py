from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification, NotificationStatus
from app.models.attendance import AttendanceRecord, AttendanceStatus, VerificationMethod
from app.models.student import Student, Parent
from app.models.class_model import ClassModel

class AbsenteeService:
    @staticmethod
    def get_localized_message(
        student_name: str,
        roll_number: str,
        date_str: str,
        class_name: str,
        language: str = "EN"
    ) -> str:
        lang = (language or "EN").upper()
        if lang == "HI":
            return (
                f"अटेंडएआई आधिकारिक सूचना: आदरणीय अभिभावक, आपका पाल्य {student_name} "
                f"(रोल नं: {roll_number}) आज ({date_str}) कक्षा {class_name} में अनुपस्थित दर्ज किया गया है। "
                f"कृपया उपस्थिति की समीक्षा करें अथवा कक्षा अध्यापक से संपर्क करें।"
            )
        elif lang == "MR":
            return (
                f"अटेंडएआय अधिकृत सूचना: आदरणीय पालक, आपले पाल्य {student_name} "
                f"(हजेरी क्र.: {roll_number}) आज ({date_str}) वर्ग {class_name} मध्ये गैरहजर नोंदवले गेले आहे. "
                f"कृपया उपस्थितीची खात्री करावी अथवा वर्गशिक्षकांशी संपर्क साधावा."
            )
        else: # Default EN
            return (
                f"AttendAI Official Alert: Dear Parent/Guardian, your ward {student_name} "
                f"(Roll No: {roll_number}) was marked ABSENT today ({date_str}) for class {class_name}. "
                f"Please review attendance records or contact the department if unexpected."
            )

    @staticmethod
    def compile_daily_absentees(date_str: str, class_id: int, db: Session) -> Dict[str, Any]:
        """
        Scans class attendance records for the date and compiles any student
        without a PRESENT/EXCUSED record into the unapproved notification queue.
        """
        cohort = db.query(ClassModel).filter(ClassModel.id == class_id).first()
        class_name = cohort.name if cohort else f"Class #{class_id}"

        # All active students in this cohort
        all_students = db.query(Student).filter(
            Student.class_id == class_id,
            Student.is_active == True
        ).all()

        # Present or excused students for this date
        attended_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.date == date_str,
            AttendanceRecord.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED])
        ).all()
        attended_sids = {r.student_id for r in attended_records}

        queued_count = 0
        already_queued_count = 0

        for student in all_students:
            if student.id not in attended_sids:
                # Check if notification already generated for today
                existing_notif = db.query(Notification).filter(
                    Notification.student_id == student.id,
                    Notification.session_date == date_str,
                    Notification.message_type == "ABSENCE_NOTIFICATION"
                ).first()

                if existing_notif:
                    already_queued_count += 1
                    continue

                parent = student.parent
                parent_phone = parent.whatsapp_number if parent else "+910000000000"
                parent_lang = parent.preferred_language if parent else "EN"
                parent_id = parent.id if parent else 1

                msg_content = AbsenteeService.get_localized_message(
                    student_name=student.full_name,
                    roll_number=student.roll_number,
                    date_str=date_str,
                    class_name=class_name,
                    language=parent_lang
                )

                new_notif = Notification(
                    student_id=student.id,
                    parent_id=parent_id,
                    session_date=date_str,
                    message_type="ABSENCE_NOTIFICATION",
                    channel="WHATSAPP",
                    recipient_phone=parent_phone,
                    message_content=msg_content,
                    language=parent_lang,
                    status=NotificationStatus.PENDING,
                    approval_status="PENDING_APPROVAL"
                )
                db.add(new_notif)
                queued_count += 1

        db.commit()

        return {
            "date": date_str,
            "class_id": class_id,
            "class_name": class_name,
            "total_enrolled": len(all_students),
            "present_count": len(attended_sids),
            "absent_count": len(all_students) - len(attended_sids),
            "newly_queued": queued_count,
            "already_in_queue": already_queued_count
        }

    @staticmethod
    def get_absentee_queue(
        date_str: Optional[str],
        class_id: Optional[int],
        approval_status: Optional[str],
        db: Session
    ) -> List[Dict[str, Any]]:
        query = db.query(Notification).join(Student).filter(
            Notification.message_type == "ABSENCE_NOTIFICATION"
        )
        if date_str:
            query = query.filter(Notification.session_date == date_str)
        if class_id:
            query = query.filter(Student.class_id == class_id)
        if approval_status and approval_status != "ALL":
            query = query.filter(Notification.approval_status == approval_status)

        items = query.order_by(Notification.id.desc()).all()
        result = []

        for notif in items:
            st = notif.student
            pr = notif.parent
            result.append({
                "notification_id": notif.id,
                "student_id": st.id,
                "roll_number": st.roll_number,
                "full_name": st.full_name,
                "class_name": st.class_cohort.name if st.class_cohort else f"Class #{st.class_id}",
                "parent_name": pr.full_name if pr else "Guardian",
                "whatsapp_number": notif.recipient_phone,
                "preferred_language": notif.language,
                "session_date": notif.session_date,
                "approval_status": notif.approval_status,
                "notification_status": notif.status.value,
                "message_content": notif.message_content,
                "created_at": notif.created_at.isoformat() if notif.created_at else None
            })

        return result

    @staticmethod
    def approve_notification(notification_id: int, teacher_id: int, db: Session) -> Dict[str, Any]:
        notif = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notif:
            raise ValueError("Notification item not found")

        notif.approval_status = "APPROVED"
        notif.approved_by_user_id = teacher_id
        db.commit()
        db.refresh(notif)
        return {"success": True, "notification_id": notif.id, "approval_status": notif.approval_status}

    @staticmethod
    def bulk_approve_notifications(notification_ids: List[int], teacher_id: int, db: Session) -> Dict[str, Any]:
        notifs = db.query(Notification).filter(Notification.id.in_(notification_ids)).all()
        for n in notifs:
            n.approval_status = "APPROVED"
            n.approved_by_user_id = teacher_id
        db.commit()
        return {"success": True, "approved_count": len(notifs)}

    @staticmethod
    def excuse_student(notification_id: int, teacher_id: int, reason: str, db: Session) -> Dict[str, Any]:
        notif = db.query(Notification).filter(Notification.id == notification_id).first()
        if not notif:
            raise ValueError("Notification item not found")

        notif.approval_status = "REJECTED"
        
        # Mark student attendance as EXCUSED in database
        today_str = notif.session_date or date.today().strftime("%Y-%m-%d")
        existing_att = db.query(AttendanceRecord).filter(
            AttendanceRecord.student_id == notif.student_id,
            AttendanceRecord.date == today_str
        ).first()

        if existing_att:
            existing_att.status = AttendanceStatus.EXCUSED
            existing_att.verification_method = VerificationMethod.MANUAL_OVERRIDE
        else:
            new_rec = AttendanceRecord(
                student_id=notif.student_id,
                date=today_str,
                time=datetime.now().strftime("%H:%M:%S"),
                status=AttendanceStatus.EXCUSED,
                confidence_score=1.0,
                verification_method=VerificationMethod.MANUAL_OVERRIDE
            )
            db.add(new_rec)

        db.commit()
        return {
            "success": True,
            "notification_id": notif.id,
            "student_id": notif.student_id,
            "message": f"Student marked as EXCUSED ({reason}) and removed from absentee dispatch queue."
        }

absentee_service = AbsenteeService()

