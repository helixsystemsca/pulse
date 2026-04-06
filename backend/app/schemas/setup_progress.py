"""Dashboard facility setup checklist — derived counts per tenant."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SetupProgressOut(BaseModel):
    blueprint_count: int = Field(ge=0)
    zone_count: int = Field(ge=0)
    equipment_count: int = Field(ge=0)
    worker_user_count: int = Field(ge=0, description="Active users with role=worker in this company.")
    procedure_task_count: int = Field(ge=0, description="Project tasks (procedures) for this company.")

    facility_layout_done: bool
    zones_done: bool
    equipment_done: bool
    workers_done: bool
    procedures_done: bool
