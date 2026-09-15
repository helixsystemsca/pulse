"""GET /api/qr/resources must not 500 when a linked resource_id is not a UUID."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.security import create_access_token
from app.models.domain import (
    FacilityEquipment,
    FacilityEquipmentStatus,
    QrResource,
    User,
    UserRole,
)


@pytest.mark.asyncio
async def test_list_qr_resources_survives_invalid_linked_pk(
    client: AsyncClient, db_session: AsyncSession, seeded_tenant
):
    admin = await db_session.get(User, seeded_tenant.manager_id)
    assert admin is not None
    admin.roles = [UserRole.company_admin.value]
    await db_session.flush()
    token = create_access_token(
        subject=admin.id,
        extra_claims={
            "company_id": seeded_tenant.company_id,
            "role": UserRole.company_admin.value,
            "tv": 0,
        },
    )

    eq = FacilityEquipment(
        id=str(uuid4()),
        company_id=seeded_tenant.company_id,
        name="Civic Arena ice plant",
        type="Refrigeration",
        status=FacilityEquipmentStatus.active,
    )
    db_session.add(eq)
    now = datetime.now(timezone.utc)
    db_session.add(
        QrResource(
            id=str(uuid4()),
            company_id=seeded_tenant.company_id,
            name="Ice plant QR",
            resource_type="equipment",
            resource_id=eq.id,
            qr_token="ICEPLANT01",
            guest_access_enabled=True,
            guest_access_level="read_only",
            created_at=now,
            updated_at=now,
        )
    )
    db_session.add(
        QrResource(
            id=str(uuid4()),
            company_id=seeded_tenant.company_id,
            name="Legacy bad link",
            resource_type="equipment",
            resource_id="not-a-uuid",
            qr_token="BADLINK001",
            guest_access_enabled=False,
            guest_access_level="none",
            created_at=now,
            updated_at=now,
        )
    )
    await db_session.flush()

    r = await client.get(
        "/api/qr/resources",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    names = {row["name"] for row in items}
    assert "Ice plant QR" in names
    assert "Legacy bad link" in names
    ice = next(row for row in items if row["name"] == "Ice plant QR")
    assert ice["linked_resource_label"] == "Civic Arena ice plant"
    bad = next(row for row in items if row["name"] == "Legacy bad link")
    assert bad["linked_resource_label"] is None
