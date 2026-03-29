from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domain import Asset
from app.schemas.asset import AssetCreate, AssetUpdate


async def list_assets(db: AsyncSession, company_id: str, q: str | None) -> list[Asset]:
    stmt = select(Asset).where(Asset.company_id == company_id).order_by(Asset.name)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Asset.name.ilike(like)) | (Asset.external_id.ilike(like)) | (Asset.location.ilike(like)))
    result = await db.execute(stmt)
    return list(result.scalars())


async def create_asset(db: AsyncSession, company_id: str, created_by_user_id: str | None, data: AssetCreate) -> Asset:
    existing = await db.execute(
        select(Asset).where(Asset.company_id == company_id, Asset.external_id == data.external_id)
    )
    if existing.scalar_one_or_none():
        raise ValueError("Asset external_id already exists")
    asset = Asset(
        company_id=company_id,
        external_id=data.external_id,
        name=data.name,
        asset_type=data.asset_type,
        location=data.location,
        created_by_user_id=created_by_user_id,
    )
    db.add(asset)
    await db.flush()
    await db.refresh(asset)
    return asset


async def get_asset(db: AsyncSession, company_id: str, asset_id: str) -> Asset | None:
    result = await db.execute(select(Asset).where(Asset.company_id == company_id, Asset.id == asset_id))
    return result.scalar_one_or_none()


async def update_asset(db: AsyncSession, asset: Asset, data: AssetUpdate) -> Asset:
    if data.name is not None:
        asset.name = data.name
    if data.asset_type is not None:
        asset.asset_type = data.asset_type
    if data.location is not None:
        asset.location = data.location
    await db.flush()
    await db.refresh(asset)
    return asset
