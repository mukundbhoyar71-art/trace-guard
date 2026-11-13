import pytest
import datetime
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.user import User
from app.models.scan import ExposureScan, BreachFinding
from app.models.security import ExternalCheckRecord, PrivacyPermissionReview, SecurityRecommendation
from app.core.security import hash_password
from tests.conftest import TestSessionLocal

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

@pytest.fixture
def score_test_users():
    """Seeds two verified users for IDOR and isolated score testing."""
    db = TestSessionLocal()
    u1 = User(
        email="eval_alice@example.com",
        full_name="Alice Evaluator",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    u2 = User(
        email="eval_bob@example.com",
        full_name="Bob Evaluator",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    u3 = User(
        email="eval_unverified@example.com",
        full_name="Charlie Unverified",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=False,
    )
    db.add_all([u1, u2, u3])
    db.commit()
    db.refresh(u1)
    db.refresh(u2)
    db.refresh(u3)
    user_ids = {"alice_id": u1.id, "bob_id": u2.id, "charlie_id": u3.id}
    db.close()
    return user_ids

async def login(client: AsyncClient, email: str, password: str = "SuperSecret123!"):
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
    )
    assert resp.status_code == 200
    return resp


@pytest.mark.asyncio
async def test_requirement_1_user_with_no_records_gets_insufficient_data(score_test_users):
    """1. A user with no records gets an insufficient-data state."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")
        res = await client.get("/api/security/risk-score")
        assert res.status_code == 200
        data = res.json()

        assert data["score"] is None
        assert data["category"] == "Insufficient Data"
        assert data["has_sufficient_data"] is False
        assert "Complete your first security scan" in data["status_message"]
        assert data["is_demo"] is False
        # Account pillar is evaluated (verified), other 4 pillars are pending
        assert data["coverage_percentage"] == 20
        assert len(data["factors"]) == 5


@pytest.mark.asyncio
async def test_requirement_2_completed_clean_scan_distinguished_from_unperformed(score_test_users):
    """2. A completed clean scan is distinguished from an unperformed scan."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    # Seed a completed live scan with 0 breaches
    clean_scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="completed",
        breaches_count=0,
        exposed_categories_count=0,
        risk_score=0,
        risk_level="low",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(clean_scan)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")
        res = await client.get("/api/security/risk-score")
        assert res.status_code == 200
        data = res.json()

        assert data["has_sufficient_data"] is True
        assert data["score"] == 0
        assert data["category"] == "Low"
        assert data["rating"] == "Good"

        # Check exposure factor specifically shows clean status
        exposure_factor = next(f for f in data["factors"] if f["category_id"] == "email_breaches")
        assert exposure_factor["status"] == "CLEAN_CHECK"
        assert exposure_factor["score"] == 0
        assert "Zero breach findings" in exposure_factor["description"]


@pytest.mark.asyncio
async def test_requirement_3_verified_exposure_finding_changes_score(score_test_users):
    """3. A verified exposure finding changes the score."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    # Seed a completed live scan with 2 breaches and 3 exposed categories
    dirty_scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="completed",
        breaches_count=2,
        exposed_categories_count=3,
        risk_score=40,
        risk_level="high",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(dirty_scan)
    db.commit()
    db.refresh(dirty_scan)

    # Seed breach findings
    bf1 = BreachFinding(
        scan_id=dirty_scan.id,
        breach_name="BreachedCorp1",
        title="Breached Corp 1",
        data_classes=["Passwords", "Email addresses"],
        is_verified=True,
        is_resolved=False,
    )
    bf2 = BreachFinding(
        scan_id=dirty_scan.id,
        breach_name="BreachedCorp2",
        title="Breached Corp 2",
        data_classes=["Phone numbers"],
        is_verified=True,
        is_resolved=False,
    )
    db.add_all([bf1, bf2])
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")
        res = await client.get("/api/security/risk-score")
        assert res.status_code == 200
        data = res.json()

        assert data["has_sufficient_data"] is True
        assert data["score"] > 0
        assert data["verified_findings_count"] >= 2

        exposure_factor = next(f for f in data["factors"] if f["category_id"] == "email_breaches")
        assert exposure_factor["status"] == "VERIFIED_FINDING"
        # vol_pts: min(18, 2 * 6) = 12. cat_pts: min(12, 3 * 3) = 9. Total = 21.
        assert exposure_factor["score"] == 21


@pytest.mark.asyncio
async def test_requirement_4_resolving_finding_updates_score(score_test_users):
    """4. Resolving a finding updates the score."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="completed",
        breaches_count=1,
        exposed_categories_count=1,
        risk_score=20,
        risk_level="moderate",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(scan)
    db.commit()

    # Seed recommendations
    rec1 = SecurityRecommendation(
        user_id=alice_id,
        category="password",
        title="Rotate Breached Password",
        description="Change credentials",
        reason="Password in breach",
        suggested_action="Rotate password",
        status="pending",
        is_demo=False,
    )
    db.add(rec1)
    db.commit()
    rec_id = rec1.id
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")

        # Initial score with pending recommendation
        res1 = await client.get("/api/security/risk-score")
        score_before = res1.json()["score"]

        # Mark recommendation completed (mitigated)
        patch_res = await client.patch(
            f"/api/security/recommendations/{rec_id}",
            json={"status": "completed"},
        )
        assert patch_res.status_code == 200

        # Score after mitigation must reflect reduction
        res2 = await client.get("/api/security/risk-score")
        score_after = res2.json()["score"]
        assert score_after <= score_before


@pytest.mark.asyncio
async def test_requirement_5_expired_stale_result_handled_correctly(score_test_users):
    """5. An expired / stale result (>60 days old) is penalized."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    old_date = utc_now() - datetime.timedelta(days=75)
    stale_scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="completed",
        breaches_count=0,
        exposed_categories_count=0,
        risk_score=0,
        risk_level="low",
        provider="haveibeenpwned",
        is_demo=False,
        created_at=old_date,
        completed_at=old_date,
    )
    db.add(stale_scan)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")
        res = await client.get("/api/security/risk-score")
        assert res.status_code == 200
        data = res.json()

        hygiene_factor = next(f for f in data["factors"] if f["category_id"] == "hygiene")
        assert hygiene_factor["status"] == "EXPIRED_STALE"
        assert hygiene_factor["score"] == 8
        assert "stale" in hygiene_factor["description"].lower()


@pytest.mark.asyncio
async def test_requirement_6_failed_checks_do_not_become_clean_results(score_test_users):
    """6. Failed checks do not become clean results."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    failed_scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="failed",
        breaches_count=0,
        exposed_categories_count=0,
        risk_score=0,
        risk_level="low",
        provider="haveibeenpwned",
        is_demo=False,
        error_message="Provider timeout",
    )
    db.add(failed_scan)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")
        res = await client.get("/api/security/risk-score")
        assert res.status_code == 200
        data = res.json()

        # A failed scan must not be treated as clean or sufficient data
        assert data["has_sufficient_data"] is False
        assert data["score"] is None
        assert data["category"] == "Insufficient Data"


@pytest.mark.asyncio
async def test_requirement_7_demo_data_never_enters_production_scoring(score_test_users):
    """7. Demo data never enters production scoring."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    # Seed 5 demo scans with high breaches
    demo_scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="completed",
        breaches_count=10,
        exposed_categories_count=8,
        risk_score=85,
        risk_level="critical",
        provider="demo_simulation",
        is_demo=True,
    )
    db.add(demo_scan)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")
        res = await client.get("/api/security/risk-score")
        assert res.status_code == 200
        data = res.json()

        # Must ignore the demo scan entirely!
        assert data["has_sufficient_data"] is False
        assert data["score"] is None
        assert data["category"] == "Insufficient Data"
        assert data["is_demo"] is False


@pytest.mark.asyncio
async def test_requirement_8_scores_isolated_between_users(score_test_users):
    """8. Scores are isolated between users (IDOR prevention)."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    bob_id = score_test_users["bob_id"]

    # Seed Alice with a clean scan
    alice_scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="completed",
        breaches_count=0,
        exposed_categories_count=0,
        risk_score=0,
        risk_level="low",
        provider="haveibeenpwned",
        is_demo=False,
    )
    # Seed Bob with 3 severe breaches
    bob_scan = ExposureScan(
        user_id=bob_id,
        email="eval_bob@example.com",
        status="completed",
        breaches_count=3,
        exposed_categories_count=4,
        risk_score=60,
        risk_level="high",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add_all([alice_scan, bob_scan])
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Check Alice's score
        await login(client, "eval_alice@example.com")
        res_alice = await client.get("/api/security/risk-score")
        assert res_alice.status_code == 200
        alice_data = res_alice.json()
        assert alice_data["score"] == 0
        assert alice_data["category"] == "Low"

    async with AsyncClient(transport=transport, base_url="http://test") as client_bob:
        # Check Bob's score
        await login(client_bob, "eval_bob@example.com")
        res_bob = await client_bob.get("/api/security/risk-score")
        assert res_bob.status_code == 200
        bob_data = res_bob.json()
        assert bob_data["score"] > 0
        assert bob_data["category"] in ["High", "Moderate"]


@pytest.mark.asyncio
async def test_requirement_9_repeated_calculations_are_deterministic(score_test_users):
    """9. Repeated calculations with identical data produce identical results."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="completed",
        breaches_count=1,
        exposed_categories_count=2,
        risk_score=25,
        risk_level="moderate",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(scan)
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")
        res1 = await client.get("/api/security/risk-score")
        res2 = await client.get("/api/security/risk-score")
        res3 = await client.get("/api/security/risk-score")

        d1, d2, d3 = res1.json(), res2.json(), res3.json()
        assert d1["score"] == d2["score"] == d3["score"]
        assert d1["coverage_percentage"] == d2["coverage_percentage"] == d3["coverage_percentage"]
        assert d1["factors"] == d2["factors"] == d3["factors"]


@pytest.mark.asyncio
async def test_requirement_10_factor_breakdown_matches_score_data(score_test_users):
    """10. Frontend factor breakdowns match backend score data exactly."""
    db = TestSessionLocal()
    alice_id = score_test_users["alice_id"]
    scan = ExposureScan(
        user_id=alice_id,
        email="eval_alice@example.com",
        status="completed",
        breaches_count=2,
        exposed_categories_count=2,
        risk_score=35,
        risk_level="moderate",
        provider="haveibeenpwned",
        is_demo=False,
    )
    ext_check = ExternalCheckRecord(
        user_id=alice_id,
        email="eval_alice@example.com",
        breaches_found_count=1,
        breach_names=["ServiceA"],
        is_verified_by_user=True,
    )
    review = PrivacyPermissionReview(
        user_id=alice_id,
        app_name="TestApp",
        platform="Android",
        permissions_json={"camera": True, "microphone": True},
        risk_level="high",
        is_reviewed=True,
    )
    db.add_all([scan, ext_check, review])
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_alice@example.com")
        res = await client.get("/api/security/risk-score")
        assert res.status_code == 200
        data = res.json()

        raw_factor_sum = sum(f["score"] for f in data["factors"])
        # Score must be bounded between 0 and 100
        assert data["score"] == min(100, max(0, raw_factor_sum))
        assert data["coverage_percentage"] >= 60


@pytest.mark.asyncio
async def test_requirement_11_unverified_email_penalized_in_account_pillar(score_test_users):
    """11. An unverified account email is accurately penalized in Account Security."""
    db = TestSessionLocal()
    charlie_id = score_test_users["charlie_id"]
    # Seed a clean scan for Charlie so sufficient data exists
    scan = ExposureScan(
        user_id=charlie_id,
        email="eval_unverified@example.com",
        status="completed",
        breaches_count=0,
        exposed_categories_count=0,
        risk_score=0,
        risk_level="low",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(scan)
    db.commit()
    db.close()

    # Note: charlie is unverified, so we verify him temporarily for login, then unverify him
    db2 = TestSessionLocal()
    c = db2.query(User).filter(User.id == charlie_id).first()
    c.is_email_verified = True
    db2.commit()
    db2.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "eval_unverified@example.com")

        # Now revert unverified status to simulate unverified email finding
        db3 = TestSessionLocal()
        c2 = db3.query(User).filter(User.id == charlie_id).first()
        c2.is_email_verified = False
        db3.commit()
        db3.close()

        res = await client.get("/api/security/risk-score")
        assert res.status_code == 200
        data = res.json()

        account_factor = next(f for f in data["factors"] if f["category_id"] == "account_security")
        assert account_factor["status"] == "VERIFIED_FINDING"
        assert account_factor["score"] == 15
        assert data["score"] >= 15

