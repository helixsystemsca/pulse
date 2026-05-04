"""Human-readable export of a ``ProjectSummary`` (print-friendly)."""

from __future__ import annotations

from datetime import date

from app.services.project_summary.schemas import ProjectSummary


def _d(d: date | None) -> str:
    return d.isoformat() if d else "-"


def _yes_no(v: bool | None) -> str:
    if v is True:
        return "Yes"
    if v is False:
        return "No"
    return "-"


def _blank(v: str | float | int | None) -> str:
    if v is None:
        return "-"
    if isinstance(v, str) and not v.strip():
        return "-"
    return str(v)


def format_project_summary(summary: ProjectSummary) -> str:
    """Return a concise, sectioned report suitable for printing or plain-text email."""
    o = summary.overview
    sc = summary.scope
    sch = summary.schedule
    r = summary.resources
    q = summary.quality
    rk = summary.risks
    c = summary.communication
    st = summary.stakeholders
    lessons = summary.lessons
    out = summary.outcome

    parts: list[str] = [
        "PROJECT SUMMARY",
        "=" * 40,
        f"Project ID: {summary.project_id}",
        "",
        "Overview",
        "-" * 8,
        f"  Name:        {o.project_name}",
        f"  Type:        {o.project_type}",
        f"  Owner:       {o.owner}",
        f"  Start:       {_d(o.start_date)}",
        f"  End:         {_d(o.end_date)}",
        f"  On track:    {_yes_no(o.success_flag)}",
    ]
    if st.satisfaction_score is not None:
        parts.append(f"  Stakeholders (avg score): {st.satisfaction_score}")
    parts.extend(
        [
            "",
            "Scope",
            "-" * 5,
            f"  Planned tasks:   {sc.planned_tasks}",
            f"  Completed tasks: {sc.completed_tasks}",
        ]
    )
    if sc.scope_changes:
        parts.append("  Scope changes:")
        for ch in sc.scope_changes:
            parts.append(f"    - {ch}")
    else:
        parts.append("  Scope changes:   (none recorded)")

    parts.extend(
        [
            "",
            "Schedule",
            "-" * 8,
            f"  Planned duration (days): {sch.planned_duration_days}",
            f"  Actual duration (days):  {_blank(sch.actual_duration_days)}",
            f"  Variance (days):         {_blank(sch.variance_days)}",
            f"  Delayed tasks:             {sch.delayed_tasks}",
            "",
            "Resources",
            "-" * 9,
            f"  Team size:     {len(r.team_members)}",
            f"  Total hours:   {_blank(r.total_hours)}",
        ]
    )
    if r.task_distribution:
        parts.append("  Task mix (% of tasks):")
        for uid, pct in sorted(r.task_distribution.items(), key=lambda x: -x[1]):
            parts.append(f"    - {uid}: {pct}%")
    elif r.team_members:
        parts.append(f"  Members: {', '.join(r.team_members)}")
    else:
        parts.append("  (no assignees listed)")

    parts.extend(
        [
            "",
            "Quality",
            "-" * 7,
            f"  Inspections passed: {q.inspections_passed}",
            f"  Inspections failed: {q.inspections_failed}",
            f"  Rework events:      {q.rework_count}",
            "",
            "Risks",
            "-" * 5,
            f"  Open issues: {rk.issue_count}",
        ]
    )
    if rk.major_issues:
        parts.append("  Major issues:")
        for issue in rk.major_issues:
            parts.append(f"    - {issue}")
    else:
        parts.append("  Major issues: (none flagged)")

    parts.extend(
        [
            "",
            "Communication",
            "-" * 13,
            f"  Updates posted:        {c.update_count}",
            f"  Avg response (hours):  {_blank(c.avg_response_time)}",
            "",
            "Lessons Learned",
            "-" * 15,
        ]
    )
    for label, text in (
        ("Went well", lessons.went_well),
        ("Didn't go well", lessons.didnt_go_well),
        ("Improvements", lessons.improvements),
    ):
        line = text.strip() if text else "-"
        parts.append(f"  {label}: {line}")

    parts.extend(
        [
            "",
            "Outcome",
            "-" * 7,
            f"  Result:  {out.result}",
            f"  Summary: {out.summary.strip() if out.summary.strip() else '-'}",
            "",
            "=" * 40,
            "End of report",
        ]
    )
    return "\n".join(parts)
