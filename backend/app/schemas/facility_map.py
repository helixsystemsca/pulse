"""Pydantic models for `/api/maps` (facility drawings)."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from app.schemas.blueprint import (
    BlueprintElementIn,
    BlueprintElementOut,
    BlueprintLayer,
    TaskOverlayIn,
    TaskOverlayOut,
    default_blueprint_layers,
    layers_model_to_json,
    parse_layers_json,
    parse_tasks_json,
    tasks_model_to_json,
)


def parse_elements_json(raw: Optional[str]) -> list[BlueprintElementOut]:
    if not raw or not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(data, list):
        return []
    out: list[BlueprintElementOut] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            out.append(BlueprintElementOut.model_validate(item))
        except ValueError:
            continue
    return out


def serialize_elements_json(elements: list[BlueprintElementIn]) -> str:
    rows: list[dict] = []
    for el in elements:
        d = el.model_dump(mode="json")
        if not d.get("id"):
            d["id"] = str(uuid4())
        rows.append(d)
    return json.dumps(rows)


class MapSummaryOut(BaseModel):
    id: str
    name: str
    project_id: Optional[str] = Field(None, description="pulse_projects.id when scoped")
    category: str
    created_at: datetime
    updated_at: datetime


class MapDetailOut(MapSummaryOut):
    image_url: str
    elements: list[BlueprintElementOut]
    tasks: list[TaskOverlayOut] = []
    layers: list[BlueprintLayer] = []


class MapCreateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    project_id: Optional[str] = Field(None, description="pulse_projects.id — scope map to a project")
    category: str = Field("General", min_length=1, max_length=128)
    image_url: str = Field("", description="Image URL or data URL for the base layer")
    elements: list[BlueprintElementIn] = []
    tasks: list[TaskOverlayIn] = []
    layers: list[BlueprintLayer] = []

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

    @field_validator("layers")
    @classmethod
    def max_layers(cls, v: list) -> list:
        if len(v) > 80:
            raise ValueError("Too many layers (max 80)")
        return v


class MapUpdateIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=128)
    image_url: str = Field("", description="Image URL or data URL for the base layer")
    elements: list[BlueprintElementIn] = []
    tasks: list[TaskOverlayIn] = []
    layers: list[BlueprintLayer] = []

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

    @field_validator("layers")
    @classmethod
    def max_layers_update(cls, v: list) -> list:
        if len(v) > 80:
            raise ValueError("Too many layers (max 80)")
        return v
