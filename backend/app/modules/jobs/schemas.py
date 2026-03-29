from typing import Optional

from pydantic import BaseModel, Field

from app.models.domain import JobStatus


class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    worker_id: Optional[str] = None
    status: JobStatus = JobStatus.draft


class JobLinkTool(BaseModel):
    tool_id: str = Field(..., min_length=1, max_length=64)


class JobLinkInventory(BaseModel):
    inventory_item_id: str = Field(..., min_length=1, max_length=64)
    quantity_allocated: float = Field(..., ge=0)


class JobActivityHint(BaseModel):
    """Passive signal that a job is active (e.g. beacon at job site)."""

    hint: str = Field(..., min_length=1, max_length=255)
