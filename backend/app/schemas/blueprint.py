"""Pydantic models for `/api/blueprints`."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator


class BlueprintElementBase(BaseModel):
    type: Literal["zone", "device", "door", "path", "symbol"]
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: float = 0.0
    name: Optional[str] = None
    linked_device_id: Optional[str] = None
    assigned_zone_id: Optional[str] = None
    device_kind: Optional[str] = Field(None, description="pump | tank | sensor | generic")
    wall_attachment: Optional[str] = Field(
        None,
        description='Door on zone wall: "{zone_element_id}:{edge}:{t}" edge 0–3, t in [0,1]',
    )
    path_points: Optional[list[float]] = Field(None, description="Flat x,y pairs, closed polygon (path type)")
    symbol_type: Optional[str] = Field(
        None,
        description="symbol discriminator, e.g. tree | bush | sprinkler | valve | pump | motor | filter",
        max_length=32,
    )
    symbol_tags: Optional[list[str]] = Field(None, description="Labels for search / maintenance (symbol type)")
    symbol_notes: Optional[str] = Field(None, description="Free-form notes (symbol type)")


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
    path_points_json: Optional[str] = None
    symbol_tags_json: Optional[str] = None
    out_x, out_y = el.x, el.y
    if el.type == "zone":
        if el.width is None or el.height is None or el.width < 1 or el.height < 1:
            raise ValueError("Zone requires positive width and height")
        w, h = el.width, el.height
    elif el.type == "door":
        w = el.width if el.width is not None else 32.0
        h = el.height if el.height is not None else 10.0
    elif el.type == "path":
        pts = el.path_points or []
        if len(pts) < 6 or len(pts) % 2 != 0:
            raise ValueError("path requires path_points with at least 3 vertices (flat x,y list)")
        xs = pts[0::2]
        ys = pts[1::2]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        bx = min_x
        by = min_y
        w = max_x - min_x if max_x > min_x else 1.0
        h = max_y - min_y if max_y > min_y else 1.0
        path_points_json = json.dumps(pts)
        out_x, out_y = bx, by
    elif el.type == "symbol":
        if not el.symbol_type or not str(el.symbol_type).strip():
            raise ValueError("symbol requires symbol_type")
        st = str(el.symbol_type).strip()[:32]
        w = el.width if el.width is not None else 40.0
        h = el.height if el.height is not None else 40.0
        tags = el.symbol_tags or []
        clean_tags = [str(t).strip() for t in tags if str(t).strip()]
        symbol_tags_json = json.dumps(clean_tags) if clean_tags else None
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
        "x": out_x,
        "y": out_y,
        "width": w,
        "height": h,
        "rotation": el.rotation,
        "name": el.name,
        "linked_device_id": el.linked_device_id,
        "assigned_zone_id": el.assigned_zone_id,
        "device_kind": el.device_kind,
        "wall_attachment": el.wall_attachment,
        "path_points": path_points_json if el.type == "path" else None,
        "symbol_type": el.symbol_type.strip()[:32] if el.type == "symbol" and el.symbol_type else None,
        "symbol_tags": symbol_tags_json if el.type == "symbol" else None,
        "symbol_notes": el.symbol_notes if el.type == "symbol" else None,
    }


def row_to_element_out(row) -> BlueprintElementOut:
    pp: Optional[list[float]] = None
    raw_pp = getattr(row, "path_points", None)
    if raw_pp:
        try:
            parsed = json.loads(raw_pp)
            if isinstance(parsed, list):
                pp = [float(x) for x in parsed]
        except (json.JSONDecodeError, TypeError, ValueError):
            pp = None
    stags: Optional[list[str]] = None
    raw_tags = getattr(row, "symbol_tags", None)
    if raw_tags:
        try:
            tp = json.loads(raw_tags)
            if isinstance(tp, list):
                stags = [str(x) for x in tp]
        except (json.JSONDecodeError, TypeError, ValueError):
            stags = None
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
        wall_attachment=row.wall_attachment,
        path_points=pp,
        symbol_type=getattr(row, "symbol_type", None),
        symbol_tags=stags,
        symbol_notes=getattr(row, "symbol_notes", None),
    )
