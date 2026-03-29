from pydantic import BaseModel, Field


class InventoryItemCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    quantity: float = Field(0, ge=0)
    unit: str = Field("count", max_length=32)
    low_stock_threshold: float = Field(0, ge=0)


class StockAdjust(BaseModel):
    delta: float
    reason: str = Field(..., min_length=1, max_length=255)
