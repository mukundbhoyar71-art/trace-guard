import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.services.session import get_current_user
from app.core.config import settings
from app.schemas.ai import (
    AiChatRequest,
    AiChatResponse,
    AiStatusResponse,
    AiSuggestedPromptsResponse,
    AiContextSummary,
    SuggestedPrompt,
    AiDiagnosticResponse,
)
from app.services.ai_assistant import (
    process_ai_chat,
    build_user_security_context,
    get_tailored_suggested_prompts,
    check_ai_provider_health,
)
from app.services.activity import log_activity

router = APIRouter(prefix="/ai", tags=["AI Security Assistant"])

def utc_now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

@router.get("/status", response_model=AiStatusResponse)
def get_ai_status(current_user: User = Depends(get_current_user)):
    """Returns the operational status and active provider of the AI Security Assistant."""
    provider = (settings.AI_PROVIDER or "gemini").lower()
    has_gemini = bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY.strip()) > 5)
    has_openai = bool(settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY.strip()) > 5)

    is_configured = (provider == "gemini" and has_gemini) or (provider == "openai" and has_openai)
    model = (
        (settings.GEMINI_MODEL or "gemini-3.5-flash") if (provider == "gemini" and has_gemini)
        else (settings.OPENAI_MODEL or "gpt-4o-mini") if (provider == "openai" and has_openai)
        else "traceguard-rules-v3.0"
    )

    capabilities = [
        "Real Database Telemetry Interpretation",
        "Risk Score & Factor Explanations",
        "Verified Breach Remediation Steps",
        "Browser Permission Privacy Auditing",
        "Assessment Coverage Recommendations",
    ]

    return AiStatusResponse(
        provider=provider if is_configured else "rule_engine",
        is_configured=is_configured,
        model=model,
        capabilities=capabilities,
    )


@router.get("/diagnostic", response_model=AiDiagnosticResponse)
async def get_ai_diagnostic(current_user: User = Depends(get_current_user)):
    """
    Returns a secure connectivity and configuration diagnostic report.
    Never exposes API secrets, tokens, or credentials.
    """
    health = await check_ai_provider_health()
    return AiDiagnosticResponse(**health)


@router.get("/suggested-prompts", response_model=AiSuggestedPromptsResponse)
def get_suggested_prompts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns dynamic prompt recommendations based on the user's authentic security telemetry."""
    context = build_user_security_context(db, current_user)
    raw_prompts = get_tailored_suggested_prompts(context)
    return AiSuggestedPromptsResponse(
        prompts=[SuggestedPrompt(**p) for p in raw_prompts]
    )


@router.post("/chat", response_model=AiChatResponse)
async def chat_with_assistant(
    payload: AiChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submits a user query to the AI Security Assistant.
    Analyzes user's real DB records (Risk Score Engine v3.0, verified breaches, permissions, recommendations).
    Returns real generative or rule-based security advice.
    """
    raw_history = [h.model_dump() for h in (payload.history or [])]

    response_text, provider_name, model_name, is_live_ai, context = await process_ai_chat(
        db=db,
        user=current_user,
        user_message=payload.message,
        history=raw_history,
    )

    summary = AiContextSummary(
        risk_score=context["risk_score"],
        risk_category=context["risk_category"],
        grade=context["grade"],
        coverage_percentage=context["coverage_percentage"],
        live_scans_count=context["live_scans_count"],
        verified_breaches_count=context["verified_breaches_count"],
        unresolved_breaches_count=context["unresolved_breaches_count"],
        high_risk_permissions_count=context["high_risk_permissions_count"],
        pending_recommendations_count=context["pending_recommendations_count"],
        monitoring_cadence=context["monitoring_cadence"],
    )

    # Log security activity
    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="ai_consultation",
        title="AI Security Advisor Consultation",
        description=f"Consulted AI Assistant on: '{payload.message[:60]}...'",
        status="info",
        metadata={
            "provider": provider_name,
            "model": model_name,
            "is_live_ai": is_live_ai,
        },
    )

    return AiChatResponse(
        response=response_text,
        provider=provider_name,
        model=model_name,
        is_live_ai=is_live_ai,
        context_summary=summary,
        created_at=utc_now_iso(),
    )

