import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.call_permission import CallPermission, PermissionStatus
from app.models.student import Student, Parent
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.services.whatsapp_service import whatsapp_service

class PermissionService:
    @staticmethod
    def cleanup_expired_permissions(db: Session) -> int:
        """
        Transitions any ALLOWED permissions whose expires_at < now to EXPIRED.
        """
        now = datetime.utcnow()
        expired_records = db.query(CallPermission).filter(
            CallPermission.status == PermissionStatus.ALLOWED,
            CallPermission.expires_at < now
        ).all()

        count = 0
        for p in expired_records:
            p.status = PermissionStatus.EXPIRED
            count += 1

        if count > 0:
            db.commit()
            print(f"[PermissionService] Transitioned {count} permissions to EXPIRED.")
        return count

    @staticmethod
    def request_calling_permission(parent_id: int, db: Session) -> Dict[str, Any]:
        """
        Dispatches an interactive WhatsApp message prompting the parent for 24-hr calling consent.
        """
        parent = db.query(Parent).filter(Parent.id == parent_id).first()
        if not parent:
            raise ValueError("Parent not found")

        student = parent.student
        student_name = student.full_name if student else "your ward"

        consent_text = (
            f"AttendAI Institutional Calling Request:\n"
            f"Dear {parent.full_name}, the academic office requests your authorization "
            f"to initiate an automated AI Voice call regarding attendance updates for {student_name}.\n"
            f"• Validity: 24 Hours\n"
            f"• Scope: Attendance verification & legitimate leave inquiry\n\n"
            f"Please tap below to authorize or decline."
        )

        # Dispatch via WhatsApp Gateway with action buttons
        dispatch_res = whatsapp_service.send_whatsapp_message(
            to_phone=parent.whatsapp_number,
            message_text=consent_text,
            student_name=student_name,
            roll_number=student.roll_number if student else "",
            date_str=datetime.now().strftime("%Y-%m-%d"),
            language=parent.preferred_language or "EN"
        )

        now = datetime.utcnow()
        perm = db.query(CallPermission).filter(CallPermission.parent_id == parent.id).first()
        if perm:
            perm.status = PermissionStatus.REQUESTED
            perm.requested_at = now
            perm.provider_reference = dispatch_res.get("message_id")
        else:
            perm = CallPermission(
                parent_id=parent.id,
                student_id=parent.student_id,
                status=PermissionStatus.REQUESTED,
                requested_at=now,
                provider_reference=dispatch_res.get("message_id")
            )
            db.add(perm)

        db.commit()
        db.refresh(perm)

        return {
            "success": True,
            "permission_id": perm.id,
            "parent_id": parent.id,
            "status": perm.status.value,
            "whatsapp_message_id": dispatch_res.get("message_id"),
            "message": f"Interactive calling permission prompt dispatched to {parent.whatsapp_number}."
        }

    @staticmethod
    def grant_manual_permission(parent_id: int, reason: str, db: Session) -> Dict[str, Any]:
        """
        Teacher manual entry for signed physical consent forms or verbal permission.
        """
        parent = db.query(Parent).filter(Parent.id == parent_id).first()
        if not parent:
            raise ValueError("Parent not found")

        now = datetime.utcnow()
        expires = now + timedelta(hours=24)

        perm = db.query(CallPermission).filter(CallPermission.parent_id == parent.id).first()
        if perm:
            perm.status = PermissionStatus.ALLOWED
            perm.granted_at = now
            perm.expires_at = expires
            perm.student_id = parent.student_id
            perm.provider_reference = f"MANUAL_TEACHER_CONSENT: {reason}"
        else:
            perm = CallPermission(
                parent_id=parent.id,
                student_id=parent.student_id,
                status=PermissionStatus.ALLOWED,
                granted_at=now,
                expires_at=expires,
                provider_reference=f"MANUAL_TEACHER_CONSENT: {reason}"
            )
            db.add(perm)

        db.commit()
        db.refresh(perm)

        return {
            "success": True,
            "permission_id": perm.id,
            "parent_id": parent.id,
            "status": "ALLOWED",
            "granted_at": perm.granted_at.isoformat(),
            "expires_at": perm.expires_at.isoformat(),
            "message": f"Calling permission authorized for 24 hours (Reason: {reason})."
        }

    @staticmethod
    def revoke_permission(parent_id: int, db: Session) -> Dict[str, Any]:
        perm = db.query(CallPermission).filter(CallPermission.parent_id == parent_id).first()
        if not perm:
            raise ValueError("Permission record not found")

        perm.status = PermissionStatus.WITHDRAWN
        perm.withdrawn_at = datetime.utcnow()
        db.commit()

        return {
            "success": True,
            "parent_id": parent_id,
            "status": "WITHDRAWN",
            "message": "Calling permission revoked successfully."
        }

    @staticmethod
    def list_permissions(
        class_id: Optional[int],
        status_filter: Optional[str],
        db: Session
    ) -> List[Dict[str, Any]]:
        # Housekeeping: update any expired records first
        PermissionService.cleanup_expired_permissions(db)

        query = db.query(Parent).join(Student)
        if class_id:
            query = query.filter(Student.class_id == class_id)

        parents = query.all()
        now = datetime.utcnow()
        results = []

        for pr in parents:
            st = pr.student
            perm = db.query(CallPermission).filter(CallPermission.parent_id == pr.id).first()

            status_val = perm.status.value if perm else "UNREQUESTED"
            if status_filter and status_filter != "ALL" and status_val != status_filter:
                continue

            remaining_hours = 0.0
            if perm and perm.status == PermissionStatus.ALLOWED and perm.expires_at:
                diff = perm.expires_at - now
                remaining_hours = max(0.0, round(diff.total_seconds() / 3600.0, 1))

            results.append({
                "parent_id": pr.id,
                "student_id": st.id if st else None,
                "student_name": st.full_name if st else "Student",
                "roll_number": st.roll_number if st else "",
                "class_name": st.class_cohort.name if (st and st.class_cohort) else "N/A",
                "parent_name": pr.full_name,
                "whatsapp_number": pr.whatsapp_number,
                "preferred_language": pr.preferred_language,
                "permission_id": perm.id if perm else None,
                "status": status_val,
                "granted_at": perm.granted_at.isoformat() if (perm and perm.granted_at) else None,
                "expires_at": perm.expires_at.isoformat() if (perm and perm.expires_at) else None,
                "remaining_hours": remaining_hours,
                "provider_reference": perm.provider_reference if perm else None
            })

        return results

    @staticmethod
    def get_call_eligible_absentees(date_str: str, class_id: Optional[int], db: Session) -> List[Dict[str, Any]]:
        """
        Cross-references absentees with unexpired ALLOWED parent permissions.
        """
        PermissionService.cleanup_expired_permissions(db)

        # Get all students in class
        query = db.query(Student).filter(Student.is_active == True)
        if class_id:
            query = query.filter(Student.class_id == class_id)
        students = query.all()

        # Attended students on date
        attended = db.query(AttendanceRecord.student_id).filter(
            AttendanceRecord.date == date_str,
            AttendanceRecord.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED])
        ).all()
        attended_sids = {r[0] for r in attended}

        now = datetime.utcnow()
        eligible = []

        for st in students:
            if st.id not in attended_sids:
                parent = st.parent
                if parent:
                    perm = db.query(CallPermission).filter(
                        CallPermission.parent_id == parent.id,
                        CallPermission.status == PermissionStatus.ALLOWED,
                        CallPermission.expires_at > now
                    ).first()

                    if perm:
                        diff = perm.expires_at - now
                        rem_hours = round(diff.total_seconds() / 3600.0, 1)
                        eligible.append({
                            "student_id": st.id,
                            "student_name": st.full_name,
                            "roll_number": st.roll_number,
                            "class_name": st.class_cohort.name if st.class_cohort else "N/A",
                            "parent_id": parent.id,
                            "parent_name": parent.full_name,
                            "whatsapp_number": parent.whatsapp_number,
                            "preferred_language": parent.preferred_language or "EN",
                            "permission_id": perm.id,
                            "remaining_hours": rem_hours
                        })

        return eligible

    @staticmethod
    def get_permission_stats(db: Session) -> Dict[str, Any]:
        """
        Returns live calling consent statistics and compliance rates.
        """
        PermissionService.cleanup_expired_permissions(db)
        total_parents = db.query(Parent).count()
        now = datetime.utcnow()
        allowed = db.query(CallPermission).filter(
            CallPermission.status == PermissionStatus.ALLOWED,
            CallPermission.expires_at > now
        ).count()
        requested = db.query(CallPermission).filter(CallPermission.status == PermissionStatus.REQUESTED).count()
        declined = db.query(CallPermission).filter(CallPermission.status == PermissionStatus.DECLINED).count()
        withdrawn = db.query(CallPermission).filter(CallPermission.status == PermissionStatus.WITHDRAWN).count()
        expired = db.query(CallPermission).filter(
            (CallPermission.status == PermissionStatus.EXPIRED) |
            ((CallPermission.status == PermissionStatus.ALLOWED) & (CallPermission.expires_at <= now))
        ).count()
        unrequested = max(0, total_parents - (allowed + requested + declined + withdrawn))
        compliance_rate = round((allowed / total_parents * 100), 1) if total_parents > 0 else 0.0

        return {
            "total_parents": total_parents,
            "allowed": allowed,
            "requested": requested,
            "declined": declined,
            "withdrawn": withdrawn,
            "expired": expired,
            "unrequested": unrequested,
            "compliance_rate": compliance_rate
        }

permission_service = PermissionService()
