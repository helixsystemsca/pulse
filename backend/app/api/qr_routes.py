"""QR resource management and public resolution API."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_any_rbac
from app.core.tenant_context import resolve_tenant_company_id
from app.limiter import limiter
from app.models.domain import User
from app.schemas.qr_resources import (
    QrResolveOut,
    QrResourceCreateIn,
    QrResourceListOut,
    QrResourceOptionsOut,
    QrResourceOut,
    QrResourcePatchIn,
)
from app.services import qr_resource_service as qr_svc

router = APIRouter(prefix="/qr", tags=["qr-resources"])

Db = Annotated[AsyncSession, Depends(get_db)]
QrViewUser = Annotated[User, Depends(require_any_rbac("qr_codes.view", "qr_codes.manage"))]
QrManageUser = Annotated[User, Depends(require_any_rbac("qr_codes.manage"))]


async def _resolve_qr_company_id(
    user: Annotated[User, Depends(get_current_user)],
    company_id: Optional[str] = Query(None, description="Required for system administrators"),
) -> str:
    return resolve_tenant_company_id(user, company_id, path="/api/qr")


CompanyId = Annotated[str, Depends(_resolve_qr_company_id)]


@router.get("/resource-types")
async def list_qr_resource_types(_: QrViewUser) -> dict:
    return {"items": qr_svc.resource_type_catalog()}


@router.get("/resources", response_model=QrResourceListOut)
async def list_qr_resources(
    db: Db,
    _: QrViewUser,
    cid: CompanyId,
    q: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
) -> QrResourceListOut:
    items = await qr_svc.list_qr_resources(db, cid, q=q, resource_type=resource_type)
    return QrResourceListOut(items=[QrResourceOut.model_validate(i) for i in items])


@router.get("/resources/options", response_model=QrResourceOptionsOut)
async def list_qr_resource_options(
    db: Db,
    _: QrViewUser,
    cid: CompanyId,
    resource_type: str = Query(...),
    q: Optional[str] = Query(None),
) -> QrResourceOptionsOut:
    items = await qr_svc.list_resource_options(db, cid, resource_type, q=q)
    from app.schemas.qr_resources import QrResourceOptionOut

    return QrResourceOptionsOut(
        resource_type=resource_type,
        items=[QrResourceOptionOut.model_validate(i) for i in items],
    )


@router.get("/resources/{qr_id}", response_model=QrResourceOut)
async def get_qr_resource(
    db: Db,
    _: QrViewUser,
    cid: CompanyId,
    qr_id: str,
) -> QrResourceOut:
    row = await qr_svc.get_qr_resource(db, cid, qr_id)
    return QrResourceOut.model_validate(row)


@router.post("/resources", response_model=QrResourceOut)
async def create_qr_resource(
    db: Db,
    user: QrManageUser,
    cid: CompanyId,
    body: QrResourceCreateIn,
) -> QrResourceOut:
    row = await qr_svc.create_qr_resource(
        db,
        cid,
        user.id,
        name=body.name,
        description=body.description,
        resource_type=body.resource_type,
        resource_id=body.resource_id,
        guest_access_enabled=body.guest_access_enabled,
        guest_access_level=body.guest_access_level,
    )
    await db.commit()
    return QrResourceOut.model_validate(row)


@router.patch("/resources/{qr_id}", response_model=QrResourceOut)
async def patch_qr_resource(
    db: Db,
    _: QrManageUser,
    cid: CompanyId,
    qr_id: str,
    body: QrResourcePatchIn,
) -> QrResourceOut:
    row = await qr_svc.patch_qr_resource(
        db,
        cid,
        qr_id,
        name=body.name,
        description=body.description,
        resource_type=body.resource_type,
        resource_id=body.resource_id,
        guest_access_enabled=body.guest_access_enabled,
        guest_access_level=body.guest_access_level,
    )
    await db.commit()
    return QrResourceOut.model_validate(row)


@router.delete("/resources/{qr_id}", status_code=204)
async def delete_qr_resource(
    db: Db,
    _: QrManageUser,
    cid: CompanyId,
    qr_id: str,
) -> None:
    await qr_svc.delete_qr_resource(db, cid, qr_id)
    await db.commit()


@router.post("/resources/{qr_id}/regenerate-token", response_model=QrResourceOut)
async def regenerate_qr_token(
    db: Db,
    _: QrManageUser,
    cid: CompanyId,
    qr_id: str,
) -> QrResourceOut:
    row = await qr_svc.regenerate_qr_token(db, cid, qr_id)
    await db.commit()
    return QrResourceOut.model_validate(row)


@router.get("/resolve/{token}", response_model=QrResolveOut)
async def resolve_qr_token_authenticated(
    db: Db,
    user: Annotated[User, Depends(get_current_user)],
    token: str,
    guest: bool = Query(False),
) -> QrResolveOut:
    row = await qr_svc.get_qr_resource_by_token(db, token)
    if not user.is_system_admin and user.company_id and str(user.company_id) != str(row.company_id):
        raise HTTPException(status_code=403, detail="QR resource belongs to another organization")
    payload = await qr_svc.resolve_qr_token(db, token, authenticated=True, guest_mode=guest)
    return QrResolveOut.model_validate(payload)


public_router = APIRouter(tags=["public-qr"])


@public_router.get("/qr/resolve/{token}", response_model=QrResolveOut)
@limiter.limit("60/minute")
async def resolve_qr_token_public(
    request: Request,
    db: Db,
    token: str,
    guest: bool = Query(False),
) -> QrResolveOut:
    payload = await qr_svc.resolve_qr_token(db, token, authenticated=False, guest_mode=guest)
    return QrResolveOut.model_validate(payload)
