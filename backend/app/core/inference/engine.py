"""
Inference engine — proximity-based tool assignment, simple behavior hooks.

Keeps heuristics isolated from modules; modules call these helpers after ingesting
passive signals (BLE, weight sensors, etc.).
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events.engine import EventEngine
from app.core.events.types import DomainEvent
from app.core.state.manager import StateManager
from app.models.domain import Tool, ToolStatus, User, Zone


class InferenceEngine:
    """Pluggable inference; extend with ML or rules without coupling modules."""

    def __init__(self, db: AsyncSession, bus: EventEngine, state: StateManager) -> None:
        self._db = db
        self._bus = bus
        self._state = state

    async def assign_tool_by_worker_zone_proximity(
        self,
        company_id: str,
        tool: Tool,
        worker_hint_user_id: str,
        source_module: str,
    ) -> Optional[Tool]:
        """
        If worker is 'near' tool zone (same zone id), assign tool to worker.
        Real BLE stacking would map beacon -> zone -> user presence.
        """
        wq = await self._db.execute(select(User).where(User.id == worker_hint_user_id, User.company_id == company_id))
        worker = wq.scalar_one_or_none()
        if not worker or not tool.zone_id:
            return None
        zq = await self._db.execute(select(Zone).where(Zone.id == tool.zone_id, Zone.company_id == company_id))
        zone = zq.scalar_one_or_none()
        if not zone:
            return None
        # Demo rule: any worker in same zone as tool gets assignment
        assign = await self._state.assign_tool_to_worker(company_id, tool, worker, source_module)
        return assign

    async def flag_missing_tools(self, company_id: str, expected_tag_ids: set[str], source_module: str) -> list[str]:
        """Return tags that are expected on site but not seen in the latest scan batch."""
        q = await self._db.execute(select(Tool).where(Tool.company_id == company_id))
        tools = q.scalars().all()
        seen = {t.tag_id for t in tools if t.status != ToolStatus.missing}
        missing = sorted(expected_tag_ids - seen)
        for tag in missing:
            q = await self._db.execute(select(Tool).where(Tool.company_id == company_id, Tool.tag_id == tag))
            trow = q.scalar_one_or_none()
            await self._bus.publish(
                DomainEvent(
                    event_type="tool.missing_detected",
                    company_id=company_id,
                    entity_id=trow.id if trow else None,
                    metadata={"tag_id": tag, "confidence": 0.9},
                    source_module=source_module,
                )
            )
        return missing
