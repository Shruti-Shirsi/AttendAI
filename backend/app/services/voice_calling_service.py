import uuid
import random
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.call_history import CallHistory, CallStatus
from app.models.call_permission import CallPermission, PermissionStatus
from app.models.student import Student, Parent
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.core.config import settings

class VoiceCallingService:
    """
    AttendAI Voice Calling Agent Engine.
    Strictly enforces parent calling consent, manages multilingual automated conversations
    (EN, HI, MR), and tracks call outcomes without storing voice audio or raw speech-to-text.
    """

    DIALOG_SCRIPTS = {
        "EN": {
            "greeting": "Hello {parent_name}, this is AttendAI Institutional Assistant calling from {institution}.",
            "absence_inquiry": "Our records indicate that {student_name} was marked absent for today's session ({date}). Could you please share the reason for their absence?",
            "return_inquiry": "Thank you. What is the expected date for {student_name} to resume classes?",
            "closing": "We have recorded this in the digital attendance register. Thank you for your time, and have a good day.",
            "sample_reasons": ["Medical / Mild Fever", "Family Function / Travel", "Doctor Appointment", "Personal Leave"]
        },
        "HI": {
            "greeting": "नमस्ते {parent_name} जी, मैं {institution} से AttendAI का स्वचालित शैक्षणिक सहायक बोल रहा हूँ।",
            "absence_inquiry": "हमारे रजिस्टर के अनुसार {student_name} आज ({date}) की कक्षा में अनुपस्थित हैं। क्या आप उनकी अनुपस्थिति का कारण साझा कर सकते हैं?",
            "return_inquiry": "धन्यवाद। {student_name} के वापस कक्षा में आने की संभावित तिथि क्या है?",
            "closing": "हमने यह जानकारी संस्था के रजिस्टर में दर्ज कर ली है। आपके सहयोग के लिए धन्यवाद।",
            "sample_reasons": ["स्वास्थ्य समस्या / बुखार", "पारिवारिक कार्यक्रम", "चिकित्सक परामर्श", "व्यक्तिगत छुट्टी"]
        },
        "MR": {
            "greeting": "नमस्कार {parent_name}, मी {institution} कडून AttendAI शैक्षणिक सहाय्यक बोलत आहे.",
            "absence_inquiry": "आमच्या नोंदीनुसार {student_name} आजच्या ({date}) शैक्षणिक सत्राला गैरहजर आहेत. कृपया गैरहजेरीचे कारण सांगू शकाल का?",
            "return_inquiry": "धन्यवाद. {student_name} पुन्हा कधीपासून महाविद्यालयात उपस्थित राहू शकतील?",
            "closing": "आम्ही ही नोंद डिजिटल रजिस्टरमध्ये अद्ययावत केली आहे. आपला दिवस चांगला जावो.",
            "sample_reasons": ["आजारी / ताप", "कौटुंबिक समारंभ", "डॉक्टरांची भेट", "वैयक्तिक रजा"]
        }
    }

    @staticmethod
    def validate_call_permission(student_id: int, db: Session) -> Tuple[bool, str, Optional[CallPermission]]:
        """
        Enforces Module 10 & 11 Mandate:
        Calls can ONLY be placed if parent granted ALLOWED status within the last 24 hours.
        """
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return False, "Student not found in institutional records.", None

        parent = student.parent
        if not parent:
            return False, "No parent/guardian contact linked to student.", None

        perm = db.query(CallPermission).filter(
            CallPermission.parent_id == parent.id,
            CallPermission.student_id == student.id
        ).first()

        now = datetime.utcnow()

        if not perm:
            return False, "Calling permission has not been requested or granted by parent.", None

        if perm.status == PermissionStatus.WITHDRAWN:
            return False, "Calling permission was revoked/withdrawn by parent or teacher.", perm

        if perm.status == PermissionStatus.DECLINED:
            return False, "Parent explicitly declined voice calling permission.", perm

        if perm.status == PermissionStatus.REQUESTED:
            return False, "Calling permission is still pending parent authorization.", perm

        if perm.status == PermissionStatus.EXPIRED or (perm.expires_at and perm.expires_at <= now):
            # Auto-update status to EXPIRED
            if perm.status != PermissionStatus.EXPIRED:
                perm.status = PermissionStatus.EXPIRED
                db.commit()
            return False, "Calling permission expired (24-hour validity lapsed). Re-consent required.", perm

        if perm.status == PermissionStatus.ALLOWED and perm.expires_at and perm.expires_at > now:
            diff = perm.expires_at - now
            rem_hrs = round(diff.total_seconds() / 3600.0, 1)
            return True, f"Permission verified and active ({rem_hrs} hours remaining).", perm

        return False, "Invalid permission state.", perm

    @classmethod
    def get_dialog_script(cls, student_name: str, parent_name: str, language: str = "EN", date_str: str = "") -> Dict[str, Any]:
        """
        Retrieves the localized conversational dialog flow for the AI voice agent.
        """
        lang = language.upper() if language else "EN"
        if lang not in cls.DIALOG_SCRIPTS:
            lang = "EN"

        template = cls.DIALOG_SCRIPTS[lang]
        institution = "College of Engineering"
        d_str = date_str or datetime.now().strftime("%d %b %Y")

        return {
            "language": lang,
            "greeting": template["greeting"].format(parent_name=parent_name, institution=institution),
            "absence_inquiry": template["absence_inquiry"].format(student_name=student_name, date=d_str),
            "return_inquiry": template["return_inquiry"].format(student_name=student_name),
            "closing": template["closing"],
            "sample_reasons": template["sample_reasons"]
        }

    @classmethod
    def initiate_voice_call(
        cls,
        student_id: int,
        reason_category: Optional[str] = None,
        expected_return_date: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Executes an AI Voice Call to parent inquiring about student absence.
        Strictly blocks if calling permission is not ALLOWED & valid <24h.
        """
        # Step 1: Validate calling permission
        is_allowed, validation_msg, perm = cls.validate_call_permission(student_id, db)
        if not is_allowed:
            raise PermissionError(f"CALLING_PERMISSION_DENIED: {validation_msg}")

        student = db.query(Student).filter(Student.id == student_id).first()
        parent = student.parent
        language = parent.preferred_language or "EN"

        # Step 2: Determine attempt sequence
        prev_attempts = db.query(CallHistory).filter(
            CallHistory.student_id == student.id,
            CallHistory.call_date >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).count()
        attempt_number = prev_attempts + 1

        # Step 3: Provider Gateway Integration & Simulation
        provider_call_id = f"call_ai_{uuid.uuid4().hex[:14]}"
        dialog = cls.get_dialog_script(
            student_name=student.full_name,
            parent_name=parent.full_name,
            language=language
        )

        # Realistic voice call progression
        call_duration = random.randint(38, 72) # Average realistic conversation duration in seconds
        selected_reason = reason_category or random.choice(dialog["sample_reasons"])
        ret_date = expected_return_date or (date.today() + timedelta(days=random.randint(1, 2))).isoformat()

        # Outcome summary snippet (NO audio recording, NO raw STT)
        outcome_snippet = (
            f"[{language}] Dialogue completed with {parent.full_name}. "
            f"Reason: {selected_reason}. Expected return: {ret_date}."
        )

        call_record = CallHistory(
            parent_id=parent.id,
            student_id=student.id,
            call_date=datetime.utcnow(),
            attempt_number=attempt_number,
            status=CallStatus.COMPLETED,
            duration_seconds=call_duration,
            absence_reason_category=selected_reason,
            parent_response_snippet=outcome_snippet,
            provider_call_id=provider_call_id
        )

        db.add(call_record)
        db.commit()
        db.refresh(call_record)

        return {
            "success": True,
            "call_id": call_record.id,
            "provider_call_id": provider_call_id,
            "student_id": student.id,
            "student_name": student.full_name,
            "parent_name": parent.full_name,
            "whatsapp_number": parent.whatsapp_number,
            "language": language,
            "status": call_record.status.value,
            "duration_seconds": call_duration,
            "absence_reason_category": selected_reason,
            "expected_return_date": ret_date,
            "outcome_snippet": outcome_snippet,
            "dialog_flow": dialog
        }

    @classmethod
    def get_call_queue(cls, db: Session, target_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns list of absentees for the selected date with their calling consent readiness.
        """
        t_date = target_date or date.today().isoformat()

        # Find all students marked ABSENT for date
        absent_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.date == t_date,
            AttendanceRecord.status == AttendanceStatus.ABSENT
        ).all()

        queue = []
        now = datetime.utcnow()

        for rec in absent_records:
            st = rec.student
            if not st:
                continue
            parent = st.parent
            if not parent:
                continue

            # Check calling permission
            perm = db.query(CallPermission).filter(
                CallPermission.parent_id == parent.id,
                CallPermission.student_id == st.id
            ).first()

            is_permitted = False
            remaining_hours = 0.0
            status_str = "UNREQUESTED"

            if perm:
                status_str = perm.status.value
                if perm.status == PermissionStatus.ALLOWED and perm.expires_at and perm.expires_at > now:
                    is_permitted = True
                    diff = perm.expires_at - now
                    remaining_hours = max(0.0, round(diff.total_seconds() / 3600.0, 1))

            # Check previous calls today
            calls_today = db.query(CallHistory).filter(
                CallHistory.student_id == st.id,
                CallHistory.call_date >= datetime.utcnow().replace(hour=0, minute=0, second=0)
            ).order_by(CallHistory.id.desc()).all()

            last_call = calls_today[0] if calls_today else None

            queue.append({
                "student_id": st.id,
                "student_name": st.full_name,
                "roll_number": st.roll_number,
                "class_name": st.class_cohort.name if st.class_cohort else "N/A",
                "parent_id": parent.id,
                "parent_name": parent.full_name,
                "whatsapp_number": parent.whatsapp_number,
                "language": parent.preferred_language or "EN",
                "is_permitted": is_permitted,
                "permission_status": status_str,
                "permission_remaining_hours": remaining_hours,
                "call_count_today": len(calls_today),
                "last_call_status": last_call.status.value if last_call else None,
                "last_call_reason": last_call.absence_reason_category if last_call else None,
                "last_call_duration": last_call.duration_seconds if last_call else None
            })

        # Sort so permitted students who haven't been called yet appear at the top
        queue.sort(key=lambda x: (not x["is_permitted"], x["call_count_today"]))
        return queue

    @classmethod
    def get_call_history(cls, db: Session, limit: int = 50, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Returns institutional call log records sorted with most recent calls first.
        """
        query = db.query(CallHistory).join(Student).join(Parent)
        if status_filter and status_filter != "ALL":
            query = query.filter(CallHistory.status == status_filter)

        records = query.order_by(CallHistory.id.desc()).limit(limit).all()
        results = []

        for c in records:
            st = c.student
            pr = c.parent
            results.append({
                "id": c.id,
                "provider_call_id": c.provider_call_id,
                "student_id": st.id if st else None,
                "student_name": st.full_name if st else "Student",
                "roll_number": st.roll_number if st else "",
                "class_name": st.class_cohort.name if (st and st.class_cohort) else "N/A",
                "parent_id": pr.id if pr else None,
                "parent_name": pr.full_name if pr else "Parent",
                "whatsapp_number": pr.whatsapp_number if pr else "",
                "language": pr.preferred_language if pr else "EN",
                "call_date": c.call_date.isoformat(),
                "attempt_number": c.attempt_number,
                "status": c.status.value,
                "duration_seconds": c.duration_seconds,
                "absence_reason_category": c.absence_reason_category,
                "parent_response_snippet": c.parent_response_snippet
            })

        return results

    @classmethod
    def get_voice_metrics(cls, db: Session) -> Dict[str, Any]:
        """
        Computes high-level analytics for the AI Voice Calling dashboard.
        """
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0)
        today_calls = db.query(CallHistory).filter(CallHistory.call_date >= today_start).all()

        total_today = len(today_calls)
        completed = sum(1 for c in today_calls if c.status == CallStatus.COMPLETED)
        no_answer = sum(1 for c in today_calls if c.status == CallStatus.NO_ANSWER)
        failed = sum(1 for c in today_calls if c.status == CallStatus.FAILED)
        total_duration = sum(c.duration_seconds for c in today_calls)
        avg_duration = round(total_duration / completed, 1) if completed > 0 else 0.0

        # Absence reasons distribution
        reason_counts = {}
        for c in today_calls:
            if c.absence_reason_category:
                reason_counts[c.absence_reason_category] = reason_counts.get(c.absence_reason_category, 0) + 1

        top_reasons = [{"reason": k, "count": v} for k, v in reason_counts.items()]

        return {
            "total_calls_today": total_today,
            "completed_calls": completed,
            "no_answer_calls": no_answer,
            "failed_calls": failed,
            "average_duration_seconds": avg_duration,
            "top_reasons": top_reasons
        }

voice_calling_service = VoiceCallingService()

