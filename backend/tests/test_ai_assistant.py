import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User
from app.models.scan import ExposureScan, BreachFinding
from app.models.security import PrivacyPermissionReview
from app.core.security import hash_password
from tests.conftest import TestSessionLocal

@pytest.fixture
def test_users():
    """Seeds test users for AI assistant tests."""
    db = TestSessionLocal()
    u1 = User(
        email="ai_alice@example.com",
        full_name="AI Alice",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    u2 = User(
        email="ai_bob@example.com",
        full_name="AI Bob",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    db.add(u1)
    db.add(u2)
    db.commit()
    db.refresh(u1)
    db.refresh(u2)
    ids = {"alice_id": u1.id, "bob_id": u2.id}
    db.close()
    return ids

async def login_user(client: AsyncClient, email: str, password: str = "SuperSecret123!"):
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
    )
    assert resp.status_code == 200
    return resp

@pytest.mark.asyncio
async def test_ai_status_endpoint(test_users):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request should fail
        unauth = await client.get("/api/ai/status")
        assert unauth.status_code == 401

        # 2. Authenticated request
        await login_user(client, "ai_alice@example.com")
        resp = await client.get("/api/ai/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "provider" in data
        assert "is_configured" in data
        assert "model" in data
        assert len(data["capabilities"]) >= 3

@pytest.mark.asyncio
async def test_ai_suggested_prompts(test_users):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "ai_alice@example.com")
        resp = await client.get("/api/ai/suggested-prompts")
        assert resp.status_code == 200
        data = resp.json()
        assert "prompts" in data
        assert len(data["prompts"]) >= 3
        assert any("Risk Score" in p["title"] for p in data["prompts"])

@pytest.mark.asyncio
async def test_ai_chat_flow_and_rule_fallback(test_users):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "ai_alice@example.com")

        # Ask question about risk score
        chat_req = {
            "message": "Explain my current risk score and point deductions",
            "history": [],
        }
        resp = await client.post("/api/ai/chat", json=chat_req)
        assert resp.status_code == 200
        data = resp.json()
        assert "response" in data
        assert "provider" in data
        assert "context_summary" in data
        summary = data["context_summary"]
        assert summary["live_scans_count"] == 0
        assert summary["verified_breaches_count"] == 0
        assert summary["risk_category"] == "Insufficient Data"

@pytest.mark.asyncio
async def test_ai_chat_with_real_breaches_and_isolation(test_users):
    alice_id = test_users["alice_id"]
    bob_id = test_users["bob_id"]

    # Seed a verified live scan and breach finding for Alice
    db = TestSessionLocal()
    scan = ExposureScan(
        user_id=alice_id,
        email="ai_alice@example.com",
        status="completed",
        breaches_count=1,
        exposed_categories_count=2,
        risk_score=75,
        risk_level="high",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    finding = BreachFinding(
        scan_id=scan.id,
        breach_name="AdobeBreach",
        title="Adobe Systems",
        domain="adobe.com",
        breach_date="2013-10-04",
        severity="high",
        data_classes=["Email addresses", "Password hints", "Passwords"],
        is_verified=True,
        is_resolved=False,
    )
    db.add(finding)

    # Seed a demo scan for Bob
    demo_scan = ExposureScan(
        user_id=bob_id,
        email="ai_bob@example.com",
        status="completed",
        breaches_count=5,
        exposed_categories_count=4,
        risk_score=90,
        risk_level="critical",
        provider="haveibeenpwned",
        is_demo=True,
    )
    db.add(demo_scan)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Alice chats
        await login_user(client, "ai_alice@example.com")
        resp_alice = await client.post(
            "/api/ai/chat",
            json={"message": "What verified breaches do I have?", "history": []},
        )
        assert resp_alice.status_code == 200
        data_alice = resp_alice.json()
        assert data_alice["context_summary"]["verified_breaches_count"] == 1
        assert "Adobe" in data_alice["response"]

        # Bob chats - Bob only has a demo scan, which MUST BE EXCLUDED
        await login_user(client, "ai_bob@example.com")
        resp_bob = await client.post(
            "/api/ai/chat",
            json={"message": "What verified breaches do I have?", "history": []},
        )
        assert resp_bob.status_code == 200
        data_bob = resp_bob.json()
        assert data_bob["context_summary"]["verified_breaches_count"] == 0
        assert data_bob["context_summary"]["live_scans_count"] == 0
        res_lower = data_bob["response"].lower()
        assert any(term in res_lower for term in ["verified breaches:** **0", "no verified breaches", "0 verified", "zero verified", "0 unresolved"])

@pytest.mark.asyncio
async def test_ai_diagnostic_endpoint_and_zero_leakage(test_users):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Unauthenticated request denied
        unauth = await client.get("/api/ai/diagnostic")
        assert unauth.status_code == 401

        # Authenticated request
        await login_user(client, "ai_alice@example.com")
        resp = await client.get("/api/ai/diagnostic")
        assert resp.status_code == 200
        data = resp.json()
        assert "provider" in data
        assert "is_configured" in data
        assert "model" in data
        assert "connection_status" in data
        assert "sdk_installed" in data
        assert "operational_mode" in data
        assert "key_masked" in data

        # Core required diagnostic flags
        assert "selected_provider" in data
        assert data["selected_provider"] == "gemini"
        assert "api_key_configured" in data
        assert data["api_key_configured"] is True
        assert "provider_initialized" in data
        assert data["provider_initialized"] is True
        assert "actual_request_succeeded" in data
        assert isinstance(data["actual_request_succeeded"], bool)

        # Security check: Zero secret leakage
        raw_json_str = str(data)
        from app.core.config import settings
        if settings.GEMINI_API_KEY:
            # Full API key must never appear in diagnostic response
            assert settings.GEMINI_API_KEY not in raw_json_str

