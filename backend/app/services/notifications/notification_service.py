"""Project notification engine: rule evaluation, feature-aware conditions, audit logging."""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_features import tenant_enabled_feature_names_with_legacy
from app.models.domain import User
from app.models.pulse_models import (
    NotificationLog,
    NotificationRule,
    PulseProject,
    PulseProjectTaskMaterial,
)

_log = logging.getLogger(__name__)

VALID_MATERIAL_STATUSES = frozenset({"in_stock", "needs_order", "ordered", "received"})
DATE_MATCH_TOLERANCE_DAYS = 1


async def check_feature(db: AsyncSession, company_id: str, feature_name: str) -> bool:
    """Return True if tenant has the catalog feature enabled (legacy defaults apply when no rows)."""
    names = set(await tenant_enabled_feature_names_with_legacy(db, company_id))
    return feature_name in names


def build_reason_string(material_count: int, statuses: list[str] | None) -> str:
    """Human-readable reason for material-triggered notifications."""
    if not statuses:
        return f"{material_count} material(s) require attention"
    st = ", ".join(statuses)
    return f"{material_count} material(s) in {st} state"


def _status_list(v: Any) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip().lower() for x in v if str(x).strip()]
    return []


def _normalize_recipients(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for x in raw:
        s = str(x).strip().lower()
        if s == "supervision":
            s = "supervisor"
        if s in ("supervisor", "lead", "owner") and s not in out:
            out.append(s)
    return out


async def _count_project_materials(db: AsyncSession, project_id: str) -> int:
    q = await db.scalar(
        select(func.count())
        .select_from(PulseProjectTaskMaterial)
        .where(PulseProjectTaskMaterial.project_id == project_id)
    )
    return int(q or 0)


async def _count_materials_status_in(db: AsyncSession, project_id: str, statuses: list[str]) -> int:
    if not statuses:
        return 0
    valid = [s for s in statuses if s in VALID_MATERIAL_STATUSES]
    if not valid:
        return 0
    q = await db.scalar(
        select(func.count())
        .select_from(PulseProjectTaskMaterial)
        .where(PulseProjectTaskMaterial.project_id == project_id, PulseProjectTaskMaterial.status.in_(valid))
    )
    return int(q or 0)


async def _evaluate_material_conditions(
    db: AsyncSession,
    company_id: str,
    project_id: str,
    conditions: dict[str, Any],
    inventory_enabled: bool,
) -> tuple[bool, str]:
    has_flag = conditions.get("has_materials")
    status_in = [s for s in _status_list(conditions.get("material_status_in")) if s in VALID_MATERIAL_STATUSES]
    fallback = bool(conditions.get("fallback_to_existence_if_no_inventory"))

    total = await _count_project_materials(db, project_id)

    if has_flag is True and total == 0:
        return False, "has_materials is true but no materials are linked to this project"

    if not status_in:
        if has_flag is True:
            return True, f"{total} material(s) on project"
        return True, "No material status filters configured"

    if inventory_enabled:
        matching = await _count_materials_status_in(db, project_id, status_in)
        if matching == 0:
            return False, f"No materials in required statuses ({', '.join(status_in)})"
        return True, build_reason_string(matching, status_in)

    if fallback:
        if total == 0:
            return False, "fallback_to_existence_if_no_inventory is true but no materials exist on project"
        return True, f"{total} materials exist (inventory disabled fallback)"

    return False, "Inventory module disabled and rule does not set fallback_to_existence_if_no_inventory"


async def resolve_recipients(
    db: AsyncSession,
    company_id: str,
    project: PulseProject,
    role_keys: list[str],
) -> list[dict[str, Any]]:
    resolved: dict[str, dict[str, Any]] = {}
    cid = str(company_id)

    def add_user(u: User | None) -> None:
        if not u or not u.email:
            return
        uid = str(u.id)
        if str(u.company_id) != cid:
            return
        if uid not in resolved:
            resolved[uid] = {"user_id": uid, "email": u.email, "full_name": u.full_name}

    for role in role_keys:
        if role == "owner" and getattr(project, "owner_user_id", None):
            add_user(await db.get(User, str(project.owner_user_id)))
        elif role == "lead" and getattr(project, "created_by_user_id", None):
            add_user(await db.get(User, str(project.created_by_user_id)))
        elif role == "supervisor":
            uq = await db.execute(
                select(User).where(
                    User.company_id == cid,
                    User.is_active.is_(True),
                )
            )
            users = list(uq.scalars().all())
            found_sup = False
            for u in users:
                roles = list(u.roles or [])
                if "supervisor" in roles or (u.operational_role or "").lower() == "supervisor":
                    add_user(u)
                    found_sup = True
            if not found_sup:
                for u in users:
                    if "company_admin" in (u.roles or []) or bool(getattr(u, "facility_tenant_admin", False)):
                        add_user(u)

    return list(resolved.values())


async def _already_sent_for_scheduled(db: AsyncSession, rule_id: str, scheduled_for: datetime) -> bool:
    q = await db.scalar(
        select(func.count())
        .select_from(NotificationLog)
        .where(
            NotificationLog.rule_id == rule_id,
            NotificationLog.scheduled_for == scheduled_for,
            NotificationLog.triggered.is_(True),
        )
    )
    return int(q or 0) > 0


async def send_notification(
    project: PulseProject,
    rule: NotificationRule,
    recipients: list[dict[str, Any]],
    reason: str,
) -> None:
    """Stub channel — replace with email/push."""
    payload = {
        "project_id": str(project.id),
        "project_name": project.name,
        "rule_id": str(rule.id),
        "rule_type": rule.type,
        "offset_days": rule.offset_days,
        "reason": reason,
        "recipients": recipients,
    }
    _log.info("NOTIFICATION_STUB %s", payload)


async def evaluate_rule(
    db: AsyncSession,
    rule: NotificationRule,
    project: PulseProject,
    *,
    evaluation_date: date | None = None,
) -> NotificationLog:
    eval_date = evaluation_date or datetime.now(timezone.utc).date()
    company_id = str(rule.company_id)
    project_id = str(project.id)

    trigger_date = project.start_date + timedelta(days=int(rule.offset_days))
    scheduled_for = datetime.combine(trigger_date, time.min, tzinfo=timezone.utc)

    delta_days = (eval_date - trigger_date).days
    if delta_days < 0 or delta_days > DATE_MATCH_TOLERANCE_DAYS:
        log = NotificationLog(
            company_id=company_id,
            project_id=project_id,
            rule_id=str(rule.id),
            triggered=False,
            reason=(
                f"Skipped: evaluation date {eval_date} outside trigger window "
                f"(trigger_date={trigger_date}, tolerance_days={DATE_MATCH_TOLERANCE_DAYS})"
            ),
            evaluated_at=datetime.now(timezone.utc),
            scheduled_for=scheduled_for,
            sent_at=None,
            recipients_resolved=[],
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    conditions = rule.conditions if isinstance(rule.conditions, dict) else {}
    inventory_on = await check_feature(db, company_id, "inventory")

    reason = "All configured conditions passed"
    if conditions.get("has_materials") is not None or conditions.get("material_status_in"):
        ok, why = await _evaluate_material_conditions(db, company_id, project_id, conditions, inventory_on)
        if not ok:
            log = NotificationLog(
                company_id=company_id,
                project_id=project_id,
                rule_id=str(rule.id),
                triggered=False,
                reason=why,
                evaluated_at=datetime.now(timezone.utc),
                scheduled_for=scheduled_for,
                sent_at=None,
                recipients_resolved=[],
            )
            db.add(log)
            await db.commit()
            await db.refresh(log)
            return log
        reason = why

    role_keys = _normalize_recipients(rule.recipients)
    resolved = await resolve_recipients(db, company_id, project, role_keys)

    if await _already_sent_for_scheduled(db, str(rule.id), scheduled_for):
        log = NotificationLog(
            company_id=company_id,
            project_id=project_id,
            rule_id=str(rule.id),
            triggered=False,
            reason="Duplicate prevention: notification already sent for this scheduled_for",
            evaluated_at=datetime.now(timezone.utc),
            scheduled_for=scheduled_for,
            sent_at=None,
            recipients_resolved=resolved,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    await send_notification(project, rule, resolved, reason)
    sent_at = datetime.now(timezone.utc)

    log = NotificationLog(
        company_id=company_id,
        project_id=project_id,
        rule_id=str(rule.id),
        triggered=True,
        reason=reason,
        evaluated_at=datetime.now(timezone.utc),
        scheduled_for=scheduled_for,
        sent_at=sent_at,
        recipients_resolved=resolved,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def run_all_rule_evaluations(
    db: AsyncSession, evaluation_date: date | None = None
) -> dict[str, int | str]:
    d = evaluation_date or datetime.now(timezone.utc).date()
    rq = await db.execute(select(NotificationRule).where(NotificationRule.enabled.is_(True)))
    rules = list(rq.scalars().all())
    evaluated = 0
    for rule in rules:
        p = await db.get(PulseProject, str(rule.project_id))
        if not p or str(p.company_id) != str(rule.company_id):
            continue
        await evaluate_rule(db, rule, p, evaluation_date=d)
        evaluated += 1
    return {"rules_evaluated": evaluated, "evaluation_date": str(d)}


DEFAULT_RULE_SEEDS: list[dict[str, Any]] = [
    {
        "type": "material_order_reminder",
        "offset_days": -30,
        "enabled": True,
        "conditions": {
            "has_materials": True,
            "material_status_in": ["needs_order"],
            "fallback_to_existence_if_no_inventory": True,
        },
        "recipients": ["supervisor", "lead", "owner"],
    },
    {
        "type": "equipment_inspection_reminder",
        "offset_days": -7,
        "enabled": True,
        "conditions": {},
        "recipients": ["supervisor", "lead", "owner"],
    },
]


async def seed_default_notification_rules(
    db: AsyncSession, *, project_id: str, company_id: str
) -> None:
    for seed in DEFAULT_RULE_SEEDS:
        typ = str(seed["type"])
        exists = await db.scalar(
            select(func.count())
            .select_from(NotificationRule)
            .where(NotificationRule.project_id == project_id, NotificationRule.type == typ)
        )
        if int(exists or 0) > 0:
            continue
        row = NotificationRule(
            project_id=project_id,
            company_id=company_id,
            type=typ,
            enabled=bool(seed.get("enabled", True)),
            offset_days=int(seed["offset_days"]),
            conditions=dict(seed.get("conditions") or {}),
            recipients=list(seed.get("recipients") or []),
        )
        db.add(row)
    await db.flush()
