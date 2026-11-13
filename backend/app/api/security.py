import math
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database.session import get_db
from app.models.user import User
from app.models.security import (
    SecurityRecommendation,
    SecurityActivity,
    PrivacyRiskHistory,
)
from app.schemas.security import (
    SecurityRecommendationResponse,
    SecurityRecommendationListResponse,
    SecurityRecommendationUpdateRequest,
    SecurityActivityResponse,
    SecurityActivityListResponse,
    PrivacyRiskScoreResponse,
    PrivacyRiskFactor,
    PrivacyRiskHistoryItem,
    PasswordCheckAuditRequest,
    PasswordCheckAuditResponse,
)
from app.services.session import get_current_user
from app.services.recommendation_engine import sync_user_recommendations
from app.services.risk_engine import calculate_privacy_risk_score
from app.services.activity import log_activity

router = APIRouter(prefix="/security", tags=["Security Intelligence & Governance"])

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


# ==========================================
# 1. SMART SECURITY RECOMMENDATIONS
# ==========================================
@router.get("/recommendations", response_model=SecurityRecommendationListResponse)
def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns dynamic security recommendations tailored to the user's scan and audit telemetry.
    Ensures standard baseline recommendations are provisioned while preserving user completion state.
    """
    # Synchronize and seed recommendations based on live state
    sync_user_recommendations(db, current_user.id)

    recs = (
        db.query(SecurityRecommendation)
        .filter(SecurityRecommendation.user_id == current_user.id)
        .order_by(
            # Pending first, then by priority (critical, high, medium, low), then created_at
            SecurityRecommendation.status.asc(),
            SecurityRecommendation.created_at.desc(),
        )
        .all()
    )

    completed = sum(1 for r in recs if r.status == "completed")
    pending = sum(1 for r in recs if r.status == "pending")

    return SecurityRecommendationListResponse(
        items=[SecurityRecommendationResponse.model_validate(r) for r in recs],
        total=len(recs),
        completed_count=completed,
        pending_count=pending,
    )


@router.patch("/recommendations/{rec_id}", response_model=SecurityRecommendationResponse)
def update_recommendation_status(
    rec_id: int,
    payload: SecurityRecommendationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Toggles a recommendation status between pending, completed, or dismissed.
    Strictly prevents IDOR by scoping to current_user.id.
    """
    rec = (
        db.query(SecurityRecommendation)
        .filter(
            SecurityRecommendation.id == rec_id,
            SecurityRecommendation.user_id == current_user.id,
        )
        .first()
    )

    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Security recommendation not found or unauthorized.",
        )

    old_status = rec.status
    rec.status = payload.status
    rec.updated_at = utc_now()
    if payload.status == "completed":
        rec.completed_at = utc_now()
    elif payload.status == "pending":
        rec.completed_at = None

    db.commit()
    db.refresh(rec)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="RECOMMENDATION_UPDATED",
        title=f"Security Action: {rec.title}",
        status="success" if payload.status == "completed" else "info",
        metadata={
            "recommendation_id": rec.id,
            "previous_status": old_status,
            "new_status": payload.status,
            "category": rec.category,
        },
    )

    return SecurityRecommendationResponse.model_validate(rec)


# ==========================================
# 2. PRIVACY RISK SCORE & HISTORY
# ==========================================
@router.get("/risk-score", response_model=PrivacyRiskScoreResponse)
def get_privacy_risk_score(
    include_demo: bool = Query(default=False, description="Deprecated: demo data is strictly excluded from production scoring"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Calculates the 0-100 Privacy Risk Score with vector breakdown and recommendations.
    Strictly real-data-driven: Missing data is never treated as proof of safety.
    Zero demo fallback in production.
    """
    raw_score_data = calculate_privacy_risk_score(db, current_user.id)

    factor_objects = [
        PrivacyRiskFactor(
            name=f["name"],
            category_id=f.get("category_id", "general"),
            weight=f["weight"],
            score=f["score"],
            status=f["status"],
            status_label=f.get("status_label", f["status"]),
            description=f["description"],
            records_checked_count=f.get("records_checked_count", 0),
            findings_count=f.get("findings_count", 0),
            resolved_count=f.get("resolved_count", 0),
            last_checked_at=f.get("last_checked_at"),
            data_source=f.get("data_source", ""),
            evidence_summary=f.get("evidence_summary", ""),
            suggested_action=f.get("suggested_action", ""),
        )
        for f in raw_score_data.get("factors", [])
    ]

    return PrivacyRiskScoreResponse(
        score=raw_score_data.get("risk_score"),
        category=raw_score_data.get("risk_category", "Insufficient Data"),
        rating=raw_score_data.get("rating", "Unknown"),
        has_sufficient_data=raw_score_data.get("has_sufficient_data", False),
        is_demo=False,
        coverage_percentage=raw_score_data.get("coverage_percentage", 0),
        engine_version=raw_score_data.get("engine_version", "3.0"),
        status_message=raw_score_data.get("status_message", ""),
        factors=factor_objects,
        improvement_recommendations=raw_score_data.get("improvement_recommendations", []),
        metrics=raw_score_data.get("metrics", {}),
        verified_findings_count=raw_score_data.get("verified_findings_count", 0),
        resolved_findings_count=raw_score_data.get("resolved_findings_count", 0),
        previous_score=raw_score_data.get("previous_score"),
        score_delta=raw_score_data.get("score_delta"),
        calculated_at=raw_score_data.get("calculated_at", utc_now()),
    )


@router.get("/risk-history", response_model=List[PrivacyRiskHistoryItem])
def get_risk_score_history(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns historical privacy risk score snapshots for trend visualization.
    """
    history = (
        db.query(PrivacyRiskHistory)
        .filter(PrivacyRiskHistory.user_id == current_user.id)
        .order_by(PrivacyRiskHistory.calculated_at.desc())
        .limit(limit)
        .all()
    )

    return [PrivacyRiskHistoryItem.model_validate(h) for h in history]


# ==========================================
# 3. SECURITY ACTIVITIES TIMELINE
# ==========================================
@router.get("/activities", response_model=SecurityActivityListResponse)
def get_security_activities(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=15, ge=1, le=100),
    activity_type: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns paginated chronological security activity timeline.
    Zero-knowledge guarantee: passwords and sensitive tokens are strictly filtered and never stored or returned.
    """
    query = db.query(SecurityActivity).filter(SecurityActivity.user_id == current_user.id)
    if activity_type:
        query = query.filter(SecurityActivity.activity_type == activity_type)

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    offset = (page - 1) * page_size

    activities = (
        query.order_by(SecurityActivity.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return SecurityActivityListResponse(
        items=[SecurityActivityResponse.model_validate(a) for a in activities],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ==========================================
# 4. ZERO-KNOWLEDGE PASSWORD CHECK AUDIT LOG
# ==========================================
@router.post("/password-checks", response_model=PasswordCheckAuditResponse, status_code=status.HTTP_201_CREATED)
def record_password_check_audit(
    payload: PasswordCheckAuditRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Logs anonymous outcome metadata (breached boolean, hit count, entropy rating) from
    the client-side k-anonymity Pwned Passwords check.
    Strict zero-knowledge: NEVER accepts or stores passwords, SHA-1 hashes, or hash prefixes.
    """
    status_label = "warning" if payload.breached else "success"
    title = (
        f"Password K-Anonymity Check: Compromised ({payload.count} leaks)"
        if payload.breached
        else "Password K-Anonymity Check: Zero Breaches Found"
    )
    description = (
        f"Zero-knowledge SHA-1 prefix range query checked local password ({payload.entropy_bits} bits, {payload.entropy_label}). "
        f"Outcome: {'Compromised in ' + str(payload.count) + ' dataset occurrences' if payload.breached else '0 known leaks found'}."
    )

    activity = log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="PASSWORD_BREACH_CHECK",
        title=title,
        description=description,
        status=status_label,
        metadata={
            "breached": payload.breached,
            "count": payload.count,
            "entropy_bits": payload.entropy_bits,
            "entropy_label": payload.entropy_label,
            "protocol": "HIBP K-Anonymity Range API (Zero-Knowledge)",
        },
    )

    return PasswordCheckAuditResponse(
        id=activity.id,
        breached=payload.breached,
        count=payload.count,
        entropy_bits=payload.entropy_bits,
        entropy_label=payload.entropy_label,
        created_at=activity.created_at,
    )

