from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class AssetCreate(BaseModel):
    external_id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=255)
    asset_type: str = Field(default="equipment", max_length=128)
    location: str = Field(default="", max_length=512)


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    asset_type: str | None = Field(default=None, max_length=128)
    location: str | None = Field(default=None, max_length=512)


class AssetOut(ORMModel):
    id: str
    company_id: str
    external_id: str
    name: str
    asset_type: str
    location: str
    created_by_user_id: str | None
    created_at: datetime
