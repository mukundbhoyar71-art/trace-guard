import pytest
from app.core.config import Settings, DEV_SECRET_FALLBACK

def test_environment_defaults_to_development():
    """Verify that ENVIRONMENT defaults to 'development' when unspecified."""
    settings = Settings(
        SECRET_KEY=DEV_SECRET_FALLBACK,
        _env_file=None,
    )
    assert settings.ENVIRONMENT == "development"

def test_development_settings_uses_fallback_safely():
    """Verify that development mode permits the dev fallback key and leaves COOKIE_SECURE as configured."""
    settings = Settings(
        ENVIRONMENT="development",
        SECRET_KEY=DEV_SECRET_FALLBACK,
        COOKIE_SECURE=False,
        _env_file=None,
    )
    assert settings.ENVIRONMENT == "development"
    assert settings.SECRET_KEY == DEV_SECRET_FALLBACK
    assert settings.COOKIE_SECURE is False

def test_production_rejects_dev_fallback_secret():
    """Verify that production fails when SECRET_KEY equals the development fallback."""
    with pytest.raises(ValueError, match="Running in production requires a dedicated, strong SECRET_KEY"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY=DEV_SECRET_FALLBACK,
            _env_file=None,
        )

def test_production_rejects_empty_secret():
    """Verify that production fails when SECRET_KEY is empty."""
    with pytest.raises(ValueError, match="Running in production requires a dedicated, strong SECRET_KEY"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="",
            _env_file=None,
        )

def test_production_rejects_short_secret():
    """Verify that production fails when SECRET_KEY is shorter than 32 characters."""
    with pytest.raises(ValueError, match="Production SECRET_KEY must be at least 32 characters long"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="short_weak_key_12345",
            _env_file=None,
        )

def test_production_accepts_valid_strong_secret_and_enforces_secure_cookie():
    """Verify that production succeeds with a strong 32+ char key and automatically enforces COOKIE_SECURE."""
    valid_key = "a_super_strong_production_secret_key_with_sufficient_entropy_64_bits"
    settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY=valid_key,
        COOKIE_SECURE=False,  # Should be overridden to True in production
        _env_file=None,
    )
    assert settings.ENVIRONMENT == "production"
    assert settings.SECRET_KEY == valid_key
    assert settings.COOKIE_SECURE is True

