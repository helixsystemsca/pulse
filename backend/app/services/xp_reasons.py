"""Human-readable XP reasons for ledger + realtime UI."""

from __future__ import annotations


def display_reason(reason_code: str, meta: dict | None = None) -> str:
    md = meta or {}
    code = (reason_code or "").strip().lower()
    mapping: dict[str, str] = {
        "task_completed": "Task completed",
        "work_request_assigned": "Work assigned",
        "assignment_responsive_24h": "Quick assignment (24h)",
        "schedule_shift_planned_ahead": "Schedule planned ahead",
        "supervisor_one_on_one": "1-on-1 logged",
        "employee_feedback_score": "Positive feedback",
        "manager_bonus": "Manager bonus",
        "streak_milestone": "Streak milestone",
        "pm_completed_on_time": "Preventive maintenance on time",
        "inspection_sheet_completed": "Inspection submitted",
        "procedure_completed": "Procedure completed",
        "procedure_all_steps": "All procedure steps completed",
        "inference_confirmed": "Maintenance confirmed proactively",
        "attendance_clock_in": "Daily clock-in",
        "task_reopen_penalty": "Task reopened — quality bonus removed",
        "flag_bonus_reversal": "Task flagged — quality bonus removed",
        "product_feedback_helpful": "Helpful product feedback",
    }
    base = mapping.get(code) or reason_code.replace("_", " ").title()
    title = md.get("task_title")
    if title and code == "task_completed":
        return f"{base}: {title}"
    return base
