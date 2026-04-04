"""Pydantic models for `/api/blueprints`."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class BlueprintElementBase(BaseModel):
    type: Literal["zone", "device"]
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: float = 0.0
    name: Optional[str] = None
    linked_device_id: Optional[str] = None
    assigned_zone_id: Optional[str] = None
    device_kind: Optional[str] = Field(None, description="pump | tank | sensor | generic")


class BlueprintElementIn(BlueprintElementBase):
    id: Optional[str] = None


class BlueprintElementOut(BlueprintElementBase):
    id: str


class BlueprintSummaryOut(BaseModel):
    id: str
    name: str
    created_at: datetime


class BlueprintDetailOut(BlueprintSummaryOut):
    updated_at: datetime
    elements: list[BlueprintElementOut]


class BlueprintCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    elements: list[BlueprintElementIn] = []

    @field_validator("elements")
    @classmethod
    def max_elements(cls, v: list) -> list:
        if len(v) > 2000:
            raise ValueError("Too many elements (max 2000)")
        return v


class BlueprintUpdateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    elements: list[BlueprintElementIn] = []

    @field_validator("elements")
    @classmethod
    def max_elements(cls, v: list) -> list:
        if len(v) > 2000:
            raise ValueError("Too many elements (max 2000)")
        return v


def element_in_to_orm_kwargs(el: BlueprintElementIn, *, blueprint_id: str) -> dict:
    if el.type == "zone":
        if el.width is None or el.height is None or el.width < 1 or el.height < 1:
            raise ValueError("Zone requires positive width and height")
        w, h = el.width, el.height
    else:
        w = el.width if el.width is not None else 44.0
        h = el.height if el.height is not None else 44.0
    eid = str(uuid4()) if not el.id else el.id
    if el.id:
        try:
            UUID(el.id)
        except ValueError as e:
            raise ValueError("Invalid element id (expected UUID)") from e
    return {
        "id": eid,
        "blueprint_id": blueprint_id,
        "element_type": el.type,
        "x": el.x,
        "y": el.y,
        "width": w,
        "height": h,
        "rotation": el.rotation,
        "name": el.name,
        "linked_device_id": el.linked_device_id,
        "assigned_zone_id": el.assigned_zone_id,
        "device_kind": el.device_kind,
    }


def row_to_element_out(row) -> BlueprintElementOut:
    return BlueprintElementOut(
        id=row.id,
        type=row.element_type,  # type: ignore[arg-type]
        x=row.x,
        y=row.y,
        width=row.width,
        height=row.height,
        rotation=row.rotation,
        name=row.name,
        linked_device_id=row.linked_device_id,
        assigned_zone_id=row.assigned_zone_id,
        device_kind=row.device_kind,
    )
