import pytest
import datetime
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.config import settings
from app.database.session import Base, get_db
from app.models.user import User, EmailVerificationToken, PasswordResetToken, UserSession
from app.core.security import hash_password, hash_token

from tests.conftest import test_engine, TestSessionLocal

@pytest.mark.asyncio
async def test_registration_and_validation():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Weak password
        resp = await client.post("/api/auth/register", json={
            "full_name": "Test User",
            "email": "test@example.com",
            "password": "weak",
            "confirm_password": "weak",
            "terms_accepted": True
        })
        assert resp.status_code in [400, 422]
        assert "at least 8 characters" in str(resp.json())

        # 2. Passwords mismatch
        resp = await client.post("/api/auth/register", json={
            "full_name": "Test User",
            "email": "test@example.com",
            "password": "StrongPassword123!",
            "confirm_password": "DifferentPassword123!",
            "terms_accepted": True
        })
        assert resp.status_code == 422 or resp.status_code == 400

        # 3. Successful registration
        resp = await client.post("/api/auth/register", json={
            "full_name": "Alex Vance",
            "email": "alex.vance@example.com",
            "password": "StrongPassword123!",
            "confirm_password": "StrongPassword123!",
            "terms_accepted": True
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["success"] is True
        assert data["user"]["email"] == "alex.vance@example.com"
        assert data["user"]["is_email_verified"] is False

        # 4. Duplicate email prevention
        resp_dup = await client.post("/api/auth/register", json={
            "full_name": "Another User",
            "email": "alex.vance@example.com",
            "password": "AnotherPassword123!",
            "confirm_password": "AnotherPassword123!",
            "terms_accepted": True
        })
        assert resp_dup.status_code == 409
        assert "already registered" in resp_dup.json()["detail"]

@pytest.mark.asyncio
async def test_email_verification_and_login_flow():
    db = TestSessionLocal()
    # Create user with raw password
    hashed_pw = hash_password("SecurePassword999!")
    user = User(full_name="Bob Security", email="bob@example.com", hashed_password=hashed_pw, is_email_verified=False)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Insert verification token
    raw_token = "valid_test_token_1234567890"
    token_hash = hash_token(raw_token)
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=30)
    ver_record = EmailVerificationToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
    db.add(ver_record)
    db.commit()
    db.close()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Unverified user attempt to login -> 403 Forbidden
        login_resp = await client.post("/api/auth/login", json={
            "email": "bob@example.com",
            "password": "SecurePassword999!"
        })
        assert login_resp.status_code == 403
        assert "not been verified" in login_resp.json()["detail"]

        # 2. Invalid verification token -> 400 Bad Request
        bad_ver = await client.post("/api/auth/verify-email", json={"token": "completely_invalid_token"})
        assert bad_ver.status_code == 400

        # 3. Valid token verification -> 200 OK + sets session cookie
        good_ver = await client.post("/api/auth/verify-email", json={"token": raw_token})
        assert good_ver.status_code == 200
        assert good_ver.json()["user"]["is_email_verified"] is True
        assert "traceguard_session" in good_ver.cookies

        # 4. Verified user can now log in
        login_ok = await client.post("/api/auth/login", json={
            "email": "bob@example.com",
            "password": "SecurePassword999!",
            "remember_me": True
        })
        assert login_ok.status_code == 200
        assert login_ok.json()["success"] is True
        assert "traceguard_session" in login_ok.cookies

        # 5. Access /api/auth/me with session cookie
        me_resp = await client.get("/api/auth/me", cookies=login_ok.cookies)
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "bob@example.com"

        # 6. Logout -> clears session & cookie
        logout_resp = await client.post("/api/auth/logout", cookies=login_ok.cookies)
        assert logout_resp.status_code == 200

        # Subsequent /me call with old cookie fails -> 401
        me_after_logout = await client.get("/api/auth/me", cookies=login_ok.cookies)
        assert me_after_logout.status_code == 401

@pytest.mark.asyncio
async def test_password_reset_flow():
    # User setup
    db = TestSessionLocal()
    hashed_pw = hash_password("OldPassword123!")
    user = User(full_name="Alice Crypto", email="alice@example.com", hashed_password=hashed_pw, is_email_verified=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    user_id = user.id
    db.close()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Forgot password request (generic message returned)
        forgot_resp = await client.post("/api/auth/forgot-password", json={"email": "alice@example.com"})
        assert forgot_resp.status_code == 200
        assert forgot_resp.json()["success"] is True

        # Nonexistent email also returns generic message (no enumeration)
        non_resp = await client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
        assert non_resp.status_code == 200

        # Insert a known reset token to test the reset-password endpoint
        raw_token = "alice_reset_token_secret_12345"
        token_hash = hash_token(raw_token)
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=30)
        db = TestSessionLocal()
        reset_record = PasswordResetToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        db.add(reset_record)
        db.commit()
        db.close()

        # 2. Reset password with valid token
        reset_resp = await client.post("/api/auth/reset-password", json={
            "token": raw_token,
            "new_password": "BrandNewPassword2026!",
            "confirm_password": "BrandNewPassword2026!"
        })
        assert reset_resp.status_code == 200
        assert reset_resp.json()["success"] is True

        # 3. Using token again fails (single-use token)
        reuse_resp = await client.post("/api/auth/reset-password", json={
            "token": raw_token,
            "new_password": "BrandNewPassword2026!",
            "confirm_password": "BrandNewPassword2026!"
        })
        assert reuse_resp.status_code == 400
        assert "Invalid or previously used" in reuse_resp.json()["detail"]

        # 4. Login with new password succeeds
        login_new = await client.post("/api/auth/login", json={
            "email": "alice@example.com",
            "password": "BrandNewPassword2026!"
        })
        assert login_new.status_code == 200

        # Old password fails
        login_old = await client.post("/api/auth/login", json={
            "email": "alice@example.com",
            "password": "OldPassword123!"
        })
        assert login_old.status_code == 401

@pytest.mark.asyncio
async def test_session_status_and_unauthorized_endpoints():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Without credentials
        sess_resp = await client.get("/api/auth/session")
        assert sess_resp.status_code == 200
        assert sess_resp.json()["authenticated"] is False

        # Accessing protected /me without cookie gives 401
        me_resp = await client.get("/api/auth/me")
        assert me_resp.status_code == 401

@pytest.mark.asyncio
async def test_google_auth_endpoint(monkeypatch):
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. When GOOGLE_CLIENT_ID is missing -> 501 and status endpoint reflects unconfigured
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", None)
        status_off = await client.get("/api/auth/google/status")
        assert status_off.status_code == 200
        assert status_off.json()["configured"] is False
        assert status_off.json()["client_id_configured"] is False
        assert status_off.json()["client_secret_configured"] is False

        resp_off = await client.get("/api/auth/google", follow_redirects=False)
        assert resp_off.status_code == 501

        # 2. When configured -> status endpoint reports true WITHOUT leaking credentials,
        #    and /api/auth/google redirects to accounts.google.com with exact callback URL
        fake_id = "test-client-id-12345.apps.googleusercontent.com"
        fake_secret = "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k"
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", fake_id)
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", fake_secret)

        status_on = await client.get("/api/auth/google/status")
        assert status_on.status_code == 200
        status_json = status_on.json()
        assert status_json["configured"] is True
        assert status_json["client_id_configured"] is True
        assert status_json["client_secret_configured"] is True
        assert status_json["redirect_uri"].endswith("/api/auth/google/callback")
        assert fake_id not in status_on.text
        assert fake_secret not in status_on.text

        resp_on = await client.get("/api/auth/google", follow_redirects=False)
        assert resp_on.status_code == 307
        location = resp_on.headers.get("location", "")
        assert location.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
        assert fake_secret not in location
        assert "redirect_uri=" in location
        assert "%2Fapi%2Fauth%2Fgoogle%2Fcallback" in location


def test_env_loading_empty_backend_placeholder_falls_back_to_root(tmp_path, monkeypatch):
    import app.core.config as cfg_mod

    fake_root = tmp_path
    fake_backend = tmp_path / "backend"
    fake_backend.mkdir()

    (fake_backend / ".env").write_text("GOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n", encoding="utf-8")
    (fake_root / ".env").write_text(
        "GOOGLE_CLIENT_ID=fallback-id-from-root\nGOOGLE_CLIENT_SECRET=fallback-secret-from-root\n",
        encoding="utf-8",
    )

    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_CLIENT_SECRET", raising=False)
    monkeypatch.setattr(cfg_mod, "_BACKEND_DIR", fake_backend)
    monkeypatch.setattr(cfg_mod, "_ROOT_DIR", fake_root)

    cfg_mod._load_nonempty_env_file(fake_backend / ".env")
    cfg_mod._load_nonempty_env_file(fake_root / ".env")
    loaded = cfg_mod.Settings(_env_file=[str(fake_backend / ".env"), str(fake_root / ".env")])

    assert loaded.GOOGLE_CLIENT_ID == "fallback-id-from-root"
    assert loaded.GOOGLE_CLIENT_SECRET == "fallback-secret-from-root"

@pytest.mark.asyncio
async def test_development_verification_email_link_output(capsys, monkeypatch):
    import re
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "development")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Register a user and capture terminal output
        reg_resp = await client.post("/api/auth/register", json={
            "full_name": "Dev User",
            "email": "dev.user@example.com",
            "password": "DevPassword123!",
            "confirm_password": "DevPassword123!",
            "terms_accepted": True,
        })
        assert reg_resp.status_code == 201

        captured = capsys.readouterr()
        combined_output = captured.out + captured.err

        # Check required terminal format
        assert "========== TRACE GUARD VERIFICATION ==========" in combined_output
        assert "Registration: SUCCESS" in combined_output
        assert "Recipient: dev.user@example.com" in combined_output
        assert "COPY VERIFICATION LINK:" in combined_output
        assert "http://localhost:5173/verify-email?token=" in combined_output
        assert "Expires: 30 minutes" in combined_output
        assert "===============================================" in combined_output

        # Extract the token from the printed URL
        match = re.search(r"http://localhost:5173/verify-email\?token=([A-Za-z0-9_\-]+)", combined_output)
        assert match is not None
        extracted_token = match.group(1)

        # 2. Verify account with the exact token printed to the terminal
        ver_resp = await client.post("/api/auth/verify-email", json={"token": extracted_token})
        assert ver_resp.status_code == 200
        assert ver_resp.json()["user"]["is_email_verified"] is True

        # 3. Test resend verification for another unverified user
        reg_resp2 = await client.post("/api/auth/register", json={
            "full_name": "Resend User",
            "email": "resend.user@example.com",
            "password": "ResendPassword123!",
            "confirm_password": "ResendPassword123!",
            "terms_accepted": True,
        })
        assert reg_resp2.status_code == 201
        capsys.readouterr()  # clear buffer

        # Call resend endpoint
        resend_resp = await client.post("/api/auth/resend-verification", json={"email": "resend.user@example.com"})
        assert resend_resp.status_code == 200

        captured_resend = capsys.readouterr()
        resend_combined = captured_resend.out + captured_resend.err

        assert "========== TRACE GUARD VERIFICATION ==========" in resend_combined
        assert "Verification Resend: SUCCESS" in resend_combined
        assert "Recipient: resend.user@example.com" in resend_combined
        assert "COPY VERIFICATION LINK:" in resend_combined
        assert "http://localhost:5173/verify-email?token=" in resend_combined
        assert "Expires: 30 minutes" in resend_combined
        assert "===============================================" in resend_combined

        match_resend = re.search(r"http://localhost:5173/verify-email\?token=([A-Za-z0-9_\-]+)", resend_combined)
        assert match_resend is not None
        new_token = match_resend.group(1)

        ver_resp2 = await client.post("/api/auth/verify-email", json={"token": new_token})
        assert ver_resp2.status_code == 200
        assert ver_resp2.json()["user"]["is_email_verified"] is True

@pytest.mark.asyncio
async def test_resend_verification_email_dispatch(capsys, monkeypatch):
    import resend
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_mock_test_key_abc123")
    monkeypatch.setattr(settings, "EMAIL_FROM", "Trace Guard <onboarding@resend.dev>")

    sent_params = []
    def mock_send(params):
        sent_params.append(params)
        return {"id": "msg_resend_mock_999"}

    monkeypatch.setattr(resend.Emails, "send", mock_send)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Register with Resend provider active
        reg_resp = await client.post("/api/auth/register", json={
            "full_name": "Resend Live User",
            "email": "live.resend@example.com",
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
            "terms_accepted": True,
        })
        assert reg_resp.status_code == 201

        # Check Resend SDK was called with correct parameters
        assert len(sent_params) == 1
        p = sent_params[0]
        assert p["from"] == "Trace Guard <onboarding@resend.dev>"
        assert p["to"] == ["live.resend@example.com"]
        assert "Verify Your TRACE GUARD Account" in p["subject"]
        assert "http://localhost:5173/verify-email?token=" in p["html"]
        assert "http://localhost:5173/verify-email?token=" in p["text"]
        assert "Verify Account &amp; Unlock Vault" in p["html"]

        # Terminal banner also logged the message ID
        captured = capsys.readouterr()
        combined = captured.out + captured.err
        assert "DISPATCHED VIA RESEND" in combined
        assert "msg_resend_mock_999" in combined

        import re
        match = re.search(r"token=([A-Za-z0-9_\-]+)", p["html"])
        assert match is not None
        extracted_token = match.group(1)

        ver_resp = await client.post("/api/auth/verify-email", json={"token": extracted_token})
        assert ver_resp.status_code == 200
        assert ver_resp.json()["user"]["is_email_verified"] is True
