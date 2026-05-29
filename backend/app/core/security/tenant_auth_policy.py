"""Tenant authentication policy helpers (SSO / MFA readiness — no TOTP flows yet)."""

from __future__ import annotations

from typing import Any, Literal, Optional, TypedDict

from app.core.config import get_settings
from app.models.domain import Company, User

AuthMode = Literal["password_allowed", "sso_preferred", "sso_required"]
MfaProvider = Literal["none", "entra", "totp"]


class TenantSecurityPolicy(TypedDict, total=False):
    auth_mode: AuthMode
    mfa_required: bool
    mfa_provider: MfaProvider
    password_login_allowed: bool
    microsoft_sso_allowed: bool


DEFAULT_TENANT_SECURITY_POLICY: TenantSecurityPolicy = {
    "auth_mode": "password_allowed",
    "mfa_required": False,
    "mfa_provider": "none",
    "password_login_allowed": True,
    "microsoft_sso_allowed": True,
}


def read_tenant_security_policy(company: Company | None) -> TenantSecurityPolicy:
    raw: Any = getattr(company, "security_policy", None) if company else None
    if not isinstance(raw, dict):
        return dict(DEFAULT_TENANT_SECURITY_POLICY)
    merged: TenantSecurityPolicy = dict(DEFAULT_TENANT_SECURITY_POLICY)
    for key in DEFAULT_TENANT_SECURITY_POLICY:
        if key in raw:
            merged[key] = raw[key]  # type: ignore[literal-required]
    return merged


def platform_password_login_enabled() -> bool:
    return get_settings().platform_allow_password_login


def platform_microsoft_sso_enabled() -> bool:
    return get_settings().platform_allow_microsoft_sso


def password_login_allowed_for_user(user: User, company: Company | None) -> bool:
    if not platform_password_login_enabled():
        return False
    policy = read_tenant_security_policy(company)
    if policy.get("auth_mode") == "sso_required":
        return False
    if policy.get("password_login_allowed") is False:
        return False
    return True


def microsoft_sso_allowed_for_company(company: Company | None) -> bool:
    if not platform_microsoft_sso_enabled():
        return False
    policy = read_tenant_security_policy(company)
    return policy.get("microsoft_sso_allowed", True) is not False


def mfa_required_for_user(user: User, company: Company | None) -> bool:
    policy = read_tenant_security_policy(company)
    if not policy.get("mfa_required"):
        return False
    provider = policy.get("mfa_provider", "none")
    if provider == "entra":
        return (user.auth_provider or "email") in ("microsoft", "azure", "entra")
    return provider == "totp" and bool(getattr(user, "mfa_enrolled_at", None))


def user_mfa_state(user: User) -> dict[str, Optional[str | bool]]:
    return {
        "mfa_enrolled": bool(getattr(user, "mfa_enrolled_at", None)),
        "mfa_method": getattr(user, "mfa_method", None),
        "auth_provider": user.auth_provider,
        "sso_subject": getattr(user, "sso_subject", None),
    }
