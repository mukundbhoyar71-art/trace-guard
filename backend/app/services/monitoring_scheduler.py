"""
TRACE GUARD - Security Monitoring Scheduler & Execution Service
Compatible cleanly with FastAPI lifespan + SQLAlchemy + SQLite.
Supports idempotent scheduled runs (daily / weekly / monthly) and explicit manual triggers.
Never simulates or fakes successful scans when HIBP_API_KEY is unconfigured.
"""

import asyncio
import datetime
import os
from typing import Optional, List

from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.user import User
from app.models.scan import ExposureScan, BreachFinding
from app.models.security import MonitoringConfig, MonitoringExecution
import app.services.hibp as hibp_service
from app.services.hibp import HIBPError
from app.services.risk_scoring import (
    calculate_exposure_risk_score,
    compute_breach_severity,
    generate_recommendations_for_breach,
)
from app.services.recommendation_engine import sync_user_recommendations
from app.services.activity import log_activity


SUPPORTED_FREQUENCIES = ("daily", "weekly", "monthly")


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def ensure_utc(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt.astimezone(datetime.timezone.utc)


def calculate_next_run_at(
    frequency: str,
    base_time: Optional[datetime.datetime] = None,
) -> datetime.datetime:
    base = ensure_utc(base_time) or utc_now()
    freq = (frequency or "monthly").strip().lower()
    if freq == "daily":
        return base + datetime.timedelta(days=1)
    if freq == "weekly":
        return base + datetime.timedelta(days=7)
    return base + datetime.timedelta(days=30)


async def execute_monitoring_check(
    db: Session,
    user: User,
    target_email: str,
    trigger_type: str = "scheduled",
    config: Optional[MonitoringConfig] = None,
    execution_window_key: Optional[str] = None,
) -> MonitoringExecution:
    """
    Executes a genuine HIBP monitoring check for a user, persisting an ExposureScan
    and BreachFindings upon success, or explicitly recording 'failed' / 'skipped'
    when HIBP_API_KEY is missing or an upstream error occurs.
    Idempotent by execution_window_key to prevent duplicate executions on restart.
    """
    now = utc_now()
    clean_email = (target_email or user.email).strip().lower()
    registered_email = (user.email or "").strip().lower()

    if execution_window_key:
        existing = (
            db.query(MonitoringExecution)
            .filter(MonitoringExecution.execution_window_key == execution_window_key)
            .first()
        )
        if existing:
            return existing

    # Authorization safety check
    if clean_email != registered_email:
        execution = MonitoringExecution(
            user_id=user.id,
            config_id=config.id if config else None,
            trigger_type=trigger_type,
            status="skipped",
            target_email=clean_email,
            findings_count=0,
            verified_findings_count=0,
            scan_id=None,
            error_message="Skipped: Target email does not match verified account owner.",
            execution_window_key=execution_window_key,
            started_at=now,
            completed_at=utc_now(),
        )
        db.add(execution)
        if config:
            config.last_run_at = now
            config.last_status = "skipped"
            config.last_error = execution.error_message
            if trigger_type == "scheduled":
                config.next_run_at = calculate_next_run_at(config.frequency, now)
        db.commit()
        db.refresh(execution)
        return execution

    # Truthful configuration gate: fail loudly if HIBP_API_KEY is not configured
    if not hibp_service.is_hibp_configured():
        err_msg = (
            "HIBP API key not configured. Automated or live API monitoring requires HIBP_API_KEY "
            "in backend/.env; manual audit reminders and user-confirmed HIBP logs remain available."
        )
        execution = MonitoringExecution(
            user_id=user.id,
            config_id=config.id if config else None,
            trigger_type=trigger_type,
            status="failed",
            target_email=clean_email,
            findings_count=0,
            verified_findings_count=0,
            scan_id=None,
            error_message=err_msg,
            execution_window_key=execution_window_key,
            started_at=now,
            completed_at=utc_now(),
        )
        db.add(execution)
        if config:
            config.last_run_at = now
            config.last_status = "failed"
            config.last_error = err_msg
            if trigger_type == "scheduled":
                config.next_run_at = calculate_next_run_at(config.frequency, now)
        db.commit()
        db.refresh(execution)

        log_activity(
            db=db,
            user_id=user.id,
            activity_type="MONITORING_CHECK_FAILED",
            title=f"{'Scheduled' if trigger_type == 'scheduled' else 'Manual'} Monitoring Check Failed",
            description=err_msg,
            status="warning",
            metadata={
                "execution_id": execution.id,
                "trigger_type": trigger_type,
                "target_email": clean_email,
                "reason": "hibp_unconfigured",
            },
        )
        return execution

    # Execute genuine HIBP API check
    try:
        raw_breaches = await hibp_service.query_hibp_breaches(clean_email)
    except HIBPError as exc:
        err_msg = f"HIBP API monitoring error: {str(exc)}"
        execution = MonitoringExecution(
            user_id=user.id,
            config_id=config.id if config else None,
            trigger_type=trigger_type,
            status="failed",
            target_email=clean_email,
            findings_count=0,
            verified_findings_count=0,
            scan_id=None,
            error_message=err_msg,
            execution_window_key=execution_window_key,
            started_at=now,
            completed_at=utc_now(),
        )
        db.add(execution)
        if config:
            config.last_run_at = now
            config.last_status = "failed"
            config.last_error = err_msg
            if trigger_type == "scheduled":
                config.next_run_at = calculate_next_run_at(config.frequency, now)
        db.commit()
        db.refresh(execution)

        log_activity(
            db=db,
            user_id=user.id,
            activity_type="MONITORING_CHECK_FAILED",
            title=f"{'Scheduled' if trigger_type == 'scheduled' else 'Manual'} Monitoring Check Failed",
            description=err_msg,
            status="warning",
            metadata={
                "execution_id": execution.id,
                "trigger_type": trigger_type,
                "target_email": clean_email,
            },
        )
        return execution
    except Exception as exc:
        err_msg = f"Unexpected monitoring execution error: {str(exc)}"
        execution = MonitoringExecution(
            user_id=user.id,
            config_id=config.id if config else None,
            trigger_type=trigger_type,
            status="failed",
            target_email=clean_email,
            findings_count=0,
            verified_findings_count=0,
            scan_id=None,
            error_message=err_msg,
            execution_window_key=execution_window_key,
            started_at=now,
            completed_at=utc_now(),
        )
        db.add(execution)
        if config:
            config.last_run_at = now
            config.last_status = "failed"
            config.last_error = err_msg
            if trigger_type == "scheduled":
                config.next_run_at = calculate_next_run_at(config.frequency, now)
        db.commit()
        db.refresh(execution)
        return execution

    # Success path: persist ExposureScan + BreachFinding records + MonitoringExecution
    score, level, _ = calculate_exposure_risk_score(raw_breaches)
    unique_categories = set()
    for b in raw_breaches:
        for c in (b.get("DataClasses") or []):
            unique_categories.add(c.strip().lower())

    completed_at = utc_now()
    scan = ExposureScan(
        user_id=user.id,
        email=clean_email,
        status="completed",
        breaches_count=len(raw_breaches),
        exposed_categories_count=len(unique_categories),
        risk_score=score,
        risk_level=level,
        provider="haveibeenpwned",
        is_demo=False,
        error_message=None,
        created_at=now,
        completed_at=completed_at,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    verified_count = 0
    for b in raw_breaches:
        b_name = b.get("Name") or "Incident"
        title = b.get("Title") or b_name
        data_classes = b.get("DataClasses") or []
        is_verified = bool(b.get("IsVerified", True))
        is_fabricated = bool(b.get("IsFabricated", False))
        if is_verified and not is_fabricated:
            verified_count += 1

        finding = BreachFinding(
            scan_id=scan.id,
            breach_name=b_name,
            title=title,
            domain=b.get("Domain"),
            breach_date=b.get("BreachDate"),
            pwn_count=b.get("PwnCount"),
            description=b.get("Description"),
            logo_url=b.get("LogoPath"),
            data_classes=data_classes,
            is_verified=is_verified,
            is_fabricated=is_fabricated,
            is_sensitive=bool(b.get("IsSensitive", False)),
            is_retired=bool(b.get("IsRetired", False)),
            is_spam_list=bool(b.get("IsSpamList", False)),
            is_malware=bool(b.get("IsMalware", False)),
            severity=compute_breach_severity(data_classes),
            recommended_actions=generate_recommendations_for_breach(data_classes, title),
        )
        db.add(finding)

    execution = MonitoringExecution(
        user_id=user.id,
        config_id=config.id if config else None,
        trigger_type=trigger_type,
        status="completed",
        target_email=clean_email,
        findings_count=len(raw_breaches),
        verified_findings_count=verified_count,
        scan_id=scan.id,
        error_message=None,
        execution_window_key=execution_window_key,
        started_at=now,
        completed_at=utc_now(),
    )
    db.add(execution)

    if config:
        config.last_run_at = now
        config.last_status = "completed"
        config.last_error = None
        if trigger_type == "scheduled":
            config.next_run_at = calculate_next_run_at(config.frequency, now)

    db.commit()
    db.refresh(execution)

    sync_user_recommendations(db, user.id)

    log_activity(
        db=db,
        user_id=user.id,
        activity_type="MONITORING_CHECK_COMPLETED",
        title=f"{'Scheduled' if trigger_type == 'scheduled' else 'Manual'} HIBP Monitoring Check Completed",
        description=f"Verified {len(raw_breaches)} exposure finding(s) for {clean_email}.",
        status="warning" if len(raw_breaches) > 0 else "success",
        metadata={
            "execution_id": execution.id,
            "scan_id": scan.id,
            "trigger_type": trigger_type,
            "findings_count": len(raw_breaches),
            "verified_findings_count": verified_count,
        },
    )

    return execution


async def run_due_monitoring_checks(db: Session) -> List[MonitoringExecution]:
    """
    Scans enabled MonitoringConfig entries whose next_run_at <= now and runs due checks.
    Guarantees at-most-once execution per due schedule window across restarts.
    """
    now = utc_now()
    due_configs = (
        db.query(MonitoringConfig)
        .filter(
            MonitoringConfig.is_enabled == True,
            MonitoringConfig.next_run_at.isnot(None),
        )
        .all()
    )

    results: List[MonitoringExecution] = []
    for cfg in due_configs:
        due_dt = ensure_utc(cfg.next_run_at)
        if not due_dt or due_dt > now:
            continue

        window_key = f"sched:{cfg.id}:{due_dt.isoformat()}"
        already_ran = (
            db.query(MonitoringExecution)
            .filter(MonitoringExecution.execution_window_key == window_key)
            .first()
        )
        if already_ran:
            cfg.next_run_at = calculate_next_run_at(cfg.frequency, now)
            db.commit()
            continue

        user = db.query(User).filter(User.id == cfg.user_id).first()
        if not user:
            continue

        exec_record = await execute_monitoring_check(
            db=db,
            user=user,
            target_email=cfg.target_email or user.email,
            trigger_type="scheduled",
            config=cfg,
            execution_window_key=window_key,
        )
        results.append(exec_record)

    return results


async def monitoring_scheduler_loop(poll_interval_seconds: int = 60):
    """
    Lightweight FastAPI lifespan background loop for scheduled monitoring checks.
    """
    while True:
        try:
            await asyncio.sleep(poll_interval_seconds)
            if os.environ.get("PYTEST_CURRENT_TEST"):
                continue
            db = SessionLocal()
            try:
                await run_due_monitoring_checks(db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            print(f"[TRACE GUARD MONITORING SCHEDULER] Error: {exc}", flush=True)

