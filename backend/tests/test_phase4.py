import pytest
import os
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User
from app.core.security import hash_password
from tests.conftest import TestSessionLocal


@pytest.fixture
def test_users():
    """Seeds two verified users for IDOR testing."""
    db = TestSessionLocal()
    u1 = User(
        email="alice@example.com",
        full_name="Alice User",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    u2 = User(
        email="bob@example.com",
        full_name="Bob User",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    db.add(u1)
    db.add(u2)
    db.commit()
    db.refresh(u1)
    db.refresh(u2)
    user1_id, user2_id = u1.id, u2.id
    db.close()
    return {"alice_id": user1_id, "bob_id": user2_id}


async def login_user(client: AsyncClient, email: str, password: str = "SuperSecret123!"):
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
    )
    assert resp.status_code == 200
    return resp


@pytest.mark.asyncio
async def test_security_recommendations_and_idor(test_users):
    """Verifies recommendations generation, updating, and IDOR prevention."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login Alice
        await login_user(client, "alice@example.com")

        # 2. Get recommendations (auto-seeds baseline)
        rec_res = await client.get("/api/security/recommendations")
        assert rec_res.status_code == 200
        data = rec_res.json()
        assert data["total"] >= 5
        assert data["pending_count"] >= 5
        assert data["completed_count"] == 0

        first_rec = data["items"][0]
        rec_id = first_rec["id"]

        # 3. Mark completed
        patch_res = await client.patch(
            f"/api/security/recommendations/{rec_id}",
            json={"status": "completed"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["status"] == "completed"

        # 4. Verify count updated
        rec_res2 = await client.get("/api/security/recommendations")
        assert rec_res2.json()["completed_count"] == 1

        # 5. Check activity timeline logged the action
        act_res = await client.get("/api/security/activities")
        assert act_res.status_code == 200
        activities = act_res.json()["items"]
        assert any(a["activity_type"] == "RECOMMENDATION_UPDATED" for a in activities)

    # 6. IDOR: Bob tries to modify Alice's recommendation
    async with AsyncClient(transport=transport, base_url="http://test") as client_bob:
        await login_user(client_bob, "bob@example.com")
        idor_res = await client_bob.patch(
            f"/api/security/recommendations/{rec_id}",
            json={"status": "dismissed"},
        )
        assert idor_res.status_code == 404


@pytest.mark.asyncio
async def test_privacy_risk_score_engine(test_users):
    """Verifies real-data-driven privacy risk score calculation, factor decomposition, and missing-data handling."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "alice@example.com")

        # 1. User with no scans -> Strictly Insufficient Data
        score_res = await client.get("/api/security/risk-score")
        assert score_res.status_code == 200
        data = score_res.json()
        assert data["category"] == "Insufficient Data"
        assert data["score"] is None
        assert data["has_sufficient_data"] is False
        assert "Complete your first security scan" in data["status_message"]
        assert len(data["factors"]) == 5

        # 2. Running a demo scan must NEVER affect production real score
        scan_res = await client.post("/api/scans", json={"email": "alice@example.com", "is_demo": True})
        assert scan_res.status_code == 201

        # Real score must still remain Insufficient Data (zero demo fallback)
        score_res2 = await client.get("/api/security/risk-score")
        assert score_res2.status_code == 200
        data2 = score_res2.json()
        assert data2["category"] == "Insufficient Data"
        assert data2["score"] is None
        assert data2["has_sufficient_data"] is False

        # 3. Record a genuine user-confirmed external HIBP check
        check_res = await client.post(
            "/api/monitoring/external-checks",
            json={
                "email": "alice@example.com",
                "breaches_found_count": 1,
                "breach_names": ["Canva - Passwords Leaked"],
                "user_notes": "Confirmed on HIBP; rotated passwords",
            },
        )
        assert check_res.status_code == 200

        # 4. Now real score is calculated with genuine verified findings
        score_res3 = await client.get("/api/security/risk-score")
        assert score_res3.status_code == 200
        data3 = score_res3.json()
        assert data3["score"] is not None
        assert data3["has_sufficient_data"] is True
        assert data3["is_demo"] is False
        assert data3["coverage_percentage"] >= 40
        assert len(data3["factors"]) == 5
        assert len(data3["improvement_recommendations"]) > 0


@pytest.mark.asyncio
async def test_monitoring_reminders_and_external_checks(test_users):
    """Verifies monitoring cadence, reminder scheduling, and user-confirmed HIBP checks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "alice@example.com")

        # 1. Schedule reminder
        rem_res = await client.post(
            "/api/monitoring/reminders",
            json={
                "target_email": "alice@example.com",
                "frequency": "monthly",
                "notes": "Monthly identity check",
            },
        )
        assert rem_res.status_code == 200
        rem_data = rem_res.json()
        assert rem_data["frequency"] == "monthly"
        assert rem_data["is_active"] is True
        reminder_id = rem_data["id"]

        # 2. Modify reminder
        patch_res = await client.patch(
            f"/api/monitoring/reminders/{reminder_id}",
            json={"frequency": "quarterly"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["frequency"] == "quarterly"

        # 3. Record user-confirmed external check
        check_res = await client.post(
            "/api/monitoring/external-checks",
            json={
                "email": "alice@example.com",
                "breaches_found_count": 2,
                "breach_names": ["Adobe", "Canva"],
                "user_notes": "Confirmed on HIBP; rotated passwords",
            },
        )
        assert check_res.status_code == 200
        check_data = check_res.json()
        assert check_data["breaches_found_count"] == 2
        assert check_data["is_verified_by_user"] is True

        # 4. Check overview reflects state
        overview_res = await client.get("/api/monitoring")
        assert overview_res.status_code == 200
        overview = overview_res.json()
        assert overview["active_reminder"] is not None
        assert overview["total_external_checks"] == 1
        assert len(overview["recent_checks"]) == 1


@pytest.mark.asyncio
async def test_privacy_permission_audits_and_idor(test_users):
    """Verifies app permission scoping, risk calculation, and IDOR protection."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "alice@example.com")

        # 1. Record high-risk review
        review_res = await client.post(
            "/api/privacy/permissions",
            json={
                "app_name": "SocialVideoApp",
                "platform": "Android",
                "permissions_json": {
                    "camera": True,
                    "microphone": True,
                    "precise_location": True,
                    "contacts": True,
                },
                "review_notes": "Excessive hardware scopes requested",
            },
        )
        assert review_res.status_code == 200
        rev = review_res.json()
        assert rev["risk_level"] in ["critical", "high"]
        review_id = rev["id"]

        # 2. Get overview
        ov_res = await client.get("/api/privacy/permissions")
        assert ov_res.status_code == 200
        assert ov_res.json()["total_apps"] == 1
        assert ov_res.json()["high_risk_permissions_count"] == 1

        # 3. Update review to reduce permissions
        patch_res = await client.patch(
            f"/api/privacy/permissions/{review_id}",
            json={
                "permissions_json": {"camera": False, "microphone": False, "precise_location": False},
            },
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["risk_level"] == "low"

    # 4. IDOR: Bob tries to delete Alice's review
    async with AsyncClient(transport=transport, base_url="http://test") as client_bob:
        await login_user(client_bob, "bob@example.com")
        del_res = await client_bob.delete(f"/api/privacy/permissions/{review_id}")
        assert del_res.status_code == 404


@pytest.mark.asyncio
async def test_real_browser_permission_audit(test_users):
    """Verifies real browser permission audit persistence, risk calculation, and privacy guarantees."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "alice@example.com")

        # 1. Before any audit, browser-audit is None
        pre_res = await client.get("/api/privacy/browser-audit")
        assert pre_res.status_code == 200
        assert pre_res.json() is None

        # 2. Save real browser audit with GRANTED, DENIED, and PROMPT statuses
        save_res = await client.post(
            "/api/privacy/browser-audit",
            json={
                "browser_name": "Google Chrome",
                "permissions": {
                    "camera": "PROMPT",
                    "microphone": "DENIED",
                    "location": "GRANTED",
                    "notifications": "PROMPT",
                },
                "notes": "Verified via navigator.permissions.query and Notifications API.",
            },
        )
        assert save_res.status_code == 200
        saved = save_res.json()
        assert "Web Browser" in saved["app_name"]
        assert saved["platform"] == "Web"
        assert saved["permissions_json"]["camera"] == "PROMPT"
        assert saved["permissions_json"]["location"] == "GRANTED"
        # Since location is GRANTED (critical scope), risk level should be elevated
        assert saved["risk_level"] in ["high", "critical", "moderate"]

        # 3. Retrieve browser audit snapshot
        get_res = await client.get("/api/privacy/browser-audit")
        assert get_res.status_code == 200
        audit = get_res.json()
        assert audit["id"] == saved["id"]
        assert audit["permissions_json"]["microphone"] == "DENIED"

        # 4. Check that activity log was created without exposing sensitive telemetry
        act_res = await client.get("/api/security/activities")
        assert act_res.status_code == 200
        acts = act_res.json()["items"]
        assert any(a["activity_type"] == "BROWSER_PERMISSIONS_AUDITED" for a in acts)

    # 5. IDOR: Bob gets his own browser audit, which should be None
    async with AsyncClient(transport=transport, base_url="http://test") as client_bob:
        await login_user(client_bob, "bob@example.com")
        bob_res = await client_bob.get("/api/privacy/browser-audit")
        assert bob_res.status_code == 200
        assert bob_res.json() is None


@pytest.mark.asyncio
async def test_report_generation_and_download(test_users):
    """Verifies ReportLab PDF generation, listing, downloading, and IDOR protection."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "alice@example.com")

        # 1. Generate report
        gen_res = await client.post(
            "/api/reports",
            json={
                "report_title": "Alice Formal Security Dossier",
                "include_demo_data": True,
            },
        )
        assert gen_res.status_code == 200
        report_data = gen_res.json()
        assert report_data["report_title"] == "Alice Formal Security Dossier"
        assert report_data["file_size_bytes"] > 0
        report_id = report_data["id"]

        # 2. List reports
        list_res = await client.get("/api/reports")
        assert list_res.status_code == 200
        assert list_res.json()["total"] == 1

        # 3. Download report PDF
        down_res = await client.get(f"/api/reports/{report_id}/download")
        assert down_res.status_code == 200
        assert down_res.headers.get("content-type") == "application/pdf"
        assert len(down_res.content) > 1000

    # 4. IDOR: Bob tries to download Alice's report
    async with AsyncClient(transport=transport, base_url="http://test") as client_bob:
        await login_user(client_bob, "bob@example.com")
        idor_res = await client_bob.get(f"/api/reports/{report_id}/download")
        assert idor_res.status_code == 404
