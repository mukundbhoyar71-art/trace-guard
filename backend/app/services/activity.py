import datetime
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.security import SecurityActivity

logger = logging.getLogger("traceguard.activity")

SENSITIVE_KEYS = {
    "password", "hashed_password", "token", "raw_token", "token_hash", 
    "api_key", "secret", "cookie", "session_id", "authorization"
}

def sanitize_metadata(metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Sanitizes activity metadata ensuring passwords, hashes, tokens, and API keys
    are never stored in the database.
    """
    if not metadata or not isinstance(metadata, dict):
        return {}
    
    clean = {}
    for key, value in metadata.items():
        if any(sens in key.lower() for sens in SENSITIVE_KEYS):
            continue
        if isinstance(value, dict):
            clean[key] = sanitize_metadata(value)
        elif isinstance(value, (str, int, float, bool, list)):
            clean[key] = value
        else:
            clean[key] = str(value)
    return clean

def log_activity(
    db: Session,
    user_id: int,
    activity_type: str,
    title: str,
    description: str = "",
    status: str = "info",
    metadata: Optional[Dict[str, Any]] = None,
) -> SecurityActivity:
    """
    Records an authenticated cybersecurity activity event with strict zero-password privacy.
    """
    clean_meta = sanitize_metadata(metadata)
    desc = description or title
    activity = SecurityActivity(
        user_id=user_id,
        activity_type=activity_type,
        title=title,
        description=desc,
        status=status,
        metadata_json=clean_meta,
        created_at=datetime.datetime.now(datetime.timezone.utc),
    )
    try:
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return activity
    except Exception as err:
        db.rollback()
        logger.error("Failed to log activity for user %s: %s", user_id, err)
        raise
