from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List, Any
from pathlib import Path
from dotenv import dotenv_values
import os

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ROOT_DIR = _BACKEND_DIR.parent


def _load_nonempty_env_file(env_path: Path) -> None:
    """
    Loads non-empty key/value pairs from an .env file into os.environ
    without letting empty placeholder lines (e.g. KEY=) shadow real values.
    """
    if not env_path.exists():
        return
    for key, val in dotenv_values(str(env_path)).items():
        if val is None:
            continue
        cleaned = val.strip().strip("'\"")
        if not cleaned:
            continue
        existing = os.environ.get(key)
        if existing is None or not existing.strip():
            os.environ[key] = cleaned


# Explicitly ensure non-empty values from backend/.env and root/.env are available
_load_nonempty_env_file(_BACKEND_DIR / ".env")
_load_nonempty_env_file(_ROOT_DIR / ".env")

_ENV_FILES = [
    str(_BACKEND_DIR / ".env"),
    str(_ROOT_DIR / ".env"),
    ".env",
]

DEV_SECRET_FALLBACK: str = "traceguard_super_secure_secret_key_development_32_bytes_min_xyz"

class Settings(BaseSettings):
    PROJECT_NAME: str = "TRACE GUARD"
    TAGLINE: str = "YOUR DIGITAL LIFE. YOUR CONTROL."
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Environment: "development", "staging", "production", "test"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "sqlite:///./trace_guard.db"
    SECRET_KEY: str = DEV_SECRET_FALLBACK
    ALGORITHM: str = "HS256"

    # Sessions & Cookies
    SESSION_COOKIE_NAME: str = "traceguard_session"
    SESSION_EXPIRE_DAYS: int = 14
    VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 30
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # Rate Limiting
    RATE_LIMIT_LOGIN_ATTEMPTS: int = 5
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Google OAuth 2.0 / OpenID Connect
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # External APIs
    HIBP_API_KEY: Optional[str] = None
    HIBP_BASE_URL: str = "https://haveibeenpwned.com/api/v3"
    HIBP_USER_AGENT: str = "TraceGuard-ExposureScanner/1.0"

    # AI Configuration
    AI_PROVIDER: str = "gemini"  # "gemini" or "openai"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Email Service
    EMAIL_PROVIDER: str = "development"  # "development" or "resend"
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "noreply@traceguard.local"

    def model_post_init(self, __context: Any) -> None:
        """
        Normalizes empty string environment variables to None,
        and provides robust fallback between backend/.env and root .env
        for all API and OAuth secrets/credentials.
        """
        target_keys = [
            "GEMINI_API_KEY",
            "OPENAI_API_KEY",
            "HIBP_API_KEY",
            "RESEND_API_KEY",
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
        ]
        fallback_paths = [_BACKEND_DIR / ".env", _ROOT_DIR / ".env"]

        for key in target_keys:
            val = getattr(self, key, None)
            if isinstance(val, str):
                cleaned = val.strip().strip("'\"")
                setattr(self, key, cleaned if cleaned else None)

            # If still None/empty, check backend/.env and root .env for a non-empty value
            if getattr(self, key, None) is None:
                for env_path in fallback_paths:
                    if env_path.exists():
                        vals = dotenv_values(str(env_path))
                        candidate = vals.get(key)
                        if isinstance(candidate, str):
                            cleaned_cand = candidate.strip().strip("'\"")
                            if cleaned_cand:
                                setattr(self, key, cleaned_cand)
                                break

        # Clean and normalize SECRET_KEY
        if isinstance(self.SECRET_KEY, str):
            self.SECRET_KEY = self.SECRET_KEY.strip().strip("'\"")

        # Enforce fail-safe production security rules
        is_production = (self.ENVIRONMENT or "").strip().lower() in ("production", "prod")
        if is_production:
            if not self.SECRET_KEY or self.SECRET_KEY == DEV_SECRET_FALLBACK:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Running in production requires "
                    "a dedicated, strong SECRET_KEY environment variable. "
                    "The development fallback key cannot be used in production."
                )
            if len(self.SECRET_KEY) < 32:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Production SECRET_KEY must "
                    "be at least 32 characters long."
                )
            # Automatically enforce secure HTTPS cookies in production
            self.COOKIE_SECURE = True

    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
