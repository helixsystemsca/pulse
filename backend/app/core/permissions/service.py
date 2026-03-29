"""Resolve effective permissions from role templates + per-user deny overlay."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import keys
from app.models.domain import RolePermission, RolePermissionTarget, User, UserRole


class PermissionService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def effective_allow_set(self, user: User) -> set[str]:
        if user.role in (UserRole.system_admin, UserRole.company_admin):
            return {"*"}
        if user.company_id is None:
            return set()
        target = (
            RolePermissionTarget.manager
            if user.role == UserRole.manager
            else RolePermissionTarget.worker
        )
        q = await self._db.execute(
            select(RolePermission).where(
                RolePermission.company_id == user.company_id,
                RolePermission.role == target,
            )
        )
        row = q.scalar_one_or_none()
        raw = (row.permissions or {}) if row else {}
        allow = set(raw.get("allow", []) if isinstance(raw.get("allow"), list) else [])
        if not allow:
            allow = set(
                keys.DEFAULT_MANAGER_ALLOWS if user.role == UserRole.manager else keys.DEFAULT_WORKER_ALLOWS
            )
        deny = set(user.permission_deny or [])
        return allow - deny

    async def user_has(self, user: User, permission: str) -> bool:
        eff = await self.effective_allow_set(user)
        if "*" in eff:
            return True
        return permission in eff

    async def upsert_role_template(
        self,
        company_id: str,
        target: RolePermissionTarget,
        allow: list[str],
    ) -> RolePermission:
        q = await self._db.execute(
            select(RolePermission).where(
                RolePermission.company_id == company_id,
                RolePermission.role == target,
            )
        )
        row = q.scalar_one_or_none()
        if row is None:
            row = RolePermission(company_id=company_id, role=target, permissions={"allow": allow})
            self._db.add(row)
        else:
            row.permissions = {"allow": allow}
        await self._db.flush()
        return row
