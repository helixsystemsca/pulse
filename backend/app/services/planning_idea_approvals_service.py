"""Planning idea approval requests — email tokens, manager review, audit."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit.service import record_audit
from app.core.config import Settings, get_settings
from app.core.email_smtp import send_planning_idea_approval_request
from app.core.system_tokens import generate_raw_token, hash_system_token
from app.models.domain import Company, User, UserRole
from app.models.pulse_models import PlanningIdea, PlanningIdeaApproval
from app.services import planning_ideas_service as ideas_svc

APPROVAL_TOKEN_TTL_DAYS = 14
_REVIEWER_ROLES = frozenset(
    {UserRole.company_admin.value, UserRole.manager.value, UserRole.supervisor.value}
)


def _approval_to_dict(row: PlanningIdeaApproval) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "planning_idea_id": str(row.planning_idea_id),
        "requested_by_user_id": str(row.requested_by_user_id) if row.requested_by_user_id else None,
        "requested_to_user_id": str(row.requested_to_user_id),
        "status": row.status,
        "request_comments": row.request_comments,
        "reviewer_comments": row.reviewer_comments,
        "requested_at": row.requested_at,
        "responded_at": row.responded_at,
        "email_sent_at": row.email_sent_at,
    }


def _review_url(raw_token: str) -> str:
    base = get_settings().pulse_app_public_origin.rstrip("/")
    return f"{base}/planning-approval?token={raw_token}"


def _action_url(raw_token: str, intent: str) -> str:
    return f"{_review_url(raw_token)}&intent={intent}"


async def list_reviewers(db: AsyncSession, company_id: str) -> list[dict[str, Any]]:
    stmt = (
        select(User)
        .where(User.company_id == company_id, User.is_active.is_(True))
        .order_by(User.full_name.asc().nulls_last(), User.email.asc())
    )
    users = list((await db.execute(stmt)).scalars().all())
    out: list[dict[str, Any]] = []
    for u in users:
        roles = [r for r in (u.roles or []) if r in _REVIEWER_ROLES]
        if not roles:
            continue
        out.append(
            {
                "user_id": str(u.id),
                "full_name": (u.full_name or "").strip() or u.email,
                "email": u.email,
                "roles": roles,
            }
        )
    return out


async def get_pending_for_idea(db: AsyncSession, idea_id: str) -> PlanningIdeaApproval | None:
    rq = await db.execute(
        select(PlanningIdeaApproval)
        .where(
            PlanningIdeaApproval.planning_idea_id == idea_id,
            PlanningIdeaApproval.status == "pending",
        )
        .order_by(PlanningIdeaApproval.requested_at.desc())
        .limit(1)
    )
    return rq.scalars().first()


async def request_approval(
    db: AsyncSession,
    company_id: str,
    actor_id: str,
    idea: PlanningIdea,
    *,
    requested_to_user_id: str,
    comments: Optional[str],
    settings: Optional[Settings] = None,
) -> tuple[PlanningIdeaApproval, bool, Optional[str]]:
    if idea.status == "converted":
        raise ValueError("converted ideas cannot request approval")
    if idea.status == "awaiting_review":
        pending = await get_pending_for_idea(db, str(idea.id))
        if pending:
            raise ValueError("approval already pending for this idea")

    reviewer = await db.get(User, requested_to_user_id)
    if not reviewer or str(reviewer.company_id) != company_id or not reviewer.is_active:
        raise ValueError("reviewer not found")
    reviewer_roles = set(reviewer.roles or [])
    if not reviewer_roles.intersection(_REVIEWER_ROLES):
        raise ValueError("selected user cannot approve planning ideas")

    actor = await db.get(User, actor_id)
    requester_name = (actor.full_name or "").strip() if actor else ""
    if not requester_name and actor:
        requester_name = actor.email

    raw_token = generate_raw_token()
    token_hash = hash_system_token(raw_token)
    now = datetime.now(timezone.utc)
    row = PlanningIdeaApproval(
        planning_idea_id=str(idea.id),
        requested_by_user_id=actor_id,
        requested_to_user_id=requested_to_user_id,
        status="pending",
        request_comments=(comments or "").strip() or None,
        requested_at=now,
        approval_token_hash=token_hash,
    )
    db.add(row)
    idea.status = "awaiting_review"
    idea.updated_at = now
    await db.flush()

    cfg = settings or get_settings()
    review_url = _review_url(raw_token)
    email_sent = False
    if cfg.smtp_configured and reviewer.email:
        cost = idea.estimated_cost
        if cost is not None and not isinstance(cost, Decimal):
            cost = Decimal(str(cost))
        email_sent = await send_planning_idea_approval_request(
            cfg,
            to_email=reviewer.email,
            reviewer_name=(reviewer.full_name or "").strip() or reviewer.email,
            requester_name=requester_name or "A team member",
            idea_title=idea.title,
            idea_description=idea.description,
            idea_location=idea.location,
            estimated_cost=cost,
            priority=idea.priority,
            request_comments=row.request_comments,
            review_url=review_url,
            approve_url=_action_url(raw_token, "approve"),
            reject_url=_action_url(raw_token, "reject"),
        )
        if email_sent:
            row.email_sent_at = datetime.now(timezone.utc)

    await record_audit(
        db,
        action="planning_idea.approval_requested",
        actor_user_id=actor_id,
        company_id=company_id,
        metadata={
            "idea_id": str(idea.id),
            "approval_id": str(row.id),
            "requested_to_user_id": requested_to_user_id,
            "email_sent": email_sent,
        },
    )
    await db.flush()
    return row, email_sent, review_url if not email_sent else review_url


async def get_approval_by_token(db: AsyncSession, raw_token: str) -> PlanningIdeaApproval | None:
    th = hash_system_token(raw_token.strip())
    rq = await db.execute(
        select(PlanningIdeaApproval).where(PlanningIdeaApproval.approval_token_hash == th).limit(1)
    )
    return rq.scalars().first()


def _token_expired(row: PlanningIdeaApproval) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(days=APPROVAL_TOKEN_TTL_DAYS)
    return row.requested_at < cutoff


async def get_public_review_payload(db: AsyncSession, raw_token: str) -> dict[str, Any]:
    approval = await get_approval_by_token(db, raw_token)
    if not approval:
        raise ValueError("invalid or expired approval link")
    if _token_expired(approval):
        raise ValueError("approval link has expired")

    idea = await db.get(PlanningIdea, approval.planning_idea_id)
    if not idea:
        raise ValueError("idea not found")

    company = await db.get(Company, str(idea.company_id))
    requester = await db.get(User, approval.requested_by_user_id) if approval.requested_by_user_id else None
    cost = idea.estimated_cost
    if cost is not None and not isinstance(cost, Decimal):
        cost = Decimal(str(cost))

    return {
        "id": str(idea.id),
        "title": idea.title,
        "description": idea.description,
        "location": idea.location,
        "category": idea.category,
        "estimated_cost": cost,
        "priority": idea.priority,
        "status": idea.status,
        "request_comments": approval.request_comments,
        "requester_name": (requester.full_name or "").strip() if requester else "Unknown",
        "requester_email": requester.email if requester else None,
        "company_name": company.name if company else "Organization",
        "approval_status": approval.status,
        "already_responded": approval.responded_at is not None,
    }


async def respond_via_token(
    db: AsyncSession,
    raw_token: str,
    *,
    decision: str,
    reviewer_comments: Optional[str],
) -> tuple[PlanningIdea, PlanningIdeaApproval, str]:
    approval = await get_approval_by_token(db, raw_token)
    if not approval:
        raise ValueError("invalid or expired approval link")
    if _token_expired(approval):
        raise ValueError("approval link has expired")
    if approval.responded_at is not None:
        raise ValueError("this approval request was already completed")

    idea = await db.get(PlanningIdea, approval.planning_idea_id)
    if not idea:
        raise ValueError("idea not found")

    now = datetime.now(timezone.utc)
    reviewer_msg = (reviewer_comments or "").strip() or None
    if decision == "approve":
        approval.status = "approved"
        idea.status = "approved"
        audit_action = "planning_idea.approval_approved"
        message = "Idea approved. The submitter can now create a project from this idea."
    else:
        approval.status = "rejected"
        idea.status = "rejected"
        audit_action = "planning_idea.approval_rejected"
        message = "Idea rejected. The submitter may revise and request approval again."

    approval.reviewer_comments = reviewer_msg
    approval.responded_at = now
    idea.updated_at = now
    await db.flush()

    await record_audit(
        db,
        action=audit_action,
        actor_user_id=str(approval.requested_to_user_id),
        company_id=str(idea.company_id),
        metadata={
            "idea_id": str(idea.id),
            "approval_id": str(approval.id),
            "decision": decision,
            "reviewer_comments": reviewer_msg,
            "via_token": True,
        },
    )
    await db.flush()
    return idea, approval, message


async def compute_stats(db: AsyncSession, company_id: str) -> dict[str, Any]:
    rows = list(
        (
            await db.execute(
                select(PlanningIdea.status, PlanningIdea.estimated_cost).where(PlanningIdea.company_id == company_id)
            )
        ).all()
    )
    pipeline_statuses = frozenset({"idea", "awaiting_review", "approved"})
    pipeline_value = Decimal("0")
    counts = {
        "ideas_submitted": 0,
        "awaiting_approval": 0,
        "approved": 0,
        "converted_to_projects": 0,
    }
    for status, cost in rows:
        norm = "awaiting_review" if status in ("awaiting_approval", "reviewing") else status
        counts["ideas_submitted"] += 1
        if norm == "awaiting_review":
            counts["awaiting_approval"] += 1
        elif norm == "approved":
            counts["approved"] += 1
        elif norm == "converted":
            counts["converted_to_projects"] += 1
        if norm in pipeline_statuses and cost is not None:
            pipeline_value += Decimal(str(cost))

    return {
        **counts,
        "estimated_pipeline_value": pipeline_value if pipeline_value > 0 else None,
    }


def approval_out(row: PlanningIdeaApproval) -> dict:
    return _approval_to_dict(row)
