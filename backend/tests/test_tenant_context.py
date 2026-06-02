"""Tenant company resolution."""

from app.core.tenant_context import resolve_tenant_company_id
from app.models.domain import User, UserRole


def test_resolve_tenant_company_id_tenant_user() -> None:
    user = User(
        id="u1",
        email="a@b.com",
        company_id="company-1",
        roles=[UserRole.manager.value],
        is_active=True,
    )
    assert resolve_tenant_company_id(user, None, path="/test") == "company-1"
