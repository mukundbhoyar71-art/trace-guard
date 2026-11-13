import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import health, auth, scans, security, monitoring, privacy, reports, media, ai, analytics
from app.database.session import Base, engine
from app.services.monitoring_scheduler import monitoring_scheduler_loop
import app.models  # ensure models are loaded

# Initialize tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    dispatch_info = (
        f"RESEND API ({settings.EMAIL_FROM})"
        if (settings.EMAIL_PROVIDER or "").lower() == "resend"
        else "DEVELOPMENT TERMINAL DISPATCH"
    )
    hibp_status = "CONFIGURED" if settings.HIBP_API_KEY else "CONFIGURATION REQUIRED"
    google_oauth_status = (
        "CONFIGURED"
        if (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
        else "CONFIGURATION REQUIRED"
    )
    scheduler_task = None
    if not os.environ.get("PYTEST_CURRENT_TEST"):
        scheduler_task = asyncio.create_task(monitoring_scheduler_loop(poll_interval_seconds=60))
    startup_msg = f"""
==================================================
TRACE GUARD BACKEND API INITIALIZED
API ROOT:       http://localhost:8000
OPENAPI DOCS:   http://localhost:8000/docs
EMAIL PROVIDER: {settings.EMAIL_PROVIDER}
DISPATCH MODE:  {dispatch_info}
HIBP SCANNER:   {hibp_status}
GOOGLE OAUTH:   {google_oauth_status}
MONITOR LOOP:   {'ACTIVE (60s)' if scheduler_task else 'TEST MODE'}
==================================================
"""
    print(startup_msg.strip(), flush=True)
    try:
        yield
    finally:
        if scheduler_task:
            scheduler_task.cancel()
            try:
                await scheduler_task
            except asyncio.CancelledError:
                pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Personal Data Footprint Auditor Backend API",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(scans.router, prefix=settings.API_PREFIX)
app.include_router(security.router, prefix=settings.API_PREFIX)
app.include_router(monitoring.router, prefix=settings.API_PREFIX)
app.include_router(privacy.router, prefix=settings.API_PREFIX)
app.include_router(reports.router, prefix=settings.API_PREFIX)
app.include_router(media.router, prefix=settings.API_PREFIX)
app.include_router(ai.router, prefix=settings.API_PREFIX)
app.include_router(analytics.router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "tagline": settings.TAGLINE,
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health"
    }
