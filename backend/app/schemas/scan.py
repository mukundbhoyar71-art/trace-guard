import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, ConfigDict, Field

class ScanCreateRequest(BaseModel):
    email: EmailStr
    is_demo: bool = False

class BreachFindingResponse(BaseModel):
    id: int
    scan_id: int
    breach_name: str
    title: str
    domain: Optional[str] = None
    breach_date: Optional[str] = None
    added_date: Optional[datetime.datetime] = None
    pwn_count: Optional[int] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    data_classes: List[str] = []
    is_verified: bool = True
    is_fabricated: bool = False
    is_sensitive: bool = False
    is_retired: bool = False
    is_spam_list: bool = False
    is_malware: bool = False
    severity: str = "medium"
    is_resolved: bool = False
    resolved_at: Optional[datetime.datetime] = None
    recommended_actions: List[str] = []
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)

class RiskScoreBreakdown(BaseModel):
    score: int
    level: str  # "low", "moderate", "high", "critical"
    breach_count_score: int
    sensitivity_score: int
    recency_score: int
    repetition_score: int
    total_breaches: int
    most_recent_date: Optional[str] = None
    critical_categories_exposed: List[str] = []
    methodology: str
    disclaimer: str

class ExposureScanResponse(BaseModel):
    id: int
    user_id: int
    email: str
    status: str  # "completed", "failed", "running"
    scan_type: str = "Live HIBP API Scan"
    breaches_count: int
    exposed_categories_count: int
    verified_findings_count: int = 0
    unverified_findings_count: int = 0
    risk_score: int
    risk_level: str
    provider: str
    is_demo: bool = False
    error_message: Optional[str] = None
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    findings: Optional[List[BreachFindingResponse]] = None
    risk_breakdown: Optional[RiskScoreBreakdown] = None
    security_recommendations: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)

class ScanHistoryResponse(BaseModel):
    items: List[ExposureScanResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    live_total: int = 0
    demo_total: int = 0

class ScannerStatusResponse(BaseModel):
    configured: bool
    provider: str
    status: str  # "active" or "configuration_required"
    message: str
    demo_available: bool = True
    registered_email: str
    rate_limit_info: str


class UnifiedScanItemResponse(BaseModel):
    id: str  # e.g. EXP-12, PWD-45, EXT-7, BRW-3, APP-9, MED-22
    record_id: int
    category: str  # email_exposure, password_breach, external_verification, browser_permission, app_permission, sensitive_media
    category_label: str
    scan_name: str
    target: str
    executed_at: datetime.datetime
    status: str  # completed, failed, running
    findings_count: int = 0
    verified_findings_count: int = 0
    unverified_findings_count: int = 0
    severity: str = "low"  # critical, high, moderate, medium, low, none
    risk_score: Optional[int] = None
    scan_source: str
    verification_status: str
    is_demo: bool = False
    summary: str = ""
    detail_route: str = ""


class UnifiedScanHistoryResponse(BaseModel):
    items: List[UnifiedScanItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    live_total: int = 0
    demo_total: int = 0
    category_counts: Dict[str, int] = Field(default_factory=dict)


class UnifiedScanFindingItem(BaseModel):
    title: str
    severity: str = "low"
    verification_status: str
    category_or_domain: Optional[str] = None
    details: str = ""
    data_classes: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    is_resolved: Optional[bool] = None
    detected_date: Optional[str] = None


class UnifiedScanDetailResponse(BaseModel):
    id: str
    record_id: int
    category: str
    category_label: str
    scan_name: str
    target: str
    executed_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    status: str
    findings_count: int = 0
    verified_findings_count: int = 0
    unverified_findings_count: int = 0
    severity: str = "low"
    risk_score: Optional[int] = None
    scan_source: str
    verification_status: str
    is_demo: bool = False
    summary: str = ""
    error_message: Optional[str] = None
    severity_breakdown: Dict[str, int] = Field(default_factory=dict)
    findings: List[UnifiedScanFindingItem] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

