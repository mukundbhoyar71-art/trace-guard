import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ==========================================
# 1. SECURITY RECOMMENDATIONS
# ==========================================
class SecurityRecommendationUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(pending|completed|dismissed)$")

class SecurityRecommendationResponse(BaseModel):
    id: int
    user_id: int
    category: str
    title: str
    description: str
    reason: str
    suggested_action: str
    priority: str
    status: str
    is_demo: bool
    completed_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class SecurityRecommendationListResponse(BaseModel):
    items: List[SecurityRecommendationResponse]
    total: int
    completed_count: int
    pending_count: int


# ==========================================
# 2. SECURITY ACTIVITIES
# ==========================================
class SecurityActivityResponse(BaseModel):
    id: int
    user_id: int
    activity_type: str
    title: str
    description: str
    status: str
    metadata_json: Dict[str, Any]
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class SecurityActivityListResponse(BaseModel):
    items: List[SecurityActivityResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==========================================
# 3. PRIVACY RISK SCORE & FACTORS
# ==========================================
class PrivacyRiskFactor(BaseModel):
    name: str
    category_id: str  # "account_security", "email_breaches", "external_checks", "permissions", "hygiene"
    weight: int
    score: int
    status: str  # "VERIFIED_FINDING", "CLEAN_CHECK", "CHECK_NOT_PERFORMED", "CHECK_FAILED", "EXPIRED_STALE", "RESOLVED"
    status_label: str  # e.g. "Clean", "Verified Finding", "Pending Audit", "Overdue"
    description: str
    records_checked_count: int = 0
    findings_count: int = 0
    resolved_count: int = 0
    last_checked_at: Optional[datetime.datetime] = None
    data_source: str = ""
    evidence_summary: str = ""
    suggested_action: str = ""

class PrivacyRiskScoreResponse(BaseModel):
    score: Optional[int] = None
    category: str  # "Low", "Moderate", "High", "Critical", "Insufficient Data"
    rating: str = "Unknown"  # "Good", "Fair", "Poor", "Unknown"
    has_sufficient_data: bool
    is_demo: bool = False
    coverage_percentage: int = 0
    engine_version: str = "3.0"
    status_message: str
    factors: List[PrivacyRiskFactor]
    improvement_recommendations: List[str]
    metrics: Dict[str, Any] = Field(default_factory=dict)
    verified_findings_count: int = 0
    resolved_findings_count: int = 0
    previous_score: Optional[int] = None
    score_delta: Optional[int] = None
    calculated_at: datetime.datetime

class PrivacyRiskHistoryItem(BaseModel):
    id: int
    score: int
    category: str
    coverage_percentage: int = 0
    engine_version: str = "3.0"
    is_demo: bool = False
    calculated_at: datetime.datetime
    factors_json: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 4. MONITORING REMINDERS & EXTERNAL CHECKS
# ==========================================
class MonitoringReminderCreateRequest(BaseModel):
    target_email: EmailStr
    frequency: str = Field(default="monthly", pattern="^(weekly|biweekly|monthly|quarterly|one_time)$")
    next_reminder_at: Optional[datetime.datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)

class MonitoringReminderUpdateRequest(BaseModel):
    frequency: Optional[str] = Field(default=None, pattern="^(weekly|biweekly|monthly|quarterly|one_time)$")
    next_reminder_at: Optional[datetime.datetime] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = None

class MonitoringReminderResponse(BaseModel):
    id: int
    user_id: int
    target_email: str
    frequency: str
    next_reminder_at: datetime.datetime
    notes: Optional[str] = None
    is_active: bool
    last_reminded_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class ExternalCheckRecordCreateRequest(BaseModel):
    email: EmailStr
    check_date: Optional[datetime.datetime] = None
    breaches_found_count: int = Field(default=0, ge=0)
    breach_names: List[str] = Field(default_factory=list)
    user_notes: Optional[str] = Field(default=None, max_length=1000)

class ExternalCheckRecordResponse(BaseModel):
    id: int
    user_id: int
    email: str
    check_date: datetime.datetime
    breaches_found_count: int
    breach_names: List[str]
    user_notes: Optional[str] = None
    is_verified_by_user: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class MonitoringScanSummary(BaseModel):
    id: int
    email: str
    status: str
    scan_type: str = "Live HIBP API Scan"
    breaches_count: int
    exposed_categories_count: int
    verified_findings_count: int = 0
    unverified_findings_count: int = 0
    risk_score: int
    risk_level: str
    provider: str
    is_demo: bool = False
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class MonitoringConfigUpdateRequest(BaseModel):
    is_enabled: bool
    frequency: str = Field(default="monthly", pattern="^(daily|weekly|monthly)$")
    target_email: Optional[EmailStr] = None

class MonitoringConfigResponse(BaseModel):
    id: Optional[int] = None
    user_id: int
    is_enabled: bool = False
    frequency: str = "monthly"
    target_email: str
    next_run_at: Optional[datetime.datetime] = None
    last_run_at: Optional[datetime.datetime] = None
    last_status: Optional[str] = None
    last_error: Optional[str] = None
    hibp_configured: bool = False
    supported_frequencies: List[str] = Field(default_factory=lambda: ["daily", "weekly", "monthly"])

class MonitoringExecutionResponse(BaseModel):
    id: int
    user_id: int
    config_id: Optional[int] = None
    trigger_type: str
    status: str
    target_email: str
    findings_count: int = 0
    verified_findings_count: int = 0
    scan_id: Optional[int] = None
    error_message: Optional[str] = None
    started_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class MonitoringOverviewResponse(BaseModel):
    last_scan_date: Optional[datetime.datetime] = None
    last_scan_type: Optional[str] = None
    active_reminder: Optional[MonitoringReminderResponse] = None
    monitoring_enabled: bool = False
    reminder_frequency: Optional[str] = None
    next_reminder_date: Optional[datetime.datetime] = None
    last_completed_check_date: Optional[datetime.datetime] = None
    last_completed_check_source: str = "Never Performed"
    monitoring_status: str  # "Up to Date", "Check Overdue", "Scheduled Reminder Pending", "No Audits Yet"
    monitoring_mode_note: str = "Automated scheduled HIBP API monitoring runs when HIBP_API_KEY is configured; manual audit reminders and user-confirmed HIBP logs remain separate."
    total_scans_recorded: int
    live_scans_count: int = 0
    demo_scans_count: int = 0
    total_external_checks: int
    recent_checks: List[ExternalCheckRecordResponse]
    recent_live_scans: List[MonitoringScanSummary] = Field(default_factory=list)
    reminder_history: List[MonitoringReminderResponse] = Field(default_factory=list)
    auto_monitoring: Optional[MonitoringConfigResponse] = None
    recent_executions: List[MonitoringExecutionResponse] = Field(default_factory=list)


class PasswordCheckAuditRequest(BaseModel):
    breached: bool
    count: int = Field(ge=0)
    entropy_bits: int = Field(ge=0, le=512)
    entropy_label: str = Field(..., min_length=1, max_length=40)


class PasswordCheckAuditResponse(BaseModel):
    id: int
    breached: bool
    count: int
    entropy_bits: int
    entropy_label: str
    created_at: datetime.datetime


# ==========================================
# 5. PRIVACY & APP PERMISSIONS REVIEW
# ==========================================
class PrivacyPermissionReviewCreateRequest(BaseModel):
    app_name: str = Field(..., min_length=1, max_length=100)
    platform: str = Field(default="Web", pattern="^(iOS|Android|Windows|macOS|Web|Other)$")
    permissions_json: Dict[str, Any] = Field(default_factory=dict)
    review_notes: Optional[str] = Field(default=None, max_length=1000)

class PrivacyPermissionReviewUpdateRequest(BaseModel):
    app_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    platform: Optional[str] = Field(default=None, pattern="^(iOS|Android|Windows|macOS|Web|Other)$")
    permissions_json: Optional[Dict[str, Any]] = None
    review_notes: Optional[str] = Field(default=None, max_length=1000)
    is_reviewed: Optional[bool] = None

class BrowserPermissionAuditSaveRequest(BaseModel):
    browser_name: Optional[str] = Field(default="Browser", max_length=100)
    permissions: Dict[str, str] = Field(..., description="Real browser scopes (Camera, Microphone, Location, Notifications) mapped to GRANTED, DENIED, PROMPT, UNSUPPORTED, or ERROR")
    notes: Optional[str] = Field(default=None, max_length=1000)

class PrivacyPermissionReviewResponse(BaseModel):
    id: int
    user_id: int
    app_name: str
    platform: str
    permissions_json: Dict[str, Any]
    risk_level: str
    review_notes: Optional[str] = None
    is_reviewed: bool
    reviewed_at: datetime.datetime
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class PrivacyPermissionOverviewResponse(BaseModel):
    items: List[PrivacyPermissionReviewResponse]
    total_apps: int
    reviewed_apps: int
    completion_percentage: int
    high_risk_permissions_count: int
    checklist_status: str


# ==========================================
# 6. DOWNLOADABLE SECURITY REPORTS
# ==========================================
class SecurityReportCreateRequest(BaseModel):
    report_title: Optional[str] = Field(default="TRACE GUARD Comprehensive Security Dossier", max_length=150)
    include_demo_data: bool = False

class SecurityReportResponse(BaseModel):
    id: int
    user_id: int
    report_title: str
    report_type: str = "Production Security Dossier"
    status: str = "Available"
    file_size_bytes: int
    risk_score: Optional[int] = None
    risk_category: Optional[str] = None
    summary_json: Dict[str, Any]
    is_demo: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class SecurityReportListResponse(BaseModel):
    items: List[SecurityReportResponse]
    total: int
