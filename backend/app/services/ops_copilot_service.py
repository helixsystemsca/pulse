"""Deterministic Ops Copilot — curated prompts answered from Pulse records with citations.

Not an LLM. Answers cite internal records (assets, SOPs, certs, contractors, PMs).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import FacilityEquipment, User
from app.models.ops_foundation_models import OpsContractor, OpsFacility, OpsKnowledgeArticle
from app.models.pm_models import PmTask
from app.models.pulse_models import PulseProcedure, PulseWorkRequest, PulseWorkerCertification
from app.services.certification_expiry_service import certification_expiry_summary
from app.services.contractor_compliance import contractor_compliance
from app.services.ops_compliance_dates import utc_today
from app.services.ops_intelligence_service import gather_intelligence

PROMPT_LIBRARY: list[dict[str, str]] = [
    {
        "id": "overdue-arena",
        "label": "What's overdue at the arena?",
        "prompt": "What's overdue at the arena?",
        "hint": "PMs, work requests, and checklists matching arena / ice plant.",
    },
    {
        "id": "overdue-aquatic",
        "label": "What's overdue at the aquatic centre?",
        "prompt": "What's overdue at the aquatic centre?",
        "hint": "Water quality PMs, pool equipment, and aquatic work requests.",
    },
    {
        "id": "qualified-ice-plant",
        "label": "Who is qualified for ice plant / ammonia work?",
        "prompt": "Who is qualified for ice plant / ammonia work?",
        "hint": "Staff certifications that mention refrigeration, ammonia, or ice plant.",
    },
    {
        "id": "ammonia-release",
        "label": "Ammonia release response",
        "prompt": "What is the internal ammonia release response procedure?",
        "hint": "Internal emergency procedures and knowledge articles — not a regulatory citation.",
    },
    {
        "id": "pool-emergency",
        "label": "Pool emergency / water quality",
        "prompt": "What should I do for a pool emergency or water quality issue?",
        "hint": "Internal drowning / water quality procedures and aquatic assets.",
    },
    {
        "id": "certs-this-month",
        "label": "Certifications expiring this month",
        "prompt": "Which certifications are expired or expiring within 30 days?",
        "hint": "In-app certification expiry (30/60/90).",
    },
    {
        "id": "contractor-insurance",
        "label": "Contractor insurance / WCB status",
        "prompt": "What is the contractor insurance and WCB status?",
        "hint": "Expired or missing COI / WCB on the contractor pack.",
    },
    {
        "id": "assets-without-pms",
        "label": "Critical assets without current PMs",
        "prompt": "Which critical assets have no current preventive maintenance?",
        "hint": "Equipment with no PM task, or overdue PMs.",
    },
]


def _cite(*, title: str, href: str, kind: str, detail: Optional[str] = None) -> dict[str, Any]:
    return {"title": title, "href": href, "kind": kind, "detail": detail}


def _lines_and_cites(parts: list[tuple[str, Optional[dict[str, Any]]]]) -> tuple[str, list[dict[str, Any]]]:
    lines: list[str] = []
    cites: list[dict[str, Any]] = []
    for text, cite in parts:
        lines.append(text)
        if cite:
            cites.append(cite)
    return "\n".join(lines), cites


async def _overdue_for_place(db: AsyncSession, company_id: str, needles: tuple[str, ...]) -> tuple[str, list[dict[str, Any]]]:
    now = datetime.now(timezone.utc)
    eqs = list(
        (
            await db.execute(select(FacilityEquipment).where(FacilityEquipment.company_id == company_id))
        ).scalars().all()
    )
    match_ids = {
        str(e.id)
        for e in eqs
        if any(n in f"{e.name} {e.type}".lower() for n in needles)
    }
    facilities = list(
        (
            await db.execute(select(OpsFacility).where(OpsFacility.company_id == company_id))
        ).scalars().all()
    )
    fac_match = [f for f in facilities if any(n in f.title.lower() for n in needles)]

    parts: list[tuple[str, Optional[dict[str, Any]]]] = []
    if fac_match:
        for f in fac_match:
            parts.append(
                (
                    f"Facility record: {f.title}.",
                    _cite(title=f.title, href=f"/recreation/facilities?id={f.id}", kind="facility"),
                )
            )

    pm_stmt = select(PmTask).where(PmTask.company_id == company_id, PmTask.next_due_at < now)
    if match_ids:
        pm_stmt = pm_stmt.where(PmTask.equipment_id.in_(match_ids))
    pms = list((await db.execute(pm_stmt.order_by(PmTask.next_due_at.asc()).limit(12))).scalars().all())
    if not pms:
        parts.append(("No overdue PMs matched this location in the current records.", None))
    for t in pms:
        due = t.next_due_at.date().isoformat() if t.next_due_at else "unknown"
        parts.append(
            (
                f"Overdue PM: {t.name} (due {due}).",
                _cite(title=t.name, href=f"/equipment/{t.equipment_id}" if t.equipment_id else "/dashboard/pm-workspace", kind="pm"),
            )
        )

    wr_stmt = select(PulseWorkRequest).where(
        PulseWorkRequest.company_id == company_id,
        PulseWorkRequest.status.notin_(("completed", "cancelled")),
    )
    if match_ids:
        wr_stmt = wr_stmt.where(
            or_(
                PulseWorkRequest.equipment_id.in_(match_ids),
                PulseWorkRequest.sub_location.ilike(f"%{needles[0]}%"),
            )
        )
    wrs = list((await db.execute(wr_stmt.order_by(PulseWorkRequest.due_date.asc().nullslast()).limit(10))).scalars().all())
    for w in wrs:
        parts.append(
            (
                f"Open work request: {w.title} ({getattr(w.status, 'value', w.status)}).",
                _cite(title=w.title, href="/dashboard/maintenance", kind="work_request", detail=f"WO #{w.work_order_number}"),
            )
        )
    if not parts:
        parts.append(("No matching overdue records yet. Seed or add arena/aquatic assets to see results.", None))
    return _lines_and_cites(parts)


async def _qualified_ammonia(db: AsyncSession, company_id: str) -> tuple[str, list[dict[str, Any]]]:
    keys = ("refrigerat", "ammonia", "ice plant", "ro ", "whmis")
    rows = list(
        (
            await db.execute(
                select(PulseWorkerCertification, User)
                .join(User, User.id == PulseWorkerCertification.user_id)
                .where(PulseWorkerCertification.company_id == company_id, User.is_active.is_(True))
            )
        ).all()
    )
    parts: list[tuple[str, Optional[dict[str, Any]]]] = []
    for cert, user in rows:
        hay = (cert.name or "").lower()
        if not any(k in hay for k in keys):
            continue
        expiry = cert.expiry_date.date().isoformat() if cert.expiry_date else "no expiry on file"
        parts.append(
            (
                f"{user.full_name or user.email}: {cert.name} (expiry {expiry}).",
                _cite(
                    title=f"{user.full_name or user.email} · {cert.name}",
                    href="/training/compliance/workers?panel=certifications",
                    kind="certification",
                ),
            )
        )
    if not parts:
        parts.append(
            (
                "No refrigeration / ammonia / ice-plant certifications are on file yet. "
                "Add them on the employee profile (Josh) or a future staff record.",
                _cite(title="Certifications", href="/training/compliance/workers?panel=certifications", kind="certification"),
            )
        )
    return _lines_and_cites(parts)


async def _procedure_search(db: AsyncSession, company_id: str, needles: tuple[str, ...]) -> tuple[str, list[dict[str, Any]]]:
    rows = list(
        (
            await db.execute(
                select(PulseProcedure).where(
                    PulseProcedure.company_id == company_id,
                    PulseProcedure.is_active.is_(True),
                )
            )
        ).scalars().all()
    )
    articles = list(
        (
            await db.execute(
                select(OpsKnowledgeArticle).where(
                    OpsKnowledgeArticle.company_id == company_id,
                    OpsKnowledgeArticle.status == "active",
                )
            )
        ).scalars().all()
    )
    parts: list[tuple[str, Optional[dict[str, Any]]]] = [
        (
            "These are internal operating procedures, not regulatory citations. Call 911 for life safety.",
            None,
        )
    ]
    for p in rows:
        hay = f"{p.title} {p.procedure_category} {' '.join(str(x) for x in (p.search_keywords or []))}".lower()
        if any(n in hay for n in needles):
            steps = p.steps if isinstance(p.steps, list) else []
            preview = ""
            if steps:
                first = steps[0]
                if isinstance(first, dict):
                    preview = str(first.get("text") or first.get("title") or first.get("instruction") or "")
                elif isinstance(first, str):
                    preview = first
            parts.append(
                (
                    f"Internal SOP: {p.title}." + (f" First step: {preview}" if preview else ""),
                    _cite(title=p.title, href=f"/training/learning/library?procedure={p.id}", kind="procedure"),
                )
            )
    for a in articles:
        hay = f"{a.title} {a.category} {a.body_rich or ''}".lower()
        if any(n in hay for n in needles):
            parts.append(
                (
                    f"Knowledge article: {a.title}.",
                    _cite(title=a.title, href=f"/recreation/knowledge?id={a.id}", kind="knowledge"),
                )
            )
    if len(parts) == 1:
        parts.append(
            (
                "No matching internal procedures are on file yet. Check Emergency Response and Knowledge Base.",
                _cite(title="Emergency Response", href="/recreation/emergency", kind="emergency"),
            )
        )
    return _lines_and_cites(parts)


async def _certs_month(db: AsyncSession, company_id: str) -> tuple[str, list[dict[str, Any]]]:
    summary = await certification_expiry_summary(db, company_id)
    parts: list[tuple[str, Optional[dict[str, Any]]]] = []
    window = list(summary.get("expired") or []) + list(summary.get("expiring_30") or [])
    if not window:
        parts.append(("No certifications are expired or expiring within 30 days.", None))
    for row in window[:20]:
        label = "expired" if row["status"] == "expired" else f"expires in {row['days']} day(s)"
        parts.append(
            (
                f"{row['worker_name']}: {row['name']} — {label} ({row.get('expiry_date') or 'no date'}).",
                _cite(title=f"{row['name']} · {row['worker_name']}", href=str(row["href"]), kind="certification"),
            )
        )
    return _lines_and_cites(parts)


async def _contractor_status(db: AsyncSession, company_id: str) -> tuple[str, list[dict[str, Any]]]:
    rows = list(
        (
            await db.execute(select(OpsContractor).where(OpsContractor.company_id == company_id))
        ).scalars().all()
    )
    parts: list[tuple[str, Optional[dict[str, Any]]]] = []
    today = utc_today()
    if not rows:
        parts.append(("No contractor records yet. Add refrigeration and pool vendors in Contractors.", None))
    for c in rows:
        pack = contractor_compliance(c, today=today)
        alerts = pack.get("alerts") or []
        if not alerts:
            parts.append(
                (
                    f"{c.title}: insurance and WCB look current (or dates not yet entered as expired).",
                    _cite(title=c.title, href=f"/recreation/contractors?id={c.id}", kind="contractor"),
                )
            )
            continue
        detail = "; ".join(f"{a['label']} {a['status']}" for a in alerts)
        parts.append(
            (
                f"{c.title}: {detail}.",
                _cite(title=c.title, href=f"/recreation/contractors?id={c.id}", kind="contractor", detail=detail),
            )
        )
    return _lines_and_cites(parts)


async def _assets_without_pms(db: AsyncSession, company_id: str) -> tuple[str, list[dict[str, Any]]]:
    now = datetime.now(timezone.utc)
    eqs = list(
        (
            await db.execute(select(FacilityEquipment).where(FacilityEquipment.company_id == company_id))
        ).scalars().all()
    )
    pm_eq = set(
        str(r[0])
        for r in (
            await db.execute(
                select(PmTask.equipment_id).where(
                    PmTask.company_id == company_id,
                    PmTask.equipment_id.isnot(None),
                )
            )
        ).all()
        if r[0]
    )
    overdue_eq = set(
        str(r[0])
        for r in (
            await db.execute(
                select(PmTask.equipment_id).where(
                    PmTask.company_id == company_id,
                    PmTask.next_due_at < now,
                    PmTask.equipment_id.isnot(None),
                )
            )
        ).all()
        if r[0]
    )
    parts: list[tuple[str, Optional[dict[str, Any]]]] = []
    missing = [e for e in eqs if str(e.id) not in pm_eq]
    overdue = [e for e in eqs if str(e.id) in overdue_eq]
    if not missing and not overdue:
        parts.append(("Every listed asset has a PM task and none are overdue right now.", None))
    for e in missing[:15]:
        parts.append(
            (
                f"No PM on file: {e.name} ({e.type}).",
                _cite(title=e.name, href=f"/equipment/{e.id}", kind="asset"),
            )
        )
    for e in overdue[:15]:
        parts.append(
            (
                f"PM overdue: {e.name} ({e.type}).",
                _cite(title=e.name, href=f"/equipment/{e.id}", kind="pm"),
            )
        )
    return _lines_and_cites(parts)


async def answer_prompt(db: AsyncSession, company_id: str, prompt_id: str) -> dict[str, Any]:
    spec = next((p for p in PROMPT_LIBRARY if p["id"] == prompt_id), None)
    if spec is None:
        raise ValueError(f"Unknown prompt '{prompt_id}'")

    if prompt_id == "overdue-arena":
        answer, cites = await _overdue_for_place(db, company_id, ("arena", "ice", "ammonia", "zamboni", "resurfacer"))
    elif prompt_id == "overdue-aquatic":
        answer, cites = await _overdue_for_place(db, company_id, ("aquatic", "pool", "water quality", "chemical"))
    elif prompt_id == "qualified-ice-plant":
        answer, cites = await _qualified_ammonia(db, company_id)
    elif prompt_id == "ammonia-release":
        answer, cites = await _procedure_search(db, company_id, ("ammonia", "ice plant", "refrigerat"))
    elif prompt_id == "pool-emergency":
        answer, cites = await _procedure_search(db, company_id, ("drown", "pool emergency", "water quality", "chemical spill"))
    elif prompt_id == "certs-this-month":
        answer, cites = await _certs_month(db, company_id)
    elif prompt_id == "contractor-insurance":
        answer, cites = await _contractor_status(db, company_id)
    elif prompt_id == "assets-without-pms":
        answer, cites = await _assets_without_pms(db, company_id)
    else:
        intel = await gather_intelligence(db, company_id)
        items = intel.get("attention_items") or []
        answer = "Operational attention items from current records:\n" + "\n".join(
            f"- {i.get('title')}" for i in items[:12]
        ) or "No attention items."
        cites = [
            _cite(title=str(i.get("title")), href=str(i.get("href") or "/recreation/attention"), kind=str(i.get("kind") or "attention"))
            for i in items[:12]
        ]

    return {
        "prompt_id": prompt_id,
        "label": spec["label"],
        "prompt": spec["prompt"],
        "answer": answer,
        "citations": cites,
        "disclaimer": "Answers cite Pulse internal records. Internal procedures are not regulatory citations.",
    }
