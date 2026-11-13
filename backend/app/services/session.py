import datetime
from fastapi import Request, Response, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import generate_secure_token, hash_token
from app.database.session import get_db
from app.models.user import User, UserSession

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

def create_user_session(db: Session, user: User, remember_me: bool = False) -> tuple[UserSession, str]:
    """
    Creates a new authenticated server-side session and returns (session_record, raw_token).
    The raw token is transmitted ONLY via HTTP-only cookie and never saved in plaintext.
    """
    raw_token = generate_secure_token()
    token_hash = hash_token(raw_token)

    days = 30 if remember_me else settings.SESSION_EXPIRE_DAYS
    expires_at = utc_now() + datetime.timedelta(days=days)

    db_session = UserSession(
        user_id=user.id,
        session_id_hash=token_hash,
        expires_at=expires_at,
        created_at=utc_now(),
        last_used_at=utc_now(),
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    return db_session, raw_token

def set_session_cookie(response: Response, raw_token: str, remember_me: bool = False):
    """Sets an HTTP-only SameSite cookie on the response."""
    days = 30 if remember_me else settings.SESSION_EXPIRE_DAYS
    max_age = days * 24 * 60 * 60

    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=max_age,
        expires=max_age,
        path="/",
        domain=None,
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
    )

def clear_session_cookie(response: Response):
    """Clears the session cookie."""
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        domain=None,
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
    )

def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    """Extracts user from session cookie without throwing 401 if not found."""
    raw_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    
    # Also support Authorization header Bearer token for API / mobile clients
    if not raw_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header.replace("Bearer ", "").strip()

    if not raw_token:
        return None

    token_hash = hash_token(raw_token)
    user_session = db.query(UserSession).filter(UserSession.session_id_hash == token_hash).first()

    if not user_session:
        return None

    # Check expiration
    if user_session.expires_at.tzinfo is None:
        user_session_expires = user_session.expires_at.replace(tzinfo=datetime.timezone.utc)
    else:
        user_session_expires = user_session.expires_at

    if user_session_expires < utc_now():
        db.delete(user_session)
        db.commit()
        return None

    # Update last_used_at
    user_session.last_used_at = utc_now()
    db.commit()

    return user_session.user

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Strict dependency requiring authenticated user."""
    user = get_current_user_optional(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Cookie"},
        )
    return user

def get_current_verified_user(user: User = Depends(get_current_user)) -> User:
    """Strict dependency requiring an active, email-verified user."""
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email address must be verified before performing security audits.",
        )
    return user

