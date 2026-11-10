from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import auth_routes, student_routes, attendance_routes, health_routes, class_routes, absentee_routes, whatsapp_routes, permission_routes, voice_routes, report_routes, settings_routes
from app.services.face_service import face_engine

# Create database tables automatically
Base.metadata.create_all(bind=engine)

# Initialize face engine with database embeddings on server startup
try:
    with SessionLocal() as db_session:
        face_engine.reload_embeddings_from_db(db_session)
except Exception as e:
    print(f"[Startup Warning] Could not preload embeddings: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    description="AttendAI Production REST API & WebSocket Suite for Biometric Multi-Face Attendance and Parent Communication"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(health_routes.router, prefix=settings.API_V1_STR)
app.include_router(auth_routes.router, prefix=settings.API_V1_STR)
app.include_router(class_routes.router, prefix=settings.API_V1_STR)
app.include_router(student_routes.router, prefix=settings.API_V1_STR)
app.include_router(attendance_routes.router, prefix=settings.API_V1_STR)
app.include_router(absentee_routes.router, prefix=settings.API_V1_STR)
app.include_router(whatsapp_routes.router, prefix=settings.API_V1_STR)
app.include_router(permission_routes.router, prefix=settings.API_V1_STR)
app.include_router(voice_routes.router, prefix=settings.API_V1_STR)
app.include_router(report_routes.router, prefix=settings.API_V1_STR)
app.include_router(settings_routes.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": "Welcome to AttendAI Core API Server",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health"
    }
