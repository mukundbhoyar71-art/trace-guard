"""
TRACE GUARD - Unified Multi-Category Scan & Audit History Aggregator
Aggregates all genuinely implemented scan/audit categories for an authenticated user:
- email_exposure (ExposureScan + BreachFinding)
- password_breach (SecurityActivity PASSWORD_BREACH_CHECK)
- external_verification (ExternalCheckRecord)
- browser_permission & app_permission (PrivacyPermissionReview)
- sensitive_media (SecurityActivity media/document/metadata scan logs)

Strictly enforces user_id scoping (IDOR prevention) and isolates demo scans.
"""

import datetime
import math
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.scan import ExposureScan, BreachFinding
from app.models.security import (
    ExternalCheckRecord,
    PrivacyPermissionReview,
    SecurityActivity,
)
from app.schemas.scan import (
    UnifiedScanItemResponse,
    UnifiedScanHistoryResponse,
    UnifiedScanDetailResponse,
    UnifiedScanFindingItem,
)

MEDIA_SCAN_ACTIVITY_TYPES = (
    "MEDIA_SCAN_COMPLETED",
    "ON_DEVICE_AI_IMAGE_SCAN",
    "BATCH_AI_IMAGE_SCAN",
    "METADATA_EXTRACTED",
    "MEDIA_SANITIZED",
    "DOCUMENT_PII_SCAN",
)

SUPPORTED_UNIFIED_CATEGORIES = (
    "email_exposure",
    "password_breach",
    "external_verification",
    "browser_permission",
    "app_permission",
    "sensitive_media",
)


def _ensure_utc(dt: Optional[datetime.datetime]) -> datetime.datetime:
    if dt is None:
        return datetime.datetime.now(datetime.timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)


def _norm_severity(val: Optional[str]) -> str:
    s = (val or "low").strip().lower()
    if s in ("critical", "high", "moderate", "medium", "low"):
        return s
    return "low"


def _is_browser_permission(review: PrivacyPermissionReview) -> bool:
    plat = (review.platform or "Web").strip().lower()
    app_lower = (review.app_name or "").lower()
    return plat == "web" and any(
        k in app_lower
        for k in ["browser", "chrome", "firefox", "safari", "edge", "brave", "opera", "navigator"]
    )


def _count_granted_permissions(perms_json: Optional[Dict[str, Any]]) -> int:
    if not perms_json:
        return 0
    return sum(
        1 for _, val in perms_json.items() if str(val).strip().lower() in ("granted", "true")
    )


def _build_email_exposure_item(scan: ExposureScan) -> UnifiedScanItemResponse:
    findings_list = scan.findings or []
    verified_count = sum(1 for f in findings_list if f.is_verified and not f.is_fabricated)
    unverified_count = len(findings_list) - verified_count
    composite_id = f"EXP-{scan.id}"
    return UnifiedScanItemResponse(
        id=composite_id,
        record_id=scan.id,
        category="email_exposure",
        category_label="Email Exposure Scan",
        scan_name="Simulated Demo Exposure Scan" if scan.is_demo else "Live HIBP Email Exposure Scan",
        target=scan.email,
        executed_at=_ensure_utc(scan.created_at),
        status=scan.status,
        findings_count=scan.breaches_count,
        verified_findings_count=verified_count,
        unverified_findings_count=unverified_count,
        severity=_norm_severity(scan.risk_level),
        risk_score=scan.risk_score,
        scan_source="Demo Simulation" if scan.is_demo else "Have I Been Pwned API v3",
        verification_status=(
            "Simulated Demo"
            if scan.is_demo
            else ("API-Verified" if (verified_count > 0 or scan.breaches_count == 0) else "Unverified")
        ),
        is_demo=bool(scan.is_demo),
        summary=f"{scan.breaches_count} breach(es), {scan.exposed_categories_count} exposed data classes",
        detail_route=f"/scan-history/email_exposure/{scan.id}",
    )


def _build_password_check_item(act: SecurityActivity, user_email: str) -> UnifiedScanItemResponse:
    meta = act.metadata_json or {}
    breached = bool(meta.get("breached", False))
    hit_count = int(meta.get("count", 0) or 0)
    entropy_bits = meta.get("entropy_bits", 0)
    entropy_label = meta.get("entropy_label", "Evaluated")
    composite_id = f"PWD-{act.id}"
    return UnifiedScanItemResponse(
        id=composite_id,
        record_id=act.id,
        category="password_breach",
        category_label="Password Breach Check",
        scan_name="Password K-Anonymity Check",
        target="Anonymous Local SHA-1 Digest",
        executed_at=_ensure_utc(act.created_at),
        status="completed",
        findings_count=1 if breached else 0,
        verified_findings_count=1 if breached else 0,
        unverified_findings_count=0,
        severity="critical" if breached else "low",
        risk_score=85 if breached else 0,
        scan_source="HIBP Pwned Passwords Range API",
        verification_status="Zero-Knowledge K-Anonymity",
        is_demo=False,
        summary=(
            f"Compromised in {hit_count} occurrences ({entropy_bits} bits • {entropy_label})"
            if breached
            else f"Zero leaks found ({entropy_bits} bits • {entropy_label})"
        ),
        detail_route=f"/scan-history/password_breach/{act.id}",
    )


def _build_external_check_item(chk: ExternalCheckRecord) -> UnifiedScanItemResponse:
    cnt = chk.breaches_found_count or 0
    severity = "critical" if cnt >= 3 else ("high" if cnt >= 1 else "low")
    verified_cnt = cnt if chk.is_verified_by_user else 0
    unverified_cnt = 0 if chk.is_verified_by_user else cnt
    composite_id = f"EXT-{chk.id}"
    return UnifiedScanItemResponse(
        id=composite_id,
        record_id=chk.id,
        category="external_verification",
        category_label="External Breach Verification",
        scan_name="User-Confirmed HIBP Check",
        target=chk.email,
        executed_at=_ensure_utc(chk.check_date or chk.created_at),
        status="completed",
        findings_count=cnt,
        verified_findings_count=verified_cnt,
        unverified_findings_count=unverified_cnt,
        severity=severity,
        risk_score=min(100, cnt * 20),
        scan_source="Manual Have I Been Pwned Lookup",
        verification_status="User-Confirmed" if chk.is_verified_by_user else "Unverified Entry",
        is_demo=False,
        summary=f"{cnt} self-reported breach(es)" + (f": {', '.join((chk.breach_names or [])[:3])}" if chk.breach_names else ""),
        detail_route=f"/scan-history/external_verification/{chk.id}",
    )


def _build_permission_item(rev: PrivacyPermissionReview) -> UnifiedScanItemResponse:
    is_browser = _is_browser_permission(rev)
    category = "browser_permission" if is_browser else "app_permission"
    prefix = "BRW" if is_browser else "APP"
    granted_cnt = _count_granted_permissions(rev.permissions_json)
    total_scopes = len(rev.permissions_json or {})
    sev = _norm_severity(rev.risk_level)
    score_map = {"critical": 85, "high": 65, "moderate": 40, "medium": 40, "low": 10}
    return UnifiedScanItemResponse(
        id=f"{prefix}-{rev.id}",
        record_id=rev.id,
        category=category,
        category_label="Browser Permission Audit" if is_browser else "App Permission Audit",
        scan_name=rev.app_name,
        target=f"{rev.app_name} ({rev.platform})",
        executed_at=_ensure_utc(rev.reviewed_at or rev.updated_at or rev.created_at),
        status="completed" if rev.is_reviewed else "running",
        findings_count=granted_cnt,
        verified_findings_count=granted_cnt if is_browser else 0,
        unverified_findings_count=0 if is_browser else granted_cnt,
        severity=sev,
        risk_score=score_map.get(sev, 10),
        scan_source="W3C Browser Permissions API" if is_browser else f"Manual {rev.platform} Checklist",
        verification_status="Browser API Verified" if is_browser else "Manual Entry",
        is_demo=False,
        summary=f"{granted_cnt} granted / {total_scopes} total permission scopes",
        detail_route=f"/scan-history/{category}/{rev.id}",
    )


def _build_media_scan_item(act: SecurityActivity) -> UnifiedScanItemResponse:
    meta = act.metadata_json or {}
    findings_cnt = int(
        meta.get("findings_count")
        or meta.get("sensitive_count")
        or meta.get("detections_count")
        or (1 if meta.get("has_gps") else 0)
        or 0
    )
    raw_risk = (
        meta.get("overall_privacy_risk")
        or meta.get("overall_metadata_risk")
        or meta.get("overall_risk")
        or meta.get("risk_level")
    )
    if raw_risk:
        sev = _norm_severity(str(raw_risk))
    else:
        sev = "high" if act.status == "warning" else "low"
    target = (
        meta.get("file_name")
        or meta.get("sanitized_filename")
        or meta.get("original_filename")
        or f"{meta.get('total_files', 1)} media file(s)"
    )
    return UnifiedScanItemResponse(
        id=f"MED-{act.id}",
        record_id=act.id,
        category="sensitive_media",
        category_label="Sensitive Media Scan",
        scan_name=act.title,
        target=str(target),
        executed_at=_ensure_utc(act.created_at),
        status="completed",
        findings_count=findings_cnt,
        verified_findings_count=findings_cnt,
        unverified_findings_count=0,
        severity=sev,
        risk_score=None,
        scan_source="On-Device AI / Local Media Analyzer",
        verification_status="On-Device Analysis",
        is_demo=False,
        summary=act.description or act.title,
        detail_route=f"/scan-history/sensitive_media/{act.id}",
    )


def get_unified_scan_history(
    db: Session,
    user: User,
    page: int = 1,
    page_size: int = 10,
    scope: str = "live",  # live | demo | all
    category: Optional[str] = None,
    severity: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[datetime.datetime] = None,
    date_to: Optional[datetime.datetime] = None,
) -> UnifiedScanHistoryResponse:
    all_live_items: List[UnifiedScanItemResponse] = []
    all_demo_items: List[UnifiedScanItemResponse] = []

    # 1. Email Exposure Scans
    scans = (
        db.query(ExposureScan)
        .filter(ExposureScan.user_id == user.id)
        .all()
    )
    for s in scans:
        item = _build_email_exposure_item(s)
        if s.is_demo:
            all_demo_items.append(item)
        else:
            all_live_items.append(item)

    # 2. Password Checks (zero-knowledge audits)
    pwd_activities = (
        db.query(SecurityActivity)
        .filter(
            SecurityActivity.user_id == user.id,
            SecurityActivity.activity_type == "PASSWORD_BREACH_CHECK",
        )
        .all()
    )
    for a in pwd_activities:
        all_live_items.append(_build_password_check_item(a, user.email))

    # 3. External Breach Verifications
    ext_checks = (
        db.query(ExternalCheckRecord)
        .filter(ExternalCheckRecord.user_id == user.id)
        .all()
    )
    for c in ext_checks:
        all_live_items.append(_build_external_check_item(c))

    # 4. Browser & App Permission Audits
    perm_reviews = (
        db.query(PrivacyPermissionReview)
        .filter(PrivacyPermissionReview.user_id == user.id)
        .all()
    )
    for p in perm_reviews:
        all_live_items.append(_build_permission_item(p))

    # 5. Sensitive Media Scans
    media_activities = (
        db.query(SecurityActivity)
        .filter(
            SecurityActivity.user_id == user.id,
            SecurityActivity.activity_type.in_(MEDIA_SCAN_ACTIVITY_TYPES),
        )
        .all()
    )
    for m in media_activities:
        all_live_items.append(_build_media_scan_item(m))

    live_total = len(all_live_items)
    demo_total = len(all_demo_items)

    if scope == "demo":
        pool = all_demo_items
    elif scope == "all":
        pool = all_live_items + all_demo_items
    else:
        pool = all_live_items

    # Category counts within selected scope (before category filter)
    cat_counts: Dict[str, int] = {c: 0 for c in SUPPORTED_UNIFIED_CATEGORIES}
    for item in pool:
        cat_counts[item.category] = cat_counts.get(item.category, 0) + 1

    # Apply Filters
    filtered = pool
    if category and category != "all":
        filtered = [i for i in filtered if i.category == category]

    if severity and severity != "all":
        target_sev = severity.strip().lower()
        if target_sev in ("moderate", "medium"):
            filtered = [i for i in filtered if i.severity in ("moderate", "medium")]
        else:
            filtered = [i for i in filtered if i.severity == target_sev]

    if status_filter and status_filter != "all":
        target_st = status_filter.strip().lower()
        filtered = [i for i in filtered if i.status.lower() == target_st]

    if date_from:
        filtered = [i for i in filtered if i.executed_at >= date_from]

    if date_to:
        filtered = [i for i in filtered if i.executed_at <= date_to]

    if search and search.strip():
        q = search.strip().lower()
        filtered = [
            i
            for i in filtered
            if (
                q in i.id.lower()
                or q == str(i.record_id)
                or q in i.scan_name.lower()
                or q in i.category_label.lower()
                or q in i.target.lower()
                or q in i.scan_source.lower()
                or q in i.summary.lower()
                or q in i.severity.lower()
            )
        ]

    # Sort descending by execution date
    filtered.sort(key=lambda x: x.executed_at, reverse=True)

    total = len(filtered)
    total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1
    offset = (page - 1) * page_size
    page_items = filtered[offset : offset + page_size]

    return UnifiedScanHistoryResponse(
        items=page_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        live_total=live_total,
        demo_total=demo_total,
        category_counts=cat_counts,
    )


def get_unified_scan_detail(
    db: Session,
    user: User,
    category: str,
    record_id: int,
) -> Optional[UnifiedScanDetailResponse]:
    cat = (category or "").strip().lower()

    if cat == "email_exposure":
        scan = (
            db.query(ExposureScan)
            .filter(ExposureScan.id == record_id, ExposureScan.user_id == user.id)
            .first()
        )
        if not scan:
            return None
        base = _build_email_exposure_item(scan)
        sev_breakdown = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
        findings_out: List[UnifiedScanFindingItem] = []
        recs: List[str] = []
        for f in (scan.findings or []):
            s_key = _norm_severity(f.severity)
            if s_key == "medium":
                s_key = "moderate"
            sev_breakdown[s_key] = sev_breakdown.get(s_key, 0) + 1
            ver_label = (
                "Simulated / Fabricated"
                if f.is_fabricated
                else ("API-Verified" if f.is_verified else "Unverified")
            )
            findings_out.append(
                UnifiedScanFindingItem(
                    title=f.title or f.breach_name,
                    severity=_norm_severity(f.severity),
                    verification_status=ver_label,
                    category_or_domain=f.domain,
                    details=f.description or f"Exposed classes: {', '.join(f.data_classes or [])}",
                    data_classes=f.data_classes or [],
                    recommended_actions=f.recommended_actions or [],
                    is_resolved=f.is_resolved,
                    detected_date=f.breach_date,
                )
            )
            for a in (f.recommended_actions or []):
                if a not in recs:
                    recs.append(a)
        if not recs:
            recs = [
                "Enable multi-factor authentication and rotate passwords if any credential leaks appear."
            ]
        return UnifiedScanDetailResponse(
            **base.model_dump(),
            completed_at=_ensure_utc(scan.completed_at),
            error_message=scan.error_message,
            severity_breakdown=sev_breakdown,
            findings=findings_out,
            recommendations=recs[:8],
            metadata={
                "provider": scan.provider,
                "exposed_categories_count": scan.exposed_categories_count,
                "is_demo": scan.is_demo,
            },
        )

    if cat == "password_breach":
        act = (
            db.query(SecurityActivity)
            .filter(
                SecurityActivity.id == record_id,
                SecurityActivity.user_id == user.id,
                SecurityActivity.activity_type == "PASSWORD_BREACH_CHECK",
            )
            .first()
        )
        if not act:
            return None
        base = _build_password_check_item(act, user.email)
        meta = act.metadata_json or {}
        breached = bool(meta.get("breached", False))
        cnt = int(meta.get("count", 0) or 0)
        findings_out = []
        if breached:
            findings_out.append(
                UnifiedScanFindingItem(
                    title=f"Password Hash Matched in {cnt:,} Public Breach Occurrences",
                    severity="critical",
                    verification_status="Zero-Knowledge K-Anonymity",
                    category_or_domain="HIBP Pwned Passwords Range API",
                    details="Only the first 5 SHA-1 characters left the browser; exact match confirmed locally.",
                    data_classes=["Compromised Credential"],
                    recommended_actions=[
                        "Replace this password immediately across every account where it was used.",
                        "Generate a unique 16+ character password using a password manager.",
                    ],
                )
            )
        return UnifiedScanDetailResponse(
            **base.model_dump(),
            completed_at=_ensure_utc(act.created_at),
            severity_breakdown={"critical": 1 if breached else 0, "high": 0, "moderate": 0, "low": 0},
            findings=findings_out,
            recommendations=[
                "Passwords are never stored or transmitted in plaintext during TRACE GUARD k-anonymity verification.",
                "Use unique passwords per site and enable FIDO2 or TOTP 2FA.",
            ],
            metadata=meta,
        )

    if cat == "external_verification":
        chk = (
            db.query(ExternalCheckRecord)
            .filter(ExternalCheckRecord.id == record_id, ExternalCheckRecord.user_id == user.id)
            .first()
        )
        if not chk:
            return None
        base = _build_external_check_item(chk)
        findings_out = []
        for bname in (chk.breach_names or []):
            findings_out.append(
                UnifiedScanFindingItem(
                    title=str(bname),
                    severity="high",
                    verification_status="User-Confirmed Manual Check",
                    category_or_domain="haveibeenpwned.com",
                    details=chk.user_notes or "Manually observed and confirmed by the user on Have I Been Pwned.",
                )
            )
        if not findings_out and chk.breaches_found_count > 0:
            findings_out.append(
                UnifiedScanFindingItem(
                    title=f"{chk.breaches_found_count} External Breach(es) Reported",
                    severity="high",
                    verification_status="User-Confirmed Manual Check",
                    category_or_domain="haveibeenpwned.com",
                    details=chk.user_notes or "Count logged directly by user without individual incident names.",
                )
            )
        return UnifiedScanDetailResponse(
            **base.model_dump(),
            completed_at=_ensure_utc(chk.check_date),
            severity_breakdown={"critical": 0, "high": len(findings_out), "moderate": 0, "low": 0},
            findings=findings_out,
            recommendations=[
                "Change reused credentials on affected third-party domains.",
                "Enable recurring monitoring checks to track new incidents.",
            ],
            metadata={
                "user_notes": chk.user_notes,
                "is_verified_by_user": chk.is_verified_by_user,
                "check_date": _ensure_utc(chk.check_date).isoformat(),
            },
        )

    if cat in ("browser_permission", "app_permission"):
        rev = (
            db.query(PrivacyPermissionReview)
            .filter(PrivacyPermissionReview.id == record_id, PrivacyPermissionReview.user_id == user.id)
            .first()
        )
        if not rev:
            return None
        actual_cat = "browser_permission" if _is_browser_permission(rev) else "app_permission"
        if actual_cat != cat:
            return None
        base = _build_permission_item(rev)
        perms = rev.permissions_json or {}
        findings_out = []
        sev_breakdown = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
        for scope, state in perms.items():
            st_lower = str(state).strip().lower()
            is_granted = st_lower in ("granted", "true")
            scope_sev = "high" if (is_granted and str(scope).lower() in ("camera", "microphone", "location", "geolocation", "contacts", "sms")) else ("moderate" if is_granted else "low")
            sev_breakdown[scope_sev] = sev_breakdown.get(scope_sev, 0) + 1
            findings_out.append(
                UnifiedScanFindingItem(
                    title=f"{scope}: {str(state).upper()}",
                    severity=scope_sev,
                    verification_status=base.verification_status,
                    category_or_domain=rev.platform,
                    details=(
                        "Permission currently granted — review whether continuous access is strictly needed."
                        if is_granted
                        else f"Current scope state is {str(state).upper()}."
                    ),
                )
            )
        return UnifiedScanDetailResponse(
            **base.model_dump(),
            completed_at=_ensure_utc(rev.reviewed_at or rev.updated_at),
            severity_breakdown=sev_breakdown,
            findings=findings_out,
            recommendations=[
                "Revoke Camera, Microphone, and Location permissions unless actively required.",
                "Browser audits reflect W3C Permissions API snapshots; mobile/desktop entries reflect manual checklist audits.",
            ],
            metadata={
                "platform": rev.platform,
                "permissions": perms,
                "review_notes": rev.review_notes,
            },
        )

    if cat == "sensitive_media":
        act = (
            db.query(SecurityActivity)
            .filter(
                SecurityActivity.id == record_id,
                SecurityActivity.user_id == user.id,
                SecurityActivity.activity_type.in_(MEDIA_SCAN_ACTIVITY_TYPES),
            )
            .first()
        )
        if not act:
            return None
        base = _build_media_scan_item(act)
        meta = act.metadata_json or {}
        findings_out = []
        if base.findings_count > 0 or act.status == "warning":
            findings_out.append(
                UnifiedScanFindingItem(
                    title=act.title,
                    severity=base.severity,
                    verification_status="On-Device Analysis",
                    category_or_domain=act.activity_type,
                    details=act.description,
                )
            )
        return UnifiedScanDetailResponse(
            **base.model_dump(),
            completed_at=_ensure_utc(act.created_at),
            severity_breakdown={
                "critical": 1 if base.severity == "critical" else 0,
                "high": 1 if base.severity == "high" else 0,
                "moderate": 1 if base.severity in ("moderate", "medium") else 0,
                "low": 1 if base.severity == "low" else 0,
            },
            findings=findings_out,
            recommendations=[
                "Strip EXIF, GPS, and camera metadata using TRACE GUARD Media Sanitizer before uploading images publicly.",
                "Redact or rotate exposed tokens or PII flagged in local document scans.",
            ],
            metadata=meta,
        )

    return None

