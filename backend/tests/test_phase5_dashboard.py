import datetime
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.user import User
from app.models.scan import ExposureScan, BreachFinding
from app.models.security import (
    ExternalCheckRecord,
    PrivacyPermissionReview,
    SecurityRecommendation,
    MonitoringReminder,
    MonitoringConfig,
    MonitoringExecution,
    SecurityActivity,
    SecurityReport,
)
from app.services.monitoring_scheduler import run_due_monitoring_checks
import app.services.hibp as hibp_service
from app.core.security import hash_password
import app.services.report_generator as report_generator_service
from tests.conftest import TestSessionLocal


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


@pytest.fixture(autouse=True)
def isolated_report_dir(tmp_path, monkeypatch):
    """Stores generated test PDFs inside pytest's temporary directory."""
    monkeypatch.setattr(report_generator_service, "REPORT_STORAGE_DIR", str(tmp_path))


@pytest.fixture
def phase5_users():
    """Creates Alice and Bob for Phase 5 multi-user / IDOR / empty-state testing."""
    db = TestSessionLocal()
    alice = User(
        email="p5_alice@example.com",
        full_name="Phase5 Alice",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    bob = User(
        email="p5_bob@example.com",
        full_name="Phase5 Bob",
        hashed_password=hash_password("SuperSecret123!"),
        is_email_verified=True,
    )
    db.add_all([alice, bob])
    db.commit()
    db.refresh(alice)
    db.refresh(bob)
    ids = {"alice_id": alice.id, "bob_id": bob.id}
    db.close()
    return ids


async def login(client: AsyncClient, email: str, password: str = "SuperSecret123!"):
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": password, "remember_me": True},
    )
    assert resp.status_code == 200
    return resp


@pytest.mark.asyncio
async def test_phase5_1_scan_history_real_records_and_filters(phase5_users):
    """
    1. Scan history retrieves real user records with verified/unverified breakdown,
       scan type labels, search/status/date filtering, and single-scan details.
    """
    alice_id = phase5_users["alice_id"]
    now = utc_now()
    older = now - datetime.timedelta(days=10)

    db = TestSessionLocal()
    live_scan = ExposureScan(
        user_id=alice_id,
        email="p5_alice@example.com",
        status="completed",
        breaches_count=2,
        exposed_categories_count=3,
        risk_score=48,
        risk_level="high",
        provider="haveibeenpwned",
        is_demo=False,
        created_at=now - datetime.timedelta(hours=1),
        completed_at=now - datetime.timedelta(hours=1),
    )
    failed_scan = ExposureScan(
        user_id=alice_id,
        email="p5_alice@example.com",
        status="failed",
        breaches_count=0,
        exposed_categories_count=0,
        risk_score=0,
        risk_level="low",
        provider="haveibeenpwned",
        is_demo=False,
        error_message="Provider timeout during audit",
        created_at=older,
        completed_at=older,
    )
    db.add_all([live_scan, failed_scan])
    db.commit()
    db.refresh(live_scan)
    db.refresh(failed_scan)

    bf_verified = BreachFinding(
        scan_id=live_scan.id,
        breach_name="Adobe",
        title="Adobe Creative Cloud",
        domain="adobe.com",
        breach_date="2013-10-04",
        data_classes=["Passwords", "Email addresses"],
        is_verified=True,
        is_fabricated=False,
        severity="critical",
        is_resolved=False,
    )
    bf_unverified = BreachFinding(
        scan_id=live_scan.id,
        breach_name="UnverifiedDump",
        title="Unverified Forum Leak",
        domain="forum.example.org",
        breach_date="2020-01-15",
        data_classes=["Email addresses"],
        is_verified=False,
        is_fabricated=False,
        severity="low",
        is_resolved=False,
    )
    db.add_all([bf_verified, bf_unverified])
    db.commit()
    live_scan_id = live_scan.id
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        # Full live scan history
        res = await client.get("/api/scans?is_demo=false")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 2
        assert data["live_total"] == 2
        assert data["demo_total"] == 0

        top_scan = data["items"][0]
        assert top_scan["id"] == live_scan_id
        assert top_scan["scan_type"] == "Live HIBP API Scan"
        assert top_scan["verified_findings_count"] == 1
        assert top_scan["unverified_findings_count"] == 1
        assert top_scan["risk_score"] == 48
        assert top_scan["risk_level"] == "high"

        # Status filter
        res_failed = await client.get("/api/scans?is_demo=false&status=failed")
        assert res_failed.status_code == 200
        assert res_failed.json()["total"] == 1
        assert res_failed.json()["items"][0]["status"] == "failed"

        # Search filter matching finding name ("Adobe")
        res_search = await client.get("/api/scans?is_demo=false&search=Adobe")
        assert res_search.status_code == 200
        assert res_search.json()["total"] == 1
        assert res_search.json()["items"][0]["id"] == live_scan_id

        # Date range filter (only recent scan)
        today_str = now.date().isoformat()
        res_date = await client.get(f"/api/scans?is_demo=false&date_from={today_str}&date_to={today_str}")
        assert res_date.status_code == 200
        assert res_date.json()["total"] == 1
        assert res_date.json()["items"][0]["id"] == live_scan_id

        # Individual scan detail retrieval
        detail_res = await client.get(f"/api/scans/{live_scan_id}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert len(detail["findings"]) == 2
        assert detail["verified_findings_count"] == 1
        assert detail["unverified_findings_count"] == 1


@pytest.mark.asyncio
async def test_phase5_2_demo_scans_isolated_from_production(phase5_users):
    """
    2. Demo scans do not pollute production scan history (is_demo=false or scan_type=live)
       or monitoring live scan metrics.
    """
    alice_id = phase5_users["alice_id"]
    db = TestSessionLocal()
    demo_scan = ExposureScan(
        user_id=alice_id,
        email="p5_alice@example.com",
        status="completed",
        breaches_count=4,
        exposed_categories_count=5,
        risk_score=80,
        risk_level="critical",
        provider="demo_simulation",
        is_demo=True,
    )
    db.add(demo_scan)
    db.commit()
    db.refresh(demo_scan)
    db.add(
        BreachFinding(
            scan_id=demo_scan.id,
            breach_name="DemoLeak",
            title="AeroCloud Synthetic Demo",
            data_classes=["Passwords"],
            is_verified=True,
            is_fabricated=True,
            severity="critical",
        )
    )
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        # Production scan history strictly excludes demo scans
        live_res = await client.get("/api/scans?is_demo=false")
        assert live_res.status_code == 200
        live_data = live_res.json()
        assert live_data["total"] == 0
        assert live_data["items"] == []
        assert live_data["live_total"] == 0
        assert live_data["demo_total"] == 1

        # Separate demo tab retrieves demo scans and classifies fabricated findings as unverified
        demo_res = await client.get("/api/scans?scan_type=demo")
        assert demo_res.status_code == 200
        demo_data = demo_res.json()
        assert demo_data["total"] == 1
        assert demo_data["items"][0]["is_demo"] is True
        assert demo_data["items"][0]["scan_type"] == "Simulated Demo Scan"
        assert demo_data["items"][0]["verified_findings_count"] == 0
        assert demo_data["items"][0]["unverified_findings_count"] == 1

        # Monitoring overview must NOT treat demo scan as live check
        mon_res = await client.get("/api/monitoring")
        assert mon_res.status_code == 200
        mon = mon_res.json()
        assert mon["live_scans_count"] == 0
        assert mon["total_scans_recorded"] == 0
        assert mon["demo_scans_count"] == 1
        assert mon["last_scan_date"] is None
        assert mon["last_completed_check_source"] == "Never Performed"
        assert mon["monitoring_status"] == "No Audits Yet"
        assert mon["recent_live_scans"] == []


@pytest.mark.asyncio
async def test_phase5_3_idor_scan_history_isolation(phase5_users):
    """
    3. IDOR protection prevents Bob from viewing Alice's scan history, scan details, or findings.
    """
    alice_id = phase5_users["alice_id"]
    db = TestSessionLocal()
    alice_scan = ExposureScan(
        user_id=alice_id,
        email="p5_alice@example.com",
        status="completed",
        breaches_count=1,
        exposed_categories_count=2,
        risk_score=30,
        risk_level="moderate",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(alice_scan)
    db.commit()
    db.refresh(alice_scan)
    alice_scan_id = alice_scan.id
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_bob@example.com")

        hist_res = await client.get("/api/scans")
        assert hist_res.status_code == 200
        assert hist_res.json()["total"] == 0
        assert hist_res.json()["items"] == []

        detail_res = await client.get(f"/api/scans/{alice_scan_id}")
        assert detail_res.status_code == 404

        findings_res = await client.get(f"/api/scans/{alice_scan_id}/findings")
        assert findings_res.status_code == 404


@pytest.mark.asyncio
async def test_phase5_4_and_5_pdf_report_generation_real_data_and_download(phase5_users):
    """
    4 & 5. PDF report generation succeeds with genuine user data across all tables
           (including ExternalCheckRecord, PrivacyPermissionReview, ExposureScan + BreachFinding,
           SecurityRecommendation, MonitoringReminder, and special XML chars),
           and download returns valid %PDF- bytes.
    """
    alice_id = phase5_users["alice_id"]
    db = TestSessionLocal()

    scan = ExposureScan(
        user_id=alice_id,
        email="p5_alice@example.com",
        status="completed",
        breaches_count=1,
        exposed_categories_count=2,
        risk_score=42,
        risk_level="high",
        provider="haveibeenpwned",
        is_demo=False,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    bf = BreachFinding(
        scan_id=scan.id,
        breach_name="AcmeAndCo",
        title="Acme & Co Breach <2024>",
        domain="acme.example",
        breach_date="2024-02-01",
        data_classes=["Passwords", "Email addresses"],
        is_verified=True,
        is_fabricated=False,
        severity="critical",
        is_resolved=False,
    )
    ext = ExternalCheckRecord(
        user_id=alice_id,
        email="p5_alice@example.com",
        breaches_found_count=1,
        breach_names=["LegacyCorp & Forum"],
        user_notes="Verified on HIBP & rotated password <now>",
        is_verified_by_user=True,
    )
    perm_browser = PrivacyPermissionReview(
        user_id=alice_id,
        app_name="Web Browser (Chrome)",
        platform="Web",
        permissions_json={"camera": "PROMPT", "microphone": "DENIED", "location": "GRANTED"},
        risk_level="high",
        is_reviewed=True,
    )
    perm_mobile = PrivacyPermissionReview(
        user_id=alice_id,
        app_name="Notes Mobile",
        platform="Android",
        permissions_json={"contacts": False, "camera": False},
        risk_level="low",
        is_reviewed=True,
    )
    rem = MonitoringReminder(
        user_id=alice_id,
        target_email="p5_alice@example.com",
        frequency="monthly",
        next_reminder_at=utc_now() + datetime.timedelta(days=30),
        is_active=True,
    )
    demo_rec = SecurityRecommendation(
        user_id=alice_id,
        category="password",
        title="[DEMO] Fictional Leakage",
        description="Should not enter production-only report",
        reason="Demo",
        suggested_action="Ignore",
        priority="low",
        status="pending",
        is_demo=True,
    )
    db.add_all([bf, ext, perm_browser, perm_mobile, rem, demo_rec])
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        # Generate production dossier (default include_demo_data=False)
        gen_res = await client.post(
            "/api/reports",
            json={"report_title": "Alice Q4 Production Audit & Dossier"},
        )
        assert gen_res.status_code == 200
        rep = gen_res.json()
        assert rep["is_demo"] is False
        assert rep["report_type"] == "Production Security Dossier"
        assert rep["status"] == "Available"
        assert rep["risk_score"] is not None
        assert rep["file_size_bytes"] > 1000
        assert rep["summary_json"]["live_scans_count"] == 1
        assert rep["summary_json"]["live_findings_count"] == 1
        assert rep["summary_json"]["external_checks_count"] == 1
        assert rep["summary_json"]["permission_reviews_count"] == 2
        assert rep["summary_json"]["monitoring_enabled"] is True

        report_id = rep["id"]

        # Retrieve report metadata
        get_res = await client.get(f"/api/reports/{report_id}")
        assert get_res.status_code == 200
        assert get_res.json()["id"] == report_id
        assert get_res.json()["status"] == "Available"

        # Download report & verify real PDF magic header
        dl_res = await client.get(f"/api/reports/{report_id}/download")
        assert dl_res.status_code == 200
        assert dl_res.headers.get("content-type") == "application/pdf"
        assert dl_res.content.startswith(b"%PDF-")
        assert len(dl_res.content) == rep["file_size_bytes"]

        # Also test Insufficient Data report generation for Bob (zero records)
        await login(client, "p5_bob@example.com")
        bob_gen = await client.post("/api/reports", json={})
        assert bob_gen.status_code == 200
        bob_rep = bob_gen.json()
        assert bob_rep["risk_score"] is None
        assert bob_rep["risk_category"] == "Insufficient Data"
        assert bob_rep["summary_json"]["has_sufficient_data"] is False

        bob_dl = await client.get(f"/api/reports/{bob_rep['id']}/download")
        assert bob_dl.status_code == 200
        assert bob_dl.content.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_phase5_6_idor_report_isolation(phase5_users):
    """
    6. IDOR protection prevents Bob from viewing or downloading Alice's PDF reports.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")
        gen_res = await client.post(
            "/api/reports",
            json={"report_title": "Alice Confidential Dossier", "include_demo_data": False},
        )
        assert gen_res.status_code == 200
        alice_report_id = gen_res.json()["id"]

        # Switch to Bob
        await login(client, "p5_bob@example.com")
        list_res = await client.get("/api/reports")
        assert list_res.status_code == 200
        assert list_res.json()["total"] == 0

        detail_res = await client.get(f"/api/reports/{alice_report_id}")
        assert detail_res.status_code == 404

        dl_res = await client.get(f"/api/reports/{alice_report_id}/download")
        assert dl_res.status_code == 404


@pytest.mark.asyncio
async def test_phase5_7_and_8_monitoring_history_and_reminder_lifecycle(phase5_users):
    """
    7 & 8. Monitoring history uses real live scans & external checks (excluding demo scans),
           and reminder creation, frequency update, pause/re-enable toggle, delete,
           and IDOR protections all behave accurately.
    """
    alice_id = phase5_users["alice_id"]
    now = utc_now()

    db = TestSessionLocal()
    # Seed 1 live scan & 1 ignored demo scan
    db.add(
        ExposureScan(
            user_id=alice_id,
            email="p5_alice@example.com",
            status="completed",
            breaches_count=0,
            exposed_categories_count=0,
            risk_score=0,
            risk_level="low",
            provider="haveibeenpwned",
            is_demo=False,
            created_at=now - datetime.timedelta(days=2),
            completed_at=now - datetime.timedelta(days=2),
        )
    )
    db.add(
        ExposureScan(
            user_id=alice_id,
            email="p5_alice@example.com",
            status="completed",
            breaches_count=3,
            exposed_categories_count=4,
            risk_score=75,
            risk_level="critical",
            provider="demo_simulation",
            is_demo=True,
        )
    )
    db.commit()
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        # 1. Schedule monthly reminder
        rem_res = await client.post(
            "/api/monitoring/reminders",
            json={
                "target_email": "p5_alice@example.com",
                "frequency": "monthly",
                "notes": "Check on first Monday",
            },
        )
        assert rem_res.status_code == 200
        rem_data = rem_res.json()
        rem_id = rem_data["id"]
        assert rem_data["is_active"] is True
        assert rem_data["frequency"] == "monthly"

        # 2. Overview reflects live scan + active reminder + excludes demo scan from live metrics
        ov1 = (await client.get("/api/monitoring")).json()
        assert ov1["monitoring_enabled"] is True
        assert ov1["reminder_frequency"] == "monthly"
        assert ov1["next_reminder_date"] is not None
        assert ov1["live_scans_count"] == 1
        assert ov1["demo_scans_count"] == 1
        assert ov1["total_scans_recorded"] == 1
        assert len(ov1["recent_live_scans"]) == 1
        assert ov1["last_completed_check_source"] == "Live HIBP API Scan"
        assert ov1["monitoring_status"] == "Scheduled Reminder Pending"

        # 3. Record newer external check -> updates last_completed_check_source
        chk_res = await client.post(
            "/api/monitoring/external-checks",
            json={
                "email": "p5_alice@example.com",
                "breaches_found_count": 0,
                "breach_names": [],
                "user_notes": "Clean HIBP check",
            },
        )
        assert chk_res.status_code == 200
        ov2 = (await client.get("/api/monitoring")).json()
        assert ov2["total_external_checks"] == 1
        assert ov2["last_completed_check_source"] == "User-Confirmed HIBP Check"

        # 4. Pause/disable reminder
        pause_res = await client.patch(
            f"/api/monitoring/reminders/{rem_id}",
            json={"is_active": False},
        )
        assert pause_res.status_code == 200
        assert pause_res.json()["is_active"] is False

        ov3 = (await client.get("/api/monitoring")).json()
        assert ov3["monitoring_enabled"] is False
        assert ov3["next_reminder_date"] is None
        assert ov3["monitoring_status"] == "Up to Date"
        assert len(ov3["reminder_history"]) == 1

        # 5. Re-enable & change frequency to weekly
        reenable_res = await client.patch(
            f"/api/monitoring/reminders/{rem_id}",
            json={"is_active": True, "frequency": "weekly"},
        )
        assert reenable_res.status_code == 200
        assert reenable_res.json()["is_active"] is True
        assert reenable_res.json()["frequency"] == "weekly"

        # 6. IDOR: Bob cannot patch or delete Alice's reminder
        await login(client, "p5_bob@example.com")
        assert (
            await client.patch(f"/api/monitoring/reminders/{rem_id}", json={"is_active": False})
        ).status_code == 404
        assert (await client.delete(f"/api/monitoring/reminders/{rem_id}")).status_code == 404

        # 7. Alice deletes her own reminder
        await login(client, "p5_alice@example.com")
        del_res = await client.delete(f"/api/monitoring/reminders/{rem_id}")
        assert del_res.status_code == 204
        ov4 = (await client.get("/api/monitoring")).json()
        assert ov4["monitoring_enabled"] is False
        assert ov4["reminder_history"] == []


@pytest.mark.asyncio
async def test_phase5_9_empty_states_brand_new_user(phase5_users):
    """
    9. Empty states return clean zero/unperformed defaults for a user with zero scans, reports, or checks.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_bob@example.com")

        # Empty scan history
        scan_res = await client.get("/api/scans?is_demo=false")
        assert scan_res.status_code == 200
        s_data = scan_res.json()
        assert s_data["total"] == 0
        assert s_data["items"] == []
        assert s_data["live_total"] == 0
        assert s_data["demo_total"] == 0

        # Empty reports
        rep_res = await client.get("/api/reports")
        assert rep_res.status_code == 200
        assert rep_res.json()["total"] == 0
        assert rep_res.json()["items"] == []

        # Empty monitoring overview
        mon_res = await client.get("/api/monitoring")
        assert mon_res.status_code == 200
        m_data = mon_res.json()
        assert m_data["monitoring_enabled"] is False
        assert m_data["reminder_frequency"] is None
        assert m_data["next_reminder_date"] is None
        assert m_data["last_completed_check_date"] is None
        assert m_data["last_completed_check_source"] == "Never Performed"
        assert m_data["monitoring_status"] == "No Audits Yet"
        assert m_data["live_scans_count"] == 0
        assert m_data["demo_scans_count"] == 0
        assert m_data["total_external_checks"] == 0
        assert m_data["recent_checks"] == []
        assert m_data["recent_live_scans"] == []
        assert m_data["reminder_history"] == []


@pytest.mark.asyncio
async def test_phase5_10_report_filtering_production_vs_demo(phase5_users):
    """
    10. Reports can be filtered accurately between Production Security Dossiers and Demo-Inclusive Dossiers.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        r_prod = await client.post(
            "/api/reports",
            json={"report_title": "Prod Only", "include_demo_data": False},
        )
        assert r_prod.status_code == 200
        assert r_prod.json()["report_type"] == "Production Security Dossier"

        r_demo = await client.post(
            "/api/reports",
            json={"report_title": "Demo Inclusive", "include_demo_data": True},
        )
        assert r_demo.status_code == 200
        assert r_demo.json()["report_type"] == "Demo-Inclusive Dossier"

        list_all = (await client.get("/api/reports")).json()
        assert list_all["total"] == 2

        list_prod = (await client.get("/api/reports?report_type=production")).json()
        assert list_prod["total"] == 1
        assert list_prod["items"][0]["report_title"] == "Prod Only"

        list_demo = (await client.get("/api/reports?report_type=demo")).json()
        assert list_demo["total"] == 1
        assert list_demo["items"][0]["report_title"] == "Demo Inclusive"


@pytest.mark.asyncio
async def test_phase5_11_unified_scan_history_all_categories_and_idor(phase5_users):
    """
    11. Unified scan history aggregates email_exposure, password_breach, external_verification,
        browser_permission, app_permission, and sensitive_media; enforces filters, demo isolation,
        routed detail endpoint, and IDOR 404.
    """
    alice_id = phase5_users["alice_id"]
    db = TestSessionLocal()

    live_scan = ExposureScan(
        user_id=alice_id,
        email="p5_alice@example.com",
        status="completed",
        breaches_count=1,
        exposed_categories_count=2,
        risk_score=65,
        risk_level="high",
        provider="haveibeenpwned",
        is_demo=False,
    )
    demo_scan = ExposureScan(
        user_id=alice_id,
        email="demo@traceguard.io",
        status="completed",
        breaches_count=3,
        exposed_categories_count=4,
        risk_score=80,
        risk_level="critical",
        provider="demo_simulation",
        is_demo=True,
    )
    ext = ExternalCheckRecord(
        user_id=alice_id,
        email="p5_alice@example.com",
        breaches_found_count=0,
        breach_names=[],
        user_notes="Clean external check",
        is_verified_by_user=True,
    )
    brw = PrivacyPermissionReview(
        user_id=alice_id,
        app_name="Chrome Browser",
        platform="Web",
        permissions_json={"camera": "GRANTED", "microphone": "DENIED"},
        risk_level="high",
        is_reviewed=True,
    )
    app_rev = PrivacyPermissionReview(
        user_id=alice_id,
        app_name="SocialChat App",
        platform="Android",
        permissions_json={"location": True, "contacts": True},
        risk_level="critical",
        is_reviewed=True,
    )
    media_act = SecurityActivity(
        user_id=alice_id,
        activity_type="ON_DEVICE_AI_IMAGE_SCAN",
        title="ID Card Photo Checked",
        description="Local scan flagged sensitive text.",
        status="warning",
        metadata_json={"findings_count": 2, "filename": "id_sample.jpg"},
    )
    db.add_all([live_scan, demo_scan, ext, brw, app_rev, media_act])
    db.commit()
    db.refresh(live_scan)
    db.refresh(app_rev)
    live_scan_id = live_scan.id
    app_rev_id = app_rev.id
    db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        # Also record a zero-knowledge password audit log
        pwd_res = await client.post(
            "/api/security/password-checks",
            json={
                "breached": True,
                "count": 42,
                "entropy_bits": 48,
                "entropy_label": "Moderate",
            },
        )
        assert pwd_res.status_code == 201

        # Fetch unified history (live scope)
        uni_res = await client.get("/api/scans/unified?scope=live&page_size=20")
        assert uni_res.status_code == 200
        uni = uni_res.json()
        assert uni["demo_total"] == 1
        assert uni["live_total"] == 6
        cats = {item["category"] for item in uni["items"]}
        assert cats == {
            "email_exposure",
            "password_breach",
            "external_verification",
            "browser_permission",
            "app_permission",
            "sensitive_media",
        }
        assert all(not item["is_demo"] for item in uni["items"])

        # Search by normalized scan ID
        id_search = (await client.get(f"/api/scans/unified?search=EXP-{live_scan_id}")).json()
        assert id_search["total"] == 1
        assert id_search["items"][0]["id"] == f"EXP-{live_scan_id}"

        # Filter by category & severity
        sev_res = (await client.get("/api/scans/unified?category=app_permission&severity=critical")).json()
        assert sev_res["total"] == 1
        assert sev_res["items"][0]["id"] == f"APP-{app_rev_id}"

        # Detail endpoint for app_permission
        det_res = await client.get(f"/api/scans/unified/app_permission/{app_rev_id}")
        assert det_res.status_code == 200
        det = det_res.json()
        assert det["id"] == f"APP-{app_rev_id}"
        assert det["findings_count"] == 2
        assert len(det["findings"]) == 2
        assert "severity_breakdown" in det

        # IDOR protection: Bob cannot access Alice's unified detail
        await login(client, "p5_bob@example.com")
        idor_res = await client.get(f"/api/scans/unified/app_permission/{app_rev_id}")
        assert idor_res.status_code == 404


@pytest.mark.asyncio
async def test_phase5_12_and_13_report_security_headers_and_path_traversal_block(phase5_users, tmp_path):
    """
    12 & 13. Security reports enforce strict download headers and reject path traversal escapes.
    """
    alice_id = phase5_users["alice_id"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        gen_res = await client.post("/api/reports", json={"report_title": "Security Headers Check"})
        assert gen_res.status_code == 200
        rep_id = gen_res.json()["id"]

        dl_res = await client.get(f"/api/reports/{rep_id}/download")
        assert dl_res.status_code == 200
        assert dl_res.headers.get("x-content-type-options") == "nosniff"
        assert "no-store" in (dl_res.headers.get("cache-control") or "")
        assert dl_res.content.startswith(b"%PDF-")

        # Path traversal guard test: tamper DB file_path to an outside file
        outside_file = tmp_path.parent / "outside_secret.txt"
        outside_file.write_text("secret-data", encoding="utf-8")

        db = TestSessionLocal()
        bad_rep = SecurityReport(
            user_id=alice_id,
            report_title="Tampered Path",
            file_path=str(outside_file),
            file_size_bytes=11,
            summary_json={},
            is_demo=False,
        )
        db.add(bad_rep)
        db.commit()
        db.refresh(bad_rep)
        bad_id = bad_rep.id
        db.close()

        meta_res = await client.get(f"/api/reports/{bad_id}")
        assert meta_res.status_code == 200
        assert meta_res.json()["status"] == "File Unavailable"

        dl_blocked = await client.get(f"/api/reports/{bad_id}/download")
        assert dl_blocked.status_code == 404


@pytest.mark.asyncio
async def test_phase5_14_and_15_automated_monitoring_execution_and_idempotency(phase5_users, monkeypatch):
    """
    14 & 15. Automated monitoring config enforces ownership, fails honestly without HIBP key,
             executes successfully when configured, and prevents duplicate executions per window.
    """
    alice_id = phase5_users["alice_id"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        # Reject target email belonging to another user
        bad_cfg = await client.put(
            "/api/monitoring/config",
            json={"is_enabled": True, "frequency": "daily", "target_email": "p5_bob@example.com"},
        )
        assert bad_cfg.status_code == 403

        # Configure daily schedule for Alice
        cfg_res = await client.put(
            "/api/monitoring/config",
            json={"is_enabled": True, "frequency": "daily", "target_email": "p5_alice@example.com"},
        )
        assert cfg_res.status_code == 200
        assert cfg_res.json()["is_enabled"] is True
        assert cfg_res.json()["frequency"] == "daily"

        # Without HIBP key -> manual trigger explicitly records failed execution (never fake clean!)
        monkeypatch.setattr(hibp_service, "is_hibp_configured", lambda: False)
        fail_run = await client.post("/api/monitoring/run")
        assert fail_run.status_code == 200
        fail_data = fail_run.json()
        assert fail_data["status"] == "failed"
        assert "HIBP" in (fail_data["error_message"] or "")
        fail_exec_id = fail_data["id"]

        # Bob cannot inspect Alice's execution log (IDOR)
        await login(client, "p5_bob@example.com")
        idor_exec = await client.get(f"/api/monitoring/executions/{fail_exec_id}")
        assert idor_exec.status_code == 404

        # Now configure HIBP mock and test scheduled due execution + window idempotency
        monkeypatch.setattr(hibp_service, "is_hibp_configured", lambda: True)

        async def _fake_query_hibp_breaches(email: str):
            return [
                {
                    "Name": "MockScheduledBreach",
                    "Title": "Mock Scheduled Breach",
                    "Domain": "scheduled.example",
                    "BreachDate": "2025-01-15",
                    "AddedDate": "2025-01-20",
                    "DataClasses": ["Email addresses", "Passwords"],
                    "IsVerified": True,
                    "IsFabricated": False,
                    "Description": "Scheduled API breach check result",
                }
            ]

        monkeypatch.setattr(
            hibp_service,
            "query_hibp_breaches",
            _fake_query_hibp_breaches,
        )

        # Force next_run_at to be due right now
        db = TestSessionLocal()
        cfg_row = db.query(MonitoringConfig).filter(MonitoringConfig.user_id == alice_id).first()
        cfg_row.next_run_at = utc_now() - datetime.timedelta(minutes=5)
        db.commit()

        execs_first = await run_due_monitoring_checks(db)
        assert len(execs_first) == 1
        # Running due checks again right away (now next_run_at is pushed forward) must NOT create duplicates
        execs_second = await run_due_monitoring_checks(db)
        assert len(execs_second) == 0

        completed_execs = (
            db.query(MonitoringExecution)
            .filter(
                MonitoringExecution.user_id == alice_id,
                MonitoringExecution.status == "completed",
            )
            .all()
        )
        assert len(completed_execs) == 1
        assert completed_execs[0].verified_findings_count == 1
        assert completed_execs[0].scan_id is not None
        db.close()


@pytest.mark.asyncio
async def test_phase5_16_auth_sessions_and_logout_all(phase5_users):
    """
    16. Authenticated users can list active sessions and revoke all sessions cleanly.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login(client, "p5_alice@example.com")

        sess_res = await client.get("/api/auth/sessions")
        assert sess_res.status_code == 200
        assert sess_res.json()["active_sessions_count"] >= 1

        logout_all_res = await client.post("/api/auth/logout-all")
        assert logout_all_res.status_code == 200

        # Cookie cleared and DB session deleted -> /api/auth/me now 401
        me_after = await client.get("/api/auth/me")
        assert me_after.status_code == 401


