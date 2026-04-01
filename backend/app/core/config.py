"""Application configuration (env-driven)."""

from functools import lru_cache
from typing import List, Optional, Set

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ops_intel"
    secret_key: str = "dev-only-change-in-production"
    access_token_expire_minutes: int = 60
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
    inference_min_confidence: float = 0.45
    environment: str = "development"
    allow_public_registration: bool = False
    bootstrap_system_admin_email: str = ""
    bootstrap_system_admin_password: str = ""
    enable_hsts: bool = False
    trusted_hosts: str = ""
    # Local folder for Pulse beacon photos (MVP); swap for S3/R2 keys later.
    pulse_uploads_dir: str = "var/uploads"
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
    #: Base URL for links in emails (invite/reset). Must match the Pulse web app; no trailing slash.
    pulse_app_public_url: str = Field(
        default="https://pulse.helixsystems.ca",
        validation_alias=AliasChoices("PULSE_APP_PUBLIC_URL", "pulse_app_public_url"),
    )

    @property
    def cors_origin_list(self) -> List[str]:
        """Browser Origin values: comma- or semicolon-separated, no paths or trailing slashes."""
        text = self.cors_origins.replace(";", ",")
        out: List[str] = []
        seen: Set[str] = set()
        for part in text.split(","):
            o = part.strip()
            if len(o) >= 2 and o[0] == o[-1] and o[0] in "\"'":
                o = o[1:-1].strip()
            # Origins must match the browser's Origin header (no path, no trailing slash).
            o = o.rstrip("/")
            if not o:
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
        """Host + From address required; username required for most providers (password may be empty for some relays)."""
        return bool(self.smtp_host.strip() and self.smtp_username.strip() and self.email_from_noreply.strip())

    @property
    def pulse_app_public_origin(self) -> str:
        return self.pulse_app_public_url.rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
