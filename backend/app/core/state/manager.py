"""
State manager — aggregates current truth for tools, workers, and inventory snapshots.

Mutations should go through domain services that emit events; this class offers
read models and thin write helpers used by core inference and modules.
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events.engine import EventEngine
from app.core.events.types import DomainEvent
from app.models.domain import InventoryItem, Tool, ToolStatus, User


class StateManager:
    """Coordinates reads and publishes state_change events when data changes."""

    def __init__(self, db: AsyncSession, bus: EventEngine) -> None:
        self._db = db
        self._bus = bus

    async def get_tool_by_tag(self, company_id: str, tag_id: str) -> Optional[Tool]:
        q = await self._db.execute(
            select(Tool).where(Tool.company_id == company_id, Tool.tag_id == tag_id)
        )
        return q.scalar_one_or_none()

    async def assign_tool_to_worker(
        self,
        company_id: str,
        tool: Tool,
        worker: User,
        source_module: str,
    ) -> Tool:
        tool.assigned_user_id = worker.id
        tool.status = ToolStatus.assigned
        await self._db.flush()
        await self._bus.publish(
            DomainEvent(
                event_type="tool.assigned",
                company_id=company_id,
                entity_id=tool.id,
                metadata={"tool_id": tool.id, "worker_id": worker.id, "tag_id": tool.tag_id},
                source_module=source_module,
            )
        )
        return tool

    async def set_tool_zone(
        self,
        company_id: str,
        tool: Tool,
        zone_id: Optional[str],
        source_module: str,
    ) -> Tool:
        prev = tool.zone_id
        tool.zone_id = zone_id
        await self._db.flush()
        await self._bus.publish(
            DomainEvent(
                event_type="tool.zone_changed",
                company_id=company_id,
                entity_id=tool.id,
                metadata={
                    "tool_id": tool.id,
                    "tag_id": tool.tag_id,
                    "previous_zone_id": prev,
                    "zone_id": zone_id,
                },
                source_module=source_module,
            )
        )
        return tool

    async def inventory_snapshot(self, company_id: str) -> list[dict[str, Any]]:
        q = await self._db.execute(select(InventoryItem).where(InventoryItem.company_id == company_id))
        items = q.scalars().all()
        return [
            {
                "id": i.id,
                "sku": i.sku,
                "name": i.name,
                "quantity": i.quantity,
                "low_stock_threshold": i.low_stock_threshold,
            }
            for i in items
        ]
