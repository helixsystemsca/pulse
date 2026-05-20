"""
Authoritative per-user department + matrix role assignment (tenant_role_assignments).

Replaces inference/fallback for operational permissions. Unassigned users receive no matrix features.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.department_matrix_baselines import PERMISSION_MATRIX_DEPARTMENTS
from app.core.permission_feature_matrix import PERMISSION_MATRIX_SLOTS, normalize_matrix_slot
from app.core.workspace_departments import normalize_workspace_department_slug
from app.models.rbac_models import TenantRoleAssignment

AssignmentStatus = Literal["assigned", "unassigned"]

# Explicit business roles assignable in Team Management (includes team_member as intentional role).
ASSIGNABLE_ROLE_KEYS: frozenset[str] = frozenset(
    s
    for s in PERMISSION_MATRIX_SLOTS
    if s not in ("unresolved",)
)


@dataclass
class ActiveTenantAssignment:
    id: str
    company_id: str
    user_id: str
    department_slug: str
    role_key: str
    department_id: str | None
    assigned_by: str | None
    assigned_at: datetime
    active: bool = True


@dataclass
class TenantAssignmentResolution:
    status: AssignmentStatus
    assignment: ActiveTenantAssignment | None = None
    trace: list[str] = field(default_factory=list)


def normalize_department_slug(raw: str | None) -> str | None:
    if not raw:
        return None
    slug = normalize_workspace_department_slug(str(raw).strip())
    if slug and slug in PERMISSION_MATRIX_DEPARTMENTS:
        return slug
    return None


def normalize_role_key(raw: str | None) -> str | None:
    return normalize_matrix_slot(raw)


def _db_supports_queries(db: AsyncSession) -> bool:
    execute = getattr(db, "execute", None)
    return callable(execute)


async def get_active_assignment(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
) -> ActiveTenantAssignment | None:
    if not _db_supports_queries(db):
        return None
    q = await db.execute(
        select(TenantRoleAssignment).where(
            TenantRoleAssignment.company_id == company_id,
            TenantRoleAssignment.user_id == user_id,
            TenantRoleAssignment.active.is_(True),
        )
    )
    row = q.scalar_one_or_none()
    if not row:
        return None
    slug = normalize_department_slug(row.department_slug)
    role = normalize_role_key(row.role_key)
    if not slug or not role or role not in ASSIGNABLE_ROLE_KEYS:
        return None
    return ActiveTenantAssignment(
        id=str(row.id),
        company_id=str(row.company_id),
        user_id=str(row.user_id),
        department_slug=slug,
        role_key=role,
        department_id=str(row.department_id) if row.department_id else None,
        assigned_by=str(row.assigned_by) if row.assigned_by else None,
        assigned_at=row.assigned_at,
        active=True,
    )


async def resolve_tenant_assignment(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
) -> TenantAssignmentResolution:
    trace: list[str] = [f"tenant_role_assignments lookup company_id={company_id!r} user_id={user_id!r}"]
    assignment = await get_active_assignment(db, company_id=company_id, user_id=user_id)
    if assignment:
        trace.append(
            f"✓ Active assignment id={assignment.id!r} "
            f"department={assignment.department_slug!r} role_key={assignment.role_key!r}"
        )
        return TenantAssignmentResolution(status="assigned", assignment=assignment, trace=trace)
    trace.append("✗ No active tenant_role_assignment — status unassigned (no operational permissions).")
    return TenantAssignmentResolution(status="unassigned", trace=trace)


async def assign_user_department_role(
    db: AsyncSession,
    *,
    company_id: str,
    user_id: str,
    department_slug: str,
    role_key: str,
    assigned_by: str | None,
    department_id: str | None = None,
) -> ActiveTenantAssignment:
    slug = normalize_department_slug(department_slug)
    role = normalize_role_key(role_key)
    if not slug:
        raise ValueError("Invalid department")
    if not role or role not in ASSIGNABLE_ROLE_KEYS:
        raise ValueError("Invalid role_key")

    existing = await db.execute(
        select(TenantRoleAssignment).where(
            TenantRoleAssignment.company_id == company_id,
            TenantRoleAssignment.user_id == user_id,
            TenantRoleAssignment.active.is_(True),
        )
    )
    for row in existing.scalars().all():
        row.active = False

    now = datetime.now(timezone.utc)
    rec = TenantRoleAssignment(
        id=str(uuid4()),
        company_id=company_id,
        user_id=user_id,
        department_id=department_id,
        department_slug=slug,
        role_key=role,
        assigned_by=assigned_by,
        assigned_at=now,
        active=True,
    )
    db.add(rec)
    await db.flush()
    return ActiveTenantAssignment(
        id=rec.id,
        company_id=company_id,
        user_id=user_id,
        department_slug=slug,
        role_key=role,
        department_id=department_id,
        assigned_by=assigned_by,
        assigned_at=now,
        active=True,
    )
