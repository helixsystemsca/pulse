"""Phase 5 — personal ops binder and standalone report PDFs (reportlab)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from io import BytesIO
from typing import Any, Iterable, Optional, Sequence

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import ops_command_service as cmd_svc
from app.services import ops_intelligence_service as intel_svc
from app.services import ops_org_service as org_svc

BINDER_SECTIONS = (
    "profile",
    "role",
    "org",
    "people",
    "checklists",
    "knowledge_gaps",
    "team_development",
    "emergency",
    "attention",
)

STANDALONE_TYPES = (
    "profile",
    "checklist",
    "org_chart",
    "emergency_card",
    "attention",
)


def _esc(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "OpsTitle",
            parent=base["Heading1"],
            fontSize=18,
            spaceAfter=8,
            textColor=colors.HexColor("#0f172a"),
        ),
        "h2": ParagraphStyle(
            "OpsH2",
            parent=base["Heading2"],
            fontSize=13,
            spaceBefore=14,
            spaceAfter=6,
            textColor=colors.HexColor("#1e293b"),
        ),
        "body": ParagraphStyle(
            "OpsBody",
            parent=base["BodyText"],
            fontSize=9.5,
            leading=13,
            alignment=TA_LEFT,
        ),
        "muted": ParagraphStyle(
            "OpsMuted",
            parent=base["BodyText"],
            fontSize=8.5,
            textColor=colors.HexColor("#64748b"),
            leading=11,
        ),
        "card": ParagraphStyle(
            "OpsCard",
            parent=base["BodyText"],
            fontSize=11,
            leading=15,
            alignment=TA_CENTER,
        ),
    }


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(_esc(text).replace("\n", "<br/>"), style)


def _bullets(items: Iterable[str], style: ParagraphStyle) -> list[Any]:
    out: list[Any] = []
    for it in items:
        t = str(it).strip()
        if t:
            out.append(_p(f"• {t}", style))
    return out


def _footer(canvas, doc, *, subtitle: str) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(0.75 * inch, 0.5 * inch, subtitle[:90])
    canvas.drawRightString(letter[0] - 0.75 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def _build_pdf(story: list[Any], *, title: str, company_name: str) -> bytes:
    buf = BytesIO()
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    subtitle = f"{company_name} · Recreation Ops · {title} · {generated}"

    def _on_page(canvas, doc):
        _footer(canvas, doc, subtitle=subtitle)

    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.75 * inch,
        title=title,
        author=company_name,
    )
    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    return buf.getvalue()


async def _company_name(db: AsyncSession, company_id: str) -> str:
    from app.models.domain import Company

    co = await db.get(Company, company_id)
    return (co.name if co else None) or "Organization"


async def _section_profile(db: AsyncSession, company_id: str, user_id: str, st: dict) -> list[Any]:
    profile = await cmd_svc.get_or_create_profile(db, company_id, user_id)
    story: list[Any] = [_p("My Profile", st["h2"])]
    lines = [
        f"Name: {profile.display_name or '—'}",
        f"Position: {profile.position or '—'}",
        f"Department: {profile.department or '—'}",
        f"Manager: {profile.manager_name or '—'}",
        f"Start date: {profile.start_date.isoformat() if profile.start_date else '—'}",
        f"Contact: {profile.contact_info or '—'}",
    ]
    story.extend(_p(x, st["body"]) for x in lines)
    if profile.role_purpose:
        story.append(_p("Role purpose", st["h2"]))
        story.append(_p(profile.role_purpose, st["body"]))
    phil = profile.philosophy or {}
    if any(str(v).strip() for v in phil.values()):
        story.append(_p("Philosophy", st["h2"]))
        for k, v in phil.items():
            if str(v).strip():
                story.append(_p(f"{k.replace('_', ' ').title()}: {v}", st["body"]))
    principles = [str(x) for x in (profile.principles or []) if str(x).strip()]
    if principles:
        story.append(_p("Operating principles", st["h2"]))
        story.extend(_bullets(principles, st["body"]))
    return story


async def _section_role(db: AsyncSession, company_id: str, user_id: str, st: dict) -> list[Any]:
    resps = await cmd_svc.list_responsibilities(db, company_id, user_id)
    auth = await cmd_svc.list_authority(db, company_id, user_id)
    story: list[Any] = [_p("Role & Responsibilities", st["h2"])]
    if not resps:
        story.append(_p("No responsibilities recorded yet.", st["muted"]))
    for r in resps:
        story.append(_p(f"{r.title} ({r.category} · {r.priority})", st["body"]))
        if r.description:
            story.append(_p(r.description, st["muted"]))
    story.append(_p("Authority matrix", st["h2"]))
    if not auth:
        story.append(_p("No authority rows recorded.", st["muted"]))
    else:
        data = [["Decision", "Status", "Levels"]]
        for a in auth:
            levels = ", ".join(k for k, v in (a.levels or {}).items() if v) or "—"
            data.append([a.decision[:40], a.status, levels[:40]])
        tbl = Table(data, colWidths=[2.6 * inch, 1.2 * inch, 2.6 * inch])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(tbl)
    return story


async def _section_org(db: AsyncSession, company_id: str, st: dict) -> list[Any]:
    roots = await org_svc.org_chart(db, company_id)
    story: list[Any] = [_p("Organization", st["h2"])]

    def walk(nodes: list[dict[str, Any]], depth: int = 0) -> None:
        for n in nodes:
            pad = "  " * depth
            role = " · ".join(x for x in [n.get("position"), n.get("role_label"), n.get("department")] if x)
            story.append(_p(f"{pad}• {n.get('title')}{(' — ' + role) if role else ''}", st["body"]))
            walk(n.get("children") or [], depth + 1)

    if not roots:
        story.append(_p("No people in the ops directory yet.", st["muted"]))
    else:
        walk(roots)
    return story


async def _section_people(db: AsyncSession, company_id: str, st: dict) -> list[Any]:
    from app.models.ops_foundation_models import OpsPerson

    rows = list(
        (
            await db.execute(
                select(OpsPerson)
                .where(OpsPerson.company_id == company_id, OpsPerson.status != "archived")
                .order_by(OpsPerson.title)
                .limit(80)
            )
        )
        .scalars()
        .all()
    )
    story: list[Any] = [_p("People (operational directory)", st["h2"])]
    if not rows:
        story.append(_p("No people recorded.", st["muted"]))
        return story
    for p in rows:
        bits = [p.title]
        if p.position:
            bits.append(p.position)
        if p.department:
            bits.append(p.department)
        story.append(_p(" · ".join(bits), st["body"]))
        if p.current_priorities:
            story.append(_p(f"Priorities: {p.current_priorities}", st["muted"]))
        if p.need_from_me or p.need_from_them:
            story.append(
                _p(
                    f"Needs: from me — {p.need_from_me or '—'}; from them — {p.need_from_them or '—'}",
                    st["muted"],
                )
            )
    return story


async def _section_checklists(db: AsyncSession, company_id: str, user_id: str, st: dict) -> list[Any]:
    instances = await cmd_svc.list_instances(db, company_id, user_id)
    story: list[Any] = [_p("Checklists", st["h2"])]
    active = [i for i in instances if i.status == "active"]
    if not active:
        story.append(_p("No active checklists.", st["muted"]))
        return story
    for inst in active[:8]:
        items = list(inst.items or [])
        done = sum(1 for x in items if x.completed)
        pct = int(round(100 * done / len(items))) if items else 0
        story.append(_p(f"{inst.title} — {pct}% ({done}/{len(items)})", st["body"]))
        open_items = [x.title for x in items if not x.completed][:12]
        story.extend(_bullets(open_items, st["muted"]))
    return story


async def _section_gaps(db: AsyncSession, company_id: str, user_id: str, st: dict) -> list[Any]:
    gaps = await cmd_svc.list_gaps(db, company_id, user_id)
    open_gaps = [g for g in gaps if g.status in {"open", "asked", "needs_review"}]
    story: list[Any] = [_p("Knowledge Gaps", st["h2"])]
    if not open_gaps:
        story.append(_p("No open knowledge gaps.", st["muted"]))
        return story
    for g in open_gaps[:20]:
        story.append(_p(f"[{g.priority}] {g.question}", st["body"]))
        if g.who_should_answer:
            story.append(_p(f"Ask: {g.who_should_answer}", st["muted"]))
    return story


async def _section_team_dev(db: AsyncSession, company_id: str, st: dict) -> list[Any]:
    risks = await org_svc.list_risks(db, company_id)
    plans = await org_svc.list_plans(db, company_id)
    story: list[Any] = [_p("Team Development", st["h2"])]
    open_risks = [r for r in risks if r.get("status") in {"open", "monitoring"}]
    story.append(_p(f"Open team risks: {len(open_risks)}", st["body"]))
    for r in open_risks[:10]:
        story.append(
            _p(
                f"[{r.get('severity')}] {r.get('title')} ({str(r.get('risk_type') or '').replace('_', ' ')})",
                st["muted"],
            )
        )
    story.append(_p(f"Development plans: {len(plans)}", st["body"]))
    for p in plans[:8]:
        story.append(
            _p(
                f"{p.get('person_name') or p.get('person_id')}: {p.get('title')} · {p.get('progress')}",
                st["muted"],
            )
        )
    return story


async def _section_emergency(db: AsyncSession, company_id: str, st: dict) -> list[Any]:
    intel = await intel_svc.gather_intelligence(db, company_id)
    em = intel.get("emergency") or {}
    story: list[Any] = [_p("Emergency Readiness", st["h2"])]
    story.append(
        _p(
            f"Facilities with procedures: {em.get('facilities_with_procedures', 0)} · "
            f"Emergency contacts: {em.get('emergency_contacts', 0)} · "
            f"Knowledge articles: {em.get('emergency_knowledge_articles', 0)}",
            st["body"],
        )
    )
    gaps = em.get("readiness_gaps") or []
    if gaps:
        story.append(_p("Readiness gaps", st["h2"]))
        story.extend(_bullets(gaps, st["body"]))
    for it in (em.get("items") or [])[:8]:
        story.append(_p(f"{it.get('title')} — {it.get('detail') or ''}", st["muted"]))
    return story


async def _section_attention(db: AsyncSession, company_id: str, st: dict) -> list[Any]:
    intel = await intel_svc.gather_intelligence(db, company_id)
    totals = intel.get("totals") or {}
    story: list[Any] = [_p("Operational Attention Summary", st["h2"])]
    for k, v in totals.items():
        story.append(_p(f"{k.replace('_', ' ').title()}: {v}", st["body"]))
    story.append(_p("Priority items", st["h2"]))
    for it in (intel.get("attention_items") or [])[:15]:
        story.append(
            _p(
                f"[{it.get('priority')}] {it.get('title')} ({it.get('kind')})"
                + (f" — {it.get('detail')}" if it.get("detail") else ""),
                st["muted"],
            )
        )
    return story


SECTION_BUILDERS = {
    "profile": _section_profile,
    "role": _section_role,
    "org": _section_org,
    "people": _section_people,
    "checklists": _section_checklists,
    "knowledge_gaps": _section_gaps,
    "team_development": _section_team_dev,
    "emergency": _section_emergency,
    "attention": _section_attention,
}


async def build_binder_pdf(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    *,
    sections: Optional[Sequence[str]] = None,
    company_name: Optional[str] = None,
) -> bytes:
    st = _styles()
    co = company_name or await _company_name(db, company_id)
    wanted = [s for s in (sections or BINDER_SECTIONS) if s in SECTION_BUILDERS]
    if not wanted:
        wanted = list(BINDER_SECTIONS)

    story: list[Any] = [
        _p("Recreation Operations Binder", st["title"]),
        _p(
            f"{co}\nPersonal operating manual · Generated {date.today().isoformat()}",
            st["muted"],
        ),
        Spacer(1, 8),
        _p("Contents: " + ", ".join(s.replace("_", " ") for s in wanted), st["body"]),
        Spacer(1, 12),
    ]

    for i, key in enumerate(wanted):
        builder = SECTION_BUILDERS[key]
        # profile/role/checklists/gaps need user_id
        if key in {"profile", "role", "checklists", "knowledge_gaps"}:
            part = await builder(db, company_id, user_id, st)  # type: ignore[misc]
        else:
            part = await builder(db, company_id, st)  # type: ignore[misc]
        story.extend(part)
        if i < len(wanted) - 1:
            story.append(PageBreak())

    return _build_pdf(story, title="Operations Binder", company_name=co)


async def build_standalone_pdf(
    db: AsyncSession,
    company_id: str,
    user_id: str,
    *,
    report_type: str,
    entity_id: Optional[str] = None,
) -> bytes:
    if report_type not in STANDALONE_TYPES:
        raise ValueError(f"Unknown report type: {report_type}")
    st = _styles()
    co = await _company_name(db, company_id)

    if report_type == "profile":
        story = [
            _p("My Profile & Role", st["title"]),
            _p(co, st["muted"]),
            Spacer(1, 8),
        ]
        story.extend(await _section_profile(db, company_id, user_id, st))
        story.extend(await _section_role(db, company_id, user_id, st))
        return _build_pdf(story, title="Profile Report", company_name=co)

    if report_type == "org_chart":
        story = [_p("Organization Chart", st["title"]), _p(co, st["muted"]), Spacer(1, 8)]
        story.extend(await _section_org(db, company_id, st))
        return _build_pdf(story, title="Org Chart", company_name=co)

    if report_type == "attention":
        story = [_p("Operational Attention", st["title"]), _p(co, st["muted"]), Spacer(1, 8)]
        story.extend(await _section_attention(db, company_id, st))
        return _build_pdf(story, title="Attention Report", company_name=co)

    if report_type == "checklist":
        instances = await cmd_svc.list_instances(db, company_id, user_id)
        inst = None
        if entity_id:
            inst = next((i for i in instances if str(i.id) == entity_id), None)
        if not inst and instances:
            inst = next((i for i in instances if i.status == "active"), instances[0])
        story = [_p("Checklist Report", st["title"]), _p(co, st["muted"]), Spacer(1, 8)]
        if not inst:
            story.append(_p("No checklist found.", st["body"]))
        else:
            items = list(inst.items or [])
            done = sum(1 for x in items if x.completed)
            story.append(_p(inst.title, st["h2"]))
            if inst.description:
                story.append(_p(inst.description, st["muted"]))
            story.append(_p(f"Progress: {done}/{len(items)}", st["body"]))
            section = None
            for it in items:
                if it.section != section:
                    section = it.section
                    story.append(_p(section or "General", st["h2"]))
                mark = "☑" if it.completed else "☐"
                story.append(_p(f"{mark} {it.title}", st["body"]))
        return _build_pdf(story, title="Checklist", company_name=co)

    if report_type == "emergency_card":
        # Compact one-pager — also available as HTML print page
        intel = await intel_svc.gather_intelligence(db, company_id)
        em = intel.get("emergency") or {}
        profile = await cmd_svc.get_or_create_profile(db, company_id, user_id)
        story = [
            _p("EMERGENCY CARD", st["title"]),
            _p(co, st["muted"]),
            Spacer(1, 10),
            _p(profile.display_name or "Coordinator", st["card"]),
            _p(profile.position or "Recreation Operations", st["card"]),
            Spacer(1, 12),
            _p("Readiness snapshot", st["h2"]),
            _p(
                f"Facilities w/ procedures: {em.get('facilities_with_procedures', 0)}\n"
                f"Emergency contacts: {em.get('emergency_contacts', 0)}\n"
                f"Knowledge articles: {em.get('emergency_knowledge_articles', 0)}",
                st["body"],
            ),
        ]
        gaps = em.get("readiness_gaps") or []
        if gaps:
            story.append(_p("Gaps", st["h2"]))
            story.extend(_bullets(gaps, st["body"]))
        story.append(Spacer(1, 10))
        story.append(
            _p(
                "Open /recreation/emergency in Pulse for full contacts and facility procedures.",
                st["muted"],
            )
        )
        return _build_pdf(story, title="Emergency Card", company_name=co)

    raise ValueError(f"Unhandled report type: {report_type}")
