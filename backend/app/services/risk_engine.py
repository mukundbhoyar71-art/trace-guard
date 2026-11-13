import datetime
from typing import Dict, Any, Tuple, Optional, List
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.security import (
    PrivacyRiskHistory,
    ExternalCheckRecord,
    PrivacyPermissionReview,
    SecurityRecommendation,
    MonitoringReminder,
)
from app.models.scan import ExposureScan, BreachFinding

ENGINE_VERSION = "3.0"

def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def ensure_utc(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt

def format_iso(dt: Optional[datetime.datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)


def calculate_privacy_risk_score(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Computes the TRACE GUARD Privacy & Attack Surface Score (0-100 pts)
    exclusively from genuine, verified database records belonging to the authenticated user.

    Strict Rules:
    1. Zero mock or simulated demo records in production scoring.
    2. Missing scans are NEVER assumed clean.
    3. Every point penalty and mitigation credit is connected to a documented finding.
    4. Evaluates both the Risk Score and Assessment Coverage / Confidence (0-100%).
    5. If insufficient verified evidence exists (e.g. 0 scans/checks completed),
       returns score: None with category: 'Insufficient Data'.
    6. All queries are strictly scoped to user_id (Zero cross-user leakage).
    """
    now = utc_now()

    # 1. Fetch authenticated user profile
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found.")

    # 2. Fetch genuine, completed live exposure scans (EXCLUDING demo records)
    live_scans = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == user_id,
            ExposureScan.is_demo == False,
            ExposureScan.status == "completed",
        )
        .order_by(ExposureScan.created_at.desc())
        .all()
    )

    # 3. Fetch user-confirmed external check records (HIBP)
    external_checks = (
        db.query(ExternalCheckRecord)
        .filter(
            ExternalCheckRecord.user_id == user_id,
            ExternalCheckRecord.is_verified_by_user == True,
        )
        .order_by(ExternalCheckRecord.check_date.desc())
        .all()
    )

    # 4. Fetch genuine application and browser permission review records
    permission_reviews = (
        db.query(PrivacyPermissionReview)
        .filter(PrivacyPermissionReview.user_id == user_id)
        .order_by(PrivacyPermissionReview.updated_at.desc())
        .all()
    )

    # 5. Fetch security recommendations and hygiene records
    recommendations = (
        db.query(SecurityRecommendation)
        .filter(
            SecurityRecommendation.user_id == user_id,
            SecurityRecommendation.is_demo == False,
        )
        .all()
    )

    # 6. Fetch active monitoring reminder
    active_reminder = (
        db.query(MonitoringReminder)
        .filter(
            MonitoringReminder.user_id == user_id,
            MonitoringReminder.is_active == True,
        )
        .first()
    )

    # 7. Evaluate Assessment Coverage across 5 distinct security pillars
    has_account_eval = True  # Always available via User model
    has_scan_eval = len(live_scans) > 0
    has_external_eval = len(external_checks) > 0
    has_permission_eval = len(permission_reviews) > 0
    has_hygiene_eval = (active_reminder is not None) or any(r.status == "completed" for r in recommendations)

    evaluated_pillars_count = sum([
        has_account_eval,
        has_scan_eval,
        has_external_eval,
        has_permission_eval,
        has_hygiene_eval,
    ])
    coverage_percentage = int((evaluated_pillars_count / 5.0) * 100)

    # Threshold: A reliable score requires at least one completed scan or external check
    has_sufficient_data = has_scan_eval or has_external_eval

    # -------------------------------------------------------------
    # PILLAR 1: Account Security & Identity (Weight: 20 pts max)
    # -------------------------------------------------------------
    p1_weight = 20
    p1_score = 0
    p1_findings = 0
    p1_resolved = 0
    p1_last_checked = user.updated_at or user.created_at

    if not user.is_email_verified:
        p1_score = 15
        p1_findings = 1
        p1_status = "VERIFIED_FINDING"
        p1_status_label = "Unverified Email"
        p1_desc = "Account email has not completed cryptographic verification."
        p1_evidence = f"Registered address ({user.email}) lacks confirmed ownership verification."
        p1_action = "Verify your email address via the link dispatched during onboarding."
    else:
        p1_score = 0
        p1_resolved = 1
        p1_status = "CLEAN_CHECK"
        p1_status_label = "Secured"
        p1_desc = "Primary email ownership is cryptographically verified."
        p1_evidence = f"Verified account email address ({user.email})."
        p1_action = "Maintain strong multi-factor authentication on your primary email account."

    factor_account = {
        "name": "Account & Identity Security",
        "category_id": "account_security",
        "weight": p1_weight,
        "score": p1_score,
        "status": p1_status,
        "status_label": p1_status_label,
        "description": p1_desc,
        "records_checked_count": 1,
        "findings_count": p1_findings,
        "resolved_count": p1_resolved,
        "last_checked_at": format_iso(p1_last_checked),
        "data_source": "users.is_email_verified",
        "evidence_summary": p1_evidence,
        "suggested_action": p1_action,
    }

    # -------------------------------------------------------------
    # PILLAR 2: Personal Data Exposure Scans (Weight: 30 pts max)
    # -------------------------------------------------------------
    p2_weight = 30
    p2_score = 0
    p2_findings = 0
    p2_resolved = 0
    p2_last_checked = live_scans[0].completed_at if live_scans else None

    if not has_scan_eval:
        p2_score = 0
        p2_status = "CHECK_NOT_PERFORMED"
        p2_status_label = "Pending Scan"
        p2_desc = "No live personal data exposure scan performed for this account."
        p2_evidence = "Zero completed live breach scans recorded."
        p2_action = "Run your first Personal Data Exposure Scan to inspect publicly reported breach dumps."
    else:
        total_live_breaches = sum(s.breaches_count for s in live_scans)
        total_live_categories = sum(s.exposed_categories_count for s in live_scans)

        # Count verified unmitigated findings from BreachFinding table
        live_scan_ids = [s.id for s in live_scans]
        unresolved_findings = (
            db.query(BreachFinding)
            .filter(
                BreachFinding.scan_id.in_(live_scan_ids),
                BreachFinding.is_resolved == False,
                BreachFinding.is_verified == True,
            )
            .count()
        )
        resolved_findings = (
            db.query(BreachFinding)
            .filter(
                BreachFinding.scan_id.in_(live_scan_ids),
                BreachFinding.is_resolved == True,
            )
            .count()
        )

        p2_findings = unresolved_findings if unresolved_findings > 0 else total_live_breaches
        p2_resolved = resolved_findings

        if total_live_breaches == 0:
            p2_score = 0
            p2_status = "CLEAN_CHECK"
            p2_status_label = "API-Verified Clean (0 Leaks)"
            p2_desc = f"Zero breach findings detected across {len(live_scans)} live API-verified exposure scan(s)."
            p2_evidence = f"Audited {len(live_scans)} live API scan(s); registered email did not appear in known breach indexes."
            p2_action = "Schedule recurring monitoring to stay notified of emerging credential leaks."
        else:
            vol_pts = min(18, total_live_breaches * 6)
            cat_pts = min(12, total_live_categories * 3)
            p2_score = min(p2_weight, vol_pts + cat_pts)
            p2_status = "VERIFIED_FINDING"
            p2_status_label = "API-Confirmed Exposures"
            p2_desc = f"{total_live_breaches} confirmed breach finding(s) exposing {total_live_categories} data categories."
            p2_evidence = f"{total_live_breaches} API-verified breaches identified in direct provider database records."
            p2_action = "Rotate passwords immediately for all services named in verified breach findings."

    factor_exposure = {
        "name": "Personal Data Exposure Scans",
        "category_id": "email_breaches",
        "weight": p2_weight,
        "score": p2_score,
        "status": p2_status,
        "status_label": p2_status_label,
        "description": p2_desc,
        "records_checked_count": len(live_scans),
        "findings_count": p2_findings,
        "resolved_count": p2_resolved,
        "last_checked_at": format_iso(p2_last_checked),
        "data_source": "exposure_scans (Direct HIBP API Scan)",
        "evidence_summary": p2_evidence,
        "suggested_action": p2_action,
    }

    # -------------------------------------------------------------
    # PILLAR 3: External Account & HIBP Verification (Weight: 25 pts max)
    # -------------------------------------------------------------
    p3_weight = 25
    p3_score = 0
    p3_findings = 0
    p3_resolved = 0
    p3_last_checked = external_checks[0].check_date if external_checks else None

    if not has_external_eval:
        p3_score = 0
        p3_status = "CHECK_NOT_PERFORMED"
        p3_status_label = "Pending Audit"
        p3_desc = "No user-confirmed Have I Been Pwned check recorded yet."
        p3_evidence = "Zero external check records in database."
        p3_action = "Visit Have I Been Pwned and record your confirmed check in Breach Monitoring."
    else:
        total_external_breaches = sum(c.breaches_found_count for c in external_checks)
        p3_findings = total_external_breaches

        if total_external_breaches == 0:
            p3_score = 0
            p3_status = "CLEAN_CHECK"
            p3_status_label = "User-Attested Clean (Manual Check)"
            p3_desc = f"Zero breach findings self-reported across {len(external_checks)} recorded manual Have I Been Pwned check(s)."
            p3_evidence = f"{len(external_checks)} user-confirmed manual check(s) recorded (attestation by user; not an independent direct API query)."
            p3_action = "Keep monitoring records up to date every 30-60 days."
        else:
            has_password_leak = any(
                "password" in str(c.breach_names).lower() or "password" in str(c.user_notes or "").lower()
                for c in external_checks
            )
            breach_pts = min(15, total_external_breaches * 5)
            pwd_pts = 10 if has_password_leak else 0
            p3_score = min(p3_weight, breach_pts + pwd_pts)
            p3_status = "VERIFIED_FINDING"
            p3_status_label = "User-Reported Leaks (Manual Check)"
            p3_desc = f"{total_external_breaches} breach findings self-reported in manual checks." + (
                " Password exposures observed." if has_password_leak else ""
            )
            p3_evidence = f"{total_external_breaches} breach incident(s) self-reported in manual records (user attestation)."
            p3_action = "Deploy a dedicated password manager and replace leaked credentials."

    factor_external = {
        "name": "External Account & HIBP Verification",
        "category_id": "external_checks",
        "weight": p3_weight,
        "score": p3_score,
        "status": p3_status,
        "status_label": p3_status_label,
        "description": p3_desc,
        "records_checked_count": len(external_checks),
        "findings_count": p3_findings,
        "resolved_count": p3_resolved,
        "last_checked_at": format_iso(p3_last_checked),
        "data_source": "external_check_records (Self-Attested Manual Check)",
        "evidence_summary": p3_evidence,
        "suggested_action": p3_action,
    }

    # -------------------------------------------------------------
    # PILLAR 4: Browser & App Privacy Permissions (Weight: 15 pts max)
    # -------------------------------------------------------------
    p4_weight = 15
    p4_score = 0
    p4_findings = 0
    p4_resolved = 0
    p4_last_checked = permission_reviews[0].reviewed_at if permission_reviews else None

    if not has_permission_eval:
        p4_score = 0
        p4_status = "CHECK_NOT_PERFORMED"
        p4_status_label = "Pending Audit"
        p4_desc = "No browser or application permission audits recorded."
        p4_evidence = "Zero privacy permission reviews in database."
        p4_action = "Test browser hardware scopes (Camera, Mic, Location) in Browser Permissions."
    else:
        high_risk_reviews = [r for r in permission_reviews if r.risk_level in ["high", "critical"]]
        p4_findings = len(high_risk_reviews)
        p4_resolved = len(permission_reviews) - len(high_risk_reviews)

        if len(high_risk_reviews) == 0:
            p4_score = 0
            p4_status = "CLEAN_CHECK"
            p4_status_label = "Restricted Scopes"
            p4_desc = f"All {len(permission_reviews)} reviewed scopes operate within secure minimal permissions."
            p4_evidence = f"Audited {len(permission_reviews)} scope(s); zero excessive access detected."
            p4_action = "Maintain least-privilege permissions across browsers and native apps."
        else:
            p4_score = min(p4_weight, len(high_risk_reviews) * 5)
            p4_status = "VERIFIED_FINDING"
            p4_status_label = "Elevated Scopes"
            app_list = ", ".join(r.app_name for r in high_risk_reviews[:2])
            p4_desc = f"{len(high_risk_reviews)} scope(s) granted high-privilege access ({app_list})."
            p4_evidence = f"High/critical hardware access identified across {len(high_risk_reviews)} review(s)."
            p4_action = "Revoke unnecessary background location, microphone, or camera permissions."

    factor_permissions = {
        "name": "Browser & App Privacy Permissions",
        "category_id": "permissions",
        "weight": p4_weight,
        "score": p4_score,
        "status": p4_status,
        "status_label": p4_status_label,
        "description": p4_desc,
        "records_checked_count": len(permission_reviews),
        "findings_count": p4_findings,
        "resolved_count": p4_resolved,
        "last_checked_at": format_iso(p4_last_checked),
        "data_source": "privacy_permission_reviews",
        "evidence_summary": p4_evidence,
        "suggested_action": p4_action,
    }

    # -------------------------------------------------------------
    # PILLAR 5: Security Hygiene & Monitoring Vigilance (Weight: 10 pts max)
    # -------------------------------------------------------------
    p5_weight = 10
    p5_score = 0
    p5_findings = 0
    p5_resolved = 0
    p5_last_checked = None

    # Check audit recency (latest check across live scans and external checks)
    latest_audit_dt = None
    if external_checks:
        latest_audit_dt = ensure_utc(external_checks[0].check_date)
    if live_scans:
        scan_dt = ensure_utc(live_scans[0].created_at)
        if not latest_audit_dt or (scan_dt and scan_dt > latest_audit_dt):
            latest_audit_dt = scan_dt

    p5_last_checked = latest_audit_dt

    # Hygiene mitigation credits: -2 pts per completed security recommendation
    completed_recs_count = sum(1 for r in recommendations if r.status == "completed")
    p5_resolved = completed_recs_count

    if not latest_audit_dt:
        # User has never conducted an audit
        p5_score = 0
        p5_status = "CHECK_NOT_PERFORMED"
        p5_status_label = "Pending Vigilance"
        p5_desc = "Monitoring cadence will activate once your first security scan is recorded."
        p5_evidence = "Zero prior scans or check dates."
        p5_action = "Configure a recurring breach reminder in Breach Monitoring."
    else:
        days_since_audit = (now - latest_audit_dt).days
        if days_since_audit > 60:
            p5_score = 8
            p5_findings = 1
            p5_status = "EXPIRED_STALE"
            p5_status_label = "Audit Stale (>60d)"
            p5_desc = f"Last security verification was {days_since_audit} days ago; audit data is stale."
            p5_evidence = f"Most recent check performed {days_since_audit} days ago (exceeds 60-day window)."
            p5_action = "Perform a fresh Have I Been Pwned check to refresh your vigilance status."
        elif days_since_audit > 30:
            p5_score = 4
            p5_findings = 1
            p5_status = "EXPIRED_STALE"
            p5_status_label = "Audit Overdue (>30d)"
            p5_desc = f"Last check was {days_since_audit} days ago; a monthly refresh is recommended."
            p5_evidence = f"Check performed {days_since_audit} days ago (exceeds 30-day recommended cadence)."
            p5_action = "Perform a quick breach check to keep your identity footprint current."
        else:
            p5_score = 0
            p5_status = "CLEAN_CHECK"
            p5_status_label = "Current (≤30d)"
            p5_desc = f"Security verification is up to date ({days_since_audit} day(s) ago)."
            p5_evidence = f"Active verification within past 30 days ({days_since_audit}d ago)."
            p5_action = "Maintain current monitoring cadence."

    factor_hygiene = {
        "name": "Security Hygiene & Monitoring Cadence",
        "category_id": "hygiene",
        "weight": p5_weight,
        "score": p5_score,
        "status": p5_status,
        "status_label": p5_status_label,
        "description": p5_desc,
        "records_checked_count": len(recommendations) + (1 if active_reminder else 0),
        "findings_count": p5_findings,
        "resolved_count": p5_resolved,
        "last_checked_at": format_iso(p5_last_checked),
        "data_source": "recommendations + monitoring_reminders",
        "evidence_summary": p5_evidence,
        "suggested_action": p5_action,
    }

    factors = [
        factor_account,
        factor_exposure,
        factor_external,
        factor_permissions,
        factor_hygiene,
    ]

    total_verified_findings = sum(f["findings_count"] for f in factors)
    total_resolved_findings = sum(f["resolved_count"] for f in factors)

    # -------------------------------------------------------------
    # CASE 1: INSUFFICIENT EVIDENCE
    # -------------------------------------------------------------
    if not has_sufficient_data:
        recs = [
            "Complete your first Personal Data Exposure Scan to inspect publicly reported breaches.",
            "Record a manual Have I Been Pwned verification in Breach Monitoring.",
            "Test browser permission scopes in the Privacy Center.",
        ]
        return {
            "score": None,
            "risk_score": None,
            "category": "Insufficient Data",
            "risk_category": "Insufficient Data",
            "rating": "Unknown",
            "has_sufficient_data": False,
            "is_demo": False,
            "coverage_percentage": coverage_percentage,
            "engine_version": ENGINE_VERSION,
            "status_message": "Insufficient security data. Complete your first security scan to calculate your score.",
            "factors": factors,
            "improvement_recommendations": recs,
            "metrics": {
                "verified_breaches_count": 0,
                "exposed_categories_count": 0,
                "high_risk_permissions_count": 0,
                "coverage_percentage": coverage_percentage,
                "evaluated_pillars": evaluated_pillars_count,
            },
            "verified_findings_count": total_verified_findings,
            "resolved_findings_count": total_resolved_findings,
            "previous_score": None,
            "score_delta": None,
            "calculated_at": now,
        }

    # -------------------------------------------------------------
    # CASE 2: GENUINE REAL-DATA DRIVEN COMPOSITE CALCULATION
    # -------------------------------------------------------------
    raw_penalty = p1_score + p2_score + p3_score + p4_score + p5_score

    # Apply mitigation deduction: -2 pts per completed recommendation (up to 10 pts max reduction)
    mitigation_deduction = min(10, completed_recs_count * 2)
    final_score = max(0, min(100, raw_penalty - mitigation_deduction))

    if final_score >= 70:
        category = "Critical"
        rating = "Poor"
    elif final_score >= 40:
        category = "High"
        rating = "Fair"
    elif final_score >= 20:
        category = "Moderate"
        rating = "Fair"
    else:
        category = "Low"
        rating = "Good"

    # Actionable improvement recommendations based strictly on genuine findings
    improvement_recs = []
    if p1_score > 0:
        improvement_recs.append("Verify your registered email address to secure your account identity.")
    if p2_score > 0:
        improvement_recs.append("Rotate credentials immediately for all services identified in exposure scan findings.")
    if p3_score > 0:
        improvement_recs.append("Migrate all sensitive logins to unique 16+ character passwords via a password manager.")
    if p4_score > 0:
        improvement_recs.append("Revoke active background location, microphone, or camera permissions on non-essential apps.")
    if p5_score > 0:
        improvement_recs.append("Perform a fresh Have I Been Pwned check to refresh your stale monitoring cadence.")
    if not improvement_recs:
        improvement_recs.append("Maintain recurring monitoring checks to ensure emerging leaks are caught promptly.")

    # Fetch previous score for delta calculation
    previous_record = (
        db.query(PrivacyRiskHistory)
        .filter(
            PrivacyRiskHistory.user_id == user_id,
            PrivacyRiskHistory.is_demo == False,
        )
        .order_by(PrivacyRiskHistory.calculated_at.desc())
        .first()
    )

    previous_score = previous_record.score if previous_record else None
    score_delta = (final_score - previous_score) if previous_score is not None else None

    # Persist snapshot when score changes or if no previous snapshot exists
    if not previous_record or previous_record.score != final_score or previous_record.coverage_percentage != coverage_percentage:
        snapshot = PrivacyRiskHistory(
            user_id=user_id,
            score=final_score,
            category=category,
            coverage_percentage=coverage_percentage,
            engine_version=ENGINE_VERSION,
            factors_json={f["name"]: f["score"] for f in factors},
            is_demo=False,
            calculated_at=now,
        )
        db.add(snapshot)
        db.commit()

    return {
        "score": final_score,
        "risk_score": final_score,
        "category": category,
        "risk_category": category,
        "rating": rating,
        "has_sufficient_data": True,
        "is_demo": False,
        "coverage_percentage": coverage_percentage,
        "engine_version": ENGINE_VERSION,
        "status_message": f"Calculated from genuine verified records. Assessment coverage: {coverage_percentage}%.",
        "factors": factors,
        "improvement_recommendations": improvement_recs,
        "metrics": {
            "verified_breaches_count": sum(s.breaches_count for s in live_scans) + sum(c.breaches_found_count for c in external_checks),
            "exposed_categories_count": sum(s.exposed_categories_count for s in live_scans),
            "high_risk_permissions_count": len([r for r in permission_reviews if r.risk_level in ["high", "critical"]]),
            "coverage_percentage": coverage_percentage,
            "evaluated_pillars": evaluated_pillars_count,
        },
        "verified_findings_count": total_verified_findings,
        "resolved_findings_count": total_resolved_findings,
        "previous_score": previous_score,
        "score_delta": score_delta,
        "calculated_at": now,
    }
