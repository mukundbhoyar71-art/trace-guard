import pytest
import datetime
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.config import settings
from app.database.session import Base, get_db
from app.models.user import User, UserSession
from app.models.scan import ExposureScan, BreachFinding
from app.core.security import hash_password, hash_token
from app.services.rate_limiter import rate_limiter
import app.services.hibp as hibp_service
from app.services.hibp import HIBPTimeoutError, HIBPServiceUnavailableError, HIBPRateLimitError

from tests.conftest import test_engine, TestSessionLocal

@pytest.fixture(autouse=True)
def reset_rate_limiter():
    rate_limiter.attempts.clear()
    yield
    rate_limiter.attempts.clear()


def create_test_authenticated_user(email: str = "alice@example.com", name: str = "Alice Vance"):
    db = TestSessionLocal()
    hashed_pw = hash_password("AliceSecurePassword123!")
    user = User(
        full_name=name,
        email=email,
        hashed_password=hashed_pw,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    raw_token = f"test_session_token_{email.split('@')[0]}"
    token_hash = hash_token(raw_token)
    session = UserSession(
        user_id=user.id,
        session_id_hash=token_hash,
        expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7),
    )
    db.add(session)
    db.commit()
    db.close()
    return user, {settings.SESSION_COOKIE_NAME: raw_token}


MOCK_SAMPLE_BREACHES = [
    {
        "Name": "Adobe",
        "Title": "Adobe Creative Cloud",
        "Domain": "adobe.com",
        "BreachDate": "2013-10-04",
        "AddedDate": "2013-12-04T00:00:00Z",
        "ModifiedDate": "2013-12-04T00:00:00Z",
        "PwnCount": 152445165,
        "Description": "In October 2013, 153 million Adobe accounts were breached.",
        "LogoPath": "https://haveibeenpwned.com/Content/Images/PwnedLogos/Adobe.png",
        "DataClasses": ["Email addresses", "Password hints", "Passwords", "Usernames"],
        "IsVerified": True,
        "IsFabricated": False,
        "IsSensitive": False,
        "IsRetired": False,
        "IsSpamList": False,
        "IsMalware": False,
    },
    {
        "Name": "Canva",
        "Title": "Canva Design Platform",
        "Domain": "canva.com",
        "BreachDate": "2019-05-24",
        "AddedDate": "2019-05-30T00:00:00Z",
        "ModifiedDate": "2019-05-30T00:00:00Z",
        "PwnCount": 137000000,
        "Description": "In May 2019, Canva suffered a data breach exposing user credentials.",
        "LogoPath": "https://haveibeenpwned.com/Content/Images/PwnedLogos/Canva.png",
        "DataClasses": ["Email addresses", "Names", "Usernames", "Phone numbers"],
        "IsVerified": True,
        "IsFabricated": False,
        "IsSensitive": False,
        "IsRetired": False,
        "IsSpamList": False,
        "IsMalware": False,
    }
]


@pytest.mark.asyncio
async def test_scanner_status_unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "")
    _, cookies = create_test_authenticated_user()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/scans/status", cookies=cookies)
        assert resp.status_code == 200
        data = resp.json()
        assert data["configured"] is False
        assert data["status"] == "configuration_required"
        assert "HIBP API subscription" in data["message"]


@pytest.mark.asyncio
async def test_scanner_status_configured(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "test_mock_hibp_key_xyz")
    _, cookies = create_test_authenticated_user()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/scans/status", cookies=cookies)
        assert resp.status_code == 200
        data = resp.json()
        assert data["configured"] is True
        assert data["status"] == "active"
        assert data["provider"] == "haveibeenpwned"


@pytest.mark.asyncio
async def test_unauthenticated_scan_denied():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/scans", json={"email": "alice@example.com"})
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_unauthorized_email_scan_denied(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "test_mock_hibp_key_xyz")
    _, cookies = create_test_authenticated_user(email="alice@example.com")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/scans",
            json={"email": "victim_other_person@example.com"},
            cookies=cookies,
        )
        assert resp.status_code == 403
        assert "Unauthorized target" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_scan_when_hibp_key_missing(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "")
    _, cookies = create_test_authenticated_user(email="alice@example.com")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/scans", json={"email": "alice@example.com", "is_demo": False}, cookies=cookies)
        assert resp.status_code == 503
        assert "HIBP API subscription" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_demo_email_scan_workflow(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "")  # Demo works even without key
    user, cookies = create_test_authenticated_user(email="alice@example.com")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Run demo scan
        resp = await client.post(
            "/api/scans",
            json={"email": "alice@example.com", "is_demo": True},
            cookies=cookies,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["is_demo"] is True
        assert data["provider"] == "demo_simulation"
        assert data["breaches_count"] >= 3
        assert data["risk_score"] > 0
        assert len(data["findings"]) >= 3
        assert all(f["is_fabricated"] is True for f in data["findings"])
        assert any("AeroCloud" in f["title"] for f in data["findings"])

        # Check demo history filtering
        hist_demo = await client.get("/api/scans?is_demo=true", cookies=cookies)
        assert hist_demo.status_code == 200
        assert hist_demo.json()["total"] == 1
        assert hist_demo.json()["items"][0]["is_demo"] is True

        # Check live history filtering (should be 0)
        hist_live = await client.get("/api/scans?is_demo=false", cookies=cookies)
        assert hist_live.status_code == 200
        assert hist_live.json()["total"] == 0


@pytest.mark.asyncio
async def test_successful_scan_with_confirmed_breaches(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "test_mock_hibp_key_xyz")

    async def mock_query(email):
        return MOCK_SAMPLE_BREACHES

    monkeypatch.setattr(hibp_service, "query_hibp_breaches", mock_query)
    user, cookies = create_test_authenticated_user(email="alice@example.com")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/scans", json={"email": "alice@example.com"}, cookies=cookies)
        assert resp.status_code == 201
        data = resp.json()

        assert data["email"] == "alice@example.com"
        assert data["status"] == "completed"
        assert data["breaches_count"] == 2
        assert data["exposed_categories_count"] > 0
        assert data["risk_score"] > 20
        assert data["risk_level"] in ["moderate", "high", "critical"]
        assert len(data["findings"]) == 2
        assert len(data["security_recommendations"]) > 0

        # Check breach items details
        adobe_finding = next(f for f in data["findings"] if f["breach_name"] == "Adobe")
        assert adobe_finding["domain"] == "adobe.com"
        assert "Passwords" in adobe_finding["data_classes"]
        assert adobe_finding["severity"] == "critical"


@pytest.mark.asyncio
async def test_successful_scan_with_no_breaches(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "test_mock_hibp_key_xyz")

    async def mock_clean_query(email):
        return []

    monkeypatch.setattr(hibp_service, "query_hibp_breaches", mock_clean_query)
    _, cookies = create_test_authenticated_user(email="clean_user@example.com")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/scans", json={"email": "clean_user@example.com"}, cookies=cookies)
        assert resp.status_code == 201
        data = resp.json()

        assert data["breaches_count"] == 0
        assert data["exposed_categories_count"] == 0
        assert data["risk_score"] == 0
        assert data["risk_level"] == "low"
        assert data["findings"] == []
        assert "did not appear in any publicly known data breach indexes" in data["security_recommendations"][0]


@pytest.mark.asyncio
async def test_scan_rate_limiting(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "test_mock_hibp_key_xyz")

    async def mock_clean_query(email):
        return []

    monkeypatch.setattr(hibp_service, "query_hibp_breaches", mock_clean_query)
    _, cookies = create_test_authenticated_user(email="alice@example.com")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Rapidly send 5 requests (allowed)
        for _ in range(5):
            r = await client.post("/api/scans", json={"email": "alice@example.com"}, cookies=cookies)
            assert r.status_code == 201

        # 6th request within window -> 429 Too Many Requests
        blocked_resp = await client.post("/api/scans", json={"email": "alice@example.com"}, cookies=cookies)
        assert blocked_resp.status_code == 429
        assert "Retry-After" in blocked_resp.headers


@pytest.mark.asyncio
async def test_scan_provider_timeout_and_service_error(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "test_mock_hibp_key_xyz")

    async def mock_timeout(email):
        raise HIBPTimeoutError("Request timed out.")

    monkeypatch.setattr(hibp_service, "query_hibp_breaches", mock_timeout)
    _, cookies = create_test_authenticated_user(email="alice@example.com")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/scans", json={"email": "alice@example.com"}, cookies=cookies)
        assert resp.status_code == 504

    async def mock_unavailable(email):
        raise HIBPServiceUnavailableError("Service unavailable.")

    monkeypatch.setattr(hibp_service, "query_hibp_breaches", mock_unavailable)
    rate_limiter.attempts.clear()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/scans", json={"email": "alice@example.com"}, cookies=cookies)
        assert resp.status_code == 503


@pytest.mark.asyncio
async def test_scan_history_and_pagination(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "test_mock_hibp_key_xyz")

    async def mock_query(email):
        return []

    monkeypatch.setattr(hibp_service, "query_hibp_breaches", mock_query)
    user, cookies = create_test_authenticated_user(email="alice@example.com")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Create 3 scans
        for _ in range(3):
            r = await client.post("/api/scans", json={"email": "alice@example.com"}, cookies=cookies)
            assert r.status_code == 201

        # Query page 1, size 2
        history_resp = await client.get("/api/scans?page=1&page_size=2", cookies=cookies)
        assert history_resp.status_code == 200
        hist_data = history_resp.json()
        assert hist_data["total"] == 3
        assert len(hist_data["items"]) == 2
        assert hist_data["page"] == 1
        assert hist_data["total_pages"] == 2


@pytest.mark.asyncio
async def test_idor_protection_scan_isolation(monkeypatch):
    monkeypatch.setattr(settings, "HIBP_API_KEY", "test_mock_hibp_key_xyz")

    async def mock_query(email):
        return MOCK_SAMPLE_BREACHES

    monkeypatch.setattr(hibp_service, "query_hibp_breaches", mock_query)

    # 1. Alice creates a scan
    alice, alice_cookies = create_test_authenticated_user(email="alice@example.com", name="Alice")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        scan_resp = await client.post("/api/scans", json={"email": "alice@example.com"}, cookies=alice_cookies)
        assert scan_resp.status_code == 201
        alice_scan_id = scan_resp.json()["id"]

    # 2. Bob logs in
    bob, bob_cookies = create_test_authenticated_user(email="bob@example.com", name="Bob")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Bob tries to access Alice's scan details directly -> 404 (prevent IDOR)
        idor_scan_resp = await client.get(f"/api/scans/{alice_scan_id}", cookies=bob_cookies)
        assert idor_scan_resp.status_code == 404

        # Bob tries to access Alice's scan findings directly -> 404
        idor_findings_resp = await client.get(f"/api/scans/{alice_scan_id}/findings", cookies=bob_cookies)
        assert idor_findings_resp.status_code == 404

        # Bob views his scan history -> empty
        bob_history = await client.get("/api/scans", cookies=bob_cookies)
        assert bob_history.status_code == 200
        assert bob_history.json()["total"] == 0
        assert bob_history.json()["items"] == []
