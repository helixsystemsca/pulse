"""Pydantic models for `/api/blueprints`."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


class TaskOverlayBase(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    title: str = Field(..., min_length=1, max_length=400)
    mode: Literal["steps", "paragraph"]
    content: str | list[str]
    linked_element_ids: list[str] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def content_shape(self) -> "TaskOverlayBase":
        if self.mode == "paragraph":
            if isinstance(self.content, list):
                raise ValueError("paragraph tasks require string content")
            if len(str(self.content)) > 12000:
                raise ValueError("paragraph content too long")
        else:
            if not isinstance(self.content, list):
                raise ValueError("steps tasks require a list of strings")
            if len(self.content) > 250:
                raise ValueError("too many steps")
            for i, line in enumerate(self.content):
                if len(str(line)) > 4000:
                    raise ValueError(f"step {i} is too long")
        return self


class TaskOverlayIn(TaskOverlayBase):
    pass


class TaskOverlayOut(TaskOverlayBase):
    pass


class BlueprintElementBase(BaseModel):
    type: Literal[
        "zone",
        "device",
        "door",
        "path",
        "symbol",
        "group",
        "connection",
        "rectangle",
        "ellipse",
        "polygon",
    ]
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: float = 0.0
    locked: bool = False
    name: Optional[str] = None
    linked_device_id: Optional[str] = None
    assigned_zone_id: Optional[str] = None
    device_kind: Optional[str] = Field(None, description="pump | tank | sensor | generic")
    wall_attachment: Optional[str] = Field(
        None,
        description='Door on zone wall: "{zone_element_id}:{edge}:{t}" edge 0–3, t in [0,1]',
    )
    path_points: Optional[list[float]] = Field(
        None, description="Flat x,y pairs, closed polygon (path type or zone with arbitrary outline)"
    )
    symbol_type: Optional[str] = Field(
        None,
        description="symbol discriminator, e.g. tree | bush | sprinkler | valve | pump | motor | filter",
        max_length=32,
    )
    symbol_tags: Optional[list[str]] = Field(None, description="Labels for search / maintenance (symbol type)")
    symbol_notes: Optional[str] = Field(None, description="Free-form notes (symbol type)")
    children: Optional[list[str]] = Field(
        None,
        description='Child element ids when type is "group" (ordered; persisted as JSON)',
    )
    connection_from: Optional[str] = Field(None, description="Start element id (type connection)")
    connection_to: Optional[str] = Field(None, description="End element id (type connection)")
    connection_style: Optional[Literal["electrical", "plumbing"]] = None
    corner_radius: Optional[float] = Field(
        None,
        ge=0.0,
        description="Rounded corners for type rectangle (px); clamped client-side to half the shorter side",
    )

    @model_validator(mode="after")
    def group_children_shape(self) -> "BlueprintElementBase":
        if self.type == "connection":
            ch = self.children
            if ch:
                raise ValueError("connection cannot have children")
            pts = self.path_points or []
            if len(pts) < 4 or len(pts) % 2 != 0:
                raise ValueError("connection requires path_points with at least 2 points (flat x,y)")
            if not self.connection_from or not str(self.connection_from).strip():
                raise ValueError("connection requires connection_from")
            if not self.connection_to or not str(self.connection_to).strip():
                raise ValueError("connection requires connection_to")
            if str(self.connection_from).strip() == str(self.connection_to).strip():
                raise ValueError("connection_from and connection_to must differ")
            try:
                UUID(str(self.connection_from).strip())
                UUID(str(self.connection_to).strip())
            except ValueError as e:
                raise ValueError("connection endpoints must be UUIDs") from e
            if not self.connection_style:
                raise ValueError("connection requires connection_style")
        elif self.connection_from is not None or self.connection_to is not None or self.connection_style is not None:
            raise ValueError("connection_from / connection_to / connection_style only valid for type connection")
        if self.type == "group":
            ch = self.children or []
            if len(ch) < 2:
                raise ValueError('group requires at least 2 children')
            seen: set[str] = set()
            for raw in ch:
                sid = str(raw).strip()
                if not sid:
                    raise ValueError("group children must be non-empty UUID strings")
                try:
                    UUID(sid)
                except ValueError as e:
                    raise ValueError("group child id must be a UUID") from e
                if sid in seen:
                    raise ValueError("group children must be unique")
                seen.add(sid)
        elif self.children:
            raise ValueError("children is only valid for type group")
        if self.corner_radius is not None and self.type != "rectangle":
            raise ValueError("corner_radius is only valid for type rectangle")
        if self.type == "rectangle":
            if self.width is None or self.height is None or self.width < 1 or self.height < 1:
                raise ValueError("rectangle requires positive width and height")
        if self.type == "ellipse":
            if self.width is None or self.height is None or self.width < 1 or self.height < 1:
                raise ValueError("ellipse requires positive width and height")
        if self.type == "polygon":
            pts = self.path_points or []
            if len(pts) < 6 or len(pts) % 2 != 0:
                raise ValueError("polygon requires path_points with at least 3 vertices (flat x,y list)")
        return self


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
    tasks: list[TaskOverlayOut] = []


class BlueprintCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    elements: list[BlueprintElementIn] = []
    tasks: list[TaskOverlayIn] = []

    @field_validator("elements")
    @classmethod
    def max_elements(cls, v: list) -> list:
        if len(v) > 2000:
            raise ValueError("Too many elements (max 2000)")
        return v

    @field_validator("tasks")
    @classmethod
    def max_tasks(cls, v: list) -> list:
        if len(v) > 500:
            raise ValueError("Too many tasks (max 500)")
        return v


class BlueprintUpdateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    elements: list[BlueprintElementIn] = []
    tasks: list[TaskOverlayIn] = []

    @field_validator("elements")
    @classmethod
    def max_elements(cls, v: list) -> list:
        if len(v) > 2000:
            raise ValueError("Too many elements (max 2000)")
        return v

    @field_validator("tasks")
    @classmethod
    def max_tasks(cls, v: list) -> list:
        if len(v) > 500:
            raise ValueError("Too many tasks (max 500)")
        return v


def element_in_to_orm_kwargs(el: BlueprintElementIn, *, blueprint_id: str) -> dict:
    path_points_json: Optional[str] = None
    symbol_tags_json: Optional[str] = None
    children_json: Optional[str] = None
    out_x, out_y = el.x, el.y
    if el.type == "zone":
        pts = el.path_points or []
        if pts:
            if len(pts) < 6 or len(pts) % 2 != 0:
                raise ValueError("zone path_points requires at least 3 vertices (flat x,y list)")
            xs = pts[0::2]
            ys = pts[1::2]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            bx = min_x
            by = min_y
            w = max(max_x - min_x, 1.0) if max_x > min_x else 1.0
            h = max(max_y - min_y, 1.0) if max_y > min_y else 1.0
            path_points_json = json.dumps(pts)
            out_x, out_y = bx, by
        else:
            if el.width is None or el.height is None or el.width < 1 or el.height < 1:
                raise ValueError("Zone requires positive width and height")
            w, h = el.width, el.height
            path_points_json = None
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
    elif el.type == "group":
        ch = el.children or []
        w = el.width if el.width is not None else 1.0
        h = el.height if el.height is not None else 1.0
        children_json = json.dumps([str(c).strip() for c in ch])
    elif el.type == "connection":
        pts = el.path_points or []
        if len(pts) < 4 or len(pts) % 2 != 0:
            raise ValueError("connection requires path_points with at least 2 points (flat x,y)")
        xs = pts[0::2]
        ys = pts[1::2]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        out_x, out_y = min_x, min_y
        w = max(max_x - min_x, 1.0) if max_x > min_x else 1.0
        h = max(max_y - min_y, 1.0) if max_y > min_y else 1.0
        path_points_json = json.dumps([float(x) for x in pts])
    elif el.type == "rectangle":
        if el.width is None or el.height is None or el.width < 1 or el.height < 1:
            raise ValueError("rectangle requires positive width and height")
        w, h = el.width, el.height
        path_points_json = None
        out_x, out_y = el.x, el.y
    elif el.type == "ellipse":
        if el.width is None or el.height is None or el.width < 1 or el.height < 1:
            raise ValueError("ellipse requires positive width and height")
        w, h = el.width, el.height
        path_points_json = None
        out_x, out_y = el.x, el.y
    elif el.type == "polygon":
        pts = el.path_points or []
        if len(pts) < 6 or len(pts) % 2 != 0:
            raise ValueError("polygon requires path_points with at least 3 vertices (flat x,y list)")
        xs = pts[0::2]
        ys = pts[1::2]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        bx = min_x
        by = min_y
        w = max_x - min_x if max_x > min_x else 1.0
        h = max_y - min_y if max_y > min_y else 1.0
        path_points_json = json.dumps([float(x) for x in pts])
        out_x, out_y = bx, by
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
        "path_points": path_points_json,
        "symbol_type": el.symbol_type.strip()[:32] if el.type == "symbol" and el.symbol_type else None,
        "symbol_tags": symbol_tags_json if el.type == "symbol" else None,
        "symbol_notes": el.symbol_notes if el.type == "symbol" else None,
        "locked": el.locked,
        "children_json": children_json if el.type == "group" else None,
        "connection_from_id": str(el.connection_from).strip() if el.type == "connection" and el.connection_from else None,
        "connection_to_id": str(el.connection_to).strip() if el.type == "connection" and el.connection_to else None,
        "connection_style": el.connection_style if el.type == "connection" else None,
        "corner_radius": float(el.corner_radius)
        if el.type == "rectangle" and el.corner_radius is not None
        else None,
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
    child_ids: Optional[list[str]] = None
    raw_children = getattr(row, "children_json", None)
    if raw_children:
        try:
            cp = json.loads(raw_children)
            if isinstance(cp, list):
                child_ids = [str(x) for x in cp]
        except (json.JSONDecodeError, TypeError, ValueError):
            child_ids = None
    return BlueprintElementOut(
        id=row.id,
        type=row.element_type,  # type: ignore[arg-type]
        x=row.x,
        y=row.y,
        width=row.width,
        height=row.height,
        rotation=row.rotation,
        locked=bool(getattr(row, "locked", False)),
        name=row.name,
        linked_device_id=row.linked_device_id,
        assigned_zone_id=row.assigned_zone_id,
        device_kind=row.device_kind,
        wall_attachment=row.wall_attachment,
        path_points=pp,
        symbol_type=getattr(row, "symbol_type", None),
        symbol_tags=stags,
        symbol_notes=getattr(row, "symbol_notes", None),
        children=child_ids if row.element_type == "group" else None,
        connection_from=str(getattr(row, "connection_from_id")).strip()
        if getattr(row, "connection_from_id", None) and row.element_type == "connection"
        else None,
        connection_to=str(getattr(row, "connection_to_id")).strip()
        if getattr(row, "connection_to_id", None) and row.element_type == "connection"
        else None,
        connection_style=(
            getattr(row, "connection_style", None)
            if row.element_type == "connection"
            and getattr(row, "connection_style", None) in ("electrical", "plumbing")
            else None
        ),
        corner_radius=float(row.corner_radius)
        if row.element_type == "rectangle" and getattr(row, "corner_radius", None) is not None
        else None,
    )


def tasks_model_to_json(tasks: list[TaskOverlayIn]) -> Optional[str]:
    if not tasks:
        return None
    return json.dumps([t.model_dump(mode="json") for t in tasks])


def parse_tasks_json(raw: Optional[str]) -> list[TaskOverlayOut]:
    if not raw or not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(data, list):
        return []
    out: list[TaskOverlayOut] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            out.append(TaskOverlayOut.model_validate(item))
        except ValueError:
            continue
    return out
