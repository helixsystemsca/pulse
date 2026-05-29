"""Production startup checks — logs issues without printing secret values."""

from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

from app.core.config import Settings

_log = logging.getLogger("pulse.startup.security")

_WEAK_SECRET_MARKERS = frozenset(
    {
        "dev-only-change-in-production",
        "change-me-to-a-long-random-string-in-production",
        "changeme",
        "password",
        "secret",
    }
)


def validate_security_configuration(settings: Settings) -> list[str]:
    """Return human-readable warnings/errors (empty list = OK for non-fatal checks)."""
    issues: list[str] = []

    sk = (settings.secret_key or "").strip()
    if len(sk) < 32:
        issues.append("SECRET_KEY is shorter than 32 characters")
    if sk.lower() in _WEAK_SECRET_MARKERS:
        issues.append("SECRET_KEY matches a known placeholder")

    if settings.is_production:
        if not settings.require_https:
            issues.append("REQUIRE_HTTPS should be true in production")
        if not (settings.trusted_hosts or "").strip():
            issues.append("TRUSTED_HOSTS should be set in production")
        if not settings.cors_origin_list and not settings.cors_origin_regex_pattern:
            issues.append("CORS_ORIGINS or CORS_ORIGIN_REGEX should be set in production")
        if (settings.supabase_service_role_key or "").strip():
            issues.append(
                "SUPABASE_SERVICE_ROLE_KEY is set on API — prefer anon key for OAuth verify; "
                "never expose service role to clients"
            )
        if not (settings.pm_cron_secret or "").strip():
            issues.append("PM_CRON_SECRET is unset — internal PM/schedule cron disabled")
        if not (settings.notification_cron_secret or "").strip():
            issues.append("NOTIFICATION_CRON_SECRET is unset — notification cron disabled")

    db_url = (settings.database_url or "").lower()
    if settings.is_production and "sslmode=disable" in db_url:
        issues.append("DATABASE_URL disables TLS (sslmode=disable)")

    if settings.is_production and settings.database_rls_enforced:
        parsed = urlparse(settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1))
        role = (parsed.username or "").lower()
        if role in ("postgres", "supabase_admin"):
            issues.append(
                "DATABASE_RLS_ENFORCED=true but DATABASE_URL uses a superuser role; "
                "create a pulse_app role without BYPASSRLS for defense-in-depth"
            )

    return issues


def log_security_startup_summary(settings: Settings) -> None:
    issues = validate_security_configuration(settings)
    _log.info(
        "security_config environment=%s require_https=%s rls_context=%s rls_enforced=%s "
        "password_login=%s microsoft_sso=%s cors_origins=%d trusted_hosts_set=%s",
        settings.environment,
        settings.require_https,
        settings.database_rls_context_enabled,
        settings.database_rls_enforced,
        settings.platform_allow_password_login,
        settings.platform_allow_microsoft_sso,
        len(settings.cors_origin_list),
        bool((settings.trusted_hosts or "").strip()),
    )
    for msg in issues:
        if settings.is_production:
            _log.warning("security_startup_issue %s", msg)
        else:
            _log.info("security_startup_note %s", msg)
