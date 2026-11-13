import logging
import urllib.parse
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("traceguard.hibp")


class HIBPError(Exception):
    """Base exception for HIBP integration errors."""
    pass


class HIBPConfigurationError(HIBPError):
    """Raised when HIBP_API_KEY is not configured."""
    pass


class HIBPRateLimitError(HIBPError):
    """Raised when HIBP returns 429 Too Many Requests."""
    def __init__(self, message: str, retry_after: int = 5):
        super().__init__(message)
        self.retry_after = retry_after


class HIBPServiceUnavailableError(HIBPError):
    """Raised when HIBP is experiencing downtime or Cloudflare errors."""
    pass


class HIBPTimeoutError(HIBPError):
    """Raised when HIBP API request times out."""
    pass


def is_hibp_configured() -> bool:
    """
    Checks if a non-empty HIBP API key is configured.
    """
    key = str(settings.HIBP_API_KEY or "").strip()
    return len(key) > 0 and not key.startswith("<")


async def query_hibp_breaches(email: str) -> List[Dict[str, Any]]:
    """
    Queries Have I Been Pwned API v3 for confirmed breaches associated with an email.
    Returns:
      - List of breach dictionaries if found (HTTP 200).
      - Empty list if no breaches found (HTTP 404).
    Raises:
      - HIBPConfigurationError if HIBP_API_KEY is not set.
      - HIBPRateLimitError if rate limit is exceeded.
      - HIBPServiceUnavailableError or HIBPTimeoutError on network/server errors.
    """
    if not is_hibp_configured():
        raise HIBPConfigurationError(
            "Have I Been Pwned (HIBP) API key is not configured. "
            "Please configure HIBP_API_KEY in backend/.env to query live breach telemetry."
        )

    clean_email = email.strip().lower()
    encoded_email = urllib.parse.quote(clean_email)
    base_url = settings.HIBP_BASE_URL.rstrip("/")
    url = f"{base_url}/breachedaccount/{encoded_email}?truncateResponse=false"

    headers = {
        "hibp-api-key": settings.HIBP_API_KEY.strip(),
        "user-agent": settings.HIBP_USER_AGENT.strip(),
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=headers)

            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    return data
                return []

            if response.status_code == 404:
                # 404 is the official HIBP indicator that no breaches were found
                return []

            if response.status_code == 401:
                logger.error("HIBP API authentication failed. Verify HIBP_API_KEY in backend/.env.")
                raise HIBPConfigurationError("HIBP API authentication failed: Invalid or expired API key.")

            if response.status_code == 403:
                logger.error("HIBP API access forbidden. Verify User-Agent header.")
                raise HIBPError("HIBP API access forbidden: User-Agent header blocked or missing.")

            if response.status_code == 429:
                retry_after_header = response.headers.get("retry-after", "5")
                try:
                    retry_seconds = int(retry_after_header)
                except ValueError:
                    retry_seconds = 5
                logger.warning(f"HIBP rate limit encountered. Retry-After: {retry_seconds}s")
                raise HIBPRateLimitError(
                    f"Breach intelligence provider rate limit reached. Please wait {retry_seconds} seconds before retrying.",
                    retry_after=retry_seconds
                )

            if response.status_code >= 500:
                logger.error(f"HIBP service error (HTTP {response.status_code})")
                raise HIBPServiceUnavailableError("Have I Been Pwned service is temporarily unavailable. Please try again shortly.")

            raise HIBPError(f"Unexpected response from breach intelligence provider (HTTP {response.status_code}).")

    except httpx.TimeoutException as exc:
        logger.error(f"HIBP request timeout for target email: {exc}")
        raise HIBPTimeoutError("Breach intelligence query timed out after 15 seconds. Provider may be experiencing latency.")
    except (httpx.ConnectError, httpx.NetworkError) as exc:
        logger.error(f"HIBP network connection error: {exc}")
        raise HIBPServiceUnavailableError("Unable to establish secure connection to breach intelligence provider.")


def get_demo_breaches(email: str) -> List[Dict[str, Any]]:
    """
    Returns high-fidelity fictional breach incident records specifically for demonstration and offline auditing.
    Clearly flagged with IsFabricated=True and explicit demo identifiers.
    """
    return [
        {
            "Name": "AeroCloud-Demo",
            "Title": "AeroCloud Global Storage (DEMO)",
            "Domain": "aerocloud-storage.demo.local",
            "BreachDate": "2024-03-12",
            "AddedDate": "2024-03-15T00:00:00Z",
            "ModifiedDate": "2024-03-15T00:00:00Z",
            "PwnCount": 3840000,
            "Description": "In March 2024, a demonstration security incident simulated the leakage of user account profiles, hashed credentials, and system usernames. <em>(SIMULATED DEMO RECORD FOR TRACE GUARD)</em>",
            "LogoPath": None,
            "DataClasses": ["Email addresses", "Passwords", "Usernames", "IP addresses"],
            "IsVerified": True,
            "IsFabricated": True,
            "IsSensitive": False,
            "IsRetired": False,
            "IsSpamList": False,
            "IsMalware": False,
        },
        {
            "Name": "NovaPay-Demo",
            "Title": "NovaPay Gateway Services (DEMO)",
            "Domain": "novapay-gateway.demo.local",
            "BreachDate": "2023-09-28",
            "AddedDate": "2023-10-02T00:00:00Z",
            "ModifiedDate": "2023-10-02T00:00:00Z",
            "PwnCount": 1620000,
            "Description": "In September 2023, a simulated telemetry leak exposed customer contact details including telephone numbers and geographic location metadata. <em>(SIMULATED DEMO RECORD FOR TRACE GUARD)</em>",
            "LogoPath": None,
            "DataClasses": ["Email addresses", "Phone numbers", "Geographic locations"],
            "IsVerified": True,
            "IsFabricated": True,
            "IsSensitive": False,
            "IsRetired": False,
            "IsSpamList": False,
            "IsMalware": False,
        },
        {
            "Name": "StarlightGaming-Demo",
            "Title": "Starlight Gaming Platform (DEMO)",
            "Domain": "starlight-gaming.demo.local",
            "BreachDate": "2022-11-19",
            "AddedDate": "2022-11-25T00:00:00Z",
            "ModifiedDate": "2022-11-25T00:00:00Z",
            "PwnCount": 940000,
            "Description": "In November 2022, an unsecured demonstration archive compromised legacy gamer profile tags, avatars, and dates of birth. <em>(SIMULATED DEMO RECORD FOR TRACE GUARD)</em>",
            "LogoPath": None,
            "DataClasses": ["Email addresses", "Usernames", "Dates of birth"],
            "IsVerified": True,
            "IsFabricated": True,
            "IsSensitive": False,
            "IsRetired": False,
            "IsSpamList": False,
            "IsMalware": False,
        },
    ]

