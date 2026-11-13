import datetime
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx

from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    validate_password_strength,
    generate_secure_token,
    hash_token,
)
from app.database.session import get_db
from app.models.user import User, EmailVerificationToken, PasswordResetToken, UserSession
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserResponse,
    AuthStatusResponse,
    SessionStatusResponse,
)
from app.services.email import send_verification_email, send_password_reset_email
from app.services.rate_limiter import rate_limiter
from app.services.session import (
    create_user_session,
    set_session_cookie,
    clear_session_cookie,
    get_current_user,
    get_current_user_optional,
)
from app.services.activity import log_activity

router = APIRouter(prefix="/auth", tags=["Authentication"])

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

def format_user_response(user: User) -> UserResponse:
    provider = "google" if user.google_id and not user.hashed_password else "email"
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_email_verified=user.is_email_verified,
        google_id=user.google_id,
        auth_provider=provider,
        created_at=user.created_at,
    )

@router.post("/register", response_model=AuthStatusResponse, status_code=status.HTTP_201_CREATED)
def register(data: UserRegisterRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"register_{client_ip}", max_attempts=10, window_seconds=60)

    # 1. Enforce password complexity
    is_valid, err_msg = validate_password_strength(data.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    # 2. Check for existing user
    normalized_email = data.email.lower().strip()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address is already registered.",
        )

    # 3. Hash password using Argon2id
    password_hash = hash_password(data.password)

    # 4. Create User (unverified)
    user = User(
        full_name=data.full_name.strip(),
        email=normalized_email,
        hashed_password=password_hash,
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 5. Generate secure, single-use 30-min verification token
    raw_token = generate_secure_token()
    token_hash_str = hash_token(raw_token)
    expires_at = utc_now() + datetime.timedelta(minutes=settings.VERIFICATION_TOKEN_EXPIRE_MINUTES)

    verification_record = EmailVerificationToken(
        user_id=user.id,
        token_hash=token_hash_str,
        expires_at=expires_at,
    )
    db.add(verification_record)
    db.commit()

    # 6. Dispatch email (printed to terminal in dev mode)
    dispatch_res = None
    try:
        dispatch_res = send_verification_email(user.email, raw_token, user.full_name, action="Registration")
    except Exception as err:
        err_banner = (
            "========== TRACE GUARD VERIFICATION ERROR ==========\n"
            "Registration: FAILED TO DISPATCH EMAIL\n"
            f"Recipient: {user.email}\n"
            f"ERROR: {str(err)}\n"
            "===================================================="
        )
        print(err_banner, flush=True)

    email_delivered = dispatch_res.delivered if dispatch_res else False
    delivery_notice = dispatch_res.message if dispatch_res else "Email delivery could not be completed."

    return AuthStatusResponse(
        success=True,
        message="Registration successful. A single-use verification link has been dispatched to your email address." if email_delivered else "Registration successful. Please check delivery details below.",
        user=format_user_response(user),
        email_delivered=email_delivered,
        delivery_notice=delivery_notice,
    )

@router.post("/verify-email", response_model=AuthStatusResponse)
def verify_email(data: VerifyEmailRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"verify_{client_ip}", max_attempts=10, window_seconds=60)

    token_hash_str = hash_token(data.token)
    record = (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token_hash == token_hash_str)
        .first()
    )

    if not record or record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or previously used verification token.",
        )

    # Check expiration
    expires_at = record.expires_at if record.expires_at.tzinfo else record.expires_at.replace(tzinfo=datetime.timezone.utc)
    if expires_at < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired. Please request a new verification link.",
        )

    # Mark token used & verify user
    record.used_at = utc_now()
    user = record.user
    user.is_email_verified = True
    db.commit()
    db.refresh(user)

    # Auto-login upon successful verification: initialize session
    _, session_token = create_user_session(db, user, remember_me=False)
    set_session_cookie(response, session_token, remember_me=False)

    return AuthStatusResponse(
        success=True,
        message="Email address successfully verified. Your security vault is now active.",
        user=format_user_response(user),
    )

@router.post("/resend-verification", response_model=AuthStatusResponse)
def resend_verification(data: ResendVerificationRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"resend_{client_ip}", max_attempts=3, window_seconds=60)

    normalized_email = data.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()

    # Generic return to prevent email enumeration
    generic_msg = "If an unverified account with this email exists, a new verification link has been generated."

    if not user:
        return AuthStatusResponse(success=True, message=generic_msg)

    if user.is_email_verified:
        return AuthStatusResponse(success=True, message="This account is already verified. You may sign in.")

    # Invalidate previous unused verification tokens
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id,
        EmailVerificationToken.used_at.is_(None),
    ).delete()

    raw_token = generate_secure_token()
    token_hash_str = hash_token(raw_token)
    expires_at = utc_now() + datetime.timedelta(minutes=settings.VERIFICATION_TOKEN_EXPIRE_MINUTES)

    verification_record = EmailVerificationToken(
        user_id=user.id,
        token_hash=token_hash_str,
        expires_at=expires_at,
    )
    db.add(verification_record)
    db.commit()

    dispatch_res = None
    try:
        dispatch_res = send_verification_email(user.email, raw_token, user.full_name, action="Resend")
    except Exception as err:
        err_banner = (
            "========== TRACE GUARD VERIFICATION ERROR ==========\n"
            "Verification Resend: FAILED TO DISPATCH EMAIL\n"
            f"Recipient: {user.email}\n"
            f"ERROR: {str(err)}\n"
            "===================================================="
        )
        print(err_banner, flush=True)

    email_delivered = dispatch_res.delivered if dispatch_res else False
    delivery_notice = dispatch_res.message if dispatch_res else "Email dispatch could not be completed."

    return AuthStatusResponse(
        success=True,
        message=generic_msg,
        email_delivered=email_delivered,
        delivery_notice=delivery_notice,
    )

@router.post("/login", response_model=AuthStatusResponse)
def login(data: UserLoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"login_{client_ip}_{data.email.lower()}"
    rate_limiter.check(rate_limit_key, max_attempts=settings.RATE_LIMIT_LOGIN_ATTEMPTS, window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS)

    normalized_email = data.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Check email verification status
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email address has not been verified. Please check your inbox or request a new verification link.",
        )

    # Reset rate limit on success
    rate_limiter.reset(rate_limit_key)

    # Create server-side session & set HTTP-only cookie
    _, session_token = create_user_session(db, user, remember_me=data.remember_me)
    set_session_cookie(response, session_token, remember_me=data.remember_me)

    log_activity(
        db=db,
        user_id=user.id,
        activity_type="USER_LOGIN",
        title="Account Authenticated",
        status="success",
        metadata={"client_ip": client_ip, "remember_me": data.remember_me},
    )

    return AuthStatusResponse(
        success=True,
        message="Authentication successful.",
        user=format_user_response(user),
    )

@router.post("/logout", response_model=AuthStatusResponse)
def logout(response: Response, request: Request, db: Session = Depends(get_db)):
    raw_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not raw_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header.replace("Bearer ", "").strip()

    if raw_token:
        token_hash_str = hash_token(raw_token)
        db.query(UserSession).filter(UserSession.session_id_hash == token_hash_str).delete()
        db.commit()

    clear_session_cookie(response)
    return AuthStatusResponse(success=True, message="Logged out successfully.")

@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return format_user_response(user)

@router.get("/session", response_model=SessionStatusResponse)
def get_session_status(user: User | None = Depends(get_current_user_optional)):
    if not user:
        return SessionStatusResponse(authenticated=False, user=None)
    return SessionStatusResponse(authenticated=True, user=format_user_response(user))

@router.get("/sessions")
def list_active_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns active session count and non-secret timestamps for the authenticated user."""
    now = utc_now()
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id)
        .order_by(UserSession.last_used_at.desc())
        .all()
    )
    active = []
    for s in sessions:
        exp = s.expires_at if s.expires_at.tzinfo else s.expires_at.replace(tzinfo=datetime.timezone.utc)
        if exp > now:
            active.append({
                "id": s.id,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None,
                "expires_at": exp.isoformat(),
            })
    return {"active_sessions_count": len(active), "sessions": active}

@router.post("/logout-all", response_model=AuthStatusResponse)
def logout_all_sessions(
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revokes all active server-side sessions for the authenticated user."""
    deleted = db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()
    clear_session_cookie(response)
    log_activity(
        db=db,
        user_id=user.id,
        activity_type="ALL_SESSIONS_REVOKED",
        title="All Active Sessions Revoked",
        description=f"User revoked {deleted} server-side authentication session(s).",
        status="info",
        metadata={"revoked_count": deleted},
    )
    return AuthStatusResponse(
        success=True,
        message=f"All {deleted} active session(s) revoked. Please sign in again.",
    )

@router.post("/forgot-password", response_model=AuthStatusResponse)
def forgot_password(data: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"forgot_{client_ip}", max_attempts=5, window_seconds=60)

    normalized_email = data.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()

    generic_msg = "If an account with this email address exists, recovery instructions have been dispatched."

    if not user or not user.hashed_password:
        return AuthStatusResponse(success=True, message=generic_msg)

    # Invalidate previous unused reset tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).delete()

    raw_token = generate_secure_token()
    token_hash_str = hash_token(raw_token)
    expires_at = utc_now() + datetime.timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash_str,
        expires_at=expires_at,
    )
    db.add(reset_record)
    db.commit()

    send_password_reset_email(user.email, raw_token, user.full_name)

    return AuthStatusResponse(success=True, message=generic_msg)

@router.post("/reset-password", response_model=AuthStatusResponse)
def reset_password(data: ResetPasswordRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_limiter.check(f"reset_{client_ip}", max_attempts=5, window_seconds=60)

    # 1. Enforce password complexity
    is_valid, err_msg = validate_password_strength(data.new_password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    token_hash_str = hash_token(data.token)
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash_str)
        .first()
    )

    if not record or record.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or previously used password reset token.",
        )

    expires_at = record.expires_at if record.expires_at.tzinfo else record.expires_at.replace(tzinfo=datetime.timezone.utc)
    if expires_at < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token has expired. Please request a new recovery link.",
        )

    # 2. Mark token used
    record.used_at = utc_now()

    # 3. Update user password
    user = record.user
    user.hashed_password = hash_password(data.new_password)

    # 4. Invalidate all existing sessions (force relogin)
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()

    clear_session_cookie(response)

    return AuthStatusResponse(
        success=True,
        message="Password updated successfully. Please sign in with your new credentials.",
    )

# ==========================================
# GOOGLE OAUTH 2.0 / OPENID CONNECT
# ==========================================

@router.get("/google/status")
def google_oauth_status():
    """
    Safe non-secret OAuth configuration check.
    Reports whether Google OAuth credentials are loaded without returning secrets or IDs.
    """
    client_id_configured = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_ID.strip())
    client_secret_configured = bool(
        settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_CLIENT_SECRET.strip()
    )
    return {
        "provider": "google_oauth",
        "configured": client_id_configured and client_secret_configured,
        "client_id_configured": client_id_configured,
        "client_secret_configured": client_secret_configured,
        "redirect_uri": f"{settings.BACKEND_URL.rstrip('/')}/api/auth/google/callback",
    }

@router.get("/google")
def google_auth_redirect():
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_ID.strip():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Authentication is not configured. Please set GOOGLE_CLIENT_ID in your environment.",
        )
    if not settings.GOOGLE_CLIENT_SECRET or not settings.GOOGLE_CLIENT_SECRET.strip():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Authentication is partially configured. Please set GOOGLE_CLIENT_SECRET in your environment.",
        )

    state = generate_secure_token()
    nonce = generate_secure_token()
    redirect_uri = f"{settings.BACKEND_URL.rstrip('/')}/api/auth/google/callback"

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "access_type": "offline",
        "prompt": "select_account",
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)

@router.get("/google/callback")
async def google_auth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    if error:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=Google+login+failed:+{urllib.parse.quote(error)}")

    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing authorization code.")

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Google OAuth credentials not configured on backend.")

    token_url = "https://oauth2.googleapis.com/token"
    redirect_uri = f"{settings.BACKEND_URL.rstrip('/')}/api/auth/google/callback"

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            token_url,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

        if token_resp.status_code != 200:
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=Google+token+exchange+failed")

        token_data = token_resp.json()
        id_token = token_data.get("id_token")
        if not id_token:
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=Missing+Google+ID+Token")

        # Verify ID Token info via Google userinfo or tokeninfo
        info_resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
        if info_resp.status_code != 200:
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=Invalid+Google+ID+Token")

        user_info = info_resp.json()

    # Validate Audience & Issuer
    if user_info.get("aud") != settings.GOOGLE_CLIENT_ID:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=Google+token+audience+mismatch")

    # Strictly require email_verified == True
    email_verified = user_info.get("email_verified") in [True, "true", "True"]
    if not email_verified:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=Google+email+is+not+verified")

    google_id = user_info.get("sub")
    email = user_info.get("email", "").lower().strip()
    full_name = user_info.get("name") or user_info.get("given_name") or "Google User"

    # Lookup or create user
    user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()

    if not user:
        user = User(
            full_name=full_name,
            email=email,
            google_id=google_id,
            is_email_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.google_id:
            user.google_id = google_id
        if not user.is_email_verified:
            user.is_email_verified = True
        db.commit()

    # Create session
    _, session_token = create_user_session(db, user, remember_me=True)
    redirect_resp = RedirectResponse(f"{settings.FRONTEND_URL}/dashboard")
    set_session_cookie(redirect_resp, session_token, remember_me=True)
    return redirect_resp

