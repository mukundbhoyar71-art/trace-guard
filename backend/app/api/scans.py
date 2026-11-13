import math
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.models.scan import ExposureScan, BreachFinding
from app.schemas.scan import (
    ScanCreateRequest,
    ExposureScanResponse,
    BreachFindingResponse,
    ScanHistoryResponse,
    ScannerStatusResponse,
    UnifiedScanHistoryResponse,
    UnifiedScanDetailResponse,
)
from app.services.unified_scans import (
    get_unified_scan_history,
    get_unified_scan_detail,
    SUPPORTED_UNIFIED_CATEGORIES,
)
from app.services.session import get_current_user
from app.services.rate_limiter import rate_limiter
from app.services.activity import log_activity
import app.services.hibp as hibp_service
from app.services.hibp import (
    HIBPConfigurationError,
    HIBPRateLimitError,
    HIBPServiceUnavailableError,
    HIBPTimeoutError,
    HIBPError,
)
from app.services.risk_scoring import (
    calculate_exposure_risk_score,
    compute_breach_severity,
    generate_recommendations_for_breach,
    generate_overall_recommendations,
)

router = APIRouter(prefix="/scans", tags=["Personal Data Exposure Scanner"])


def _format_scan_response(scan: ExposureScan, findings: Optional[List[BreachFinding]] = None) -> ExposureScanResponse:
    findings_list = findings if findings is not None else scan.findings
    findings_dicts = []
    unique_categories = set()

    for f in findings_list:
        classes = f.data_classes or []
        for c in classes:
            unique_categories.add(c.strip().lower())
        findings_dicts.append({
            "breach_name": f.breach_name,
            "title": f.title,
            "breach_date": f.breach_date,
            "data_classes": classes,
        })

    _, _, breakdown = calculate_exposure_risk_score(findings_dicts)
    overall_recs = generate_overall_recommendations(findings_dicts)

    verified_count = sum(1 for f in findings_list if f.is_verified and not f.is_fabricated)
    unverified_count = len(findings_list) - verified_count
    scan_type_label = "Simulated Demo Scan" if scan.is_demo else "Live HIBP API Scan"

    return ExposureScanResponse(
        id=scan.id,
        user_id=scan.user_id,
        email=scan.email,
        status=scan.status,
        scan_type=scan_type_label,
        breaches_count=scan.breaches_count,
        exposed_categories_count=scan.exposed_categories_count,
        verified_findings_count=verified_count,
        unverified_findings_count=unverified_count,
        risk_score=scan.risk_score,
        risk_level=scan.risk_level,
        provider=scan.provider,
        is_demo=scan.is_demo,
        error_message=scan.error_message,
        created_at=scan.created_at,
        completed_at=scan.completed_at,
        findings=[BreachFindingResponse.model_validate(f) for f in findings_list],
        risk_breakdown=breakdown,
        security_recommendations=overall_recs,
    )


@router.get("/status", response_model=ScannerStatusResponse)
def get_scanner_status(
    current_user: User = Depends(get_current_user),
):
    """
    Returns scanner configuration and provider telemetry availability
    without exposing API keys or credentials.
    """
    configured = hibp_service.is_hibp_configured()
    return ScannerStatusResponse(
        configured=configured,
        provider="haveibeenpwned",
        status="active" if configured else "configuration_required",
        message=(
            "Live email breach scanning is active and authorized."
            if configured
            else "Live email breach scanning requires an HIBP API subscription. Demo scan is available."
        ),
        demo_available=True,
        registered_email=current_user.email,
        rate_limit_info="1 request per 1.5 - 6 seconds (provider standard limit); 5 scans / min per user.",
    )


@router.post("", response_model=ExposureScanResponse, status_code=status.HTTP_201_CREATED)
async def create_exposure_scan(
    data: ScanCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Initiates an authenticated Personal Data Exposure scan for the authorized user's email.
    Supports both Live HIBP queries and isolated Demo simulations.
    """
    # 1. Rate limiting
    rate_limiter.check(f"scan_{current_user.id}", max_attempts=5, window_seconds=60)

    # 2. Authorization validation: Restrict scans to the authenticated user's registered account
    clean_target = data.email.strip().lower()
    clean_registered = current_user.email.strip().lower()

    if clean_target != clean_registered:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Unauthorized target: Security policy authorizes scans only for your verified registered email ({clean_registered}). "
                "Scanning unverified third-party email addresses is restricted to prevent unauthorized reconnaissance."
            ),
        )

    # 3. Handle Demo Scan Workflow
    if data.is_demo:
        raw_breaches = hibp_service.get_demo_breaches(clean_target)
        score, level, breakdown = calculate_exposure_risk_score(raw_breaches)

        unique_categories = set()
        for b in raw_breaches:
            for c in (b.get("DataClasses") or []):
                unique_categories.add(c.strip().lower())

        scan = ExposureScan(
            user_id=current_user.id,
            email=clean_target,
            status="completed",
            breaches_count=len(raw_breaches),
            exposed_categories_count=len(unique_categories),
            risk_score=score,
            risk_level=level,
            provider="demo_simulation",
            is_demo=True,
            error_message=None,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)

        created_findings = []
        for b in raw_breaches:
            b_name = b.get("Name") or "Demo Incident"
            title = b.get("Title") or b_name
            domain = b.get("Domain")
            breach_date = b.get("BreachDate")
            pwn_count = b.get("PwnCount")
            description = b.get("Description")
            logo_url = b.get("LogoPath")
            data_classes = b.get("DataClasses") or []

            severity = compute_breach_severity(data_classes)
            recs = generate_recommendations_for_breach(data_classes, title)

            finding = BreachFinding(
                scan_id=scan.id,
                breach_name=b_name,
                title=title,
                domain=domain,
                breach_date=breach_date,
                pwn_count=pwn_count,
                description=description,
                logo_url=logo_url,
                data_classes=data_classes,
                is_verified=True,
                is_fabricated=True,
                is_sensitive=False,
                is_retired=False,
                is_spam_list=False,
                is_malware=False,
                severity=severity,
                recommended_actions=recs,
            )
            db.add(finding)
            created_findings.append(finding)

        db.commit()
        for f in created_findings:
            db.refresh(f)

        return _format_scan_response(scan, created_findings)

    # 4. Live Scan: Provider Configuration Check
    if not hibp_service.is_hibp_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Live email breach scanning requires an HIBP API subscription. Please configure HIBP_API_KEY in backend/.env or run a Demo Scan.",
        )

    # 4. Query Have I Been Pwned API v3
    try:
        raw_breaches = await hibp_service.query_hibp_breaches(clean_target)
    except HIBPRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": str(exc.retry_after)},
        )
    except HIBPServiceUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except HIBPTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        )
    except HIBPConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except HIBPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Breach intelligence provider error: {str(exc)}",
        )

    # 5. Calculate transparent exposure risk score & metrics
    score, level, breakdown = calculate_exposure_risk_score(raw_breaches)

    # Determine unique exposed data categories count
    unique_categories = set()
    for b in raw_breaches:
        for c in (b.get("DataClasses") or []):
            unique_categories.add(c.strip().lower())

    # 6. Save ExposureScan record in atomic transaction
    scan = ExposureScan(
        user_id=current_user.id,
        email=clean_target,
        status="completed",
        breaches_count=len(raw_breaches),
        exposed_categories_count=len(unique_categories),
        risk_score=score,
        risk_level=level,
        provider="haveibeenpwned",
        error_message=None,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # 7. Create BreachFinding records
    created_findings = []
    for b in raw_breaches:
        b_name = b.get("Name") or "Incident"
        title = b.get("Title") or b_name
        domain = b.get("Domain")
        breach_date = b.get("BreachDate")
        pwn_count = b.get("PwnCount")
        description = b.get("Description")
        logo_url = b.get("LogoPath")
        data_classes = b.get("DataClasses") or []

        severity = compute_breach_severity(data_classes)
        recs = generate_recommendations_for_breach(data_classes, title)

        finding = BreachFinding(
            scan_id=scan.id,
            breach_name=b_name,
            title=title,
            domain=domain,
            breach_date=breach_date,
            pwn_count=pwn_count,
            description=description,
            logo_url=logo_url,
            data_classes=data_classes,
            is_verified=b.get("IsVerified", True),
            is_fabricated=b.get("IsFabricated", False),
            is_sensitive=b.get("IsSensitive", False),
            is_retired=b.get("IsRetired", False),
            is_spam_list=b.get("IsSpamList", False),
            is_malware=b.get("IsMalware", False),
            severity=severity,
            recommended_actions=recs,
        )
        db.add(finding)
        created_findings.append(finding)

    db.commit()
    for f in created_findings:
        db.refresh(f)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="DEMO_SCAN_COMPLETED" if scan.is_demo else "BREACH_SCAN_COMPLETED",
        title=f"{'Simulated Demo' if scan.is_demo else 'Live'} Exposure Scan Completed",
        status="warning" if scan.breaches_count > 0 else "success",
        metadata={
            "scan_id": scan.id,
            "email": scan.email,
            "breaches_count": scan.breaches_count,
            "risk_score": scan.risk_score,
            "is_demo": scan.is_demo,
        },
    )

    return _format_scan_response(scan, created_findings)


def _parse_iso_date_filter(value: str, end_of_day: bool = False) -> datetime.datetime:
    clean = value.strip()
    if clean.endswith("Z"):
        clean = clean[:-1] + "+00:00"
    try:
        if len(clean) == 10 and clean[4] == "-" and clean[7] == "-":
            parsed_date = datetime.date.fromisoformat(clean)
            if end_of_day:
                return datetime.datetime(
                    parsed_date.year, parsed_date.month, parsed_date.day,
                    23, 59, 59, 999999, tzinfo=datetime.timezone.utc
                )
            return datetime.datetime(
                parsed_date.year, parsed_date.month, parsed_date.day,
                0, 0, 0, 0, tzinfo=datetime.timezone.utc
            )
        dt = datetime.datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format '{value}'. Use YYYY-MM-DD or ISO-8601 timestamp.",
        )


@router.get("", response_model=ScanHistoryResponse)
def get_scan_history(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    is_demo: Optional[bool] = Query(None, description="Filter by demo vs live scans"),
    scan_type: Optional[str] = Query(None, description="Filter by scan type: 'live' or 'demo'"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by scan status (completed, failed, running)"),
    search: Optional[str] = Query(None, description="Search email, provider, risk level, or breach name"),
    date_from: Optional[str] = Query(None, description="Filter scans created on or after YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="Filter scans created on or before YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the authenticated user's scan history with pagination, search, date/type/status filters,
    and sorting by scan date descending. Enforces user isolation to prevent IDOR.
    """
    base_query = db.query(ExposureScan).filter(ExposureScan.user_id == current_user.id)
    live_total = base_query.filter(ExposureScan.is_demo == False).count()
    demo_total = base_query.filter(ExposureScan.is_demo == True).count()

    query = base_query

    if scan_type:
        normalized_type = scan_type.strip().lower()
        if normalized_type == "live":
            query = query.filter(ExposureScan.is_demo == False)
        elif normalized_type == "demo":
            query = query.filter(ExposureScan.is_demo == True)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid scan_type filter. Expected 'live' or 'demo'.",
            )
    elif is_demo is not None:
        query = query.filter(ExposureScan.is_demo == is_demo)

    if status_filter:
        clean_status = status_filter.strip().lower()
        if clean_status not in ("completed", "failed", "running"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status filter. Expected 'completed', 'failed', or 'running'.",
            )
        query = query.filter(ExposureScan.status == clean_status)

    if date_from:
        start_dt = _parse_iso_date_filter(date_from, end_of_day=False)
        query = query.filter(ExposureScan.created_at >= start_dt)

    if date_to:
        end_dt = _parse_iso_date_filter(date_to, end_of_day=True)
        query = query.filter(ExposureScan.created_at <= end_dt)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                ExposureScan.email.ilike(pattern),
                ExposureScan.provider.ilike(pattern),
                ExposureScan.risk_level.ilike(pattern),
                ExposureScan.findings.any(
                    or_(
                        BreachFinding.breach_name.ilike(pattern),
                        BreachFinding.title.ilike(pattern),
                    )
                ),
            )
        )

    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    scans = (
        query.order_by(ExposureScan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [_format_scan_response(s) for s in scans]

    return ScanHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        live_total=live_total,
        demo_total=demo_total,
    )


@router.get("/unified", response_model=UnifiedScanHistoryResponse)
def get_unified_history(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    scope: str = Query("live", description="Scope: 'live', 'demo', or 'all'"),
    category: Optional[str] = Query(None, description="Scan category filter"),
    severity: Optional[str] = Query(None, description="Severity filter (critical, high, moderate, medium, low)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Status filter (completed, failed, running)"),
    search: Optional[str] = Query(None, description="Search by Scan ID, type, target, or source"),
    date_from: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Unified multi-category Scan History across all implemented TRACE GUARD scanners & audits:
    - Email Exposure Scans
    - Password Breach Checks (zero-knowledge digest logs)
    - External Breach Verifications
    - Browser Permission Audits & App Permission Audits
    - Sensitive Media Scans (EXIF, document PII, on-device AI image detections)
    Enforces strict user scoping (IDOR prevention) and isolates demo scans.
    """
    norm_scope = (scope or "live").strip().lower()
    if norm_scope not in ("live", "demo", "all"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid scope parameter. Expected 'live', 'demo', or 'all'.",
        )
    if category and category != "all" and category not in SUPPORTED_UNIFIED_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported category '{category}'. Supported: {', '.join(SUPPORTED_UNIFIED_CATEGORIES)}.",
        )

    dt_from = _parse_iso_date_filter(date_from, end_of_day=False) if date_from else None
    dt_to = _parse_iso_date_filter(date_to, end_of_day=True) if date_to else None

    return get_unified_scan_history(
        db=db,
        user=current_user,
        page=page,
        page_size=page_size,
        scope=norm_scope,
        category=category,
        severity=severity,
        status_filter=status_filter,
        search=search,
        date_from=dt_from,
        date_to=dt_to,
    )


@router.get("/unified/{category}/{record_id}", response_model=UnifiedScanDetailResponse)
def get_unified_history_detail(
    category: str,
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns full scan dossier details for any implemented category, strictly scoped to current_user.id.
    """
    detail = get_unified_scan_detail(
        db=db,
        user=current_user,
        category=category,
        record_id=record_id,
    )
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found or access unauthorized.",
        )
    return detail


@router.get("/{scan_id}", response_model=ExposureScanResponse)
def get_scan_details(
    scan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns full details and confirmed breach findings for a single scan.
    Enforces user ownership (IDOR protection).
    """
    scan = (
        db.query(ExposureScan)
        .filter(ExposureScan.id == scan_id, ExposureScan.user_id == current_user.id)
        .first()
    )
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found or access unauthorized.",
        )

    return _format_scan_response(scan)


@router.get("/{scan_id}/findings", response_model=List[BreachFindingResponse])
def get_scan_findings(
    scan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the confirmed breach findings associated with a specific scan.
    Enforces user ownership (IDOR protection).
    """
    scan = (
        db.query(ExposureScan)
        .filter(ExposureScan.id == scan_id, ExposureScan.user_id == current_user.id)
        .first()
    )
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found or access unauthorized.",
        )

    findings = (
        db.query(BreachFinding)
        .filter(BreachFinding.scan_id == scan.id)
        .order_by(BreachFinding.breach_date.desc().nullslast())
        .all()
    )
    return [BreachFindingResponse.model_validate(f) for f in findings]
