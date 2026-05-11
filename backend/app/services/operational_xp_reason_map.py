"""Map legacy reason_code values to operational XP categories for analytics and caps."""

from __future__ import annotations

REASON_CODE_TO_CATEGORY: dict[str, str] = {
    "attendance_clock_in": "attendance",
    "task_completed": "operational",
    "procedure_completed": "procedure",
    "procedure_all_steps": "procedure",
    "pm_completed_on_time": "routine",
    "inspection_sheet_completed": "compliance",
    "inference_confirmed": "initiative",
    "work_request_assigned": "operational",
    "assignment_responsive_24h": "operational",
    "schedule_shift_planned_ahead": "operational",
    "supervisor_one_on_one": "recognition",
    "employee_feedback_score": "recognition",
    "manager_bonus_xp": "recognition",
    "peer_recognition": "recognition",
    "cross_department_recognition": "recognition",
    "cross_department_recognition": "recognition",
    "supervisor_commendation": "recognition",
    "shift_coverage_short_notice": "attendance",
    "stat_holiday_worked": "attendance",
    "perfect_week_attendance": "attendance",
    "training_mandatory_completed": "training",
    "training_optional_completed": "training",
    "training_renewed_early": "training",
    "procedure_quiz_first_attempt_bonus": "training",
    "procedure_acknowledged": "training",
    "routine_completed": "routine",
    "routine_rated_satisfactory": "routine",
    "routine_rated_excellent": "routine",
    "audit_zero_deficiencies": "compliance",
    "early_high_priority_finding": "initiative",
    "work_order_completed": "work_order",
    "preventative_completed": "routine",
    "emergency_work_order_completed": "work_order",
    "closed_overdue_task": "operational",
    "equipment_doc_contribution": "initiative",
    "asset_photo_uploaded": "operational",
    "improvement_suggestion_approved": "initiative",
    "recurring_issue_trend": "initiative",
    "procedure_draft_created": "procedure",
    "documentation_help": "initiative",
}


def category_for_reason(reason_code: str, explicit: str | None = None) -> str:
    if explicit and explicit.strip():
        return explicit.strip().lower()[:32]
    return REASON_CODE_TO_CATEGORY.get(str(reason_code).strip(), "operational")
