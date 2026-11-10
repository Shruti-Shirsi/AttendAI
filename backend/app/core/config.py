import os
from pydantic_settings import BaseSettings

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_DB_PATH = os.path.join(ROOT_DIR, "attendai.db").replace("\\", "/")

class Settings(BaseSettings):
    PROJECT_NAME: str = "AttendAI — Biometric Multi-Face Attendance SaaS"
    API_V1_STR: str = "/api/v1"
    
    # Database URL: Supports PostgreSQL with default absolute SQLite path
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")
    
    # JWT Security
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "attendai_super_secure_jwt_secret_token_2026_xyz")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 Hours
    
    # Meta WhatsApp Business Platform
    META_WHATSAPP_TOKEN: str = os.getenv("META_WHATSAPP_TOKEN", "")
    META_PHONE_NUMBER_ID: str = os.getenv("META_PHONE_NUMBER_ID", "")
    META_WEBHOOK_VERIFY_TOKEN: str = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "attendai_webhook_verify_secret_2026")
    
    # CORS Origins
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8501",
        "http://localhost:8502"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
