from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import require_teacher_or_admin, require_admin, get_current_user
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["Settings"])

class SystemSettingsSchema(BaseModel):
    face_confidence_threshold: float = 0.35
    consecutive_frames_required: int = 5
    shortage_threshold_percent: float = 75.0
    institution_name: str = "College of Engineering"
    camera_source: str = "0 (Integrated USB Webcam)"
    meta_whatsapp_phone_id: str = "109823482394"
    meta_webhook_verify_token: str = "attendai_webhook_verify_secret_2026"
    ai_voice_default_language: str = "EN"
    duplicate_stamping_window_hours: int = 24

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

# In-memory configurable store
CURRENT_SYSTEM_SETTINGS = {
    "face_confidence_threshold": 0.35,
    "consecutive_frames_required": 5,
    "shortage_threshold_percent": 75.0,
    "institution_name": "College of Engineering",
    "camera_source": "0 (Integrated USB Webcam)",
    "meta_whatsapp_phone_id": settings.META_PHONE_NUMBER_ID or "109823482394",
    "meta_webhook_verify_token": settings.META_WEBHOOK_VERIFY_TOKEN,
    "ai_voice_default_language": "EN",
    "duplicate_stamping_window_hours": 24
}

@router.get("/")
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin)
):
    """
    Returns active system configurations across biometrics, WhatsApp, and AI calling.
    """
    return {
        **CURRENT_SYSTEM_SETTINGS,
        "user_email": current_user.email,
        "user_role": current_user.role.value,
        "user_name": current_user.full_name
    }

@router.put("/")
def update_system_settings(
    payload: SystemSettingsSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Updates system parameters (Administrator access required).
    """
    CURRENT_SYSTEM_SETTINGS.update(payload.dict())
    return {
        "success": True,
        "message": "System configuration updated successfully.",
        "settings": CURRENT_SYSTEM_SETTINGS
    }

@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates the password of the currently authenticated user.
    """
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    from app.core.security import verify_password, get_password_hash
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password incorrect.")

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"success": True, "message": "Password changed successfully."}

