import datetime
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.user import User
from app.models.scan import ExposureScan, BreachFinding
from app.models.security import (
    PrivacyPermissionReview,
    PrivacyRiskHistory,
    ExternalCheckRecord,
    SecurityRecommendation,
)
from app.core.security import hash_password
from tests.conftest import TestSessionLocal

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

@pytest.fixture
def accuracy_test_users():
    """Seeds test users for Analytics Accuracy tests."""
    db = TestSessionLocal()
    u1 = User(
        email="accuracy_user1@example.com",
        full_name="Accuracy User One",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    u2 = User(
        email="accuracy_user2@example.com",
        full_name="Accuracy User Two",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    db.add(u1)
    db.add(u2)
    db.commit()
    db.refresh(u1)
    db.refresh(u2)
    ids = {"u1_id": u1.id, "u2_id": u2.id}
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
async def test_external_verification_provenance_distinction(accuracy_test_users):
    """
    Requirement 1: EXTERNAL VERIFICATION
    Distinguish actual API-verified HIBP responses from user-confirmed external checks.
    Never label user-confirmed data as independently API-verified.
    Display the verification source and timestamp.
    Ensure the risk engine uses the correct evidence status.
    """
    user_id = accuracy_test_users["u1_id"]
    db = TestSessionLocal()

    # User has ONLY a self-attested manual external check (e.g. haveibeenpwned manual check)
    ext_check = ExternalCheckRecord(
        user_id=user_id,
        email="accuracy_user1@example.com",
        breaches_found_count=0,
        breach_names=[],
        user_notes="Checked personally on haveibeenpwned.com",
        is_verified_by_user=True,
        check_date=utc_now(),
    )
    db.add(ext_check)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "accuracy_user1@example.com")
        res = await client.get("/api/analytics/overview")
        assert res.status_code == 200
        data = res.json()

        # Last audit source must reflect User Attestation, NOT Direct API Scan
        assert data["last_audit_source"] == "User Attestation (Manual)"
        assert data["last_audit_type"] == "user_attestation"
        assert data["total_scans"] == 0

        # Verify Pillars distinction
        pillars = {p["pillar_id"]: p for p in data["pillars"]}
        # Pillar 2 (Live In-App Scans) must NOT be evaluated since only external check was performed
        assert pillars["email_breaches"]["is_evaluated"] is False
        assert pillars["email_breaches"]["status"] == "CHECK_NOT_PERFORMED"
        assert pillars["email_breaches"]["verification_type"] == "Pending Scan"

        # Pillar 3 (External Footprint Checks) must indicate User Attestation
        assert pillars["external_checks"]["is_evaluated"] is True
        assert pillars["external_checks"]["verification_type"] == "User Attestation (Manual Check)"
        assert "Self-Attested Manual Check" in pillars["external_checks"]["data_source"]
        assert "attestation by user" in pillars["external_checks"]["evidence_summary"].lower()
        assert pillars["external_checks"]["status_label"] == "User-Attested Clean (Manual Check)"

    # Now add an actual direct API scan
    db = TestSessionLocal()
    scan = ExposureScan(
        user_id=user_id,
        email="accuracy_user1@example.com",
        status="completed",
        breaches_count=0,
        exposed_categories_count=0,
        risk_score=0,
        risk_level="low",
        provider="haveibeenpwned",
        is_demo=False,
        completed_at=utc_now() + datetime.timedelta(minutes=5),
        created_at=utc_now() + datetime.timedelta(minutes=5),
    )
    db.add(scan)
    db.commit()
    db.close()

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "accuracy_user1@example.com")
        res = await client.get("/api/analytics/overview")
        assert res.status_code == 200
        data = res.json()

        # Direct API scan is now the latest audit
        assert data["last_audit_source"] == "Direct API Scan"
        assert data["last_audit_type"] == "api_scan"
        assert data["total_scans"] == 1

        pillars = {p["pillar_id"]: p for p in data["pillars"]}
        assert pillars["email_breaches"]["is_evaluated"] is True
        assert pillars["email_breaches"]["status"] == "CLEAN_CHECK"
        assert pillars["email_breaches"]["status_label"] == "API-Verified Clean (0 Leaks)"
        assert "Direct HIBP API Scan" in pillars["email_breaches"]["data_source"]

@pytest.mark.asyncio
async def test_risk_trends_engine_version_and_methodology_transition(accuracy_test_users):
    """
    Requirement 2: RISK HISTORY
    Show the scoring engine version for each historical score.
    Do not imply that a score reduction represents security improvement when scoring formula changed.
    Visually distinguish incompatible scoring versions.
    Preserve all historical records.
    """
    user_id = accuracy_test_users["u2_id"]
    db = TestSessionLocal()

    t1 = utc_now() - datetime.timedelta(days=2)
    t2 = utc_now() - datetime.timedelta(days=1)
    t3 = utc_now()

    # Snapshot 1 was recorded under Engine v2.0
    h1 = PrivacyRiskHistory(
        user_id=user_id,
        score=15,
        category="Low",
        coverage_percentage=50,
        engine_version="2.0",
        is_demo=False,
        calculated_at=t1,
    )
    # Snapshot 2 was recorded under upgraded Engine v3.0 (score changed due to formula, not remediation)
    h2 = PrivacyRiskHistory(
        user_id=user_id,
        score=5,
        category="Low",
        coverage_percentage=80,
        engine_version="3.0",
        is_demo=False,
        calculated_at=t2,
    )
    # Snapshot 3 recorded under Engine v3.0
    h3 = PrivacyRiskHistory(
        user_id=user_id,
        score=5,
        category="Low",
        coverage_percentage=80,
        engine_version="3.0",
        is_demo=False,
        calculated_at=t3,
    )
    db.add_all([h1, h2, h3])
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "accuracy_user2@example.com")
        res = await client.get("/api/analytics/risk-trends")
        assert res.status_code == 200
        data = res.json()

        assert data["has_methodology_transition"] is True
        assert "2.0" in data["engine_versions_present"]
        assert "3.0" in data["engine_versions_present"]

        trends = data["trends"]
        assert len(trends) == 3

        # First trend point: v2.0
        assert trends[0]["engine_version"] == "2.0"
        assert trends[0]["methodology_change"] is False

        # Second trend point: v3.0 transition from v2.0 -> methodology_change must be True!
        assert trends[1]["engine_version"] == "3.0"
        assert trends[1]["methodology_change"] is True

        # Third trend point: v3.0 preceded by v3.0 -> methodology_change must be False
        assert trends[2]["engine_version"] == "3.0"
        assert trends[2]["methodology_change"] is False

@pytest.mark.asyncio
async def test_permission_audit_provenance(accuracy_test_users):
    """
    Requirement 3: PERMISSION AUDIT PROVENANCE
    Display whether permission data came from browser APIs, manual user input, or an actual device-level integration.
    Never describe manually entered Android permissions as automatically device-audited.
    Clearly show the platform and audit date.
    """
    user_id = accuracy_test_users["u1_id"]
    db = TestSessionLocal()

    # Browser permission review (Web platform, Google Chrome)
    web_review = PrivacyPermissionReview(
        user_id=user_id,
        app_name="Google Chrome",
        platform="Web",
        permissions_json={"camera": "granted", "geolocation": "prompt"},
        risk_level="high",
        is_reviewed=True,
    )
    # Android manual checklist review
    android_review = PrivacyPermissionReview(
        user_id=user_id,
        app_name="WhatsApp",
        platform="Android",
        permissions_json={"contacts": "granted", "microphone": "granted", "location": "denied"},
        risk_level="medium",
        is_reviewed=True,
    )
    # Windows application checklist
    win_review = PrivacyPermissionReview(
        user_id=user_id,
        app_name="Slack",
        platform="Windows",
        permissions_json={"notifications": "granted"},
        risk_level="low",
        is_reviewed=True,
    )
    db.add_all([web_review, android_review, win_review])
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_user(client, "accuracy_user1@example.com")
        res = await client.get("/api/analytics/permissions")
        assert res.status_code == 200
        data = res.json()

        assert "audit_provenance" in data
        provenance_list = {item["app_name"]: item for item in data["audit_provenance"]}

        # 1. Web review
        web_item = provenance_list["Google Chrome"]
        assert web_item["platform"] == "Web"
        assert web_item["provenance"] == "Browser Permissions API (navigator.permissions)"
        assert web_item["is_automated_device_audit"] is False

        # 2. Android review
        android_item = provenance_list["WhatsApp"]
        assert android_item["platform"] == "Android"
        assert android_item["provenance"] == "Manual User Attestation (Android Checklist)"
        assert android_item["is_automated_device_audit"] is False
        assert "contacts" in android_item["granted_scopes"]

        # 3. Windows review
        win_item = provenance_list["Slack"]
        assert win_item["platform"] == "Windows"
        assert win_item["provenance"] == "Manual User Attestation (Windows Checklist)"
        assert win_item["is_automated_device_audit"] is False

@pytest.mark.asyncio
async def test_assessment_coverage_five_pillars_and_empty_user(accuracy_test_users):
    """
    Requirement 4 & 5: ASSESSMENT COVERAGE & DASHBOARD LABELS
    Explain which pillars have been evaluated and what evidence supports each pillar.
    Distinguish zero findings from checks not performed.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # u2 has only risk history snapshots, no scans or permissions
        await login_user(client, "accuracy_user2@example.com")
        res = await client.get("/api/analytics/overview")
        assert res.status_code == 200
        data = res.json()

        assert "pillars" in data
        assert len(data["pillars"]) == 5

        # Check the 5 pillars metadata and weights
        weights = {p["pillar_id"]: p["weight"] for p in data["pillars"]}
        assert weights["account_security"] == 20  # Identity Verification
        assert weights["email_breaches"] == 30   # Live In-App Scans
        assert weights["external_checks"] == 25  # External Footprint Checks
        assert weights["permissions"] == 15      # Device Permissions
        assert weights["hygiene"] == 10          # Monitoring Cadence

        pillars = {p["pillar_id"]: p for p in data["pillars"]}

        # Pillar 1 is evaluated because u2 is email verified
        assert pillars["account_security"]["is_evaluated"] is True
        assert pillars["account_security"]["verification_type"] == "Cryptographic Identity"

        # Pillar 2 is NOT evaluated because u2 has 0 scans performed
        assert pillars["email_breaches"]["is_evaluated"] is False
        assert pillars["email_breaches"]["status"] == "CHECK_NOT_PERFORMED"
        assert pillars["email_breaches"]["status_label"] == "Pending Scan"

        # Pillar 3 is NOT evaluated because u2 has 0 external checks
        assert pillars["external_checks"]["is_evaluated"] is False
        assert pillars["external_checks"]["status"] == "CHECK_NOT_PERFORMED"

        # Pillar 4 is NOT evaluated because u2 has 0 permission reviews
        assert pillars["permissions"]["is_evaluated"] is False
        assert pillars["permissions"]["status"] == "CHECK_NOT_PERFORMED"
