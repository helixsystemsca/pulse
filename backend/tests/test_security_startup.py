"""Security startup validation."""

from app.core.config import Settings
from app.core.security.startup_validation import validate_security_configuration


def test_startup_validation_flags_short_secret():
    s = Settings(environment="development", secret_key="short")
    issues = validate_security_configuration(s)
    assert any("32 characters" in i for i in issues)


def test_production_settings_rejects_placeholder_secret():
    import pytest

    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(environment="production", secret_key="dev-only-change-in-production")
