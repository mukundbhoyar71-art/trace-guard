import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.security import SecurityRecommendation, ExternalCheckRecord, PrivacyPermissionReview
from app.models.scan import ExposureScan, BreachFinding

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

DEFAULT_RECOMMENDATIONS = [
    {
        "category": "password",
        "title": "Adopt a Dedicated Password Manager",
        "description": "Store all credentials in an encrypted zero-knowledge vault such as Bitwarden, 1Password, or KeePass.",
        "reason": "Eliminates memory-based passwords and cross-site credential reuse, preventing 80%+ of account takeovers.",
        "suggested_action": "Migrate saved browser passwords to a dedicated vault and generate 16+ character random passwords for every service.",
        "priority": "high",
    },
    {
        "category": "2fa",
        "title": "Enable Hardware or App-Based Two-Factor Authentication",
        "description": "Protect primary email, banking, and sensitive accounts with FIDO2 WebAuthn passkeys or TOTP authenticator apps.",
        "reason": "Prevents unauthorized logins even if a password is leaked in a third-party corporate data breach.",
        "suggested_action": "Navigate to account settings across your primary email and finance portals to configure Google Authenticator, Aegis, or a YubiKey.",
        "priority": "high",
    },
    {
        "category": "recovery",
        "title": "Review Account Recovery & Reset Options",
        "description": "Ensure your backup email addresses and phone numbers are current, verified, and not susceptible to SIM swapping.",
        "reason": "Stale or compromised recovery channels are a primary backdoor vector exploited by credential hijackers.",
        "suggested_action": "Audit backup phone numbers and recovery emails. Replace SMS verification with authenticator apps wherever possible.",
        "priority": "medium",
    },
    {
        "category": "monitoring",
        "title": "Establish a Regular Breach Audit Cadence",
        "description": "Schedule a monthly or quarterly reminder to verify your identity on Have I Been Pwned.",
        "reason": "Data breaches are typically published months after compromise; periodic checks ensure early threat awareness.",
        "suggested_action": "Set up a monitoring reminder in TRACE GUARD to receive periodic manual check prompts.",
        "priority": "medium",
    },
    {
        "category": "permissions",
        "title": "Audit Mobile & Desktop App Permissions",
        "description": "Review granted device permissions (Camera, Microphone, Precise Location, Contacts) for installed applications.",
        "reason": "Unnecessary background access allows tracking, data harvesting, and potential sensor surveillance.",
        "suggested_action": "Open the TRACE GUARD Privacy Center and record your reviewed permissions for sensitive apps.",
        "priority": "low",
    },
]

def sync_user_recommendations(db: Session, user_id: int) -> List[SecurityRecommendation]:
    """
    Evaluates telemetry across scans, external checks, and permissions,
    seeding and refreshing recommendations while preserving user completion state.
    """
    existing_recs = db.query(SecurityRecommendation).filter(
        SecurityRecommendation.user_id == user_id
    ).all()
    existing_by_title = {r.title: r for r in existing_recs}

    # 1. Ensure default security best practices exist
    for template in DEFAULT_RECOMMENDATIONS:
        if template["title"] not in existing_by_title:
            rec = SecurityRecommendation(
                user_id=user_id,
                category=template["category"],
                title=template["title"],
                description=template["description"],
                reason=template["reason"],
                suggested_action=template["suggested_action"],
                priority=template["priority"],
                status="pending",
                is_demo=False,
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            db.add(rec)
            existing_by_title[template["title"]] = rec

    # 2. Check for confirmed password exposures in verified external checks
    external_checks = db.query(ExternalCheckRecord).filter(
        ExternalCheckRecord.user_id == user_id
    ).all()
    total_external_breaches = sum(c.breaches_found_count for c in external_checks)

    if total_external_breaches > 0:
        breach_title = "Rotate Passwords for Confirmed Breached Services"
        if breach_title not in existing_by_title:
            rec = SecurityRecommendation(
                user_id=user_id,
                category="password",
                title=breach_title,
                description=f"You recorded {total_external_breaches} breached incident(s) in your external Have I Been Pwned audit.",
                reason="Credentials exposed in verified incidents are compiled into dark web dictionaries and automated stuffing scripts.",
                suggested_action="Change passwords immediately on all affected services. Never reuse passwords across other platforms.",
                priority="critical",
                status="pending",
                is_demo=False,
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            db.add(rec)
            existing_by_title[breach_title] = rec

    # 3. Check for high-risk permissions recorded
    reviews = db.query(PrivacyPermissionReview).filter(
        PrivacyPermissionReview.user_id == user_id
    ).all()
    high_risk_apps = [r for r in reviews if r.risk_level in ["high", "critical"]]
    if high_risk_apps:
        perm_title = f"Revoke Excessive Permissions for {len(high_risk_apps)} Applications"
        if perm_title not in existing_by_title:
            app_names = ", ".join(r.app_name for r in high_risk_apps[:3])
            rec = SecurityRecommendation(
                user_id=user_id,
                category="permissions",
                title=perm_title,
                description=f"Identified high-risk permissions granted to: {app_names}.",
                reason="Over-privileged applications expose location traces, background microphone access, or local contacts.",
                suggested_action="Open your device settings and toggle off unnecessary permissions for these apps.",
                priority="high",
                status="pending",
                is_demo=False,
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            db.add(rec)
            existing_by_title[perm_title] = rec

    # 4. Check for Demo Scan recommendations (clearly marked as demo)
    demo_scans = db.query(ExposureScan).filter(
        ExposureScan.user_id == user_id,
        ExposureScan.is_demo == True
    ).all()
    if demo_scans:
        demo_title = "[DEMO] Mitigate Simulated Credential Leak (Demo Corpora)"
        if demo_title not in existing_by_title:
            rec = SecurityRecommendation(
                user_id=user_id,
                category="password",
                title=demo_title,
                description="Simulated recommendation generated from fictional demo scan telemetry.",
                reason="DEMO DATA: Demonstrates how TRACE GUARD triggers mitigation steps when leaks are discovered.",
                suggested_action="Explore this recommendation and mark it completed to see progress update in the dashboard.",
                priority="medium",
                status="pending",
                is_demo=True,
                created_at=utc_now(),
                updated_at=utc_now(),
            )
            db.add(rec)
            existing_by_title[demo_title] = rec

    db.commit()

    # Return refreshed recommendations list ordered by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    all_recs = db.query(SecurityRecommendation).filter(
        SecurityRecommendation.user_id == user_id
    ).all()
    all_recs.sort(key=lambda x: (x.status == "completed", priority_order.get(x.priority, 99), -x.id))
    return all_recs

