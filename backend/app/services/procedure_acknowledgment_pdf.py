"""Build immutable compliance PDFs from acknowledgment snapshots (reportlab, no live procedure reads)."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from io import BytesIO
from typing import Any, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import Image as RLImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

logger = logging.getLogger(__name__)


def _xml_escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _fmt_dt_utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _step_dict(step: Any) -> dict[str, Any]:
    if isinstance(step, dict):
        return step
    return {}


def _step_text(step: Any) -> str:
    if isinstance(step, str):
        return str(step).strip()
    if isinstance(step, dict):
        t = str(step.get("content") or step.get("text") or "").strip()
        return t
    return ""


def _step_type(step: Any) -> str:
    d = _step_dict(step)
    st = str(d.get("type") or "instruction").strip().lower()
    if st in ("instruction", "checklist", "photo", "warning"):
        return st
    return "instruction"


def _step_tools(step: Any) -> list[str]:
    d = _step_dict(step)
    tr = d.get("tools")
    if isinstance(tr, list):
        return [str(x).strip() for x in tr if str(x).strip()][:32]
    if isinstance(tr, str) and tr.strip():
        return [p.strip() for p in tr.split(",") if p.strip()][:32]
    return []


def _step_has_image(step: Any) -> bool:
    d = _step_dict(step)
    if d.get("image_url"):
        return True
    return _step_type(step) == "photo"


def build_procedure_acknowledgment_pdf_bytes(
    *,
    company_display_name: str,
    company_logo: Optional[tuple[bytes, str]],
    archive_snapshot_id: str,
    procedure_id_display: str,
    procedure_version: int,
    procedure_semantic_version: Optional[str],
    procedure_title: str,
    procedure_category: Optional[str],
    procedure_revision_date: Optional[date],
    procedure_revision_summary: Optional[str],
    procedure_steps_snapshot: list[Any],
    step_images: dict[int, tuple[bytes, str]],
    acknowledgment_statement: str,
    acknowledged_at: datetime,
    worker_full_name: Optional[str],
    worker_job_title: Optional[str],
    worker_operational_role: Optional[str],
    generated_at: datetime,
) -> bytes:
    """Synchronous PDF build — run from a thread or worker; no I/O except in-memory buffers."""
    buf = BytesIO()
    styles = getSampleStyleSheet()
    meta = ParagraphStyle(
        name="AckMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#444444"),
        alignment=TA_LEFT,
    )
    h1 = ParagraphStyle(
        name="AckH1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.black,
        spaceAfter=6,
    )
    h2 = ParagraphStyle(
        name="AckH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.black,
        spaceBefore=10,
        spaceAfter=6,
    )
    body = ParagraphStyle(
        name="AckBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#222222"),
        alignment=TA_LEFT,
    )
    stmt = ParagraphStyle(
        name="AckStmt",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=10,
        leading=14,
        leftIndent=12,
        borderPadding=8,
        borderColor=colors.HexColor("#cccccc"),
        borderWidth=0.5,
        backColor=colors.HexColor("#fafafa"),
    )

    story: list[Any] = []
    story.append(Paragraph(_xml_escape(company_display_name or "Organization"), h1))
    story.append(Spacer(1, 0.12 * inch))

    if company_logo:
        raw, mt = company_logo
        try:
            bio = BytesIO(raw)
            img = RLImage(bio, width=1.25 * inch, height=0.55 * inch, kind="proportional")
            story.append(img)
            story.append(Spacer(1, 0.1 * inch))
        except Exception:  # noqa: BLE001
            logger.warning("Could not embed company logo in acknowledgment PDF")

    story.append(Paragraph("Procedure acknowledgment record", h2))
    story.append(
        Paragraph(
            "<b>Historical snapshot</b> — this document reflects the procedure version and content "
            "at the time of acknowledgment. It is not updated when the live procedure changes.",
            meta,
        )
    )
    story.append(Spacer(1, 0.15 * inch))

    ver_line = f"Content revision: <b>{procedure_version}</b>"
    if procedure_semantic_version:
        ver_line += f" &nbsp; Semantic version: <b>{_xml_escape(procedure_semantic_version)}</b>"
    meta_rows = [
        f"<b>Procedure</b>: {_xml_escape(procedure_title)}",
        f"<b>Procedure ID</b>: {_xml_escape(procedure_id_display)}",
        f"<b>Category</b>: {_xml_escape(procedure_category or '—')}",
        ver_line,
        f"<b>Revision date</b>: {procedure_revision_date.isoformat() if procedure_revision_date else '—'}",
    ]
    for line in meta_rows:
        story.append(Paragraph(line, meta))
    story.append(Spacer(1, 0.12 * inch))

    story.append(Paragraph("Worker", h2))
    w_lines = [
        f"<b>Name</b>: {_xml_escape((worker_full_name or '').strip() or '—')}",
        f"<b>Job title</b>: {_xml_escape((worker_job_title or '').strip() or '—')}",
        f"<b>Operational role</b>: {_xml_escape((worker_operational_role or '').strip() or '—')}",
        f"<b>Acknowledgment timestamp (UTC)</b>: {_xml_escape(_fmt_dt_utc(acknowledged_at))}",
    ]
    for line in w_lines:
        story.append(Paragraph(line, meta))
    story.append(Spacer(1, 0.12 * inch))

    story.append(Paragraph("Acknowledgment statement", h2))
    story.append(Paragraph(_xml_escape(acknowledgment_statement), stmt))
    story.append(Spacer(1, 0.15 * inch))

    if procedure_revision_summary and str(procedure_revision_summary).strip():
        story.append(Paragraph("Revision summary (at acknowledgment)", h2))
        story.append(Paragraph(_xml_escape(str(procedure_revision_summary).strip()), body))
        story.append(Spacer(1, 0.12 * inch))

    story.append(Paragraph("Procedure content (snapshot)", h2))
    if not procedure_steps_snapshot:
        story.append(Paragraph("No steps were recorded on this version.", body))
    else:
        for idx, step in enumerate(procedure_steps_snapshot, start=1):
            stype = _step_type(step)
            text = _step_text(step)
            tools = _step_tools(step)
            head = f"Step {idx}"
            if stype != "instruction":
                head += f" ({stype})"
            story.append(Paragraph(f"<b>{_xml_escape(head)}</b>", body))
            if stype == "warning":
                warn_cell = Paragraph(_xml_escape(text or "—"), body)
                wt = Table([[warn_cell]], colWidths=[6.2 * inch])
                wt.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF8E1")),
                            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0C766")),
                            ("LEFTPADDING", (0, 0), (-1, -1), 8),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                            ("TOPPADDING", (0, 0), (-1, -1), 6),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                        ]
                    )
                )
                story.append(wt)
            else:
                story.append(Paragraph(_xml_escape(text or "—"), body))
            if tools:
                tt = Table([[Paragraph("<b>Tools / materials</b>: " + _xml_escape(", ".join(tools)), meta)]])
                tt.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 6)]))
                story.append(tt)
            if _step_has_image(step) and idx - 1 in step_images:
                raw_i, _mti = step_images[idx - 1]
                try:
                    bio_i = BytesIO(raw_i)
                    img_i = RLImage(bio_i, width=5.2 * inch, height=3.2 * inch, kind="proportional")
                    story.append(Spacer(1, 0.06 * inch))
                    story.append(img_i)
                except Exception:  # noqa: BLE001
                    story.append(Paragraph("[Illustration omitted — image could not be embedded]", meta))
            story.append(Spacer(1, 0.1 * inch))

    gen_iso = _fmt_dt_utc(generated_at)

    def _footer(c: pdf_canvas.Canvas, doc: SimpleDocTemplate) -> None:
        c.saveState()
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#555555"))
        w, _h = letter
        line = (
            f"Archive reference: {archive_snapshot_id}  |  PDF generated (UTC): {gen_iso}  |  Page {c.getPageNumber()}"
        )
        c.drawCentredString(w / 2.0, 0.45 * inch, line)
        c.restoreState()

    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.72 * inch,
        rightMargin=0.72 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.72 * inch,
        title=f"Acknowledgment {archive_snapshot_id}",
        author=company_display_name[:120] if company_display_name else "Pulse",
    )
    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    out = buf.getvalue()
    buf.close()
    return out


async def generate_and_store_procedure_acknowledgment_pdf(snapshot_id: str, company_id: str) -> None:
    """Load snapshot + context, render PDF to durable storage, update row. Swallows errors into pdf_generation_error."""
    from app.core.database import AsyncSessionLocal
    from app.core.pulse_storage import read_company_logo_bytes, read_procedure_step_image_bytes, write_procedure_acknowledgment_pdf_bytes
    from app.models.domain import Company
    from app.models.pulse_models import PulseProcedureAcknowledgmentSnapshot, PulseProcedureTrainingAcknowledgement

    async with AsyncSessionLocal() as db:
        snap = await db.get(PulseProcedureAcknowledgmentSnapshot, snapshot_id)
        if snap is None:
            return
        ack = await db.get(PulseProcedureTrainingAcknowledgement, snap.acknowledgment_id)
        if ack is None or str(ack.company_id) != str(company_id):
            return
        company = await db.get(Company, company_id)
        company_name = (company.name or "").strip() or "Organization"
        logo = await read_company_logo_bytes(company_id)

        steps = snap.procedure_content_snapshot if isinstance(snap.procedure_content_snapshot, list) else []
        step_images: dict[int, tuple[bytes, str]] = {}
        proc_uuid = str(snap.procedure_id)
        for i, step in enumerate(steps):
            if _step_has_image(step):
                blob = await read_procedure_step_image_bytes(company_id, proc_uuid, i)
                if blob:
                    step_images[i] = blob

        gen_at = datetime.now(timezone.utc)
        try:
            pdf_bytes = build_procedure_acknowledgment_pdf_bytes(
                company_display_name=company_name,
                company_logo=logo,
                archive_snapshot_id=str(snap.id),
                procedure_id_display=str(snap.procedure_id),
                procedure_version=int(snap.procedure_version or 1),
                procedure_semantic_version=snap.procedure_semantic_version,
                procedure_title=str(snap.procedure_title or "").strip() or "—",
                procedure_category=snap.procedure_category,
                procedure_revision_date=snap.procedure_revision_date,
                procedure_revision_summary=snap.procedure_revision_summary,
                procedure_steps_snapshot=steps,
                step_images=step_images,
                acknowledgment_statement=str(snap.acknowledgment_statement_text or "").strip()
                or "—",
                acknowledged_at=snap.acknowledged_at,
                worker_full_name=snap.worker_full_name,
                worker_job_title=snap.worker_job_title,
                worker_operational_role=snap.worker_operational_role,
                generated_at=gen_at,
            )
            rel = await write_procedure_acknowledgment_pdf_bytes(company_id, str(snap.id), pdf_bytes)
            snap.generated_pdf_url = rel
            snap.pdf_generated_at = gen_at
            snap.pdf_generation_error = None
            await db.commit()
        except Exception as e:  # noqa: BLE001
            logger.exception("Procedure acknowledgment PDF generation failed snapshot_id=%s", snapshot_id)
            err = str(e).strip() or type(e).__name__
            snap.pdf_generation_error = err[:2000]
            snap.generated_pdf_url = None
            snap.pdf_generated_at = None
            await db.commit()
