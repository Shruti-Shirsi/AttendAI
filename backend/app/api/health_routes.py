from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter(tags=["Health & System Telemetry"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Verifies API server and database connectivity."""
    db_status = "HEALTHY"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"UNHEALTHY: {str(e)}"

    return {
        "status": "ONLINE",
        "service": "AttendAI Core API",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status
    }

