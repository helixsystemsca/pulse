"""Financial & Asset Planning HTTP API."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_any_rbac, require_tenant_user
from app.models.domain import User
from app.services import finance_service as svc

router = APIRouter(prefix="/finance", tags=["finance-asset-planning"])

Db = Annotated[AsyncSession, Depends(get_db)]
CompanyId = Annotated[str, Depends(lambda u=Depends(require_tenant_user): str(u.company_id))]
Actor = Annotated[User, Depends(require_tenant_user)]
Reader = Annotated[User, Depends(require_any_rbac("finance_asset_planning.view", "finance_asset_planning.manage"))]
Editor = Annotated[User, Depends(require_any_rbac("finance_asset_planning.manage"))]


class LooseIn(BaseModel):
    model_config = ConfigDict(extra="allow")


class AssistantIn(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


@router.get("/dashboard")
async def get_dashboard(db: Db, cid: CompanyId, user: Reader) -> dict[str, Any]:
    return await svc.dashboard(db, cid, actor_id=str(user.id))


@router.get("/operating/{view}")
async def get_operating(view: str, db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.operating_detail(db, cid, view)


@router.get("/capital/{view}")
async def get_capital(view: str, db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.capital_detail(db, cid, view)


@router.get("/lifecycle/replacement")
async def get_replacement(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    fy = await svc.ensure_defaults(db, cid)
    assume = await svc._assumptions(db, cid, fy)
    return await svc.replacement_forecast(db, cid, fy, assume)


@router.get("/lifecycle/service")
async def get_service(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    fy = await svc.ensure_defaults(db, cid)
    return await svc.service_forecast(db, cid, fy)


@router.get("/lifecycle/cost")
async def get_lifecycle_cost(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    fy = await svc.ensure_defaults(db, cid)
    assume = await svc._assumptions(db, cid, fy)
    data = await svc.replacement_forecast(db, cid, fy, assume)
    return {"items": data["items"], "why": "Lifecycle cost to date = acquisition + maintenance recorded on the asset financial profile. Annualized maintenance divides that history by age."}


@router.get("/planner/current")
async def get_current_planner(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.operating_detail(db, cid, "variance")


@router.get("/planner/next-year")
async def get_next_year(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.next_year_builder(db, cid)


@router.get("/planner/long-range")
async def get_long_range(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.long_range(db, cid)


@router.get("/scenarios/compare")
async def get_compare(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.compare_scenarios(db, cid)


@router.get("/deferred/register")
async def get_deferred_register(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.deferred_register(db, cid)


@router.get("/opportunities")
async def get_opportunities(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.opportunities(db, cid)


@router.get("/alerts")
async def get_alerts(db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    snap = await svc.dashboard(db, cid)
    return {"items": snap["alerts"]}


@router.get("/glossary")
async def get_glossary(_: Reader) -> dict[str, Any]:
    from app.core.finance_calc import glossary_payload, origin_legend

    return {"glossary": glossary_payload(), "origins": origin_legend()}


@router.get("/reports.csv")
async def get_reports_csv(db: Db, cid: CompanyId, _: Reader) -> Response:
    body = await svc.reports_csv(db, cid)
    return Response(content=body, media_type="text/csv")


@router.post("/assistant/ask")
async def post_assistant(body: AssistantIn, db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    return await svc.assistant_ask(db, cid, body.query)


@router.post("/justifications/generate")
async def post_justification(body: LooseIn, db: Db, cid: CompanyId, user: Editor) -> dict[str, Any]:
    return await svc.generate_justification(db, cid, body.model_dump(), actor_id=str(user.id))


@router.get("/{entity}")
async def list_records(entity: str, db: Db, cid: CompanyId, _: Reader) -> dict[str, Any]:
    items = await svc.list_entity(db, cid, entity)
    return {"items": items}


@router.post("/{entity}")
async def create_record(entity: str, body: LooseIn, db: Db, cid: CompanyId, user: Editor) -> dict[str, Any]:
    return await svc.create_entity(db, cid, entity, body.model_dump(exclude_unset=True), actor_id=str(user.id))


@router.patch("/{entity}/{item_id}")
async def patch_record(entity: str, item_id: str, body: LooseIn, db: Db, cid: CompanyId, user: Editor) -> dict[str, Any]:
    return await svc.patch_entity(db, cid, entity, item_id, body.model_dump(exclude_unset=True), actor_id=str(user.id))


@router.delete("/{entity}/{item_id}", status_code=204)
async def delete_record(entity: str, item_id: str, db: Db, cid: CompanyId, _: Editor) -> Response:
    await svc.delete_entity(db, cid, entity, item_id)
    return Response(status_code=204)
