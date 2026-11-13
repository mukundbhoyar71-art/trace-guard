import datetime
from typing import List, Dict, Any, Tuple
from app.schemas.scan import RiskScoreBreakdown

CRITICAL_DATA_CLASSES = {
    "passwords",
    "passwords (plaintext)",
    "banking details",
    "credit cards",
    "financial transactions",
    "social security numbers",
    "government issued ids",
    "government identifiers",
    "biometric data",
    "health records",
    "pins",
    "security questions and answers",
}

HIGH_DATA_CLASSES = {
    "phone numbers",
    "physical addresses",
    "geographic locations",
    "private messages",
    "ip addresses",
    "password hints",
    "auth tokens",
    "cryptographic keys",
    "passport numbers",
    "driver's licenses",
}

MODERATE_DATA_CLASSES = {
    "usernames",
    "dates of birth",
    "job titles",
    "employers",
    "names",
    "genders",
    "spoken languages",
    "social connections",
    "marital statuses",
}

LOW_DATA_CLASSES = {
    "email addresses",
    "website activity",
    "user statuses",
    "browser user agent details",
    "purchasing habits",
    "avatars",
}


def compute_breach_severity(data_classes: List[str]) -> str:
    """
    Computes severity level ('low', 'medium', 'high', 'critical') for an individual breach
    based on the sensitivity of its exposed data classes.
    """
    normalized = [c.strip().lower() for c in data_classes]
    if any(c in CRITICAL_DATA_CLASSES for c in normalized):
        return "critical"
    if any(c in HIGH_DATA_CLASSES for c in normalized):
        return "high"
    if any(c in MODERATE_DATA_CLASSES for c in normalized):
        return "medium"
    return "low"


def generate_recommendations_for_breach(data_classes: List[str], breach_title: str) -> List[str]:
    """
    Generates targeted security recommendations for a single breach based on exposed data categories.
    """
    normalized = set(c.strip().lower() for c in data_classes)
    recommendations = []

    if any(c in CRITICAL_DATA_CLASSES for c in normalized):
        recommendations.append(f"Immediately update your password on {breach_title} and any other service where you used a similar password.")
        recommendations.append("Adopt a dedicated password manager to generate unique 16+ character passwords for every account.")

    if any(c in HIGH_DATA_CLASSES for c in normalized):
        if "phone numbers" in normalized:
            recommendations.append("Be vigilant against SMS phishing (smishing) and verify bank/service requests through official phone numbers.")
            recommendations.append("Switch two-factor authentication (2FA) from SMS to an authenticator app (TOTP) or hardware security key.")
        if "ip addresses" in normalized or "geographic locations" in normalized:
            recommendations.append("Review recent login sessions on critical accounts and sign out of unrecognized devices.")

    if any(c in MODERATE_DATA_CLASSES for c in normalized):
        recommendations.append("Be alert to spear-phishing emails addressing you by name or referencing your job title/employer.")

    if not recommendations:
        recommendations.append(f"Enable multi-factor authentication (MFA) on {breach_title} to protect against credential stuffing.")

    return recommendations


def generate_overall_recommendations(all_findings: List[Dict[str, Any]]) -> List[str]:
    """
    Generates an aggregated, deduplicated, prioritized list of recommendations for the entire scan.
    """
    if not all_findings:
        return [
            "Your email did not appear in any publicly known data breach indexes monitored by TRACE GUARD.",
            "Continue practicing defense-in-depth: use unique passwords and enable 2FA on all important accounts.",
            "Schedule periodic exposure scans to catch emerging security incidents promptly."
        ]

    all_data_classes = set()
    for f in all_findings:
        classes = f.get("data_classes") or []
        for c in classes:
            all_data_classes.add(c.strip().lower())

    recs = []
    has_passwords = any(c in CRITICAL_DATA_CLASSES for c in all_data_classes)
    has_phones = "phone numbers" in all_data_classes
    has_financial = any(c in {"banking details", "credit cards", "financial transactions"} for c in all_data_classes)
    has_personal = any(c in {"physical addresses", "social security numbers", "government identifiers"} for c in all_data_classes)

    if has_passwords:
        recs.append("CRITICAL: Passwords were exposed in verified breaches. Change credentials on compromised accounts immediately and never reuse passwords.")
        recs.append("Deploy an encrypted password manager (Bitwarden, 1Password, or KeePass) to audit existing credentials.")

    if has_phones:
        recs.append("HIGH: Phone number exposed. Contact your cellular carrier to request a SIM-transfer PIN lock to protect against SIM-swapping.")
        recs.append("Migrate away from SMS verification codes in favor of hardware security keys (FIDO2/WebAuthn) or TOTP apps.")

    if has_financial:
        recs.append("HIGH: Financial indicators detected. Review recent credit card and bank statements for unauthorized transactions and consider placing a credit freeze.")

    if has_personal:
        recs.append("MODERATE: Identity details exposed. Watch for impersonation attempts, tax fraud, or sophisticated spear-phishing.")

    recs.append("Audit active sessions across critical accounts (Google, Microsoft, banking, email) and revoke obsolete authorizations.")
    recs.append("Enable two-factor authentication (2FA) across all identity providers and communication services.")

    return recs


def calculate_exposure_risk_score(breaches: List[Dict[str, Any]]) -> Tuple[int, str, RiskScoreBreakdown]:
    """
    Calculates a transparent exposure risk score between 0 and 100.
    Factors:
      1. Breach volume (up to 30 pts)
      2. Exposed data sensitivity (up to 45 pts)
      3. Recency of breaches (up to 15 pts)
      4. Repeated exposure of sensitive categories (up to 10 pts)
    """
    total_breaches = len(breaches)
    if total_breaches == 0:
        breakdown = RiskScoreBreakdown(
            score=0,
            level="low",
            breach_count_score=0,
            sensitivity_score=0,
            recency_score=0,
            repetition_score=0,
            total_breaches=0,
            most_recent_date=None,
            critical_categories_exposed=[],
            methodology="Score is computed from breach volume (max 30), exposed data sensitivity tiers (max 45), recency of latest breach (max 15), and repeated exposure of high-risk credentials across multiple breaches (max 10).",
            disclaimer="This risk score is an indicative exposure assessment based on publicly reported data breaches. It does not constitute a full penetration test or comprehensive vulnerability audit."
        )
        return 0, "low", breakdown

    # 1. Breach Volume Score (max 30)
    if total_breaches == 1:
        breach_count_score = 10
    elif total_breaches <= 3:
        breach_count_score = 18
    elif total_breaches <= 6:
        breach_count_score = 25
    else:
        breach_count_score = 30

    # 2. Data Sensitivity Score (max 45)
    category_counts = {}
    critical_categories_exposed = []
    for b in breaches:
        classes = b.get("DataClasses") or b.get("data_classes") or []
        for c in classes:
            norm = c.strip().lower()
            category_counts[norm] = category_counts.get(norm, 0) + 1
            if norm in CRITICAL_DATA_CLASSES and c not in critical_categories_exposed:
                critical_categories_exposed.append(c)

    sens_score = 0
    # Tier 4: Critical
    if any(c in CRITICAL_DATA_CLASSES for c in category_counts):
        sens_score += 25
        # Additional critical categories
        crit_count = sum(1 for c in category_counts if c in CRITICAL_DATA_CLASSES)
        if crit_count > 1:
            sens_score += min(10, (crit_count - 1) * 5)

    # Tier 3: High
    if any(c in HIGH_DATA_CLASSES for c in category_counts):
        sens_score += 10

    # Tier 2: Moderate
    if any(c in MODERATE_DATA_CLASSES for c in category_counts):
        sens_score += 5

    # Tier 1: Low (email itself)
    sens_score += 2
    sensitivity_score = min(45, sens_score)

    # 3. Recency Score (max 15)
    now = datetime.datetime.now(datetime.timezone.utc)
    most_recent_date_str = None
    most_recent_days = None

    for b in breaches:
        b_date_str = b.get("BreachDate") or b.get("breach_date")
        if b_date_str:
            try:
                # Typically YYYY-MM-DD
                parts = [int(p) for p in b_date_str.split("-")]
                if len(parts) == 3:
                    b_date = datetime.datetime(parts[0], parts[1], parts[2], tzinfo=datetime.timezone.utc)
                    days = (now - b_date).days
                    if most_recent_days is None or days < most_recent_days:
                        most_recent_days = days
                        most_recent_date_str = b_date_str
            except Exception:
                pass

    if most_recent_days is not None:
        if most_recent_days <= 365:
            recency_score = 15
        elif most_recent_days <= 365 * 3:
            recency_score = 10
        elif most_recent_days <= 365 * 5:
            recency_score = 5
        else:
            recency_score = 2
    else:
        recency_score = 5

    # 4. Multi-Exposure / Repetition Score (max 10)
    repetition_score = 0
    password_exposures = sum(category_counts.get(c, 0) for c in CRITICAL_DATA_CLASSES if c in category_counts)
    if password_exposures >= 2:
        repetition_score += 6
    phone_exposures = category_counts.get("phone numbers", 0)
    if phone_exposures >= 2:
        repetition_score += 4
    repetition_score = min(10, repetition_score)

    # Calculate Total Score
    raw_total = breach_count_score + sensitivity_score + recency_score + repetition_score
    total_score = min(100, max(0, raw_total))

    # Determine Risk Level
    if total_score >= 70:
        level = "critical"
    elif total_score >= 40:
        level = "high"
    elif total_score >= 20:
        level = "moderate"
    else:
        level = "low"

    breakdown = RiskScoreBreakdown(
        score=total_score,
        level=level,
        breach_count_score=breach_count_score,
        sensitivity_score=sensitivity_score,
        recency_score=recency_score,
        repetition_score=repetition_score,
        total_breaches=total_breaches,
        most_recent_date=most_recent_date_str,
        critical_categories_exposed=critical_categories_exposed,
        methodology="Score is computed from breach volume (max 30), exposed data sensitivity tiers (max 45), recency of latest breach (max 15), and repeated exposure of high-risk credentials across multiple breaches (max 10).",
        disclaimer="This risk score is an indicative exposure assessment based on publicly reported data breaches. It does not constitute a full penetration test or comprehensive vulnerability audit."
    )

    return total_score, level, breakdown

