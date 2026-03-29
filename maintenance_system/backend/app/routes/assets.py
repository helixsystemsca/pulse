from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import CurrentUser, ManagerUser
from app.schemas.asset import AssetCreate, AssetOut, AssetUpdate
from app.services.asset_service import create_asset, get_asset, list_assets, update_asset
from app.services.audit import write_audit

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetOut])
async def list_assets_route(
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None),
) -> list[AssetOut]:
    assets = await list_assets(db, current.company_id, q)
    return [AssetOut.model_validate(a) for a in assets]


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset_route(
    data: AssetCreate,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> AssetOut:
    try:
        asset = await create_asset(db, mgr.company_id, mgr.id, data)
        await write_audit(
            db,
            company_id=mgr.company_id,
            actor_user_id=mgr.id,
            action="asset.create",
            entity_type="asset",
            entity_id=asset.id,
            payload={"external_id": asset.external_id, "name": asset.name},
        )
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e)) from e
    return AssetOut.model_validate(asset)


@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset_route(
    asset_id: str,
    current: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> AssetOut:
    a = await get_asset(db, current.company_id, asset_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return AssetOut.model_validate(a)


@router.patch("/{asset_id}", response_model=AssetOut)
async def update_asset_route(
    asset_id: str,
    data: AssetUpdate,
    mgr: ManagerUser,
    db: AsyncSession = Depends(get_db),
) -> AssetOut:
    a = await get_asset(db, mgr.company_id, asset_id)
    if a is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    a = await update_asset(db, a, data)
    await write_audit(
        db,
        company_id=mgr.company_id,
        actor_user_id=mgr.id,
        action="asset.update",
        entity_type="asset",
        entity_id=a.id,
        payload=data.model_dump(exclude_unset=True),
    )
    await db.commit()
    return AssetOut.model_validate(a)
