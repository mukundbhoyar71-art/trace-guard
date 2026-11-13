import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

# ==========================================
# STAGE 1: SENSITIVE MEDIA SCANNER SCHEMAS
# ==========================================

class MediaFindingItem(BaseModel):
    category: str  # e.g., "High Skin-Tone Exposure", "Embedded GPS Geolocation", "Audio Voice/Acoustic Energy"
    detection_type: str  # "CONFIRMED", "POSSIBLE", "NOT_DETECTED", "UNSUPPORTED", "UNAVAILABLE"
    confidence: Optional[float] = None  # Float 0.0 - 1.0 where genuinely measurable
    detail: str
    recommendation: str

class MediaClassifierCapability(BaseModel):
    capability_name: str
    status: str  # "ACTIVE_LOCAL_HEURISTIC", "UNAVAILABLE", "UNSUPPORTED"
    engine_details: str
    explanation: str

class MediaScanResponse(BaseModel):
    file_name: str
    file_type: str
    media_kind: str  # "image", "audio", "unsupported"
    file_size_bytes: int
    is_supported: bool
    scan_status: str  # "COMPLETED", "UNSUPPORTED_FORMAT", "ERROR"
    classifier_capabilities: List[MediaClassifierCapability]
    technical_properties: Dict[str, Any]
    findings: List[MediaFindingItem]
    overall_privacy_risk: str  # "LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN"
    scanned_at: datetime.datetime
    recommendations: List[str]

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# PHASE A: ON-DEVICE AI IMAGE DETECTION
# ==========================================

class ImageDetectionResult(BaseModel):
    file_name: str
    file_size_bytes: int
    mime_type: str
    status: str  # "SENSITIVE_DETECTED", "NO_SENSITIVE_DETECTED", "MODEL_UNAVAILABLE", "UNSUPPORTED_FILE", "SCAN_FAILED"
    status_display: str  # User-facing label: "Potentially sensitive content detected", "No supported sensitive category detected", "Model unavailable", "Unsupported file", "Scan failed"
    primary_label: Optional[str] = None
    confidence: Optional[float] = None
    confidence_percent: Optional[float] = None
    probabilities: Dict[str, float] = Field(default_factory=dict)
    is_sensitive: bool = False
    risk_level: str = "LOW"  # "HIGH", "LOW", "UNKNOWN"
    interpretation: str
    recommendation: str
    model_info: Dict[str, Any] = Field(default_factory=dict)
    processed_at: datetime.datetime
    error_detail: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class BatchImageDetectionResponse(BaseModel):
    total_files: int
    processed_files: int
    sensitive_files_count: int
    model_status: str  # "AVAILABLE", "UNAVAILABLE"
    results: List[ImageDetectionResult]
    overall_risk: str  # "HIGH", "LOW", "UNKNOWN"
    scanned_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# STAGE 2: METADATA INTELLIGENCE SCHEMAS
# ==========================================

class MetadataFieldItem(BaseModel):
    key: str
    label: str
    value: str
    category: str  # "Geolocation", "Device & Hardware", "Temporal / Timestamps", "Author / Identity", "Technical / Structural"
    privacy_risk_level: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"
    privacy_significance: str

class MetadataExtractionResponse(BaseModel):
    file_name: str
    file_type: str
    media_kind: str  # "image", "audio", "unsupported"
    file_size_bytes: int
    has_exif: bool
    has_gps: bool
    gps_coordinates: Optional[Dict[str, Any]] = None  # { "latitude": 37.77, "longitude": -122.41, "altitude": 10.0, "maps_url": "..." }
    metadata_fields: List[MetadataFieldItem]
    overall_metadata_risk: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    extracted_at: datetime.datetime
    sanitization_available: bool
    summary: str

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# STAGE 3: SENSITIVE INFORMATION DETECTION SCHEMAS
# ==========================================

class SensitiveFindingItem(BaseModel):
    finding_id: str
    category: str  # "Credit Card Number", "API / Secret Key", "Social Security Number (SSN)", "IBAN Bank Account", "Email Address", "Phone Number", "Physical Address"
    detection_type: str  # "CONFIRMED", "POSSIBLE", "NOT_DETECTED"
    severity: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    masked_value: str
    line_number: Optional[int] = None
    column_offset: Optional[int] = None
    evidence_snippet: str
    risk_explanation: str
    remediation_advice: str

class DocumentScanResponse(BaseModel):
    file_name: str
    file_type: str
    file_size_bytes: int
    total_lines: int
    is_supported: bool
    scan_status: str  # "COMPLETED", "UNSUPPORTED_FORMAT", "ERROR"
    findings: List[SensitiveFindingItem]
    findings_count_by_severity: Dict[str, int]
    overall_privacy_risk: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW", "CLEAN"
    scanned_at: datetime.datetime
    recommendations: List[str]

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# PHASE A: ON-DEVICE AI IMAGE DETECTION
# ==========================================

class ImageDetectionResult(BaseModel):
    file_name: str
    file_size_bytes: int
    mime_type: str
    status: str  # "SENSITIVE_DETECTED", "NO_SENSITIVE_DETECTED", "MODEL_UNAVAILABLE", "UNSUPPORTED_FILE", "SCAN_FAILED"
    status_display: str  # User-facing label: "Potentially sensitive content detected", "No supported sensitive category detected", "Model unavailable", "Unsupported file", "Scan failed"
    primary_label: Optional[str] = None
    confidence: Optional[float] = None
    confidence_percent: Optional[float] = None
    probabilities: Dict[str, float] = Field(default_factory=dict)
    is_sensitive: bool = False
    risk_level: str = "LOW"  # "HIGH", "LOW", "UNKNOWN"
    interpretation: str
    recommendation: str
    model_info: Dict[str, Any] = Field(default_factory=dict)
    processed_at: datetime.datetime
    error_detail: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class BatchImageDetectionResponse(BaseModel):
    total_files: int
    processed_files: int
    sensitive_files_count: int
    model_status: str  # "AVAILABLE", "UNAVAILABLE"
    results: List[ImageDetectionResult]
    overall_risk: str  # "HIGH", "LOW", "UNKNOWN"
    scanned_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
