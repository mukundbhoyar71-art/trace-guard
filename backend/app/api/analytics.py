import datetime
from collections import Counter
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database.session import get_db
from app.models.user import User
from app.models.security import (
    PrivacyRiskHistory,
    PrivacyPermissionReview,
    SecurityRecommendation,
    SecurityActivity,
    MonitoringReminder,
    ExternalCheckRecord,
)
from app.models.scan import ExposureScan, BreachFinding
from app.services.session import get_current_user
from app.services.risk_engine import calculate_privacy_risk_score
from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    PillarCoverageDetail,
    RiskTrendsResponse,
    RiskTrendPoint,
    ExposureAnalyticsResponse,
    ExposureClassStat,
    PermissionsAnalyticsResponse,
    PermissionProvenanceItem,
    RecommendationsAnalyticsResponse,
    SecurityActivityAnalyticsResponse,
)

router = APIRouter(prefix="/analytics", tags=["Security Analytics"])

def format_iso(dt: Optional[datetime.datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)

def compute_grade(score: Optional[int], has_data: bool) -> str:
    if not has_data or score is None:
        return "--"
    if score <= 19:
        return "A+"
    if score <= 39:
        return "A"
    if score <= 59:
        return "B"
    if score <= 79:
        return "C"
    if score <= 89:
        return "D"
    return "F"


@router.get("/overview", response_model=AnalyticsOverviewResponse)
def get_analytics_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns high-level aggregate security metrics and KPIs for the authenticated user.
    Strictly queries authentic database records and excludes demo telemetry.
    """
    risk_data = calculate_privacy_risk_score(db, current_user.id)
    has_sufficient_data = risk_data.get("has_sufficient_data", False)
    score = risk_data.get("score")
    category = risk_data.get("category", "Insufficient Data")
    coverage = risk_data.get("coverage_percentage", 0)
    grade = compute_grade(score, has_sufficient_data)

    # Completed live exposure scans (EXCLUDING demo)
    total_scans = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == current_user.id,
            ExposureScan.is_demo == False,
            ExposureScan.status == "completed",
        )
        .count()
    )

    # Verified breaches
    findings = (
        db.query(BreachFinding)
        .join(ExposureScan)
        .filter(
            ExposureScan.user_id == current_user.id,
            ExposureScan.is_demo == False,
        )
        .all()
    )
    verified = [f for f in findings if f.is_verified]
    resolved = [f for f in verified if f.is_resolved]
    unresolved = [f for f in verified if not f.is_resolved]

    # High-risk permissions count
    permissions = (
        db.query(PrivacyPermissionReview)
        .filter(PrivacyPermissionReview.user_id == current_user.id)
        .all()
    )
    high_risk_perms = 0
    for p in permissions:
        perms_map = p.permissions_json or {}
        active_high = any(
            str(perms_map.get(k, "")).lower() in ["granted", "true"]
            for k in ["camera", "microphone", "geolocation"]
        )
        if active_high or p.risk_level in ["high", "critical"]:
            high_risk_perms += 1

    # Recommendations
    recs = (
        db.query(SecurityRecommendation)
        .filter(
            SecurityRecommendation.user_id == current_user.id,
            SecurityRecommendation.is_demo == False,
        )
        .all()
    )
    pending_recs = sum(1 for r in recs if r.status == "pending")
    completed_recs = sum(1 for r in recs if r.status == "completed")

    # Monitoring status
    reminder = (
        db.query(MonitoringReminder)
        .filter(
            MonitoringReminder.user_id == current_user.id,
            MonitoringReminder.is_active == True,
        )
        .first()
    )
    monitoring_status = (
        f"Active ({reminder.frequency.capitalize()})" if reminder else "Inactive"
    )

    # Last audit source and date determination (distinguishing API Scan vs User Attestation)
    latest_scan = (
        db.query(ExposureScan)
        .filter(ExposureScan.user_id == current_user.id, ExposureScan.is_demo == False)
        .order_by(ExposureScan.created_at.desc())
        .first()
    )
    latest_check = (
        db.query(ExternalCheckRecord)
        .filter(ExternalCheckRecord.user_id == current_user.id)
        .order_by(ExternalCheckRecord.check_date.desc())
        .first()
    )

    last_audit_str = None
    last_audit_source = "None Recorded"
    last_audit_type = "none"

    scan_dt = latest_scan.completed_at if (latest_scan and latest_scan.completed_at) else None
    check_dt = latest_check.check_date if (latest_check and latest_check.check_date) else None

    if scan_dt and check_dt:
        if scan_dt >= check_dt:
            last_audit_str = format_iso(scan_dt)
            last_audit_source = "Direct API Scan"
            last_audit_type = "api_scan"
        else:
            last_audit_str = format_iso(check_dt)
            last_audit_source = "User Attestation (Manual)"
            last_audit_type = "user_attestation"
    elif scan_dt:
        last_audit_str = format_iso(scan_dt)
        last_audit_source = "Direct API Scan"
        last_audit_type = "api_scan"
    elif check_dt:
        last_audit_str = format_iso(check_dt)
        last_audit_source = "User Attestation (Manual)"
        last_audit_type = "user_attestation"

    # Mitigation credits
    mitigation_credit = 0
    if risk_data.get("metrics") and "mitigation_credit" in risk_data["metrics"]:
        mitigation_credit = risk_data["metrics"]["mitigation_credit"]

    # 5-Pillar Coverage and Evidence Details
    pillar_details = []
    external_checks_count = db.query(ExternalCheckRecord).filter(ExternalCheckRecord.user_id == current_user.id).count()
    permissions_count = len(permissions)

    for factor in risk_data.get("factors", []):
        cat_id = factor.get("category_id", "")
        is_eval = False
        v_type = "Pending Verification"

        if cat_id == "account_security":
            is_eval = True
            v_type = "Cryptographic Identity"
        elif cat_id == "email_breaches":
            is_eval = (total_scans > 0)
            v_type = "Direct HIBP API Response" if total_scans > 0 else "Pending Scan"
        elif cat_id == "external_checks":
            is_eval = (external_checks_count > 0)
            v_type = "User Attestation (Manual Check)" if external_checks_count > 0 else "Pending Check"
        elif cat_id == "permissions":
            is_eval = (permissions_count > 0)
            v_type = "Browser API / User Attestation" if permissions_count > 0 else "Pending Audit"
        elif cat_id in ["monitoring", "hygiene"]:
            is_eval = (reminder is not None or completed_recs > 0)
            v_type = "Active Monitoring Cadence" if (reminder is not None or completed_recs > 0) else "Inactive Cadence"

        pillar_details.append(
            PillarCoverageDetail(
                pillar_id=cat_id,
                name=factor.get("name", ""),
                weight=factor.get("weight", 0),
                score=factor.get("score", 0),
                is_evaluated=is_eval,
                status=factor.get("status", "CHECK_NOT_PERFORMED"),
                status_label=factor.get("status_label", ""),
                verification_type=v_type,
                evidence_summary=factor.get("evidence_summary", ""),
                data_source=factor.get("data_source", ""),
                last_checked_at=factor.get("last_checked_at"),
            )
        )

    return AnalyticsOverviewResponse(
        risk_score=score,
        risk_category=category,
        grade=grade,
        coverage_percentage=coverage,
        total_scans=total_scans,
        verified_breaches_count=len(verified),
        resolved_breaches_count=len(resolved),
        unresolved_breaches_count=len(unresolved),
        high_risk_permissions_count=high_risk_perms,
        pending_recommendations_count=pending_recs,
        completed_recommendations_count=completed_recs,
        monitoring_status=monitoring_status,
        last_audit_date=last_audit_str,
        last_audit_source=last_audit_source,
        last_audit_type=last_audit_type,
        mitigation_credit=mitigation_credit,
        pillars=pillar_details,
    )


@router.get("/risk-trends", response_model=RiskTrendsResponse)
def get_risk_trends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns historical risk score snapshots for trend visualization.
    Includes scoring engine version for each point and flags methodology transitions.
    Only returns records where is_demo == False.
    """
    records = (
        db.query(PrivacyRiskHistory)
        .filter(
            PrivacyRiskHistory.user_id == current_user.id,
            PrivacyRiskHistory.is_demo == False,
        )
        .order_by(PrivacyRiskHistory.calculated_at.asc())
        .all()
    )

    versions = [r.engine_version or "3.0" for r in records]
    unique_versions = sorted(list(set(versions)))
    has_methodology_transition = len(unique_versions) > 1

    trends = []
    for idx, r in enumerate(records):
        ver = r.engine_version or "3.0"
        methodology_change = (idx > 0 and ver != (records[idx - 1].engine_version or "3.0"))
        trends.append(
            RiskTrendPoint(
                id=r.id,
                score=r.score,
                category=r.category,
                coverage_percentage=r.coverage_percentage,
                calculated_at=format_iso(r.calculated_at),
                engine_version=ver,
                methodology_change=methodology_change,
            )
        )

    return RiskTrendsResponse(
        trends=trends,
        engine_versions_present=unique_versions,
        has_methodology_transition=has_methodology_transition,
    )


@router.get("/exposure", response_model=ExposureAnalyticsResponse)
def get_exposure_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns breach exposure analytics: severity breakdown, top compromised data classes,
    resolution rate, and recent incidents. Excludes demo records.
    """
    findings = (
        db.query(BreachFinding)
        .join(ExposureScan)
        .filter(
            ExposureScan.user_id == current_user.id,
            ExposureScan.is_demo == False,
        )
        .order_by(BreachFinding.created_at.desc())
        .all()
    )

    verified = [f for f in findings if f.is_verified]
    total_breaches = len(verified)
    resolved_count = sum(1 for f in verified if f.is_resolved)
    unresolved_count = total_breaches - resolved_count
    resolution_rate = round((resolved_count / total_breaches * 100), 1) if total_breaches > 0 else 100.0

    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    category_counter = Counter()

    recent_breaches = []
    for f in verified[:10]:
        sev = (f.severity or "medium").lower()
        if sev in severity_counts:
            severity_counts[sev] += 1
        else:
            severity_counts["medium"] += 1

        for dc in (f.data_classes or []):
            category_counter[dc] += 1

        recent_breaches.append({
            "id": f.id,
            "title": f.title or f.breach_name,
            "breach_date": f.breach_date,
            "severity": f.severity,
            "is_resolved": f.is_resolved,
            "data_classes": f.data_classes or [],
        })

    top_categories = [
        ExposureClassStat(category=cat, count=cnt)
        for cat, cnt in category_counter.most_common(10)
    ]

    return ExposureAnalyticsResponse(
        total_breaches=total_breaches,
        resolved_count=resolved_count,
        unresolved_count=unresolved_count,
        resolution_rate=resolution_rate,
        severity_breakdown=severity_counts,
        top_exposed_categories=top_categories,
        recent_breaches=recent_breaches,
    )


@router.get("/permissions", response_model=PermissionsAnalyticsResponse)
def get_permissions_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns permission distribution across browser states (granted, denied, prompt, unsupported)
    and detailed scopes.
    """
    reviews = (
        db.query(PrivacyPermissionReview)
        .filter(PrivacyPermissionReview.user_id == current_user.id)
        .order_by(PrivacyPermissionReview.updated_at.desc())
        .all()
    )

    status_counts = {"granted": 0, "denied": 0, "prompt": 0, "unsupported": 0}
    platform_breakdown = {}
    sensitive_scopes = {
        "camera": "PROMPT",
        "microphone": "PROMPT",
        "geolocation": "PROMPT",
        "notifications": "PROMPT",
    }
    audit_provenance = []

    for r in reviews:
        plat = r.platform or "Web"
        platform_breakdown[plat] = platform_breakdown.get(plat, 0) + 1

        perms = r.permissions_json or {}
        is_browser = plat.lower() == "web" and any(
            k in (r.app_name or "").lower()
            for k in ["browser", "chrome", "firefox", "safari", "edge", "brave", "opera", "navigator"]
        )
        prov_label = (
            "Browser Permissions API (navigator.permissions)"
            if is_browser
            else f"Manual User Attestation ({plat} Checklist)"
        )

        granted_list = []
        restricted_list = []

        for scope, st in perms.items():
            st_clean = str(st).lower()
            if st_clean in ["granted", "true"]:
                status_counts["granted"] += 1
                granted_list.append(scope)
                if scope in sensitive_scopes:
                    sensitive_scopes[scope] = "GRANTED"
            elif st_clean in ["denied", "false", "blocked"]:
                status_counts["denied"] += 1
                restricted_list.append(scope)
                if scope in sensitive_scopes and sensitive_scopes[scope] != "GRANTED":
                    sensitive_scopes[scope] = "DENIED"
            elif st_clean in ["prompt", "unknown"]:
                status_counts["prompt"] += 1
                restricted_list.append(scope)
            elif st_clean in ["unsupported"]:
                status_counts["unsupported"] += 1
                restricted_list.append(scope)
                if scope in sensitive_scopes and sensitive_scopes[scope] not in ["GRANTED", "DENIED"]:
                    sensitive_scopes[scope] = "UNSUPPORTED"

        audit_provenance.append(
            PermissionProvenanceItem(
                id=r.id,
                app_name=r.app_name,
                platform=plat,
                provenance=prov_label,
                is_automated_device_audit=False,  # Never describe manual or browser input as automated device-level agent
                risk_level=r.risk_level,
                audit_date=format_iso(r.updated_at or r.created_at),
                granted_scopes=granted_list,
                restricted_scopes=restricted_list,
            )
        )

    return PermissionsAnalyticsResponse(
        total_reviewed=len(reviews),
        status_counts=status_counts,
        sensitive_scopes=sensitive_scopes,
        platform_breakdown=platform_breakdown,
        audit_provenance=audit_provenance,
    )


@router.get("/recommendations", response_model=RecommendationsAnalyticsResponse)
def get_recommendations_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns recommendation breakdown by status, priority, and category."""
    recs = (
        db.query(SecurityRecommendation)
        .filter(
            SecurityRecommendation.user_id == current_user.id,
            SecurityRecommendation.is_demo == False,
        )
        .all()
    )

    status_counts = {"pending": 0, "completed": 0, "dismissed": 0}
    priority_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    category_counts = {}

    for r in recs:
        st = r.status.lower() if r.status else "pending"
        status_counts[st] = status_counts.get(st, 0) + 1

        pr = r.priority.lower() if r.priority else "medium"
        priority_counts[pr] = priority_counts.get(pr, 0) + 1

        cat = r.category.lower() if r.category else "general"
        category_counts[cat] = category_counts.get(cat, 0) + 1

    return RecommendationsAnalyticsResponse(
        total=len(recs),
        status_counts=status_counts,
        priority_counts=priority_counts,
        category_counts=category_counts,
    )


@router.get("/activity", response_model=SecurityActivityAnalyticsResponse)
def get_activity_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns chronological recent security activities."""
    activities = (
        db.query(SecurityActivity)
        .filter(SecurityActivity.user_id == current_user.id)
        .order_by(SecurityActivity.created_at.desc())
        .limit(25)
        .all()
    )

    items = [
        {
            "id": a.id,
            "activity_type": a.activity_type,
            "title": a.title,
            "description": a.description,
            "status": a.status,
            "metadata": a.metadata_json or {},
            "created_at": format_iso(a.created_at),
        }
        for a in activities
    ]

    return SecurityActivityAnalyticsResponse(activities=items)

