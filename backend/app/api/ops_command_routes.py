"""Phase 1 personal command center API."""

from __future__ import annotations

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_any_rbac, require_tenant_user
from app.models.domain import User
from app.schemas.ops_command import (
    OpsAuthorityRowCreateIn,
    OpsAuthorityRowOut,
    OpsAuthorityRowPatchIn,
    OpsChecklistInstanceOut,
    OpsChecklistItemOut,
    OpsChecklistItemPatchIn,
    OpsChecklistStartIn,
    OpsChecklistTemplateOut,
    OpsCommandDashboardOut,
    OpsDevelopmentPlanCreateIn,
    OpsDevelopmentPlanOut,
    OpsDevelopmentPlanPatchIn,
    OpsIntelligenceOut,
    OpsKnowledgeGapCreateIn,
    OpsKnowledgeGapOut,
    OpsKnowledgeGapPatchIn,
    OpsOrgNodeOut,
    OpsPersonalProfileOut,
    OpsPersonalProfilePatchIn,
    OpsRoleResponsibilityCreateIn,
    OpsRoleResponsibilityOut,
    OpsRoleResponsibilityPatchIn,
    OpsSkillCreateIn,
    OpsSkillOut,
    OpsSkillPatchIn,
    OpsSkillRatingOut,
    OpsSkillRatingUpsertIn,
    OpsTeamRiskCreateIn,
    OpsTeamRiskOut,
    OpsTeamRiskPatchIn,
)
from app.services import ops_command_service as svc
from app.services import ops_intelligence_service as intel_svc
from app.services import ops_org_service as org_svc
from app.services import ops_reports_service as reports_svc
from pydantic import BaseModel, Field

router = APIRouter(prefix="/recreation-ops/command", tags=["recreation-ops-command"])

Db = Annotated[AsyncSession, Depends(get_db)]
CompanyId = Annotated[str, Depends(lambda u=Depends(require_tenant_user): str(u.company_id))]
Actor = Annotated[User, Depends(require_tenant_user)]
Reader = Annotated[User, Depends(require_any_rbac("recreation_ops.view", "recreation_ops.manage"))]
Editor = Annotated[User, Depends(require_any_rbac("recreation_ops.manage"))]


# —— Dashboard ——
@router.get("/dashboard", response_model=OpsCommandDashboardOut)
async def get_dashboard(db: Db, cid: CompanyId, actor: Actor, _: Reader) -> OpsCommandDashboardOut:
    data = await svc.dashboard_summary(db, cid, str(actor.id))
    org = await org_svc.org_attention_counts(db, cid)
    data.update(org)
    intel = await intel_svc.gather_intelligence(db, cid)
    totals = intel.get("totals") or {}
    data.update(
        {
            "assets_needing_attention": totals.get("assets_needing_attention", 0),
            "inventory_low_stock": totals.get("inventory_low_stock", 0),
            "training_overdue": totals.get("training_overdue", 0),
            "compliance_missed": totals.get("compliance_missed", 0),
            "critical_procedures": totals.get("critical_procedures", 0),
            "emergency_readiness_gaps": totals.get("emergency_readiness_gaps", 0),
            "active_projects": totals.get("active_projects", 0),
            "overdue_project_tasks": totals.get("overdue_project_tasks", 0),
            "roadmap_behind": totals.get("roadmap_behind", 0),
            "pm_coord_risks": totals.get("pm_coord_risks", 0),
            "overdue_work_requests": totals.get("overdue_work_requests", 0),
            "roadmap_with_budget": totals.get("roadmap_with_budget", 0),
            "certs_expired": totals.get("certs_expired", 0),
            "certs_expiring_30": totals.get("certs_expiring_30", 0),
            "certs_expiring_90": totals.get("certs_expiring_90", 0),
            "contractor_attention": totals.get("contractor_attention", 0),
            "intelligence_items": intel.get("attention_items") or [],
        }
    )
    return OpsCommandDashboardOut.model_validate(data)


@router.get("/intelligence", response_model=OpsIntelligenceOut)
async def get_intelligence(db: Db, cid: CompanyId, _: Reader) -> OpsIntelligenceOut:
    data = await intel_svc.gather_intelligence(db, cid)
    return OpsIntelligenceOut.model_validate(data)


@router.get("/certification-expiry")
async def certification_expiry(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    from app.services.certification_expiry_service import certification_expiry_summary

    return await certification_expiry_summary(db, cid)


@router.get("/copilot/prompts")
async def list_copilot_prompts(_: Reader) -> dict[str, Any]:
    from app.services.ops_copilot_service import PROMPT_LIBRARY

    return {"items": PROMPT_LIBRARY}


class OpsCopilotAskIn(BaseModel):
    prompt_id: str = Field(..., min_length=1, max_length=64)


@router.post("/copilot/ask")
async def ask_copilot(body: OpsCopilotAskIn, db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    from app.services.ops_copilot_service import answer_prompt

    try:
        return await answer_prompt(db, cid, body.prompt_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class OpsBinderExportIn(BaseModel):
    sections: list[str] = Field(default_factory=list)


@router.get("/reports/catalog")
async def reports_catalog(_: Reader) -> dict[str, Any]:
    return {
        "binder_sections": list(reports_svc.BINDER_SECTIONS),
        "standalone_types": list(reports_svc.STANDALONE_TYPES),
    }


@router.post("/reports/binder.pdf")
async def export_binder_pdf(
    body: OpsBinderExportIn,
    db: Db,
    cid: CompanyId,
    actor: Actor,
    _: Reader,
) -> Response:
    try:
        pdf = await reports_svc.build_binder_pdf(
            db,
            cid,
            str(actor.id),
            sections=body.sections or None,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Binder PDF failed: {exc}") from exc
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="recreation-ops-binder.pdf"'},
    )


@router.get("/reports/{report_type}.pdf")
async def export_standalone_pdf(
    report_type: str,
    db: Db,
    cid: CompanyId,
    actor: Actor,
    _: Reader,
    entity_id: Optional[str] = Query(None),
) -> Response:
    try:
        pdf = await reports_svc.build_standalone_pdf(
            db,
            cid,
            str(actor.id),
            report_type=report_type,
            entity_id=entity_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report PDF failed: {exc}") from exc
    filename = f"recreation-ops-{report_type}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# —— Org chart ——
@router.get("/org-chart", response_model=list[OpsOrgNodeOut])
async def get_org_chart(db: Db, cid: CompanyId, _: Reader) -> list[OpsOrgNodeOut]:
    roots = await org_svc.org_chart(db, cid)
    return [OpsOrgNodeOut.model_validate(r) for r in roots]


# —— Skills ——
@router.get("/skills", response_model=list[OpsSkillOut])
async def list_skills(db: Db, cid: CompanyId, _: Reader) -> list[OpsSkillOut]:
    rows = await org_svc.list_skills(db, cid)
    return [OpsSkillOut.model_validate(r) for r in rows]


@router.post("/skills", response_model=OpsSkillOut, status_code=status.HTTP_201_CREATED)
async def create_skill(body: OpsSkillCreateIn, db: Db, cid: CompanyId, _: Editor) -> OpsSkillOut:
    row = await org_svc.create_skill(db, cid, body.model_dump())
    return OpsSkillOut.model_validate(row)


@router.patch("/skills/{skill_id}", response_model=OpsSkillOut)
async def patch_skill(
    skill_id: str, body: OpsSkillPatchIn, db: Db, cid: CompanyId, _: Editor
) -> OpsSkillOut:
    row = await org_svc.patch_skill(db, cid, skill_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Skill not found")
    return OpsSkillOut.model_validate(row)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(skill_id: str, db: Db, cid: CompanyId, _: Editor) -> None:
    if not await org_svc.delete_skill(db, cid, skill_id):
        raise HTTPException(status_code=404, detail="Skill not found")


@router.get("/skill-ratings", response_model=list[OpsSkillRatingOut])
async def list_skill_ratings(db: Db, cid: CompanyId, _: Reader) -> list[OpsSkillRatingOut]:
    rows = await org_svc.list_ratings(db, cid)
    return [OpsSkillRatingOut.model_validate(r) for r in rows]


@router.post("/skill-ratings", response_model=OpsSkillRatingOut, status_code=status.HTTP_201_CREATED)
async def upsert_skill_rating(
    body: OpsSkillRatingUpsertIn, db: Db, cid: CompanyId, _: Editor
) -> OpsSkillRatingOut:
    row = await org_svc.upsert_rating(db, cid, body.model_dump())
    ratings = await org_svc.list_ratings(db, cid)
    match = next((r for r in ratings if r["id"] == str(row.id)), None)
    if match:
        return OpsSkillRatingOut.model_validate(match)
    return OpsSkillRatingOut.model_validate(row)


@router.delete("/skill-ratings/{rating_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill_rating(rating_id: str, db: Db, cid: CompanyId, _: Editor) -> None:
    if not await org_svc.delete_rating(db, cid, rating_id):
        raise HTTPException(status_code=404, detail="Rating not found")


# —— Development plans ——
@router.get("/development-plans", response_model=list[OpsDevelopmentPlanOut])
async def list_development_plans(db: Db, cid: CompanyId, _: Reader) -> list[OpsDevelopmentPlanOut]:
    rows = await org_svc.list_plans(db, cid)
    return [OpsDevelopmentPlanOut.model_validate(r) for r in rows]


@router.post("/development-plans", response_model=OpsDevelopmentPlanOut, status_code=status.HTTP_201_CREATED)
async def create_development_plan(
    body: OpsDevelopmentPlanCreateIn, db: Db, cid: CompanyId, _: Editor
) -> OpsDevelopmentPlanOut:
    row = await org_svc.create_plan(db, cid, body.model_dump())
    plans = await org_svc.list_plans(db, cid)
    match = next((r for r in plans if r["id"] == str(row.id)), None)
    return OpsDevelopmentPlanOut.model_validate(match or row)


@router.patch("/development-plans/{plan_id}", response_model=OpsDevelopmentPlanOut)
async def patch_development_plan(
    plan_id: str, body: OpsDevelopmentPlanPatchIn, db: Db, cid: CompanyId, _: Editor
) -> OpsDevelopmentPlanOut:
    row = await org_svc.patch_plan(db, cid, plan_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    plans = await org_svc.list_plans(db, cid)
    match = next((r for r in plans if r["id"] == str(row.id)), None)
    return OpsDevelopmentPlanOut.model_validate(match or row)


@router.delete("/development-plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_development_plan(plan_id: str, db: Db, cid: CompanyId, _: Editor) -> None:
    if not await org_svc.delete_plan(db, cid, plan_id):
        raise HTTPException(status_code=404, detail="Plan not found")


# —— Team risks ——
@router.get("/team-risks", response_model=list[OpsTeamRiskOut])
async def list_team_risks(db: Db, cid: CompanyId, _: Reader) -> list[OpsTeamRiskOut]:
    rows = await org_svc.list_risks(db, cid)
    return [OpsTeamRiskOut.model_validate(r) for r in rows]


@router.post("/team-risks", response_model=OpsTeamRiskOut, status_code=status.HTTP_201_CREATED)
async def create_team_risk(body: OpsTeamRiskCreateIn, db: Db, cid: CompanyId, _: Editor) -> OpsTeamRiskOut:
    row = await org_svc.create_risk(db, cid, body.model_dump())
    risks = await org_svc.list_risks(db, cid)
    match = next((r for r in risks if r["id"] == str(row.id)), None)
    return OpsTeamRiskOut.model_validate(match or row)


@router.patch("/team-risks/{risk_id}", response_model=OpsTeamRiskOut)
async def patch_team_risk(
    risk_id: str, body: OpsTeamRiskPatchIn, db: Db, cid: CompanyId, _: Editor
) -> OpsTeamRiskOut:
    row = await org_svc.patch_risk(db, cid, risk_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Risk not found")
    risks = await org_svc.list_risks(db, cid)
    match = next((r for r in risks if r["id"] == str(row.id)), None)
    return OpsTeamRiskOut.model_validate(match or row)


@router.delete("/team-risks/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team_risk(risk_id: str, db: Db, cid: CompanyId, _: Editor) -> None:
    if not await org_svc.delete_risk(db, cid, risk_id):
        raise HTTPException(status_code=404, detail="Risk not found")


# —— Profile ——
@router.get("/profile", response_model=OpsPersonalProfileOut)
async def get_profile(db: Db, cid: CompanyId, actor: Actor, _: Reader) -> OpsPersonalProfileOut:
    row = await svc.get_or_create_profile(db, cid, str(actor.id))
    return OpsPersonalProfileOut.model_validate(row)


@router.patch("/profile", response_model=OpsPersonalProfileOut)
async def patch_profile(
    body: OpsPersonalProfilePatchIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsPersonalProfileOut:
    row = await svc.patch_profile(db, cid, str(actor.id), body.model_dump(exclude_unset=True))
    return OpsPersonalProfileOut.model_validate(row)


# —— Responsibilities ——
@router.get("/responsibilities", response_model=list[OpsRoleResponsibilityOut])
async def list_responsibilities(
    db: Db, cid: CompanyId, actor: Actor, _: Reader
) -> list[OpsRoleResponsibilityOut]:
    rows = await svc.list_responsibilities(db, cid, str(actor.id))
    return [OpsRoleResponsibilityOut.model_validate(r) for r in rows]


@router.post("/responsibilities", response_model=OpsRoleResponsibilityOut, status_code=status.HTTP_201_CREATED)
async def create_responsibility(
    body: OpsRoleResponsibilityCreateIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsRoleResponsibilityOut:
    row = await svc.create_responsibility(db, cid, str(actor.id), body.model_dump())
    return OpsRoleResponsibilityOut.model_validate(row)


@router.patch("/responsibilities/{row_id}", response_model=OpsRoleResponsibilityOut)
async def patch_responsibility(
    row_id: str, body: OpsRoleResponsibilityPatchIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsRoleResponsibilityOut:
    row = await svc.patch_responsibility(db, cid, str(actor.id), row_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Responsibility not found")
    return OpsRoleResponsibilityOut.model_validate(row)


@router.delete("/responsibilities/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_responsibility(row_id: str, db: Db, cid: CompanyId, actor: Actor, _: Editor) -> None:
    if not await svc.delete_responsibility(db, cid, str(actor.id), row_id):
        raise HTTPException(status_code=404, detail="Responsibility not found")


# —— Authority ——
@router.get("/authority", response_model=list[OpsAuthorityRowOut])
async def list_authority(db: Db, cid: CompanyId, actor: Actor, _: Reader) -> list[OpsAuthorityRowOut]:
    rows = await svc.list_authority(db, cid, str(actor.id))
    return [OpsAuthorityRowOut.model_validate(r) for r in rows]


@router.post("/authority", response_model=OpsAuthorityRowOut, status_code=status.HTTP_201_CREATED)
async def create_authority(
    body: OpsAuthorityRowCreateIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsAuthorityRowOut:
    row = await svc.create_authority(db, cid, str(actor.id), body.model_dump())
    return OpsAuthorityRowOut.model_validate(row)


@router.patch("/authority/{row_id}", response_model=OpsAuthorityRowOut)
async def patch_authority(
    row_id: str, body: OpsAuthorityRowPatchIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsAuthorityRowOut:
    row = await svc.patch_authority(db, cid, str(actor.id), row_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Authority row not found")
    return OpsAuthorityRowOut.model_validate(row)


@router.delete("/authority/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_authority(row_id: str, db: Db, cid: CompanyId, actor: Actor, _: Editor) -> None:
    if not await svc.delete_authority(db, cid, str(actor.id), row_id):
        raise HTTPException(status_code=404, detail="Authority row not found")


# —— Checklists ——
@router.get("/checklist-templates", response_model=list[OpsChecklistTemplateOut])
async def list_templates(db: Db, cid: CompanyId, _: Reader) -> list[OpsChecklistTemplateOut]:
    rows = await svc.list_templates(db, cid)
    return [OpsChecklistTemplateOut.model_validate(r) for r in rows]


@router.get("/checklists", response_model=list[OpsChecklistInstanceOut])
async def list_checklists(db: Db, cid: CompanyId, actor: Actor, _: Reader) -> list[OpsChecklistInstanceOut]:
    rows = await svc.list_instances(db, cid, str(actor.id))
    return [OpsChecklistInstanceOut.model_validate(svc.serialize_instance(r)) for r in rows]


@router.get("/checklists/{instance_id}", response_model=OpsChecklistInstanceOut)
async def get_checklist(
    instance_id: str, db: Db, cid: CompanyId, actor: Actor, _: Reader
) -> OpsChecklistInstanceOut:
    row = await svc.get_instance(db, cid, str(actor.id), instance_id)
    if not row:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return OpsChecklistInstanceOut.model_validate(svc.serialize_instance(row))


@router.post("/checklists", response_model=OpsChecklistInstanceOut, status_code=status.HTTP_201_CREATED)
async def start_checklist(
    body: OpsChecklistStartIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsChecklistInstanceOut:
    try:
        row = await svc.start_checklist(
            db,
            cid,
            str(actor.id),
            template_slug=body.template_slug,
            template_id=body.template_id,
            title=body.title,
            due_date=body.due_date,
            priority=body.priority,
            facility_id=body.facility_id,
            season_year=body.season_year,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OpsChecklistInstanceOut.model_validate(svc.serialize_instance(row))


@router.patch("/checklist-items/{item_id}", response_model=OpsChecklistItemOut)
async def patch_checklist_item(
    item_id: str, body: OpsChecklistItemPatchIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsChecklistItemOut:
    row = await svc.patch_checklist_item(db, cid, str(actor.id), item_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return OpsChecklistItemOut.model_validate(row)


@router.delete("/checklists/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist(instance_id: str, db: Db, cid: CompanyId, actor: Actor, _: Editor) -> None:
    if not await svc.delete_instance(db, cid, str(actor.id), instance_id):
        raise HTTPException(status_code=404, detail="Checklist not found")


# —— Knowledge gaps ——
@router.get("/knowledge-gaps", response_model=list[OpsKnowledgeGapOut])
async def list_gaps(
    db: Db,
    cid: CompanyId,
    actor: Actor,
    _: Reader,
    status_filter: Optional[str] = Query(None, alias="status", max_length=32),
    q: Optional[str] = Query(None, max_length=200),
) -> list[OpsKnowledgeGapOut]:
    rows = await svc.list_gaps(db, cid, str(actor.id), status=status_filter, q=q)
    return [OpsKnowledgeGapOut.model_validate(r) for r in rows]


@router.post("/knowledge-gaps", response_model=OpsKnowledgeGapOut, status_code=status.HTTP_201_CREATED)
async def create_gap(
    body: OpsKnowledgeGapCreateIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsKnowledgeGapOut:
    row = await svc.create_gap(db, cid, str(actor.id), body.model_dump())
    return OpsKnowledgeGapOut.model_validate(row)


@router.patch("/knowledge-gaps/{gap_id}", response_model=OpsKnowledgeGapOut)
async def patch_gap(
    gap_id: str, body: OpsKnowledgeGapPatchIn, db: Db, cid: CompanyId, actor: Actor, _: Editor
) -> OpsKnowledgeGapOut:
    row = await svc.patch_gap(db, cid, str(actor.id), gap_id, body.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=404, detail="Knowledge gap not found")
    return OpsKnowledgeGapOut.model_validate(row)


@router.delete("/knowledge-gaps/{gap_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gap(gap_id: str, db: Db, cid: CompanyId, actor: Actor, _: Editor) -> None:
    if not await svc.delete_gap(db, cid, str(actor.id), gap_id):
        raise HTTPException(status_code=404, detail="Knowledge gap not found")
