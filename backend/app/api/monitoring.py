import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.models.security import (
    MonitoringReminder,
    MonitoringConfig,
    MonitoringExecution,
    ExternalCheckRecord,
)
from app.models.scan import ExposureScan
from app.schemas.security import (
    MonitoringOverviewResponse,
    MonitoringScanSummary,
    MonitoringReminderCreateRequest,
    MonitoringReminderUpdateRequest,
    MonitoringReminderResponse,
    MonitoringConfigUpdateRequest,
    MonitoringConfigResponse,
    MonitoringExecutionResponse,
    ExternalCheckRecordCreateRequest,
    ExternalCheckRecordResponse,
)
from app.services.session import get_current_user
from app.services.recommendation_engine import sync_user_recommendations
from app.services.activity import log_activity
from app.services.monitoring_scheduler import (
    calculate_next_run_at,
    execute_monitoring_check,
)
import app.services.hibp as hibp_service

router = APIRouter(prefix="/monitoring", tags=["Breach Monitoring & Reminders"])


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def ensure_utc(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)


def calculate_next_reminder(frequency: str) -> datetime.datetime:
    now = utc_now()
    if frequency == "weekly":
        return now + datetime.timedelta(days=7)
    elif frequency == "biweekly":
        return now + datetime.timedelta(days=14)
    elif frequency == "monthly":
        return now + datetime.timedelta(days=30)
    elif frequency == "quarterly":
        return now + datetime.timedelta(days=90)
    else:  # one_time
        return now + datetime.timedelta(days=30)


def _format_live_scan_summary(scan: ExposureScan) -> MonitoringScanSummary:
    findings_list = scan.findings or []
    verified_count = sum(1 for f in findings_list if f.is_verified and not f.is_fabricated)
    unverified_count = len(findings_list) - verified_count
    return MonitoringScanSummary(
        id=scan.id,
        email=scan.email,
        status=scan.status,
        scan_type="Live HIBP API Scan",
        breaches_count=scan.breaches_count,
        exposed_categories_count=scan.exposed_categories_count,
        verified_findings_count=verified_count,
        unverified_findings_count=unverified_count,
        risk_score=scan.risk_score,
        risk_level=scan.risk_level,
        provider=scan.provider,
        is_demo=False,
        created_at=scan.created_at,
        completed_at=scan.completed_at,
    )


@router.get("", response_model=MonitoringOverviewResponse)
def get_monitoring_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the comprehensive breach monitoring overview strictly from production records:
    - Live exposure scans only (demo scans are strictly excluded from live metrics & counts)
    - Active reminder status (enabled/disabled, frequency, next reminder date) & reminder history
    - User-confirmed external check history
    - Truthful last completed check date/source or 'Never Performed'
    """
    # 1. Fetch completed LIVE exposure scans only (exclude demo)
    latest_completed_live_scan = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == current_user.id,
            ExposureScan.is_demo == False,
            ExposureScan.status == "completed",
        )
        .order_by(ExposureScan.created_at.desc())
        .first()
    )

    recent_live_scans_rows = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == current_user.id,
            ExposureScan.is_demo == False,
        )
        .order_by(ExposureScan.created_at.desc())
        .limit(10)
        .all()
    )

    live_scans_count = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == current_user.id,
            ExposureScan.is_demo == False,
        )
        .count()
    )
    completed_live_scans_count = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == current_user.id,
            ExposureScan.is_demo == False,
            ExposureScan.status == "completed",
        )
        .count()
    )
    demo_scans_count = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == current_user.id,
            ExposureScan.is_demo == True,
        )
        .count()
    )

    last_scan_date = (
        (latest_completed_live_scan.completed_at or latest_completed_live_scan.created_at)
        if latest_completed_live_scan
        else None
    )
    last_scan_type = "Live HIBP API Scan" if latest_completed_live_scan else None

    # 2. Fetch active reminder & reminder history
    active_reminder = (
        db.query(MonitoringReminder)
        .filter(
            MonitoringReminder.user_id == current_user.id,
            MonitoringReminder.is_active == True,
        )
        .order_by(MonitoringReminder.created_at.desc())
        .first()
    )

    reminder_history = (
        db.query(MonitoringReminder)
        .filter(MonitoringReminder.user_id == current_user.id)
        .order_by(MonitoringReminder.created_at.desc())
        .limit(10)
        .all()
    )

    monitoring_enabled = bool(active_reminder and active_reminder.is_active)
    reminder_frequency = active_reminder.frequency if monitoring_enabled else None
    next_reminder_date = active_reminder.next_reminder_at if monitoring_enabled else None

    # 3. Fetch external check records (up to 25 most recent)
    recent_checks = (
        db.query(ExternalCheckRecord)
        .filter(ExternalCheckRecord.user_id == current_user.id)
        .order_by(ExternalCheckRecord.check_date.desc())
        .limit(25)
        .all()
    )
    total_checks = (
        db.query(ExternalCheckRecord)
        .filter(ExternalCheckRecord.user_id == current_user.id)
        .count()
    )

    # 4. Determine most recent genuine completed check (Live Scan vs User-Confirmed External Check)
    last_completed_check_date = None
    last_completed_check_source = "Never Performed"

    live_dt = ensure_utc(last_scan_date)
    ext_dt = ensure_utc(recent_checks[0].check_date) if recent_checks else None

    if live_dt and ext_dt:
        if live_dt >= ext_dt:
            last_completed_check_date = last_scan_date
            last_completed_check_source = "Live HIBP API Scan"
        else:
            last_completed_check_date = recent_checks[0].check_date
            last_completed_check_source = "User-Confirmed HIBP Check"
    elif live_dt:
        last_completed_check_date = last_scan_date
        last_completed_check_source = "Live HIBP API Scan"
    elif ext_dt:
        last_completed_check_date = recent_checks[0].check_date
        last_completed_check_source = "User-Confirmed HIBP Check"

    # 5. Determine truthful monitoring status (never pretend demo scans are completed audits)
    now = utc_now()
    if completed_live_scans_count == 0 and total_checks == 0:
        status_text = "No Audits Yet"
    elif active_reminder and ensure_utc(active_reminder.next_reminder_at) < now:
        status_text = "Check Overdue"
    elif active_reminder:
        status_text = "Scheduled Reminder Pending"
    else:
        latest_audit_dt = ensure_utc(last_completed_check_date)
        if latest_audit_dt and (now - latest_audit_dt).days > 60:
            status_text = "Check Overdue"
        else:
            status_text = "Up to Date"

    hibp_ready = hibp_service.is_hibp_configured()

    auto_cfg = (
        db.query(MonitoringConfig)
        .filter(MonitoringConfig.user_id == current_user.id)
        .first()
    )
    auto_cfg_resp = MonitoringConfigResponse(
        id=auto_cfg.id if auto_cfg else None,
        user_id=current_user.id,
        is_enabled=bool(auto_cfg.is_enabled) if auto_cfg else False,
        frequency=auto_cfg.frequency if auto_cfg else "monthly",
        target_email=auto_cfg.target_email if auto_cfg else current_user.email,
        next_run_at=auto_cfg.next_run_at if (auto_cfg and auto_cfg.is_enabled) else None,
        last_run_at=auto_cfg.last_run_at if auto_cfg else None,
        last_status=auto_cfg.last_status if auto_cfg else None,
        last_error=auto_cfg.last_error if auto_cfg else None,
        hibp_configured=hibp_ready,
    )

    recent_executions = (
        db.query(MonitoringExecution)
        .filter(MonitoringExecution.user_id == current_user.id)
        .order_by(MonitoringExecution.started_at.desc())
        .limit(20)
        .all()
    )

    if auto_cfg and auto_cfg.is_enabled:
        if hibp_ready:
            mode_note = (
                f"Automated HIBP monitoring schedule is enabled ({auto_cfg.frequency}); "
                "scheduled checks execute on due windows and record verified outcomes alongside manual reminders and user-confirmed HIBP checks."
            )
        else:
            mode_note = (
                f"Automated schedule is enabled ({auto_cfg.frequency}), but HIBP_API_KEY is not configured: "
                "automated API checks will record explicit failure status until configured. Manual reminders remain available."
            )
    else:
        mode_note = (
            "Automated background monitoring is disabled. Enable daily/weekly/monthly scheduled checks "
            "or manage separate manual HIBP audit reminders below."
        )

    return MonitoringOverviewResponse(
        last_scan_date=last_scan_date,
        last_scan_type=last_scan_type,
        active_reminder=MonitoringReminderResponse.model_validate(active_reminder)
        if active_reminder
        else None,
        monitoring_enabled=monitoring_enabled,
        reminder_frequency=reminder_frequency,
        next_reminder_date=next_reminder_date,
        last_completed_check_date=last_completed_check_date,
        last_completed_check_source=last_completed_check_source,
        monitoring_status=status_text,
        monitoring_mode_note=mode_note,
        total_scans_recorded=live_scans_count,
        live_scans_count=live_scans_count,
        demo_scans_count=demo_scans_count,
        total_external_checks=total_checks,
        recent_checks=[ExternalCheckRecordResponse.model_validate(c) for c in recent_checks],
        recent_live_scans=[_format_live_scan_summary(s) for s in recent_live_scans_rows],
        reminder_history=[MonitoringReminderResponse.model_validate(r) for r in reminder_history],
        auto_monitoring=auto_cfg_resp,
        recent_executions=[MonitoringExecutionResponse.model_validate(e) for e in recent_executions],
    )


@router.put("/config", response_model=MonitoringConfigResponse)
def update_monitoring_config(
    payload: MonitoringConfigUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates persistent automated monitoring configuration (daily, weekly, monthly).
    Restricts target_email strictly to the authenticated user's verified email address.
    """
    target_email = (payload.target_email or current_user.email).strip().lower()
    if target_email != current_user.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Automated monitoring can only target your own registered account email.",
        )

    cfg = (
        db.query(MonitoringConfig)
        .filter(MonitoringConfig.user_id == current_user.id)
        .first()
    )
    now = utc_now()
    next_run = calculate_next_run_at(payload.frequency, now) if payload.is_enabled else None

    if not cfg:
        cfg = MonitoringConfig(
            user_id=current_user.id,
            is_enabled=payload.is_enabled,
            frequency=payload.frequency,
            target_email=target_email,
            next_run_at=next_run,
            created_at=now,
            updated_at=now,
        )
        db.add(cfg)
    else:
        cfg.is_enabled = payload.is_enabled
        cfg.frequency = payload.frequency
        cfg.target_email = target_email
        cfg.next_run_at = next_run
        cfg.updated_at = now

    db.commit()
    db.refresh(cfg)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="MONITORING_CONFIG_UPDATED",
        title=f"Automated Monitoring {'Enabled' if cfg.is_enabled else 'Disabled'} ({cfg.frequency})",
        description=(
            f"Scheduled HIBP API checks configured for {cfg.target_email} on a {cfg.frequency} cadence."
            if cfg.is_enabled
            else f"Automated scheduled HIBP checks paused for {cfg.target_email}."
        ),
        status="info",
        metadata={
            "config_id": cfg.id,
            "is_enabled": cfg.is_enabled,
            "frequency": cfg.frequency,
            "next_run_at": cfg.next_run_at.isoformat() if cfg.next_run_at else None,
        },
    )

    return MonitoringConfigResponse(
        id=cfg.id,
        user_id=cfg.user_id,
        is_enabled=cfg.is_enabled,
        frequency=cfg.frequency,
        target_email=cfg.target_email,
        next_run_at=cfg.next_run_at if cfg.is_enabled else None,
        last_run_at=cfg.last_run_at,
        last_status=cfg.last_status,
        last_error=cfg.last_error,
        hibp_configured=hibp_service.is_hibp_configured(),
    )


@router.post("/run", response_model=MonitoringExecutionResponse)
async def trigger_manual_monitoring_check(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes an immediate manual HIBP monitoring check and persists execution telemetry.
    If HIBP_API_KEY is missing, records an explicit failed execution (never fakes success).
    """
    cfg = (
        db.query(MonitoringConfig)
        .filter(MonitoringConfig.user_id == current_user.id)
        .first()
    )
    target_email = cfg.target_email if cfg else current_user.email
    execution = await execute_monitoring_check(
        db=db,
        user=current_user,
        target_email=target_email,
        trigger_type="manual",
        config=cfg,
        execution_window_key=None,
    )
    return MonitoringExecutionResponse.model_validate(execution)


@router.get("/executions", response_model=List[MonitoringExecutionResponse])
def list_monitoring_executions(
    limit: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(MonitoringExecution)
        .filter(MonitoringExecution.user_id == current_user.id)
        .order_by(MonitoringExecution.started_at.desc())
        .limit(limit)
        .all()
    )
    return [MonitoringExecutionResponse.model_validate(r) for r in rows]


@router.get("/executions/{execution_id}", response_model=MonitoringExecutionResponse)
def get_monitoring_execution_detail(
    execution_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(MonitoringExecution)
        .filter(
            MonitoringExecution.id == execution_id,
            MonitoringExecution.user_id == current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitoring execution record not found or unauthorized.",
        )
    return MonitoringExecutionResponse.model_validate(row)


@router.post("/reminders", response_model=MonitoringReminderResponse)
def create_or_update_reminder(
    payload: MonitoringReminderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates or replaces an active recurring monitoring reminder for manual HIBP checks.
    """
    # Deactivate any previous active reminders for this user
    db.query(MonitoringReminder).filter(
        MonitoringReminder.user_id == current_user.id,
        MonitoringReminder.is_active == True,
    ).update({"is_active": False})

    next_date = (
        ensure_utc(payload.next_reminder_at)
        if payload.next_reminder_at is not None
        else calculate_next_reminder(payload.frequency)
    )

    reminder = MonitoringReminder(
        user_id=current_user.id,
        target_email=payload.target_email.lower().strip(),
        frequency=payload.frequency,
        next_reminder_at=next_date,
        notes=payload.notes,
        is_active=True,
        created_at=utc_now(),
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="REMINDER_SCHEDULED",
        title="Breach Check Reminder Scheduled",
        status="info",
        metadata={
            "reminder_id": reminder.id,
            "target_email": reminder.target_email,
            "frequency": reminder.frequency,
            "next_reminder_at": reminder.next_reminder_at.isoformat(),
        },
    )

    return MonitoringReminderResponse.model_validate(reminder)


@router.patch("/reminders/{reminder_id}", response_model=MonitoringReminderResponse)
def update_reminder(
    reminder_id: int,
    payload: MonitoringReminderUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates, pauses, or re-enables an existing monitoring reminder.
    Scoped strictly to current_user.id (IDOR prevention).
    """
    reminder = (
        db.query(MonitoringReminder)
        .filter(
            MonitoringReminder.id == reminder_id,
            MonitoringReminder.user_id == current_user.id,
        )
        .first()
    )

    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitoring reminder not found or unauthorized.",
        )

    if payload.is_active is True:
        # Ensure only one active reminder exists per user
        db.query(MonitoringReminder).filter(
            MonitoringReminder.user_id == current_user.id,
            MonitoringReminder.id != reminder.id,
            MonitoringReminder.is_active == True,
        ).update({"is_active": False})

    if payload.frequency is not None:
        reminder.frequency = payload.frequency
        if payload.next_reminder_at is None:
            reminder.next_reminder_at = calculate_next_reminder(payload.frequency)

    if payload.next_reminder_at is not None:
        reminder.next_reminder_at = ensure_utc(payload.next_reminder_at)

    if payload.notes is not None:
        reminder.notes = payload.notes

    if payload.is_active is not None:
        reminder.is_active = payload.is_active
        if (
            payload.is_active is True
            and payload.next_reminder_at is None
            and ensure_utc(reminder.next_reminder_at) < utc_now()
        ):
            reminder.next_reminder_at = calculate_next_reminder(reminder.frequency)

    db.commit()
    db.refresh(reminder)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="REMINDER_UPDATED",
        title="Breach Check Reminder Modified",
        status="info",
        metadata={
            "reminder_id": reminder.id,
            "is_active": reminder.is_active,
            "frequency": reminder.frequency,
        },
    )

    return MonitoringReminderResponse.model_validate(reminder)


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(
    reminder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a monitoring reminder owned by the authenticated user (IDOR prevention).
    """
    reminder = (
        db.query(MonitoringReminder)
        .filter(
            MonitoringReminder.id == reminder_id,
            MonitoringReminder.user_id == current_user.id,
        )
        .first()
    )

    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Monitoring reminder not found or unauthorized.",
        )

    db.delete(reminder)
    db.commit()

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="REMINDER_DELETED",
        title="Breach Check Reminder Deleted",
        status="info",
        metadata={"reminder_id": reminder_id},
    )
    return None


@router.post("/external-checks", response_model=ExternalCheckRecordResponse)
def record_external_check(
    payload: ExternalCheckRecordCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Records a user-confirmed manual breach check conducted on Have I Been Pwned.
    Never pretends TRACE GUARD received automated data from the external redirect;
    records explicit user input truthfully.
    """
    check_time = (
        ensure_utc(payload.check_date)
        if payload.check_date is not None
        else utc_now()
    )

    check_record = ExternalCheckRecord(
        user_id=current_user.id,
        email=payload.email.lower().strip(),
        check_date=check_time,
        breaches_found_count=payload.breaches_found_count,
        breach_names=payload.breach_names,
        user_notes=payload.user_notes,
        is_verified_by_user=True,
        created_at=utc_now(),
    )
    db.add(check_record)

    # Also advance last_reminded_at if an active reminder matches
    active_rem = (
        db.query(MonitoringReminder)
        .filter(
            MonitoringReminder.user_id == current_user.id,
            MonitoringReminder.is_active == True,
        )
        .order_by(MonitoringReminder.created_at.desc())
        .first()
    )
    if active_rem:
        active_rem.last_reminded_at = check_time

    db.commit()
    db.refresh(check_record)

    # Re-synchronize recommendations based on new user-confirmed external check
    sync_user_recommendations(db, current_user.id)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="EXTERNAL_CHECK_LOGGED",
        title="External HIBP Audit Recorded",
        status="warning" if payload.breaches_found_count > 0 else "success",
        metadata={
            "check_id": check_record.id,
            "target_email": check_record.email,
            "breaches_found": check_record.breaches_found_count,
            "verified_by_user": True,
        },
    )

    return ExternalCheckRecordResponse.model_validate(check_record)
