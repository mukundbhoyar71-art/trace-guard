import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User
from app.models.scan import ExposureScan, BreachFinding
from app.models.security import PrivacyPermissionReview, PrivacyRiskHistory, SecurityRecommendation
from app.core.security import hash_password
from tests.conftest import TestSessionLocal

@pytest.fixture
def analytics_users():
    """Seeds test users for Analytics tests."""
    db = TestSessionLocal()
    u1 = User(
        email="analytics_carol@example.com",
        full_name="Carol Analyst",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    u2 = User(
        email="analytics_dan@example.com",
        full_name="Dan Analyst",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    db.add(u1)
    db.add(u2)
    db.commit()
    db.refresh(u1)
    db.refresh(u2)
    ids = {"carol_id": u1.id, "dan_id": u2.id}
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
async def test_analytics_endpoints_require_authentication():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        endpoints = [
            "/api/analytics/overview",
            "/api/analytics/risk-trends",
            "/api/analytics/exposure",
            "/api/analytics/permissions",
            "/api/analytics/recommendations",
            "/api/analytics/activity",
        ]
        for ep in endpoints:
            res = await client.get(ep)
            assert res.status_code == 401, f"Endpoint {ep} should require authentication"

@pytest.mark.asyncio
async def test_analytics_overview_empty_user(analytics_users):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "analytics_carol@example.com")
        res = await client.get("/api/analytics/overview")
        assert res.status_code == 200
        data = res.json()
        assert data["total_scans"] == 0
        assert data["verified_breaches_count"] == 0
        assert data["resolved_breaches_count"] == 0
        assert data["grade"] == "--"
        assert data["risk_category"] == "Insufficient Data"

@pytest.mark.asyncio
async def test_analytics_data_integrity_and_isolation(analytics_users):
    carol_id = analytics_users["carol_id"]
    dan_id = analytics_users["dan_id"]

    db = TestSessionLocal()
    # 1. Carol gets a live scan with verified breach findings
    scan_c = ExposureScan(
        user_id=carol_id,
        email="analytics_carol@example.com",
        status="completed",
        breaches_count=2,
        exposed_categories_count=3,
        risk_score=65,
        risk_level="high",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(scan_c)
    db.commit()
    db.refresh(scan_c)

    f1 = BreachFinding(
        scan_id=scan_c.id,
        breach_name="BreachOne",
        title="Incident One",
        severity="critical",
        data_classes=["Passwords", "Email addresses"],
        is_verified=True,
        is_resolved=True,
    )
    f2 = BreachFinding(
        scan_id=scan_c.id,
        breach_name="BreachTwo",
        title="Incident Two",
        severity="high",
        data_classes=["Phone numbers", "Email addresses"],
        is_verified=True,
        is_resolved=False,
    )
    db.add(f1)
    db.add(f2)

    # Carol gets a permission review
    p_review = PrivacyPermissionReview(
        user_id=carol_id,
        app_name="Google Chrome",
        platform="Web",
        permissions_json={"camera": "granted", "microphone": "denied", "geolocation": "prompt"},
        risk_level="high",
        is_reviewed=True,
    )
    db.add(p_review)

    # Carol gets risk history
    hist = PrivacyRiskHistory(
        user_id=carol_id,
        score=55,
        category="Moderate",
        coverage_percentage=75,
        engine_version="3.0",
        is_demo=False,
    )
    db.add(hist)

    # Dan gets a demo scan (MUST be excluded)
    scan_d = ExposureScan(
        user_id=dan_id,
        email="analytics_dan@example.com",
        status="completed",
        breaches_count=10,
        exposed_categories_count=8,
        risk_score=95,
        risk_level="critical",
        provider="haveibeenpwned",
        is_demo=True,
    )
    db.add(scan_d)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test Carol's analytics
        await login_user(client, "analytics_carol@example.com")

        # Overview
        res_overview = await client.get("/api/analytics/overview")
        assert res_overview.status_code == 200
        ov = res_overview.json()
        assert ov["total_scans"] == 1
        assert ov["verified_breaches_count"] == 2
        assert ov["resolved_breaches_count"] == 1
        assert ov["unresolved_breaches_count"] == 1
        assert ov["high_risk_permissions_count"] == 1

        # Exposure analytics
        res_exp = await client.get("/api/analytics/exposure")
        assert res_exp.status_code == 200
        exp = res_exp.json()
        assert exp["total_breaches"] == 2
        assert exp["resolved_count"] == 1
        assert exp["resolution_rate"] == 50.0
        assert exp["severity_breakdown"]["critical"] == 1
        assert exp["severity_breakdown"]["high"] == 1
        assert any(c["category"] == "Email addresses" and c["count"] == 2 for c in exp["top_exposed_categories"])

        # Permissions analytics
        res_perm = await client.get("/api/analytics/permissions")
        assert res_perm.status_code == 200
        perms = res_perm.json()
        assert perms["total_reviewed"] == 1
        assert perms["status_counts"]["granted"] == 1
        assert perms["status_counts"]["denied"] == 1
        assert perms["status_counts"]["prompt"] == 1
        assert perms["sensitive_scopes"]["camera"] == "GRANTED"
        assert perms["sensitive_scopes"]["microphone"] == "DENIED"

        # Risk trends
        res_trends = await client.get("/api/analytics/risk-trends")
        assert res_trends.status_code == 200
        tr = res_trends.json()
        assert len(tr["trends"]) >= 1
        assert tr["trends"][0]["score"] == 55

        # Recommendations analytics
        res_recs = await client.get("/api/analytics/recommendations")
        assert res_recs.status_code == 200
        recs_data = res_recs.json()
        assert "status_counts" in recs_data
        assert "priority_counts" in recs_data

        # Activity analytics
        res_act = await client.get("/api/analytics/activity")
        assert res_act.status_code == 200
        act_data = res_act.json()
        assert "activities" in act_data

        # Test Dan's isolation & demo exclusion
        await login_user(client, "analytics_dan@example.com")
        dan_ov = await client.get("/api/analytics/overview")
        assert dan_ov.status_code == 200
        d_data = dan_ov.json()
        # Dan has 0 real scans (demo scan excluded)
        assert d_data["total_scans"] == 0
        assert d_data["verified_breaches_count"] == 0

        dan_exp = await client.get("/api/analytics/exposure")
        assert dan_exp.status_code == 200
        d_exp = dan_exp.json()
        assert d_exp["total_breaches"] == 0

