import datetime
import logging
import time
from typing import Dict, Any, Tuple, Optional, List
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.models.security import (
    PrivacyPermissionReview,
    SecurityRecommendation,
    SecurityActivity,
    MonitoringReminder,
)
from app.models.scan import ExposureScan, BreachFinding
from app.services.risk_engine import calculate_privacy_risk_score

# Attempt to load google-genai SDK
try:
    from google import genai
    from google.genai import types
    HAS_GENAI_SDK = True
except ImportError:
    HAS_GENAI_SDK = False

logger = logging.getLogger(__name__)

def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def compute_grade(score: Optional[int], has_data: bool) -> str:
    if not has_data or score is None:
        return "--"
    if score <= 19:
        return "A+"
    if score <= 39:
        return "A"
    if score <= 59:
        return "B"
    if score <= 79:
        return "C"
    if score <= 89:
        return "D"
    return "F"

def build_user_security_context(db: Session, user: User) -> Dict[str, Any]:
    """
    Extracts authentic security telemetry for the authenticated user.
    STRICT PRIVACY: Passwords, password hashes, session cookies, and raw tokens
    are NEVER included in this context.
    """
    risk_data = calculate_privacy_risk_score(db, user.id)
    has_sufficient_data = risk_data.get("has_sufficient_data", False)
    score = risk_data.get("score")
    category = risk_data.get("category", "Insufficient Data")
    coverage = risk_data.get("coverage_percentage", 0)
    grade = compute_grade(score, has_sufficient_data)

    # 1. Live exposure scans and verified breaches (EXCLUDING demo records)
    live_scans = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == user.id,
            ExposureScan.is_demo == False,
            ExposureScan.status == "completed",
        )
        .order_by(ExposureScan.created_at.desc())
        .all()
    )

    breach_findings = (
        db.query(BreachFinding)
        .join(ExposureScan)
        .filter(
            ExposureScan.user_id == user.id,
            ExposureScan.is_demo == False,
        )
        .order_by(BreachFinding.created_at.desc())
        .all()
    )

    verified_breaches = [b for b in breach_findings if b.is_verified]
    unresolved_breaches = [b for b in verified_breaches if not b.is_resolved]

    # 2. Browser & application permission reviews
    permissions = (
        db.query(PrivacyPermissionReview)
        .filter(PrivacyPermissionReview.user_id == user.id)
        .order_by(PrivacyPermissionReview.updated_at.desc())
        .all()
    )

    high_risk_permissions = []
    for p in permissions:
        perms_map = p.permissions_json or {}
        active_high_risk = []
        for scope in ["camera", "microphone", "geolocation"]:
            val = str(perms_map.get(scope, "")).lower()
            if val in ["granted", "true"]:
                active_high_risk.append(scope)
        if active_high_risk or p.risk_level in ["high", "critical"]:
            high_risk_permissions.append({
                "app": p.app_name,
                "platform": p.platform,
                "risk_level": p.risk_level,
                "scopes": active_high_risk or list(perms_map.keys()),
            })

    # 3. Security recommendations
    recs = (
        db.query(SecurityRecommendation)
        .filter(
            SecurityRecommendation.user_id == user.id,
            SecurityRecommendation.is_demo == False,
        )
        .all()
    )
    pending_recs = [r for r in recs if r.status == "pending"]

    # 4. Monitoring reminder cadence
    reminder = (
        db.query(MonitoringReminder)
        .filter(
            MonitoringReminder.user_id == user.id,
            MonitoringReminder.is_active == True,
        )
        .first()
    )
    cadence = reminder.frequency.capitalize() if reminder else "Inactive"

    # 5. Recent security activities
    recent_activities = (
        db.query(SecurityActivity)
        .filter(SecurityActivity.user_id == user.id)
        .order_by(SecurityActivity.created_at.desc())
        .limit(5)
        .all()
    )

    # Compile sanitized text briefing for AI model
    exposed_categories_set = set()
    for b in verified_breaches:
        for dc in (b.data_classes or []):
            exposed_categories_set.add(dc)

    briefing_lines = [
        f"USER SECURITY PROFILE:",
        f"- Risk Score: {score if score is not None else 'Uncalculated (Insufficient Data)'} / 100",
        f"- Grade: {grade}",
        f"- Attack Surface Category: {category}",
        f"- Assessment Coverage: {coverage}%",
        f"- Completed Live Exposure Scans: {len(live_scans)}",
        f"- Verified Breaches: {len(verified_breaches)} ({len(unresolved_breaches)} unresolved)",
    ]

    if verified_breaches:
        briefing_lines.append(f"- Exposed Data Categories: {', '.join(sorted(list(exposed_categories_set))[:10])}")
        briefing_lines.append("Verified Incidents:")
        for b in verified_breaches[:5]:
            briefing_lines.append(f"  * {b.title or b.breach_name} (Date: {b.breach_date or 'Unknown'}, Severity: {b.severity}, Resolved: {b.is_resolved})")

    if high_risk_permissions:
        briefing_lines.append(f"- High Risk App/Browser Permissions: {len(high_risk_permissions)} active")
        for hr in high_risk_permissions[:4]:
            briefing_lines.append(f"  * {hr['app']} ({hr['platform']}): {', '.join(hr['scopes'])}")
    else:
        briefing_lines.append("- High Risk App/Browser Permissions: None detected or fully restricted")

    if pending_recs:
        briefing_lines.append(f"- Pending Remediation Recommendations: {len(pending_recs)}")
        for r in sorted(pending_recs, key=lambda x: (x.priority != 'critical', x.priority != 'high'))[:5]:
            briefing_lines.append(f"  * [{r.priority.upper()}] {r.title}: {r.suggested_action}")

    briefing_lines.append(f"- Breach Monitoring Cadence: {cadence}")

    if recent_activities:
        briefing_lines.append("Recent Audit Activity:")
        for a in recent_activities[:3]:
            briefing_lines.append(f"  * {a.title} ({a.status})")

    security_briefing = "\n".join(briefing_lines)

    return {
        "risk_score": score,
        "risk_category": category,
        "grade": grade,
        "coverage_percentage": coverage,
        "has_sufficient_data": has_sufficient_data,
        "live_scans_count": len(live_scans),
        "verified_breaches_count": len(verified_breaches),
        "unresolved_breaches_count": len(unresolved_breaches),
        "high_risk_permissions_count": len(high_risk_permissions),
        "pending_recommendations_count": len(pending_recs),
        "monitoring_cadence": cadence,
        "verified_breaches": [
            {
                "name": b.breach_name,
                "title": b.title,
                "severity": b.severity,
                "date": b.breach_date,
                "is_resolved": b.is_resolved,
                "data_classes": b.data_classes,
            }
            for b in verified_breaches
        ],
        "high_risk_permissions": high_risk_permissions,
        "pending_recs": [
            {"title": r.title, "priority": r.priority, "action": r.suggested_action}
            for r in pending_recs
        ],
        "security_briefing": security_briefing,
        "factors": risk_data.get("factors", []),
    }


def generate_rule_based_response(context: Dict[str, Any], user_message: str) -> str:
    """
    Intelligent cybersecurity rule-based response engine.
    Used when generative AI keys are not configured or external provider APIs are unavailable.
    Provides precise, data-grounded insights strictly based on user's real database records.
    """
    msg = user_message.lower()
    score = context["risk_score"]
    grade = context["grade"]
    category = context["risk_category"]
    coverage = context["coverage_percentage"]
    breaches_count = context["verified_breaches_count"]
    unresolved_count = context["unresolved_breaches_count"]
    perms_count = context["high_risk_permissions_count"]
    pending_recs = context["pending_recs"]

    # 1. Inquiries about Risk Score / Surface / Grade
    if any(k in msg for k in ["score", "risk", "surface", "grade", "rating", "evaluate"]):
        if not context["has_sufficient_data"]:
            return (
                f"### Privacy & Attack Surface Score Status: Insufficient Data\n\n"
                f"Your assessment score currently displays **Insufficient Data** because TRACE GUARD requires at least one verified security audit before computing a real risk score. Missing scans are never assumed clean.\n\n"
                f"**Current Coverage:** `{coverage}%`\n\n"
                f"#### Recommended Immediate Actions to Establish Baseline:\n"
                f"1. **Perform a Personal Data Exposure Scan:** Run a genuine scan on your primary email address under **Data Exposure**.\n"
                f"2. **Record an External HIBP Check:** Confirm a Have I Been Pwned manual check under **Breach Monitoring**.\n"
                f"3. **Audit Browser Permissions:** Complete a real permission audit under **Browser Permissions**.\n\n"
                f"Once verified records exist, TRACE GUARD's v3.0 Engine will generate your authentic Attack Surface Score."
            )
        return (
            f"### Attack Surface Assessment Breakdown\n\n"
            f"- **Current Privacy Risk Score:** `{score} / 100` ({category} Risk)\n"
            f"- **Security Grade:** `{grade}`\n"
            f"- **Assessment Coverage:** `{coverage}%`\n"
            f"- **Verified Breach Findings:** `{breaches_count}` ({unresolved_count} unresolved)\n\n"
            f"#### How Your Score is Calculated (Engine v3.0):\n"
            f"TRACE GUARD scores 5 security pillars across genuine database telemetry:\n"
            f"1. **Account Profile & Auth:** Assesses password strength, email verification, and session freshness.\n"
            f"2. **Data Exposure:** Evaluates verified breaches, compromised data classes, and recency.\n"
            f"3. **HIBP Monitoring:** Assesses user-confirmed external breach checks.\n"
            f"4. **Device & Browser Permissions:** Inspects sensitive scopes (Camera, Microphone, Geolocation).\n"
            f"5. **Hygiene & Cadence:** Evaluates proactive monitoring cadence and mitigation credits.\n\n"
            f"**To lower your risk score:** Focus on resolving exposed breach accounts and completing pending recommendations."
        )

    # 2. Inquiries about Breaches / Leaks / Pwned
    if any(k in msg for k in ["breach", "pwned", "leak", "compromise", "exposed", "hack"]):
        if breaches_count == 0:
            return (
                f"### Verified Breach Telemetry\n\n"
                f"Good news! TRACE GUARD has recorded **0 verified data breaches** for your scanned identities.\n\n"
                f"- Total Live Scans Completed: `{context['live_scans_count']}`\n"
                f"- Active Monitoring Cadence: `{context['monitoring_cadence']}`\n\n"
                f"#### Maintenance Checklist:\n"
                f"- Keep your **Breach Monitoring** schedule active so you are notified if new dumps appear online.\n"
                f"- Never reuse passwords across critical online services.\n"
                f"- Use hardware or authenticator app-based two-factor authentication (2FA)."
            )
        
        breach_list_md = []
        for b in context["verified_breaches"][:5]:
            status_str = "RESOLVED" if b["is_resolved"] else "**UNRESOLVED (Action Required)**"
            classes_str = ", ".join(b["data_classes"][:4]) if b["data_classes"] else "Account Data"
            breach_list_md.append(f"- **{b['title']}** (Date: {b['date'] or 'Unknown'}) — {status_str}\n  *Exposed:* {classes_str}")

        return (
            f"### Verified Breach Findings ({breaches_count} Detected)\n\n"
            f"TRACE GUARD has detected **{breaches_count} verified breach incident(s)** associated with your identity ({unresolved_count} currently marked unresolved):\n\n"
            + "\n".join(breach_list_md) + "\n\n"
            f"#### Immediate Remediation Steps:\n"
            f"1. **Change Compromised Passwords:** Immediately update passwords for every impacted service. Ensure new passwords are at least 16 characters and generated by a password manager.\n"
            f"2. **Enable Multi-Factor Authentication (2FA):** Turn on TOTP authenticator app or security key 2FA.\n"
            f"3. **Check Password Reuse:** If you reused the breached password on other services (banking, email, cloud storage), change those immediately.\n"
            f"4. **Mark as Resolved:** Once you secure the account, mark the incident as resolved in TRACE GUARD to receive mitigation credits."
        )

    # 3. Inquiries about Permissions / Camera / Microphone / Location / Browser
    if any(k in msg for k in ["permission", "camera", "microphone", "location", "browser", "device"]):
        if perms_count == 0:
            return (
                f"### Browser & Application Permission Audit\n\n"
                f"No high-risk permission exposures are currently recorded for your browser sessions.\n\n"
                f"- High-Risk Scopes Detected: `0`\n"
                f"- Monitored Scopes: Camera, Microphone, Geolocation, Notifications\n\n"
                f"#### Best Practices for Web Permissions:\n"
                f"- Keep sensitive hardware (camera, microphone) set to **'Ask every time'** or **'Blocked'**.\n"
                f"- Periodically run the **Browser Permissions** audit tool in TRACE GUARD to verify that no untrusted domain has gained persistent access."
            )

        perm_list_md = []
        for p in context["high_risk_permissions"]:
            perm_list_md.append(f"- **{p['app']}** ({p['platform']}): High-risk scopes granted (`{', '.join(p['scopes'])}`)")

        return (
            f"### High-Risk Browser Permissions Detected ({perms_count} Active)\n\n"
            f"The following browser permissions pose an elevated privacy exposure:\n\n"
            + "\n".join(perm_list_md) + "\n\n"
            f"#### Why This Matters:\n"
            f"- **Camera & Microphone:** Malicious or compromised web applications could capture background audio/video without visual indicators.\n"
            f"- **Geolocation:** Grants precise physical coordinates, enabling physical tracking and profiling.\n\n"
            f"#### How to Revoke in Your Browser:\n"
            f"1. Click the **padlock or site settings icon** next to the URL in your browser address bar.\n"
            f"2. Locate *Permissions* or *Site Settings*.\n"
            f"3. Change **Camera**, **Microphone**, and **Location** to **'Block'** or **'Reset permissions'**."
        )

    # 4. Inquiries about Recommendations / Remediation / Action
    if any(k in msg for k in ["recommend", "action", "fix", "improve", "remediation", "plan"]):
        if not pending_recs:
            return (
                f"### Security Recommendations Status\n\n"
                f"All primary security recommendations are currently fulfilled! Your security posture has no outstanding critical alerts.\n\n"
                f"- Monitoring Cadence: `{context['monitoring_cadence']}`\n"
                f"- Current Score: `{score if score is not None else '--'}`\n\n"
                f"Continue maintaining periodic scans under **Breach Monitoring** to ensure ongoing protection."
            )

        recs_md = []
        for r in pending_recs[:4]:
            recs_md.append(f"- **[{r['priority'].upper()}] {r['title']}**\n  *Action:* {r['action']}")

        return (
            f"### Priority Security Recommendations\n\n"
            f"TRACE GUARD has identified **{len(pending_recs)} pending security action(s)** to strengthen your privacy:\n\n"
            + "\n".join(recs_md) + "\n\n"
            f"Completing these actions will directly improve your Attack Surface Score and reduce exposure risk."
        )

    # 5. Inquiries about Coverage / Audit Completeness
    if any(k in msg for k in ["coverage", "audit", "complete", "100%", "baseline"]):
        return (
            f"### Assessment Coverage Telemetry: {coverage}%\n\n"
            f"TRACE GUARD evaluates **Assessment Coverage** alongside your Risk Score to measure the completeness of your security audit:\n\n"
            f"- Current Coverage: `{coverage}%`\n"
            f"- Live Scans Completed: `{context['live_scans_count']}`\n"
            f"- Permissions Audited: `{len(context.get('high_risk_permissions', []))}` recorded\n"
            f"- Monitoring Cadence: `{context['monitoring_cadence']}`\n\n"
            f"#### Steps to Achieve 100% Assessment Coverage:\n"
            f"1. Complete a live **Data Exposure** scan.\n"
            f"2. Audit your **Browser Permissions**.\n"
            f"3. Schedule an active **Breach Monitoring** check.\n"
            f"4. Review and resolve all pending **Security Recommendations**."
        )

    # 6. General / Fallback Response
    return (
        f"### TRACE GUARD Security Advisor\n\n"
        f"Here is a summary of your real-time security posture:\n\n"
        f"- **Risk Score:** `{score if score is not None else 'Uncalculated (Insufficient Data)'} / 100` ({grade})\n"
        f"- **Coverage:** `{coverage}%`\n"
        f"- **Verified Breaches:** `{breaches_count}` ({unresolved_count} unresolved)\n"
        f"- **High-Risk Permissions:** `{perms_count}` active\n\n"
        f"#### How can I assist your privacy defense today?\n"
        f"- Ask me to **'Explain my risk score'** to see factor weights and score calculations.\n"
        f"- Ask me **'What should I do about my verified breaches?'** for incident containment.\n"
        f"- Ask me **'How do I fix my browser permissions?'** to audit device access.\n"
        f"- Ask me **'Give me a remediation plan'** to prioritize pending security actions."
    )


async def call_gemini_api(api_key: str, system_prompt: str, user_message: str, history: List[Dict[str, str]]) -> Tuple[str, str]:
    """
    Executes a structured generative AI reasoning request using Google Gemini API.
    Attempts primary configured model, with seamless, non-blocking failover across
    healthy models (gemini-3.5-flash-lite, gemini-flash-lite-latest, gemini-3.5-flash).
    Uses direct asynchronous HTTP REST with httpx to prevent SDK tenacity retry freezes on HTTP 429.
    Returns: (generated_text, model_name)
    """
    candidate_models = [
        settings.GEMINI_MODEL or "gemini-3.5-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
    ]
    # Remove duplicates while preserving order
    seen = set()
    model_sequence = [m for m in candidate_models if not (m in seen or seen.add(m))]

    # Build prompt with history
    conversation_context = f"{system_prompt}\n\n---\nCONVERSATION HISTORY:\n"
    for h in history[-4:]:
        role = "User" if h.get("role") == "user" else "Assistant"
        conversation_context += f"{role}: {h.get('content')}\n"
    conversation_context += f"\nUser Question: {user_message}\n\nPlease provide your expert security analysis:"

    last_error = None
    async with httpx.AsyncClient(timeout=25.0) as http_client:
        for model_name in model_sequence:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": conversation_context}],
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 1000,
                },
            }
            try:
                resp = await http_client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        for p in parts:
                            if "text" in p and p["text"]:
                                return (p["text"], model_name)
                else:
                    last_error = f"HTTP {resp.status_code}"
                    logger.warning(f"Gemini REST endpoint {model_name} returned {resp.status_code}: {resp.text[:120]}")
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Gemini REST call for {model_name} exception: {e}")

    raise RuntimeError(f"All configured Gemini models failed. Last error: {last_error}")


async def call_openai_api(api_key: str, system_prompt: str, user_message: str, history: List[Dict[str, str]]) -> Tuple[str, str]:
    """Calls OpenAI REST API using httpx."""
    url = "https://api.openai.com/v1/chat/completions"
    model_name = settings.OPENAI_MODEL or "gpt-4o-mini"
    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-4:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 1000,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=25.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            raise RuntimeError(f"OpenAI API error {resp.status_code}: {resp.text}")
        data = resp.json()
        choices = data.get("choices", [])
        if choices and "message" in choices[0]:
            return (choices[0]["message"].get("content", ""), model_name)
        raise RuntimeError("No message content returned from OpenAI.")


async def check_ai_provider_health() -> Dict[str, Any]:
    """
    Performs a safe, zero-leakage diagnostic of the configured AI provider.
    Verifies API connectivity, latency, and operational mode without returning secrets.
    """
    provider = (settings.AI_PROVIDER or "gemini").lower()
    gemini_key = settings.GEMINI_API_KEY
    openai_key = settings.OPENAI_API_KEY

    selected_provider = provider
    api_key_configured = False
    provider_initialized = False
    actual_request_succeeded = False

    is_configured = False
    detected_key_type = "none"
    key_present = False
    key_length = 0
    key_masked = "Not Configured"
    model = "traceguard-rules-v3.0"
    connection_status = "UNCONFIGURED"
    connection_latency_ms = None
    connection_message = "No AI provider API key configured in backend environment."
    operational_mode = "LOCAL_RULE_BASED_ADVISOR"

    if provider == "gemini":
        detected_key_type = "gemini_api_key"
        model = settings.GEMINI_MODEL or "gemini-3.5-flash-lite"
        if gemini_key and len(gemini_key.strip()) > 5:
            is_configured = True
            api_key_configured = True
            provider_initialized = True
            key_present = True
            key_length = len(gemini_key.strip())
            key_masked = f"{gemini_key.strip()[:4]}...{gemini_key.strip()[-4:]}"

            # Run light connectivity ping across candidate models
            t0 = time.perf_counter()
            test_models = [
                model,
                "gemini-3.5-flash-lite",
                "gemini-flash-lite-latest",
                "gemini-3.5-flash",
            ]
            seen = set()
            test_sequence = [m for m in test_models if not (m in seen or seen.add(m))]

            async with httpx.AsyncClient(timeout=12.0) as client:
                for test_model in test_sequence:
                    try:
                        ping_url = f"https://generativelanguage.googleapis.com/v1beta/models/{test_model}:generateContent?key={gemini_key.strip()}"
                        ping_body = {
                            "contents": [{"role": "user", "parts": [{"text": "ping"}]}],
                            "generationConfig": {"maxOutputTokens": 5},
                        }
                        resp = await client.post(ping_url, json=ping_body)
                        if resp.status_code == 200:
                            dt = round((time.perf_counter() - t0) * 1000, 2)
                            actual_request_succeeded = True
                            connection_status = "CONNECTED"
                            connection_latency_ms = dt
                            connection_message = f"Successfully connected to Google Gemini API ({test_model}) in {dt}ms."
                            operational_mode = "LIVE_GENERATIVE_AI"
                            model = test_model
                            break
                        else:
                            connection_message = f"Gemini API ({test_model}) returned HTTP {resp.status_code}."
                    except Exception as e:
                        connection_message = f"Gemini connection attempt ({test_model}) error: {type(e).__name__}"

            if not actual_request_succeeded and connection_status != "CONNECTED":
                connection_status = "ERROR"

    elif provider == "openai":
        detected_key_type = "openai_api_key"
        model = settings.OPENAI_MODEL or "gpt-4o-mini"
        if openai_key and len(openai_key.strip()) > 5:
            is_configured = True
            api_key_configured = True
            provider_initialized = True
            key_present = True
            key_length = len(openai_key.strip())
            key_masked = f"{openai_key.strip()[:3]}...{openai_key.strip()[-4:]}"
            t0 = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(
                        "https://api.openai.com/v1/models",
                        headers={"Authorization": f"Bearer {openai_key.strip()}"},
                    )
                    dt = round((time.perf_counter() - t0) * 1000, 2)
                    if resp.status_code == 200:
                        actual_request_succeeded = True
                        connection_status = "CONNECTED"
                        connection_latency_ms = dt
                        connection_message = f"Successfully connected to OpenAI API ({model}) in {dt}ms."
                        operational_mode = "LIVE_GENERATIVE_AI"
                    else:
                        connection_status = "ERROR"
                        connection_message = f"OpenAI API returned HTTP {resp.status_code}."
            except Exception as e:
                connection_status = "ERROR"
                connection_message = f"OpenAI connectivity check failed: {type(e).__name__}"

    return {
        "selected_provider": selected_provider,
        "api_key_configured": api_key_configured,
        "provider_initialized": provider_initialized,
        "actual_request_succeeded": actual_request_succeeded,
        "provider": provider,
        "is_configured": is_configured,
        "detected_key_type": detected_key_type,
        "key_present": key_present,
        "key_length": key_length,
        "key_masked": key_masked,
        "model": model if is_configured else "traceguard-rules-v3.0",
        "sdk_installed": HAS_GENAI_SDK,
        "sdk_version": "google-genai 3.0.0" if HAS_GENAI_SDK else "httpx REST",
        "connection_status": connection_status,
        "connection_latency_ms": connection_latency_ms,
        "connection_message": connection_message,
        "env_file_loaded": True,
        "operational_mode": operational_mode,
    }


async def process_ai_chat(
    db: Session,
    user: User,
    user_message: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Tuple[str, str, str, bool, Dict[str, Any]]:
    """
    Orchestrates the AI chat interaction:
    1. Extracts real database security context.
    2. Constructs strict cybersecurity advisor system prompt.
    3. Dispatches to configured AI provider (Gemini or OpenAI).
    4. Falls back gracefully to intelligent rule-based engine if keys are absent or API fails.
    Returns: (response_text, provider_name, model_name, is_live_ai, context_summary)
    """
    if history is None:
        history = []

    context = build_user_security_context(db, user)

    system_prompt = f"""You are the TRACE GUARD AI Security Assistant, an elite cybersecurity and privacy intelligence advisor.
You advise the user based EXCLUSIVELY on their authentic, verified security assessment telemetry.
Never invent or hallucinate breaches, permissions, or security stats.
Format responses in clear, structured Markdown with headers, bold emphasis, and bullet points.
Never reveal sensitive internal configuration details, tokens, or raw hashes.

USER REAL TELEMETRY CONTEXT:
{context['security_briefing']}

DISCLAIMER: Always emphasize that TRACE GUARD provides defensive privacy guidance. For active credential stuffing attacks or critical corporate breaches, prompt remediation and incident response is advised.
"""

    provider_choice = (settings.AI_PROVIDER or "gemini").lower()
    gemini_key = settings.GEMINI_API_KEY
    openai_key = settings.OPENAI_API_KEY

    last_error_reason = None

    # 1. Attempt Gemini if configured
    if provider_choice == "gemini" and gemini_key and len(gemini_key.strip()) > 5:
        try:
            ai_text, used_model = await call_gemini_api(gemini_key.strip(), system_prompt, user_message, history)
            return (ai_text, "gemini", used_model, True, context)
        except Exception as e:
            last_error_reason = str(e)
            logger.warning(f"Gemini API request failed: {e}. Falling back to rule-based engine.")

    # 2. Attempt OpenAI if configured
    if (provider_choice == "openai" or (openai_key and len(openai_key.strip()) > 5)) and openai_key:
        try:
            ai_text, used_model = await call_openai_api(openai_key.strip(), system_prompt, user_message, history)
            return (ai_text, "openai", used_model, True, context)
        except Exception as e:
            last_error_reason = str(e)
            logger.warning(f"OpenAI API request failed: {e}. Falling back to rule-based engine.")

    # 3. Graceful Rule-Based Advisor Fallback
    rule_text = generate_rule_based_response(context, user_message)
    if not (gemini_key or openai_key):
        fallback_note = (
            "\n\n---\n*Security Advisor Note: Operating in verified rule-based telemetry mode. "
            "To enable real-time generative reasoning, configure GEMINI_API_KEY or OPENAI_API_KEY in the backend environment.*"
        )
    elif last_error_reason:
        fallback_note = (
            f"\n\n---\n*Security Advisor Note: Generative AI upstream service temporarily unavailable ({last_error_reason}). "
            "Delivering guidance via verified rule-based telemetry engine.*"
        )
    else:
        fallback_note = (
            "\n\n---\n*Security Advisor Note: Operating in verified rule-based telemetry mode.*"
        )
    final_text = rule_text + fallback_note

    return (final_text, "rule_engine", "traceguard-rules-v3.0", False, context)


def get_tailored_suggested_prompts(context: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generates suggested questions tailored to the user's authentic data."""
    prompts = [
        {
            "id": "p1",
            "title": "Explain My Risk Score",
            "prompt": "Explain my current Privacy & Attack Surface Score and what factors caused point deductions.",
            "category": "Risk Analysis",
        },
        {
            "id": "p2",
            "title": "Top Security Vulnerabilities",
            "prompt": "What is my biggest privacy vulnerability right now and how should I fix it?",
            "category": "Vulnerability",
        },
    ]

    if context["verified_breaches_count"] > 0:
        prompts.append({
            "id": "p3",
            "title": "Remediate Verified Breaches",
            "prompt": f"I have {context['verified_breaches_count']} verified breaches. What immediate steps should I take to contain the leak?",
            "category": "Breach Response",
        })
    else:
        prompts.append({
            "id": "p3",
            "title": "Prevent Credential Leaks",
            "prompt": "How do I ensure my passwords and personal data remain protected against future credential stuffing attacks?",
            "category": "Breach Prevention",
        })

    if context["high_risk_permissions_count"] > 0:
        prompts.append({
            "id": "p4",
            "title": "Fix High-Risk Permissions",
            "prompt": "Which browser permissions present the greatest risk to my privacy and how do I revoke them?",
            "category": "Permissions",
        })
    else:
        prompts.append({
            "id": "p4",
            "title": "Increase Security Coverage",
            "prompt": f"My assessment coverage is {context['coverage_percentage']}%. How do I achieve 100% comprehensive audit coverage?",
            "category": "Coverage",
        })

    return prompts
