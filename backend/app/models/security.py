import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

class SecurityRecommendation(Base):
    __tablename__ = "security_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)  # password, 2fa, permissions, recovery, activity, monitoring
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    suggested_action = Column(Text, nullable=False)
    priority = Column(String(20), default="medium", nullable=False)  # critical, high, medium, low
    status = Column(String(20), default="pending", nullable=False, index=True)  # pending, completed, dismissed
    is_demo = Column(Boolean, default=False, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="recommendations")


class SecurityActivity(Base):
    __tablename__ = "security_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(20), default="info", nullable=False)  # success, warning, info, danger
    metadata_json = Column(JSON, default=dict, nullable=False)  # Never stores passwords or raw tokens
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="activities")


class PrivacyRiskHistory(Base):
    __tablename__ = "privacy_risk_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Integer, nullable=False)  # 0-100
    category = Column(String(30), nullable=False)  # Low, Moderate, High, Critical, Insufficient Data
    coverage_percentage = Column(Integer, default=0, nullable=False)  # 0-100
    engine_version = Column(String(20), default="3.0", nullable=False)
    factors_json = Column(JSON, default=dict, nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False, index=True)
    calculated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="risk_history")


class MonitoringReminder(Base):
    __tablename__ = "monitoring_reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_email = Column(String(255), nullable=False, index=True)
    frequency = Column(String(50), default="monthly", nullable=False)  # weekly, biweekly, monthly, quarterly, one_time
    next_reminder_at = Column(DateTime(timezone=True), nullable=False, index=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    last_reminded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="monitoring_reminders")


class MonitoringConfig(Base):
    __tablename__ = "monitoring_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    is_enabled = Column(Boolean, default=False, nullable=False, index=True)
    frequency = Column(String(30), default="monthly", nullable=False)  # daily, weekly, monthly
    target_email = Column(String(255), nullable=False, index=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True, index=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_status = Column(String(30), nullable=True)  # completed, failed, skipped
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="monitoring_configs")
    executions = relationship("MonitoringExecution", back_populates="config", order_by="desc(MonitoringExecution.started_at)")


class MonitoringExecution(Base):
    __tablename__ = "monitoring_executions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    config_id = Column(Integer, ForeignKey("monitoring_configs.id", ondelete="SET NULL"), nullable=True, index=True)
    trigger_type = Column(String(20), default="scheduled", nullable=False)  # scheduled | manual
    status = Column(String(30), default="completed", nullable=False, index=True)  # completed | failed | skipped
    target_email = Column(String(255), nullable=False)
    findings_count = Column(Integer, default=0, nullable=False)
    verified_findings_count = Column(Integer, default=0, nullable=False)
    scan_id = Column(Integer, ForeignKey("exposure_scans.id", ondelete="SET NULL"), nullable=True)
    error_message = Column(Text, nullable=True)
    execution_window_key = Column(String(120), nullable=True, unique=True, index=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="monitoring_executions")
    config = relationship("MonitoringConfig", back_populates="executions")


class ExternalCheckRecord(Base):
    __tablename__ = "external_check_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    check_date = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    breaches_found_count = Column(Integer, default=0, nullable=False)
    breach_names = Column(JSON, default=list, nullable=False)
    user_notes = Column(Text, nullable=True)
    is_verified_by_user = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("User", back_populates="external_checks")


class PrivacyPermissionReview(Base):
    __tablename__ = "privacy_permission_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    app_name = Column(String(255), nullable=False, index=True)
    platform = Column(String(50), default="Web", nullable=False)  # iOS, Android, Windows, macOS, Web, Other
    permissions_json = Column(JSON, default=dict, nullable=False)  # e.g. {"camera": true, "location": false}
    risk_level = Column(String(20), default="low", nullable=False)  # low, moderate, high, critical
    review_notes = Column(Text, nullable=True)
    is_reviewed = Column(Boolean, default=True, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="permission_reviews")


class SecurityReport(Base):
    __tablename__ = "security_reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    report_title = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, default=0, nullable=False)
    risk_score = Column(Integer, nullable=True)
    risk_category = Column(String(50), nullable=True)
    summary_json = Column(JSON, default=dict, nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    user = relationship("User", back_populates="reports")

