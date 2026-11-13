import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class PillarCoverageDetail(BaseModel):
    pillar_id: str
    name: str
    weight: int
    score: int
    is_evaluated: bool
    status: str
    status_label: str
    verification_type: str  # "Cryptographic Identity", "Direct API Scan", "User Attestation", "Browser API Query", "Active Monitoring Cadence", "Pending Audit"
    evidence_summary: str
    data_source: str
    last_checked_at: Optional[str] = None

class AnalyticsOverviewResponse(BaseModel):
    risk_score: Optional[int] = None
    risk_category: str
    grade: str
    coverage_percentage: int
    total_scans: int
    verified_breaches_count: int
    resolved_breaches_count: int
    unresolved_breaches_count: int
    high_risk_permissions_count: int
    pending_recommendations_count: int
    completed_recommendations_count: int
    monitoring_status: str
    last_audit_date: Optional[str] = None
    last_audit_source: Optional[str] = "None Recorded"  # "Direct API Scan", "User Attestation (Manual)", "None Recorded"
    last_audit_type: Optional[str] = "none"            # "api_scan", "user_attestation", "none"
    mitigation_credit: int = 0
    pillars: List[PillarCoverageDetail] = Field(default_factory=list)

class RiskTrendPoint(BaseModel):
    id: int
    score: int
    category: str
    coverage_percentage: int
    calculated_at: str
    engine_version: str = "3.0"
    methodology_change: bool = False

class RiskTrendsResponse(BaseModel):
    trends: List[RiskTrendPoint]
    engine_versions_present: List[str] = Field(default_factory=list)
    has_methodology_transition: bool = False

class ExposureClassStat(BaseModel):
    category: str
    count: int

class ExposureAnalyticsResponse(BaseModel):
    total_breaches: int
    resolved_count: int
    unresolved_count: int
    resolution_rate: float
    severity_breakdown: Dict[str, int]
    top_exposed_categories: List[ExposureClassStat]
    recent_breaches: List[Dict[str, Any]]

class PermissionProvenanceItem(BaseModel):
    id: int
    app_name: str
    platform: str
    provenance: str             # "Browser Permissions API (navigator.permissions)" or "Manual User Attestation (Self-Reported)"
    is_automated_device_audit: bool  # Always False for manual checklist or web API audits
    risk_level: str
    audit_date: Optional[str] = None
    granted_scopes: List[str] = Field(default_factory=list)
    restricted_scopes: List[str] = Field(default_factory=list)

class PermissionsAnalyticsResponse(BaseModel):
    total_reviewed: int
    status_counts: Dict[str, int]
    sensitive_scopes: Dict[str, str]
    platform_breakdown: Dict[str, int]
    audit_provenance: List[PermissionProvenanceItem] = Field(default_factory=list)

class RecommendationsAnalyticsResponse(BaseModel):
    total: int
    status_counts: Dict[str, int]
    priority_counts: Dict[str, int]
    category_counts: Dict[str, int]

class SecurityActivityAnalyticsResponse(BaseModel):
    activities: List[Dict[str, Any]]

