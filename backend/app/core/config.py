"""Application configuration (env-driven)."""

from functools import lru_cache
from typing import List, Set

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
    cors_origins: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("CORS_ORIGINS", "CORS_ORIGIN", "cors_origins"),
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
            if not o:
                continue
            if o not in seen:
                seen.add(o)
                out.append(o)
        return out

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def trusted_host_list(self) -> List[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
