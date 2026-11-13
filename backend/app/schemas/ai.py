import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1, max_length=4000)

class AiChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: Optional[List[ChatMessage]] = Field(default_factory=list)

class AiContextSummary(BaseModel):
    risk_score: Optional[int] = None
    risk_category: str
    grade: str
    coverage_percentage: int
    live_scans_count: int
    verified_breaches_count: int
    unresolved_breaches_count: int
    high_risk_permissions_count: int
    pending_recommendations_count: int
    monitoring_cadence: str

class AiChatResponse(BaseModel):
    response: str
    provider: str
    model: str
    is_live_ai: bool
    context_summary: AiContextSummary
    created_at: str

class AiStatusResponse(BaseModel):
    provider: str
    is_configured: bool
    model: str
    capabilities: List[str]

class SuggestedPrompt(BaseModel):
    id: str
    title: str
    prompt: str
    category: str

class AiSuggestedPromptsResponse(BaseModel):
    prompts: List[SuggestedPrompt]

class AiDiagnosticResponse(BaseModel):
    # Core diagnostic flags
    selected_provider: str
    api_key_configured: bool
    provider_initialized: bool
    actual_request_succeeded: bool

    # Extended telemetry fields
    provider: str
    is_configured: bool
    detected_key_type: str
    key_present: bool
    key_length: int
    key_masked: str
    model: str
    sdk_installed: bool
    sdk_version: Optional[str] = None
    connection_status: str
    connection_latency_ms: Optional[float] = None
    connection_message: str
    env_file_loaded: bool
    operational_mode: str


