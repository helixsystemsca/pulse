"""Procedure knowledge verification (view → acknowledge → quiz)."""

from app.services.procedure_verification.service import (
    EngagementSnapshot,
    complete_verification_quiz_session,
    create_quiz_session_for_employee,
    ensure_verification_questions,
    get_engagement_snapshot,
    load_attempt_stats_for_pairs,
    record_engagement_view,
    verification_requires_quiz,
)

__all__ = [
    "EngagementSnapshot",
    "complete_verification_quiz_session",
    "create_quiz_session_for_employee",
    "ensure_verification_questions",
    "get_engagement_snapshot",
    "load_attempt_stats_for_pairs",
    "record_engagement_view",
    "verification_requires_quiz",
]
