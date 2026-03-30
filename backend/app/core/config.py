"""Application configuration (env-driven)."""

from functools import lru_cache
from typing import List

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
    cors_origins: str = "http://localhost:3000"
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
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def trusted_host_list(self) -> List[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
