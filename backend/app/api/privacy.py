import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.models.security import PrivacyPermissionReview
from app.schemas.security import (
    PrivacyPermissionReviewCreateRequest,
    PrivacyPermissionReviewUpdateRequest,
    PrivacyPermissionReviewResponse,
    PrivacyPermissionOverviewResponse,
    BrowserPermissionAuditSaveRequest,
)
from app.services.session import get_current_user
from app.services.recommendation_engine import sync_user_recommendations
from app.services.activity import log_activity

router = APIRouter(prefix="/privacy", tags=["Privacy & App Permissions Center"])

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

def evaluate_permission_risk(permissions: Dict[str, Any]) -> str:
    """
    Evaluates privacy exposure based on high-privilege granted scopes.
    Accurately supports both boolean values and real browser permission statuses
    ('GRANTED', 'DENIED', 'PROMPT', 'UNSUPPORTED', 'ERROR').
    """
    granted = set()
    for k, v in permissions.items():
        key = k.lower().strip()
        if v is True:
            granted.add(key)
        elif isinstance(v, str) and v.upper() == "GRANTED":
            granted.add(key)

    critical_scopes = {"precise_location", "location", "contacts", "microphone", "camera", "sms", "call_logs"}
    elevated_scopes = {"storage", "background_location", "calendar", "sensors", "notifications"}

    critical_count = sum(1 for s in critical_scopes if s in granted)
    elevated_count = sum(1 for s in elevated_scopes if s in granted)

    if critical_count >= 3 or (("precise_location" in granted or "location" in granted) and "contacts" in granted):
        return "critical"
    elif critical_count >= 1 or elevated_count >= 2:
        return "high"
    elif elevated_count >= 1 or len(granted) >= 2:
        return "moderate"
    else:
        return "low"


@router.get("/permissions", response_model=PrivacyPermissionOverviewResponse)
def get_permissions_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all app permission audits recorded by the user,
    with risk levels, completion percentage, and checklist status.
    """
    reviews = (
        db.query(PrivacyPermissionReview)
        .filter(PrivacyPermissionReview.user_id == current_user.id)
        .order_by(PrivacyPermissionReview.updated_at.desc())
        .all()
    )

    total_apps = len(reviews)
    reviewed_apps = sum(1 for r in reviews if r.is_reviewed)
    high_risk_count = sum(1 for r in reviews if r.risk_level in ["high", "critical"])

    completion_percentage = int((reviewed_apps / total_apps * 100)) if total_apps > 0 else 0

    if total_apps == 0:
        checklist_status = "Not Started"
    elif completion_percentage == 100:
        checklist_status = "Fully Audited"
    elif completion_percentage >= 50:
        checklist_status = "Partially Audited"
    else:
        checklist_status = "Audit in Progress"

    return PrivacyPermissionOverviewResponse(
        items=[PrivacyPermissionReviewResponse.model_validate(r) for r in reviews],
        total_apps=total_apps,
        reviewed_apps=reviewed_apps,
        completion_percentage=completion_percentage,
        high_risk_permissions_count=high_risk_count,
        checklist_status=checklist_status,
    )


@router.post("/permissions", response_model=PrivacyPermissionReviewResponse)
def create_permission_review(
    payload: PrivacyPermissionReviewCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Records an app permission scope review.
    Evaluates hardware access and data harvesting risk truthfully.
    """
    computed_risk = evaluate_permission_risk(payload.permissions_json)

    review = PrivacyPermissionReview(
        user_id=current_user.id,
        app_name=payload.app_name.strip(),
        platform=payload.platform,
        permissions_json=payload.permissions_json,
        risk_level=computed_risk,
        review_notes=payload.review_notes,
        is_reviewed=True,
        reviewed_at=utc_now(),
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Sync recommendations if high risk
    sync_user_recommendations(db, current_user.id)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="PERMISSION_AUDITED",
        title=f"Permission Audit: {review.app_name}",
        status="warning" if computed_risk in ["high", "critical"] else "info",
        metadata={
            "app_name": review.app_name,
            "platform": review.platform,
            "risk_level": review.risk_level,
            "granted_count": sum(1 for v in payload.permissions_json.values() if v),
        },
    )

    return PrivacyPermissionReviewResponse.model_validate(review)


@router.patch("/permissions/{review_id}", response_model=PrivacyPermissionReviewResponse)
def update_permission_review(
    review_id: int,
    payload: PrivacyPermissionReviewUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates an app permission scope review. Scoped strictly to current_user.id (IDOR prevention).
    """
    review = (
        db.query(PrivacyPermissionReview)
        .filter(
            PrivacyPermissionReview.id == review_id,
            PrivacyPermissionReview.user_id == current_user.id,
        )
        .first()
    )

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission review not found or unauthorized.",
        )

    if payload.app_name is not None:
        review.app_name = payload.app_name.strip()
    if payload.platform is not None:
        review.platform = payload.platform
    if payload.permissions_json is not None:
        review.permissions_json = payload.permissions_json
        review.risk_level = evaluate_permission_risk(payload.permissions_json)
    if payload.review_notes is not None:
        review.review_notes = payload.review_notes
    if payload.is_reviewed is not None:
        review.is_reviewed = payload.is_reviewed

    review.updated_at = utc_now()
    db.commit()
    db.refresh(review)

    sync_user_recommendations(db, current_user.id)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="PERMISSION_MODIFIED",
        title=f"Updated Permission Audit: {review.app_name}",
        status="info",
        metadata={
            "review_id": review.id,
            "app_name": review.app_name,
            "risk_level": review.risk_level,
        },
    )

    return PrivacyPermissionReviewResponse.model_validate(review)


@router.delete("/permissions/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_permission_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes an app permission review. Scoped strictly to current_user.id (IDOR prevention).
    """
    review = (
        db.query(PrivacyPermissionReview)
        .filter(
            PrivacyPermissionReview.id == review_id,
            PrivacyPermissionReview.user_id == current_user.id,
        )
        .first()
    )

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission review not found or unauthorized.",
        )

    app_name = review.app_name
    db.delete(review)
    db.commit()

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="PERMISSION_DELETED",
        title=f"Removed Permission Audit: {app_name}",
        status="info",
        metadata={"app_name": app_name},
    )

    return None


# ==========================================
# REAL BROWSER PERMISSION AUDIT ENDPOINTS
# ==========================================
@router.get("/browser-audit", response_model=Optional[PrivacyPermissionReviewResponse])
def get_browser_permission_audit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the user's latest recorded browser permission audit snapshot.
    """
    audit = (
        db.query(PrivacyPermissionReview)
        .filter(
            PrivacyPermissionReview.user_id == current_user.id,
            PrivacyPermissionReview.platform == "Web",
            PrivacyPermissionReview.app_name.like("Web Browser%"),
        )
        .order_by(PrivacyPermissionReview.updated_at.desc())
        .first()
    )
    if not audit:
        return None
    return PrivacyPermissionReviewResponse.model_validate(audit)


@router.post("/browser-audit", response_model=PrivacyPermissionReviewResponse)
def save_browser_permission_audit(
    payload: BrowserPermissionAuditSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Records a real browser permission audit conducted via browser APIs
    (Permissions API, Notifications API, MediaDevices, Geolocation).
    Never stores location coordinates, audio, video, or sensitive hardware streams.
    """
    browser_label = f"Web Browser ({payload.browser_name.strip() if payload.browser_name else 'Active'})"
    computed_risk = evaluate_permission_risk(payload.permissions)

    # Check if a browser audit record already exists for this user
    existing_audit = (
        db.query(PrivacyPermissionReview)
        .filter(
            PrivacyPermissionReview.user_id == current_user.id,
            PrivacyPermissionReview.platform == "Web",
            PrivacyPermissionReview.app_name.like("Web Browser%"),
        )
        .first()
    )

    if existing_audit:
        existing_audit.app_name = browser_label
        existing_audit.permissions_json = payload.permissions
        existing_audit.risk_level = computed_risk
        existing_audit.review_notes = payload.notes
        existing_audit.is_reviewed = True
        existing_audit.reviewed_at = utc_now()
        existing_audit.updated_at = utc_now()
        record = existing_audit
    else:
        record = PrivacyPermissionReview(
            user_id=current_user.id,
            app_name=browser_label,
            platform="Web",
            permissions_json=payload.permissions,
            risk_level=computed_risk,
            review_notes=payload.notes,
            is_reviewed=True,
            reviewed_at=utc_now(),
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        db.add(record)

    db.commit()
    db.refresh(record)

    sync_user_recommendations(db, current_user.id)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="BROWSER_PERMISSIONS_AUDITED",
        title=f"Browser Scope Audit: {browser_label}",
        status="warning" if computed_risk in ["high", "critical"] else "success",
        metadata={
            "browser": browser_label,
            "risk_level": computed_risk,
            "granted_count": sum(1 for v in payload.permissions.values() if isinstance(v, str) and v.upper() == "GRANTED"),
            "denied_count": sum(1 for v in payload.permissions.values() if isinstance(v, str) and v.upper() == "DENIED"),
        },
    )

    return PrivacyPermissionReviewResponse.model_validate(record)


