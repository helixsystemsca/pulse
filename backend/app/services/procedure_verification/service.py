"""View tracking, quiz sessions, and grading for procedure knowledge verification."""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pulse_models import (
    PulseProcedure,
    PulseProcedureCompletionSignoff,
    PulseProcedureComplianceSettings,
    PulseProcedureEngagement,
    PulseProcedureQuizAttempt,
    PulseProcedureQuizSession,
)
from app.schemas.maintenance_hub import normalize_procedure_steps
from app.services.procedure_training.service import record_procedure_signoff, revision_marker_from_procedure


def verification_requires_quiz(cs: PulseProcedureComplianceSettings | None) -> bool:
    if cs is None:
        return True
    return bool(getattr(cs, "requires_knowledge_verification", True))


def tier_question_count(tier: str) -> int:
    if tier == "mandatory":
        return 8
    if tier == "high_risk":
        return 7
    return 6


def _normalize_quiz_from_storage(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        qid = str(item.get("id") or "").strip()
        prompt = str(item.get("prompt") or "").strip()
        choices = item.get("choices")
        ci = item.get("correct_index")
        if not qid or not prompt or not isinstance(choices, list) or len(choices) < 2:
            continue
        try:
            cix = int(ci)
        except (TypeError, ValueError):
            continue
        if cix < 0 or cix >= len(choices):
            continue
        out.append(
            {
                "id": qid,
                "prompt": prompt,
                "choices": [str(c) for c in choices],
                "correct_index": cix,
            }
        )
    return out


def _generated_questions_from_procedure(proc: PulseProcedure, target_n: int) -> list[dict[str, Any]]:
    steps = normalize_procedure_steps(proc.steps)
    bodies = [str(s.content or "").strip() for s in steps if str(s.content or "").strip()]
    if not bodies:
        bodies = [
            "Follow documented steps in order unless an emergency stop is required.",
            "Stop work and escalate unsafe or unclear conditions.",
            "Use required PPE and tooling for the task.",
        ]
    title = (proc.title or "Procedure").strip()
    wrong_pool = [
        "Ignore the documented sequence.",
        "Proceed without confirming hazards are controlled.",
        "Skip notifying supervision when unsure.",
    ]
    pool: list[dict[str, Any]] = []
    i = 0
    while len(pool) < target_n:
        body = bodies[i % len(bodies)]
        i += 1
        excerpt = body[:240] + ("…" if len(body) > 240 else "")
        choices = [excerpt, wrong_pool[0], wrong_pool[1], wrong_pool[2]]
        random.shuffle(choices)
        pool.append(
            {
                "id": f"gen-{proc.id}-{len(pool) + 1}",
                "prompt": f"({title}) Which statement aligns with this procedure?",
                "choices": choices,
                "correct_index": choices.index(excerpt),
            }
        )
    return pool[:target_n]


def ensure_verification_questions(
    proc: PulseProcedure,
    *,
    tier: str,
) -> list[dict[str, Any]]:
    """Return validated quiz question dicts (with answers); persist generated defaults to `proc` only via caller."""
    stored = _normalize_quiz_from_storage(proc.verification_quiz)
    want = tier_question_count(tier)
    want = min(10, max(5, want))
    if len(stored) >= want:
        return stored[:want]
    gen = _generated_questions_from_procedure(proc, want)
    merged = stored + [q for q in gen if q["id"] not in {x["id"] for x in stored}]
    return merged[:want]


@dataclass(frozen=True)
class EngagementSnapshot:
    first_viewed_at: Optional[datetime]
    last_viewed_at: Optional[datetime]
    total_view_seconds: int
    quiz_passed_at: Optional[datetime]


@dataclass(frozen=True)
class QuizAttemptStats:
    attempt_count: int
    latest_score_percent: Optional[int]
    latest_passed: Optional[bool]


async def get_engagement_snapshot(
    db: AsyncSession,
    company_id: str,
    employee_user_id: str,
    procedure_id: str,
    revision_number: int,
) -> EngagementSnapshot:
    q = await db.execute(
        select(PulseProcedureEngagement).where(
            PulseProcedureEngagement.company_id == company_id,
            PulseProcedureEngagement.employee_user_id == employee_user_id,
            PulseProcedureEngagement.procedure_id == procedure_id,
            PulseProcedureEngagement.revision_number == revision_number,
        )
    )
    row = q.scalar_one_or_none()
    if row is None:
        return EngagementSnapshot(None, None, 0, None)
    return EngagementSnapshot(
        row.first_viewed_at,
        row.last_viewed_at,
        int(row.total_view_seconds or 0),
        row.quiz_passed_at,
    )


async def record_engagement_view(
    db: AsyncSession,
    company_id: str,
    employee_user_id: str,
    procedure_id: str,
    revision_number: int,
    *,
    delta_seconds: int = 0,
) -> PulseProcedureEngagement:
    now = datetime.now(timezone.utc)
    delta_seconds = max(0, min(delta_seconds, 8 * 3600))
    q = await db.execute(
        select(PulseProcedureEngagement).where(
            PulseProcedureEngagement.company_id == company_id,
            PulseProcedureEngagement.employee_user_id == employee_user_id,
            PulseProcedureEngagement.procedure_id == procedure_id,
            PulseProcedureEngagement.revision_number == revision_number,
        )
    )
    row = q.scalar_one_or_none()
    if row is None:
        row = PulseProcedureEngagement(
            id=str(uuid4()),
            company_id=company_id,
            employee_user_id=employee_user_id,
            procedure_id=procedure_id,
            revision_number=revision_number,
            first_viewed_at=now,
            last_viewed_at=now,
            total_view_seconds=delta_seconds,
            quiz_passed_at=None,
        )
        db.add(row)
    else:
        if row.first_viewed_at is None:
            row.first_viewed_at = now
        row.last_viewed_at = now
        row.total_view_seconds = int(row.total_view_seconds or 0) + delta_seconds
    await db.flush()
    return row


async def load_attempt_stats_for_pairs(
    db: AsyncSession,
    company_id: str,
    employee_ids: list[str],
    procedure_ids: list[str],
    revision_by_procedure: dict[str, int],
) -> dict[tuple[str, str], QuizAttemptStats]:
    if not employee_ids or not procedure_ids:
        return {}

    from sqlalchemy import and_, or_

    rev_conds = [
        and_(
            PulseProcedureQuizAttempt.procedure_id == pid,
            PulseProcedureQuizAttempt.revision_number == int(revision_by_procedure.get(pid, 1)),
        )
        for pid in procedure_ids
    ]
    base_where = and_(
        PulseProcedureQuizAttempt.company_id == company_id,
        PulseProcedureQuizAttempt.employee_user_id.in_(employee_ids),
        or_(*rev_conds),
    )

    q = await db.execute(
        select(
            PulseProcedureQuizAttempt.employee_user_id,
            PulseProcedureQuizAttempt.procedure_id,
            func.count(PulseProcedureQuizAttempt.id),
        )
        .where(base_where)
        .group_by(PulseProcedureQuizAttempt.employee_user_id, PulseProcedureQuizAttempt.procedure_id)
    )
    counts: dict[tuple[str, str], int] = {}
    for uid, pid, cnt in q.all():
        counts[(str(uid), str(pid))] = int(cnt or 0)

    latest_rows = await db.execute(
        select(PulseProcedureQuizAttempt)
        .where(base_where)
        .order_by(PulseProcedureQuizAttempt.submitted_at.desc())
        .limit(5000)
    )
    best_latest: dict[tuple[str, str], PulseProcedureQuizAttempt] = {}
    for att in latest_rows.scalars().all():
        key = (str(att.employee_user_id), str(att.procedure_id))
        need_rev = int(revision_by_procedure.get(str(att.procedure_id), 1))
        if int(att.revision_number) != need_rev:
            continue
        if key not in best_latest:
            best_latest[key] = att

    out: dict[tuple[str, str], QuizAttemptStats] = {}
    keys = {(e, p) for e in employee_ids for p in procedure_ids}
    for key in keys:
        att = best_latest.get(key)
        out[key] = QuizAttemptStats(
            attempt_count=int(counts.get(key, 0)),
            latest_score_percent=int(att.score_percent) if att else None,
            latest_passed=bool(att.passed) if att else None,
        )
    return out


async def load_engagement_map(
    db: AsyncSession,
    company_id: str,
    employee_ids: list[str],
    procedure_ids: list[str],
    revision_by_procedure: dict[str, int],
) -> dict[tuple[str, str], EngagementSnapshot]:
    if not employee_ids or not procedure_ids:
        return {}
    revs = list({revision_by_procedure.get(pid, 1) for pid in procedure_ids})
    q = await db.execute(
        select(PulseProcedureEngagement).where(
            PulseProcedureEngagement.company_id == company_id,
            PulseProcedureEngagement.employee_user_id.in_(employee_ids),
            PulseProcedureEngagement.procedure_id.in_(procedure_ids),
            PulseProcedureEngagement.revision_number.in_(revs),
        )
    )
    out: dict[tuple[str, str], EngagementSnapshot] = {}
    for row in q.scalars().all():
        pid = str(row.procedure_id)
        need_rev = int(revision_by_procedure.get(pid, 1))
        if int(row.revision_number) != need_rev:
            continue
        out[(str(row.employee_user_id), pid)] = EngagementSnapshot(
            row.first_viewed_at,
            row.last_viewed_at,
            int(row.total_view_seconds or 0),
            row.quiz_passed_at,
        )
    return out


async def load_signoff_keys(
    db: AsyncSession,
    company_id: str,
    employee_ids: list[str],
    procedure_ids: list[str],
) -> set[tuple[str, str, str]]:
    if not employee_ids or not procedure_ids:
        return set()
    q = await db.execute(
        select(
            PulseProcedureCompletionSignoff.employee_user_id,
            PulseProcedureCompletionSignoff.procedure_id,
            PulseProcedureCompletionSignoff.revision_marker,
        ).where(
            PulseProcedureCompletionSignoff.company_id == company_id,
            PulseProcedureCompletionSignoff.employee_user_id.in_(employee_ids),
            PulseProcedureCompletionSignoff.procedure_id.in_(procedure_ids),
        )
    )
    return {(str(a), str(b), str(c)) for a, b, c in q.all()}


async def create_quiz_session_for_employee(
    db: AsyncSession,
    company_id: str,
    employee_user_id: str,
    procedure: PulseProcedure,
    *,
    tier: str,
) -> tuple[str, list[dict[str, Any]]]:
    """Create session + return (session_id, public questions without correct_index)."""
    rev = int(procedure.content_revision or 1)
    questions = ensure_verification_questions(procedure, tier=tier)
    ids = [str(q["id"]) for q in questions]
    random.shuffle(ids)
    sid = str(uuid4())
    sess = PulseProcedureQuizSession(
        id=sid,
        company_id=company_id,
        employee_user_id=employee_user_id,
        procedure_id=str(procedure.id),
        revision_number=rev,
        question_order=ids,
    )
    db.add(sess)
    await db.flush()
    by_id = {str(q["id"]): q for q in questions}
    public: list[dict[str, Any]] = []
    for qid in ids:
        src = by_id[qid]
        public.append({"id": qid, "prompt": src["prompt"], "choices": list(src["choices"])})
    return sid, public


async def complete_verification_quiz_session(
    db: AsyncSession,
    company_id: str,
    employee_user_id: str,
    procedure: PulseProcedure,
    *,
    session_id: str,
    answers: dict[str, int],
    tier: str,
    completed_by_user_id: str,
    supervisor_signoff: bool = False,
) -> dict[str, Any]:
    """Grade quiz; on 100% record sign-off + engagement."""
    rev = int(procedure.content_revision or 1)
    sq = await db.execute(
        select(PulseProcedureQuizSession).where(
            PulseProcedureQuizSession.id == session_id,
            PulseProcedureQuizSession.company_id == company_id,
            PulseProcedureQuizSession.employee_user_id == employee_user_id,
            PulseProcedureQuizSession.procedure_id == str(procedure.id),
            PulseProcedureQuizSession.revision_number == rev,
        )
    )
    sess = sq.scalar_one_or_none()
    if sess is None:
        raise ValueError("quiz_session_not_found")

    questions = ensure_verification_questions(procedure, tier=tier)
    by_id = {str(q["id"]): q for q in questions}
    order = [str(x) for x in (sess.question_order or [])]
    if not order:
        raise ValueError("invalid_session")

    correct_n = 0
    reveal: dict[str, Any] = {}
    for qid in order:
        src = by_id.get(qid)
        if src is None:
            continue
        pick = answers.get(qid)
        try:
            pix = int(pick) if pick is not None else -1
        except (TypeError, ValueError):
            pix = -1
        ok = pix == int(src["correct_index"])
        if ok:
            correct_n += 1
        reveal[qid] = {
            "correct_index": int(src["correct_index"]),
            "your_index": pix,
            "was_correct": ok,
        }

    total = len(order)
    score = 100 if total == 0 else int(round(100.0 * correct_n / float(total)))
    passed = total > 0 and correct_n == total

    att = PulseProcedureQuizAttempt(
        id=str(uuid4()),
        company_id=company_id,
        employee_user_id=employee_user_id,
        procedure_id=str(procedure.id),
        revision_number=rev,
        submitted_at=datetime.now(timezone.utc),
        score_percent=score,
        correct_count=correct_n,
        total_questions=total,
        passed=passed,
        answers_json={k: int(v) for k, v in answers.items() if k in by_id},
        reveal_json=reveal,
    )
    db.add(att)

    await db.execute(delete(PulseProcedureQuizSession).where(PulseProcedureQuizSession.id == session_id))

    completion_row = None
    created_sig = False
    if passed:
        now = datetime.now(timezone.utc)
        eg = await record_engagement_view(db, company_id, employee_user_id, str(procedure.id), rev, delta_seconds=0)
        eg.quiz_passed_at = now
        marker = revision_marker_from_procedure(procedure)
        completion_row, created_sig = await record_procedure_signoff(
            db,
            company_id,
            employee_user_id=employee_user_id,
            procedure=procedure,
            completed_by_user_id=completed_by_user_id,
            supervisor_signoff=supervisor_signoff,
            revision_marker=marker,
        )

    await db.flush()

    return {
        "score_percent": score,
        "correct_count": correct_n,
        "total_questions": total,
        "passed": passed,
        "reveal": reveal,
        "completion_id": str(completion_row.id) if completion_row else None,
        "completion_created": created_sig,
    }
