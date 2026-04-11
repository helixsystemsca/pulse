"""Application configuration (env-driven)."""

import logging
from functools import lru_cache
from typing import List, Optional, Set
from urllib.parse import urlparse

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_log = logging.getLogger(__name__)


def _browser_origin_from_token(raw: str) -> Optional[str]:
    """Return scheme://host[:port] or None if ``raw`` is not a valid browser Origin (common typo: ``https:host``)."""
    o = raw.strip()
    if len(o) >= 2 and o[0] == o[-1] and o[0] in "\"'":
        o = o[1:-1].strip()
    o = o.rstrip("/")
    if not o:
        return None
    lower = o.lower()
    if "://" in o:
        to_parse = o
    elif lower.startswith("http:") or lower.startswith("https:"):
        # Typo ``https:host`` (missing ``//``) — never prepend another scheme.
        return None
    else:
        to_parse = f"https://{o}"
    parsed = urlparse(to_parse)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        return None
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ops_intel"
    secret_key: str = "dev-only-change-in-production"
    #: JWT access token lifetime. Default 12m is slightly above the Pulse UI idle timeout (10m) so active
    #: sessions keep working; raise for longer work blocks (or add refresh tokens). Env: ACCESS_TOKEN_EXPIRE_MINUTES.
    access_token_expire_minutes: int = 12
    algorithm: str = "HS256"
    # Comma-separated origins, no paths. Env: CORS_ORIGINS (preferred) or CORS_ORIGIN.
    # Production: include every site the browser uses (https://www.example.com and https://example.com
    # are different Origins). The origin of `pulse_app_public_url` is always merged in. See also cors_origin_regex.
    cors_origins: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("CORS_ORIGINS", "CORS_ORIGIN", "cors_origins"),
    )
    #: Optional regex (full match on Origin header), e.g. ^https://(www\\.)?helixsystems\\.ca$
    #: Use when you serve the same API to apex + www without duplicating both in CORS_ORIGINS.
    cors_origin_regex: str = Field(
        default="",
        validation_alias=AliasChoices("CORS_ORIGIN_REGEX", "cors_origin_regex"),
    )
    #: Extra comma-separated Origins merged into CORS (e.g. a staging frontend URL) in addition to
    #: `CORS_ORIGINS` and the origin derived from `PULSE_APP_PUBLIC_URL`.
    cors_extra_origins: str = Field(
        default="",
        validation_alias=AliasChoices("CORS_EXTRA_ORIGINS", "cors_extra_origins"),
    )
    inference_min_confidence: float = 0.45
    environment: str = "development"
    allow_public_registration: bool = False
    bootstrap_system_admin_email: str = ""
    bootstrap_system_admin_password: str = ""
    enable_hsts: bool = False
    #: When true, reject requests whose effective scheme is HTTP (checks X-Forwarded-Proto behind TLS terminators).
    #: Set REQUIRE_HTTPS=true in production behind HTTPS-only load balancers.
    require_https: bool = Field(
        default=False,
        validation_alias=AliasChoices("REQUIRE_HTTPS", "require_https"),
    )
    trusted_hosts: str = ""
    #: Directory for company logos, user avatars, equipment images, etc. In production this must be a
    #: persistent volume (or object storage); default `var/uploads` is wiped on many PaaS redeploys, which
    #: yields 404 on /company/logo and avatar routes while the DB still points at internal paths.
    pulse_uploads_dir: str = "var/uploads"
    #: ``local`` uses ``pulse_uploads_dir``; ``s3`` / ``object`` = S3-compatible storage (see ``pulse_s3_*``).
    pulse_storage_backend: str = Field(
        default="local",
        validation_alias=AliasChoices("PULSE_STORAGE_BACKEND", "pulse_storage_backend"),
    )
    #: R2 / MinIO custom endpoint. Omit for AWS S3.
    pulse_s3_endpoint_url: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "PULSE_S3_ENDPOINT_URL",
            "AWS_ENDPOINT_URL",
            "S3_ENDPOINT_URL",
            "pulse_s3_endpoint_url",
        ),
    )
    pulse_s3_bucket: str = Field(
        default="",
        validation_alias=AliasChoices("PULSE_S3_BUCKET", "AWS_S3_BUCKET", "S3_BUCKET", "pulse_s3_bucket"),
    )
    pulse_s3_access_key_id: str = Field(
        default="",
        validation_alias=AliasChoices(
            "PULSE_S3_ACCESS_KEY_ID",
            "AWS_ACCESS_KEY_ID",
            "pulse_s3_access_key_id",
        ),
    )
    pulse_s3_secret_access_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "PULSE_S3_SECRET_ACCESS_KEY",
            "AWS_SECRET_ACCESS_KEY",
            "pulse_s3_secret_access_key",
        ),
    )
    pulse_s3_region: str = Field(
        default="us-east-1",
        validation_alias=AliasChoices(
            "PULSE_S3_REGION",
            "AWS_REGION",
            "AWS_DEFAULT_REGION",
            "pulse_s3_region",
        ),
    )
    #: Logical prefix inside the bucket (no leading/trailing slashes).
    pulse_s3_key_prefix: str = Field(
        default="pulse",
        validation_alias=AliasChoices("PULSE_S3_KEY_PREFIX", "pulse_s3_key_prefix"),
    )
    system_invite_expire_hours: int = 48
    system_password_reset_expire_hours: int = 24
    #: Lets system_admin call POST /api/system/companies/bootstrap-legacy (company + admin with password, no email).
    #: Keep false in production unless you intentionally accept that trade-off.
    allow_password_company_bootstrap: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "ALLOW_PASSWORD_COMPANY_BOOTSTRAP",
            "allow_password_company_bootstrap",
        ),
    )
    # --- Outbound email (SMTP). Leave host empty to skip sending (invites = link-only in UI).
    smtp_host: str = Field(default="", validation_alias=AliasChoices("SMTP_HOST", "smtp_host"))
    smtp_port: int = Field(default=587, validation_alias=AliasChoices("SMTP_PORT", "smtp_port"))
    smtp_username: str = Field(default="", validation_alias=AliasChoices("SMTP_USERNAME", "SMTP_USER", "smtp_username"))
    smtp_password: str = Field(default="", validation_alias=AliasChoices("SMTP_PASSWORD", "smtp_password"))
    smtp_use_tls: bool = Field(default=True, validation_alias=AliasChoices("SMTP_USE_TLS", "smtp_use_tls"))
    #: Use SMTP_SSL on port 465 instead of STARTTLS (e.g. some legacy hosts).
    smtp_use_ssl: bool = Field(default=False, validation_alias=AliasChoices("SMTP_USE_SSL", "smtp_use_ssl"))
    #: Envelope + From for transactional mail (invites, password reset). Use your DNS alias.
    email_from_noreply: str = Field(
        default="noreply@helixsystems.ca",
        validation_alias=AliasChoices("EMAIL_FROM_NOREPLY", "email_from_noreply"),
    )
    email_from_display: str = Field(
        default="Helix Systems",
        validation_alias=AliasChoices("EMAIL_FROM_DISPLAY", "email_from_display"),
    )
    #: Inbound mailbox for marketing contact form submissions.
    email_to_info: str = Field(
        default="info@helixsystems.ca",
        validation_alias=AliasChoices("EMAIL_TO_INFO", "email_to_info"),
    )
    #: Base URL for links in emails (invite/reset). Must be the **Pulse web app** (browser Origin), not the API host.
    #: Paths are ignored when merging into CORS; only scheme + host are used.
    pulse_app_public_url: str = Field(
        default="https://pulse.helixsystems.ca",
        validation_alias=AliasChoices("PULSE_APP_PUBLIC_URL", "pulse_app_public_url"),
    )
    #: When set, unknown `gateway_id` on POST /api/gateway/register creates a row under this company.
    gateway_auto_register_company_id: str = Field(
        default="",
        validation_alias=AliasChoices("GATEWAY_AUTO_REGISTER_COMPANY_ID", "gateway_auto_register_company_id"),
    )
    #: If non-empty, devices may send `company_id` + `register_token` in the register body to pick a tenant.
    gateway_register_token: str = Field(
        default="",
        validation_alias=AliasChoices("GATEWAY_REGISTER_TOKEN", "gateway_register_token"),
    )

    @property
    def cors_origin_list(self) -> List[str]:
        """Browser Origin values: comma- or semicolon-separated, no paths or trailing slashes."""
        text = self.cors_origins.replace(";", ",")
        out: List[str] = []
        seen: Set[str] = set()
        for part in text.split(","):
            raw = part.strip()
            if not raw:
                continue
            o = _browser_origin_from_token(raw)
            if not o:
                _log.warning(
                    "CORS_ORIGINS skipped invalid origin token %r (use https://host, e.g. https://pulse.example.com)",
                    raw[:120],
                )
                continue
            if o not in seen:
                seen.add(o)
                out.append(o)
        extra = self.cors_extra_origins.replace(";", ",")
        for part in extra.split(","):
            raw = part.strip()
            if not raw:
                continue
            o = _browser_origin_from_token(raw)
            if not o:
                _log.warning(
                    "CORS_EXTRA_ORIGINS skipped invalid origin token %r",
                    raw[:120],
                )
                continue
            if o not in seen:
                seen.add(o)
                out.append(o)
        # Pulse app origin: same host as email deep-links (`PULSE_APP_PUBLIC_URL`). Keeps CORS aligned when
        # production only listed marketing apex/www origins.
        pulse_o = self.pulse_app_public_origin
        if pulse_o and pulse_o not in seen:
            seen.add(pulse_o)
            out.append(pulse_o)
        return out

    @property
    def cors_origin_regex_pattern(self) -> Optional[str]:
        r = self.cors_origin_regex.strip()
        return r if r else None

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def trusted_host_list(self) -> List[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]

    @property
    def smtp_configured(self) -> bool:
        """Host + From required. Username/password optional (some relays authenticate by IP; login is skipped when username is empty)."""
        return bool(self.smtp_host.strip() and self.email_from_noreply.strip())

    @property
    def pulse_app_public_origin(self) -> str:
        """Scheme + host only, matching the browser `Origin` header (no path, no trailing slash)."""
        raw = self.pulse_app_public_url.strip()
        if not raw:
            return ""
        to_parse = raw if "://" in raw else f"https://{raw}"
        o = _browser_origin_from_token(to_parse)
        if o:
            return o
        _log.warning(
            "PULSE_APP_PUBLIC_URL is not a valid browser origin %r — fix (e.g. https://pulse.example.com); "
            "it will not be merged into CORS until corrected.",
            raw[:120],
        )
        return ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
